import { RunnableSequence, RunnableMap, Runnable } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { EventEmitter } from "events";
import { z } from "zod";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { PromptTemplate } from "@langchain/core/prompts";

import { ResearchConfig, SupportedModels } from "../configuration";
import { ResearchState, ResearchOutput, ProgressUpdate } from "../state";
import { SearchRepository } from "../services/search";
import { ResearchCache, type CacheConfig } from "../services/cache";
import {
  ExternalServiceError,
  ResearchProcessError,
  ValidationError,
  wrapError
} from "../errors";
import {
  createPromptWithSystem,
  SYSTEM_MESSAGES
} from "../prompts/index";
import {
  ReportPlanSchema,
  SectionContentSchema,
  SectionGradeSchema,
  FinalSectionSchema,
  type ReportPlan,
  type SectionContent,
  type SectionGrade,
  type FinalSection,
  type ReportSection
} from "../prompts/schemas";

export type SectionOutput = {
  title: string;
  content: string;
  keyFindings: string[];
  citations: { text: string; url: string }[];
};

export const PlanInputSchema = z.object({ topic: z.string() });
export const ContentInputSchema = z.object({
  title: z.string(),
  sources: z.string()
});
export const SectionSchema = z.object({
  title: z.string(),
  content: z.string(),
  keyFindings: z.array(z.string()),
  citations: z.array(z.object({ text: z.string(), url: z.string() }))
});

// Add type definitions for LLM responses and chain inputs/outputs
export interface ModelResponse {
  content: string;
}

export interface ChainInput {
  topic: string;
}

export interface ParallelOutput {
  sections: ResearchState["sections"];
  context: string;
}

interface Section {
  title: string;
  content?: string;
  sources?: string[];
  status: "pending" | "researching" | "writing" | "complete";
}

interface StructuredModels {
  planModel: Runnable<any, ReportPlan>;
  contentModel: Runnable<any, SectionContent>;
  gradeModel: Runnable<any, SectionGrade>;
  finalModel: Runnable<any, FinalSection>;
}

/**
 * Main research chain that orchestrates the research process
 */
export class ResearchChain extends EventEmitter {
  private readonly models: StructuredModels;
  private readonly cache: ResearchCache;
  private readonly searchRepository: SearchRepository;
  private readonly planPrompt: PromptTemplate;
  private readonly contentPrompt: PromptTemplate;
  private readonly graderPrompt: PromptTemplate;
  private readonly finalPrompt: PromptTemplate;

  constructor(
    private readonly config: ResearchConfig & { reportStructure?: string },
    cacheConfig?: CacheConfig
  ) {
    super();
    
    try {
      // Initialize enhanced caching
      this.cache = new ResearchCache(cacheConfig);

      // Initialize prompts
      this.planPrompt = createPromptWithSystem(
        "Create a research plan for {topic} with organization {report_organization}",
        "RESEARCHER"
      );
      this.contentPrompt = createPromptWithSystem(
        "Write content for section {title} using sources: {sources}",
        "WRITER"
      );
      this.graderPrompt = createPromptWithSystem(
        "Grade section {title} with content: {content}",
        "FACT_CHECKER"
      );
      this.finalPrompt = createPromptWithSystem(
        "Write a {type} section using context: {context}",
        "WRITER"
      );

      // Initialize the appropriate model with caching
      this.models = this.initializeModels();
      
      // Initialize search repository
      this.searchRepository = new SearchRepository(
        config.searchProvider,
        config.rateLimits
      );
    } catch (error) {
      throw wrapError(error, "Failed to initialize research chain");
    }
  }

