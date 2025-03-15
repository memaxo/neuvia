/**
 * @fileoverview Workflow Error Handler (UI Layer)
 * 
 * PHASE 4 IMPLEMENTATION:
 * This file now serves as a UI-specific adapter on top of the unified error handler.
 * It maintains backward compatibility with existing code while forwarding all actual
 * error handling logic to the unified error handler.
 * 
 * Changes:
 * - Uses the new unifiedErrorHandler for all core error handling functionality
 * - Maintains the same API for backward compatibility
 * - Adapts between the old error categorization and the new unified system
 * - Delegates to the new Result-based patterns
 */

import { useChatStore } from '@/stores/chat-store'
import { toast } from '@/components/ui/use-toast'
import { createBrowserClient } from '@/lib/supabase/clients'
import type { WorkflowStep } from '../types/workflow'
import { DomainOnlyWorkflowStep } from '../types/workflow'
import type { ApiClient } from '@/lib/api/client/api-client'
import type { Json } from '@/lib/types/database'
import { workflowService } from '@/lib/services/workflow/core/workflow-service'
import { Result, ResultError } from '@/lib/services/workflow/error/result'
import { 
  unifiedErrorHandler, 
  ErrorCategory, 
  ErrorSeverity, 
  ErrorContext, 
  RecoveryStrategy
} from '@/lib/services/workflow/error/unified-error-handler'
import { normalizeError } from '@/lib/errors'

/**
 * Error category for different workflow errors (legacy)
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
 * Full error information with context (legacy)
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

/**
 * Error metadata structure (legacy)
 */
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
 * Map legacy error types to new error categories
 */
function mapLegacyToNewCategory(
  legacyType: WorkflowErrorMetadata['errorType']
): ErrorCategory {
  switch (legacyType) {
    case 'validation':
      return ErrorCategory.VALIDATION;
    case 'network':
      return ErrorCategory.NETWORK;
    case 'permission':
      return ErrorCategory.PERMISSION;
    case 'timeout':
      return ErrorCategory.TIMEOUT;
    case 'system':
      return ErrorCategory.SYSTEM;
    case 'unknown':
    default:
      return ErrorCategory.UNKNOWN;
  }
}

/**
 * Map new error categories to legacy types
 */
function mapNewToLegacyType(
  category: ErrorCategory
): WorkflowErrorMetadata['errorType'] {
  switch (category) {
    case ErrorCategory.VALIDATION:
      return 'validation';
    case ErrorCategory.NETWORK:
      return 'network';
    case ErrorCategory.PERMISSION:
      return 'permission';
    case ErrorCategory.TIMEOUT:
      return 'timeout';
    case ErrorCategory.SYSTEM:
    case ErrorCategory.WORKFLOW:
    case ErrorCategory.TRANSACTION:
    case ErrorCategory.DATA:
    case ErrorCategory.CONCURRENCY:
      return 'system';
    case ErrorCategory.UNKNOWN:
    default:
      return 'unknown';
  }
}

/**
 * Map legacy workflow error category to new error category
 */
function mapWorkflowErrorCategory(
  category: WorkflowErrorCategory
): ErrorCategory {
  switch (category) {
    case WorkflowErrorCategory.NETWORK:
      return ErrorCategory.NETWORK;
    case WorkflowErrorCategory.PERMISSION:
      return ErrorCategory.PERMISSION;
    case WorkflowErrorCategory.UPLOAD:
    case WorkflowErrorCategory.PROCESSING:
      return ErrorCategory.DATA;
    case WorkflowErrorCategory.VERIFICATION:
    case WorkflowErrorCategory.REPORT:
      return ErrorCategory.WORKFLOW;
    case WorkflowErrorCategory.GENERIC:
    default:
      return ErrorCategory.UNKNOWN;
  }
}

/**
 * Create legacy error metadata from new error context
 */
function createLegacyErrorMetadata(
  error: ResultError,
  category: ErrorCategory,
  context: ErrorContext
): WorkflowErrorMetadata {
  return {
    errorMessage: error.message,
    originalError: error,
    errorCode: error.code,
    errorType: mapNewToLegacyType(category),
    workflowStep: context.workflowStep || 'error',
    previousStep: context.previousStep,
    recoveryPaths: unifiedErrorHandler.recovery.getRecoveryPaths(
      context.workflowStep || 'error',
      category
    ),
    timestamp: context.timestamp || new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    clientId: typeof localStorage !== 'undefined'
      ? localStorage.getItem('neuvia_client_id') ?? undefined
      : undefined,
    details: {
      ...context.metadata,
      ...(error.details || {})
    }
  };
}

/**
 * Create new error context from legacy error metadata
 */
