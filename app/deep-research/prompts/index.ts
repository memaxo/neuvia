import { PromptTemplate } from "@langchain/core/prompts";
import { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";

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
export const RESEARCH_PLAN_PROMPT = PromptTemplate.fromTemplate<z.infer<typeof PlanInputSchema>>(`
You are a research planning expert. Create a detailed research plan for: {topic}

Break down the topic into 3-5 key sections that need investigation.
Each section should:
1. Focus on a specific aspect of the topic
2. Be clearly defined and distinct from others
3. Be suitable for web-based research

Format each section as a clear title on its own line.
Do not include numbering or bullet points.
`);

/**
 * Content generation prompt
 */
export const SECTION_CONTENT_PROMPT = PromptTemplate.fromTemplate<z.infer<typeof ContentInputSchema>>(`
You are a research content writer. Write a comprehensive section about: {title}

Use these sources as reference:
{sources}

Requirements:
1. Focus on accuracy and clarity
2. Include relevant citations using (Source URL) format
3. Organize content logically with clear structure
4. Maintain an academic, factual tone
5. Highlight key findings or insights
`);

/**
 * System messages for different roles
 */
export const SYSTEM_MESSAGES = {
  RESEARCHER: "You are an expert research assistant focused on accuracy and comprehensive analysis.",
  WRITER: "You are a skilled technical writer specializing in clear, well-structured content.",
  FACT_CHECKER: "You are a meticulous fact-checker verifying information against reliable sources."
} as const;

/**
 * Helper to create a prompt with system message
 */
export function createPromptWithSystem(
  template: string,
  systemMessage: keyof typeof SYSTEM_MESSAGES
): PromptTemplate<any, BaseMessage> {
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