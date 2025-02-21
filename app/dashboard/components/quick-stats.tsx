'use client'

import type { Route } from 'next'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowDownIcon,
  ArrowUpIcon,
  PlusCircle,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { mockTrendData } from './types'
import { Sparkline } from './visualizations/sparkline'

interface StatItem {
  label: string
  value: number
  trend: {
    value: number
    isPositive: boolean
  }
  color: string
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
    color: 'spline-cyan',
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
    color: 'spline-blue',
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
    color: 'spline-magenta',
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
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl">
      {/* Header with enhanced gradient and spacing */}
      <div className="border-b border-white/5 p-6">
        <div className="flex items-center justify-between">
          <h3 className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-2xl font-extrabold text-transparent drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            Quick Stats
          </h3>
        </div>
      </div>

      {/* Enhanced content section */}
      <div className="p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {stats.map((stat, index) => (
            <TooltipProvider key={index}>
              <div className="group relative rounded-xl border border-white/5 bg-black/20 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/30 hover:bg-black/40 hover:shadow-[0_0_40px_rgba(0,255,255,0.2)]">
                {/* Enhanced gradient overlay effect */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                {/* Content wrapper */}
                <div className="relative z-10">
                  {/* Header with label and trend */}
                  <div className="mb-4 flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help text-base font-medium text-white/90 transition-colors duration-300 group-hover:text-white">
                          {stat.label}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          View detailed {stat.label.toLowerCase()} statistics
                        </p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'flex cursor-help items-center gap-1.5 rounded-full px-2.5 py-1.5',
                            'bg-black/40 backdrop-blur-sm transition-colors duration-300 group-hover:bg-black/60',
                            stat.trend.isPositive
                              ? 'text-cyan-400'
                              : 'text-red-400'
                          )}
                        >
                          {stat.trend.isPositive ? (
                            <ArrowUpIcon className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownIcon className="h-3.5 w-3.5" />
                          )}
                          <span className="text-sm font-medium">
                            {stat.trend.value}%
                          </span>
                        </div>
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
                          <div className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-3xl font-extrabold text-transparent drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                            {stat.value.toLocaleString()}
                          </div>
                          <div
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-1 text-sm font-medium',
                              stat.priority === 'high'
                                ? 'bg-red-500/20 text-red-300'
                                : stat.priority === 'medium'
                                  ? 'bg-yellow-500/20 text-yellow-300'
                                  : 'bg-green-500/20 text-green-300'
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
                      <Link href={stat.action.href}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="group/btn relative overflow-hidden rounded-xl bg-black/40 px-4 py-2 text-white/80 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-black/60 hover:text-white hover:shadow-[0_0_30px_rgba(0,255,255,0.2)]"
                        >
                          <span className="relative z-10 flex items-center gap-2">
                            <stat.action.icon className="h-4 w-4" />
                            <span className="font-medium">
                              {stat.action.label}
                            </span>
                          </span>
                          {/* Enhanced scanning line effect */}
                          <div className="absolute inset-0 overflow-hidden">
                            <div className="group-hover/btn:animate-scan absolute -left-full top-0 h-[1px] w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
                          </div>
                        </Button>
                      </Link>
                    )}
                  </div>

                  {/* Enhanced sparkline with tooltip */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="h-[32px] cursor-help">
                        <Sparkline
                          data={mockTrendData[stat.trendKey]}
                          color={
                            stat.color === 'spline-cyan'
                              ? '#4B6BFD'
                              : stat.color === 'spline-blue'
                                ? '#0066FF'
                                : '#FF00FF'
                          }
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
                  <div className="group-hover:animate-scan absolute -left-full top-0 h-[1px] w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
                </div>
              </div>
            </TooltipProvider>
          ))}
        </div>
      </div>
    </div>
  )
}
