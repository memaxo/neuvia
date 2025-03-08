import type { ResearchSource } from './research'

/**
 * Interface for the Perplexity API source information
 * 
 * @description
 * Contains information about a source used in a Perplexity research response.
 */
export interface PerplexitySource {
  /**
   * Title of the source
   */
  title?: string;
  
  /**
   * URL of the source
   */
  url: string;
  
  /**
   * Brief excerpt or snippet from the source
   */
  snippet?: string;
  
  /**
   * Additional properties that may be included in the source
   */
  [key: string]: unknown;
}

/**
 * Interface for the Perplexity API completion response
 * 
 * @description
 * Represents the main structure of a response from the Perplexity API.
 */
export interface PerplexityCompletion {
  /**
   * The generated text content
   */
  text: string;
  
  /**
   * Sources cited in the response
   */
  sources?: (PerplexitySource | string)[];
  
  /**
   * Additional properties that may be included in the response
   */
  [key: string]: unknown;
}

/**
 * Interface for the parsed output after processing the raw response
 * 
 * @description
 * Represents the structured output after parsing the raw Perplexity response.
 */
export interface ParsedResearchOutput {
  /**
   * The full research text
   */
  text: string;
  
  /**
   * Sources used in the research
   */
  sources: ResearchSource[];
  
  /**
   * Concise summary of the research findings
   */
  summary: string;
  
  /**
   * Key findings or takeaways from the research
   */
  keyFindings: string[];
}