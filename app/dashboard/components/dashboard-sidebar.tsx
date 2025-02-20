"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LineChart,
  Activity
} from "lucide-react"

const sidebarLinks = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard
  },
  {
    title: "Patients",
    href: "/dashboard/patients",
    icon: Users
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: FileText
  },
  {
    title: "Analysis",
    href: "/dashboard/analysis",
    icon: LineChart
  },
  {
    title: "Activity",
    href: "/dashboard/activity",
    icon: Activity
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings
  }
]

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed top-0 left-0 z-30 h-screen w-64 bg-black/30 backdrop-blur-lg border-r border-spline-cyan/10">
      <div className="flex h-14 items-center border-b border-spline-cyan/10 px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold bg-gradient-to-r from-spline-cyan to-spline-blue bg-clip-text text-transparent">
            Neuvia
          </span>
        </Link>
      </div>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            {sidebarLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-300 group",
                    isActive
                      ? "bg-spline-blue/20 text-spline-cyan"
                      : "text-white/70 hover:bg-spline-blue/10 hover:text-spline-cyan"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.title}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </aside>
  )
} 