'use client'

import React from 'react'
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

interface WorkflowErrorDisplayProps {
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  showIcon?: boolean
  compact?: boolean
}

/**
 * Display component for workflow errors that integrates with the Zustand store
 * Provides appropriate icons, messages, and actions based on error category
 */
export function WorkflowErrorDisplay({
  onRetry,
  onDismiss,
  className,
  showIcon = true,
  compact = false
}: WorkflowErrorDisplayProps) {
  // Get error information from store
  const error = useChatStore(state => state.error)
  const workflowError = useChatStore(state => state.workflow.workflowError)
  const errorMetadata = useChatStore(state => {
    const metadata = state.workflow.data.errorDetails
    const category = state.workflow.data.errorCategory as WorkflowErrorCategory
    const timestamp = state.workflow.data.errorTimestamp as string
    const retriable = state.workflow.data.errorRetry as boolean
    const previousStep = state.workflow.data.previousStep as string
    
    return { metadata, category, timestamp, retriable, previousStep }
  })
  
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
  
  // Dismiss error
  const handleDismiss = () => {
    // Call Zustand store to clear error
    useChatStore.getState().setError(null)
    
    // Call parent dismiss handler if provided
    onDismiss?.()
  }
  
  // Try to retry the operation
  const handleRetry = () => {
    // Call parent retry handler
    onRetry?.()
  }
  
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