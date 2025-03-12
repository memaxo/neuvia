import { useChatStore } from '@/stores/chat-store'
import { toast } from '@/components/ui/use-toast'
import { createBrowserClient } from '@/lib/supabase/clients'
import type { WorkflowStep } from '../types/workflow'
import { DomainOnlyWorkflowStep } from '../types/workflow'
import type { ApiClient } from '@/lib/api/client/api-client'
import type { Json } from '@/lib/types/database'
import { workflowService } from '@/lib/services/workflow/core/workflow-service'
import { WorkflowErrorContextBuilder } from '@/lib/services/workflow/error-context'

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
   */
  public getRecoveryPaths(currentStep: WorkflowStep): WorkflowStep[] {
    switch (currentStep) {
      case 'uploading':
        return ['idle', 'uploading']
      case 'extracting':
        return ['idle', 'uploading', 'extracting']
      case 'verification':
      case 'verification_pending':
      case 'verification_in_progress':
      case 'verification_completed':
      case 'verification_failed':
        return ['verification', 'verification_in_progress']
      case 'report_generation':
        return ['verification_completed', 'report_generation']
      case 'chat_started':
      case 'chat_in_progress':
      case 'chat_completed':
        return ['chat_started', 'chat_in_progress']
      case 'complete':
        return ['idle', 'complete']
      case DomainOnlyWorkflowStep.RESEARCH:
        return [DomainOnlyWorkflowStep.RESEARCH, 'report_generation']
      case DomainOnlyWorkflowStep.REPORT_PRESENTATION:
        return [DomainOnlyWorkflowStep.REPORT_PRESENTATION, 'complete']
      case DomainOnlyWorkflowStep.ERROR:
      case 'chat_error':
      default:
        // The default fallback is to just reset or remain on error
        return ['idle']
    }
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
   * Attempt automated recovery using the workflow service
   */
  public async attemptRecovery(metadata: WorkflowErrorMetadata): Promise<boolean> {
    // Get workflowId from localStorage or metadata
    const workflowId = 
      metadata.details?.workflowId as string || 
      (typeof localStorage !== 'undefined' ? localStorage.getItem('current_workflow_id') : null)
    
    // Try database recovery first if workflowId is available
    if (workflowId) {
      try {
        const recoverySuccess = await this.recoverWithDatabaseFunction(workflowId, metadata)
        if (recoverySuccess) {
          return true
        }
      } catch (dbError) {
        console.error('Database recovery failed, falling back to in-memory recovery:', dbError)
      }
    }
    
    // Fall back to memory-based recovery
    if (metadata.errorType === 'network') {
      // Wait 2 seconds for network errors, then try recovery
      return await new Promise((resolve) => {
        setTimeout(() => {
          void (async () => {
            const result = await this.recoverFromError(
              metadata.previousStep ?? 'idle',
              metadata
            )
            resolve(result)
          })()
        }, 2000)
      })
    }
    
    return this.recoverFromError(metadata.previousStep ?? 'idle', metadata)
  }
  
  /**
   * Recover using the workflow service's recovery function
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
          : metadata.previousStep || 'idle'
      
      // Call the database recovery function
      const success = await workflowService.recoverWorkflowState(
        workflowId,
        recoveryStep,
        {
          error: metadata.errorMessage,
          errorType: metadata.errorType,
          errorCode: metadata.errorCode,
          errorTimestamp: metadata.timestamp,
          originalStep: metadata.workflowStep,
          recoveryDetails: metadata.details || {}
        }
      )
      
      if (success) {
        // Update local state to match recovered state
        const store = useChatStore.getState()
        store.resetError()
        store.updateWorkflowStep(recoveryStep, {
          recoveredAt: new Date().toISOString(),
          recoveredFrom: metadata.workflowStep,
          isRecovery: true
        })
        
        return true
      }
      
      return false
    } catch (error) {
      console.error('Error during database recovery attempt:', error)
      return false
    }
  }

  /**
   * Provide a function for recovering from an error to a specified stage
   * Uses the chat store for UI state management
   */
  public async recoverFromError(
    targetStage: WorkflowStep,
    metadata: WorkflowErrorMetadata
  ): Promise<boolean> {
    const store = useChatStore.getState()
    
    try {
      switch (targetStage) {
        case 'idle':
          store.resetChat()
          store.updateWorkflowStep('idle', {})
          store.setError(null)
          return true

        case 'uploading': {
          const currentUpload = metadata.details?.file
          if (currentUpload === null || currentUpload === undefined) {
            return false
          }
          store.setError(null)
          const rawRetryCount = metadata.details?.retryCount
          const retryCount = typeof rawRetryCount === 'number' ? rawRetryCount : 0
          store.updateWorkflowStep('uploading', {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: retryCount + 1,
          })
          return true
        }

        case 'extracting': {
          const documentId = metadata.details?.documentId
          if (documentId === null || documentId === undefined) {
            return false
          }
          store.setError(null)
          const rawRetryCount = metadata.details?.retryCount
          const retryCount = typeof rawRetryCount === 'number' ? rawRetryCount : 0
          store.updateWorkflowStep('extracting', {
            isRetry: true,
            documentId,
            previousError: metadata.errorMessage,
            retryCount: retryCount + 1,
          })
          return true
        }

        // Combine verification cases
        case 'verification':
        case 'verification_pending':
        case 'verification_in_progress': {
          store.setError(null)
          const rawRetryCount = metadata.details?.retryCount
          const retryCount = typeof rawRetryCount === 'number' ? rawRetryCount : 0
          store.updateWorkflowStep(targetStage, {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: retryCount + 1,
          })
          return true
        }

        case 'report_generation': {
          store.setError(null)
          const rawRetryCount = metadata.details?.retryCount
          const retryCount = typeof rawRetryCount === 'number' ? rawRetryCount : 0
          store.updateWorkflowStep('report_generation', {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: retryCount + 1,
          })
          return true
        }

        case 'complete':
          store.setError(null)
          store.updateWorkflowStep('complete', {})
          return true

        // Combine chat cases
        case 'chat_started':
        case 'chat_in_progress':
        case 'chat_completed': {
          store.setError(null)
          const rawRetryCount = metadata.details?.retryCount
          const retryCount = typeof rawRetryCount === 'number' ? rawRetryCount : 0
          store.updateWorkflowStep(targetStage, {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: retryCount + 1,
          })
          return true
        }

        // Domain-only steps
        case DomainOnlyWorkflowStep.RESEARCH:
        case DomainOnlyWorkflowStep.REPORT_PRESENTATION: {
          store.setError(null)
          const rawRetryCount = metadata.details?.retryCount
          const retryCount = typeof rawRetryCount === 'number' ? rawRetryCount : 0
          store.updateWorkflowStep(targetStage, {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: retryCount + 1,
          })
          return true
        }

        default:
          // fallback to reset
          store.resetChat()
          store.updateWorkflowStep('idle', {})
          store.setError(null)
          return true
      }
    } catch (recoveryError) {
      console.error('Error during recovery attempt:', recoveryError)
      const norm = this.normalizeError(recoveryError)
      store.setError(`Recovery failed: ${norm.message}`)
      // Note: 'error' is not a valid step in the DB enum, so we use DomainOnlyWorkflowStep.ERROR
      store.updateWorkflowStep(DomainOnlyWorkflowStep.ERROR, {
        error: `Recovery failed: ${norm.message}`,
        originalError: metadata.errorMessage,
        recoveryFailed: true,
      })
      return false
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
   * Uses both the chat store and the workflow service for error handling
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
  ): Promise<WorkflowErrorMetadata> {
    const metadata = this.createErrorMetadata(
      error,
      currentStep,
      options?.previousStep,
      options?.details
    )
    
    // Log the error
    await this.logError(metadata)

    // Update UI state
    const store = useChatStore.getState()
    store.setError(metadata.errorMessage)
    store.updateWorkflowStep(DomainOnlyWorkflowStep.ERROR, {
      error: metadata.errorMessage,
      errorDetails: metadata.details,
      errorType: metadata.errorType,
      previousStep: metadata.previousStep,
      recoveryPaths: metadata.recoveryPaths,
    })
    
    // Try to use database services for error handling if workflowId is provided
    const workflowId = options?.workflowId || 
                       (typeof localStorage !== 'undefined' ? localStorage.getItem('current_workflow_id') : null)
    
    if (workflowId) {
      try {
        // Log the error event
        await workflowService.logWorkflowEvent(
          workflowId,
          'error_occurred',
          {
            error: metadata.errorMessage,
            errorType: metadata.errorType,
            previousStep: metadata.previousStep,
            timestamp: metadata.timestamp,
            details: metadata.details
          }
        )
        
        // Use recoverWorkflowState for database-level recovery if requested
        if (
          options?.attemptRecovery === true &&
          metadata.recoveryPaths !== null &&
          metadata.recoveryPaths !== undefined &&
          metadata.recoveryPaths.length > 0
        ) {
          const recoveryStep = metadata.recoveryPaths[0]
          const recoveryMetadata = {
            error: metadata.errorMessage,
            errorType: metadata.errorType,
            errorTimestamp: metadata.timestamp,
            recoveryPath: recoveryStep,
            originalStep: currentStep,
            originalError: error instanceof Error ? error.message : String(error),
            recoveryDetails: metadata.details
          }
          
          await workflowService.recoverWorkflowState(
            workflowId,
            recoveryStep,
            recoveryMetadata
          )
        } else {
          // Set error state in database if no recovery requested
          await workflowService.setWorkflowError(
            workflowId,
            metadata.errorMessage,
            {
              errorType: metadata.errorType,
              errorTimestamp: metadata.timestamp,
              originalStep: currentStep,
              details: metadata.details
            }
          )
        }
      } catch (dbError) {
        console.error('Failed to update database error state:', dbError)
        
        // Fall back to in-memory recovery if database update fails
        if (
          options?.attemptRecovery === true &&
          metadata.recoveryPaths !== null &&
          metadata.recoveryPaths !== undefined &&
          metadata.recoveryPaths.length > 0
        ) {
          void this.attemptRecovery(metadata)
        }
      }
    } else {
      // Fall back to in-memory recovery if no workflowId
      if (
        options?.attemptRecovery === true &&
        metadata.recoveryPaths !== null &&
        metadata.recoveryPaths !== undefined &&
        metadata.recoveryPaths.length > 0
      ) {
        void this.attemptRecovery(metadata)
      }
    }

    // Show toast notification if requested
    if (options?.showToast !== false) {
      toast({
        title: metadata.errorType === 'network' ? 'Network Error' : 'Error',
        description: metadata.errorMessage,
        variant: 'destructive',
      })
    }

    return metadata
  }
}

/**
 * Convenience hook that returns a reusable WorkflowErrorHandler instance
 */
export function useWorkflowErrorHandler(apiClient?: ApiClient) {
  const handler = new WorkflowErrorHandler(apiClient)
  return handler
}