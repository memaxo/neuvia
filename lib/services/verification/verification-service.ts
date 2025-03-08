import { documentVerificationService } from './document-verification-service';
import { correctionService } from './correction-service';
import { verificationResultService } from './verification-result-service';
import type {
  CompleteVerificationOptions,
  VerificationServiceResult,
  VerificationResult,
  GenerateVerificationOptions,
  SubmitCorrectionOptions,
  ProcessCorrectionOptions
} from '@/lib/types/verification';

/**
 * Composite verification service that combines functionality from:
 * - DocumentVerificationService
 * - CorrectionService
 * - VerificationResultService
 *
 * This service maintains API compatibility with the original verification-service
 * that was refactored into separate specialized services.
 * 
 * @remarks
 * The VerificationService acts as a facade over the specialized verification 
 * services, providing a unified API for all verification-related operations while
 * delegating actual implementation to the appropriate specialized service.
 */
class VerificationService {
  /**
   * Generate verification for a document
   * 
   * @param options - Configuration options for document verification
   * @param options.documentId - The ID of the document to verify
   * @param options.patientId - The ID of the patient the document belongs to
   * @param options.userId - The ID of the user initiating the verification
   * @param options.metadata - Optional metadata for the verification process
   * 
   * @returns A promise resolving to the verification result with appropriate status
   * 
   * @throws {VerificationError} If document verification fails
   * @throws {ValidationError} If required parameters are missing or invalid
   */
  async generateVerification(options: GenerateVerificationOptions): Promise<VerificationServiceResult<any>> {
    return documentVerificationService.generateVerification(options);
  }

  /**
   * Submit a correction to the verification process
   * 
   * @param options - Configuration options for the correction submission
   * @param options.workflowId - The ID of the verification workflow
   * @param options.userId - The ID of the user submitting the correction
   * @param options.correctionData - The corrected data to be applied
   * @param options.onStatusUpdate - Optional callback for status updates during processing
   * 
   * @returns A promise resolving to the result of the correction submission
   * 
   * @throws {CorrectionError} If the correction submission fails
   * @throws {ValidationError} If required parameters are missing or invalid
   */
  async submitCorrection(options: SubmitCorrectionOptions & {
    onStatusUpdate?: (status: any) => void;
  }): Promise<VerificationServiceResult<any>> {
    return correctionService.submitCorrection(options);
  }

  /**
   * Process a correction to update the patient summary
   * 
   * @param options - Configuration options for processing the correction
   * @param options.workflowId - The ID of the verification workflow
   * @param options.correctionId - The ID of the correction to process
   * @param options.userId - The ID of the user processing the correction
   * @param options.action - The action to take (approve/reject/modify)
   * 
   * @returns A promise resolving to the result of the correction processing
   * 
   * @throws {CorrectionError} If the correction processing fails
   * @throws {ValidationError} If required parameters are missing or invalid
   */
  async processCorrection(options: ProcessCorrectionOptions): Promise<VerificationServiceResult<any>> {
    return correctionService.processCorrection(options);
  }

  /**
   * Complete the verification process
   * 
   * @param workflowId - The ID of the verification workflow to complete
   * @param isApproved - Whether the verification is approved or rejected
   * @param options - Optional additional parameters
   * @param options.items - Specific items that were verified
   * @param options.comments - Any comments on the verification decision
   * 
   * @returns A promise resolving to the completed verification result
   * 
   * @remarks
   * This is a convenience method that takes separate parameters instead of a single options object.
   * It internally calls verificationResultService.completeVerification with the appropriate structure.
   * 
   * @throws {VerificationError} If the verification completion fails
   */
  async completeVerification(
    workflowId: string,
    isApproved: boolean,
    options?: { items?: any[]; comments?: string }
  ): Promise<VerificationServiceResult<VerificationResult>> {
    return verificationResultService.completeVerification({
      workflowId,
      isApproved,
      items: options?.items,
      comments: options?.comments
    });
  }

