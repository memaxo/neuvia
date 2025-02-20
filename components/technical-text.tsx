'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface TechnicalTextProps {
  children: React.ReactNode
  variant?: 'highlight' | 'technical' | 'mono'
  className?: string
  animate?: boolean
}

export function TechnicalText({ 
  children, 
  variant = 'technical',
  className,
  animate = false 
}: TechnicalTextProps) {
  const baseStyles = "relative inline-block"
  
  const variantStyles = {
    highlight: "font-medium relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[1px] after:bg-blue-400/10",
    technical: "font-mono text-blue-300 tracking-tight",
    mono: "font-mono text-sm tracking-tight"
  }

  const animationStyles = animate ? "animate-fade-in" : ""

  return (
    <span 
      className={cn(
        baseStyles,
        variantStyles[variant],
        animationStyles,
        className
      )}
    >
      {children}
      {variant === 'highlight' && (
        <span className="absolute inset-0 bg-blue-400/[0.02] rounded-sm" />
      )}
    </span>
  )
} 