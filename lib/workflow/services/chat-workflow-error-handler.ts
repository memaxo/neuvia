/**
 * @fileoverview Chat Workflow Error Handler
 * 
 * A specialized error handler for workflow errors that integrates with the chat UI.
 * This handler provides methods for formatting error messages, recovering from errors,
 * and displaying appropriate UI feedback.
 */

import { ApplicationError, normalizeError } from '@/lib/errors'
import { DomainOnlyWorkflowStep, ProcessingPhase, WorkflowStep } from '@/lib/types/workflow'
import { workflowServiceFactory } from './workflow-service-factory'

export enum ErrorCategory {
  NETWORK = 'network',
  PERMISSION = 'permission',
  VALIDATION = 'validation',
  PROCESSING = 'processing',
  VERIFICATION = 'verification',
  REPORT = 'report',
  GENERAL = 'general',
}

export interface ErrorContext {
  step?: WorkflowStep
  domain?: 'document' | 'verification' | 'report' | 'general'
  previousStep?: WorkflowStep
  details?: Record<string, unknown>
  userId?: string
  chatId?: string
  workflowId?: string
}

export interface ErrorMetadata {
  message: string
  category: ErrorCategory
  timestamp: string
  details?: Record<string, unknown>
  recoveryPaths: WorkflowStep[]
  retryable: boolean
  errorId: string
}

export type ErrorMessageFunction = (error: string, context?: Record<string, unknown>) => string

export type AddSystemMessageFunction = (
  content: string,
  type: string,
  metadata?: Record<string, unknown>
) => void

// Map of error patterns to categories
const ERROR_CATEGORY_PATTERNS: Record<ErrorCategory, RegExp[]> = {
  [ErrorCategory.NETWORK]: [
    /network/i,
    /connection/i,
    /timeout/i,
    /offline/i,
    /unreachable/i,
  ],
  [ErrorCategory.PERMISSION]: [
    /permission/i,
    /forbidden/i,
    /unauthorized/i,
    /access denied/i,
  ],
  [ErrorCategory.VALIDATION]: [
    /validation/i,
    /invalid/i,
    /required/i,
    /missing/i,
    /schema/i,
  ],
  [ErrorCategory.PROCESSING]: [
    /process/i,
    /extraction/i,
    /parse/i,
    /format/i,
  ],
  [ErrorCategory.VERIFICATION]: [
    /verification/i,
    /verify/i,
    /correct/i,
  ],
  [ErrorCategory.REPORT]: [
    /report/i,
    /generation/i,
    /format/i,
  ],
  [ErrorCategory.GENERAL]: [
    /.*/,
  ],
}

/**
 * Determine the error category based on the error message and context
 */
function determineErrorCategory(
  error: Error | string,
  context?: ErrorContext
): ErrorCategory {
  const errorMessage = typeof error === 'string' ? error : error.message
  
  // First check the domain from context
  if (context?.domain) {
    switch (context.domain) {
      case 'document':
        return ErrorCategory.PROCESSING
      case 'verification':
        return ErrorCategory.VERIFICATION
      case 'report':
        return ErrorCategory.REPORT
    }
  }
  
  // Check the step from context
  if (context?.step) {
    const step = context.step
    
    if (step === 'uploading' || step === 'extracting') {
      return ErrorCategory.PROCESSING
    } else if (
      step === 'verification' ||
      step === 'verification_pending' ||
      step === 'verification_in_progress'
    ) {
      return ErrorCategory.VERIFICATION
    } else if (step === 'report_generation') {
      return ErrorCategory.REPORT
    }
  }
  
  // Check the error message against patterns
  for (const [category, patterns] of Object.entries(ERROR_CATEGORY_PATTERNS)) {
    if (category === ErrorCategory.GENERAL) continue // Skip general category for now
    
    for (const pattern of patterns) {
      if (pattern.test(errorMessage)) {
        return category as ErrorCategory
      }
    }
  }
  
  // Default to general category
  return ErrorCategory.GENERAL
}

/**
 * Get appropriate recovery paths based on error and context
 */
function getRecoveryPaths(
  error: Error | string,
  category: ErrorCategory,
  context?: ErrorContext
): WorkflowStep[] {
  // Always include these basic recovery options
  const basicPaths: WorkflowStep[] = ['idle']
  
  // Add context-specific recovery paths
  if (context?.previousStep) {
    basicPaths.push(context.previousStep)
  }
  
  // Add category-specific recovery paths
  switch (category) {
    case ErrorCategory.NETWORK:
      // Network errors can usually be retried from the same step
      if (context?.step && context.step !== 'error') {
        basicPaths.push(context.step)
      }
      break
      
    case ErrorCategory.PROCESSING:
      // For processing errors, we can retry the upload or extraction
      basicPaths.push('uploading')
      if (context?.previousStep === 'extracting') {
        basicPaths.push('extracting')
      }
      break
      
    case ErrorCategory.VERIFICATION:
      // For verification errors, we can retry verification
      basicPaths.push('verification')
      break
      
    case ErrorCategory.REPORT:
      // For report generation errors, we can retry report generation
      basicPaths.push('report_generation')
      break
  }
  
  // Remove duplicates and ensure 'idle' is always an option
  return [...new Set(['idle', ...basicPaths])] as WorkflowStep[]
}

