import type { DocumentBase } from './base';
import type { VerifiedDocument } from './verification';

/**
 * Represents a source used in research
 */
export interface ResearchSource {
  /**
   * Title of the source
   */
  title: string;
  
  /**
   * URL of the source
   */
  url: string;
  
  /**
   * Brief description of the source
   */
  description: string;
  
  /**
   * Optional content excerpt from the source
   */
  content?: string;
  
  /**
   * Relevance score (0-1) indicating how relevant this source is to the query
   */
  relevance: number;
  
  /**
   * Optional citation index for referencing
   */
  citationIndex?: number;
  
  /**
   * Type of source (e.g., 'journal', 'book', 'website')
   */
  sourceType?: string;
  
  /**
   * Publication date of the source (if applicable)
   */
  publishedDate?: Date;
  
  /**
   * Authors of the source (if applicable)
   */
  authors?: string[];
}

/**
 * Represents a research result
 */
export interface ResearchResult {
  /**
   * The query that generated this research
   */
  query: string;
  
  /**
   * Sources used in the research
   */
  sources: ResearchSource[];
  
  /**
   * Summary of the research findings
   */
  summary: string;
  
  /**
   * When the research was performed
   */
  timestamp: Date;
  
  /**
   * Optional confidence score for the research (0-1)
   */
  confidence?: number;
  
  /**
   * Optional key findings as bullet points
   */
  keyFindings?: string[];
  
  /**
   * Optional analysis of contradictions or conflicting information
   */
  contradictions?: string[];
}

/**
 * Options for deep research
 */
export interface ResearchOptions {
  /**
   * Depth of research to perform
   */
  depth?: 'basic' | 'standard' | 'comprehensive';
  
  /**
   * Patient ID for contextual research
   */
  patientId?: string;
  
  /**
   * Maximum number of sources to include
   */
  sourcesLimit?: number;
  
  /**
   * Whether to include source content in results
   */
  includeSourceContent?: boolean;
  
  /**
   * Progress callback
   */
  onProgress?: (progress: number) => void;
}

/**
 * A document that has gone through research
 */
export interface ResearchDocument extends DocumentBase {
  /**
   * The verified document that research is based on
   */
  verifiedDocument: VerifiedDocument;
  
  /**
   * Research results
   */
  researchResults: ResearchResult[];
  
  /**
   * Research queries performed
   */
  queries: string[];
} 