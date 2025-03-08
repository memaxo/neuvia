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
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
          <Card className="w-full max-w-xl p-6 shadow-md">
            <div className="flex flex-col items-center space-y-4 text-center">
              <AlertTriangle className="text-destructive" size={40} />
              <h1 className="text-2xl font-bold">Something went wrong!</h1>
              
              <div className="text-muted-foreground text-sm">
                <p>We&apos;re sorry, but an unexpected error occurred.</p>
                {error.digest && (
                  <p className="mt-2">
                    Error ID: <code className="bg-muted rounded p-1 text-xs">{error.digest}</code>
                  </p>
                )}
                {process.env.NODE_ENV !== 'production' && (
                  <div className="bg-muted mt-4 max-h-40 overflow-auto rounded p-4 text-left">
                    <p className="font-medium">{error.message}</p>
                    {error.stack && (
                      <pre className="mt-2 whitespace-pre-wrap text-xs">
                        {error.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
              
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button onClick={reset} variant="default">
                  <RefreshCw className="mr-2 size-4" />
                  Try Again
                </Button>
                <Button asChild variant="outline">
                  <Link href="/">
                    <Home className="mr-2 size-4" />
                    Go to Home
                  </Link>
                </Button>
              </div>
              
              <p className="text-muted-foreground mt-6 text-xs">
                If the problem persists, please contact our support team.
              </p>
            </div>
          </Card>
        </div>
      </body>
    </html>
  )
}