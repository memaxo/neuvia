'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LineChart,
  Menu,
  Settings,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SearchBar } from './search-bar'

const sidebarLinks = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    description: 'Overview and quick actions',
  },
  {
    title: 'Patients',
    href: '/dashboard/patients',
    icon: Users,
    description: 'Manage patient records',
  },
  {
    title: 'Reports',
    href: '/dashboard/reports',
    icon: FileText,
    description: 'View and generate reports',
  },
  {
    title: 'Analysis',
    href: '/dashboard/analysis',
    icon: LineChart,
    description: 'Data analysis and insights',
  },
  {
    title: 'Activity',
    href: '/dashboard/activity',
    icon: Activity,
    description: 'Recent system activity',
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    description: 'System configuration',
  },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div
      className={cn(
        'sticky top-0 flex h-screen flex-col',
        'bg-black/20 backdrop-blur-xl',
        isCollapsed ? 'w-[80px]' : 'w-[280px]'
      )}
    >
      {/* Logo section */}
      <div className="flex items-center justify-between border-b border-white/5 p-4 md:p-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 p-2">
            <Activity className="h-full w-full text-cyan-400" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </div>
          {!isCollapsed && (
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-lg font-bold text-transparent">
              Neuvia
            </span>
          )}
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="group relative overflow-hidden bg-black/20 text-white/70 hover:bg-black/40 hover:text-white"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
          <div className="absolute inset-0 overflow-hidden">
            <div className="group-hover:animate-scan absolute -left-full top-0 h-[1px] w-full bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
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
                      'group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300',
                      'hover:bg-black/40 hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]',
                      isActive
                        ? 'border border-cyan-500/30 bg-black/40'
                        : 'border border-transparent',
                      isCollapsed ? 'justify-center' : ''
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
                        'border border-white/10 bg-gradient-to-br from-cyan-500/20 to-purple-500/20',
                        'transition-colors duration-300 group-hover:border-cyan-500/20'
                      )}
                    >
                      <link.icon
                        className={cn(
                          'h-5 w-5 transition-colors duration-300',
                          isActive
                            ? 'text-cyan-400'
                            : 'text-white/70 group-hover:text-cyan-400'
                        )}
                      />
                    </div>
                    {!isCollapsed && (
                      <div className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block text-sm font-medium transition-colors duration-300',
                            isActive
                              ? 'text-white'
                              : 'text-white/70 group-hover:text-white'
                          )}
                        >
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
                      <p className="text-xs text-white/70">
                        {link.description}
                      </p>
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
