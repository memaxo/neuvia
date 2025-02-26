import type { DocumentBase } from './base';
import type { VerifiedDocument } from './verification';

/**
 * Represents a source used in research
 */
export interface ResearchSource {
  /**
   * Title of the source
   */
  title?: string;
  
  /**
   * URL of the source
   */
  url: string;
  
  /**
   * Brief description of the source
   */
  description?: string;
  
  /**
   * Optional content excerpt from the source
   */
  content?: string;
  
  /**
   * Relevance score (0-1) indicating how relevant this source is to the query
   */
  relevance?: number;
  
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
  
  /**
   * Source snippet from API
   */
  snippet?: string;
  
  /**
   * Source index in numbered references
   */
  index?: number;
}

/**
 * Represents a research result
 */
export interface ResearchResult {
  /**
   * Generated research text
   */
  text: string;
  
  /**
   * Research summary (processed text)
   */
  summary?: string;
  
  /**
   * Sources used in the research
   */
  sources: ResearchSource[];
  
  /**
   * Extracted key findings
   */
  keyFindings?: string[];
  
  /**
   * Timestamp of the research
   */
  timestamp?: Date;
  
  /**
   * Confidence score
   */
  confidence?: number;
}

/**
 * Options for deep research
 */
export interface ResearchOptions {
  /**
   * Research depth
   */
  depth?: 'basic' | 'standard' | 'comprehensive';
  
  /**
   * Maximum number of sources to include
   */
  sourcesLimit?: number;
  
  /**
   * Whether to include source content
   */
  includeSourceContent?: boolean;
  
  /**
   * Research type (standard or medical diagnosis)
   */
  researchType?: 'standard' | 'medical-diagnosis';
  
  /**
   * Context data for specialized research
   */
  contextData?: Record<string, any>;
  
  /**
   * Progress callback
   */
  onProgress?: (progress: number) => void;
  
  /**
   * Whether this is a medical diagnosis query
   */
  isMedicalDiagnosis?: boolean;
  
  /**
   * Patient data for medical diagnosis
   */
  patientData?: string;
  
  /**
   * Temperature for generation
   */
  temperature?: number;
  
  /**
   * Maximum number of tokens in the response
   */
  maxTokens?: number;
  
  /**
   * Whether to include images in the response
   */
  includeImages?: boolean;
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