'use client'

import {
  AlertCircle,
  ArrowDownIcon,
  ArrowUpIcon,
  PlusCircle,
  Upload,
  type LucideIcon,
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
      gradient: 'bg-gradient-to-r from-[#004FFF]/10 via-transparent to-[#004FFF]/10',
      scan: 'scan-line-[#004FFF]',
      spline: '#004FFF'
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
      spline: 'rgb(var(--processing))'
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
      spline: 'rgb(var(--error))'
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
    <div className="relative overflow-hidden rounded-2xl border border-[#6B818C]/10 bg-[#D8E4FF] backdrop-blur-xl">
      {/* Header with enhanced gradient */}
      <div className="border-b border-white/5 p-6">
        <div className="flex items-center justify-between">
            <h3 className="text-2xl font-extrabold text-[#35605A] drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            Quick Stats
          </h3>
        </div>
      </div>

      {/* Enhanced content section */}
      <div className="p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {stats.map((stat, index) => (
            <TooltipProvider key={index}>
              <div className={cn(
                "group relative rounded-xl border border-white/5 bg-black/20 p-6 transition-all duration-300 hover:-translate-y-1",
                stat.colorClass.hover
              )}>
                {/* Enhanced gradient overlay effect */}
                <div className={cn(
                  "absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                  stat.colorClass.gradient
                )} />

                {/* Content wrapper */}
                <div className="relative z-10">
                  {/* Trend indicator */}
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "rounded-full p-1",
                      stat.colorClass.bg
                    )}>
                      {stat.trend.isPositive ? (
                        <ArrowUpIcon className={cn("size-3", stat.colorClass.text)} />
                      ) : (
                        <ArrowDownIcon className={cn("size-3", stat.colorClass.text)} />
                      )}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn(
                          "text-sm",
stat.trend.isPositive ? "text-[#004FFF]" : "text-[#902D41]"
                        )}>
                          {stat.trend.value}%
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {stat.trend.isPositive ? 'Increased' : 'Decreased'} by{' '}
                          {stat.trend.value}% from last period
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Value and action row */}
                  <div className="mb-6 flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help space-y-2">
                          <div className="bg-gradient-primary bg-clip-text text-3xl font-extrabold text-transparent drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                            {stat.value.toLocaleString()}
                          </div>
                          <div
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-1 text-sm font-medium',
                              stat.priority === 'high'
                                ? 'bg-[rgb(var(--error)/0.2)] text-[rgb(var(--error)/1)]'
                                : stat.priority === 'medium'
                                  ? 'bg-[rgb(var(--processing)/0.2)] text-[rgb(var(--processing)/1)]'
                                  : 'bg-[rgb(var(--success)/0.2)] text-[rgb(var(--success)/1)]'
                            )}
                          >
                            {stat.priority === 'high'
                              ? 'critical'
                              : stat.priority === 'medium'
                                ? 'attention'
                                : 'normal'}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Current {stat.label.toLowerCase()} count</p>
                      </TooltipContent>
                    </Tooltip>

                    {stat.action && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            className={cn(
                              "flex size-8 items-center justify-center rounded-xl",
                              stat.colorClass.bg,
                              "transition-all duration-300 hover:scale-110"
                            )}
                            href={stat.action.href}
                          >
                            <stat.action.icon className={cn("size-4", stat.colorClass.text)} />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{stat.action.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* Sparkline */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="h-[32px] cursor-help">
                        <Sparkline
                          color={stat.colorClass.spline}
                          data={mockTrendData[stat.trendKey]}
                          height={32}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Trend over the last 7 days</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Enhanced scanning line effect */}
                <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className={cn(
                    "group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-[#004FFF]/60 to-transparent",
                    stat.colorClass.scan
                  )} />
                </div>
              </div>
            </TooltipProvider>
          ))}
        </div>
      </div>
    </div>
  )
}