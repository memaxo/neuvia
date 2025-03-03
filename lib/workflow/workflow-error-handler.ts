import { useChatStore } from '@/stores/chat-store'
import { useToast } from '@/components/ui/use-toast'
import type { WorkflowStep } from './types'

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
  'Permission denied': 'You don\'t have permission to perform this action.',
  'Not authenticated': 'Your session has expired. Please log in again.',
  'CORS error': 'Cross-origin request blocked. This is a security error.',
  'Timeout': 'The operation timed out. Please try again.',
};

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
};

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
  'chat_completed': WorkflowErrorCategory.GENERIC,
  'chat_error': WorkflowErrorCategory.GENERIC,
};

/**
 * Determine if an error is a network error
 */
function isNetworkError(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error);
  return (
    errorMsg.includes('network') ||
    errorMsg.includes('fetch') ||
    errorMsg.includes('connection') ||
    errorMsg.includes('timeout') ||
    errorMsg.includes('abort')
  );
}

/**
 * Determine if an error is a permission error
 */
function isPermissionError(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error);
  return (
    errorMsg.includes('permission') ||
    errorMsg.includes('unauthorized') ||
    errorMsg.includes('denied') ||
    errorMsg.includes('not allowed') ||
    errorMsg.includes('forbidden')
  );
}

/**
 * Create a user-friendly error message from an error
 */
function createUserFriendlyMessage(error: unknown, category: WorkflowErrorCategory): string {
  const errorMsg = error instanceof Error ? error.message : String(error);
  
  // Check for known error messages that have friendlier versions
  for (const [pattern, friendlyMessage] of Object.entries(ERROR_MESSAGE_MAP)) {
    if (errorMsg.includes(pattern)) {
      return friendlyMessage;
    }
  }
  
  // If no specific match, return the error message or a default by category
  return errorMsg || DEFAULT_ERROR_MESSAGES[category];
}

/**
 * Detect error category from error and current step
 */
function detectErrorCategory(error: unknown, currentStep: WorkflowStep): WorkflowErrorCategory {
  // Check for network errors first
  if (isNetworkError(error)) {
    return WorkflowErrorCategory.NETWORK;
  }
  
  // Check for permission errors next
  if (isPermissionError(error)) {
    return WorkflowErrorCategory.PERMISSION;
  }
  
  // Default to the category based on current workflow step
  return STEP_TO_CATEGORY_MAP[currentStep];
}

/**
 * Determine if the error is retriable
 */
function isRetriable(category: WorkflowErrorCategory, error: unknown): boolean {
  // Network errors are usually retriable
  if (category === WorkflowErrorCategory.NETWORK) {
    return true;
  }
  
  // Some operations like uploads and processing can be retried
  if (
    category === WorkflowErrorCategory.UPLOAD ||
    category === WorkflowErrorCategory.PROCESSING
  ) {
    return true;
  }
  
  // Permission errors are not retriable without changing permissions
  if (category === WorkflowErrorCategory.PERMISSION) {
    return false;
  }
  
  // For other errors, check the message for signs of non-retriable errors
  const errorMsg = error instanceof Error ? error.message : String(error);
  const nonRetriablePatterns = ['invalid', 'malformed', 'corrupt', 'not found', 'does not exist'];
  
  return !nonRetriablePatterns.some(pattern => errorMsg.toLowerCase().includes(pattern));
}

/**
 * Hook for handling workflow errors
 */
export function useWorkflowErrorHandler() {
  const { toast } = useToast()
  const updateWorkflowStep = useChatStore(state => state.updateWorkflowStep)
  const setError = useChatStore(state => state.setError)
  const currentStep = useChatStore(state => state.workflow.currentStep)
  
  /**
   * Handle a workflow error with proper categorization, user-friendly messages, and state updates
   */
  const handleWorkflowError = (
    error: unknown,
    options?: {
      step?: WorkflowStep,
      category?: WorkflowErrorCategory,
      details?: Record<string, any>,
      showToast?: boolean,
      fallbackMessage?: string,
    }
  ) => {
    const step = options?.step || currentStep
    const category = options?.category || detectErrorCategory(error, step)
    const fallbackMessage = options?.fallbackMessage || DEFAULT_ERROR_MESSAGES[category]
    const showToast = options?.showToast !== false // Default to true
    
    // Create error message - use fallback if error doesn't have a message
    const errorMsg = error instanceof Error ? error.message : String(error || fallbackMessage)
    
    // Create user-friendly message
    const userFriendlyMessage = createUserFriendlyMessage(error, category)
    
    // Determine if error is retriable
    const retry = isRetriable(category, error)
    
    // Create the full error object
    const workflowError: WorkflowError = {
      message: errorMsg,
      category,
      step,
      timestamp: new Date().toISOString(),
      retry,
      details: {
        ...options?.details,
        originalError: error instanceof Error ? error.toString() : String(error),
      }
    }
    
    // Update the chat store error state
    setError(userFriendlyMessage)
    
    // Update workflow step to error with error details
    updateWorkflowStep('error', {
      error: userFriendlyMessage,
      errorCategory: category,
      errorTimestamp: workflowError.timestamp,
      errorDetails: workflowError.details,
      errorRetry: retry,
      previousStep: step
    })
    
    // Show toast notification if requested
    if (showToast) {
      toast({
        title: `${category.charAt(0).toUpperCase() + category.slice(1)} Error`,
        description: userFriendlyMessage,
        variant: 'destructive',
      })
    }
    
    // Return the error object for further handling if needed
    return workflowError
  }
  
  /**
   * Handle a workflow transition error specifically
   */
  const handleTransitionError = (
    fromStep: WorkflowStep,
    toStep: WorkflowStep,
    error: unknown,
    details?: Record<string, any>
  ) => {
    return handleWorkflowError(error, {
      step: fromStep,
      details: {
        ...details,
        transitionFrom: fromStep,
        transitionTo: toStep,
        transitionType: 'workflow_step_transition'
      },
      showToast: true,
      fallbackMessage: `Failed to transition from ${fromStep} to ${toStep}`
    })
  }
  
  /**
   * Clear workflow error state
   */
  const clearError = () => {
    setError(null)
  }
  
  /**
   * Helper to check if an operation can recover from an error
   */
  const canRetry = (error: WorkflowError): boolean => {
    return !!error.retry
  }
  
  return {
    handleWorkflowError,
    handleTransitionError,
    clearError,
    canRetry,
    ERROR_CATEGORIES: WorkflowErrorCategory
  }
}