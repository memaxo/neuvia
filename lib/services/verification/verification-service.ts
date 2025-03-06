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
 */
class VerificationService {
  /**
   * Generate verification for a document
   */
  async generateVerification(options: GenerateVerificationOptions): Promise<VerificationServiceResult<any>> {
    return documentVerificationService.generateVerification(options);
  }

  /**
   * Submit a correction to the verification process
   */
  async submitCorrection(options: SubmitCorrectionOptions & {
    onStatusUpdate?: (status: any) => void;
  }): Promise<VerificationServiceResult<any>> {
    return correctionService.submitCorrection(options);
  }

  /**
   * Process a correction to update the patient summary
   */
  async processCorrection(options: ProcessCorrectionOptions): Promise<VerificationServiceResult<any>> {
    return correctionService.processCorrection(options);
  }

  /**
   * Complete the verification process (convenience method taking separate parameters)
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
   */
  async getPatientSummaryVerification(patientId: string): Promise<VerificationServiceResult<any>> {
    return verificationResultService.getPatientSummaryVerification(patientId);
  }

  /**
   * Update verification status for a patient summary
   */
  async updatePatientSummaryVerification(
    patientId: string,
    data: any
  ): Promise<VerificationServiceResult<VerificationResult>> {
    return verificationResultService.updatePatientSummaryVerification(patientId, data);
  }

  /**
   * Get verification status for a document
   */
  async getDocumentVerification(documentId: string): Promise<VerificationServiceResult<any>> {
    return documentVerificationService.getDocumentVerification(documentId);
  }
}

export const verificationService = new VerificationService();

/**
 * Class for verification-specific errors
 */
export class VerificationError extends Error {
  code?: string;
  data?: Record<string, any>;
  
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
 */
export class CorrectionError extends Error {
  code?: string;
  data?: Record<string, any>;
  
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