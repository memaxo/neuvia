# Neuvia Error Handling System

This document provides a comprehensive overview of Neuvia's error handling architecture, which is designed to provide robust error management in a medical context where reliability and clarity are essential.

## Architecture Overview

Neuvia employs a multi-layered error handling approach that spans from UI components to database operations:

1. **Error Representation**: Structured error types with consistent formatting
2. **Error Capture**: Strategic try/catch blocks and error boundaries  
3. **Error Storage**: Centralized error state in Zustand store and database
4. **Error Presentation**: Context-aware UI components for error display
5. **Error Recovery**: Stage-specific recovery strategies with multiple recovery paths

This system enables graceful error handling in critical medical workflows while maintaining detailed information for debugging and analytics.

## Key Features

### Recent Enhancements

Our latest enhancements to the error handling system include:

1. **Stage-Specific Recovery**: Different workflow stages (upload, extraction, verification, etc.) now have tailored recovery strategies
2. **Multiple Recovery Paths**: Each error offers multiple recovery options based on context
3. **Enhanced Error Boundaries**: Components are wrapped with specialized error boundaries that understand the workflow context
4. **Centralized Error Service**: A dedicated `WorkflowErrorHandler` service manages all workflow errors
5. **Error Analytics**: Comprehensive error tracking and logging for analysis

## Error Type Hierarchy

The core of our error system is a well-defined error class hierarchy in `lib/errors.ts`:

```typescript
// Base application error
class ApplicationError extends Error {
  code: string;
  status: number;
  data?: Record<string, any>;
  
  constructor(message: string, options?: ErrorOptions) {
    super(message);
    this.name = this.constructor.name;
    this.code = options?.code || 'UNKNOWN_ERROR';
    this.status = options?.status || 500;
    this.data = options?.data;
  }
}

// 400-level client errors
class UserError extends ApplicationError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, { status: 400, ...options });
  }
}

// Specific error types
class ValidationError extends UserError {...}
class AuthenticationError extends UserError {...}
class AuthorizationError extends UserError {...}
class NotFoundError extends UserError {...}
class SystemError extends ApplicationError {...}
class ExternalServiceError extends ApplicationError {...}
class WorkflowStateError extends ApplicationError {...}
```

This hierarchy allows for precise error typing and appropriate HTTP status codes when used in API contexts.

## UI Error Handling

### Error Boundaries

React error boundaries capture rendering errors and prevent them from crashing the entire application:

```tsx
export function ChatErrorBoundary({
  children
}: {
  children: React.ReactNode
}) {
  const [hasError, setHasError] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const handleReset = () => {
    setHasError(false)
    setError(null)
  }
  
  if (hasError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-6">
        <div className="text-destructive mb-4">
          <AlertOctagon className="mx-auto h-12 w-12" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
        <p className="mb-4 text-center text-muted-foreground">
          {error?.message || 'An unexpected error occurred'}
        </p>
        <Button onClick={handleReset}>Try Again</Button>
      </div>
    )
  }
  
  return (
    <ErrorBoundary
      onError={(error) => {
        setError(error)
        setHasError(true)
        logger.error('UI Error', { error: normalizeError(error) })
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
```

### Component Error States

Components handle their own error states using the centralized error handler:

```tsx
export function ChatInterface({ patientId }: ChatInterfaceProps) {
  const { handleError } = useErrorHandler()
  const error = useChatStore(state => state.error)
  
  // Error recovery UI
  const renderErrorRecovery = () => {
    if (!error) return null
    
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="size-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error}
          <div className="mt-2 flex gap-2">
            <Button
              className="gap-1"
              onClick={retryProcessing}
              size="sm"
              variant="outline"
            >
              <RefreshCw className="size-3" /> Retry
            </Button>
            <Button
              onClick={() => useChatStore.getState().setError(null)}
              size="sm"
              variant="outline"
            >
              Dismiss
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }
}
```

## State Management Error Handling

Our Zustand store provides centralized error state management with context:

