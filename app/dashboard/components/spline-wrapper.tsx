'use client'

import Spline from '@splinetool/react-spline'
import type { Application } from '@splinetool/runtime'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

interface SplineWrapperProps {
  scene: string
  className?: string
  onLoad?: (spline: Application) => void
  nonce?: string
}

export default function SplineWrapper({
  scene,
  className = '',
  onLoad,
  nonce,
}: SplineWrapperProps) {
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Reset states when scene URL changes
    setError(null)
    setIsLoading(true)
  }, [scene])

  const handleLoad = (splineApp: Application) => {
    console.log('SplineWrapper: Scene loaded successfully')
    setIsLoading(false)
    onLoad?.(splineApp)
  }

  const handleError = (err: unknown) => {
    console.error('SplineWrapper: Error loading scene:', err)
    setError(err instanceof Error ? err : new Error(String(err)))
    setIsLoading(false)
  }

  if (error) {
    return (
      <div className="flex size-full items-center justify-center bg-red-500/20">
        <p className="text-red-500">Failed to load scene: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="relative size-full">
      <Spline
        className={cn('absolute inset-0 size-full object-cover', className)}
        nonce={nonce}
        onError={handleError}
        onLoad={handleLoad}
        scene={scene}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="space-y-4 text-center">
            <div className="size-8 animate-spin rounded-full border-4 border-[rgb(var(--primary))] border-t-transparent" />
            <p className="text-[rgb(var(--foreground)/var(--opacity-70))]">
              Loading scene...
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
