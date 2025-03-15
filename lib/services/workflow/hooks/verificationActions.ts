import { DomainActions } from './useGenericWorkflow';
import { ProcessingPhase, DomainOnlyWorkflowStep, WorkflowStep } from '@/lib/types/workflow';
import { Result } from '@/lib/services/workflow/error/result';
import { normalizeError } from '@/lib/errors';
import { createDomainLogger } from '@/lib/services/workflow/infrastructure/workflow-processor-helpers';

// Verification-specific input, result, and state types
export interface VerificationInput {
  action: 'initiate' | 'correct' | 'complete' | 'reject' | 'reset';
  documentText?: string | Record<string, unknown>;
  correctionText?: string;
  currentSummary?: string;
  summaryId?: string;
  reason?: string;
  messageId?: string;
}

export interface VerificationResult {
  success: boolean;
  summaryId?: string;
  summary?: string;
  structuredData?: Record<string, unknown>;
  correctionCount?: number;
  status?: 'pending' | 'inProgress' | 'completed' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  error?: string;
}

export interface VerificationState {
  summaryId: string;
  summary: string;
  structuredData?: Record<string, unknown>;
  correctionCount: number;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  status: 'pending' | 'inProgress' | 'completed' | 'rejected';
  error?: string;
}

// Create domain-specific logger
const logger = createDomainLogger('Verification');

/**
 * Verification domain actions configuration
 */
