import React from 'react'
import { cn } from '@/lib/utils'

interface SecurityBadgeProps {
  icon: React.ReactNode
  label: string
  className?: string
}

export function SecurityBadge({ icon, label, className }: SecurityBadgeProps) {
  return (
    <span className={cn(
      "flex items-center px-4 py-2 rounded-full bg-pearl-200/10 backdrop-blur-sm shadow-teal group",
      "hover:bg-pearl-200/20 transition-all duration-300",
      "relative overflow-hidden",
      className
    )}>
      {/* Scanning line animation */}
      <span className="absolute inset-0 overflow-hidden">
        <span className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-blue-400/20 to-transparent animate-scan" />
      </span>
      
      {/* Active status indicator */}
      <span className="absolute w-1 h-1 right-2 top-2">
        <span className="absolute inset-0 rounded-full bg-blue-400/50 animate-ping" />
        <span className="absolute inset-0 rounded-full bg-blue-400" />
      </span>

      <span className="relative flex items-center">
        {icon}
        <span className="ml-2 font-mono text-xs font-medium text-pearl-100">{label}</span>
      </span>
    </span>
  )
} 