import React from 'react'

import { cn } from '@/lib/utils'

interface SecurityBadgeProps {
  icon: React.ReactNode
  label: string
  className?: string
}

export function SecurityBadge({ icon, label, className }: SecurityBadgeProps) {
  return (
    <span
      className={cn(
        'bg-pearl-200/10 shadow-teal group flex items-center rounded-full px-4 py-2 backdrop-blur-sm',
        'hover:bg-pearl-200/20 transition-all duration-300',
        'relative overflow-hidden',
        className
      )}
    >
      {/* Scanning line animation */}
      <span className="absolute inset-0 overflow-hidden">
        <span className="animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-blue-400/20 to-transparent" />
      </span>

      {/* Active status indicator */}
      <span className="absolute right-2 top-2 size-1">
        <span className="absolute inset-0 animate-ping rounded-full bg-blue-400/50" />
        <span className="absolute inset-0 rounded-full bg-blue-400" />
      </span>

      <span className="relative flex items-center">
        {icon}
        <span className="text-pearl-100 ml-2 font-mono text-xs font-medium">
          {label}
        </span>
      </span>
    </span>
  )
}
