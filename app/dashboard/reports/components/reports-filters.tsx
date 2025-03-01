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
        scan: 'scan-line-primary',
      },
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
        scan: 'scan-line-accent',
      },
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
        scan: 'scan-line-processing',
      },
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
        scan: 'scan-line-success',
      },
    },
    {
      label: 'Processing',
      value: 'processing',
      colorClass: {
        bg: 'bg-filter-processing',
        text: 'text-filter-processing',
        hover: 'hover-filter-processing',
        gradient: 'gradient-overlay-processing',
        scan: 'scan-line-processing',
      },
    },
    {
      label: 'Failed',
      value: 'failed',
      colorClass: {
        bg: 'bg-filter-error',
        text: 'text-filter-error',
        hover: 'hover-filter-error',
        gradient: 'gradient-overlay-error',
        scan: 'scan-line-error',
      },
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
      <div
        className={cn(
          // Base card styles
          'relative overflow-hidden rounded-xl',
          // Border and background
          'border border-[rgb(var(--border))/var(--opacity-10)]',
          'bg-[rgb(var(--background))/var(--opacity-40)]',
          // Effects
          'backdrop-blur-sm'
        )}
      >
        <div className="border-b border-[rgb(var(--border))/var(--opacity-10)] p-6">
          <h3 className="bg-gradient-to-r from-[rgb(var(--primary))] to-[rgb(var(--accent))] bg-clip-text text-lg font-semibold text-transparent">
            Report Type
          </h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {filters.type.map((filter) => (
              <button
                key={filter.value}
                onClick={() => onFilterChange?.({ type: filter.value })}
                className={cn(
                  // Base styles
                  'group relative w-full',
                  // Layout
                  'flex items-center justify-between',
                  // Border and background
                  'rounded-xl border border-[rgb(var(--border))/var(--opacity-10)]',
                  'bg-[rgb(var(--background))/var(--opacity-20)]',
                  // Padding and effects
                  'p-4 backdrop-blur-sm',
                  // Transitions
                  'transition-all duration-300',
                  // Hover states
                  'hover:border-[rgb(var(--primary))/var(--opacity-20)]',
                  'hover:bg-[rgb(var(--background))/var(--opacity-40)]'
                )}
              >
                {/* Gradient overlay */}
                <div
                  className={cn(
                    'absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100',
                    'bg-gradient-to-br from-[rgb(var(--primary))/0.1] via-transparent to-[rgb(var(--accent))/0.1]'
                  )}
                />

                <div className="relative z-10 flex items-center gap-3">
                  <div
                    className={cn(
                      'rounded-lg p-2',
                      'bg-[rgb(var(--primary))/0.1]'
                    )}
                  >
                    <filter.icon className="size-4 text-[rgb(var(--primary))]" />
                  </div>
                  <span className="text-sm font-medium text-[rgb(var(--muted-foreground))] transition-colors duration-300 group-hover:text-[rgb(var(--foreground))]">
                    {filter.label}
                  </span>
                </div>

                {/* Scanning line effect */}
                <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-[rgb(var(--primary))/0.3] to-transparent group-hover:animate-scan" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeframe Filters */}
      <div
        className={cn(
          // Base card styles
          'relative overflow-hidden rounded-xl',
          // Border and background
          'border border-[rgb(var(--border))/var(--opacity-10)]',
          'bg-[rgb(var(--background))/var(--opacity-40)]',
          // Effects
          'backdrop-blur-sm'
        )}
      >
        <div className="border-b border-[rgb(var(--border))/var(--opacity-10)] p-6">
          <h3 className="bg-gradient-to-r from-[rgb(var(--primary))] to-[rgb(var(--accent))] bg-clip-text text-lg font-semibold text-transparent">
            Timeframe
          </h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {filters.timeframe.map((filter) => (
              <button
                key={filter.value}
                onClick={() => onFilterChange?.({ timeframe: filter.value })}
                className={cn(
                  // Base styles
                  'group relative w-full',
                  // Layout
                  'flex items-center justify-between',
                  // Border and background
                  'rounded-xl border border-[rgb(var(--border))/var(--opacity-10)]',
                  'bg-[rgb(var(--background))/var(--opacity-20)]',
                  // Padding and effects
                  'p-4 backdrop-blur-sm',
                  // Transitions
                  'transition-all duration-300',
                  // Hover states
                  'hover:border-[rgb(var(--primary))/var(--opacity-20)]',
                  'hover:bg-[rgb(var(--background))/var(--opacity-40)]'
                )}
              >
                {/* Gradient overlay */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[rgb(var(--primary))/0.1] via-transparent to-[rgb(var(--accent))/0.1] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className="rounded-lg bg-[rgb(var(--primary))/0.1] p-2">
                    <Calendar className="size-4 text-[rgb(var(--primary))]" />
                  </div>
                  <span className="text-sm font-medium text-[rgb(var(--muted-foreground))] transition-colors duration-300 group-hover:text-[rgb(var(--foreground))]">
                    {filter.label}
                  </span>
                </div>

                {/* Scanning line effect */}
                <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-[rgb(var(--primary))/0.3] to-transparent group-hover:animate-scan" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status Filters */}
      <div
        className={cn(
          // Base card styles
          'relative overflow-hidden rounded-xl',
          // Border and background
          'border border-[rgb(var(--border))/var(--opacity-10)]',
          'bg-[rgb(var(--background))/var(--opacity-40)]',
          // Effects
          'backdrop-blur-sm'
        )}
      >
        <div className="border-b border-[rgb(var(--border))/var(--opacity-10)] p-6">
          <h3 className="bg-gradient-to-r from-[rgb(var(--primary))] to-[rgb(var(--accent))] bg-clip-text text-lg font-semibold text-transparent">
            Status
          </h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {filters.status.map((filter) => (
              <button
                key={filter.value}
                onClick={() => onFilterChange?.({ status: filter.value })}
                className={cn(
                  // Base styles
                  'group relative w-full',
                  // Layout
                  'flex items-center justify-between',
                  // Border and background
                  'rounded-xl border border-[rgb(var(--border))/var(--opacity-10)]',
                  'bg-[rgb(var(--background))/var(--opacity-20)]',
                  // Padding and effects
                  'p-4 backdrop-blur-sm',
                  // Transitions
                  'transition-all duration-300',
                  // Hover states
                  'hover:border-[rgb(var(--primary))/var(--opacity-20)]',
                  'hover:bg-[rgb(var(--background))/var(--opacity-40)]'
                )}
              >
                {/* Gradient overlay */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[rgb(var(--primary))/0.1] via-transparent to-[rgb(var(--accent))/0.1] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className="rounded-lg bg-[rgb(var(--primary))/0.1] p-2">
                    <FileText className="size-4 text-[rgb(var(--primary))]" />
                  </div>
                  <span className="text-sm font-medium text-[rgb(var(--muted-foreground))] transition-colors duration-300 group-hover:text-[rgb(var(--foreground))]">
                    {filter.label}
                  </span>
                </div>

                {/* Scanning line effect */}
                <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-[rgb(var(--primary))/0.3] to-transparent group-hover:animate-scan" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
