import { DocumentCategory } from '@/lib/types/document'
import type { DocumentType } from '@/lib/types/document'
import type {
  DocumentExtraction,
  ExtractedSection,
  PatientSummary,
  PatientSummarySection,
  VerifiedPatientSummary
} from '@/lib/types/patient'

/**
 * TypeValidator provides type guards and validation utilities for patient-related data structures
 *
 * Centralizes all type validation to ensure consistent checking across the service.
 */
export class TypeValidator {
  /**
   * Type guard to validate a document type
   * @param value The value to check
   * @returns True if value is a valid DocumentType
   */
  static isValidDocumentType(value: unknown): value is DocumentType {
    if (!value || typeof value !== 'object') return false;
    
    const obj = value as Record<string, unknown>;
    
    // Check if category is a string and is a valid DocumentCategory
    const isValidCategory = typeof obj.category === 'string' &&
      Object.values(DocumentCategory).includes(obj.category as DocumentCategory);
    
    return (
      isValidCategory &&
      typeof obj.type === 'string'
    );
  }
  
  /**
   * Type guard to validate document extraction
   * @param value The value to check
   * @returns True if value is a valid DocumentExtraction
   */
  static isValidDocumentExtraction(value: unknown): value is DocumentExtraction {
    if (!value || typeof value !== 'object') return false;
    
    const obj = value as Record<string, unknown>;
    
    // Check required fields
    const hasValidDocumentId = typeof obj.documentId === 'string';
    const hasValidDocumentType = this.isValidDocumentType(obj.documentType);
    const hasValidDocumentDate = typeof obj.documentDate === 'string';
    
    // Check sections
    const hasValidSections = typeof obj.sections === 'object' && obj.sections !== null;
    
    // Check metadata
    const hasValidMetadata = typeof obj.metadata === 'object' && obj.metadata !== null;
    
    if (hasValidMetadata) {
      const metadata = obj.metadata as Record<string, unknown>;
      
      // Check metadata fields
      const hasValidConfidence = typeof metadata.extractionConfidence === 'number' &&
        metadata.extractionConfidence >= 0 &&
        metadata.extractionConfidence <= 1;
        
      const hasValidDate = typeof metadata.extractionDate === 'string';
      
      if (!hasValidConfidence || !hasValidDate) {
        return false;
      }
    }
    
    return (
      hasValidDocumentId &&
      hasValidDocumentType &&
      hasValidDocumentDate &&
      hasValidSections &&
      hasValidMetadata
    );
  }

  /**
   * Type guard to validate a patient summary section
   * @param value The value to check
   * @returns True if value is a valid PatientSummarySection
   */
  static isValidSummarySection(value: unknown): value is PatientSummarySection {
    if (!value || typeof value !== 'object') return false;
    
    const obj = value as Record<string, unknown>;
    
    return (
      typeof obj.title === 'string' &&
      typeof obj.content === 'string' &&
      Array.isArray(obj.sources)
    );
  }

  /**
   * Type guard to validate a patient summary
   * @param value The value to check
   * @returns True if value is a valid PatientSummary
   */
  static isValidPatientSummary(value: unknown): value is PatientSummary {
    if (!value || typeof value !== 'object') return false;
    
    const obj = value as Record<string, unknown>;
    
    // Check section fields
    const hasValidSections =
      this.isValidSummarySection(obj.patientInfo) &&
      this.isValidSummarySection(obj.medicalHistory) &&
      this.isValidSummarySection(obj.currentConditions) &&
      this.isValidSummarySection(obj.medications) &&
      this.isValidSummarySection(obj.recentFindings) &&
      this.isValidSummarySection(obj.treatmentPlans) &&
      this.isValidSummarySection(obj.labResults) &&
      this.isValidSummarySection(obj.imagingResults) &&
      this.isValidSummarySection(obj.recommendations);
    
    // Check metadata
    const hasValidMetadata = typeof obj.metadata === 'object' && obj.metadata !== null;
    
    if (!hasValidMetadata) return false;
    
    const metadata = obj.metadata as Record<string, unknown>;
    
    const hasValidGenerated = typeof metadata.generatedAt === 'string';
    const hasValidDocCount = typeof metadata.documentCount === 'number';
    const hasValidDocs = Array.isArray(metadata.documents);
    
    return hasValidSections && hasValidGenerated && hasValidDocCount && hasValidDocs;
  }
  
  /**
   * Get validation errors for document extraction
   * @param value The value to check
   * @returns Object with validation errors
   */
  static getExtractionValidationErrors(value: unknown): Record<string, string> {
    const errors: Record<string, string> = {};
    
    if (!value || typeof value !== 'object') {
      return { value: 'Extraction must be an object' };
    }
    
    const obj = value as Record<string, unknown>;
    
    // Check required fields
    if (typeof obj.documentId !== 'string') {
      errors.documentId = 'Document ID must be a string';
    }
    
    if (!this.isValidDocumentType(obj.documentType)) {
      errors.documentType = 'Document type must be a valid object with category and type';
    }
    
    if (typeof obj.documentDate !== 'string') {
      errors.documentDate = 'Document date must be a string';
    }
    
    if (typeof obj.sections !== 'object' || obj.sections === null) {
      errors.sections = 'Sections must be an object';
    }
    
    if (typeof obj.metadata !== 'object' || obj.metadata === null) {
      errors.metadata = 'Metadata must be an object';
    } else {
      const metadata = obj.metadata as Record<string, unknown>;
      
      if (typeof metadata.extractionConfidence !== 'number' ||
          metadata.extractionConfidence < 0 ||
          metadata.extractionConfidence > 1) {
        errors['metadata.extractionConfidence'] = 'Extraction confidence must be a number between 0 and 1';
      }
      
      if (typeof metadata.extractionDate !== 'string') {
        errors['metadata.extractionDate'] = 'Extraction date must be a string';
      }
    }
    
    return errors;
  }

  /**
   * Get validation errors for a patient summary
   * @param value The value to check
   * @returns Object with validation errors
   */
  static getPatientSummaryValidationErrors(value: unknown): Record<string, string> {
    const errors: Record<string, string> = {};
    
    if (!value || typeof value !== 'object') {
      return { value: 'Patient summary must be an object' };
    }
    
    const obj = value as Record<string, unknown>;
    
    // Check section fields
    const sections = [
      'patientInfo', 'medicalHistory', 'currentConditions', 'medications',
      'recentFindings', 'treatmentPlans', 'labResults', 'imagingResults', 'recommendations'
    ];
    
    sections.forEach(section => {
      if (!this.isValidSummarySection(obj[section])) {
        errors[section] = `${section} must be a valid section object`;
      }
    });
    
    // Check metadata
    if (typeof obj.metadata !== 'object' || obj.metadata === null) {
      errors.metadata = 'Metadata must be an object';
    } else {
      const metadata = obj.metadata as Record<string, unknown>;
      
      if (typeof metadata.generatedAt !== 'string') {
        errors['metadata.generatedAt'] = 'generatedAt must be a string';
      }
      
      if (typeof metadata.documentCount !== 'number') {
        errors['metadata.documentCount'] = 'documentCount must be a number';
      }
      
      if (!Array.isArray(metadata.documents)) {
        errors['metadata.documents'] = 'documents must be an array';
      }
    }
    
    return errors;
  }
}