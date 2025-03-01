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
      colorClass: 'status-badge-high-risk',
    },
    {
      label: 'At Risk',
      value: 'at-risk',
      count: 28,
      icon: AlertCircle,
      colorClass: 'status-badge-at-risk',
    },
    {
      label: 'Stable',
      value: 'stable',
      count: 156,
      icon: User,
      colorClass: 'status-badge-stable',
    },
    {
      label: 'New',
      value: 'new',
      count: 8,
      icon: User,
      colorClass: 'status-badge-new',
    },
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
      <div className="card-premium animate-fade-in">
        <div className="border-b border-[rgb(var(--border)/var(--opacity-10))] p-4">
          <h3 className="text-lg font-semibold text-[rgb(var(--foreground)/var(--opacity-90))]">
            Status
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {filters.status.map((filter) => (
              <button className="filter-button group" key={filter.value}>
                {/* Enhanced gradient overlay */}
                <div className="gradient-overlay-primary duration-normal absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className={cn('rounded-lg p-2', filter.colorClass)}>
                    <filter.icon className="size-4" />
                  </div>
                  <span className="duration-normal text-sm font-medium text-[rgb(var(--foreground)/var(--opacity-70))] transition-colors group-hover:text-[rgb(var(--foreground)/var(--opacity-100))]">
                    {filter.label}
                  </span>
                  <span className="filter-count">{filter.count}</span>
                </div>

                {/* Scanning line effect */}
                <div className="duration-normal absolute inset-0 overflow-hidden opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="scan-line-primary group-hover:animate-scan absolute -left-full top-0 h-px w-full" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Appointment Filters */}
      <div className="card-premium animate-fade-in">
        <div className="border-b border-[rgb(var(--border)/var(--opacity-10))] p-4">
          <h3 className="text-lg font-semibold text-[rgb(var(--foreground)/var(--opacity-90))]">
            Appointments
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {filters.appointments.map((filter) => (
              <button className="filter-button group" key={filter.value}>
                {/* Enhanced gradient overlay */}
                <div className="gradient-overlay-primary duration-normal absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className="rounded-lg bg-[rgb(var(--primary)/var(--opacity-10))] p-2">
                    <Calendar className="size-4 text-[rgb(var(--primary)/var(--opacity-100))]" />
                  </div>
                  <span className="duration-normal text-sm font-medium text-[rgb(var(--foreground)/var(--opacity-70))] transition-colors group-hover:text-[rgb(var(--foreground)/var(--opacity-100))]">
                    {filter.label}
                  </span>
                  <span className="filter-count">{filter.count}</span>
                </div>

                {/* Scanning line effect */}
                <div className="duration-normal absolute inset-0 overflow-hidden opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="scan-line-primary group-hover:animate-scan absolute -left-full top-0 h-px w-full" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Filters */}
      <div className="card-premium animate-fade-in">
        <div className="border-b border-[rgb(var(--border)/var(--opacity-10))] p-4">
          <h3 className="text-lg font-semibold text-[rgb(var(--foreground)/var(--opacity-90))]">
            Activity
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {filters.activity.map((filter) => (
              <button className="filter-button group" key={filter.value}>
                {/* Enhanced gradient overlay */}
                <div className="gradient-overlay-primary duration-normal absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className="rounded-lg bg-[rgb(var(--primary)/var(--opacity-10))] p-2">
                    <Activity className="size-4 text-[rgb(var(--primary)/var(--opacity-100))]" />
                  </div>
                  <span className="duration-normal text-sm font-medium text-[rgb(var(--foreground)/var(--opacity-70))] transition-colors group-hover:text-[rgb(var(--foreground)/var(--opacity-100))]">
                    {filter.label}
                  </span>
                  <span className="filter-count">{filter.count}</span>
                </div>

                {/* Scanning line effect */}
                <div className="duration-normal absolute inset-0 overflow-hidden opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="scan-line-primary group-hover:animate-scan absolute -left-full top-0 h-px w-full" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
