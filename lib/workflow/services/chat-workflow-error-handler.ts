/**
 * @fileoverview Chat Workflow Error Handler
 * 
 * PHASE 4 IMPLEMENTATION:
 * This file now serves as an adapter between the chat-specific error handling
 * and the unified error handling system. It delegates core functionality to
 * the unified error handler while maintaining the same API for backward compatibility.
 * 
 * All UI logic has already been moved to ChatService:
 * - ChatService.handleWorkflowError()
 * - ChatService.notifyWorkflowRecovery()
 * - ChatService.handleErrorMessageCreation()
 */

import { normalizeError } from '@/lib/errors'
import { DomainOnlyWorkflowStep, WorkflowStep } from '@/lib/types/workflow'
import { workflowServiceFactory } from './workflow-service-factory'
import { chatService } from '@/lib/services/chat/chat-service'
import { 
  unifiedErrorHandler, 
  ErrorCategory, 
  ErrorContext as UnifiedErrorContext,
  RecoveryStrategy
} from '@/lib/services/workflow/error/unified-error-handler'

// Legacy error categories (for backward compatibility)
export enum ErrorCategory {
  NETWORK = 'network',
  PERMISSION = 'permission',
  VALIDATION = 'validation',
  PROCESSING = 'processing',
  VERIFICATION = 'verification',
  REPORT = 'report',
  GENERAL = 'general',
}

// Legacy error context (for backward compatibility)
export interface ErrorContext {
  step?: WorkflowStep
  domain?: 'document' | 'verification' | 'report' | 'general'
  previousStep?: WorkflowStep
  details?: Record<string, unknown>
  userId?: string
  chatId?: string
  workflowId?: string
}

// Legacy error metadata (for backward compatibility)
export interface ErrorMetadata {
  message: string
  category: ErrorCategory
  timestamp: string
  details?: Record<string, unknown>
  recoveryPaths: WorkflowStep[]
  retryable: boolean
  errorId: string
}

// Legacy function types (for backward compatibility)
export type ErrorMessageFunction = (error: string, context?: Record<string, unknown>) => string
export type AddSystemMessageFunction = (
  content: string,
  type: string,
  metadata?: Record<string, unknown>
) => void

/**
 * Map legacy error categories to new unified error categories
 */
function mapLegacyToUnifiedCategory(category: ErrorCategory): UnifiedErrorCategory {
  switch (category) {
    case ErrorCategory.NETWORK:
      return UnifiedErrorCategory.NETWORK;
    case ErrorCategory.PERMISSION:
      return UnifiedErrorCategory.PERMISSION;
    case ErrorCategory.VALIDATION:
      return UnifiedErrorCategory.VALIDATION;
    case ErrorCategory.PROCESSING:
      return UnifiedErrorCategory.DATA;
    case ErrorCategory.VERIFICATION:
    case ErrorCategory.REPORT:
      return UnifiedErrorCategory.WORKFLOW;
    case ErrorCategory.GENERAL:
    default:
      return UnifiedErrorCategory.UNKNOWN;
  }
}

/**
 * Map unified error categories to legacy error categories
 */
function mapUnifiedToLegacyCategory(category: UnifiedErrorCategory): ErrorCategory {
  switch (category) {
    case UnifiedErrorCategory.NETWORK:
      return ErrorCategory.NETWORK;
    case UnifiedErrorCategory.PERMISSION:
      return ErrorCategory.PERMISSION;
    case UnifiedErrorCategory.VALIDATION:
      return ErrorCategory.VALIDATION;
    case UnifiedErrorCategory.DATA:
      return ErrorCategory.PROCESSING;
    case UnifiedErrorCategory.WORKFLOW:
      return ErrorCategory.VERIFICATION;
    case UnifiedErrorCategory.TRANSACTION:
    case UnifiedErrorCategory.CONCURRENCY:
    case UnifiedErrorCategory.SYSTEM:
      return ErrorCategory.GENERAL;
    case UnifiedErrorCategory.TIMEOUT:
      return ErrorCategory.NETWORK;
    case UnifiedErrorCategory.UNKNOWN:
    default:
      return ErrorCategory.GENERAL;
  }
}

/**
 * Convert legacy error context to unified error context
 */
