import { useChatStore } from '@/stores/chat-store'
import { toast } from '@/components/ui/use-toast'
import { WorkflowStep } from '../types/workflow'
import type { ApiClient } from '@/lib/api/client/api-client'
import { createBrowserClient } from '@/lib/supabase/clients'

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
  GENERIC = 'generic'
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
  details?: Record<string, any>
}

/**
 * Map of error messages to more user-friendly versions
 */
const ERROR_MESSAGE_MAP: Record<string, string> = {
  'Failed to fetch': 'Network connection issue - please check your internet connection.',
  'Network error': 'Network connection issue - please check your internet connection.',
  'The user aborted a request': 'The operation was cancelled.',
  'User denied transaction signature': 'The operation was cancelled by the user.',
  'Permission denied': "You don't have permission to perform this action.",
  'Not authenticated': 'Your session has expired. Please log in again.',
  'CORS error': 'Cross-origin request blocked. This is a security error.',
  'Timeout': 'The operation timed out. Please try again.',
}

/**
 * Default error messages by category
 */
const DEFAULT_ERROR_MESSAGES: Record<WorkflowErrorCategory, string> = {
  [WorkflowErrorCategory.UPLOAD]: 'Failed to upload the document.',
  [WorkflowErrorCategory.PROCESSING]: 'Error processing the document.',
  [WorkflowErrorCategory.VERIFICATION]: 'Error during verification process.',
  [WorkflowErrorCategory.REPORT]: 'Failed to generate the report.',
  [WorkflowErrorCategory.NETWORK]: 'Network connection issue.',
  [WorkflowErrorCategory.PERMISSION]: 'Permission denied for this operation.',
  [WorkflowErrorCategory.GENERIC]: 'An error occurred.',
}

/**
 * Maps workflow steps to error categories for default categorization
 */
const STEP_TO_CATEGORY_MAP: Record<WorkflowStep, WorkflowErrorCategory> = {
  'idle': WorkflowErrorCategory.GENERIC,
  'uploading': WorkflowErrorCategory.UPLOAD,
  'extracting': WorkflowErrorCategory.PROCESSING,
  'verification': WorkflowErrorCategory.VERIFICATION,
  'verification_pending': WorkflowErrorCategory.VERIFICATION,
  'verification_in_progress': WorkflowErrorCategory.VERIFICATION,
  'verification_completed': WorkflowErrorCategory.VERIFICATION,
  'verification_failed': WorkflowErrorCategory.VERIFICATION,
  'report_generation': WorkflowErrorCategory.REPORT,
  'report_presentation': WorkflowErrorCategory.REPORT,
  'complete': WorkflowErrorCategory.GENERIC,
  'error': WorkflowErrorCategory.GENERIC,
  'research': WorkflowErrorCategory.PROCESSING,
  'chat_started': WorkflowErrorCategory.GENERIC,
  'chat_in_progress': WorkflowErrorCategory.GENERIC,
  'chat_completed': WorkflowErrorCategory.GENERIC
}

/**
 * Determine if an error is a network error
 */
function isNetworkError(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error)
  return (
    errorMsg.includes('network') ||
    errorMsg.includes('fetch') ||
    errorMsg.includes('connection') ||
    errorMsg.includes('timeout') ||
    errorMsg.includes('abort')
  )
}

/**
 * Determine if an error is a permission error
 */
function isPermissionError(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error)
  return (
    errorMsg.includes('permission') ||
    errorMsg.includes('unauthorized') ||
    errorMsg.includes('denied') ||
    errorMsg.includes('not allowed') ||
    errorMsg.includes('forbidden')
  )
}

/**
 * Unused helper: createUserFriendlyMessage 
 * (removed to prevent unused variable warnings)
 */

/**
 * Unused helper: detectErrorCategory 
 * (removed to prevent unused variable warnings)
 */

