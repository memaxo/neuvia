'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/**
 * Global error handling component for the app
 * This is automatically used by Next.js for errors in layouts or pages
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to the console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('Global error occurred:', error)
    }
    
    // In production we would report this to our monitoring service
    // reportError(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
          <Card className="p-6 shadow-md w-full max-w-xl">
            <div className="flex flex-col items-center text-center space-y-4">
              <AlertTriangle size={40} className="text-destructive" />
              <h1 className="text-2xl font-bold">Something went wrong!</h1>
              
              <div className="text-sm text-muted-foreground">
                <p>We're sorry, but an unexpected error occurred.</p>
                {error.digest && (
                  <p className="mt-2">
                    Error ID: <code className="text-xs bg-muted p-1 rounded">{error.digest}</code>
                  </p>
                )}
                {process.env.NODE_ENV !== 'production' && (
                  <div className="mt-4 p-4 bg-muted rounded text-left overflow-auto max-h-40">
                    <p className="font-medium">{error.message}</p>
                    {error.stack && (
                      <pre className="text-xs mt-2 whitespace-pre-wrap">
                        {error.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <Button onClick={reset} variant="default">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/">
                    <Home className="mr-2 h-4 w-4" />
                    Go to Home
                  </Link>
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground mt-6">
                If the problem persists, please contact our support team.
              </p>
            </div>
          </Card>
        </div>
      </body>
    </html>
  )
}