  private initializeModels(): StructuredModels {
    const modelConfig = {
      cache: this.cache.getClient(),
      maxRetries: 3,
      maxConcurrency: 5,
      modelName: this.config.model,
      temperature: 0.3
    };

    const baseModel = this.config.model === SupportedModels.GPT4
      ? new ChatOpenAI(modelConfig)
      : new ChatAnthropic(modelConfig);

    // Create models with structured output
    return {
      planModel: baseModel.withStructuredOutput(ReportPlanSchema),
      contentModel: baseModel.withStructuredOutput(SectionContentSchema),
      gradeModel: baseModel.withStructuredOutput(SectionGradeSchema),
      finalModel: baseModel.withStructuredOutput(FinalSectionSchema)
    };
  }

  async execute(topic: string): Promise<ResearchOutput> {
    const mainChain = RunnableSequence.from([
      // Initialize state
      async (input: { topic: string }) => {
        const state = await this.createInitializeState()(input);
        return { state };
      },
      // Parallel research
      async ({ state }) => {
        const runner = RunnableMap.from({
          sections: async () => this.researchSections(state),
          context: async () => this.gatherContext(state)
        }).withRetry({
          stopAfterAttempt: 3,
          onFailedAttempt: (error: Error) => {
            if (error instanceof ExternalServiceError) {
              console.error("Service error:", error.toJSON());
            }
          }
        });
        const result = await runner.invoke({});
        return { state, parallel: result };
      },
      // Synthesize results
      async ({ state, parallel }) => {
        const finalState = await this.createSynthesizeResults()(parallel);
        return finalState;
      }
    ]);

    try {
      let state: ResearchState;
      try {
        state = await mainChain.invoke({ topic });
      } catch (error) {
        // Fallback to simplified research if main chain fails
        state = await this.simplifiedResearch({ topic });
      }

      return {
        state,
        progress: this.getProgressUpdates(state)
      };
    } catch (error) {
      const wrappedError = wrapError(error);
      return {
        state: this.createInitialState(topic),
        progress: [],
        error: wrappedError.message
      };
    }
  }

  private createInitialState(topic: string): ResearchState {
    return {
      topic,
      depth: this.config.maxSourcesPerQuery,
      sections: []
    };
  }

  /**
   * Initialize research state with improved prompt
   */
  private createInitializeState() {
    return async (input: ChainInput): Promise<ResearchState> => {
      try {
        const formattedPrompt = await this.planPrompt.format({
          topic: input.topic,
          report_organization: this.config.reportStructure || ""
        });

        const response = await this.models.planModel.invoke([
          new SystemMessage(SYSTEM_MESSAGES.RESEARCHER),
          new HumanMessage(formattedPrompt)
        ]) as ReportPlan;

        return {
          topic: input.topic,
          depth: this.config.maxSourcesPerQuery,
          sections: response.sections.map(section => ({
            title: section.name,
            status: "pending" as const,
            sources: [],
            content: section.content
          }))
        };
      } catch (error) {
        throw new ResearchProcessError(
          "Failed to initialize research state",
          undefined,
          error
        );
      }
    };
  }

  /**
   * Research individual sections with improved content generation
   */
  private async researchSections(state: ResearchState): Promise<Section[]> {
    const researched = await Promise.all(
      state.sections.map(async (section: Section) => {
        try {
          this.emitProgress({
            sectionId: section.title,
            status: "researching",
            percent: 25
          });

          // Check cache first
          const cacheKey = { topic: state.topic, section: section.title };
          const cached = await this.cache.get<SectionContent>(cacheKey);
          
          if (cached) {
            return {
              ...section,
              content: cached.content,
              sources: cached.citations.map(c => c.url),
              status: "complete" as const
            };
          }

          // Perform search
          const results = await this.searchRepository.search(
            `${state.topic} ${section.title}`
          );

          // Generate content with improved prompt
          const formattedPrompt = await this.contentPrompt.format({
            title: section.title,
            sources: results.map(s => `${s.content} (${s.url})`).join("\n\n")
          });

          const response = await this.models.contentModel.invoke([
            new SystemMessage(SYSTEM_MESSAGES.WRITER),
            new HumanMessage(formattedPrompt)
          ]) as SectionContent;

          await this.cache.set(cacheKey, response);

          this.emitProgress({
            sectionId: section.title,
            status: "complete",
            percent: 100
          });

          return {
            ...section,
            content: response.content,
            sources: response.citations.map(c => c.url),
            status: "complete" as const
          };
        } catch (error) {
          console.error(`Error researching section ${section.title}:`, error);
          throw new ResearchProcessError(
            `Failed to research section: ${section.title}`,
            section.title,
            error
          );
        }
      })
    );

    return researched;
  }

