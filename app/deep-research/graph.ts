/**
 * Implements the core research workflow for generating detailed reports.
 * Uses a combination of LLM-based planning, web research, and content generation.
 */

import {
    // If you install @langchain/langgraph:
    StateGraph,
} from "@langchain/langgraph";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { loadConfiguration } from "./configuration";
import {
    type Section,
    type Sections,
    type SectionSchema,
    type SectionsSchema,
    type QueriesSchema,
    type Queries,
    type SearchQuery,
    type FeedbackSchema,
    type Feedback,
    type ReportState,
    type SectionState,
} from "./state";
import {
    deduplicateAndFormatSources,
    formatSections,
    tavilySearchAsync,
    perplexitySearch,
    getHumanFeedback,
} from "./utils";
import {
    reportPlannerQueryWriterInstructions,
    reportPlannerInstructions,
    queryWriterInstructions,
    sectionWriterInstructions,
    sectionGraderInstructions,
    finalSectionWriterInstructions,
} from "./prompts";

/**
 * This file demonstrates how you might replicate the "plan, feedback, parallel section building" logic in TS.
 * 
 * Implementation details will vary depending on how you integrate it with Next.js 
 * (e.g., using endpoint routes, or a custom agent with "tools").
 */

// Added interface for the report configuration
interface ReportConfiguration {
  report_structure: string;
  number_of_queries: number;
  planner_model: string;
  search_api: string;
  max_search_depth: number;
}

/**
 * Generates a plan for the report by:
 * 1. Creating search queries based on the topic
 * 2. Performing web research
 * 3. Using research results to plan report sections
 */
export async function generateReportPlan(
    state: ReportState,
    config: ReportConfiguration
): Promise<ReportState> {
    const topic = state.topic;
    const feedback = state.feedback_on_report_plan || "";
    const reportStructure = config.report_structure;
    const numberOfQueries = config.number_of_queries;

    // (Optional) Use an LLM for queries. We might set up an LLM like so:
    // For simplicity below, we're using a ChatOpenAI with function calling:
    const llmModel = new ChatOpenAI({
        modelName: config.planner_model,
        temperature: 0,
    });

    // 2. Prompt for queries to gather context
    const queryPrompt = reportPlannerQueryWriterInstructions
        .replace("{topic}", topic)
        .replace("{report_organization}", reportStructure)
        .replace("{number_of_queries}", numberOfQueries.toString());

    // Here you'd do something like chain call with JSON schema:
    // For brevity, we'll do a naive approach:
    // (In practice, you can utilize OpenAI Functions or zod to parse the function result.)

    // Example: an approximate approach
    const queriesRaw = await llmModel.invoke([
        new SystemMessage("You are a research query generator."),
        new HumanMessage(queryPrompt)
    ]);
    // You would parse `queriesRaw` to extract queries. 
    // We'll assume we got a string with queries line by line, or JSON. 
    // For brevity, let's say:
    const mockQueries: Queries = {
        queries: [
            { search_query: `Mock query about ${topic} #1` },
            { search_query: `Mock query about ${topic} #2` },
        ],
    };

    // 3. Web search
    let searchResponses;
    if (config.search_api === "tavily") {
        searchResponses = await tavilySearchAsync(mockQueries.queries);
    } else {
        searchResponses = await perplexitySearch(mockQueries.queries);
    }
    const sourceStr = deduplicateAndFormatSources(
        searchResponses,
        1000,
        false
    );

    // 4. Generate sections with a second prompt
    const planPrompt = reportPlannerInstructions
        .replace("{topic}", topic)
        .replace("{report_organization}", reportStructure)
        .replace("{context}", sourceStr)
        .replace("{feedback}", feedback);

    const sectionsRaw = await llmModel.invoke([
        new SystemMessage("You are a research report planner."),
        new HumanMessage(planPrompt)
    ]);
    // Parse sectionsRaw. 
    // In real usage, you'd parse JSON or do function calling with e.g. zod:
    // For demonstration, we'll create a small placeholder:
    const mockSections: Section[] = [
        {
            name: "Introduction",
            description: "Brief overview of the topic",
            research: false,
            content: "",
        },
        {
            name: "Main Body",
            description: "Detailed discussion and analysis",
            research: true,
            content: "",
        },
        {
            name: "Conclusion",
            description: "Summarize main points",
            research: false,
            content: "",
        },
    ];

    return {
        ...state,
        sections: mockSections,
    };
}

/**
 * Collects user feedback on the proposed report plan.
 * Returns true to proceed or a string with feedback for revision.
 */
export async function humanFeedback(
    state: ReportState
): Promise<string | boolean> {
    const sections = state.sections ?? [];
    const planString = sections
        .map(
            (sec, idx) =>
                `Section ${idx + 1}: ${sec.name}\nDescription: ${
                    sec.description
                }\nResearch needed: ${sec.research ? "Yes" : "No"}\n\n`
        )
        .join("");

    const feedbackPrompt = `Please provide feedback on the following report plan.\n\n${planString}\nDoes the plan meet your needs? Pass 'true' to approve or provide a string to regenerate.`;

    const userResponse = await getHumanFeedback(feedbackPrompt);
    return userResponse;
}

