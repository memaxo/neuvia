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
      className="overflow-visible group"
    >
      {/* Enhanced gradient definitions */}
      <defs>
        <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`hover-gradient-${color.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Enhanced area fill with hover effect */}
      <path
        d={`M0,${height} ${points} ${100},${height} Z`}
        fill={`url(#gradient-${color.replace('#', '')})`}
        className="transition-all duration-300 opacity-50 group-hover:opacity-75 group-hover:fill-[url(#hover-gradient-${color.replace('#', '')})]"
      />

      {/* Background line with enhanced effect */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeOpacity="0.1"
        className="transition-all duration-300 group-hover:stroke-opacity-20"
      />
      
      {/* Enhanced foreground line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-[0_0_3px_rgba(0,255,255,0.3)] transition-all duration-300 group-hover:stroke-width-2 group-hover:drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]"
      />
      
      {/* Enhanced data points with animations */}
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100
        const y = height - ((d.value - min) / range) * height
        return (
          <g key={i} className="opacity-0 group-hover:opacity-100 transition-all duration-300">
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
              className="text-[10px] fill-white/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            >
              {d.value}
            </text>
          </g>
        )
      })}
      
      {/* Enhanced end point with glow effect */}
      <circle
        cx={`${100}%`}
        cy={height - ((data[data.length - 1].value - min) / range) * height}
        r="2"
        fill={color}
        className="drop-shadow-[0_0_3px_rgba(0,255,255,0.3)] transition-all duration-300 group-hover:r-3 group-hover:drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]"
      />
    </svg>
  )
} 