function createErrorContext(
  metadata: WorkflowErrorMetadata
): ErrorContext {
  return {
    domain: metadata.details?.domain as string,
    workflowStep: metadata.workflowStep,
    previousStep: metadata.previousStep,
    workflowId: 
      (metadata.details?.workflowId as string) || 
      (typeof localStorage !== 'undefined' ? localStorage.getItem('current_workflow_id') : undefined),
    transactionId: metadata.details?.transactionId as string,
    timestamp: metadata.timestamp,
    userId: metadata.details?.userId as string,
    metadata: metadata.details,
  };
}

/**
 * WorkflowErrorHandler - UI adapter on top of unified error handler
 */
export class WorkflowErrorHandler {
  private apiClient: ApiClient | null = null

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient ?? null
    
    // Set up notifier for unified error handler
    unifiedErrorHandler.setNotifier(this.showErrorNotification.bind(this));
  }

  public setApiClient(apiClient: ApiClient) {
    this.apiClient = apiClient
  }

  /**
   * Notification handler for the unified error handler
   */
  private async showErrorNotification(
    error: unknown,
    context: ErrorContext
  ): Promise<void> {
    const normalizedError = normalizeError(error);
    const category = ErrorCategory.categorize(normalizedError, context);
    const severity = ErrorCategory.determineSeverity(category, context);
    
    // Only show toast for medium and high severity errors
    if (severity === ErrorSeverity.MEDIUM || 
        severity === ErrorSeverity.HIGH || 
        severity === ErrorSeverity.FATAL) {
      toast({
        title: this.getErrorTitle(category, severity),
        description: normalizedError.message,
        variant: severity === ErrorSeverity.FATAL ? 'destructive' : 
                (severity === ErrorSeverity.HIGH ? 'destructive' : 'default'),
      });
    }
    
    // Update UI state if we're in a browser context
    if (typeof window !== 'undefined') {
      const store = useChatStore.getState();
      
      if (store) {
        // Set error in store
        store.setError(normalizedError.message);
        
        // Update workflow step to error
        const errorStep = this.getDomainErrorStep(context.domain) || DomainOnlyWorkflowStep.ERROR;
        
        store.updateWorkflowStep(errorStep, {
          error: normalizedError.message,
          errorDetails: context.metadata,
          errorCategory: category,
          errorSeverity: severity,
          previousStep: context.workflowStep,
          recoveryPaths: unifiedErrorHandler.recovery.getRecoveryPaths(
            context.workflowStep || 'error',
            category
          ),
          domain: context.domain,
        });
      }
    }
  }

  /**
   * Get domain-specific error step
   */
  private getDomainErrorStep(domain?: string): WorkflowStep | undefined {
    if (!domain) return undefined;
    
    const domainErrorSteps: Record<string, WorkflowStep> = {
      'document': 'document_error',
      'verification': 'verification_failed',
      'chat': 'chat_error',
      'report': 'report_generation_error'
    };
    
    return domainErrorSteps[domain.toLowerCase()];
  }

  /**
   * Get user-friendly error title based on category and severity
   */
  private getErrorTitle(
    category: ErrorCategory,
    severity: ErrorSeverity
  ): string {
    // By category
    switch (category) {
      case ErrorCategory.NETWORK:
        return 'Network Error';
      case ErrorCategory.TIMEOUT:
        return 'Request Timeout';
      case ErrorCategory.PERMISSION:
        return 'Permission Error';
      case ErrorCategory.VALIDATION:
        return 'Validation Error';
      case ErrorCategory.WORKFLOW:
        return 'Workflow Error';
      case ErrorCategory.DATA:
        return 'Data Error';
    }
    
    // By severity
    switch (severity) {
      case ErrorSeverity.FATAL:
        return 'System Error';
      case ErrorSeverity.HIGH:
        return 'Critical Error';
      case ErrorSeverity.MEDIUM:
        return 'Warning';
      case ErrorSeverity.LOW:
        return 'Notice';
      default:
        return 'Error';
    }
  }

  /**
   * Normalizes an unknown error into a structured object
   * Delegates to unified error handler
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
    const normalizedError = normalizeError(error);
    const category = ErrorCategory.categorize(normalizedError);
    
    return {
      message: normalizedError.message || fallbackMessage,
      type: mapNewToLegacyType(category),
      code: normalizedError.code || 'UNKNOWN_ERROR',
      details: normalizedError.data || {},
    };
  }

  /**
   * Return possible recovery paths for a given step
   * Delegates to unified error handler
   */
  public getRecoveryPaths(currentStep: WorkflowStep): WorkflowStep[] {
    // Default category for unknown errors
    return unifiedErrorHandler.recovery.getRecoveryPaths(
      currentStep,
      ErrorCategory.UNKNOWN
    );
  }

  /**
   * Build error metadata with normalization
   * Adapts to the unified error handler pattern
   */
  public createErrorMetadata(
    error: unknown,
    workflowStep: WorkflowStep,
    previousStep?: WorkflowStep,
    details?: Record<string, unknown>
  ): WorkflowErrorMetadata {
    // Create context for the unified error handler
    const context: ErrorContext = {
      workflowStep,
      previousStep,
      domain: details?.domain as string,
      workflowId: details?.workflowId as string,
      transactionId: details?.transactionId as string,
      metadata: details,
      timestamp: new Date().toISOString(),
    };
    
    // Get normalized error
    const normalizedError = normalizeError(error);
    
    // Get category from the unified error handler
    const category = ErrorCategory.categorize(normalizedError, context);
    
    // Create metadata using the unified pattern but return in legacy format
    return createLegacyErrorMetadata(
      normalizedError as ResultError,
      category,
      context
    );
  }

  /**
   * Log error to console, and attempt storing in DB if possible
   * Delegates to unified error handler
   */
  public async logError(metadata: WorkflowErrorMetadata): Promise<void> {
    // Create context for the unified error handler
    const context = createErrorContext(metadata);
    
    // Create ResultError from legacy metadata
    const resultError: ResultError = {
      message: metadata.errorMessage,
      code: metadata.errorCode || 'UNKNOWN_ERROR',
      details: metadata.details
    };
    
    // Log using unified error handler
    const category = ErrorCategory.categorize(resultError, context);
    const severity = ErrorCategory.determineSeverity(category, context);
    
    unifiedErrorHandler.logError(resultError, category, severity, context);
  }

  /**
   * Attempt automated recovery
   * Delegates to unified error handler
   */
  public async attemptRecovery(metadata: WorkflowErrorMetadata): Promise<Result<boolean>> {
    try {
      // Create context for unified error handler
      const context = createErrorContext(metadata);
      
      // Map legacy error type to new category
      const category = mapLegacyToNewCategory(metadata.errorType);
      
      // Attempt recovery using unified error handler
      const recoveryResult = await unifiedErrorHandler.recovery.attemptRecovery(
        { message: metadata.errorMessage, code: metadata.errorCode || 'UNKNOWN_ERROR' },
        context,
        {
          workflowId: context.workflowId,
          transactionId: context.transactionId,
          notify: true
        }
      );
      
      // Map result back to legacy format
      if (recoveryResult.isSuccess()) {
        return Result.success(recoveryResult.value.success);
      } else {
        return Result.failure(
          recoveryResult.error.message,
          recoveryResult.error.code,
          recoveryResult.error.details
        );
      }
    } catch (error) {
      const normalizedError = normalizeError(error);
      return Result.failure(
        `Recovery attempt failed: ${normalizedError.message}`,
        'RECOVERY_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Clear error from state
   */
  public clearError(returnToStep?: WorkflowStep): void {
    const store = useChatStore.getState();
    store.setError(null);
    
    if (returnToStep) {
      store.updateWorkflowStep(returnToStep, {});
    }
  }

  /**
   * Handle an error end-to-end: log, update store, optionally recover
   * Delegates to unified error handler
   */
  public async handleError(
    error: unknown,
    currentStep: WorkflowStep,
    options?: {
      previousStep?: WorkflowStep;
      details?: Record<string, unknown>;
      showToast?: boolean;
      attemptRecovery?: boolean;
      workflowId?: string;
    }
  ): Promise<Result<WorkflowErrorMetadata>> {
    try {
      // Create context for unified error handler
      const context: ErrorContext = {
        workflowStep: currentStep,
        previousStep: options?.previousStep,
        workflowId: options?.workflowId || 
          (typeof localStorage !== 'undefined' ? localStorage.getItem('current_workflow_id') : undefined),
        metadata: options?.details,
        timestamp: new Date().toISOString(),
      };
      
      // Map recovery strategy
      const strategy = options?.attemptRecovery
        ? RecoveryStrategy.RETRY
        : RecoveryStrategy.NONE;
      
      // Use unified error handler
      const result = await unifiedErrorHandler.handleError(
        error,
        context,
        {
          log: true,
          updateWorkflowState: true,
          notify: options?.showToast !== false,
          attemptRecovery: options?.attemptRecovery,
          recoveryOptions: {
            workflowId: context.workflowId,
            strategy,
            fallbackStrategies: [
              RecoveryStrategy.FALLBACK,
              RecoveryStrategy.DELEGATE
            ]
          }
        }
      );
      
      // Convert result to legacy format
      if (result.isSuccess()) {
        // Create legacy metadata from result
        const legacyMetadata = createLegacyErrorMetadata(
          normalizeError(error) as ResultError,
          result.value.category,
          context
        );
        
        return Result.success(legacyMetadata);
      } else {
        // Handle failure
        return Result.failure(
          result.error.message,
          result.error.code,
          result.error.details
        );
      }
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
  const handler = new WorkflowErrorHandler(apiClient);
  return handler;
}