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
    try {
      // 1) Initialize state
      let state = this.initializeResearchState(topic);

      // 2) Generate an initial plan with planModel (use planPrompt)
      //    This is where we define sections that may need research.
      try {
        const planPromptText = await this.planPrompt.format({
          topic,
          report_organization: this.config.report_structure ?? "Standard Organization"
        });
        this.emitProgress({
          sectionId: "PLAN_GENERATION",
          status: "researching",
          percent: 20,
          eventType: "plan_generation_start",
          timestamp: Date.now()
        });

        const planResponse = await this.models.planModel.invoke([
          new SystemMessage(SYSTEM_MESSAGES.RESEARCHER),
          new HumanMessage(planPromptText)
        ]);

        this.emitProgress({
          sectionId: "PLAN_GENERATION",
          status: "writing",
          percent: 60,
          eventType: "plan_generation_in_progress",
          timestamp: Date.now()
        });

        const parsedPlan = JSON.parse(planResponse.content);
        // Validate with zod
        const validPlan = this.models.planModel.outputSchema.parse(parsedPlan);

        // Convert plan sections to internal state
        const newSections = validPlan.sections.map((section) => ({
          title: section.name,
          content: section.content || "",
          sources: [],
          status: "pending" as const
        }));
        state.sections = newSections;

        this.emitProgress({
          sectionId: "PLAN_GENERATION",
          status: "complete",
          percent: 100,
          eventType: "plan_generation_complete",
          timestamp: Date.now()
        });
      } catch (error) {
        // If plan generation fails, fallback to simplified approach
        console.error("Plan generation failed. Falling back to simplified approach.", error);
        state = await this.simplifiedResearch({ topic });
      }

      // 3) Gather real human feedback or user callback
      const feedback = await this.getHumanFeedback(state);
      if (typeof feedback === "string" && feedback.toLowerCase() !== "true") {
        // attempt re-generation of plan with feedback
        try {
          console.log("User provided feedback, regenerating plan ...");
          const planPromptText = await this.planPrompt.format({
            topic,
            report_organization: this.config.report_structure ?? "Standard Organization"
          });
          const planResponse = await this.models.planModel.invoke([
            new SystemMessage(SYSTEM_MESSAGES.RESEARCHER),
            new HumanMessage(`${planPromptText}\n\nUser Feedback: ${feedback}`)
          ]);
          const parsedPlan = JSON.parse(planResponse.content);
          const validPlan = this.models.planModel.outputSchema.parse(parsedPlan);

          const newSections = validPlan.sections.map((section) => ({
            title: section.name,
            content: section.content || "",
            sources: [],
            status: "pending" as const
          }));
          state.sections = newSections;
        } catch (err) {
          console.error("Plan re-generation failed with user feedback:", err);
        }
      }

      // 4) Parallel or sequential research
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

      const parallelResult = await runner.invoke({});
      const finalState = await this.createSynthesizeResults()(parallelResult);

      return {
        state: finalState,
        progress: this.getProgressUpdates(finalState)
      };
    } catch (error) {
      const wrappedError = wrapError(error);
      return {
        state: {
          topic,
          depth: this.config.maxSourcesPerQuery,
          sections: []
        },
        progress: [],
        error: wrappedError.message
      };
    }
  }

  private createInitialState(topic: string): ResearchState {
      
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
            percent: 10,
            eventType: "section_research_start",
            timestamp: Date.now()
          });

          // Skip sections that have no content or do not truly need research (demo: check if content is empty).
          // For real use, you might check if the plan said "research": false
          if (!section.content && section.status === "pending") {
            // 1) Check cache first
            const cacheKey = { topic: state.topic, section: section.title };
            const cached = await this.cache.get<SectionContent>(cacheKey);
            if (cached) {
              this.emitProgress({
                sectionId: section.title,
                status: "complete",
                percent: 100,
                eventType: "section_from_cache",
                timestamp: Date.now()
              });
              return {
                ...section,
                content: cached.content,
                sources: cached.citations.map(c => c.url),
                status: "complete" as const
              };
            }

            // 2) Generate targeted search queries using queryWriterInstructions
            this.emitProgress({
              sectionId: section.title,
              status: "researching",
              percent: 25,
              eventType: "generating_search_queries",
              timestamp: Date.now()
            });
            const queryPrompt = queryWriterInstructions
              .replace("{section_topic}", section.title)
              .replace("{number_of_queries}", this.config.number_of_queries.toString());
            const queryResponse = await this.models.planModel.invoke([
              new SystemMessage(SYSTEM_MESSAGES.RESEARCHER),
              new HumanMessage(queryPrompt)
            ]);
            const generatedQueries = JSON.parse(queryResponse.content).queries || [];

            // 3) Perform web search for each generated query
            this.emitProgress({
              sectionId: section.title,
              status: "researching",
              percent: 40,
              eventType: "search_in_progress",
              timestamp: Date.now()
            });
            let aggregatedResults = [];
            for (const q of generatedQueries) {
              const results = await this.searchRepository.search(q.search_query);
              aggregatedResults.push(...results);
            }
            this.emitProgress({
              sectionId: section.title,
              status: "writing",
              percent: 50,
              eventType: "search_complete",
              timestamp: Date.now()
            });

            // 4) Prepare sources context
            const sourcesContext = aggregatedResults.map(s => `${s.content} (${s.url})`).join("\n\n");

            // 5) Generate section content using contentPrompt
            const formattedPrompt = await this.contentPrompt.format({
              title: section.title,
              sources: sourcesContext
            });
            let contentResponse: SectionContent = await this.models.contentModel.invoke([
              new SystemMessage(SYSTEM_MESSAGES.WRITER),
              new HumanMessage(formattedPrompt)
            ]) as SectionContent;

            // 6) Grade the generated section
            let graderPrompt = await this.graderPrompt.format({
              title: section.title,
              content: contentResponse.content
            });
            let gradeResponse: SectionGrade = await this.models.gradeModel.invoke([
              new SystemMessage(SYSTEM_MESSAGES.FACT_CHECKER),
              new HumanMessage(graderPrompt)
            ]) as SectionGrade;

            let iterations = 0;
            // 7) If "fail", attempt follow-up queries
            while (gradeResponse.grade === "fail" && iterations < 3) {
              console.warn(`Section "${section.title}" failed grade. Attempting iteration #${iterations + 1}.`);
              this.emitProgress({
                sectionId: section.title,
                status: "researching",
                percent: 60 + iterations * 10,
                eventType: "section_revision",
                timestamp: Date.now()
              });
              const followUp = gradeResponse.followUpQueries?.[0];
              if (followUp) {
                // do follow-up search
                const followUpResults = await this.searchRepository.search(followUp.query);
                const followUpContext = followUpResults.map(s => `${s.content} (${s.url})`).join("\n\n");
                const followUpPrompt = await this.contentPrompt.format({
                  title: section.title,
                  sources: followUpContext
                });
                contentResponse = await this.models.contentModel.invoke([
                  new SystemMessage(SYSTEM_MESSAGES.WRITER),
                  new HumanMessage(followUpPrompt)
                ]) as SectionContent;

                graderPrompt = await this.graderPrompt.format({
                  title: section.title,
                  content: contentResponse.content
                });
                gradeResponse = await this.models.gradeModel.invoke([
                  new SystemMessage(SYSTEM_MESSAGES.FACT_CHECKER),
                  new HumanMessage(graderPrompt)
                ]) as SectionGrade;
              }
              iterations++;
            }

            // 8) Final content
            await this.cache.set(cacheKey, contentResponse);

            this.emitProgress({
              sectionId: section.title,
              status: "complete",
              percent: 100,
              eventType: "section_complete",
              timestamp: Date.now()
            });

            return {
              ...section,
              content: contentResponse.content,
              sources: contentResponse.citations.map(c => c.url),
              status: "complete" as const
            };
          } else {
            // If section already had content or was not pending
            this.emitProgress({
              sectionId: section.title,
              status: "complete",
              percent: 100,
              eventType: "section_skipped",
              timestamp: Date.now()
            });
            return section;
          }
        } catch (error) {
          console.error(`Error researching section "${section.title}":`, error);
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
state: ReportState
): Promise<string | boolean> {
// Simulate human approval for development purposes
return true;
}
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
      const synthesizedSection = {
        title: response.title,
        content: response.content,
        status: "complete" as const,
        sources: []
      };
      return {
        topic: parallel.sections[0]?.topic || "",
        depth: this.config.maxSourcesPerQuery,
        sections: [...parallel.sections, synthesizedSection]
      };
    };
  }

  /**
   * Emit progress updates
   */
  private emitProgress(progress: ProgressUpdate): void {
     // progress now includes eventType and timestamp for richer details
     this.emit("progress", progress);
 }

  /**
   * Initializes the research state with minimal default sections or placeholders.
   * Later, the plan can be generated and stored in the state, allowing for user feedback.
   */
  private initializeResearchState(topic: string): ResearchState {
    this.emitProgress({
      sectionId: "INITIALIZATION",
      status: "pending",
      percent: 0,
      eventType: "initialization_start",
      timestamp: Date.now()
    });

    const baseState: ResearchState = {
      topic,
      depth: this.config.maxSourcesPerQuery,
      sections: []
    };

    this.emitProgress({
      sectionId: "INITIALIZATION",
      status: "complete",
      percent: 100,
      eventType: "initialization_complete",
      timestamp: Date.now()
    });

    return baseState;
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
   * Retrieves human feedback from either a provided callback in config or a console log fallback.
   * If none is provided, returns 'true' by default, indicating user approval.
   */
  private async getHumanFeedback(state: ResearchState): Promise<string | boolean> {
    this.emitProgress({
      sectionId: "HUMAN_FEEDBACK",
      status: "pending",
      percent: 0,
      eventType: "feedback_requested",
      timestamp: Date.now()
    });

    if (this.config && typeof (this.config as any).feedbackCallback === "function") {
      // If the user provided a callback function for feedback, call it
      try {
        const feedbackStr = await (this.config as any).feedbackCallback(state);
        this.emitProgress({
          sectionId: "HUMAN_FEEDBACK",
          status: "complete",
          percent: 100,
          eventType: "feedback_received",
          timestamp: Date.now()
        });
        return feedbackStr || true;
      } catch (err) {
        console.error("Error in feedback callback:", err);
        return true;
      }
    } else {
      // For demonstration, fallback to console simulation
      console.log("No feedback callback provided. Defaulting to 'true' (approval).");
      this.emitProgress({
        sectionId: "HUMAN_FEEDBACK",
        status: "complete",
        percent: 100,
        eventType: "feedback_received",
        timestamp: Date.now()
      });
      return true;
    }
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