import { PromptTemplate } from "@langchain/core/prompts";
import { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";
import {
  SearchQuerySchema,
  ReportPlanSchema,
  SectionContentSchema,
  SectionGradeSchema,
  FinalSectionSchema
} from "./schemas";

/**
 * Input schemas for prompt templates
 */
export const PlanInputSchema = z.object({
  topic: z.string().min(1, "Topic is required")
});

export const ContentInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  sources: z.string().min(1, "Sources are required")
});

/**
 * Research plan generation prompt
 */
export const RESEARCH_PLAN_PROMPT = PromptTemplate.fromTemplate<z.infer<typeof ReportPlanSchema>>(`
You are a research planning expert. Create a detailed research plan for: {topic}

Report Organization: {report_organization}
Feedback (if any): {feedback}

Your output must be a valid JSON object with the following structure:
{
  "topic": "the research topic",
  "sections": [
    {
      "name": "section name",
      "description": "section description",
      "research": true/false,
      "keyPoints": ["key point 1", "key point 2"],
      "estimatedLength": number of words
    }
  ],
  "searchQueries": [
    {
      "query": "search query text",
      "intent": "purpose of this query",
      "expectedResults": ["type of result 1", "type of result 2"]
    }
  ],
  "estimatedResearchTime": number in minutes,
  "suggestedApproach": "brief description of research approach"
}
`);

Requirements:
1. Each section should focus on a specific aspect of the topic
2. Include 3-5 sections total
3. Mark sections that need web research as "research": true
4. Generate 2-3 targeted search queries per research section
5. Ensure queries are specific and technical
`);

/**
 * Content generation prompt
 */
export const SECTION_CONTENT_PROMPT = PromptTemplate.fromTemplate<z.infer<typeof SectionContentSchema>>(`
You are a research content writer. Write a comprehensive section about: {title}

Use these sources as reference:
{sources}

Your output must be a valid JSON object with the following structure:
{
  "title": "section title",
  "content": "main content text (150-200 words)",
  "keyFindings": ["key finding 1", "key finding 2"],
  "citations": [
    {
      "text": "quoted or paraphrased text",
      "url": "source URL",
      "relevance": 0.0 to 1.0
    }
  ],
  "structuralElement": {
    "type": "table" | "list" | "none",
    // For table:
    "headers": ["header1", "header2"],
    "rows": [["cell1", "cell2"]],
    // For list:
    "items": ["item1", "item2"]
  }
}

Requirements:
1. Content must be 150-200 words
2. Include at least one key finding
3. Properly cite all sources
4. Use at most one structural element (table or list)
5. Maintain academic tone
`);

/**
 * Section grading prompt
 */
export const SECTION_GRADER_PROMPT = PromptTemplate.fromTemplate<z.infer<typeof SectionGradeSchema>>(`
Review this section relative to the topic: {section_topic}

Section content:
{section}

Your output must be a valid JSON object with the following structure:
{
  "grade": "pass" or "fail",
  "score": 0-100,
  "feedback": [
    {
      "aspect": "what is being evaluated",
      "comment": "evaluation comment",
      "suggestion": "improvement suggestion if needed"
    }
  ],
  "followUpQueries": [
    {
      "query": "follow-up search query if needed",
      "intent": "purpose of query",
      "expectedResults": ["expected result types"]
    }
  ]
}

Requirements:
1. Evaluate technical accuracy and depth
2. Check citation quality and relevance
3. Assess content structure and clarity
4. Provide specific feedback for each aspect
5. Include follow-up queries if grade is "fail"
`);

/**
 * Final section writing prompt
 */
export const FINAL_SECTION_PROMPT = PromptTemplate.fromTemplate<z.infer<typeof FinalSectionSchema>>(`
Write a {type} section using this report content as context:
{context}

Your output must be a valid JSON object with the following structure:
{
  "type": "introduction" or "conclusion",
  "title": "section title",
  "content": "section content (50-150 words)",
  "structuralElement": {
    "type": "table" or "none",
    // For table:
    "headers": ["header1", "header2"],
    "rows": [["cell1", "cell2"]]
  },
  "keyTakeaways": ["key point 1", "key point 2"]
}

Requirements for introduction:
1. 50-100 words
2. No structural elements
3. Focus on core motivation
4. Clear narrative arc

Requirements for conclusion:
1. 100-150 words
2. Include comparison table for comparative reports
3. End with specific next steps
4. Distill main insights
`);

/**
 * System messages for different roles
 */
export const SYSTEM_MESSAGES = {
  RESEARCHER: "You are an expert research assistant. Output must be valid JSON matching the specified schema.",
  WRITER: "You are a skilled technical writer. Output must be valid JSON matching the specified schema.",
  FACT_CHECKER: "You are a meticulous fact-checker. Output must be valid JSON matching the specified schema."
} as const;

/**
 * Helper to create a prompt with system message
 */
export function createPromptWithSystem(
  template: string,
  systemMessage: keyof typeof SYSTEM_MESSAGES
): PromptTemplate {
  return PromptTemplate.fromTemplate(`
System: ${SYSTEM_MESSAGES[systemMessage]}

${template}
  `);
}

/**
 * Validation schemas for prompt outputs
 */
export const SectionSchema = z.object({
  title: z.string(),
  content: z.string(),
  keyFindings: z.array(z.string()),
  citations: z.array(z.object({
    text: z.string(),
    url: z.string().url()
  }))
});

export type SectionOutput = z.infer<typeof SectionSchema>;

/**
 * Type for model responses
 */
export interface ModelResponse {
  content: string;
  [key: string]: unknown;
} 