```typescript
// In stores/chat-store.tsx
export const useChatStore = create<ChatStore>()(
  devtools(
    (set, get) => ({
      error: null,
      
      setError: (error) => 
        set((state) => ({
          error,
          isLoading: false,
          workflow: {
            ...state.workflow,
            workflowError: error,
          },
        })),
      
      // Other state and actions...
    })
  )
)
```

## Enhanced Error Handler

The `useErrorHandler` hook provides a powerful way to handle errors with context:

```typescript
export function useErrorHandler() {
  const { toast } = useToast()
  const setError = useChatStore((state) => state.setError)
  const updateWorkflowStep = useChatStore((state) => state.updateWorkflowStep)
  const currentStep = useChatStore((state) => state.workflow.currentStep)

  return {
    handleError: (
      error: unknown, 
      fallbackMessage = 'An error occurred',
      options?: {
        step?: string,
        details?: Record<string, any>,
        showToast?: boolean
      }
    ) => {
      // Determine error message from error or fallback
      const errorMsg = error instanceof Error ? error.message : String(error || fallbackMessage)
      
      // Detect if this is a network error for better user feedback
      const isNetworkError = ['network', 'fetch', 'connection', 'timeout', 'cors']
        .some(term => errorMsg.toLowerCase().includes(term))
      
      // Create a user-friendly message based on error type
      let userFriendlyMsg = errorMsg;
      
      // Map common error patterns to better messages
      if (isNetworkError) {
        userFriendlyMsg = 'Network connection issue - please check your internet connection.'
      } else if (errorMsg.includes('permission') || errorMsg.includes('denied')) {
        userFriendlyMsg = 'You don\'t have permission to perform this action.'
      }
      
      // Prepare detailed error metadata for workflow state
      const errorMetadata = {
        error: userFriendlyMsg,
        errorDetails: {
          originalError: error instanceof Error ? error.toString() : String(error),
          timestamp: new Date().toISOString(),
          isNetworkError,
          ...(options?.details || {})
        },
        previousStep: options?.step || currentStep,
        errorType: isNetworkError ? 'network' : 'application'
      }
      
      // Update workflow step to error with context
      updateWorkflowStep('error', errorMetadata)
      
      // Set error in state
      setError(userFriendlyMsg)
      
      // Show toast notification if not disabled
      if (options?.showToast !== false) {
        toast({
          title: isNetworkError ? 'Network Error' : 'Error',
          description: userFriendlyMsg,
          variant: 'destructive',
        })
      }
      
      // Update the database if needed
      updateDatabaseWorkflowState('error', errorMetadata)
    },
    
    clearError: () => {
      setError(null)
    }
  }
}
```

## API Error Handling

API routes use a consistent error handling pattern:

```typescript
// Helper to create standardized error responses
export function apiError(
  error: unknown,  
  defaultMessage = 'An unexpected error occurred',
  defaultStatus = 500
) {
  const normalizedError = normalizeError(error)
  
  return NextResponse.json(
    {
      error: normalizedError.message || defaultMessage,
      code: normalizedError.code || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
      details: normalizedError.data,
    },
    { status: normalizedError.status || defaultStatus }
  )
}

// Higher-order function to wrap route handlers with error handling
export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (req, context) => {
    try {
      return await handler(req, context)
    } catch (error) {
      logger.error('API error', { path: req.nextUrl.pathname, error: normalizeError(error) })
      return apiError(error)
    }
  }
}

// Example route using the error handling
export const POST = withErrorHandling(async (req) => {
  const { documentId } = await req.json()
  
  if (!documentId) {
    throw new ValidationError('Document ID is required')
  }
  
  // Route implementation...
})
```

## Error Normalization

The `normalizeError` utility ensures consistent error format:

