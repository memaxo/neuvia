'use client'

import { useId } from 'react'

import type { TrendPoint } from '../types'

interface SparklineProps {
  data: TrendPoint[]
  color: string
  height?: number
}

export function Sparkline({ data, color, height = 30 }: SparklineProps) {
  // React hooks must be called at the top level of the component
  const uniqueId = useId().replace(/[^a-zA-Z0-9]/g, '')

  // Early return if data is undefined or empty
  if (!data?.length) {
    return (
      <svg className="opacity-50" height={height} width="100%">
        <line
          stroke={color}
          strokeDasharray="4 4"
          strokeWidth="1"
          x1="0"
          x2="100%"
          y1={height / 2}
          y2={height / 2}
        />
      </svg>
    )
  }

  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min

  // Create points for the sparkline
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * 100
      const y = ((d.value - min) / range) * height
      return `${x},${height - y}`
    })
    .join(' ')

  const gradientId = `sparkline-gradient-${uniqueId}`
  const hoverGradientId = `sparkline-hover-gradient-${uniqueId}`

  return (
    <svg
      className="group overflow-visible"
      height={height}
      preserveAspectRatio="none"
      style={
        {
          '--gradient-url': `url(#${gradientId})`,
          '--hover-gradient-url': `url(#${hoverGradientId})`,
        } as React.CSSProperties
      }
      width="100%"
    >
      {/* Enhanced gradient definitions */}
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={hoverGradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Enhanced area fill with hover effect */}
      <path
        className="fill-[var(--gradient-url)] opacity-50 transition-all duration-300 group-hover:fill-[var(--hover-gradient-url)] group-hover:opacity-75"
        d={`M0,${height} ${points} ${100},${height} Z`}
      />

      {/* Background line with enhanced effect */}
      <polyline
        className="group-hover:stroke-opacity-20 transition-all duration-300"
        fill="none"
        points={points}
        stroke={color}
        strokeOpacity="0.1"
        strokeWidth="1"
      />

      {/* Enhanced foreground line */}
      <polyline
        className="group-hover:stroke-width-2 drop-shadow-[0_0_3px_rgba(0,255,255,0.3)] transition-all duration-300 group-hover:drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]"
        fill="none"
        points={points}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />

      {/* Enhanced data points with animations */}
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100
        const y = height - ((d.value - min) / range) * height
        return (
          <g
            className="opacity-0 transition-all duration-300 group-hover:opacity-100"
            key={i}
          >
            <circle
              className="drop-shadow-[0_0_3px_rgba(0,255,255,0.3)] transition-transform duration-300 hover:scale-150"
              cx={`${x}%`}
              cy={y}
              fill={color}
              r="2"
            />
            {/* Value tooltip on hover */}
            <text
              className="fill-white/70 text-[10px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              textAnchor="middle"
              x={`${x}%`}
              y={y - 8}
            >
              {d.value}
            </text>
          </g>
        )
      })}

      {/* Enhanced end point with glow effect */}
      <circle
        className="group-hover:r-3 drop-shadow-[0_0_3px_rgba(0,255,255,0.3)] transition-all duration-300 group-hover:drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]"
        cx="100%"
        cy={height - ((data[data.length - 1].value - min) / range) * height}
        fill={color}
        r="2"
      />
    </svg>
  )
}
