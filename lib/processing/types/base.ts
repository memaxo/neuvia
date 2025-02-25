/**
 * Base types for document processing across the application
 */

/**
 * Status of a processing operation
 */
export interface ProcessingStatus {
  /**
   * Current status of the processing operation
   */
  status: 'idle' | 'processing' | 'success' | 'error' | 'completed';
  
  /**
   * Progress indicator (0-100)
   */
  progress: number;
  
  /**
   * Optional description of the current step
   */
  currentStep?: string;
  
  /**
   * Error message if status is 'error'
   */
  error?: string;
  
  /**
   * Phase of the process (for multi-phase operations)
   */
  phase?: 'extraction' | 'verification' | 'research' | 'generation' | 'formatting';
}

/**
 * Base document type information
 */
export interface DocumentType {
  /**
   * Category of document (e.g., 'clinical', 'administrative')
   */
  category: string;
  
  /**
   * Type of document (e.g., 'report', 'note', 'form')
   */
  type: string;
  
  /**
   * Optional subtype for more specific categorization
   */
  subtype?: string;
  
  /**
   * Additional metadata for the document
   */
  metadata?: Record<string, unknown>;
}

/**
 * Base document interface
 */
export interface DocumentBase {
  /**
   * Unique identifier for the document
   */
  id: string;
  
  /**
   * When the document was created
   */
  createdAt: Date;
  
  /**
   * Document type information
   */
  documentType: DocumentType;
  
  /**
   * Patient ID associated with the document (if applicable)
   */
  patientId?: string;
} 