function toUnifiedErrorContext(context?: ErrorContext): UnifiedErrorContext {
  if (!context) {
    return {
      timestamp: new Date().toISOString()
    };
  }
  
  return {
    domain: context.domain,
    workflowStep: context.step,
    previousStep: context.previousStep,
    workflowId: context.workflowId,
    userId: context.userId,
    metadata: {
      ...context.details,
      chatId: context.chatId
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Chat workflow error handler class
 * Acts as an adapter to the unified error handling system
 */
export class ChatWorkflowErrorHandler {
  private readonly errorMessageFunction: ErrorMessageFunction
  private readonly addSystemMessageFunction: AddSystemMessageFunction
  
  constructor(
    errorMessageFunction: ErrorMessageFunction,
    addSystemMessageFunction: AddSystemMessageFunction
  ) {
    this.errorMessageFunction = errorMessageFunction
    this.addSystemMessageFunction = addSystemMessageFunction
  }
  
  /**
   * Handle a workflow error and integrate with chat UI
   * Delegates to the unified error handler
   */
  async handleError(
    error: Error | unknown,
    context?: ErrorContext
  ): Promise<ErrorMetadata> {
    // Create unified error context
    const unifiedContext = toUnifiedErrorContext(context);
    
    // Get normalized error
    const normalizedError = normalizeError(error);
    
    // Use unified error handler for categorization
    const category = unifiedErrorHandler.categorize(normalizedError, unifiedContext);
    const legacyCategory = mapUnifiedToLegacyCategory(category);
    
    // Get recovery paths
    const recoveryPaths = unifiedErrorHandler.recovery.getRecoveryPaths(
      unifiedContext.workflowStep || 'error',
      category
    );
    
    // Check if error is retryable
    const retryable = unifiedErrorHandler.isRetryable(category, normalizedError, unifiedContext);
    
    // Format message 
    const formattedMessage = this.formatErrorMessage(normalizedError, legacyCategory);
    
    // Create error metadata
    const errorMetadata: ErrorMetadata = {
      message: formattedMessage,
      category: legacyCategory,
      timestamp: new Date().toISOString(),
      details: context?.details,
      recoveryPaths,
      retryable,
      errorId: crypto.randomUUID()
    };
    
    // Log the error using unified error handler
    unifiedErrorHandler.logError(
      normalizedError,
      category,
      unifiedErrorHandler.determineSeverity(category, unifiedContext),
      unifiedContext
    );
    
    // Update service state
    await this.updateServiceState(normalizedError.message, context);
    
    // Delegate error message creation to chatService
    if (context?.chatId) {
      await chatService.handleWorkflowError(
        context.chatId, 
        {
          message: formattedMessage,
          category: legacyCategory,
          timestamp: errorMetadata.timestamp,
          recoveryPaths: recoveryPaths.map(p => p.toString()),
          retryable,
          details: context?.details
        }
      );
    } else {
      // For backward compatibility, use the provided function if no chatId
      this.addSystemMessageFunction(
        this.errorMessageFunction(formattedMessage, errorMetadata),
        'error',
        {
          isError: true,
          errorCategory: legacyCategory,
          errorTimestamp: errorMetadata.timestamp,
          errorRetryable: retryable,
          errorRecoveryPaths: recoveryPaths,
          errorDetails: context?.details,
          errorId: errorMetadata.errorId
        }
      );
    }
    
    return errorMetadata;
  }
  
  /**
   * Format a user-friendly error message based on the error and category
   */
  private formatErrorMessage(
    error: Error | string,
    category: ErrorCategory
  ): string {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    // Format based on category
    switch (category) {
      case ErrorCategory.NETWORK:
        return `Network error: ${errorMessage}. Please check your connection and try again.`;
        
      case ErrorCategory.PERMISSION:
        return `Permission error: ${errorMessage}. You may not have access to this resource.`;
        
      case ErrorCategory.VALIDATION:
        return `Validation error: ${errorMessage}. Please check your input and try again.`;
        
      case ErrorCategory.PROCESSING:
        return `Processing error: ${errorMessage}. There was a problem processing your document.`;
        
      case ErrorCategory.VERIFICATION:
        return `Verification error: ${errorMessage}. There was a problem with the verification process.`;
        
      case ErrorCategory.REPORT:
        return `Report generation error: ${errorMessage}. There was a problem generating your report.`;
        
      default:
        return `Error: ${errorMessage}`;
    }
  }
  
  /**
   * Attempt to recover from an error
   * Delegates to the unified error handler's recovery system
   */
  async recoverFromError(
    recoveryPath: WorkflowStep,
    context?: ErrorContext
  ): Promise<boolean> {
    if (!context) {
      console.error('Cannot recover without context');
      return false;
    }
    
    // Create unified error context
    const unifiedContext = toUnifiedErrorContext(context);
    
    try {
      // Use the unified error handler's recovery system
      const result = await unifiedErrorHandler.recovery.attemptRecovery(
        { message: "Recovery requested", code: "RECOVERY_REQUESTED" },
        unifiedContext,
        {
          targetStep: recoveryPath,
          strategy: RecoveryStrategy.RESET,
          fallbackStrategies: [RecoveryStrategy.RETRY, RecoveryStrategy.DELEGATE],
          workflowId: unifiedContext.workflowId,
          notify: true
        }
      );
      
      // If recovery succeeded, notify chat service
      if (result.isSuccess() && result.value.success) {
        // Notify chat service
        if (context.chatId) {
          await chatService.notifyWorkflowRecovery(
            context.chatId,
            recoveryPath.toString(),
            new Date().toISOString()
          );
        } else {
          // For backward compatibility, use the provided function if no chatId
          this.addSystemMessageFunction(
            `Recovering workflow to ${recoveryPath.replace(/_/g, ' ')} state.`,
            'system',
            {
              isRecovery: true,
              recoveryPath,
              recoveryTimestamp: new Date().toISOString()
            }
          );
        }
        
        return true;
      } else {
        // Recovery failed
        const error = result.isSuccess() 
          ? result.value.error 
          : { message: result.error.message };
          
        // Notify failure
        if (context.chatId) {
          await chatService.notifyWorkflowRecoveryFailure(
            context.chatId,
            error
          );
        } else {
          // For backward compatibility
          this.addSystemMessageFunction(
            `Failed to recover workflow: ${error.message}`,
            'error',
            {
              isError: true,
              isRecoveryFailure: true
            }
          );
        }
        
        return false;
      }
    } catch (error) {
      console.error('Error during recovery:', error);
      
      // Notify failure
      if (context.chatId) {
        await chatService.notifyWorkflowRecoveryFailure(
          context.chatId,
          error
        );
      } else {
        // For backward compatibility
        this.addSystemMessageFunction(
          `Failed to recover workflow: ${error instanceof Error ? error.message : String(error)}`,
          'error',
          {
            isError: true,
            isRecoveryFailure: true
          }
        );
      }
      
      return false;
    }
  }
  
  /**
   * Update service state to reflect error
   * This is kept for backward compatibility but delegates to the unified
   * error handling system where possible
   */
  private async updateServiceState(
    errorMessage: string,
    context?: ErrorContext
  ): Promise<void> {
    if (!context) return;
    
    try {
      // Create unified error context
      const unifiedContext = toUnifiedErrorContext(context);
      
      // If we have a workflowId, use unified error handler
      if (unifiedContext.workflowId) {
        await unifiedErrorHandler.updateWorkflowErrorState(
          { message: errorMessage, code: "ERROR" },
          UnifiedErrorCategory.categorize({ message: errorMessage }),
          unifiedContext
        );
        return;
      }
      
      // Otherwise, fall back to legacy approach
      // Determine which service to update based on context
      if (context.domain === 'document' || (
        context.step && ['uploading', 'extracting'].includes(context.step)
      )) {
        // Document domain
        const documentService = workflowServiceFactory.getDocumentWorkflowService(
          context.userId,
          context.chatId
        );
        
        // Update document service state to error
        documentService.updateStep(DomainOnlyWorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
          errorDetails: context.details
        }).catch(console.error);
      } else if (context.domain === 'verification' || (
        context.step && ['verification', 'verification_pending', 'verification_in_progress'].includes(context.step)
      )) {
        // Verification domain
        const verificationService = workflowServiceFactory.getVerificationWorkflowService(
          context.userId,
          context.chatId
        );
        
        // Update verification service state to error
        verificationService.updateStep(DomainOnlyWorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
          errorDetails: context.details
        }).catch(console.error);
      } else if (context.domain === 'report' || (
        context.step && ['report_generation'].includes(context.step)
      )) {
        // Report domain
        const reportService = workflowServiceFactory.getReportWorkflowService(
          context.userId,
          context.chatId
        );
        
        // Update report service state to error
        reportService.updateStep(DomainOnlyWorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
          errorDetails: context.details
        }).catch(console.error);
      } else {
        // Update all services as a fallback
        ['document', 'verification', 'report'].forEach(domain => {
          try {
            let service;
            
            if (domain === 'document') {
              service = workflowServiceFactory.getDocumentWorkflowService(
                context.userId,
                context.chatId
              );
            } else if (domain === 'verification') {
              service = workflowServiceFactory.getVerificationWorkflowService(
                context.userId,
                context.chatId
              );
            } else if (domain === 'report') {
              service = workflowServiceFactory.getReportWorkflowService(
                context.userId,
                context.chatId
              );
            }
            
            if (service) {
              service.updateStep(DomainOnlyWorkflowStep.ERROR, {
                error: errorMessage,
                errorTimestamp: new Date().toISOString(),
                errorDetails: context.details
              }).catch(console.error);
            }
          } catch (err) {
            console.error(`Error updating ${domain} service:`, err);
          }
        });
      }
    } catch (err) {
      console.error('Error updating service state:', err);
    }
  }
}