  /**
   * Get verification status for a patient summary
   * 
   * @param patientId - The ID of the patient whose summary verification to retrieve
   * 
   * @returns A promise resolving to the patient summary verification status
   * 
   * @throws {VerificationError} If retrieving the verification status fails
   * @throws {ValidationError} If the patient ID is invalid
   */
  async getPatientSummaryVerification(patientId: string): Promise<VerificationServiceResult<any>> {
    return verificationResultService.getPatientSummaryVerification(patientId);
  }

  /**
   * Update verification status for a patient summary
   * 
   * @param patientId - The ID of the patient whose summary verification to update
   * @param data - The updated verification data to apply
   * 
   * @returns A promise resolving to the updated verification result
   * 
   * @throws {VerificationError} If updating the verification status fails
   * @throws {ValidationError} If the patient ID or data is invalid
   */
  async updatePatientSummaryVerification(
    patientId: string,
    data: any
  ): Promise<VerificationServiceResult<VerificationResult>> {
    return verificationResultService.updatePatientSummaryVerification(patientId, data);
  }

  /**
   * Get verification status for a document
   * 
   * @param documentId - The ID of the document whose verification to retrieve
   * 
   * @returns A promise resolving to the document verification status
   * 
   * @throws {VerificationError} If retrieving the verification status fails
   * @throws {ValidationError} If the document ID is invalid
   */
  async getDocumentVerification(documentId: string): Promise<VerificationServiceResult<any>> {
    return documentVerificationService.getDocumentVerification(documentId);
  }
}

export const verificationService = new VerificationService();

/**
 * Class for verification-specific errors
 * 
 * @description
 * VerificationError represents errors that occur during the document verification process.
 * These can include failures in verification generation, retrieval, or updating verification statuses.
 * 
 * @example
 * ```ts
 * throw new VerificationError({
 *   message: 'Failed to generate verification for document',
 *   code: 'VERIFICATION_GENERATION_FAILED',
 *   data: { documentId, patientId }
 * });
 * ```
 */
export class VerificationError extends Error {
  /**
   * Error code uniquely identifying the type of verification error
   */
  code?: string;
  
  /**
   * Additional context data associated with the error
   */
  data?: Record<string, any>;
  
  /**
   * Creates a new VerificationError instance
   * 
   * @param options - Error configuration options
   * @param options.message - Human-readable error message
   * @param options.code - Optional error code for programmatic handling
   * @param options.data - Optional additional context about the error
   */
  constructor({
    message,
    code,
    data
  }: {
    message: string;
    code?: string;
    data?: Record<string, any>;
  }) {
    super(message);
    this.name = 'VerificationError';
    this.code = code;
    this.data = data;
  }
}

/**
 * Class for correction-specific errors
 * 
 * @description
 * CorrectionError represents errors that occur during the correction submission or
 * processing workflow. These can include failures in correction validation, submission,
 * or when attempting to apply corrections to patient data.
 * 
 * @example
 * ```ts
 * throw new CorrectionError({
 *   message: 'Failed to submit correction',
 *   code: 'CORRECTION_SUBMISSION_FAILED',
 *   data: { workflowId, correctionData }
 * });
 * ```
 */
export class CorrectionError extends Error {
  /**
   * Error code uniquely identifying the type of correction error
   */
  code?: string;
  
  /**
   * Additional context data associated with the error
   */
  data?: Record<string, any>;
  
  /**
   * Creates a new CorrectionError instance
   * 
   * @param options - Error configuration options
   * @param options.message - Human-readable error message
   * @param options.code - Optional error code for programmatic handling
   * @param options.data - Optional additional context about the error
   */
  constructor({
    message,
    code,
    data
  }: {
    message: string;
    code?: string;
    data?: Record<string, any>;
  }) {
    super(message);
    this.name = 'CorrectionError';
    this.code = code;
    this.data = data;
  }
}