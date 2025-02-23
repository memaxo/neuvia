'use client'

import { Calendar, FileText, Filter, TrendingUp } from 'lucide-react'

import type { Report } from '@/lib/reports.types'
import { cn } from '@/lib/utils'

const filters = {
  type: [
    {
      label: 'Diagnostic',
      value: 'diagnostic',
      icon: FileText,
      colorClass: {
        bg: 'bg-filter-primary',
        text: 'text-filter-primary',
        hover: 'hover-filter-primary',
        gradient: 'gradient-overlay-primary',
        scan: 'scan-line-primary'
      }
    },
    {
      label: 'Progress',
      value: 'progress',
      icon: TrendingUp,
      colorClass: {
        bg: 'bg-filter-accent',
        text: 'text-filter-accent',
        hover: 'hover-filter-accent',
        gradient: 'gradient-overlay-accent',
        scan: 'scan-line-accent'
      }
    },
    {
      label: 'Analytics',
      value: 'analytics',
      icon: Filter,
      colorClass: {
        bg: 'bg-filter-processing',
        text: 'text-filter-processing',
        hover: 'hover-filter-processing',
        gradient: 'gradient-overlay-processing',
        scan: 'scan-line-processing'
      }
    },
  ],
  timeframe: [
    { label: 'Last 7 Days', value: '7d' },
    { label: 'Last 30 Days', value: '30d' },
    { label: 'Last Quarter', value: 'quarter' },
  ],
  status: [
    { 
      label: 'Completed',
      value: 'completed',
      colorClass: {
        bg: 'bg-filter-success',
        text: 'text-filter-success',
        hover: 'hover-filter-success',
        gradient: 'gradient-overlay-success',
        scan: 'scan-line-success'
      }
    },
    { 
      label: 'Processing',
      value: 'processing',
      colorClass: {
        bg: 'bg-filter-processing',
        text: 'text-filter-processing',
        hover: 'hover-filter-processing',
        gradient: 'gradient-overlay-processing',
        scan: 'scan-line-processing'
      }
    },
    { 
      label: 'Failed',
      value: 'failed',
      colorClass: {
        bg: 'bg-filter-error',
        text: 'text-filter-error',
        hover: 'hover-filter-error',
        gradient: 'gradient-overlay-error',
        scan: 'scan-line-error'
      }
    },
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
          <h3 className="from-primary-light bg-gradient-to-r via-primary to-accent bg-clip-text text-lg font-semibold text-transparent">
            Report Type
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {filters.type.map((filter) => (
              <button
                className={cn(
                  'group relative flex w-full items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3',
                  'transition-all duration-300',
                  filter.colorClass.hover,
                  'backdrop-blur-sm'
                )}
                key={filter.value}
                onClick={() => onFilterChange?.({ type: filter.value })}
              >
                {/* Gradient overlay */}
                <div className={cn(
                  "absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                  filter.colorClass.gradient
                )} />

                <div className="relative z-10 flex items-center gap-3">
                  <div className={cn('rounded-lg p-2', filter.colorClass.bg)}>
                    <filter.icon className={cn('size-4', filter.colorClass.text)} />
                  </div>
                  <span className="text-sm font-medium text-white/70 transition-colors duration-300 group-hover:text-white">
                    {filter.label}
                  </span>
                </div>

                {/* Scanning line effect */}
                <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className={cn(
                    "group-hover:animate-scan absolute -left-full top-0 h-px w-full",
                    filter.colorClass.scan
                  )} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeframe Filters */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="border-b border-white/5 p-4">
          <h3 className="from-primary-light bg-gradient-to-r via-primary to-accent bg-clip-text text-lg font-semibold text-transparent">
            Timeframe
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {filters.timeframe.map((filter) => (
              <button
                className={cn(
                  'group relative flex w-full items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3',
                  'transition-all duration-300',
                  'hover-filter-primary',
                  'backdrop-blur-sm'
                )}
                key={filter.value}
                onClick={() => onFilterChange?.({ timeframe: filter.value })}
              >
                {/* Gradient overlay */}
                <div className="gradient-overlay-primary absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className="bg-filter-primary rounded-lg p-2">
                    <Calendar className="text-filter-primary size-4" />
                  </div>
                  <span className="text-sm font-medium text-white/70 transition-colors duration-300 group-hover:text-white">
                    {filter.label}
                  </span>
                </div>

                {/* Scanning line effect */}
                <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="group-hover:animate-scan scan-line-primary absolute -left-full top-0 h-px w-full" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status Filters */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="border-b border-white/5 p-4">
          <h3 className="from-primary-light bg-gradient-to-r via-primary to-accent bg-clip-text text-lg font-semibold text-transparent">
            Status
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {filters.status.map((filter) => (
              <button
                className={cn(
                  'group relative flex w-full items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3',
                  'transition-all duration-300',
                  filter.colorClass.hover,
                  'backdrop-blur-sm'
                )}
                key={filter.value}
                onClick={() => onFilterChange?.({ status: filter.value })}
              >
                {/* Gradient overlay */}
                <div className={cn(
                  "absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                  filter.colorClass.gradient
                )} />

                <div className="relative z-10 flex items-center gap-3">
                  <div className={cn('rounded-lg p-2', filter.colorClass.bg)}>
                    <FileText className={cn('size-4', filter.colorClass.text)} />
                  </div>
                  <span className="text-sm font-medium text-white/70 transition-colors duration-300 group-hover:text-white">
                    {filter.label}
                  </span>
                </div>

                {/* Scanning line effect */}
                <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className={cn(
                    "group-hover:animate-scan absolute -left-full top-0 h-px w-full",
                    filter.colorClass.scan
                  )} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 