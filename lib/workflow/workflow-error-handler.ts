import { useChatStore } from '@/stores/chat-store'
import { toast } from '@/components/ui/use-toast'
import { createBrowserClient } from '@/lib/supabase/clients'
import type { WorkflowStep } from '../types/workflow'
import { DomainOnlyWorkflowStep } from '../types/workflow'
import type { ApiClient } from '@/lib/api/client/api-client'
import type { Json } from '@/lib/types/database'
import { workflowService } from '@/lib/services/workflow/core/workflow-service'
import { WorkflowErrorContextBuilder } from '@/lib/services/workflow/error-context'
import { WorkflowStepMapper } from '@/lib/services/workflow/utils/step-mapper'
import { Result, type ResultError } from '@/lib/services/workflow/error/result'
import { 
  recoveryService, 
  RecoveryStrategy, 
  type RecoveryOptions 
} from '@/lib/services/workflow/recovery/recovery-service'

/**
 * Error category for different workflow errors
 */
export enum WorkflowErrorCategory {
  UPLOAD = 'upload',
  PROCESSING = 'processing',
  VERIFICATION = 'verification',
  REPORT = 'report',
  NETWORK = 'network',
  PERMISSION = 'permission',
  GENERIC = 'generic',
}

/**
 * Full error information with context
 */
export interface WorkflowError {
  message: string
  category: WorkflowErrorCategory
  step: WorkflowStep
  timestamp: string
  code?: string
  retry?: boolean
  critical?: boolean
  details?: Record<string, unknown>
}

export interface WorkflowErrorMetadata {
  errorMessage: string
  originalError?: unknown
  errorCode?: string
  errorType: 'validation' | 'network' | 'permission' | 'timeout' | 'system' | 'unknown'
  workflowStep: WorkflowStep
  previousStep?: WorkflowStep
  recoveryPaths?: WorkflowStep[]
  timestamp: string
  userAgent?: string
  clientId?: string
  details?: Record<string, unknown>
}

/**
 * WorkflowErrorHandler class for capturing and handling errors within workflow operations
 */
