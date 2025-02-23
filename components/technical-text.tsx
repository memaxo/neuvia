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
  animate = false,
}: TechnicalTextProps) {
  const baseStyles = 'relative inline-block'

  const variantStyles = {
    highlight:
      "font-medium relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[1px] after:bg-[rgb(var(--primary)/0.1)]",
    technical: 'font-mono text-[#004FFF] tracking-tight',
    mono: 'font-mono text-sm tracking-tight',
  }

  const animationStyles = animate ? 'animate-fade-in' : ''

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
        <span className="after:bg-[#FF007F]/[0.02]" />
      )}
    </span>
  )
}