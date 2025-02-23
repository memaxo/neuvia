'use client'

import { FileText, TrendingUp, Users, Clock } from 'lucide-react'

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
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = getIcon(stat.name)
        return (
          <div
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-xl"
            key={index}
          >
            {/* Gradient overlay */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[rgb(var(--primary)/0.1)] via-transparent to-[rgb(var(--accent)/0.1)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">{stat.name}</p>
                  <h3 className="mt-2 text-2xl font-bold text-white">{stat.value}</h3>
                </div>
                <div className="rounded-xl bg-[rgb(var(--primary)/0.1)] p-3">
                  <Icon className="size-6 text-[rgb(var(--primary)/1)]" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className={cn('text-sm', getColorByType(stat.changeType))}>
                  {stat.change}
                </span>
                <span className="text-sm text-white/50">vs last month</span>
              </div>
            </div>

            {/* Scanning line effect */}
            <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-[rgb(var(--primary)/0.3)] to-transparent" />
            </div>
          </div>
        )
      })}
    </div>
  )
} 