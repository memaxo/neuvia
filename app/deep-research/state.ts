/**
 * Type definitions and schemas for the deep research system's state management.
 * Includes interfaces for sections, queries, feedback, and overall report state.
 */

import { z } from "zod";

/**
 * Core research state schema with section tracking
 */
export const ResearchStateSchema = z.object({
  topic: z.string().min(1, "Topic is required").max(500, "Topic is too long"),
  depth: z.number().min(1).max(3).default(2),
  sections: z.array(z.object({
    title: z.string(),
    content: z.string().optional(),
    sources: z.array(z.string()).optional(),
    status: z.enum(["pending", "researching", "writing", "complete"])
  }))
});

export type ResearchState = z.infer<typeof ResearchStateSchema>;

/**
 * Search result interface for consistent data structure
 */
export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

/**
 * Progress tracking interface
 */
export interface ProgressUpdate {
  sectionId: string;
  status: z.infer<typeof ResearchStateSchema>["sections"][number]["status"];
  percent: number;
}

/**
 * Research chain output interface
 */
export interface ResearchOutput {
  state: ResearchState;
  progress: ProgressUpdate[];
  error?: string;
}

/**
 * Defines a single section of the report with its metadata and content.
 */
export const SectionSchema = z.object({
  name: z.string().describe("Name for this section of the report."),
  description: z.string().describe("Brief overview of the main topics covered in this section."),
  research: z.boolean().describe("Whether to perform web research for this section of the report."),
  content: z.string().describe("The content of the section."),
});
export type Section = z.infer<typeof SectionSchema>;

/**
 * Collection of report sections.
 */
export const SectionsSchema = z.object({
  sections: z.array(SectionSchema).describe("Sections of the report."),
});
export type Sections = z.infer<typeof SectionsSchema>;

/**
 * Web search query structure.
 */
export const SearchQuerySchema = z.object({
  search_query: z.string().describe("Query for web search."),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

/**
 * Collection of search queries.
 */
export const QueriesSchema = z.object({
  queries: z.array(SearchQuerySchema).describe("List of search queries."),
});
export type Queries = z.infer<typeof QueriesSchema>;

/**
 * Feedback on section quality and suggestions for improvement.
 */
export const FeedbackSchema = z.object({
  grade: z.enum(["pass", "fail"]).describe(
    "Evaluation result indicating whether the response meets requirements ('pass') or needs revision ('fail')."
  ),
  follow_up_queries: z.array(SearchQuerySchema).describe(
    "List of follow-up search queries."
  ),
});
export type Feedback = z.infer<typeof FeedbackSchema>;

/**
 * Initial input state for report generation.
 */
export interface ReportStateInput {
  topic: string;
}

/**
 * Final output state after report generation.
 */
export interface ReportStateOutput {
  final_report: string;
}

/**
 * Complete state for the report generation process.
 */
export interface ReportState {
  topic: string;
  feedback_on_report_plan?: string;
  sections: Section[];
  completed_sections: Section[];
  report_sections_from_research?: string;
  final_report?: string;
}

/**
 * State for a section during its research and writing phase.
 */
export interface SectionState {
  section: Section;
  search_iterations: number;
  search_queries: SearchQuery[];
  source_str: string;
  report_sections_from_research?: string;
  completed_sections: Section[];
}

/**
 * Output state after a section is completed.
 */
export interface SectionOutputState {
  completed_sections: Section[];
}
