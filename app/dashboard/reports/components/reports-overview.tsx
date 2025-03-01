'use client'

import { Clock, FileText, TrendingUp, Users } from 'lucide-react'

import { cn } from '@/lib/utils'

interface Stat {
  name: string
  value: number
  change: string
  changeType: 'increase' | 'decrease' | 'neutral'
}

interface ReportsOverviewProps {
  stats: Stat[]
}

export function ReportsOverview({ stats }: ReportsOverviewProps) {
  const getIcon = (name: string) => {
    switch (name) {
      case 'Total Reports':
        return FileText
      case 'Processing':
        return Clock
      case 'Failed':
        return TrendingUp
      default:
        return Users
    }
  }

  const getColorByType = (type: Stat['changeType']) => {
    switch (type) {
      case 'increase':
        return 'text-[rgb(var(--success)/1)]'
      case 'decrease':
        return 'text-[rgb(var(--error)/1)]'
      default:
        return 'text-[rgb(var(--primary)/0.5)]'
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = getIcon(stat.name)
        return (
          <div
            key={index}
            className={cn(
              // Base card styles
              'relative overflow-hidden rounded-xl',
              // Border and background
              'border border-[rgb(var(--border))/var(--opacity-10)]',
              'bg-[rgb(var(--background))/var(--opacity-40)]',
              // Effects
              'backdrop-blur-sm',
              // Group hover
              'group'
            )}
          >
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-[rgb(var(--primary)/0.1)] via-transparent to-[rgb(var(--accent)/0.1)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="relative z-10 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[rgb(var(--muted-foreground))]">
                    {stat.name}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-[rgb(var(--foreground))]">
                    {stat.value}
                  </h3>
                </div>
                <div className="rounded-xl bg-[rgb(var(--primary)/0.1)] p-3">
                  <Icon className="size-6 text-[rgb(var(--primary))]" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span
                  className={cn('text-sm', getColorByType(stat.changeType))}
                >
                  {stat.change}
                </span>
                <span className="text-sm text-[rgb(var(--muted-foreground))]">
                  vs last month
                </span>
              </div>
            </div>

            {/* Scanning line effect */}
            <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-[rgb(var(--primary)/0.3)] to-transparent group-hover:animate-scan" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