/**
 * Builds a single section of the report through iterative research and writing.
 * Uses a cycle of: query generation -> web search -> content writing -> quality check
 */
export async function buildSectionWithWebResearch(
    section: Section,
    config: ReportConfiguration
): Promise<Section> {
    let searchIterations = 0;
    const completedSection = { ...section };

    // e.g. loop up to maxSearchDepth
    while (searchIterations < config.max_search_depth) {
        // 1) generate search queries
        const queryText = queryWriterInstructions
            .replace("{section_topic}", section.description)
            .replace("{number_of_queries}", config.number_of_queries.toString());

        // (Call your LLM to produce queries, or do a placeholder.)
        const mockQueries: SearchQuery[] = [
            { search_query: `Detail about ${section.name} #1` },
            { search_query: `Detail about ${section.name} #2` },
        ];

        // 2) search the web
        let searchResponses;
        if (config.search_api === "tavily") {
            searchResponses = await tavilySearchAsync(mockQueries);
        } else {
            searchResponses = await perplexitySearch(mockQueries);
        }
        const sourceStr = deduplicateAndFormatSources(
            searchResponses,
            5000,
            true
        );

        // 3) write the section
        const writePrompt = sectionWriterInstructions
            .replace("{section_topic}", section.description)
            .replace(
                "{section_content}",
                completedSection.content || ""
            )
            .replace("{context}", sourceStr);

        // (LLM call to generate new content)
        // We'll do a placeholder:
        const newContent = `## ${section.name}\n**Key insight** This is a mock draft for ${section.name}.\n\n### Sources\n- Mock Source : http://example.com`;

        completedSection.content = newContent;

        // 4) Grade it
        const graderPrompt = sectionGraderInstructions
            .replace("{section_topic}", section.description)
            .replace("{section}", newContent);

        // LLM might return { grade: "pass" or "fail", follow_up_queries: [...] }
        const mockGrade: Feedback = {
            grade: searchIterations === 0 ? "fail" : "pass",
            follow_up_queries: [
                { search_query: `Follow-up detail #1 for ${section.name}` },
            ],
        };

        if (mockGrade.grade === "pass") {
            // done with this section
            break;
        } else {
            // use follow_up_queries for next iteration
            searchIterations++;
        }
    }

    return completedSection;
}

/**
 * Formats all completed sections into a single string for context.
 */
export async function gatherCompletedSections(
    state: ReportState
): Promise<string> {
    // Format them as a single string for context
    return formatSections(state.completed_sections ?? []);
}

/**
 * Writes sections that don't require research using context from researched sections.
 */
export async function writeFinalSection(
    section: Section,
    completedBody: string
): Promise<Section> {
    const finalPrompt = finalSectionWriterInstructions
        .replace("{section_topic}", section.description)
        .replace("{context}", completedBody);

    // LLM call here. We'll do a placeholder:
    const newContent = `## ${section.name}\nThis is the final version for ${section.name}.`;

    return { ...section, content: newContent };
}

/**
 * Combines all sections into the final report string.
 */
export function compileFinalReport(
    sections: Section[]
): string {
    return sections.map((sec) => sec.content).join("\n\n");
}

/**
 * Main entry point for the deep research process.
 * Orchestrates the entire workflow from planning to final report generation.
 */
export async function runDeepResearch(
    input: { topic: string },
    configOverrides?: Partial<ReportConfiguration>
): Promise<{ final_report: string }> {
    // load config
    const baseConfig = loadConfiguration(configOverrides as any) as any;
    const config: ReportConfiguration = {
        report_structure: baseConfig.report_structure!,
        number_of_queries: baseConfig.number_of_queries!,
        planner_model: baseConfig.planner_model!,
        search_api: baseConfig.search_api!,
        max_search_depth: baseConfig.max_search_depth!
    };

    // initial state
    let state: ReportState = {
        topic: input.topic,
        sections: [],
        completed_sections: [],
    };

    // 1) generate plan
    state = await generateReportPlan(state, config);

    // 2) get human feedback
    const userResponse = await humanFeedback(state);
    if (typeof userResponse === "string" && userResponse !== "true") {
        // user gave feedback -> re-generate plan
        state.feedback_on_report_plan = userResponse;
        state = await generateReportPlan(state, config);
    }
    // If still not good, you might prompt again, etc.

    // If user approves with boolean === true, proceed:
    // 3) Parallel or sequential building of each "research" section
    for (const sec of state.sections) {
        if (sec.research) {
            const built = await buildSectionWithWebResearch(sec, config);
            state.completed_sections.push(built);
        }
    }

    // 4) gather completed sections as context
    const compiledBody = await gatherCompletedSections(state);
    state.report_sections_from_research = compiledBody;

    // 5) write final sections
    for (const sec of state.sections) {
        if (!sec.research) {
            const finalSec = await writeFinalSection(sec, compiledBody);
            state.completed_sections.push(finalSec);
        }
    }

    // 6) compile final
    // Ensure the final order is preserved
    const finalSections = state.sections.map((sec) => {
        // find the updated version in completed_sections
        const match = state.completed_sections.find(
            (c) => c.name === sec.name
        );
        return match ?? sec;
    });
    const finalReport = compileFinalReport(finalSections);
    state.final_report = finalReport;

    return { final_report: finalReport };
}
  