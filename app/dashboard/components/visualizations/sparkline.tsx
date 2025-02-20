"use client"

import { TrendPoint } from "../types"

interface SparklineProps {
  data: TrendPoint[]
  color: string
  height?: number
}

export function Sparkline({ data, color, height = 30 }: SparklineProps) {
  const values = data.map(d => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  
  // Create points for the sparkline
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100
    const y = ((d.value - min) / range) * height
    return `${x},${height - y}`
  }).join(' ')

  return (
    <svg
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      {/* Background line (lighter) */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeOpacity="0.1"
      />
      
      {/* Foreground line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-glow"
      />
      
      {/* End point */}
      <circle
        cx={`${100}%`}
        cy={height - ((data[data.length - 1].value - min) / range) * height}
        r="2"
        fill={color}
        className="drop-shadow-glow"
      />
    </svg>
  )
} 