'use client'

import { toast } from '@/components/ui/use-toast'
import type { WorkflowStep } from '@/lib/workflow/types'
import type { ApiClient } from '@/lib/api/client/api-client'
import { useChatStore } from '@/stores/chat-store'
import { createBrowserClient } from '@/lib/supabase/clients'

/**
 * Error metadata structure for workflow errors
 */
export interface WorkflowErrorMetadata {
  errorMessage: string
  originalError?: unknown
  errorCode?: string
  errorType?: 'validation' | 'network' | 'permission' | 'timeout' | 'system' | 'unknown'
  workflowStep: WorkflowStep
  previousStep?: WorkflowStep
  recoveryPaths?: WorkflowStep[]
  timestamp: string
  userAgent?: string
  clientId?: string
  details?: Record<string, any>
}

/**
 * Specialized error handler for workflow-specific errors
 * with stage-specific recovery strategies
 */
export class WorkflowErrorHandler {
  private apiClient: ApiClient | null = null
  
  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient || null
  }
  
  /**
   * Set the API client for recovery operations
   */
  setApiClient(apiClient: ApiClient) {
    this.apiClient = apiClient
  }
  
  /**
   * Normalize an error to a standard format
   */
  normalizeError(error: unknown, fallbackMessage = 'An unknown error occurred'): {
    message: string
    type: WorkflowErrorMetadata['errorType']
    code?: string
    details?: Record<string, any>
  } {
    // Handle Error objects
    if (error instanceof Error) {
      const message = error.message || fallbackMessage
      
      // Detect network errors
      if (
        message.toLowerCase().includes('network') ||
        message.toLowerCase().includes('fetch') ||
        message.toLowerCase().includes('cors') ||
        message.toLowerCase().includes('connection') ||
        (error as any).isNetworkError
      ) {
        return { 
          message, 
          type: 'network',
          code: (error as any).code,
          details: (error as any).details
        }
      }
      
      // Detect timeout errors
      if (
        message.toLowerCase().includes('timeout') ||
        message.toLowerCase().includes('timed out')
      ) {
        return { 
          message, 
          type: 'timeout',
          code: (error as any).code,
          details: (error as any).details
        }
      }
      
      // Detect permission errors
      if (
        message.toLowerCase().includes('permission') ||
        message.toLowerCase().includes('access denied') ||
        message.toLowerCase().includes('not allowed')
      ) {
        return { 
          message, 
          type: 'permission',
          code: (error as any).code,
          details: (error as any).details
        }
      }
      
      // Detect validation errors
      if (
        message.toLowerCase().includes('validation') ||
        message.toLowerCase().includes('invalid') ||
        message.toLowerCase().includes('required')
      ) {
        return { 
          message, 
          type: 'validation',
          code: (error as any).code,
          details: (error as any).details
        }
      }
      
      // Default to system error
      return { 
        message, 
        type: 'system',
        code: (error as any).code,
        details: (error as any).details
      }
    }
    
    // Handle string errors
    if (typeof error === 'string') {
      return { message: error, type: 'unknown' }
    }
    
    // Handle unknown error types
    return { 
      message: fallbackMessage, 
      type: 'unknown',
      details: { originalError: error }
    }
  }
  
  /**
   * Create a structured error metadata object
   */
  createErrorMetadata(
    error: unknown, 
    workflowStep: WorkflowStep, 
    previousStep?: WorkflowStep,
    details?: Record<string, any>
  ): WorkflowErrorMetadata {
    const normalizedError = this.normalizeError(error)
    const recoveryPaths = this.getRecoveryPaths(workflowStep)
    
    return {
      errorMessage: normalizedError.message,
      originalError: error,
      errorCode: normalizedError.code,
      errorType: normalizedError.type,
      workflowStep,
      previousStep,
      recoveryPaths,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      clientId: typeof localStorage !== 'undefined' ? localStorage.getItem('neuvia_client_id') : undefined,
      details: {
        ...normalizedError.details,
        ...details
      }
    }
  }
  
  /**
   * Get possible recovery paths for a given workflow step
   */
  getRecoveryPaths(currentStep: WorkflowStep): WorkflowStep[] {
    switch(currentStep) {
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
      case 'error':
      default:
        return ['idle']
    }
  }
  
  /**
   * Log an error to the console and database
   */
  async logError(metadata: WorkflowErrorMetadata): Promise<void> {
    // Log to console
    console.error('Workflow error:', {
      message: metadata.errorMessage,
      step: metadata.workflowStep,
      previousStep: metadata.previousStep,
      type: metadata.errorType,
      timestamp: metadata.timestamp,
      details: metadata.details
    })
    
    // Log to database if available
    try {
      const supabase = createBrowserClient()
      const workflowId = localStorage.getItem('current_workflow_id')
      
      if (workflowId) {
        await supabase
          .from('workflow_errors')
          .insert({
            workflow_id: workflowId,
            error_message: metadata.errorMessage,
            error_type: metadata.errorType || 'unknown',
            error_code: metadata.errorCode,
            workflow_step: metadata.workflowStep,
            previous_step: metadata.previousStep,
            recovery_paths: metadata.recoveryPaths,
            error_details: metadata.details,
            created_at: metadata.timestamp,
          })
      }
    } catch (dbError) {
      console.error('Failed to log error to database:', dbError)
    }
  }
  
  /**
   * Handle a workflow error with appropriate recovery strategy
   */
  async handleError(
    error: unknown, 
    currentStep: WorkflowStep, 
    options?: {
      previousStep?: WorkflowStep
      details?: Record<string, any>
      showToast?: boolean
      attemptRecovery?: boolean
    }
  ): Promise<WorkflowErrorMetadata> {
    // Create error metadata
    const metadata = this.createErrorMetadata(
      error, 
      currentStep, 
      options?.previousStep,
      options?.details
    )
    
    // Log the error
    await this.logError(metadata)
    
    // Update global error state
    const store = useChatStore.getState()
    store.setError(metadata.errorMessage)
    store.updateWorkflowStep('error', {
      error: metadata.errorMessage,
      errorDetails: metadata.details,
      errorType: metadata.errorType,
      previousStep: metadata.previousStep,
      recoveryPaths: metadata.recoveryPaths,
    })
    
    // Show toast notification if enabled
    if (options?.showToast !== false) {
      toast({
        title: metadata.errorType === 'network' ? 'Network Error' : 'Error',
        description: metadata.errorMessage,
        variant: 'destructive',
      })
    }
    
    // Attempt automatic recovery if enabled
    if (options?.attemptRecovery && metadata.recoveryPaths?.length) {
      await this.attemptRecovery(metadata)
    }
    
    return metadata
  }
  
  /**
   * Attempt to recover from an error based on context
   */
  async attemptRecovery(metadata: WorkflowErrorMetadata): Promise<boolean> {
    // Can't recover without API client
    if (!this.apiClient) {
      console.warn('Cannot attempt recovery: API client not available')
      return false
    }
    
    // Recovery based on error type
    if (metadata.errorType === 'network') {
      // For network errors, we can retry after a delay
      return new Promise((resolve) => {
        setTimeout(async () => {
          const result = await this.recoverFromError(metadata.previousStep || 'idle', metadata)
          resolve(result)
        }, 2000)
      })
    }
    
    // Direct recovery attempt
    return this.recoverFromError(metadata.previousStep || 'idle', metadata)
  }
  
  /**
   * Stage-specific recovery strategies
   */
  async recoverFromError(
    targetStage: WorkflowStep,
    metadata: WorkflowErrorMetadata
  ): Promise<boolean> {
    const store = useChatStore.getState()
    
    // Skip recovery if API client not available
    if (!this.apiClient) {
      return false
    }
    
    try {
      switch(targetStage) {
        case 'idle':
          // Reset to initial state
          store.resetChat()
          store.updateWorkflowStep('idle')
          store.setError(null)
          return true
          
        case 'uploading': {
          // Retry upload if we have file info
          const currentUpload = metadata.details?.file
          if (!currentUpload) {
            return false
          }
          
          // Clear error state
          store.setError(null)
          
          // Update workflow step
          store.updateWorkflowStep('uploading', {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: (metadata.details?.retryCount || 0) + 1,
          })
          
          return true
        }
          
        case 'extracting': {
          // Retry extraction if we have document info
          const documentId = metadata.details?.documentId
          if (!documentId) {
            return false
          }
          
          // Clear error state
          store.setError(null)
          
          // Update workflow step
          store.updateWorkflowStep('extracting', {
            isRetry: true,
            documentId,
            previousError: metadata.errorMessage,
            retryCount: (metadata.details?.retryCount || 0) + 1,
          })
          
          return true
        }
          
        case 'verification':
        case 'verification_pending':
        case 'verification_in_progress':
          // Return to verification state with existing data
          store.setError(null)
          store.updateWorkflowStep(targetStage, {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: (metadata.details?.retryCount || 0) + 1,
          })
          return true
          
        case 'report_generation':
          // Retry report generation
          store.setError(null)
          store.updateWorkflowStep('report_generation', {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: (metadata.details?.retryCount || 0) + 1,
          })
          return true
          
        case 'complete':
          // Return to completed state
          store.setError(null)
          store.updateWorkflowStep('complete')
          return true
          
        default:
          // For any other stage, reset to idle state
          store.resetChat()
          store.updateWorkflowStep('idle')
          store.setError(null)
          return true
      }
    } catch (recoveryError) {
      console.error('Error during recovery attempt:', recoveryError)
      
      // Update error state with recovery failure
      store.setError(`Recovery failed: ${this.normalizeError(recoveryError).message}`)
      store.updateWorkflowStep('error', {
        error: `Recovery failed: ${this.normalizeError(recoveryError).message}`,
        originalError: metadata.errorMessage,
        recoveryFailed: true,
      })
      
      return false
    }
  }
  
  /**
   * Clear error state and return to specified state
   */
  clearError(returnToStep?: WorkflowStep): void {
    const store = useChatStore.getState()
    store.setError(null)
    
    if (returnToStep) {
      store.updateWorkflowStep(returnToStep)
    }
  }
}

/**
 * Create a singleton instance of the workflow error handler
 */
export const workflowErrorHandler = new WorkflowErrorHandler()

/**
 * Hook to use the workflow error handler
 */
export function useWorkflowErrorHandler(apiClient?: ApiClient) {
  // Set API client if provided
  if (apiClient) {
    workflowErrorHandler.setApiClient(apiClient)
  }
  
  return workflowErrorHandler
}