```typescript
export function normalizeError(error: unknown): NormalizedError {
  // Already a structured error
  if (error instanceof ApplicationError) {
    return {
      message: error.message,
      code: error.code,
      status: error.status,
      data: error.data,
      stack: error.stack,
    }
  }
  
  // Standard Error
  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR',
      status: 500,
      stack: error.stack,
    }
  }
  
  // String error
  if (typeof error === 'string') {
    return {
      message: error,
      code: 'UNKNOWN_ERROR',
      status: 500,
    }
  }
  
  // Unknown error type
  return {
    message: 'An unknown error occurred',
    code: 'UNKNOWN_ERROR',
    status: 500,
    data: { originalError: error },
  }
}
```

## Specialized Workflow Error Handler

Our new dedicated workflow error handler provides stage-specific error handling and recovery:

```typescript
/**
 * Specialized error handler for workflow-specific errors
 * with stage-specific recovery strategies
 */
export class WorkflowErrorHandler {
  /**
   * Stage-specific recovery strategies
   */
  async recoverFromError(
    targetStage: WorkflowStep,
    metadata: WorkflowErrorMetadata
  ): Promise<boolean> {
    const store = useChatStore.getState()
    
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
          
          // Clear error state and retry upload
          store.setError(null)
          store.updateWorkflowStep('uploading', {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: (metadata.details?.retryCount || 0) + 1,
          })
          
          return true
        }
          
        case 'extracting': {
          // Retry extraction with existing document
          const documentId = metadata.details?.documentId
          if (!documentId) {
            return false
          }
          
          // Return to extraction state
          store.setError(null)
          store.updateWorkflowStep('extracting', {
            isRetry: true,
            documentId,
            previousError: metadata.errorMessage,
            retryCount: (metadata.details?.retryCount || 0) + 1,
          })
          
          return true
        }
          
        case 'verification':
        case 'verification_in_progress':
          // Return to verification with existing data
          store.setError(null)
          store.updateWorkflowStep(targetStage, {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: (metadata.details?.retryCount || 0) + 1,
          })
          return true
          
        // More stage-specific recovery strategies...
      }
    } catch (recoveryError) {
      // Handle recovery failures
      console.error('Error during recovery attempt:', recoveryError)
      store.setError(`Recovery failed: ${normalizeError(recoveryError).message}`)
      return false
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
        return ['verification', 'verification_in_progress']
      case 'report_generation':
        return ['verification_completed', 'report_generation']
      // Other step-specific recovery paths...
    }
  }
}
```

## Workflow State Machine Error Handling

Workflow errors are handled through a state machine approach:

```typescript
// In lib/workflow/types.ts - State transitions for error recovery
export const ALLOWED_TRANSITIONS: WorkflowTransition[] = [
  // Normal workflow transitions...
  
  // Error recovery paths
  { from: 'error', to: 'idle', description: 'Reset after error' },
  { from: 'error', to: 'uploading', allowData: true, description: 'Retry upload after error' },
  { from: 'error', to: 'extracting', allowData: true, description: 'Retry extraction after error' },
  { from: 'error', to: 'verification', allowData: true, description: 'Return to verification after error' },
  { from: 'error', to: 'report_generation', allowData: true, description: 'Retry report generation after error' },
  
  // Any state can transition to error
  { from: 'idle', to: 'error', requireData: true, description: 'Error in idle state' },
  { from: 'uploading', to: 'error', requireData: true, description: 'Error during upload' },
  { from: 'extracting', to: 'error', requireData: true, description: 'Error during extraction' },
  // Other error transitions...
]
```

## Database Error Tracking

Errors are recorded in the database for later analysis:

```typescript
async function updateDatabaseWorkflowState(
  step: WorkflowStep,
  metadata?: Record<string, any>
) {
  try {
    // Normal update logic...
    
    // For error states, add additional metadata
    if (step === 'error') {
      const errorMetadata = {
        ...(metadata || {}),
        errorOccurredAt: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      }
      
      await supabase
        .from('workflow_errors')
        .insert({
          workflow_id: workflowId,
          error_message: metadata?.error || 'Unknown error',
          error_type: metadata?.errorType || 'unknown',
          previous_step: metadata?.previousStep || 'unknown',
          error_details: errorMetadata,
          created_at: new Date().toISOString(),
        })
    }
  } catch (error) {
    console.error('Failed to update workflow state in database:', error)
  }
}
```

