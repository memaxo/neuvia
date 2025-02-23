'use client'

import type { Application } from '@splinetool/runtime'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

// Create a client-side wrapper for Spline with error boundary
const SplineWrapper = dynamic(
  () =>
    import('@/app/dashboard/components/spline-wrapper').catch((err) => {
      console.error('Error loading Spline:', err)
      return () => (
        <div className="pointer-events-none absolute inset-0 overflow-hidden bg-red-500/20">
          Failed to load 3D scene
        </div>
      )
    }),
  {
    ssr: false,
    loading: () => (
      <div className="pointer-events-none absolute inset-0 animate-pulse overflow-hidden bg-black/80 backdrop-blur-lg" />
    ),
  }
)

export default function BackgroundSpline({ nonce }: { nonce?: string }) {
  const [isMounted, setIsMounted] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const splineRef = useRef<Application | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleSplineLoad = (splineApp: Application) => {
    try {
      console.log('Spline loaded:', splineApp)
      splineRef.current = splineApp
      // You can add any initialization logic here
    } catch (error) {
      console.error('Error in Spline load handler:', error)
      setLoadError(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  if (!isMounted) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-black/80 backdrop-blur-lg" />
    )
  }

  if (loadError) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-red-500/20">
        <p className="text-red-500">Error loading 3D scene: {loadError}</p>
      </div>
    )
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <SplineWrapper
        nonce={nonce}
        className="size-full"
        onLoad={handleSplineLoad}
        scene="https://prod.spline.design/Y6XgUDfF8whAr82F/scene.splinecode"
      />
    </div>
  )
}
