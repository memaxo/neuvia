'use client'

import type { ErrorInfo, ReactNode } from 'react';
import React, { Component } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import { 
  WorkflowStateError, 
  DocumentProcessingError, 
  VerificationError,
  ReportGenerationError 
} from '@/lib/errors'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
  onRetry?: () => void
  onBack?: () => void
  workflowStep?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * Error Boundary component for workflow components
 * 
 * This component catches errors in its child components and displays a fallback UI
 * It includes specific handling for workflow-related errors to provide more context
 * and appropriate recovery options.
 */
export class WorkflowErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to an error reporting service
    console.error('Workflow Error Boundary caught an error:', error, errorInfo)
    
    // Update state with error info
    this.setState({
      errorInfo
    })
  }

  // Reset the error boundary state
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
    
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  // Handle retry action
  handleRetry = (): void => {
    this.handleReset()
    
    if (this.props.onRetry) {
      this.props.onRetry()
    }
  }

  // Handle back action
  handleBack = (): void => {
    this.handleReset()
    
    if (this.props.onBack) {
      this.props.onBack()
    }
  }

  // Determine the error details based on error type
  getErrorDetails(): { title: string; description: string; variant: 'default' | 'destructive' } {
    const { error } = this.state
    
    if (!error) {
      return {
        title: 'Unknown Error',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      }
    }
    
    // Check for workflow-specific errors
    if (error instanceof WorkflowStateError) {
      const transition = error.data?.transition as { from: string; to: string } | undefined
      const transitionInfo = transition 
        ? `from '${transition.from}' to '${transition.to}'` 
        : ''
      
      return {
        title: 'Workflow State Error',
        description: `${error.message} ${transitionInfo}. Please try a different action.`,
        variant: 'destructive'
      }
    }
    
    if (error instanceof DocumentProcessingError) {
      const phase = error.data?.phase
      const phaseInfo = phase ? ` during ${phase} phase` : ''
      
      return {
        title: 'Document Processing Error',
        description: `${error.message}${phaseInfo}. Try uploading the document again.`,
        variant: 'destructive'
      }
    }
    
    if (error instanceof VerificationError) {
      return {
        title: 'Verification Error',
        description: `${error.message}. You can try submitting the correction again or restart verification.`,
        variant: 'destructive'
      }
    }
    
    if (error instanceof ReportGenerationError) {
      return {
        title: 'Report Generation Error',
        description: `${error.message}. Please try generating the report again with different options.`,
        variant: 'destructive'
      }
    }
    
    // Generic error handling
    return {
      title: error.name || 'Error',
      description: error.message,
      variant: 'destructive'
    }
  }

  render(): ReactNode {
    const { hasError } = this.state
    const { children, fallback, workflowStep } = this.props
    
    if (!hasError) {
      return children
    }
    
    if (fallback) {
      return fallback
    }
    
    const { title, description, variant } = this.getErrorDetails()
    
    return (
      <div className="mx-auto max-w-3xl p-4">
        <Alert className="mb-4" variant={variant}>
          <AlertCircle className="size-4" />
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription className="mt-2">
            <p>{description}</p>
            {workflowStep && (
              <p className="text-muted-foreground mt-1 text-xs">
                Current workflow step: {workflowStep}
              </p>
            )}
            
            <div className="mt-4 flex gap-2">
              <Button 
                className="gap-1" 
                onClick={this.handleRetry} 
                size="sm" 
                variant="outline"
              >
                <RefreshCw className="size-3" /> 
                Retry
              </Button>
              
              <Button 
                className="gap-1" 
                onClick={this.handleBack} 
                size="sm" 
                variant="outline"
              >
                <ArrowLeft className="size-3" /> 
                Go Back
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }
}

// Higher-order component to wrap components with the error boundary
export function withWorkflowErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  return (props: P) => (
    <WorkflowErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </WorkflowErrorBoundary>
  )
}