export class WorkflowErrorHandler {
  private apiClient: ApiClient | null = null
  private errorContextBuilder: WorkflowErrorContextBuilder

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient ?? null
    this.errorContextBuilder = new WorkflowErrorContextBuilder()
  }

  public setApiClient(apiClient: ApiClient) {
    this.apiClient = apiClient
  }

  /**
   * Normalizes an unknown error into a structured object
   * Enhanced to handle ResultError objects from the Result pattern
   */
  public normalizeError(
    error: unknown,
    fallbackMessage = 'An unknown error occurred'
  ): {
    message: string
    type: WorkflowErrorMetadata['errorType']
    code?: string
    details?: Record<string, unknown>
  } {
    // Check if it's a ResultError from the Result pattern
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      'code' in error
    ) {
      // Handle ResultError objects directly
      const resultErr = error as ResultError;
      const message = resultErr.message || fallbackMessage;
      const code = resultErr.code || 'UNKNOWN_ERROR';
      
      // Classify by message content
      const lowerMsg = message.toLowerCase();
      let type: WorkflowErrorMetadata['errorType'] = 'system';
      
      if (
        lowerMsg.includes('network') ||
        lowerMsg.includes('fetch') ||
        lowerMsg.includes('connection')
      ) {
        type = 'network';
      } else if (lowerMsg.includes('timeout')) {
        type = 'timeout';
      } else if (
        lowerMsg.includes('permission') ||
        lowerMsg.includes('access denied') ||
        lowerMsg.includes('forbidden')
      ) {
        type = 'permission';
      } else if (
        lowerMsg.includes('validation') ||
        lowerMsg.includes('invalid') ||
        lowerMsg.includes('required')
      ) {
        type = 'validation';
      }
      
      return {
        message,
        type,
        code,
        details: resultErr.details || {},
      };
    }
    
    // If it's one of our "ApplicationErrors" (with isOperational):
    if (
      typeof error === 'object' &&
      error !== null &&
      'isOperational' in error
    ) {
      const appErr = error as {
        message?: string
        code?: string
        data?: Record<string, unknown>
      }
      const message = appErr.message || fallbackMessage
      const code = appErr.code || 'UNKNOWN_ERROR'
      // Classify roughly by message content
      const lowerMsg = message.toLowerCase()
      let type: WorkflowErrorMetadata['errorType'] = 'system'
      if (
        lowerMsg.includes('network') ||
        lowerMsg.includes('fetch') ||
        lowerMsg.includes('connection')
      ) {
        type = 'network'
      } else if (lowerMsg.includes('timeout')) {
        type = 'timeout'
      } else if (
        lowerMsg.includes('permission') ||
        lowerMsg.includes('access denied') ||
        lowerMsg.includes('forbidden')
      ) {
        type = 'permission'
      } else if (
        lowerMsg.includes('validation') ||
        lowerMsg.includes('invalid') ||
        lowerMsg.includes('required')
      ) {
        type = 'validation'
      }
      return {
        message,
        type,
        code,
        details: appErr.data || {},
      }
    }

    // Check for Result objects
    if (
      typeof error === 'object' &&
      error !== null &&
      error instanceof Result
    ) {
      const result = error as Result<unknown>;
      
      if (result.isFailure()) {
        // Extract the error info from the Result
        const resultError = result.error;
        return this.normalizeError(resultError, fallbackMessage);
      } else {
        // This shouldn't happen - we shouldn't be normalizing success results
        return {
          message: 'Attempted to normalize a successful Result as an error',
          type: 'system',
          code: 'INVALID_ERROR_NORMALIZATION',
          details: { originalResult: result.toObject() },
        };
      }
    }

    // Plain Error
    if (error instanceof Error) {
      const message = error.message || fallbackMessage
      const code = (error as { code?: string }).code || 'UNKNOWN_ERROR'
      return {
        message,
        type: 'system',
        code,
        details: {},
      }
    }

    // Plain string or unknown
    if (typeof error === 'string') {
      return {
        message: error,
        type: 'unknown',
      }
    }

    // Fallback
    return {
      message: fallbackMessage,
      type: 'unknown',
      details: { originalError: error },
    }
  }

  /**
   * Return possible recovery paths for a given step
   * Delegates to the centralized RecoveryService
   */
  public getRecoveryPaths(currentStep: WorkflowStep): WorkflowStep[] {
    return recoveryService.getRecoveryPaths(currentStep);
  }

  /**
   * Build error metadata with normalization
   */
  public createErrorMetadata(
    error: unknown,
    workflowStep: WorkflowStep,
    previousStep?: WorkflowStep,
    details?: Record<string, unknown>
  ): WorkflowErrorMetadata {
    const normalizedError = this.normalizeError(error)
    const recoveryPaths = this.getRecoveryPaths(workflowStep)
    
    return this.errorContextBuilder.buildErrorContext({
      error: normalizedError.message,
      errorType: normalizedError.type,
      errorCode: normalizedError.code,
      currentStep: workflowStep,
      previousStep,
      recoveryPaths,
      details: { ...normalizedError.details, ...details }
    })
  }

  /**
   * Log error to console, and attempt storing in DB if possible
   */
  public async logError(metadata: WorkflowErrorMetadata): Promise<void> {
    // Log to console
    console.error('Workflow error:', {
      message: metadata.errorMessage,
      step: metadata.workflowStep,
      previousStep: metadata.previousStep,
      type: metadata.errorType,
      timestamp: metadata.timestamp,
      details: metadata.details,
    })
    
    try {
      const workflowId =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('current_workflow_id')
          : null

      // Log to the workflow audit trail if we have a workflowId
      if (workflowId !== null && workflowId !== undefined && workflowId.length > 0) {
        await workflowService.logWorkflowEvent(
          workflowId,
          'error_occurred',
          {
            error: metadata.errorMessage,
            errorType: metadata.errorType,
            errorCode: metadata.errorCode,
            workflowStep: metadata.workflowStep,
            previousStep: metadata.previousStep,
            timestamp: metadata.timestamp,
            details: metadata.details
          }
        )
      } else {
        // Fallback to direct database logging if no workflowId
        const supabase = createBrowserClient()
        await supabase.from('audit_logs').insert({
          action: 'LOG_ERROR',
          entity_id: workflowId || 'unknown',
          entity_type: 'workflow',
          changes: metadata.details as Json ?? null,
          created_at: metadata.timestamp,
          user_id: null,
        })
      }
    } catch (dbError) {
      console.error('Failed to log error to database:', dbError)
    }
  }

  /**
   * Attempt automated recovery using the centralized recovery service
   * Enhanced to work with Result pattern
   */
  public async attemptRecovery(metadata: WorkflowErrorMetadata): Promise<Result<boolean>> {
    try {
      // Get workflowId from localStorage or metadata
      const workflowId = 
        metadata.details?.workflowId as string || 
        (typeof localStorage !== 'undefined' ? localStorage.getItem('current_workflow_id') : null);
      
      // Get transaction ID if available
      const transactionId = metadata.details?.transactionId as string;
      
      // Determine appropriate recovery strategy based on error type
      const { primary, fallbacks } = recoveryService.getRecommendedStrategy(metadata);
      
      // Special handling for network errors - delay recovery attempt
      if (metadata.errorType === 'network') {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Create recovery options
      const recoveryOptions: RecoveryOptions = {
        workflowId: workflowId || undefined,
        transactionId,
        metadata,
        strategy: primary,
        fallbackStrategies: fallbacks,
        showToast: true,
        maxRetries: 1,
        retryCount: typeof metadata.details?.retryCount === 'number' ? metadata.details.retryCount : 0
      };
      
      // Attempt recovery with centralized service
      const recoveryResult = await recoveryService.recoverFromError(recoveryOptions);
      
      if (recoveryResult.isSuccess()) {
        return Result.success(recoveryResult.value.success);
      } else {
        // If recovery service returned a failure Result
        return Result.failure(
          recoveryResult.error.message,
          recoveryResult.error.code,
          recoveryResult.error.details
        );
      }
    } catch (error) {
      // If recovery itself fails, return a failure Result
      const normalizedError = this.normalizeError(error);
      console.error('Recovery attempt failed:', normalizedError.message);
      
      return Result.failure(
        `Recovery attempt failed: ${normalizedError.message}`,
        'RECOVERY_ERROR',
        {
          originalError: error,
          metadata,
          errorType: normalizedError.type
        }
      );
    }
  }
  
  /**
   * Recover using the workflow service's recovery function
   * Delegates to the centralized RecoveryService
   * @deprecated Use recoveryService.recoverFromError() instead
   */
  private async recoverWithDatabaseFunction(
    workflowId: string,
    metadata: WorkflowErrorMetadata
  ): Promise<boolean> {
    try {
      // Determine best recovery path
      const recoveryStep =
        metadata.recoveryPaths && metadata.recoveryPaths.length > 0
          ? metadata.recoveryPaths[0]
          : metadata.previousStep || 'idle';
      
      // Use the centralized recovery service with DATABASE strategy
      const recoveryResult = await recoveryService.recoverFromError({
        workflowId,
        metadata,
        strategy: RecoveryStrategy.DATABASE,
        recoveryStep
      });
      
      return recoveryResult.isSuccess() && recoveryResult.value.success;
    } catch (error) {
      console.error('Error during database recovery attempt:', error);
      return false;
    }
  }

  /**
   * Provide a function for recovering from an error to a specified stage
   * Delegates to the centralized RecoveryService
   * @deprecated Use recoveryService.recoverFromError() instead
   */
  public async recoverFromError(
    targetStage: WorkflowStep,
    metadata: WorkflowErrorMetadata
  ): Promise<boolean> {
    try {
      // Use the centralized recovery service with MEMORY strategy
      const recoveryResult = await recoveryService.recoverFromError({
        metadata,
        strategy: RecoveryStrategy.MEMORY,
        fallbackStrategies: [RecoveryStrategy.UI],
        recoveryStep: targetStage
      });
      
      return recoveryResult.isSuccess() && recoveryResult.value.success;
    } catch (recoveryError) {
      console.error('Error during recovery attempt:', recoveryError);
      
      // Handle recovery failure with minimal UI updates
      const store = useChatStore.getState();
      const norm = this.normalizeError(recoveryError);
      store.setError(`Recovery failed: ${norm.message}`);
      
      // Note: 'error' is not a valid step in the DB enum, so we use DomainOnlyWorkflowStep.ERROR
      store.updateWorkflowStep(DomainOnlyWorkflowStep.ERROR, {
        error: `Recovery failed: ${norm.message}`,
        originalError: metadata.errorMessage,
        recoveryFailed: true,
      });
      
      return false;
    }
  }

  /**
   * Clear error from state
   */
  public clearError(returnToStep?: WorkflowStep): void {
    const store = useChatStore.getState()
    store.setError(null)
    if (returnToStep !== null && returnToStep !== undefined) {
      store.updateWorkflowStep(returnToStep, {})
    }
  }

  /**
   * Handle an error end-to-end: log, update store, optionally recover
   * Enhanced to use the centralized RecoveryService
   */
  public async handleError(
    error: unknown,
    currentStep: WorkflowStep,
    options?: {
      previousStep?: WorkflowStep
      details?: Record<string, unknown>
      showToast?: boolean
      attemptRecovery?: boolean
      workflowId?: string
    }
  ): Promise<Result<WorkflowErrorMetadata>> {
    try {
      // Extract error details from Result objects if present
      let processedError = error;
      if (error instanceof Result && error.isFailure()) {
        processedError = error.error;
      }
      
      const metadata = this.createErrorMetadata(
        processedError,
        currentStep,
        options?.previousStep,
        options?.details
      );
      
      // Log the error
      await this.logError(metadata);

      // Determine the appropriate error step
      const domain = metadata.details?.domain as string | undefined;
      const domainErrorStep = metadata.details?.domainErrorStep as WorkflowStep | undefined;
      const errorStep = domainErrorStep || DomainOnlyWorkflowStep.ERROR;
      
      // Update UI state
      const store = useChatStore.getState();
      store.setError(metadata.errorMessage);
      store.updateWorkflowStep(errorStep, {
        error: metadata.errorMessage,
        errorDetails: metadata.details,
        errorType: metadata.errorType,
        previousStep: metadata.previousStep,
        recoveryPaths: metadata.recoveryPaths,
        domain,
        domainErrorStep
      });
      
      // Get workflowId and transaction ID
      const workflowId = options?.workflowId || 
                        (typeof localStorage !== 'undefined' ? localStorage.getItem('current_workflow_id') : null);
      const transactionId = metadata.details?.transactionId as string;
      
      // Create recovery logger
      const recoveryLogger = recoveryService.createRecoveryLogger();
      
      // Log the error event using the recovery service
      if (workflowId) {
        await recoveryService.updateAuditLog(workflowId, 'recovery_attempt', {
          error: metadata.errorMessage,
          errorType: metadata.errorType,
          previousStep: metadata.previousStep,
          timestamp: metadata.timestamp,
          details: metadata.details
        });
      }
      
      // Attempt recovery if requested
      if (
        options?.attemptRecovery === true &&
        metadata.recoveryPaths !== null &&
        metadata.recoveryPaths !== undefined &&
        metadata.recoveryPaths.length > 0
      ) {
        // Get recommended recovery strategy
        const { primary, fallbacks } = recoveryService.getRecommendedStrategy(metadata);
        
        // Log recovery start
        if (workflowId) {
          recoveryLogger.logRecoveryStart(workflowId, metadata, {
            transactionId,
            strategy: primary
          });
        }
        
        // Execute recovery through centralized service
        const recoveryResult = await recoveryService.recoverFromError({
          workflowId: workflowId || undefined,
          transactionId,
          metadata,
          strategy: primary,
          fallbackStrategies: fallbacks,
          showToast: options?.showToast !== false
        });
        
        // Process recovery result
        if (recoveryResult.isSuccess()) {
          // Log recovery completion
          if (workflowId) {
            recoveryLogger.logRecoveryComplete(workflowId, recoveryResult.value, metadata);
          }
          
          // If recovery failed despite using all strategies
          if (!recoveryResult.value.success) {
            console.warn('All recovery strategies failed:', recoveryResult.value.error?.message);
            
            // Set error state in database if no recovery requested
            if (workflowId) {
              await workflowService.setWorkflowError(
                workflowId,
                metadata.errorMessage,
                {
                  errorType: metadata.errorType,
                  errorTimestamp: metadata.timestamp,
                  originalStep: currentStep,
                  details: {
                    ...metadata.details,
                    recoveryAttempted: true,
                    recoveryFailed: true
                  }
                }
              );
            }
          }
        } else {
          // Recovery service threw an error
          console.error('Recovery failed with error:', recoveryResult.error.message);
          
          // Set error state in database
          if (workflowId) {
            await workflowService.setWorkflowError(
              workflowId,
              metadata.errorMessage,
              {
                errorType: metadata.errorType,
                errorTimestamp: metadata.timestamp,
                originalStep: currentStep,
                recoveryError: recoveryResult.error.message,
                details: metadata.details
              }
            );
          }
        }
      } else {
        // No recovery requested, just set error state in database
        if (workflowId) {
          await workflowService.setWorkflowError(
            workflowId,
            metadata.errorMessage,
            {
              errorType: metadata.errorType,
              errorTimestamp: metadata.timestamp,
              originalStep: currentStep,
              details: metadata.details
            }
          );
        }
      }

      // Show toast notification if requested
      if (options?.showToast !== false) {
        toast({
          title: metadata.errorType === 'network' ? 'Network Error' : 'Error',
          description: metadata.errorMessage,
          variant: 'destructive',
        });
      }

      return Result.success(metadata);
    } catch (handlerError) {
      // Meta-error: something went wrong in our error handler
      console.error('Error in handleError method:', handlerError);
      
      // Create a minimal error metadata for the meta-error
      const fallbackMetadata: WorkflowErrorMetadata = {
        errorMessage: handlerError instanceof Error ? handlerError.message : 'Error in error handler',
        errorType: 'system',
        workflowStep: currentStep,
        timestamp: new Date().toISOString(),
        details: {
          originalError: error,
          metaError: handlerError
        }
      };
      
      // Show minimal toast for the meta-error
      if (options?.showToast !== false) {
        toast({
          title: 'System Error',
          description: 'An error occurred while handling another error',
          variant: 'destructive',
        });
      }
      
      return Result.failure(
        'Error handling failed',
        'ERROR_HANDLER_FAILED',
        { originalError: error, handlerError, fallbackMetadata }
      );
    }
  }
}

/**
 * Convenience hook that returns a reusable WorkflowErrorHandler instance
 */
export function useWorkflowErrorHandler(apiClient?: ApiClient) {
  const handler = new WorkflowErrorHandler(apiClient)
  return handler
}