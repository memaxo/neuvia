"use client"

import { ArrowDownIcon, ArrowUpIcon, PlusCircle, Upload, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { mockTrendData } from "./types"
import { Sparkline } from "./visualizations/sparkline"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface StatItem {
  label: string
  value: number
  trend: {
    value: number
    isPositive: boolean
  }
  color: string
  priority: "high" | "medium" | "low"
  action?: {
    label: string
    href: string
    icon: any
  }
  trendKey: string
}

const stats: StatItem[] = [
  {
    label: "Total Patients",
    value: 1234,
    trend: {
      value: 12,
      isPositive: true
    },
    color: "spline-cyan",
    priority: "high",
    action: {
      label: "Add Patient",
      href: "/dashboard/patients/new",
      icon: PlusCircle
    },
    trendKey: "total-patients"
  },
  {
    label: "Pending Uploads",
    value: 5,
    trend: {
      value: 2,
      isPositive: false
    },
    color: "spline-blue",
    priority: "medium",
    action: {
      label: "Upload Scan",
      href: "/dashboard/upload",
      icon: Upload
    },
    trendKey: "pending-uploads"
  },
  {
    label: "High-Risk Patients",
    value: 12,
    trend: {
      value: 3,
      isPositive: true
    },
    color: "spline-magenta",
    priority: "high",
    action: {
      label: "View Risks",
      href: "/dashboard/patients?risk=high",
      icon: AlertCircle
    },
    trendKey: "high-risk"
  }
]

export function QuickStats() {
  return (
    <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-black/30 border border-white/10">
      {/* Header with enhanced gradient and spacing */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-extrabold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            Quick Stats
          </h3>
        </div>
      </div>

      {/* Enhanced content section */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <TooltipProvider key={index}>
              <div 
                className="group relative p-6 rounded-xl bg-black/20 border border-white/5 
                         hover:border-cyan-500/30 hover:bg-black/40 
                         transition-all duration-300 hover:-translate-y-1 
                         hover:shadow-[0_0_40px_rgba(0,255,255,0.2)]"
              >
                {/* Enhanced gradient overlay effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />

                {/* Content wrapper */}
                <div className="relative z-10">
                  {/* Header with label and trend */}
                  <div className="flex items-center justify-between mb-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-base font-medium text-white/90 cursor-help group-hover:text-white transition-colors duration-300">
                          {stat.label}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View detailed {stat.label.toLowerCase()} statistics</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full cursor-help",
                          "bg-black/40 backdrop-blur-sm group-hover:bg-black/60 transition-colors duration-300",
                          stat.trend.isPositive ? "text-cyan-400" : "text-red-400"
                        )}>
                          {stat.trend.isPositive ? (
                            <ArrowUpIcon className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownIcon className="h-3.5 w-3.5" />
                          )}
                          <span className="text-sm font-medium">{stat.trend.value}%</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{stat.trend.isPositive ? 'Increased' : 'Decreased'} by {stat.trend.value}% from last period</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Value and action row */}
                  <div className="flex items-center justify-between mb-6">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="space-y-2 cursor-help">
                          <div className="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                            {stat.value.toLocaleString()}
                          </div>
                          <div className={cn(
                            "inline-flex px-2.5 py-1 rounded-full text-sm font-medium",
                            stat.priority === "high" ? "bg-red-500/20 text-red-300" :
                            stat.priority === "medium" ? "bg-yellow-500/20 text-yellow-300" :
                            "bg-green-500/20 text-green-300"
                          )}>
                            {stat.priority === "high" ? "critical" : stat.priority === "medium" ? "attention" : "normal"}
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
                          className="relative overflow-hidden group/btn bg-black/40 hover:bg-black/60 
                                   text-white/80 hover:text-white transition-all duration-300
                                   hover:shadow-[0_0_30px_rgba(0,255,255,0.2)] hover:scale-105
                                   backdrop-blur-sm rounded-xl px-4 py-2"
                        >
                          <span className="relative z-10 flex items-center gap-2">
                            <stat.action.icon className="h-4 w-4" />
                            <span className="font-medium">{stat.action.label}</span>
                          </span>
                          {/* Enhanced scanning line effect */}
                          <div className="absolute inset-0 overflow-hidden">
                            <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent group-hover/btn:animate-scan" />
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
                          color={stat.color === "spline-cyan" ? "#4B6BFD" : 
                                 stat.color === "spline-blue" ? "#0066FF" : 
                                 "#FF00FF"}
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
                <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent group-hover:animate-scan" />
                </div>
              </div>
            </TooltipProvider>
          ))}
        </div>
      </div>
    </div>
  )
} 