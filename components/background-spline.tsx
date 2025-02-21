'use client'

import Spline from '@splinetool/react-spline/next'

export default function BackgroundSpline() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <Spline
        scene="https://prod.spline.design/Y6XgUDfF8whAr82F/scene.splinecode"
        className="h-full w-full"
      />
    </div>
  )
}
