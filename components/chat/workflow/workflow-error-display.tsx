'use client'

import React, { useCallback, useMemo } from 'react'
import { useChatStore } from '@/stores/chat-store'
import { 
  AlertCircle, 
  RefreshCw, 
  X, 
  AlertTriangle, 
  Network, 
  ShieldAlert,
  FileWarning,
  FileX
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { WorkflowErrorCategory } from '@/lib/workflow/workflow-error-handler'
import { cn } from '@/lib/utils'
// Import specialized workflow hooks
import { useDocumentWorkflow } from '@/lib/workflow/hooks/use-document-workflow'
import { useVerificationWorkflow } from '@/lib/workflow/hooks/use-verification-workflow'
import { useReportWorkflow } from '@/lib/workflow/hooks/use-report-workflow'

interface WorkflowErrorDisplayProps {
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  showIcon?: boolean
  compact?: boolean
}

/**
 * Display component for workflow errors that integrates with specialized hooks
 * Provides appropriate icons, messages, and actions based on error category
 */
export function WorkflowErrorDisplay({
  onRetry,
  onDismiss,
  className,
  showIcon = true,
  compact = false
}: WorkflowErrorDisplayProps) {
  // Get the user ID and chat ID for workflow hook initialization
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_user_id') || undefined : undefined
  const chatId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_chat_id') || undefined : undefined
  
  // Initialize specialized workflow hooks to access their error states
  const {
    state: documentState,
    status: documentStatus
  } = useDocumentWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  const {
    state: verificationState,
    status: verificationStatus
  } = useVerificationWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  const {
    state: reportState,
    status: reportStatus
  } = useReportWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  // Get error information from specialized hooks with useMemo for better performance
  const { error, errorMetadata } = useMemo(() => {
    // Check each specialized hook for errors
    const error = documentState.error || verificationState.error || reportState.error || null
    
    // Get error metadata from the hook that has the error
    let metadata: Record<string, unknown> | undefined;
    let category: WorkflowErrorCategory | undefined;
    let timestamp: string | undefined;
    let retriable: boolean | undefined;
    let previousStep: string | undefined;
    
    if (documentState.error) {
      // Document workflow has the error
      metadata = documentState.metadata?.errorDetails as Record<string, unknown>;
      category = documentState.metadata?.errorCategory as WorkflowErrorCategory;
      timestamp = documentState.metadata?.errorTimestamp as string;
      retriable = documentState.metadata?.errorRetry as boolean;
      previousStep = documentState.metadata?.previousStep as string;
    } else if (verificationState.error) {
      // Verification workflow has the error
      metadata = verificationState.metadata?.errorDetails as Record<string, unknown>;
      category = verificationState.metadata?.errorCategory as WorkflowErrorCategory;
      timestamp = verificationState.metadata?.errorTimestamp as string;
      retriable = verificationState.metadata?.errorRetry as boolean;
      previousStep = verificationState.metadata?.previousStep as string;
    } else if (reportState.error) {
      // Report workflow has the error
      metadata = reportState.metadata?.errorDetails as Record<string, unknown>;
      category = reportState.metadata?.errorCategory as WorkflowErrorCategory;
      timestamp = reportState.metadata?.errorTimestamp as string;
      retriable = reportState.metadata?.errorRetry as boolean;
      previousStep = reportState.metadata?.previousStep as string;
    }
    
    // If we don't have error metadata from the specialized hooks, check the store
    // for backward compatibility
    if (!error) {
      // Get Zustand store error information for backward compatibility
      const storeError = useChatStore.getState().error;
      const storeMetadata = useChatStore.getState().workflow.data.errorDetails;
      const storeCategory = useChatStore.getState().workflow.data.errorCategory as WorkflowErrorCategory;
      const storeTimestamp = useChatStore.getState().workflow.data.errorTimestamp as string;
      const storeRetriable = useChatStore.getState().workflow.data.errorRetry as boolean;
      const storePreviousStep = useChatStore.getState().workflow.data.previousStep as string;
      
      if (storeError) {
        metadata = storeMetadata;
        category = storeCategory;
        timestamp = storeTimestamp;
        retriable = storeRetriable;
        previousStep = storePreviousStep;
      }
    }
    
    return {
      error,
      errorMetadata: {
        metadata,
        category,
        timestamp,
        retriable: retriable ?? true, // Default to retriable if not specified
        previousStep
      }
    };
  }, [
    documentState.error, 
    verificationState.error, 
    reportState.error,
    documentState.metadata,
    verificationState.metadata,
    reportState.metadata
  ]);
  
  // No need to render if there's no error
  if (!error) return null
  
  // Get appropriate error icon based on error category
  const getErrorIcon = () => {
    const category = errorMetadata.category
    
    switch (category) {
      case WorkflowErrorCategory.NETWORK:
        return <Network className="text-destructive size-5" />
      case WorkflowErrorCategory.PERMISSION:
        return <ShieldAlert className="text-destructive size-5" />
      case WorkflowErrorCategory.UPLOAD:
        return <FileX className="text-destructive size-5" />
      case WorkflowErrorCategory.PROCESSING:
        return <FileWarning className="text-destructive size-5" />
      case WorkflowErrorCategory.VERIFICATION:
        return <AlertTriangle className="text-destructive size-5" />
      default:
        return <AlertCircle className="text-destructive size-5" />
    }
  }
  
  // Get appropriate title based on error category
  const getErrorTitle = () => {
    const category = errorMetadata.category
    
    switch (category) {
      case WorkflowErrorCategory.NETWORK:
        return 'Network Error'
      case WorkflowErrorCategory.PERMISSION:
        return 'Permission Error'
      case WorkflowErrorCategory.UPLOAD:
        return 'Upload Error'
      case WorkflowErrorCategory.PROCESSING:
        return 'Processing Error'
      case WorkflowErrorCategory.VERIFICATION:
        return 'Verification Error'
      case WorkflowErrorCategory.REPORT:
        return 'Report Generation Error'
      default:
        return 'Error'
    }
  }
  
  // Dismiss error using specialized hooks
  const handleDismiss = useCallback(() => {
    // Identify which workflow has the error and clear it specifically
    if (documentState.error) {
      // Clear document workflow error
      void documentStatus.updateStep('idle', {
        error: null,
        errorDetails: null,
        errorTimestamp: null,
        errorRetry: null
      })
    } else if (verificationState.error) {
      // Clear verification workflow error
      void verificationStatus.updateStep('idle', {
        error: null,
        errorDetails: null,
        errorTimestamp: null,
        errorRetry: null
      })
    } else if (reportState.error) {
      // Clear report workflow error
      void reportStatus.updateStep('idle', {
        error: null,
        errorDetails: null,
        errorTimestamp: null,
        errorRetry: null
      })
    } else {
      // If no specific error found, clear all hooks for safety
      void documentStatus.updateStep('idle', { error: null })
      void verificationStatus.updateStep('idle', { error: null })
      void reportStatus.updateStep('idle', { error: null })
    }
    
    // For backward compatibility
    useChatStore.getState().setError(null)
    
    // Call parent dismiss handler if provided
    onDismiss?.()
  }, [
    documentState.error, 
    verificationState.error, 
    reportState.error,
    documentStatus,
    verificationStatus,
    reportStatus,
    onDismiss
  ])
  
  // Try to retry the operation with better specialized hook integration
  const handleRetry = useCallback(() => {
    // Get the previous step to retry
    const previousStep = errorMetadata.previousStep
    
    if (!previousStep) {
      // If no previous step, just reset to idle
      handleDismiss()
      onRetry?.()
      return
    }
    
    // Determine which hook to use for retry based on the domain of the previous step
    if (previousStep === 'uploading' || previousStep === 'extracting') {
      // Document workflow domain - use document workflow hook for retry
      void documentStatus.updateStep(previousStep as any, {
        error: null,
        errorDetails: null,
        errorTimestamp: null,
        retrying: true,
        retryTimestamp: new Date().toISOString()
      })
    } else if (previousStep === 'verification' || 
              previousStep === 'verification_pending' || 
              previousStep === 'verification_in_progress') {
      // Verification workflow domain - use verification workflow hook for retry
      void verificationStatus.updateStep(previousStep as any, {
        error: null,
        errorDetails: null,
        errorTimestamp: null,
        retrying: true,
        retryTimestamp: new Date().toISOString()
      })
    } else if (previousStep === 'report_generation') {
      // Report workflow domain - use report workflow hook for retry
      void reportStatus.updateStep(previousStep as any, {
        error: null,
        errorDetails: null,
        errorTimestamp: null,
        retrying: true,
        retryTimestamp: new Date().toISOString()
      })
    } else {
      // For any other step, use the appropriate hook based on which one has the error
      if (documentState.error) {
        void documentStatus.updateStep('idle', { error: null })
      } else if (verificationState.error) {
        void verificationStatus.updateStep('idle', { error: null })
      } else if (reportState.error) {
        void reportStatus.updateStep('idle', { error: null })
      }
    }
    
    // Call parent retry handler if provided
    onRetry?.()
  }, [
    errorMetadata.previousStep,
    documentState.error,
    verificationState.error,
    reportState.error,
    documentStatus,
    verificationStatus,
    reportStatus,
    handleDismiss,
    onRetry
  ])
  
  // Format error timestamp if available
  const formattedTime = errorMetadata.timestamp 
    ? new Date(errorMetadata.timestamp).toLocaleTimeString() 
    : ''
  
  // For compact display, use a simpler alert with just basics
  if (compact) {
    return (
      <Alert 
        className={cn("flex items-center justify-between", className)} 
        variant="destructive"
      >
        <div className="flex items-center gap-2">
          {showIcon && getErrorIcon()}
          <AlertTitle className="text-sm">{getErrorTitle()}</AlertTitle>
        </div>
        
        <div className="flex items-center gap-2">
          {errorMetadata.retriable && (
            <Button 
              className="h-7 gap-1 px-2" 
              onClick={handleRetry} 
              size="sm" 
              variant="outline"
            >
              <RefreshCw className="size-3" />
              <span className="text-xs">Retry</span>
            </Button>
          )}
          
          <Button 
            className="size-7 p-0" 
            onClick={handleDismiss} 
            size="sm" 
            variant="ghost"
          >
            <X className="size-3" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      </Alert>
    )
  }
  
  // Full display with more details
  return (
    <Alert 
      className={cn("space-y-3", className)} 
      variant="destructive"
    >
      <div className="flex items-start justify-between">
        <div className="flex gap-2">
          {showIcon && getErrorIcon()}
          <div>
            <AlertTitle className="mb-1 font-medium">{getErrorTitle()}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </div>
        </div>
        
        <Button 
          className="mt-1 size-7 p-0" 
          onClick={handleDismiss} 
          size="sm" 
          variant="ghost"
        >
          <X className="size-3" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
      
      {formattedTime && (
        <div className="pl-7 text-xs opacity-70">
          Error occurred at {formattedTime}
        </div>
      )}
      
      {errorMetadata.retriable && (
        <div className="flex items-center gap-2 pl-7 pt-1">
          <Button 
            className="h-8 gap-1"
            onClick={handleRetry} 
            size="sm" 
            variant="outline"
          >
            <RefreshCw className="size-3" />
            <span className="text-xs">Retry Operation</span>
          </Button>
          
          {errorMetadata.previousStep && (
            <div className="text-xs opacity-70">
              From {errorMetadata.previousStep.replace(/_/g, ' ')}
            </div>
          )}
        </div>
      )}
    </Alert>
  )
}