/**
 * Patient Summary Types
 * 
 * Type definitions for patient summary functionality.
 */
import type { DocumentType } from './base';
import type { PatientDocument } from './document';
import type { VerificationItem, VerificationStatus } from './verification';

/**
 * Represents a section of a patient summary
 */
export interface PatientSummarySection {
  /**
   * Section title
   */
  title: string;
  
  /**
   * Section content in markdown format
   */
  content: string;
  
  /**
   * Source documents used to generate this section
   */
  sources: Array<{
    /**
     * Document ID
     */
    documentId: string;
    
    /**
     * Type of document
     */
    documentType: DocumentType;
    
    /**
     * Confidence score (0-1)
     */
    confidence: number;
  }>;
}

/**
 * Document extraction result for individual document analysis
 */
export interface DocumentExtraction {
  /**
   * Source document ID
   */
  documentId: string;
  
  /**
   * Type of document
   */
  documentType: DocumentType;
  
  /**
   * Date of the document
   */
  documentDate: string;
  
  /**
   * Extracted sections by medical category
   */
  sections: {
    demographics?: ExtractedSection;
    diagnoses?: ExtractedSection;
    medications?: ExtractedSection;
    labValues?: ExtractedSection;
    procedures?: ExtractedSection;
    plans?: ExtractedSection;
    allergies?: ExtractedSection;
    vitalSigns?: ExtractedSection;
    socialHistory?: ExtractedSection;
    familyHistory?: ExtractedSection;
    physicalExam?: ExtractedSection;
    [key: string]: ExtractedSection | undefined;
  };
  
  /**
   * Extraction metadata
   */
  metadata: {
    /**
     * Overall confidence score (0-1)
     */
    extractionConfidence: number;
    
    /**
     * When extraction was performed
     */
    extractionDate: string;
  };
}

/**
 * Section of extracted medical information
 */
export interface ExtractedSection {
  /**
   * Individual data items in this section
   */
  items: Array<{
    /**
     * Extracted text content
     */
    text: string;
    
    /**
     * Importance score (1-10)
     */
    importance: number;
    
    /**
     * Confidence score (0-1)
     */
    confidence: number;
    
    /**
     * Temporal marker (current, past, future)
     */
    temporalMarker?: string;
    
    /**
     * Original source context
     */
    context?: string;
  }>;
}

/**
 * Complete patient summary structure
 */
export interface PatientSummary {
  /**
   * Basic patient information section
   */
  patientInfo: PatientSummarySection;
  
  /**
   * Medical history section
   */
  medicalHistory: PatientSummarySection;
  
  /**
   * Current medical conditions section
   */
  currentConditions: PatientSummarySection;
  
  /**
   * Medications section
   */
  medications: PatientSummarySection;
  
  /**
   * Recent findings section
   */
  recentFindings: PatientSummarySection;
  
  /**
   * Treatment plans section
   */
  treatmentPlans: PatientSummarySection;
  
  /**
   * Laboratory results section
   */
  labResults: PatientSummarySection;
  
  /**
   * Imaging results section
   */
  imagingResults: PatientSummarySection;
  
  /**
   * Recommendations section
   */
  recommendations: PatientSummarySection;
  
  /**
   * Summary metadata
   */
  metadata: {
    /**
     * When the summary was generated
     */
    generatedAt: string;
    
    /**
     * Number of documents analyzed
     */
    documentCount: number;
    
    /**
     * List of analyzed documents
     */
    documents: Array<{
      /**
       * Document ID
       */
      id: string;
      
      /**
       * Type of document
       */
      type: DocumentType;
      
      /**
       * Document title
       */
      title: string;
      
      /**
       * Document date
       */
      date: string;
    }>;
    
    /**
     * Verification metadata (if the summary has been verified)
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
       * Verification status (verified/rejected)
       */
      status?: string;
      
      /**
       * Optional verification comments
       */
      comments?: string;
    };
  };
} 

/**
 * Interface for combined summary with verification data
 * Used when integrating the patient summary service with verification flows
 */
export interface VerifiedPatientSummary extends PatientSummary {
  /**
   * Verification items for this summary
   */
  verificationItems?: VerificationItem[];
  
  /**
   * Verification status details
   */
  verificationStatus?: VerificationStatus;
  
  /**
   * Original verified data structure from verification service
   */
  verifiedData?: Record<string, any>;
  
  /**
   * Verification metadata
   */
  verificationMetadata?: {
    /**
     * When the summary was verified
     */
    verifiedAt?: string;
    
    /**
     * Who verified the summary
     */
    verifiedBy?: string;
    
    /**
     * Workflow ID if verified as part of a workflow
     */
    workflowId?: string;
  };
}