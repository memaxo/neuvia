import { ValidationError } from '@/lib/errors/verification-errors'
import { DocumentCategory } from '@/lib/types/document'
import type { DocumentType } from '@/lib/types/document'
import type { UUID } from '@/lib/types/base'
import { TypeValidator } from './type-validator'

/**
 * Validator for patient summary inputs
 *
 * Centralizes validation logic for patient summary operations to ensure consistent validation
 * and error handling across the service.
 */
export class PatientSummaryValidator {
  /**
   * Validate document extraction inputs
   *
   * @param documentId Document ID
   * @param documentContent Document content
   * @param documentType Document type information
   * @param documentDate Document date
   * @throws {ValidationError} If any validation fails
   */
  static validateExtractionInputs(
    documentId: UUID,
    documentContent: string,
    documentType: DocumentType,
    documentDate: string
  ): void {
    if (!documentId || typeof documentId !== 'string') {
      throw new ValidationError({
        message: 'Valid document ID is required',
        code: 'INVALID_DOCUMENT_ID',
        data: { documentId }
      });
    }
    
    if (!documentContent || typeof documentContent !== 'string') {
      throw new ValidationError({
        message: 'Document content is required',
        code: 'MISSING_DOCUMENT_CONTENT',
        data: { documentId, contentLength: documentContent?.length || 0 }
      });
    }
    
    if (!TypeValidator.isValidDocumentType(documentType)) {
      throw new ValidationError({
        message: 'Valid document type is required',
        code: 'INVALID_DOCUMENT_TYPE',
        data: { documentId, documentType }
      });
    }
    
    if (!documentDate || typeof documentDate !== 'string') {
      throw new ValidationError({
        message: 'Valid document date is required',
        code: 'INVALID_DOCUMENT_DATE',
        data: { documentId, documentDate }
      });
    }
  }

  /**
   * Validate patient ID for summary operations
   *
   * @param patientId Patient ID to validate
   * @throws {ValidationError} If patient ID is invalid
   */
  static validatePatientId(patientId: string): void {
    if (!patientId || typeof patientId !== 'string') {
      throw new ValidationError({
        message: 'Valid patient ID is required',
        code: 'INVALID_PATIENT_ID',
        data: { patientId }
      });
    }
  }

  /**
   * Validate document extraction array
   *
   * @param extractions Array of document extractions
   * @throws {ValidationError} If extractions are invalid or empty
   */
  static validateExtractions(extractions: any[]): void {
    if (!Array.isArray(extractions) || extractions.length === 0) {
      throw new ValidationError({
        message: 'At least one document extraction is required',
        code: 'INVALID_EXTRACTIONS',
        data: { extractionsCount: extractions?.length || 0 }
      });
    }

    // Check each extraction
    extractions.forEach((extraction, index) => {
      if (!TypeValidator.isValidDocumentExtraction(extraction)) {
        throw new ValidationError({
          message: 'Invalid document extraction format',
          code: 'INVALID_EXTRACTION_FORMAT',
          data: {
            index,
            validationErrors: TypeValidator.getExtractionValidationErrors(extraction)
          }
        });
      }
    });
  }

  /**
   * Validate a summary ID for verification operations
   *
   * @param summaryId Summary ID to validate
   * @throws {ValidationError} If summary ID is invalid
   */
  static validateSummaryId(summaryId: string): void {
    if (!summaryId || typeof summaryId !== 'string') {
      throw new ValidationError({
        message: 'Valid summary ID is required',
        code: 'INVALID_SUMMARY_ID',
        data: { summaryId }
      });
    }
  }

  /**
   * Validate documents for summary generation
   *
   * @param documents Documents array to validate
   * @throws {ValidationError} If documents are invalid or empty
   */
  static validateDocuments(documents: any[]): void {
    if (!Array.isArray(documents) || documents.length === 0) {
      throw new ValidationError({
        message: 'Cannot generate summary: no documents provided',
        code: 'NO_DOCUMENTS',
        data: { documentCount: documents?.length || 0 }
      });
    }
  }
}