export const verificationActions: DomainActions<VerificationInput, VerificationResult, VerificationState> = {
  domainName: 'Verification',
  initialStep: 'idle' as WorkflowStep,

  /**
   * Get initial verification state
   */
  getInitialState: (): VerificationState => ({
    summaryId: '',
    summary: '',
    correctionCount: 0,
    status: 'pending',
    verified: false
  }),

  /**
   * Process verification workflow action using Result pattern
   */
  processAction: async (
    input: VerificationInput,
    options: {
      workflowId: string;
      userId?: string;
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
    }
  ): Promise<Result<VerificationResult>> => {
    const { action } = input;
    const { workflowId, userId, onProgress } = options;

    try {
      // Import verification workflow service dynamically to avoid circular dependencies
      const { verificationWorkflow } = await import('@/lib/services/workflow/domain/verification-workflow');
      
      // Handle different actions
      if (action === 'initiate' && input.documentText) {
        // Prepare initial data
        const documentText = typeof input.documentText === 'string'
          ? input.documentText
          : JSON.stringify(input.documentText);
        
        // Update progress if callback provided
        if (onProgress) {
          onProgress(10, ProcessingPhase.VERIFICATION);
        }
        
        // Initiate verification
        const result = await verificationWorkflow.initiateVerification(
          workflowId,
          {
            action: 'INITIATE_VERIFICATION',
            userId: userId || 'system',
            documentText,
            messageId: input.messageId,
            transactionId: options.transactionId
          }
        );
        
        // Update progress
        if (onProgress) {
          onProgress(100, ProcessingPhase.VERIFICATION_PENDING);
        }
        
        // Convert to Result pattern
        if (result.isSuccess()) {
          const data = result.value;
          return Result.success({
            success: true,
            summaryId: data.summaryId,
            summary: data.summary,
            structuredData: data.structuredData,
            status: 'pending'
          });
        } else {
          return Result.failure(
            result.error.message,
            result.error.code,
            { success: false }
          );
        }
      }
      else if (action === 'correct' && input.correctionText && input.currentSummary) {
        // Update progress if callback provided
        if (onProgress) {
          onProgress(20, ProcessingPhase.VERIFICATION);
        }
        
        // Process correction
        const result = await verificationWorkflow.processCorrection(
          workflowId,
          input.summaryId || '',
          {
            action: 'SUBMIT_CORRECTION',
            correctionText: input.correctionText,
            currentSummary: input.currentSummary,
            messageId: input.messageId,
            userId: userId || 'system',
            transactionId: options.transactionId
          }
        );
        
        // Update progress
        if (onProgress) {
          onProgress(100, ProcessingPhase.VERIFICATION);
        }
        
        // Convert to Result pattern
        if (result.isSuccess()) {
          const data = result.value;
          return Result.success({
            success: true,
            summaryId: data.summaryId,
            summary: data.summary,
            correctionCount: data.correctionCount ?? 1,
            status: 'inProgress'
          });
        } else {
          return Result.failure(
            result.error.message,
            result.error.code,
            { success: false }
          );
        }
      }
      else if (action === 'complete') {
        // Update progress if callback provided
        if (onProgress) {
          onProgress(20, ProcessingPhase.VERIFICATION_COMPLETION);
        }
        
        // Complete verification
        const result = await verificationWorkflow.completeVerification(
          workflowId,
          {
            action: 'CONFIRM_VERIFICATION',
            verificationId: input.summaryId,
            userId: userId || 'system',
            transactionId: options.transactionId
          }
        );
        
        // Update progress
        if (onProgress) {
          onProgress(100, ProcessingPhase.VERIFICATION_COMPLETION);
        }
        
        // Convert to Result pattern
        if (result.isSuccess()) {
          return Result.success({
            success: true,
            summaryId: input.summaryId,
            verifiedBy: userId,
            verifiedAt: new Date().toISOString(),
            status: 'completed'
          });
        } else {
          return Result.failure(
            result.error.message,
            result.error.code,
            { success: false }
          );
        }
      }
      else if (action === 'reject' && input.reason) {
        // Reject verification
        const result = await verificationWorkflow.rejectVerification(
          workflowId,
          {
            action: 'REJECT_VERIFICATION',
            verificationId: input.summaryId,
            userId: userId || 'system',
            reason: input.reason,
            transactionId: options.transactionId
          }
        );
        
        // Convert to Result pattern
        if (result.isSuccess()) {
          return Result.success({
            success: true,
            status: 'rejected'
          });
        } else {
          return Result.failure(
            result.error.message,
            result.error.code,
            { success: false }
          );
        }
      }
      else if (action === 'reset') {
        // Reset is handled by the base hook reset method
        return Result.success({
          success: true,
          status: 'pending'
        });
      }
      
      // Invalid action
      return Result.failure(
        'Invalid verification action',
        'INVALID_ACTION',
        { action }
      );
    } catch (error) {
      const normalizedError = normalizeError(error);
      logger.error('Error processing verification action', {
        action: input.action,
        summaryId: input.summaryId
      }, normalizedError);
      
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'VERIFICATION_PROCESSING_ERROR',
        {
          success: false,
          summaryId: input.summaryId
        }
      );
    }
  },
  
  /**
   * Create error result for failed operations
   */
  createErrorResult: (error: Error, input: VerificationInput): VerificationResult => {
    return {
      success: false,
      summaryId: input.summaryId,
      error: error.message
    };
  },
  
  /**
   * Process result to update state
   */
  processResult: (
    result: VerificationResult,
    currentState: VerificationState
  ): VerificationState => {
    // Handle error result
    if (!result.success) {
      return {
        ...currentState,
        error: result.error
      };
    }
    
    // Update state based on result
    return {
      ...currentState,
      summaryId: result.summaryId || currentState.summaryId,
      summary: result.summary || currentState.summary,
      structuredData: result.structuredData || currentState.structuredData,
      correctionCount: result.correctionCount !== undefined
        ? result.correctionCount
        : currentState.correctionCount,
      verified: result.status === 'completed' || currentState.verified,
      status: result.status || currentState.status,
      verifiedBy: result.verifiedBy || currentState.verifiedBy,
      verifiedAt: result.verifiedAt || currentState.verifiedAt,
      error: result.error
    };
  },
  
  /**
   * Error categories for specialized handling
   */
  errorCategories: {
    concurrencyError: (error) =>
      error.message.includes('concurrent') ||
      error.message.includes('version mismatch') ||
      error.code?.includes('CONCURRENT'),
    validationError: (error) =>
      error.message.includes('invalid') ||
      error.message.includes('validation') ||
      error.code?.includes('VALIDATION'),
    networkError: (error) =>
      error.message.includes('network') ||
      error.message.includes('connection') ||
      error.code?.includes('NETWORK')
  },
  
  /**
   * Error recovery strategies keyed by category
   */
  errorRecoveryStrategies: {
    // Handle concurrent modification with merge strategy
    concurrencyError: async (error, input, options) => {
      logger.info('Attempting to recover from concurrency error', {
        action: input.action,
        summaryId: input.summaryId
      });
      
      // Only attempt recovery for corrections
      if (input.action !== 'correct' || !input.correctionText || !input.currentSummary) {
        return Result.failure(
          'Cannot recover from concurrency error for this action',
          'RECOVERY_NOT_SUPPORTED',
          { action: input.action }
        );
      }
      
      // Import verification workflow to retry with merge strategy
      const { verificationWorkflow } = await import('@/lib/services/workflow/domain/verification-workflow');
      
      // Retry with merge strategy
      return verificationWorkflow.processCorrectionWithMerge(
        options.workflowId,
        {
          correctionText: input.correctionText,
          currentSummary: input.currentSummary,
          userId: options.userId || 'system',
          withMerge: true
        }
      ).then(result => {
        if (result.isSuccess()) {
          const data = result.value;
          return Result.success({
            success: true,
            summaryId: data.summaryId,
            summary: data.summary,
            correctionCount: (data.correctionCount ?? 0) + 1,
            status: 'inProgress'
          });
        } else {
          return Result.failure(
            result.error.message,
            result.error.code,
            { success: false }
          );
        }
      });
    }
  },
  
  /**
   * Hook called before processing an action
   */
  beforeProcess: async (input: VerificationInput, options) => {
    logger.info('Starting verification operation', {
      action: input.action,
      summaryId: input.summaryId,
      workflowId: options.workflowId
    });
  },
  
  /**
   * Hook called after processing an action
   */
  afterProcess: async (result, input, options) => {
    if (result.isSuccess()) {
      logger.info('Verification operation completed successfully', {
        action: input.action,
        status: result.value.status,
        summaryId: result.value.summaryId || input.summaryId,
        workflowId: options.workflowId
      });
    } else {
      logger.warn('Verification operation completed with errors', {
        action: input.action,
        error: result.error.message,
        summaryId: input.summaryId,
        workflowId: options.workflowId
      });
    }
  }
};