'use client'

import { useId } from 'react'
import { TrendPoint } from '../types'

interface SparklineProps {
  data: TrendPoint[]
  color: string
  height?: number
}

export function Sparkline({ data, color, height = 30 }: SparklineProps) {
  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  const uniqueId = useId().replace(/[^a-zA-Z0-9]/g, '')

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
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className="group overflow-visible"
      style={{
        '--gradient-url': `url(#${gradientId})`,
        '--hover-gradient-url': `url(#${hoverGradientId})`,
      } as React.CSSProperties}
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
        d={`M0,${height} ${points} ${100},${height} Z`}
        className="fill-[var(--gradient-url)] opacity-50 transition-all duration-300 group-hover:fill-[var(--hover-gradient-url)] group-hover:opacity-75"
      />

      {/* Background line with enhanced effect */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeOpacity="0.1"
        className="group-hover:stroke-opacity-20 transition-all duration-300"
      />

      {/* Enhanced foreground line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="group-hover:stroke-width-2 drop-shadow-[0_0_3px_rgba(0,255,255,0.3)] transition-all duration-300 group-hover:drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]"
      />

      {/* Enhanced data points with animations */}
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100
        const y = height - ((d.value - min) / range) * height
        return (
          <g
            key={i}
            className="opacity-0 transition-all duration-300 group-hover:opacity-100"
          >
            <circle
              cx={`${x}%`}
              cy={y}
              r="2"
              fill={color}
              className="drop-shadow-[0_0_3px_rgba(0,255,255,0.3)] transition-transform duration-300 hover:scale-150"
            />
            {/* Value tooltip on hover */}
            <text
              x={`${x}%`}
              y={y - 8}
              textAnchor="middle"
              className="fill-white/70 text-[10px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            >
              {d.value}
            </text>
          </g>
        )
      })}

      {/* Enhanced end point with glow effect */}
      <circle
        cx="100%"
        cy={height - ((data[data.length - 1].value - min) / range) * height}
        r="2"
        fill={color}
        className="group-hover:r-3 drop-shadow-[0_0_3px_rgba(0,255,255,0.3)] transition-all duration-300 group-hover:drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]"
      />
    </svg>
  )
}
