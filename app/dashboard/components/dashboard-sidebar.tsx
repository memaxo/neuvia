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
  const [isOpen, setIsOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      setIsOpen(window.innerWidth >= 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <TooltipProvider>
      <div>
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50 md:hidden h-10 w-10"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Menu className="h-5 w-5 text-white/80" />
        </Button>
        
        <aside className={cn(
          "fixed md:relative h-screen bg-black/30 backdrop-blur-lg border-r border-white/5",
          "transition-all duration-300 ease-in-out",
          isCollapsed ? "w-[72px]" : "w-64",
          isMobile && !isOpen ? "-translate-x-full" : "translate-x-0",
          isMobile ? "z-40" : ""
        )}>
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex h-14 items-center justify-between border-b border-white/5 px-4">
              <Link href="/" className={cn(
                "flex items-center gap-2 transition-opacity duration-200",
                isCollapsed ? "opacity-0" : "opacity-100"
              )}>
                <span className="text-xl font-bold bg-gradient-to-r from-[#4B6BFD] to-[#0066FF] bg-clip-text text-transparent">
                  Neuvia
                </span>
              </Link>
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white/60 hover:text-white/80 hover:bg-white/5"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-5 w-5" />
                  ) : (
                    <ChevronLeft className="h-5 w-5" />
                  )}
                </Button>
              )}
            </div>
            
            {/* Search - Only show when expanded */}
            <div className={cn(
              "p-4 transition-opacity duration-200",
              isCollapsed ? "opacity-0" : "opacity-100 h-[72px]",
              isCollapsed && "h-0 p-0 overflow-hidden"
            )}>
              <SearchBar />
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-3">
              {sidebarLinks.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href

                return (
                  <Tooltip key={link.href} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link
                        href={link.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5",
                          "transition-all duration-300",
                          isActive
                            ? "bg-[#4B6BFD]/10 text-white"
                            : "text-white/70 hover:bg-white/5 hover:text-white"
                        )}
                        onClick={() => isMobile && setIsOpen(false)}
                      >
                        <Icon className={cn(
                          "h-5 w-5 transition-transform duration-300",
                          "group-hover:scale-110"
                        )} />
                        <span className={cn(
                          "flex-1 transition-all duration-200 text-sm",
                          isCollapsed ? "opacity-0 w-0" : "opacity-100"
                        )}>
                          {link.title}
                        </span>
                        {isActive && !isCollapsed && (
                          <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        )}
                      </Link>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right" className="ml-2 bg-black/90 border-white/10">
                        <p className="text-sm font-medium text-white/90">{link.title}</p>
                        <p className="text-xs text-white/70">{link.description}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                )
              })}
            </nav>
          </div>
        </aside>
        
        {/* Backdrop for mobile */}
        {isMobile && isOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30"
            onClick={() => setIsOpen(false)}
          />
        )}
      </div>
    </TooltipProvider>
  )
} 