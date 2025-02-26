/**
 * Central export file for all processing types
 */

// Base types
export * from './base';

// Extraction types
export * from './extraction';

// Verification types
export * from './verification';

// Research types
export * from './research';

// Report types
export * from './report';

/**
 * Shared types for document processing and workflows
 */

/**
 * Document type categorization
 */
export interface DocumentType {
  /**
   * Document category (e.g., clinical, lab, imaging)
   */
  category: string;
  
  /**
   * Document type within category
   */
  type: string;
  
  /**
   * Optional document subtype
   */
  subtype?: string;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Processing status for tracking document processing
 */
export interface ProcessingStatus {
  /**
   * Current status
   */
  status: 'pending' | 'processing' | 'success' | 'error';
  
  /**
   * Progress percentage (0-100)
   */
  progress: number;
  
  /**
   * Current processing step description
   */
  currentStep?: string;
  
  /**
   * Processing phase
   */
  phase?: 'initialization' | 'extraction' | 'analysis' | 'verification' | 'reporting';
  
  /**
   * Error message if status is 'error'
   */
  error?: string;
}

/**
 * Document chunk representing a section of a document
 */
export interface DocumentChunk {
  /**
   * Chunk content text
   */
  content: string;
  
  /**
   * Page number (1-indexed)
   */
  pageNumber: number;
  
  /**
   * Optional chunk metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Extracted data from a document
 */
export interface ExtractedData {
  /**
   * Raw document text
   */
  rawText: string;
  
  /**
   * Document metadata
   */
  metadata: Record<string, any>;
  
  /**
   * Document chunks for processing
   */
  chunks?: DocumentChunk[];
}

/**
 * Extracted document with metadata
 */
export interface ExtractedDocument {
  /**
   * Document ID
   */
  id: string;
  
  /**
   * Document creation timestamp
   */
  createdAt: Date;
  
  /**
   * Document type
   */
  documentType: DocumentType;
  
  /**
   * Patient ID (if applicable)
   */
  patientId?: string;
  
  /**
   * Extracted data
   */
  extractedData: ExtractedData;
  
  /**
   * Whether extraction was successful
   */
  isSuccessful: boolean;
  
  /**
   * Error message if extraction failed
   */
  errorMessage?: string;
}

/**
 * Workflow steps for document processing
 */
export type WorkflowStep = 
  | 'idle'
  | 'extraction'
  | 'verification'
  | 'research'
  | 'report_generation'
  | 'complete'
  | 'error';

/**
 * Workflow state for tracking document processing
 */
export interface WorkflowState {
  /**
   * Progress percentage (0-100)
   */
  progress: number;
  
  /**
   * Start timestamp
   */
  startedAt: Date;
  
  /**
   * Current step description
   */
  currentStep?: string;
  
  /**
   * Document type
   */
  documentType?: DocumentType;
  
  /**
   * Extracted document data
   */
  extractedDocument?: ExtractedDocument;
  
  /**
   * Error message
   */
  error?: string;
}

/**
 * Chat workflow step
 */
export type ChatWorkflowStep = 
  | 'idle'
  | 'uploading'
  | 'extracting' 
  | 'verification'
  | 'report_generation'
  | 'report_presentation'
  | 'complete'; 