'use client'

import type { ErrorInfo, ReactNode } from 'react';
import React, { Component } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: any[]
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * Component for catching and displaying React errors
 * Can be used at various levels of the component tree
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Update state with error details
    this.setState({
      errorInfo
    })
    
    // Call the optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
    
    // In production, we would send this to our error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: sendToErrorReportingService(error, errorInfo)
      console.error('Uncaught error:', error, errorInfo)
    }
  }
  
  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset the error boundary when the resetKeys change
    if (
      this.state.hasError && 
      this.props.resetKeys &&
      prevProps.resetKeys &&
      this.props.resetKeys.some((key, i) => key !== prevProps.resetKeys?.[i])
    ) {
      this.reset()
    }
  }
  
  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback
      }
      
      // Otherwise, use the default error UI
      return (
        <Card className="mx-auto my-8 w-full max-w-xl p-6 shadow-md">
          <div className="flex flex-col items-center space-y-4 text-center">
            <AlertTriangle className="text-destructive" size={40} />
            <h2 className="text-xl font-bold">Something went wrong</h2>
            
            <div className="text-muted-foreground text-sm">
              <p>We&apos;re sorry, but an error occurred while rendering this component.</p>
              {process.env.NODE_ENV !== 'production' && this.state.error && (
                <div className="bg-muted mt-4 max-h-40 overflow-auto rounded p-4 text-left">
                  <p className="font-medium">{this.state.error.toString()}</p>
                  {this.state.errorInfo && (
                    <pre className="mt-2 whitespace-pre-wrap text-xs">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
            
            <Button 
              className="mt-4"
              onClick={this.reset}
              variant="outline"
            >
              <RefreshCcw className="mr-2 size-4" />
              Try Again
            </Button>
          </div>
        </Card>
      )
    }

    return this.props.children
  }
}

/**
 * A simplified error boundary hook for function components
 * @example
 * function MyComponent() {
 *   const { ErrorBoundary, error } = useErrorBoundary()
 *   
 *   return (
 *     <ErrorBoundary>
 *       {error ? (
 *         <div>Error: {error.message}</div>
 *       ) : (
 *         <ChildComponent />
 *       )}
 *     </ErrorBoundary>
 *   )
 * }
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
  const displayName = Component.displayName || Component.name || 'Component'
  
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${displayName})`
  
  return WrappedComponent
}