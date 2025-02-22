'use client'

import { Activity, AlertCircle, Calendar, User } from 'lucide-react'

import { cn } from '@/lib/utils'

const filters = {
  status: [
    {
      label: 'High Risk',
      value: 'high-risk',
      count: 12,
      icon: AlertCircle,
      color: 'red',
    },
    {
      label: 'At Risk',
      value: 'at-risk',
      count: 28,
      icon: AlertCircle,
      color: 'orange',
    },
    {
      label: 'Stable',
      value: 'stable',
      count: 156,
      icon: User,
      color: 'green',
    },
    { label: 'New', value: 'new', count: 8, icon: User, color: 'blue' },
  ],
  appointments: [
    { label: 'Today', value: 'today', count: 5 },
    { label: 'This Week', value: 'this-week', count: 18 },
    { label: 'This Month', value: 'this-month', count: 45 },
  ],
  activity: [
    { label: 'Recent Upload', value: 'upload', count: 24 },
    { label: 'Needs Review', value: 'review', count: 12 },
    { label: 'Follow-up', value: 'follow-up', count: 8 },
  ],
}

export function PatientFilters() {
  return (
    <div className="space-y-6">
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
                className={cn(
                  'group relative flex w-full items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3',
                  'transition-all duration-300',
                  'hover:border-cyan-500/30 hover:bg-black/40 hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]',
                  'backdrop-blur-sm'
                )}
                key={filter.value}
              >
                {/* Enhanced gradient overlay */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative z-10 flex items-center gap-3">
                  <div
                    className={cn(
                      'rounded-lg p-2',
                      `bg-${filter.color}-500/10`,
                      'transition-colors duration-300'
                    )}
                  >
                    <filter.icon
                      className={cn('size-4', `text-${filter.color}-400`)}
                    />
                  </div>
                  <span className="text-sm font-medium text-white/70 transition-colors duration-300 group-hover:text-white">
                    {filter.label}
                  </span>
                </div>

                <span className="relative z-10 text-sm text-white/50 transition-colors duration-300 group-hover:text-white/70">
                  {filter.count}
                </span>

                {/* Enhanced scanning line effect */}
                <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Appointment Filters */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="border-b border-white/5 p-4">
          <h3 className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-lg font-semibold text-transparent">
            Appointments
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {filters.appointments.map((filter) => (
              <button
                className={cn(
                  'group relative flex w-full items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3',
                  'transition-all duration-300',
                  'hover:border-cyan-500/30 hover:bg-black/40 hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]',
                  'backdrop-blur-sm'
                )}
                key={filter.value}
              >
                {/* Enhanced gradient overlay */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2">
                    <Calendar className="size-4 text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-white/70 transition-colors duration-300 group-hover:text-white">
                    {filter.label}
                  </span>
                </div>

                <span className="relative z-10 text-sm text-white/50 transition-colors duration-300 group-hover:text-white/70">
                  {filter.count}
                </span>

                {/* Enhanced scanning line effect */}
                <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Filters */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="border-b border-white/5 p-4">
          <h3 className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-lg font-semibold text-transparent">
            Activity
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {filters.activity.map((filter) => (
              <button
                className={cn(
                  'group relative flex w-full items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3',
                  'transition-all duration-300',
                  'hover:border-cyan-500/30 hover:bg-black/40 hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]',
                  'backdrop-blur-sm'
                )}
                key={filter.value}
              >
                {/* Enhanced gradient overlay */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className="rounded-lg bg-purple-500/10 p-2">
                    <Activity className="size-4 text-purple-400" />
                  </div>
                  <span className="text-sm font-medium text-white/70 transition-colors duration-300 group-hover:text-white">
                    {filter.label}
                  </span>
                </div>

                <span className="relative z-10 text-sm text-white/50 transition-colors duration-300 group-hover:text-white/70">
                  {filter.count}
                </span>

                {/* Enhanced scanning line effect */}
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
