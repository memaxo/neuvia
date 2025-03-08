import type { DocumentType, VerificationItem } from '@/lib/types'
import { VerificationStatus } from '@/lib/types'

/**
 * UUID type alias
 */
export type UUID = string;

/**
 * Represents the extraction of essential information from a medical document
 */
export type DocumentExtraction = {
  /**
   * Unique identifier of the document
   */
  documentId: UUID;
  
  /**
   * Type information for the document
   */
  documentType: DocumentType;
  
  /**
   * Date of the document (ISO string format)
   */
  documentDate: string;
  
  /**
   * Sections of extracted information organized by category
   */
  sections: Record<string, ExtractedSection>;
  
  /**
   * Metadata about the extraction process
   */
  metadata: {
    /**
     * Confidence score of the extraction (0-1)
     */
    extractionConfidence: number;
    
    /**
     * When the extraction was performed
     */
    extractionDate: string;
  };
}

/**
 * Represents a section of extracted information from a document
 */
export type ExtractedSection = {
  /**
   * Array of extracted items with importance and confidence ratings
   */
  items: Array<{
    /**
     * The extracted text content
     */
    text: string;
    
    /**
     * Importance rating (1-10)
     */
    importance: number;
    
    /**
     * Confidence rating (0-1)
     */
    confidence: number;
    
    /**
     * Temporal context (past, present, future)
     */
    temporalMarker: string;
  }>;
}

/**
 * Represents a section within a patient summary
 */
export type PatientSummarySection = {
  /**
   * Title of the section
   */
  title: string;
  
  /**
   * Content of the section
   */
  content: string;
  
  /**
   * Source references for the information
   */
  sources: string[];
}

/**
 * Comprehensive summary of a patient's medical information
 */
export type PatientSummary = {
  /**
   * Basic patient demographics and identification
   */
  patientInfo: PatientSummarySection;
  
  /**
   * Historical medical conditions and treatments
   */
  medicalHistory: PatientSummarySection;
  
  /**
   * Active medical conditions
   */
  currentConditions: PatientSummarySection;
  
  /**
   * Current and recent medications
   */
  medications: PatientSummarySection;
  
  /**
   * New observations and findings
   */
  recentFindings: PatientSummarySection;
  
  /**
   * Current treatment and care plans
   */
  treatmentPlans: PatientSummarySection;
  
  /**
   * Laboratory test results
   */
  labResults: PatientSummarySection;
  
  /**
   * Imaging study results
   */
  imagingResults: PatientSummarySection;
  
  /**
   * Medical recommendations and next steps
   */
  recommendations: PatientSummarySection;
  
  /**
   * Metadata about the summary
   */
  metadata: {
    /**
     * When the summary was generated
     */
    generatedAt: string;
    
    /**
     * Number of documents used to create the summary
     */
    documentCount: number;
    
    /**
     * Source documents used in creating the summary
     */
    documents: Array<{
      /**
       * Document identifier
       */
      id: string;
      
      /**
       * Document type information
       */
      type: DocumentType;
      
      /**
       * Document title or name
       */
      title: string;
      
      /**
       * Document date
       */
      date: string;
    }>;
    
    /**
     * Optional verification status information
     */
    verificationInfo?: {
      /**
       * When the summary was verified
       */
      verifiedAt?: string;
      
      /**
       * Who verified the summary
       */
      verifiedBy?: string;
      
      /**
       * Status of verification
       */
      status?: string;
    };
  };
}

/**
 * Extension of PatientSummary that includes verification data
 */
export type VerifiedPatientSummary = PatientSummary & {
  /**
   * Items that have been verified
   */
  verificationItems: VerificationItem[];
  
  /**
   * Verification status details
   */
  verificationStatus: {
    /**
     * Whether the summary is verified
     */
    isVerified: boolean;
    
    /**
     * When the summary was verified
     */
    verifiedAt?: string;
    
    /**
     * Who verified the summary
     */
    verifiedBy?: string;
    
    /**
     * Any correction notes or comments
     */
    corrections?: {
      /**
       * Comments about corrections
       */
      comments?: string;
    };
  };
  
  /**
   * Additional verification metadata
   */
  verificationMetadata: {
    /**
     * When the verification was completed
     */
    verifiedAt: string;
    
    /**
     * Who performed the verification
     */
    verifiedBy: string;
  };
}

/**
 * Interface for a patient document record
 */
export interface PatientDocument {
  /**
   * Unique identifier of the document
   */
  id: string;
  
  /**
   * Text content of the document
   */
  content_text?: string;
  
  /**
   * Type of document
   */
  document_type?: DocumentType | Record<string, string>;
  
  /**
   * Date of the document
   */
  document_date?: string;
}