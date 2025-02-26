import type { DocumentBase } from './base';
import type { ResearchDocument, ResearchSource, ResearchResult } from './research';

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
  
  /**
   * Verification metadata if report is based on verified data
   */
  verification?: {
    /**
     * When the document was verified
     */
    verifiedAt: Date;
    
    /**
     * User who verified the document
     */
    verifiedBy?: string;
    
    /**
     * Average confidence score of verification items (0-1)
     */
    verificationConfidence: number;
    
    /**
     * Number of verified items
     */
    verifiedItemCount: number;
    
    /**
     * Number of corrections made during verification
     */
    correctionCount: number;
  };
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
  
  /**
   * Verified data that was used to generate the report
   */
  verifiedData?: Record<string, any>;
}

/**
 * Report generation parameters
 */
export interface ReportGenerationParams {
  /**
   * Report type (e.g., 'medical-diagnosis', 'research', 'standard')
   */
  type: string;
  
  /**
   * Patient ID (if applicable)
   */
  patientId: string;
  
  /**
   * Research query (if not providing pre-researched data)
   */
  researchQuery?: string;
  
  /**
   * Pre-researched data (if available)
   */
  researchData?: ResearchResult;
  
  /**
   * Depth of research
   */
  researchDepth?: 'basic' | 'standard' | 'comprehensive';
  
  /**
   * Maximum number of sources to include
   */
  sourcesLimit?: number;
  
  /**
   * Whether to include source content in results
   */
  includeSourceContent?: boolean;
  
  /**
   * Whether to save the report to the database
   */
  saveToDatabase?: boolean;
  
  /**
   * Additional context data for the report
   */
  contextData?: Record<string, any>;
}

/**
 * Report generation options
 */
export interface ReportOptions {
  /**
   * Patient ID (if applicable)
   */
  patientId?: string;
  
  /**
   * Progress callback for report generation
   * @param phase Current generation phase
   * @param progress Progress percentage (0-100)
   */
  onProgress?: (phase: 'initialization' | 'research' | 'generation' | 'complete', progress: number) => void;
  
  /**
   * Success callback
   * @param reportData Generated report data
   */
  onSuccess?: (reportData: ReportData) => void;
  
  /**
   * Error callback
   * @param error Error message
   */
  onError?: (error: string) => void;
  
  /**
   * Whether to save the report to the database
   */
  saveToDatabase?: boolean;
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