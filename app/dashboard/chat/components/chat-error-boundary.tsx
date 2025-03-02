'use client'

import { useRouter } from 'next/navigation'
import React from 'react'
import logger from '@/lib/logger'
import { normalizeError } from '@/lib/errors'

interface ChatErrorBoundaryProps {
  children: React.ReactNode
}

interface ChatErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ChatErrorBoundary extends React.Component<
  ChatErrorBoundaryProps,
  ChatErrorBoundaryState
> {
  constructor(props: ChatErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ChatErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const normalizedError = normalizeError(error);
    const errorLogger = logger.withMetadata({
      component: 'ChatErrorBoundary',
      errorName: normalizedError.name,
      errorCode: normalizedError.code,
      componentStack: errorInfo.componentStack
    });
    
    errorLogger.error('Chat component error', {}, normalizedError);
    
    // You could add monitoring service integration here
    // Example: Sentry.captureException(normalizedError);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
            <h2 className="mb-2 text-lg font-semibold text-red-700">
              Something went wrong
            </h2>
            <p className="text-sm text-red-600">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              className="mt-4 rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
              onClick={() => {
                this.setState({ hasError: false })
                window.location.reload()
              }}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
