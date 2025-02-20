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
  Activity,
  Menu,
  ChevronRight,
  ChevronLeft
} from "lucide-react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { SearchBar } from "./search-bar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const sidebarLinks = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Overview and quick actions"
  },
  {
    title: "Patients",
    href: "/dashboard/patients",
    icon: Users,
    description: "Manage patient records"
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: FileText,
    description: "View and generate reports"
  },
  {
    title: "Analysis",
    href: "/dashboard/analysis",
    icon: LineChart,
    description: "Data analysis and insights"
  },
  {
    title: "Activity",
    href: "/dashboard/activity",
    icon: Activity,
    description: "Recent system activity"
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    description: "System configuration"
  }
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className={cn(
      "h-screen sticky top-0 flex flex-col",
      "bg-black/20 backdrop-blur-xl",
      isCollapsed ? "w-[80px]" : "w-[280px]"
    )}>
      {/* Logo section */}
      <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 p-2">
            <Activity className="w-full h-full text-cyan-400" />
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text">
              Neuvia
            </span>
          )}
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="relative overflow-hidden group bg-black/20 hover:bg-black/40 text-white/70 hover:text-white"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent group-hover:animate-scan" />
          </div>
        </Button>
      </div>

      {/* Search bar */}
      {!isCollapsed && (
        <div className="p-4">
          <SearchBar />
        </div>
      )}

      {/* Navigation links */}
      <nav className="flex-1 overflow-y-auto p-2">
        {sidebarLinks.map((link) => {
          const isActive = pathname === link.href
          return (
            <TooltipProvider key={link.href}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={link.href}
                    className={cn(
                      "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                      "hover:bg-black/40 hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]",
                      isActive ? "bg-black/40 border border-cyan-500/30" : "border border-transparent",
                      isCollapsed ? "justify-center" : ""
                    )}
                  >
                    <div className={cn(
                      "flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl",
                      "bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10",
                      "group-hover:border-cyan-500/20 transition-colors duration-300"
                    )}>
                      <link.icon className={cn(
                        "h-5 w-5 transition-colors duration-300",
                        isActive ? "text-cyan-400" : "text-white/70 group-hover:text-cyan-400"
                      )} />
                    </div>
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          "block text-sm font-medium transition-colors duration-300",
                          isActive ? "text-white" : "text-white/70 group-hover:text-white"
                        )}>
                          {link.title}
                        </span>
                        <span className="block text-xs text-white/50">
                          {link.description}
                        </span>
                      </div>
                    )}
                  </Link>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">
                    <div className="space-y-1">
                      <p className="font-medium">{link.title}</p>
                      <p className="text-xs text-white/70">{link.description}</p>
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </nav>
    </div>
  )
} 