'use client'

import Spline from '@splinetool/react-spline'
import type { Application } from '@splinetool/runtime'
import { Suspense, useEffect } from 'react'

interface SplineWrapperProps {
  readonly scene: string
  readonly className?: string
  readonly onLoad?: (splineApp: Application) => void
}

export default function SplineWrapper({
  scene,
  className,
  onLoad,
}: Readonly<SplineWrapperProps>) {
  useEffect(() => {
    console.log('SplineWrapper mounted with scene:', scene)
  }, [scene])

  return (
    <Suspense
      fallback={
        <div
          className={`size-full animate-pulse bg-black/80 backdrop-blur-lg ${className}`}
        />
      }
    >
      <div className="relative size-full">
        <Spline
          className={`absolute inset-0 ${className}`}
          onLoad={(splineApp: Application) => {
            console.log('Spline onLoad called')
            onLoad?.(splineApp)
          }}
          scene={scene}
        />
      </div>
    </Suspense>
  )
}