/**
 * Format a user-friendly error message based on the error and category
 */
function formatErrorMessage(
  error: Error | string,
  category: ErrorCategory
): string {
  const errorMessage = typeof error === 'string' ? error : error.message
  
  // Format based on category
  switch (category) {
    case ErrorCategory.NETWORK:
      return `Network error: ${errorMessage}. Please check your connection and try again.`
      
    case ErrorCategory.PERMISSION:
      return `Permission error: ${errorMessage}. You may not have access to this resource.`
      
    case ErrorCategory.VALIDATION:
      return `Validation error: ${errorMessage}. Please check your input and try again.`
      
    case ErrorCategory.PROCESSING:
      return `Processing error: ${errorMessage}. There was a problem processing your document.`
      
    case ErrorCategory.VERIFICATION:
      return `Verification error: ${errorMessage}. There was a problem with the verification process.`
      
    case ErrorCategory.REPORT:
      return `Report generation error: ${errorMessage}. There was a problem generating your report.`
      
    default:
      return `Error: ${errorMessage}`
  }
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(
  error: Error | string,
  category: ErrorCategory
): boolean {
  // Network errors are usually retryable
  if (category === ErrorCategory.NETWORK) {
    return true
  }
  
  // Permission errors are not retryable
  if (category === ErrorCategory.PERMISSION) {
    return false
  }
  
  // Check error message for indicators
  const errorMessage = typeof error === 'string' ? error : error.message
  
  // Non-retryable patterns
  const nonRetryablePatterns = [
    /not found/i,
    /invalid token/i,
    /unauthorized/i,
    /permission denied/i,
    /unsupported/i,
    /malformed/i,
  ]
  
  for (const pattern of nonRetryablePatterns) {
    if (pattern.test(errorMessage)) {
      return false
    }
  }
  
  // Default to retryable
  return true
}

/**
 * Chat workflow error handler class
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
   */
  handleError(
    error: Error | unknown,
    context?: ErrorContext
  ): ErrorMetadata {
    // Normalize the error
    const normalizedError = normalizeError(error)
    
    // Determine the error category
    const category = determineErrorCategory(normalizedError, context)
    
    // Get recovery paths
    const recoveryPaths = getRecoveryPaths(normalizedError, category, context)
    
    // Format a user-friendly error message
    const formattedMessage = formatErrorMessage(normalizedError, category)
    
    // Check if error is retryable
    const retryable = isRetryableError(normalizedError, category)
    
    // Create error metadata
    const errorMetadata: ErrorMetadata = {
      message: formattedMessage,
      category,
      timestamp: new Date().toISOString(),
      details: context?.details,
      recoveryPaths,
      retryable,
      errorId: crypto.randomUUID()
    }
    
    // Log the error
    console.error('Workflow error:', {
      error: normalizedError,
      category,
      context,
    })
    
    // Update service state to reflect error
    this.updateServiceState(normalizedError.message, context)
    
    // Add a system message for the error
    this.addSystemMessageFunction(
      this.errorMessageFunction(formattedMessage, errorMetadata),
      'error',
      {
        isError: true,
        errorCategory: category,
        errorTimestamp: errorMetadata.timestamp,
        errorRetryable: retryable,
        errorRecoveryPaths: recoveryPaths,
        errorDetails: context?.details,
        errorId: errorMetadata.errorId
      }
    )
    
    return errorMetadata
  }
  
  /**
   * Attempt to recover from an error
   */
  async recoverFromError(
    recoveryPath: WorkflowStep,
    context?: ErrorContext
  ): Promise<boolean> {
    if (!context) {
      console.error('Cannot recover without context')
      return false
    }
    
    try {
      // Get the appropriate service based on the recovery path
      if (
        recoveryPath === 'uploading' ||
        recoveryPath === 'extracting' ||
        recoveryPath === 'idle'
      ) {
        // Document domain
        const documentService = workflowServiceFactory.getDocumentWorkflowService(
          context.userId,
          context.chatId
        )
        
        // Update step in document service
        await documentService.updateStep(recoveryPath, {
          recoveryAttempt: true,
          recoveryTimestamp: new Date().toISOString(),
          error: null // Clear error
        })
      } else if (
        recoveryPath === 'verification' ||
        recoveryPath === 'verification_pending' ||
        recoveryPath === 'verification_in_progress'
      ) {
        // Verification domain
        const verificationService = workflowServiceFactory.getVerificationWorkflowService(
          context.userId,
          context.chatId
        )
        
        // Update step in verification service
        await verificationService.updateStep(recoveryPath, {
          recoveryAttempt: true,
          recoveryTimestamp: new Date().toISOString(),
          error: null // Clear error
        })
      } else if (
        recoveryPath === 'report_generation'
      ) {
        // Report domain
        const reportService = workflowServiceFactory.getReportWorkflowService(
          context.userId,
          context.chatId
        )
        
        // Update step in report service
        await reportService.updateStep(recoveryPath, {
          recoveryAttempt: true,
          recoveryTimestamp: new Date().toISOString(),
          error: null // Clear error
        })
      } else {
        // General recovery - reset all services
        if (context.domain === 'document') {
          const documentService = workflowServiceFactory.getDocumentWorkflowService(
            context.userId,
            context.chatId
          )
          await documentService.resetDocumentWorkflow()
        } else if (context.domain === 'verification') {
          const verificationService = workflowServiceFactory.getVerificationWorkflowService(
            context.userId,
            context.chatId
          )
          await verificationService.resetVerification()
        } else if (context.domain === 'report') {
          const reportService = workflowServiceFactory.getReportWorkflowService(
            context.userId,
            context.chatId
          )
          await reportService.resetReportWorkflow()
        } else {
          // Reset all services
          const documentService = workflowServiceFactory.getDocumentWorkflowService(
            context.userId,
            context.chatId
          )
          await documentService.resetDocumentWorkflow()
          
          const verificationService = workflowServiceFactory.getVerificationWorkflowService(
            context.userId,
            context.chatId
          )
          await verificationService.resetVerification()
          
          const reportService = workflowServiceFactory.getReportWorkflowService(
            context.userId,
            context.chatId
          )
          await reportService.resetReportWorkflow()
        }
      }
      
      // Add a system message about recovery
      this.addSystemMessageFunction(
        `Recovering workflow to ${recoveryPath.replace(/_/g, ' ')} state.`,
        'system',
        {
          isRecovery: true,
          recoveryPath,
          recoveryTimestamp: new Date().toISOString()
        }
      )
      
      return true
    } catch (error) {
      console.error('Error during recovery:', error)
      
      // Add a system message about recovery failure
      this.addSystemMessageFunction(
        `Failed to recover workflow: ${error instanceof Error ? error.message : String(error)}`,
        'error',
        {
          isError: true,
          isRecoveryFailure: true
        }
      )
      
      return false
    }
  }
  
  /**
   * Update service state to reflect error
   */
  private updateServiceState(
    errorMessage: string,
    context?: ErrorContext
  ): void {
    if (!context) return
    
    try {
      // Determine which service to update based on context
      if (context.domain === 'document' || (
        context.step && ['uploading', 'extracting'].includes(context.step)
      )) {
        // Document domain
        const documentService = workflowServiceFactory.getDocumentWorkflowService(
          context.userId,
          context.chatId
        )
        
        // Update document service state to error
        documentService.updateStep(DomainOnlyWorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
          errorDetails: context.details
        }).catch(console.error)
      } else if (context.domain === 'verification' || (
        context.step && ['verification', 'verification_pending', 'verification_in_progress'].includes(context.step)
      )) {
        // Verification domain
        const verificationService = workflowServiceFactory.getVerificationWorkflowService(
          context.userId,
          context.chatId
        )
        
        // Update verification service state to error
        verificationService.updateStep(DomainOnlyWorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
          errorDetails: context.details
        }).catch(console.error)
      } else if (context.domain === 'report' || (
        context.step && ['report_generation'].includes(context.step)
      )) {
        // Report domain
        const reportService = workflowServiceFactory.getReportWorkflowService(
          context.userId,
          context.chatId
        )
        
        // Update report service state to error
        reportService.updateStep(DomainOnlyWorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
          errorDetails: context.details
        }).catch(console.error)
      } else {
        // Update all services as a fallback
        ['document', 'verification', 'report'].forEach(domain => {
          try {
            let service
            
            if (domain === 'document') {
              service = workflowServiceFactory.getDocumentWorkflowService(
                context.userId,
                context.chatId
              )
            } else if (domain === 'verification') {
              service = workflowServiceFactory.getVerificationWorkflowService(
                context.userId,
                context.chatId
              )
            } else if (domain === 'report') {
              service = workflowServiceFactory.getReportWorkflowService(
                context.userId,
                context.chatId
              )
            }
            
            if (service) {
              service.updateStep(DomainOnlyWorkflowStep.ERROR, {
                error: errorMessage,
                errorTimestamp: new Date().toISOString(),
                errorDetails: context.details
              }).catch(console.error)
            }
          } catch (err) {
            console.error(`Error updating ${domain} service:`, err)
          }
        })
      }
    } catch (err) {
      console.error('Error updating service state:', err)
    }
  }
}