  /**
   * Gather context from research
   */
  private async gatherContext(state: ResearchState): Promise<string> {
    return state.sections
      .map(s => `${s.title}\n${s.content ?? "Pending research..."}`)
      .join("\n\n");
  }

  /**
   * Simplified research fallback
   */
  private async simplifiedResearch(input: { topic: string }): Promise<ResearchState> {
    try {
      const formattedPrompt = await this.planPrompt.format({
        topic: input.topic,
        report_organization: "Simple overview"
      });

      const response = await this.models.planModel.invoke([
        new SystemMessage(SYSTEM_MESSAGES.RESEARCHER),
        new HumanMessage(formattedPrompt)
      ]) as ReportPlan;

      return {
        topic: input.topic,
        depth: 1,
        sections: response.sections.slice(0, 1).map(section => ({
          title: section.name,
          status: "pending" as const,
          sources: [],
          content: section.content
        }))
      };
    } catch (error) {
      throw new ValidationError("Invalid input for simplified research", error);
    }
  }

  /**
   * Synthesize final results
   */
  private createSynthesizeResults() {
    return async (parallel: ParallelOutput): Promise<ResearchState> => {
      const formattedPrompt = await this.finalPrompt.format({
        type: "conclusion",
        context: parallel.context
      });

      const response = await this.models.finalModel.invoke([
        new SystemMessage(SYSTEM_MESSAGES.WRITER),
        new HumanMessage(formattedPrompt)
      ]) as FinalSection;

      return {
        topic: "",  // Will be filled from previous state
        depth: this.config.maxSourcesPerQuery,
        sections: [...parallel.sections, {
          title: response.title,
          content: response.content,
          status: "complete" as const,
          sources: []
        }]
      };
    };
  }

  /**
   * Emit progress updates
   */
  private emitProgress(progress: ProgressUpdate): void {
    this.emit("progress", progress);
  }

  /**
   * Get all progress updates for a state
   */
  private getProgressUpdates(state: ResearchState): ProgressUpdate[] {
    return state.sections.map(section => ({
      sectionId: section.title,
      status: section.status,
      percent: section.status === "complete" ? 100 : 0
    }));
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.cache.cleanup();
  }

  /**
   * Generate content for a section with structured output
   */
  private async generateContent(
    title: string,
    sources: { content: string; url: string }[]
  ): Promise<SectionOutput> {
    try {
      const input = ContentInputSchema.parse({
        title,
        sources: sources.map(s => `${s.content} (${s.url})`).join("\n\n")
      });

      const prompt = new PromptTemplate({
        template: this.contentPrompt.template,
        inputVariables: ["title", "sources"]
      });

      const formattedPrompt = await prompt.format({
        title,
        sources: input.sources
      });

      const response = await this.models.contentModel.invoke([
        new SystemMessage(SYSTEM_MESSAGES.WRITER),
        new HumanMessage(formattedPrompt)
      ]);

      if (!response || typeof response.content !== 'string') {
        throw new ValidationError("Invalid model response", response);
      }

      const citations = response.content.match(/\((https?:\/\/[^\s)]+)\)/g)?.map((url: string) => ({
        text: "",
        url: url.slice(1, -1)
      })) ?? [];

      return SectionSchema.parse({
        title,
        content: response.content,
        keyFindings: [],
        citations
      });
    } catch (error) {
      throw new ExternalServiceError(
        "Failed to generate content",
        "model",
        undefined,
        error
      );
    }
  }
} 