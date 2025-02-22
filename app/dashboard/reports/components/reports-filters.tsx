'use client'

import { Calendar, FileText, Filter, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Report } from '@/lib/reports.types'

const filters = {
  type: [
    {
      label: 'Diagnostic',
      value: 'diagnostic',
      icon: FileText,
      color: 'cyan',
    },
    {
      label: 'Progress',
      value: 'progress',
      icon: TrendingUp,
      color: 'purple',
    },
    {
      label: 'Analytics',
      value: 'analytics',
      icon: Filter,
      color: 'blue',
    },
  ],
  timeframe: [
    { label: 'Last 7 Days', value: '7d' },
    { label: 'Last 30 Days', value: '30d' },
    { label: 'Last Quarter', value: 'quarter' },
  ],
  status: [
    { label: 'Completed', value: 'completed' },
    { label: 'Processing', value: 'processing' },
    { label: 'Failed', value: 'failed' },
  ],
} as const

interface ReportsFiltersProps {
  onFilterChange?: (filters: {
    type?: Report['type']
    timeframe?: string
    status?: Report['status']
  }) => void
}

export function ReportsFilters({ onFilterChange }: ReportsFiltersProps) {
  return (
    <div className="space-y-6">
      {/* Report Type Filters */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="border-b border-white/5 p-4">
          <h3 className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-lg font-semibold text-transparent">
            Report Type
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {filters.type.map((filter) => (
              <button
                key={filter.value}
                onClick={() => onFilterChange?.({ type: filter.value })}
                className={cn(
                  'group relative flex w-full items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3',
                  'transition-all duration-300',
                  'hover:border-cyan-500/30 hover:bg-black/40 hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]',
                  'backdrop-blur-sm'
                )}
              >
                {/* Gradient overlay */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className={cn('rounded-lg p-2', `bg-${filter.color}-500/10`)}>
                    <filter.icon className={cn('h-4 w-4', `text-${filter.color}-400`)} />
                  </div>
                  <span className="text-sm font-medium text-white/70 transition-colors duration-300 group-hover:text-white">
                    {filter.label}
                  </span>
                </div>

                {/* Scanning line effect */}
                <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeframe Filters */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="border-b border-white/5 p-4">
          <h3 className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-lg font-semibold text-transparent">
            Timeframe
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {filters.timeframe.map((filter) => (
              <button
                key={filter.value}
                onClick={() => onFilterChange?.({ timeframe: filter.value })}
                className={cn(
                  'group relative flex w-full items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3',
                  'transition-all duration-300',
                  'hover:border-cyan-500/30 hover:bg-black/40 hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]',
                  'backdrop-blur-sm'
                )}
              >
                {/* Gradient overlay */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2">
                    <Calendar className="h-4 w-4 text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-white/70 transition-colors duration-300 group-hover:text-white">
                    {filter.label}
                  </span>
                </div>

                {/* Scanning line effect */}
                <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status Filters */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="border-b border-white/5 p-4">
          <h3 className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-lg font-semibold text-transparent">
            Status
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {filters.status.map((filter) => (
              <button
                key={filter.value}
                onClick={() => onFilterChange?.({ status: filter.value })}
                className={cn(
                  'group relative flex w-full items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3',
                  'transition-all duration-300',
                  'hover:border-cyan-500/30 hover:bg-black/40 hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]',
                  'backdrop-blur-sm'
                )}
              >
                {/* Gradient overlay */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className="rounded-lg bg-purple-500/10 p-2">
                    <FileText className="h-4 w-4 text-purple-400" />
                  </div>
                  <span className="text-sm font-medium text-white/70 transition-colors duration-300 group-hover:text-white">
                    {filter.label}
                  </span>
                </div>

                {/* Scanning line effect */}
                <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 