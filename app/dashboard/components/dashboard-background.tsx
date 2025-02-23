'use client'

import type { Application } from '@splinetool/runtime'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

// Create a client-side wrapper for Spline with error boundary and proper SSR handling
const SplineWrapper = dynamic(
  () =>
    import('./spline-wrapper').catch((err) => {
      console.error('Error loading Spline:', err)
      return () => (
        <div className="flex size-full items-center justify-center bg-red-500/20">
          <p className="text-red-500">Failed to load 3D scene: {err.message}</p>
        </div>
      )
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="size-8 animate-spin rounded-full border-4 border-[rgb(var(--primary))] border-t-transparent" />
          <p className="text-[rgb(var(--foreground)/var(--opacity-70))]">
            Loading 3D scene...
          </p>
        </div>
      </div>
    ),
  }
)

interface ExtendedApplication extends Application {
  scene?: unknown
  setRenderRate?: (fps: number) => void
}

interface DashboardBackgroundProps {
  nonce?: string
}

export default function DashboardBackground({ nonce }: DashboardBackgroundProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const splineRef = useRef<ExtendedApplication | null>(null)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Use intersection observer to load Spline only when visible
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting)
        })
      },
      { threshold: 0.1 }
    )

    const element = document.getElementById('spline-container')
    if (element) {
      observer.observe(element)
    }

    console.log('DashboardBackground mounting...')
    setIsMounted(true)

    return () => {
      console.log('DashboardBackground unmounting...')
      if (splineRef.current) {
        console.log('Cleaning up Spline instance...')
        // Proper cleanup of Spline instance
        splineRef.current.dispose?.()
      }
      observer.disconnect()
    }
  }, [])

  const handleSplineLoad = (splineApp: ExtendedApplication) => {
    try {
      console.log('Spline loaded successfully:', splineApp)
      splineRef.current = splineApp
      
      // Test if the scene is actually rendering
      if (splineApp.scene) {
        console.log('Scene loaded:', splineApp.scene)
        
        // Optimize performance by reducing update rate
        if (splineApp.setRenderRate) {
          splineApp.setRenderRate(30) // 30 FPS is usually sufficient for background scenes
        }
      } else {
        console.warn('Scene object is missing')
      }
    } catch (error) {
      console.error('Error in Spline load handler:', error)
      setLoadError(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  if (!isMounted) {
    return (
      <div className="flex size-full items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="size-8 animate-spin rounded-full border-4 border-[rgb(var(--primary))] border-t-transparent" />
          <p className="text-[rgb(var(--foreground)/var(--opacity-70))]">
            Initializing 3D scene...
          </p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex size-full items-center justify-center bg-red-500/20">
        <p className="text-red-500">Error loading 3D scene: {loadError}</p>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 size-full" id="spline-container">
      {isVisible && (
        <div className="absolute inset-0 size-full">
          <SplineWrapper
            className="size-full object-cover"
            nonce={nonce}
            onLoad={handleSplineLoad}
            scene="https://prod.spline.design/xUUjAFVfSxeg2fVu/scene.splinecode"
          />
        </div>
      )}
    </div>
  )
}
