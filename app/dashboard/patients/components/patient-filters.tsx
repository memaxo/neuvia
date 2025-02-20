"use client"

import { AlertCircle, User, Calendar, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

const filters = {
  status: [
    { label: "High Risk", value: "high-risk", count: 12, icon: AlertCircle, color: "red" },
    { label: "At Risk", value: "at-risk", count: 28, icon: AlertCircle, color: "orange" },
    { label: "Stable", value: "stable", count: 156, icon: User, color: "green" },
    { label: "New", value: "new", count: 8, icon: User, color: "blue" }
  ],
  appointments: [
    { label: "Today", value: "today", count: 5 },
    { label: "This Week", value: "this-week", count: 18 },
    { label: "This Month", value: "this-month", count: 45 }
  ],
  activity: [
    { label: "Recent Upload", value: "upload", count: 24 },
    { label: "Needs Review", value: "review", count: 12 },
    { label: "Follow-up", value: "follow-up", count: 8 }
  ]
}

export function PatientFilters() {
  return (
    <div className="space-y-6">
      {/* Status Filters */}
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-black/30 border border-white/10">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text">
            Status
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {filters.status.map((filter) => (
              <button
                key={filter.value}
                className={cn(
                  "group relative w-full p-3 rounded-xl",
                  "bg-black/20 backdrop-blur-sm",
                  "border border-white/5 hover:border-cyan-500/30",
                  "transition-all duration-300",
                  "hover:bg-black/40",
                  "hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]",
                  "flex items-center justify-between"
                )}
              >
                {/* Enhanced gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    `bg-${filter.color}-500/10`,
                    "transition-colors duration-300"
                  )}>
                    <filter.icon className={cn(
                      "h-4 w-4",
                      `text-${filter.color}-400`
                    )} />
                  </div>
                  <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors duration-300">
                    {filter.label}
                  </span>
                </div>

                <span className="relative z-10 text-sm text-white/50 group-hover:text-white/70 transition-colors duration-300">
                  {filter.count}
                </span>

                {/* Enhanced scanning line effect */}
                <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent group-hover:animate-scan" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Appointment Filters */}
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-black/30 border border-white/10">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text">
            Appointments
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {filters.appointments.map((filter) => (
              <button
                key={filter.value}
                className={cn(
                  "group relative w-full p-3 rounded-xl",
                  "bg-black/20 backdrop-blur-sm",
                  "border border-white/5 hover:border-cyan-500/30",
                  "transition-all duration-300",
                  "hover:bg-black/40",
                  "hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]",
                  "flex items-center justify-between"
                )}
              >
                {/* Enhanced gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Calendar className="h-4 w-4 text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors duration-300">
                    {filter.label}
                  </span>
                </div>

                <span className="relative z-10 text-sm text-white/50 group-hover:text-white/70 transition-colors duration-300">
                  {filter.count}
                </span>

                {/* Enhanced scanning line effect */}
                <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent group-hover:animate-scan" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Filters */}
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-black/30 border border-white/10">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text">
            Activity
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {filters.activity.map((filter) => (
              <button
                key={filter.value}
                className={cn(
                  "group relative w-full p-3 rounded-xl",
                  "bg-black/20 backdrop-blur-sm",
                  "border border-white/5 hover:border-cyan-500/30",
                  "transition-all duration-300",
                  "hover:bg-black/40",
                  "hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]",
                  "flex items-center justify-between"
                )}
              >
                {/* Enhanced gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Activity className="h-4 w-4 text-purple-400" />
                  </div>
                  <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors duration-300">
                    {filter.label}
                  </span>
                </div>

                <span className="relative z-10 text-sm text-white/50 group-hover:text-white/70 transition-colors duration-300">
                  {filter.count}
                </span>

                {/* Enhanced scanning line effect */}
                <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent group-hover:animate-scan" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 