/**
 * Unused helper: isRetriable 
 * (removed to prevent unused variable warnings)
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
  details?: Record<string, any>
}

export class WorkflowErrorHandler {
  private apiClient: ApiClient | null = null

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient || null
  }

  setApiClient(apiClient: ApiClient) {
    this.apiClient = apiClient
  }

  normalizeError(
    error: unknown,
    fallbackMessage = 'An unknown error occurred'
  ): { message: string; type: WorkflowErrorMetadata['errorType']; code?: string; details?: Record<string, any> } {
    if (error instanceof Error) {
      const message = error.message || fallbackMessage
      const lowerMsg = message.toLowerCase()
      if (lowerMsg.includes('network') || lowerMsg.includes('fetch') || lowerMsg.includes('cors') || lowerMsg.includes('connection')) {
        return { message, type: 'network', code: (error as any).code, details: (error as any).details }
      }
      if (lowerMsg.includes('timeout') || lowerMsg.includes('timed out')) {
        return { message, type: 'timeout', code: (error as any).code, details: (error as any).details }
      }
      if (lowerMsg.includes('permission') || lowerMsg.includes('access denied') || lowerMsg.includes('not allowed')) {
        return { message, type: 'permission', code: (error as any).code, details: (error as any).details }
      }
      if (lowerMsg.includes('validation') || lowerMsg.includes('invalid') || lowerMsg.includes('required')) {
        return { message, type: 'validation', code: (error as any).code, details: (error as any).details }
      }
      return { message, type: 'system', code: (error as any).code, details: (error as any).details }
    }
    if (typeof error === 'string') {
      return { message: error, type: 'unknown' }
    }
    return { message: fallbackMessage, type: 'unknown', details: { originalError: error } }
  }

  getRecoveryPaths(currentStep: WorkflowStep): WorkflowStep[] {
    switch (currentStep) {
      case WorkflowStep.UPLOADING:
        return [WorkflowStep.IDLE, WorkflowStep.UPLOADING]
      case WorkflowStep.EXTRACTING:
        return [WorkflowStep.IDLE, WorkflowStep.UPLOADING, WorkflowStep.EXTRACTING]
      case WorkflowStep.VERIFICATION:
      case WorkflowStep.VERIFICATION_PENDING:
      case WorkflowStep.VERIFICATION_IN_PROGRESS:
      case WorkflowStep.VERIFICATION_COMPLETED:
      case WorkflowStep.VERIFICATION_FAILED:
        return [WorkflowStep.VERIFICATION, WorkflowStep.VERIFICATION_IN_PROGRESS]
      case WorkflowStep.REPORT_GENERATION:
        return [WorkflowStep.VERIFICATION_COMPLETED, WorkflowStep.REPORT_GENERATION]
      case WorkflowStep.CHAT_STARTED:
      case WorkflowStep.CHAT_IN_PROGRESS:
      case WorkflowStep.CHAT_COMPLETED:
        return [WorkflowStep.CHAT_STARTED, WorkflowStep.CHAT_IN_PROGRESS]
      case WorkflowStep.COMPLETE:
        return [WorkflowStep.IDLE, WorkflowStep.COMPLETE]
      case WorkflowStep.ERROR:
      default:
        return [WorkflowStep.IDLE]
    }
  }

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
      clientId: typeof localStorage !== 'undefined' ? localStorage.getItem('neuvia_client_id') ?? undefined : undefined,
      details: { ...normalizedError.details, ...details }
    }
  }

  async logError(metadata: WorkflowErrorMetadata): Promise<void> {
    // eslint-disable-next-line no-console
    console.error('Workflow error:', {
      message: metadata.errorMessage,
      step: metadata.workflowStep,
      previousStep: metadata.previousStep,
      type: metadata.errorType,
      timestamp: metadata.timestamp,
      details: metadata.details
    })
    try {
      const supabase = createBrowserClient()
      const workflowId = localStorage.getItem('current_workflow_id') ?? undefined
      if (workflowId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await supabase.from('workflow_errors' as any).insert({
          workflow_id: workflowId,
          error_message: metadata.errorMessage,
          error_type: metadata.errorType,
          error_code: metadata.errorCode,
          workflow_step: metadata.workflowStep,
          previous_step: metadata.previousStep,
          recovery_paths: metadata.recoveryPaths,
          error_details: metadata.details,
          created_at: metadata.timestamp
        })
      }
    } catch (dbError) {
      // eslint-disable-next-line no-console
      console.error('Failed to log error to database:', dbError)
    }
  }

  async attemptRecovery(metadata: WorkflowErrorMetadata): Promise<boolean> {
    if (!this.apiClient) {
      // eslint-disable-next-line no-console
      console.warn('Cannot attempt recovery: API client not available')
      return false
    }
    if (metadata.errorType === 'network') {
      return new Promise((resolve) => {
        setTimeout(async () => {
          const result = await this.recoverFromError(metadata.previousStep ?? WorkflowStep.IDLE, metadata)
          resolve(result)
        }, 2000)
      })
    }
    return this.recoverFromError(metadata.previousStep ?? WorkflowStep.IDLE, metadata)
  }

  async recoverFromError(targetStage: WorkflowStep, metadata: WorkflowErrorMetadata): Promise<boolean> {
    const store = useChatStore.getState()
    if (!this.apiClient) {
      return false
    }
    try {
      switch (targetStage) {
        case WorkflowStep.IDLE:
          store.resetChat()
          store.updateWorkflowStep(WorkflowStep.IDLE)
          store.setError(null)
          return true
        case WorkflowStep.UPLOADING: {
          const currentUpload = metadata.details?.file
          if (!currentUpload) {
            return false
          }
          store.setError(null)
          store.updateWorkflowStep(WorkflowStep.UPLOADING, {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: ((metadata.details?.retryCount as number) ?? 0) + 1
          })
          return true
        }
        case WorkflowStep.EXTRACTING: {
          const documentId = metadata.details?.documentId
          if (!documentId) {
            return false
          }
          store.setError(null)
          store.updateWorkflowStep(WorkflowStep.EXTRACTING, {
            isRetry: true,
            documentId,
            previousError: metadata.errorMessage,
            retryCount: ((metadata.details?.retryCount as number) ?? 0) + 1
          })
          return true
        }
        case WorkflowStep.VERIFICATION:
        case WorkflowStep.VERIFICATION_PENDING:
        case WorkflowStep.VERIFICATION_IN_PROGRESS:
          store.setError(null)
          store.updateWorkflowStep(targetStage, {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: ((metadata.details?.retryCount as number) ?? 0) + 1
          })
          return true
        case WorkflowStep.REPORT_GENERATION:
          store.setError(null)
          store.updateWorkflowStep(WorkflowStep.REPORT_GENERATION, {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: ((metadata.details?.retryCount as number) ?? 0) + 1
          })
          return true
        case WorkflowStep.COMPLETE:
          store.setError(null)
          store.updateWorkflowStep(WorkflowStep.COMPLETE)
          return true
        default:
          store.resetChat()
          store.updateWorkflowStep(WorkflowStep.IDLE)
          store.setError(null)
          return true
      }
    } catch (recoveryError) {
      // eslint-disable-next-line no-console
      console.error('Error during recovery attempt:', recoveryError)
      store.setError(`Recovery failed: ${this.normalizeError(recoveryError).message}`)
      store.updateWorkflowStep(WorkflowStep.ERROR, {
        error: `Recovery failed: ${this.normalizeError(recoveryError).message}`,
        originalError: metadata.errorMessage,
        recoveryFailed: true
      })
      return false
    }
  }

  clearError(returnToStep?: WorkflowStep): void {
    const store = useChatStore.getState()
    store.setError(null)
    if (returnToStep) {
      store.updateWorkflowStep(returnToStep)
    }
  }

  async handleError(
    error: unknown,
    currentStep: WorkflowStep,
    options?: { previousStep?: WorkflowStep; details?: Record<string, any>; showToast?: boolean; attemptRecovery?: boolean }
  ): Promise<WorkflowErrorMetadata> {
    const metadata = this.createErrorMetadata(error, currentStep, options?.previousStep, options?.details)
    await this.logError(metadata)
    const store = useChatStore.getState()
    store.setError(metadata.errorMessage)
    store.updateWorkflowStep(WorkflowStep.ERROR, {
      error: metadata.errorMessage,
      errorDetails: metadata.details,
      errorType: metadata.errorType,
      previousStep: metadata.previousStep,
      recoveryPaths: metadata.recoveryPaths
    })
    if (options?.showToast !== false) {
      toast({
        title: metadata.errorType === 'network' ? 'Network Error' : 'Error',
        description: metadata.errorMessage,
        variant: 'destructive'
      })
    }
    if (options?.attemptRecovery && metadata.recoveryPaths?.length) {
      await this.attemptRecovery(metadata)
    }
    return metadata
  }
}

export function useWorkflowErrorHandler(apiClient?: ApiClient) {
  const handler = new WorkflowErrorHandler(apiClient)
  return handler
}