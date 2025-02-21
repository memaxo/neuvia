'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Application } from '@splinetool/runtime'

// Create a client-side wrapper for Spline with error boundary
const SplineWrapper = dynamic(
  () =>
    import('./spline-wrapper').catch((err) => {
      console.error('Error loading Spline:', err)
      return () => (
        <div className="h-full w-full bg-red-500/20">
          Failed to load 3D scene
        </div>
      )
    }),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-black/80 backdrop-blur-lg" />
    ),
  }
)

export default function DashboardBackground() {
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
      // For example, finding specific objects or setting up animations
    } catch (error) {
      console.error('Error in Spline load handler:', error)
      setLoadError(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  if (!isMounted) {
    return <div className="h-full w-full bg-black/80 backdrop-blur-lg" />
  }

  if (loadError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-red-500/20">
        <p className="text-red-500">Error loading 3D scene: {loadError}</p>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <SplineWrapper
        scene="https://prod.spline.design/xUUjAFVfSxeg2fVu/scene.splinecode"
        className="absolute inset-0 h-full w-full object-cover"
        onLoad={handleSplineLoad}
      />
    </div>
  )
}
