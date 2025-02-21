"use client"

import { Suspense, useEffect } from 'react'
import Spline from '@splinetool/react-spline/next'
import type { Application } from '@splinetool/runtime'

interface SplineWrapperProps {
  scene: string
  className?: string
  onLoad?: (splineApp: Application) => void
}

export default function SplineWrapper({ scene, className, onLoad }: SplineWrapperProps) {
  useEffect(() => {
    console.log('SplineWrapper mounted with scene:', scene)
  }, [scene])

  return (
    <Suspense fallback={
      <div className={`w-full h-full bg-black/80 backdrop-blur-lg animate-pulse ${className}`} />
    }>
      <div className="relative w-full h-full">
        <Spline
          scene={scene}
          className={`absolute inset-0 ${className}`}
          onLoad={(splineApp) => {
            console.log('Spline onLoad called')
            onLoad?.(splineApp)
          }}
        />
      </div>
    </Suspense>
  )
} 