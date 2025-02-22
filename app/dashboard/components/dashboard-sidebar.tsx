'use client'

import {
  Activity,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LineChart,
  Settings,
  Users,
} from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { SearchBar } from './search-bar'


interface SidebarProps {
  children: React.ReactNode
  defaultCollapsed?: boolean
  collapsible?: 'icon' | 'offcanvas' | 'none'
  className?: string
}

interface SidebarComposition {
  Header: typeof Header
  Content: typeof Content
}

const Header = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex items-center justify-between p-4">{children}</div>
}
Header.displayName = "SidebarHeader"

const Content = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex-1 overflow-auto py-2">{children}</div>
}
Content.displayName = "SidebarContent"

const Sidebar: React.FC<SidebarProps> & SidebarComposition = Object.assign(
  ({
    children,
    defaultCollapsed = false,
    collapsible = 'icon',
    className,
  }: SidebarProps) => {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
    
    return (
      <aside 
        className={cn(
          "group/sidebar relative flex h-full flex-col overflow-hidden border-r bg-background",
          className
        )}
        data-collapsed={isCollapsed}
        data-collapsible={collapsible}
      >
        {children}
        {collapsible === 'icon' && (
          <button
            className="absolute right-4 top-4 opacity-0 transition-opacity group-hover/sidebar:opacity-100"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <ChevronLeft className="size-4" />
            <span className="sr-only">Toggle Sidebar</span>
          </button>
        )}
      </aside>
    )
  },
  { Header, Content, displayName: "Sidebar" }
)

interface SidebarLink {
  title: string
  href: Route
  icon: (props: { className?: string }) => JSX.Element
  description: string
}

const sidebarLinks: SidebarLink[] = [
  {
    title: 'Dashboard',
    href: '/dashboard' as Route,
    icon: LayoutDashboard,
    description: 'Overview and quick actions',
  },
  {
    title: 'Patients',
    href: '/dashboard/patients' as Route,
    icon: Users,
    description: 'Manage patient records',
  },
  {
    title: 'Reports',
    href: '/dashboard/reports' as Route,
    icon: FileText,
    description: 'View and generate reports',
  },
  {
    title: 'Analysis',
    href: '/dashboard/analysis' as Route,
    icon: LineChart,
    description: 'Data analysis and insights',
  },
  {
    title: 'Activity',
    href: '/dashboard/activity' as Route,
    icon: Activity,
    description: 'Recent activity and logs',
  },
  {
    title: 'Settings',
    href: '/dashboard/settings' as Route,
    icon: Settings,
    description: 'Account and app settings',
  },
]

export function DashboardSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          className="flex size-10 items-center justify-center p-0 hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
          variant="ghost"
        >
          <ChevronRight className="size-4" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-[300px] flex-col p-0" side="left">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle>Dashboard</SheetTitle>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto p-2">
          {sidebarLinks.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300',
                  'hover:bg-black/40 hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]',
                  isActive
                    ? 'border border-cyan-500/30 bg-black/40'
                    : 'border border-transparent'
                )}
                href={link.href}
                key={link.href}
              >
                <link.icon className="size-5 shrink-0" />
                <div className="flex flex-col">
                  <span>{link.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {link.description}
                  </span>
                </div>
              </Link>
            )
          })}
        </nav>
      </SheetContent>
      <div className="hidden md:flex">
        <Sidebar
          className="min-h-screen border-r"
          collapsible="icon"
          defaultCollapsed={false}
        >
          <Sidebar.Header>
            <Button
              className="size-10"
              onClick={() => setIsCollapsed(!isCollapsed)}
              variant="ghost"
            >
              {isCollapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronLeft className="size-4" />
              )}
              <span className="sr-only">Toggle sidebar</span>
            </Button>
          </Sidebar.Header>
          <Sidebar.Content>
            <div className="px-2">
              <SearchBar />
            </div>
            <nav className="flex-1 overflow-y-auto p-2">
              {sidebarLinks.map((link) => {
                const isActive = pathname === link.href
                return (
                  <TooltipProvider key={link.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          className={cn(
                            'group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300',
                            'hover:bg-black/40 hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]',
                            isActive
                              ? 'border border-cyan-500/30 bg-black/40'
                              : 'border border-transparent',
                            isCollapsed ? 'justify-center' : ''
                          )}
                          href={link.href}
                        >
                          <link.icon
                            className={cn('size-5 shrink-0', {
                              'text-muted-foreground': !isActive,
                            })}
                          />
                          {!isCollapsed && (
                            <div className="flex flex-col">
                              <span>{link.title}</span>
                              <span className="text-sm text-muted-foreground">
                                {link.description}
                              </span>
                            </div>
                          )}
                        </Link>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          <div className="flex flex-col gap-1">
                            <span>{link.title}</span>
                            <span className="text-sm text-muted-foreground">
                              {link.description}
                            </span>
                          </div>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                )
              })}
            </nav>
          </Sidebar.Content>
        </Sidebar>
      </div>
    </Sheet>
  )
}
