"use client"

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Create a client-side wrapper for Spline
const SplineWrapper = dynamic(() => import('./spline-wrapper'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-black" />
})

export default function DashboardBackground() {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return <div className="w-full h-full bg-black" />
  }

  return (
    <div className="w-full h-full">
      <SplineWrapper
        scene="https://prod.spline.design/xUUjAFVfSxeg2fVu/scene.splinecode"
        className="w-full h-full object-cover"
      />
    </div>
  )
} 