'use client'

import {
  AlertCircle,
  ArrowDownIcon,
  ArrowUpIcon,
  type LucideIcon,
  PlusCircle,
  Upload,
} from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { mockTrendData } from './types'
import { Sparkline } from './visualizations/sparkline'

interface StatItem {
  label: string
  value: number
  trend: {
    value: number
    isPositive: boolean
  }
  colorClass: {
    bg: string
    text: string
    hover: string
    gradient: string
    scan: string
    spline: string
  }
  priority: 'high' | 'medium' | 'low'
  action?: {
    label: string
    href: Route
    icon: LucideIcon
  }
  trendKey: string
}

const stats: StatItem[] = [
  {
    label: 'Total Patients',
    value: 1234,
    trend: {
      value: 12,
      isPositive: true,
    },
    colorClass: {
      bg: 'bg-[#004FFF]',
      text: 'text-[#004FFF]',
      hover: 'hover:bg-[#004FFF]/90',
      gradient:
        'bg-gradient-to-r from-[#004FFF]/10 via-transparent to-[#004FFF]/10',
      scan: 'scan-line-[#004FFF]',
      spline: '#004FFF',
    },
    priority: 'high',
    action: {
      label: 'Add Patient',
      href: '/dashboard/patients/new' as Route,
      icon: PlusCircle,
    },
    trendKey: 'total-patients',
  },
  {
    label: 'Pending Uploads',
    value: 5,
    trend: {
      value: 2,
      isPositive: false,
    },
    colorClass: {
      bg: 'bg-filter-processing',
      text: 'text-filter-processing',
      hover: 'hover-filter-processing',
      gradient: 'gradient-overlay-processing',
      scan: 'scan-line-processing',
      spline: 'rgb(var(--processing))',
    },
    priority: 'medium',
    action: {
      label: 'Upload Scan',
      href: '/dashboard/upload' as Route,
      icon: Upload,
    },
    trendKey: 'pending-uploads',
  },
  {
    label: 'High-Risk Patients',
    value: 12,
    trend: {
      value: 3,
      isPositive: true,
    },
    colorClass: {
      bg: 'bg-filter-error',
      text: 'text-filter-error',
      hover: 'hover-filter-error',
      gradient: 'gradient-overlay-error',
      scan: 'scan-line-error',
      spline: 'rgb(var(--error))',
    },
    priority: 'high',
    action: {
      label: 'View Risks',
      href: '/dashboard/patients?risk=high' as Route,
      icon: AlertCircle,
    },
    trendKey: 'high-risk',
  },
]

export function QuickStats() {
  return (
    <div className="relative overflow-hidden">
      {/* Header */}
      <div className="border-b border-[rgb(var(--border))/var(--opacity-10)] p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-[rgb(var(--foreground))]">
            Quick Stats
          </h3>
        </div>
      </div>

      {/* Content section */}
      <div className="p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {stats.map((stat, index) => (
            <TooltipProvider key={index}>
              <div
                className={cn(
                  'group relative rounded-xl border border-[rgb(var(--border))/var(--opacity-10)]',
                  'bg-[rgb(var(--background))/var(--opacity-40)] p-6',
                  'duration-normal transition-all hover:-translate-y-1',
                  'hover:bg-[rgb(var(--background))/var(--opacity-60)]',
                  stat.colorClass.hover
                )}
              >
                {/* Gradient overlay */}
                <div
                  className={cn(
                    'duration-normal absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-100',
                    stat.colorClass.gradient
                  )}
                />

                {/* Content */}
                <div className="relative z-10 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="grid grid-cols-[24px,1fr] items-start gap-3">
                      {stat.action?.icon && (
                        <stat.action.icon className="mt-0.5 size-5 text-[rgb(var(--foreground))/var(--opacity-60)]" />
                      )}
                      <span className="block font-medium leading-none text-[rgb(var(--foreground))/var(--opacity-70)]">
                        {stat.label}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2 py-1 text-xs',
                        stat.priority === 'high' &&
                          'bg-[rgb(var(--error))/var(--opacity-10)] text-[rgb(var(--error))]',
                        stat.priority === 'medium' &&
                          'bg-[rgb(var(--warning))/var(--opacity-10)] text-[rgb(var(--warning))]',
                        stat.priority === 'low' &&
                          'bg-[rgb(var(--success))/var(--opacity-10)] text-[rgb(var(--success))]'
                      )}
                    >
                      {stat.priority}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[rgb(var(--foreground))]">
                      {stat.value}
                    </span>
                    <span
                      className={cn(
                        'text-sm',
                        stat.trend.isPositive
                          ? 'text-[rgb(var(--success))]'
                          : 'text-[rgb(var(--error))]'
                      )}
                    >
                      {stat.trend.value}%
                    </span>
                  </div>

                  {stat.action && (
                    <Button
                      className={cn(
                        'mt-4 w-full justify-between',
                        'bg-[rgb(var(--background))/var(--opacity-60)]',
                        'hover:bg-[rgb(var(--background))/var(--opacity-80)]'
                      )}
                      variant="ghost"
                    >
                      {stat.action.label}
                      <stat.action.icon className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </TooltipProvider>
          ))}
        </div>
      </div>
    </div>
  )
}