## Logging System

Structured logging provides error visibility:

```typescript
// In lib/logger.ts
export const logger = {
  debug: (message: string, meta?: LogMeta) => log('debug', message, meta),
  info: (message: string, meta?: LogMeta) => log('info', message, meta),
  warn: (message: string, meta?: LogMeta) => log('warn', message, meta),
  error: (message: string, meta?: LogMeta) => log('error', message, meta),
  fatal: (message: string, meta?: LogMeta) => log('fatal', message, meta),
  
  withMetadata: (metadata: Record<string, any>) => ({
    debug: (message: string, meta?: LogMeta) => 
      log('debug', message, { ...metadata, ...meta }),
    info: (message: string, meta?: LogMeta) => 
      log('info', message, { ...metadata, ...meta }),
    warn: (message: string, meta?: LogMeta) => 
      log('warn', message, { ...metadata, ...meta }),
    error: (message: string, meta?: LogMeta) => 
      log('error', message, { ...metadata, ...meta }),
    fatal: (message: string, meta?: LogMeta) => 
      log('fatal', message, { ...metadata, ...meta }),
  })
}
```

## Rate Limiting

Rate limiting protects the application from abuse:

```typescript
// In lib/rate-limit.ts
export default withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Max 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString(),
  },
  handler: (_, res) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
    })
  },
})
```

## Real-Time Sync Error Handling

The real-time synchronization system includes specific error handling:

```typescript
// In lib/hooks/use-workflow-sync.ts
export function useWorkflowSync(workflowId?: string) {
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    // Setup real-time subscription...
    
    const setupRealtimeSubscription = async () => {
      try {
        // Subscription setup logic...
      } catch (err) {
        console.error('Error setting up real-time subscription:', err)
        setError(`Failed to initialize sync: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    
    setupRealtimeSubscription()
    
    // Cleanup...
  }, [workflowId])
  
  return {
    // Other return values...
    error,
    forceSync: async () => {
      try {
        // Sync logic...
        return true
      } catch (err) {
        console.error('Error during force sync:', err)
        setError(`Force sync failed: ${err instanceof Error ? err.message : String(err)}`)
        return false
      }
    }
  }
}
```

## Enhanced Error Boundaries

We've implemented specialized error boundaries for different parts of the application:

```typescript
/**
 * Enhanced error boundary for workflow components
 */
