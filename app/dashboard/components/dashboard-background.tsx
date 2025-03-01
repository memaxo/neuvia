'use client'

import type { Application } from '@splinetool/runtime'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

// Create a client-side wrapper for Spline with error boundary and proper SSR handling
const SplineWrapper = dynamic(
  () =>
    import('./spline-wrapper').catch((err) => {
      console.error('Error loading Spline:', err)
      return () => (
        <div className="flex size-full items-center justify-center bg-[rgb(var(--error))/var(--opacity-10)]">
          <p className="text-[rgb(var(--error))]">
            Failed to load 3D scene: {err.message}
          </p>
        </div>
      )
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="size-8 animate-spin rounded-full border-4 border-[rgb(var(--primary))] border-t-transparent" />
          <p className="text-[rgb(var(--foreground))/var(--opacity-70)]">
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

export default function DashboardBackground({
  nonce,
}: DashboardBackgroundProps) {
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
      {
        threshold: 0.1,
        rootMargin: '50px', // Preload slightly before visible
      }
    )

    const element = document.getElementById('spline-container')
    if (element) {
      observer.observe(element)
    }

    setIsMounted(true)

    return () => {
      if (splineRef.current) {
        splineRef.current.dispose?.()
      }
      observer.disconnect()
    }
  }, [])

  const handleSplineLoad = (splineApp: ExtendedApplication) => {
    try {
      splineRef.current = splineApp

      if (splineApp.scene) {
        // Optimize performance based on device capabilities
        if (splineApp.setRenderRate) {
          // Lower FPS for better performance while maintaining smooth animation
          splineApp.setRenderRate(24)
        }
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  if (!isMounted) {
    return (
      <div className="flex size-full items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="size-8 animate-spin rounded-full border-4 border-[rgb(var(--primary))] border-t-transparent" />
          <p className="text-[rgb(var(--foreground))/var(--opacity-70)]">
            Initializing scene...
          </p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex size-full items-center justify-center bg-[rgb(var(--error))/var(--opacity-10)]">
        <p className="text-[rgb(var(--error))]">
          Error loading scene: {loadError}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'duration-normal absolute inset-0 size-full overflow-hidden transition-all',
        !isVisible && 'opacity-0'
      )}
      id="spline-container"
      style={{
        pointerEvents: 'none',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {isVisible && (
        <div className="absolute inset-0 size-full">
          <SplineWrapper
            className="size-full object-cover opacity-60"
            nonce={nonce}
            onLoad={handleSplineLoad}
            scene="https://prod.spline.design/xUUjAFVfSxeg2fVu/scene.splinecode"
          />
          {/* Two-layer overlay for consistent opacity and smooth transitions */}
          <div className="absolute inset-0 bg-gradient-to-br from-[rgb(var(--background))] via-[rgb(var(--background))/97] to-[rgb(var(--background))/95]" />
          <div className="absolute inset-0 backdrop-blur-[1px]" />
        </div>
      )}
    </div>
  )
}
