"use client"

import { ArrowDownIcon, ArrowUpIcon, PlusCircle, Upload, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { mockTrendData } from "./types"
import { Sparkline } from "./visualizations/sparkline"

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
    <div className="card-premium rounded-lg">
      <div className="card-premium-header">
        <div className="card-premium-header-content">
          <h3 className="card-premium-title">Quick Stats</h3>
        </div>
      </div>
      <div className="card-premium-content">
        <div className="card-premium-grid grid-cols-3">
          {stats.map((stat, index) => (
            <div 
              key={index}
              className="relative p-3 rounded-lg bg-black/20 border border-white/5 hover:border-white/10 transition-all duration-300"
            >
              {/* Header with label and trend */}
              <div className="flex items-center justify-between mb-2">
                <span className="stat-label">{stat.label}</span>
                <div className={cn(
                  "stat-trend",
                  stat.trend.isPositive ? "stat-trend-positive" : "stat-trend-negative"
                )}>
                  {stat.trend.isPositive ? (
                    <ArrowUpIcon className="stat-trend-icon" />
                  ) : (
                    <ArrowDownIcon className="stat-trend-icon" />
                  )}
                  <span className="stat-trend-value">{stat.trend.value}%</span>
                </div>
              </div>

              {/* Value and action row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-baseline gap-1.5">
                  <span className={cn(
                    "stat-value",
                    stat.priority === "high" ? "stat-value-lg" : "stat-value-md",
                    stat.color === "spline-cyan" ? "text-[#4B6BFD]" : 
                    stat.color === "spline-blue" ? "text-[#0066FF]" : 
                    "text-[#FF00FF]"
                  )}>
                    {stat.value.toLocaleString()}
                  </span>
                  <span className="stat-label">
                    {stat.priority === "high" ? "critical" : stat.priority === "medium" ? "attention" : "normal"}
                  </span>
                </div>
                {stat.action && (
                  <Link href={stat.action.href}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="action-button"
                    >
                      <stat.action.icon className="action-button-icon" />
                      <span className="action-button-text">{stat.action.label}</span>
                    </Button>
                  </Link>
                )}
              </div>

              {/* Sparkline */}
              <div className="h-[12px]">
                <Sparkline
                  data={mockTrendData[stat.trendKey]}
                  color={stat.color === "spline-cyan" ? "#4B6BFD" : 
                         stat.color === "spline-blue" ? "#0066FF" : 
                         "#FF00FF"}
                  height={12}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 