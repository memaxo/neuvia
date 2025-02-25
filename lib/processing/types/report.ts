import type { DocumentBase } from './base';
import type { ResearchDocument, ResearchSource } from './research';

/**
 * Report data format
 */
export type ReportFormat = 'markdown' | 'html' | 'pdf';

/**
 * Report sections
 */
export interface ReportSections {
  /**
   * Findings section of the report
   */
  findings?: string;
  
  /**
   * Diagnoses section
   */
  diagnoses?: string;
  
  /**
   * Recommendations section
   */
  recommendations?: string;
  
  /**
   * References section
   */
  references?: string;
  
  /**
   * Background section
   */
  background?: string;
  
  /**
   * Summary section
   */
  summary?: string;
  
  /**
   * Additional sections
   */
  [key: string]: string | undefined;
}

/**
 * Metadata for a generated report
 */
export interface ReportMetadata {
  /**
   * Model used for generation
   */
  modelName: string;
  
  /**
   * Confidence score of the generation (0-1)
   */
  confidence: number;
  
  /**
   * Time taken to generate the report (in seconds)
   */
  generationTime: number;
  
  /**
   * Version of the report generator
   */
  version?: string;
  
  /**
   * Flags for any issues or concerns
   */
  flags?: string[];
}

/**
 * Data for a generated report
 */
export interface ReportData {
  /**
   * Full content of the report
   */
  content: string;
  
  /**
   * Sources used in the report
   */
  sources: ResearchSource[];
  
  /**
   * Patient ID the report is for
   */
  patientId: string;
  
  /**
   * When the report was generated
   */
  generatedAt: Date;
  
  /**
   * Metadata about the report generation
   */
  metadata: ReportMetadata;
  
  /**
   * Structured sections of the report
   */
  sections?: ReportSections;
}

/**
 * Options for report generation
 */
export interface ReportOptions {
  /**
   * Whether to include source content in the report
   */
  includeSourceContent?: boolean;
  
  /**
   * Format of the report
   */
  format?: ReportFormat;
  
  /**
   * Depth of the report
   */
  depth?: 'basic' | 'standard' | 'comprehensive';
  
  /**
   * Progress callback
   */
  onProgress?: (phase: 'research' | 'generation' | 'formatting', percent: number) => void;
}

/**
 * A document with generated report
 */
export interface ReportDocument extends DocumentBase {
  /**
   * The research document that the report is based on
   */
  researchDocument: ResearchDocument;
  
  /**
   * The generated report data
   */
  reportData: ReportData;
  
  /**
   * The format of the report
   */
  format: ReportFormat;
} 