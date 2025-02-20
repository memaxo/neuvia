"use client"

import Spline from '@splinetool/react-spline'

interface SplineWrapperProps {
  scene: string
  className?: string
}

export default function SplineWrapper({ scene, className }: SplineWrapperProps) {
  return (
    <Spline
      scene={scene}
      className={className}
    />
  )
} 