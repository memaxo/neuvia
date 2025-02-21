import { RunnableSequence, RunnableMap } from "@langchain/core/runnables";
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
  reportPlannerInstructions,
  sectionWriterInstructions
} from "../prompts";

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

/**
 * Main research chain that orchestrates the research process
 */
export class ResearchChain extends EventEmitter {
  private readonly model: ChatOpenAI | ChatAnthropic;
  private readonly cache: ResearchCache;
  private readonly searchRepository: SearchRepository;

  constructor(
    private readonly config: ResearchConfig,
    cacheConfig?: CacheConfig
  ) {
    super();
    
    try {
      // Initialize enhanced caching
      this.cache = new ResearchCache(cacheConfig);

      // Initialize the appropriate model with caching
      this.model = this.initializeModel();
      
      // Initialize search repository
      this.searchRepository = new SearchRepository(
        config.searchProvider,
        config.rateLimits
      );
    } catch (error) {
      throw wrapError(error, "Failed to initialize research chain");
    }
  }

  private initializeModel() {
    const modelConfig = {
      cache: this.cache.getClient(),
      maxRetries: 3,
      maxConcurrency: 5,
      modelName: this.config.model,
      temperature: 0.3
    };

    return this.config.model === SupportedModels.GPT4
      ? new ChatOpenAI(modelConfig)
      : new ChatAnthropic(modelConfig);
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
        // Note: validInput is used to validate the input shape
        PlanInputSchema.parse(input);
        
        const prompt = new PromptTemplate({
          template: reportPlannerInstructions,
          inputVariables: ["topic", "report_organization", "context", "feedback"]
        });

        // FIXME: Report organization should come from ResearchConfig.reportStructure
        // This is a temporary placeholder until the config is updated
        const formattedPrompt = await prompt.format({
          topic: input.topic,
          report_organization: "",
          context: "",
          feedback: ""
        });

        const response = await this.model.invoke([
          new SystemMessage("You are a research planner."),
          new HumanMessage(formattedPrompt)
        ]);

        if (!response || typeof response.content !== 'string') {
          throw new ValidationError("Invalid model response", response);
        }

        const sections = response.content
          .split("\n")
          .filter((line: string) => line.trim())
          .map((title: string) => ({
            title,
            status: "pending" as const,
            sources: []
          }));

        return {
          topic: input.topic,
          depth: this.config.maxSourcesPerQuery,
          sections
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
  private async researchSections(state: ResearchState): Promise<ResearchState["sections"]> {
    const researched = await Promise.all(
      state.sections.map(async section => {
        try {
          this.emitProgress({
            sectionId: section.title,
            status: "researching",
            percent: 25
          });

          // Check cache first
          const cacheKey = { topic: state.topic, section: section.title };
          const cached = await this.cache.get<SectionOutput>(cacheKey);
          
          if (cached) {
            return {
              ...section,
              content: cached.content,
              sources: cached.citations.map((c: { url: string }) => c.url),
              status: "complete" as const
            };
          }

          // Perform search
          const results = await this.searchRepository.search(
            `${state.topic} ${section.title}`
          );

          // Generate content with improved prompt
          const content = await this.generateContent(section.title, results);

          // Validate content against schema
          const validContent = SectionSchema.parse(content);

          // Cache the validated result
          await this.cache.set(cacheKey, validContent);

          this.emitProgress({
            sectionId: section.title,
            status: "complete",
            percent: 100
          });

          return {
            ...section,
            content: validContent.content,
            sources: validContent.citations.map((c: { url: string }) => c.url),
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
      const validInput = PlanInputSchema.parse(input);
      return {
        topic: validInput.topic,
        depth: 1,
        sections: [{
          title: "Overview",
          status: "pending",
          sources: []
        }]
      };
    } catch (error) {
      throw new ValidationError("Invalid input for simplified research", error);
    }
  }

  /**
   * Synthesize final results
   */
  private createSynthesizeResults() {
    return async (
      parallel: ParallelOutput
    ): Promise<ResearchState> => {
      return {
        topic: "",  // Will be filled from previous state
        depth: this.config.maxSourcesPerQuery,
        sections: parallel.sections
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
        template: sectionWriterInstructions,
        inputVariables: ["section_topic", "section_content", "context"]
      });

      const formattedPrompt = await prompt.format({
        section_topic: title,
        section_content: "",
        context: input.sources
      });

      const response = await this.model.invoke([
        new SystemMessage("You are a section content writer."),
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