export function WorkflowErrorBoundary({
  children,
  workflowStep,
  patientId,
  fallbackComponent: FallbackComponent,
}: WorkflowErrorBoundaryProps) {
  // Function to handle errors caught by the boundary
  const handleError = (error: Error) => {
    console.error('Workflow error boundary caught error:', error)
    
    // Normalize error and get metadata
    const errorHandler = workflowErrorHandler
    
    // Create error metadata
    const metadata = errorHandler.createErrorMetadata(
      error,
      workflowStep || 'error'
    )
    
    // Log the error
    void errorHandler.logError(metadata)
    
    // Update global state with error
    const store = useChatStore.getState()
    store.setError(metadata.errorMessage)
    store.updateWorkflowStep('error', {
      error: metadata.errorMessage,
      errorDetails: metadata.details,
      previousStep: workflowStep,
      recoveryPaths: metadata.recoveryPaths,
    })
    
    // Attach recovery paths to error for fallback component
    Object.assign(error, {
      step: workflowStep, 
      recoveryPaths: metadata.recoveryPaths
    })
  }
  
  return (
    <ErrorBoundary
      fallbackRender={(props) => 
        FallbackComponent ? (
          <FallbackComponent {...props} />
        ) : (
          <DefaultFallback 
            {...props} 
            workflowStep={workflowStep}
            patientId={patientId}
          />
        )
      }
      onError={handleError}
    >
      {children}
    </ErrorBoundary>
  )
}
```

Our error boundary provides a smart fallback UI that offers contextual recovery options:

```tsx
function DefaultFallback({ 
  error, 
  resetErrorBoundary,
  workflowStep,
  patientId 
}: FallbackProps) {
  const router = useRouter()
  const [selectedRecoveryPath, setSelectedRecoveryPath] = useState<WorkflowStep | ''>('')
  const errorHandler = useWorkflowErrorHandler(apiClient)
  
  // Get available recovery paths
  const recoveryPaths = error.recoveryPaths || 
    (workflowStep ? errorHandler.getRecoveryPaths(workflowStep) : ['idle'])
  
  // Handle recovery attempt
  const handleRecovery = async () => {
    if (!selectedRecoveryPath) {
      return
    }
    
    try {
      // Attempt stage-specific recovery
      if (selectedRecoveryPath === 'idle') {
        // Full reset to idle state
        useChatStore.getState().resetChat()
        router.push(`/dashboard/chat?patientId=${patientId || ''}`)
      } else {
        // Stage-specific recovery
        await errorHandler.recoverFromError(
          selectedRecoveryPath,
          {
            errorMessage: error.message,
            workflowStep: workflowStep || 'error',
            previousStep: error.step,
            timestamp: new Date().toISOString(),
          }
        )
      }
      
      // Reset the error boundary
      resetErrorBoundary()
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError)
      // Try again with a simple reset
      resetErrorBoundary()
    }
  }
  
  // UI with multiple recovery options...
}
```

## In-Page Error Recovery UI

For non-fatal errors, we provide an in-page error recovery UI with multiple recovery paths:

```tsx
{/* Error recovery UI - enhanced with stage-specific recovery options */}
{error && (
  <div className="px-4 pt-4">
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="size-4" />
      <AlertTitle>Workflow Error</AlertTitle>
      <AlertDescription>
        {error}
        <div className="mt-4 space-y-3">
          {/* Recovery options based on workflow stage */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Recovery Options</div>
            <div className="flex flex-wrap gap-2">
              {handleError.getRecoveryPaths().map((path) => (
                <Button
                  key={path}
                  className="gap-1 rounded-full px-3 py-1"
                  onClick={() => {
                    // Try stage-specific recovery
                    void handleError.recoverFromError(path, {
                      error,
                      previousStep: workflowStep,
                      currentUpload
                    });
                  }}
                  size="sm"
                  variant="outline"
                >
                  {path === 'idle' ? 'Reset' : 
                   path === 'uploading' ? 'Retry Upload' :
                   path === 'extracting' ? 'Retry Extraction' :
                   path === 'verification' ? 'Resume Verification' :
                   path === 'report_generation' ? 'Retry Report' :
                   'Go to ' + path.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  </div>
)}
```

## Best Practices

1. **Use Typed Errors**: Always use the appropriate error type from the hierarchy
2. **Context is Key**: Include relevant workflow context with all errors
3. **User-Friendly Messages**: Present clear, actionable error messages to users
4. **Log Details**: Log detailed error information for debugging
5. **Recovery Paths**: Define clear recovery paths for common errors
6. **Centralize Handling**: Use the `WorkflowErrorHandler` service for consistency
7. **Database Tracking**: Record critical errors for later analysis
8. **Stage-Specific Recovery**: Implement tailored recovery strategies for each workflow stage
9. **Error Boundaries**: Use specialized error boundaries for critical components
10. **Multiple Recovery Options**: Provide users with multiple ways to recover from errors

## Error Analytics

Errors recorded in the database can be analyzed to:

1. Identify common failure points
2. Track error rates over time
3. Correlate errors with specific users, documents, or workflow steps
4. Prioritize fixes based on frequency and impact
5. Monitor the effectiveness of error handling improvements
6. Analyze recovery success rates for different strategies
7. Identify patterns in error occurrences across workflow stages

This comprehensive error system ensures Neuvia can gracefully handle errors in a medical context where reliability is paramount, preserving user work and context even when problems occur.