"use client"

import { PatientDistribution } from "../types"

interface PieChartProps {
  data: PatientDistribution[]
  size?: number
}

export function PieChart({ data, size = 120 }: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  let currentAngle = 0

  // Calculate paths for each segment
  const segments = data.map((d, i) => {
    const angle = (d.count / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle += angle

    // Convert angles to radians and calculate path
    const startRad = (startAngle - 90) * Math.PI / 180
    const endRad = (endAngle - 90) * Math.PI / 180
    const x1 = size/2 + size/2 * Math.cos(startRad)
    const y1 = size/2 + size/2 * Math.sin(startRad)
    const x2 = size/2 + size/2 * Math.cos(endRad)
    const y2 = size/2 + size/2 * Math.sin(endRad)

    const largeArc = angle > 180 ? 1 : 0

    const path = [
      `M ${size/2},${size/2}`,
      `L ${x1},${y1}`,
      `A ${size/2},${size/2} 0 ${largeArc},1 ${x2},${y2}`,
      'Z'
    ].join(' ')

    return {
      path,
      color: d.color,
      percentage: Math.round((d.count / total) * 100)
    }
  })

  return (
    <div className="relative">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((segment, i) => (
          <path
            key={i}
            d={segment.path}
            fill={segment.color}
            className="transition-all duration-300 hover:opacity-80"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-xs text-white/70">
          {segments.length} groups
        </div>
      </div>
    </div>
  )
} 