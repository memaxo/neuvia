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
 *
 * PHASE 1 ANALYSIS NOTES:
 * - This file demonstrates a good facade pattern for domain services
 * - It encapsulates business logic related to verification while delegating to specialized services
 * - Properly interacts with workflow components while keeping business logic separate
 * - Delegate pattern is used consistently throughout the service
 * - Line 98 shows proper domain logic encapsulation: documentVerificationService.prepareDocumentData
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
   * 
   * PHASE 2 IMPLEMENTATION:
   * This service is being expanded to handle the report generation business logic that
   * was previously leaking into the verification workflow file.
   */
  async generateVerification(options: GenerateVerificationOptions): Promise<VerificationServiceResult<any>> {
    return documentVerificationService.generateVerification(options);
  }
  
  /**
   * Initialize verification process
   * Acts as the single source of truth for verification initialization
   * Handles document data processing and delegates to workflow for state transitions
   * 
   * @param workflowId - The ID of the workflow to use
   * @param options - Verification options including document data
   * @returns A promise resolving to the verification result
   * 
   * @throws {VerificationError} If verification initialization fails
   */
  async initiateVerification(
    workflowId: string,
    options: {
      userId: string;
      documentId: string;
      documentData: any;
      autoGenerateReport?: boolean;
      onProgress?: (progress: number, phase: any) => void;
      transactionId?: string;
    }
  ): Promise<VerificationServiceResult<any>> {
    // Set up progress tracking
    const progressCallback = options.onProgress || (() => {});
    const transactionId = options.transactionId;
    
    try {
      if (!workflowId) {
        throw new VerificationError({
          message: 'Workflow ID is required',
          code: 'WORKFLOW_INVALID_ID'
        });
      }
      
      if (!options.documentId) {
        throw new VerificationError({
          message: 'Document ID is required',
          code: 'DOCUMENT_INVALID_ID'
        });
      }
      
      if (!options.userId) {
        throw new VerificationError({
          message: 'User ID is required',
          code: 'USER_INVALID_ID'
        });
      }
      
      // First update progress to indicate start
      progressCallback(10, 'VERIFICATION');
      
      // Process document data (business logic)
      const documentData = await documentVerificationService.prepareDocumentData(options.documentData);
      
      progressCallback(30, 'VERIFICATION');
      
      // Import verification workflow to avoid circular dependencies
      const { verificationWorkflow } = await import('@/lib/services/workflow/domain/verification-workflow');
      const { workflowEngine } = await import('@/lib/services/workflow/coordination/workflow-engine');
      
      // Check if workflow exists, create if needed
      let workflowInstance = await workflowEngine.getWorkflow(workflowId)
        .then(result => result.isSuccess() ? result.value : null)
        .catch(() => null);
      
      if (!workflowInstance) {
        // Create a new workflow instance
        const createResult = await workflowEngine.createWorkflow(
          'verification-workflow',
          workflowId,
          {
            userId: options.userId,
            documentId: options.documentId,
            autoGenerateReport: options.autoGenerateReport
          }
        );
        
        if (createResult.isFailure()) {
          throw new VerificationError({
            message: `Failed to create verification workflow: ${createResult.error.message}`,
            code: createResult.error.code,
            data: createResult.error.details
          });
        }
        
        workflowInstance = createResult.value;
      }
      
      // Update progress to indicate document processing complete
      progressCallback(50, 'VERIFICATION');
      
      // Delegate to the workflow for state transition only
      const result = await verificationWorkflow.initiateVerification(
        workflowId,
        {
          action: 'INITIATE_VERIFICATION',
          userId: options.userId,
          documentId: options.documentId,
          verificationId: documentData.verificationId,
          summaryId: documentData.summaryId,
          documentText: documentData.text,
          structuredData: documentData.structuredData,
          metadata: documentData.metadata,
          autoGenerateReport: options.autoGenerateReport || false,
          transactionId
        }
      );
      
      if (result.isFailure()) {
        throw new VerificationError({
          message: `Failed to initiate verification: ${result.error.message}`,
          code: result.error.code,
          data: result.error.details
        });
      }
      
      // Final progress update
      progressCallback(100, 'VERIFICATION_PENDING');
      
      // Return success result with minimal transformation
      return {
        success: true,
        data: {
          verificationId: documentData.verificationId,
          documentId: options.documentId,
          summaryId: documentData.summaryId,
          currentSummary: documentData.summary,
          status: 'pending',
          metadata: documentData.metadata
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const normalizedError = normalizeError(error);
      
      // Log the error
      console.error('Error initiating verification', {
        workflowId,
        documentId: options.documentId,
        error: normalizedError.message
      });
      
      // Fall back to the traditional document verification if workflow engine fails
      try {
        const fallbackResult = await documentVerificationService.generateVerification({
          document: options.documentData,
          documentId: options.documentId,
          workflowId,
          summaryId: null
        });
        
        return fallbackResult;
      } catch (fallbackError) {
        // If even the fallback fails, return the original error
        return {
          success: false,
          data: {},
          error: {
            message: normalizedError.message || 'Verification initialization failed',
            code: normalizedError.code || 'VERIFICATION_INITIALIZATION_ERROR',
            details: normalizedError.data || {}
          },
          timestamp: new Date().toISOString()
        };
      }
    }
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
   * Process a verification correction
   * Acts as the single source of truth for correction processing
   * Handles business logic and delegates to workflow for state transitions
   * 
   * @param workflowId - The ID of the workflow
   * @param verificationId - The ID of the verification
   * @param correction - The correction data
   * @returns A promise resolving to the verification result
   * 
   * @throws {VerificationError} If correction processing fails
   */
  async processVerificationCorrection(
    workflowId: string,
    verificationId: string,
    correction: any
  ): Promise<VerificationServiceResult<any>> {
    try {
      // Validate inputs
      if (!workflowId) {
        throw new VerificationError({
          message: 'Workflow ID is required',
          code: 'WORKFLOW_INVALID_ID'
        });
      }
      
      if (!verificationId) {
        throw new VerificationError({
          message: 'Verification ID is required',
          code: 'VERIFICATION_INVALID_ID'
        });
      }
      
      if (!correction || !correction.userId) {
        throw new VerificationError({
          message: 'Valid correction data with user ID is required',
          code: 'CORRECTION_DATA_INVALID'
        });
      }
      
      // Import workflow engine to get workflow state
      const { workflowEngine } = await import('@/lib/services/workflow/coordination/workflow-engine');
      
      // Get current workflow state
      const workflowResult = await workflowEngine.getWorkflow(workflowId);
      
      if (workflowResult.isFailure()) {
        throw new VerificationError({
          message: `Failed to get workflow state: ${workflowResult.error.message}`,
          code: workflowResult.error.code,
          data: workflowResult.error.details
        });
      }
      
      const workflow = workflowResult.value;
      
      // Verify verification ID matches
      if (workflow.context.verificationId !== verificationId) {
        throw new VerificationError({
          message: 'Verification ID mismatch',
          code: 'VERIFICATION_ID_MISMATCH',
          data: {
            workflowId,
            verificationId,
            currentVerificationId: workflow.context.verificationId
          }
        });
      }
      
      // Process correction data using the correction service (business logic)
      const correctionResult = await correctionService.prepareCorrectionData({
        workflowId,
        verificationId,
        correction,
        currentSummary: workflow.context.currentSummary
      });
      
      // Import verification workflow to avoid circular dependencies
      const { verificationWorkflow } = await import('@/lib/services/workflow/domain/verification-workflow');
      
      // Delegate to workflow for state transition only
      const result = await verificationWorkflow.processCorrection(
        workflowId,
        verificationId,
        {
          action: 'SUBMIT_CORRECTION',
          correctionId: correctionResult.correctionId,
          versionId: correctionResult.versionId,
          summaryId: correctionResult.summaryId,
          newSummary: correctionResult.newSummary,
          correctionText: correction.userComments || '',
          correctionFields: correction.correctedFields,
          userId: correction.userId,
          metadata: correctionResult.metadata
        }
      );
      
      if (result.isFailure()) {
        throw new VerificationError({
          message: `Failed to process correction: ${result.error.message}`,
          code: result.error.code,
          data: result.error.details
        });
      }
      
      // Return success result with minimal transformation
      return {
        success: true,
        data: {
          verificationId,
          documentId: workflow.context.documentId || '',
          summaryId: correctionResult.summaryId,
          currentSummary: correctionResult.newSummary,
          correctionId: correctionResult.correctionId,
          status: 'in_progress',
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const normalizedError = normalizeError(error);
      
      // Check if it's a concurrency error
      if (normalizedError.message?.includes('CONCURRENT_MODIFICATION') ||
          normalizedError.code === 'CONCURRENT_MODIFICATION' ||
          normalizedError.message?.includes('Version mismatch')) {
        return {
          success: false,
          data: {},
          error: {
            message: 'Another user has modified this verification since you started editing',
            code: 'VERIFICATION_CONCURRENT_MODIFICATION',
            details: {
              workflowId,
              verificationId,
              userId: correction.userId
            }
          },
          timestamp: new Date().toISOString()
        };
      }
      
      // Fall back to the standard correction processor if workflow approach fails
      try {
        // Try the standard correction processor as fallback
        const fallbackResult = await correctionService.processCorrection({
          workflowId,
          correction: correction.correctedFields,
          currentSummary: correction.userComments,
          userId: correction.userId
        });
        
        return fallbackResult;
      } catch (fallbackError) {
        // If even the fallback fails, return the original error
        return {
          success: false,
          data: {},
          error: {
            message: normalizedError.message || 'Failed to process verification correction',
            code: normalizedError.code || 'VERIFICATION_CORRECTION_ERROR',
            details: {
              workflowId,
              verificationId,
              userId: correction.userId,
              error: normalizedError
            }
          },
          timestamp: new Date().toISOString()
        };
      }
    }
  }

  /**
   * Complete the verification process
   * Acts as the single source of truth for verification completion/rejection
   * Handles business logic and delegates to workflow for state transitions
   * 
   * @param workflowId - The ID of the verification workflow to complete
   * @param isApproved - Whether the verification is approved or rejected
   * @param options - Optional additional parameters
   * @param options.items - Specific items that were verified
   * @param options.comments - Any comments on the verification decision
   * @param options.userId - The ID of the user completing the verification
   * @param options.verificationId - The ID of the verification
   * @param options.autoGenerateReport - Whether to automatically generate a report
   * 
   * @returns A promise resolving to the completed verification result
   * 
   * @remarks
   * This method handles the business logic of verification completion and
   * delegates state transitions to the workflow. It builds metadata, handles
   * verification record creation, and provides a consistent API.
   * 
   * @throws {VerificationError} If the verification completion fails
   */
  async completeVerification(
    workflowId: string,
    isApproved: boolean,
    options?: {
      items?: any[];
      comments?: string;
      userId?: string;
      verificationId?: string;
      autoGenerateReport?: boolean;
    }
  ): Promise<VerificationServiceResult<VerificationResult>> {
    const userId = options?.userId || 'system';
    
    try {
      // Validate inputs
      if (!workflowId) {
        throw new VerificationError({
          message: 'Workflow ID is required',
          code: 'WORKFLOW_INVALID_ID'
        });
      }
      
      // Import workflow engine to get verification ID if not provided
      const { workflowEngine } = await import('@/lib/services/workflow/coordination/workflow-engine');
      let verificationId = options?.verificationId;
      
      if (!verificationId) {
        // Get workflow state to extract verification ID
        const workflowResult = await workflowEngine.getWorkflow(workflowId);
        
        if (workflowResult.isSuccess()) {
          verificationId = workflowResult.value.context.verificationId;
        } else {
          throw new VerificationError({
            message: 'Failed to retrieve workflow state',
            code: 'WORKFLOW_STATE_RETRIEVAL_FAILED',
            data: { workflowId }
          });
        }
      }
      
      // Process completion/rejection using the verification result service (business logic)
      const isCompletion = isApproved;
      let metadata = await verificationResultService.prepareCompletionMetadata({
        workflowId,
        verificationId,
        userId,
        autoGenerateReport: options?.autoGenerateReport || false,
        isApproved
      });
      
      // PHASE 2 IMPLEMENTATION: Generate report data if needed
      if (isCompletion && options?.autoGenerateReport) {
        try {
          // Use our new method to prepare report data
          const reportData = await this.prepareReportAfterVerification(
            workflowId,
            verificationId,
            {
              userId,
              transactionId: metadata.transactionId as string
            }
          );
          
          // Add report data to metadata for the workflow
          metadata = {
            ...metadata,
            reportData
          };
        } catch (error) {
          console.warn('Failed to prepare report data, continuing with verification completion', {
            workflowId,
            verificationId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      // Import verification workflow to avoid circular dependencies
      const { verificationWorkflow } = await import('@/lib/services/workflow/domain/verification-workflow');
      
      let result;
      
      if (isCompletion) {
        // Delegate state transition to workflow for completion
        result = await verificationWorkflow.completeVerification(
          workflowId,
          {
            action: 'CONFIRM_VERIFICATION',
            verificationId,
            userId,
            metadata,
            autoGenerateReport: options?.autoGenerateReport || false
          }
        );
      } else {
        // Prepare rejection reason
        const rejectionReason = options?.comments || 'Verification rejected';
        
        // Get rejection-specific metadata
        const rejectionMetadata = await verificationResultService.prepareRejectionMetadata({
          workflowId,
          verificationId,
          userId,
          reason: rejectionReason
        });
        
        // Delegate state transition to workflow for rejection
        result = await verificationWorkflow.rejectVerification(
          workflowId,
          {
            action: 'REJECT_VERIFICATION',
            verificationId,
            userId,
            reason: rejectionReason,
            metadata: rejectionMetadata
          }
        );
      }
      
      if (result.isFailure()) {
        throw new VerificationError({
          message: result.error.message,
          code: result.error.code,
          data: result.error.details
        });
      }
      
      // Build result with business logic data
      return {
        success: true,
        data: {
          isCompleted: true,
          isApproved,
          items: options?.items || [],
          completedAt: metadata.completedAt || new Date().toISOString(),
          verificationMetadata: {
            verification_status: isApproved ? 'completed' : 'failed',
            ...metadata
          }
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const normalizedError = normalizeError(error);
      
      // Log the failure
      console.error('Failed to complete verification through workflow', {
        workflowId,
        isApproved,
        error: normalizedError
      });
      
      // Fall back to the old implementation if workflow engine approach fails
      return verificationResultService.completeVerification({
        workflowId,
        isApproved,
        items: options?.items,
        comments: options?.comments,
        userId
      });
    }
  }

  /**
   * Prepare report data after verification completion
   * This method extracts the business logic that was previously in the verification workflow.
   * 
   * @param workflowId The workflow ID
   * @param verificationId The verification ID
   * @param options Additional options
   * @returns Report data with ID and metadata
   */
  async prepareReportAfterVerification(
    workflowId: string,
    verificationId: string,
    options: {
      userId: string;
      transactionId?: string;
    }
  ): Promise<{
    reportId: string;
    metadata: Record<string, unknown>;
  }> {
    // Import report service
    const { reportService } = await import('@/lib/services/report/report-service');
    
    // Prepare report generation data using report service
    const reportData = await reportService.prepareReportData({
      workflowId,
      verificationId,
      userId: options.userId,
      transactionId: options.transactionId
    });
    
    return {
      reportId: reportData.reportId,
      metadata: reportData.metadata
    };
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