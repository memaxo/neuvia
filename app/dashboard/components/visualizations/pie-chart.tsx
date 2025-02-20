"use client"

import { PatientDistribution } from "../types"
import { useState } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface PieChartProps {
  data: PatientDistribution[]
  size?: number
}

export function PieChart({ data, size = 120 }: PieChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
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
      percentage: Math.round((d.count / total) * 100),
      status: d.status,
      count: d.count,
      startAngle,
      endAngle
    }
  })

  return (
    <TooltipProvider>
      <div className="relative group">
        <svg 
          width={size} 
          height={size} 
          viewBox={`0 0 ${size} ${size}`}
          className="transform transition-transform duration-300 group-hover:scale-105"
        >
          {/* Enhanced gradient definitions */}
          <defs>
            {segments.map((segment, i) => (
              <linearGradient
                key={`gradient-${i}`}
                id={`segment-gradient-${i}`}
                gradientTransform={`rotate(${(segment.startAngle + segment.endAngle) / 2} ${size/2} ${size/2})`}
              >
                <stop offset="0%" stopColor={segment.color} stopOpacity="1" />
                <stop offset="100%" stopColor={segment.color} stopOpacity="0.7" />
              </linearGradient>
            ))}
          </defs>

          {/* Enhanced segments with gradients and animations */}
          {segments.map((segment, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <path
                  d={segment.path}
                  fill={`url(#segment-gradient-${i})`}
                  className={cn(
                    "transition-all duration-300 cursor-pointer drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]",
                    hoveredIndex === i ? "opacity-100 transform scale-105" : 
                    hoveredIndex !== null ? "opacity-60" : "opacity-90 hover:opacity-100"
                  )}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  filter="url(#glow)"
                />
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="font-medium text-white">{segment.status}</span>
                  </div>
                  <p className="text-sm text-white/70">Count: {segment.count}</p>
                  <p className="text-sm text-white/70">{segment.percentage}% of total</p>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}

          {/* Enhanced center circle with blur effect */}
          <circle
            cx={size/2}
            cy={size/2}
            r={size/4}
            className="fill-black/40 backdrop-blur-sm transition-all duration-300 group-hover:fill-black/50"
          />

          {/* Glow filter */}
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        </svg>

        {/* Enhanced center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-xs font-medium text-white/70 transition-colors duration-300 group-hover:text-white/90">
            {segments.length} groups
          </div>
        </div>

        {/* Enhanced hover overlay */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>
    </TooltipProvider>
  )
} 