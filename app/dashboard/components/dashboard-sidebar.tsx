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
  return (
    <div className="flex items-center justify-between border-b border-[rgb(var(--border))/var(--opacity-5)] p-4">
      {children}
    </div>
  )
}
Header.displayName = 'SidebarHeader'

const Content = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex-1 overflow-auto py-2">{children}</div>
}
Content.displayName = 'SidebarContent'

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
          'group/sidebar duration-normal relative flex h-screen flex-col overflow-hidden bg-[rgb(var(--background))/var(--opacity-95)] backdrop-blur-xl transition-all',
          'after:absolute after:right-0 after:h-full after:w-px after:bg-gradient-to-b after:from-transparent after:via-[rgb(var(--border))/var(--opacity-5)] after:to-transparent',
          className
        )}
        data-collapsed={isCollapsed}
        data-collapsible={collapsible}
      >
        {children}
        {collapsible === 'icon' && (
          <Button
            className="absolute right-4 top-4 size-8 opacity-0 transition-opacity group-hover/sidebar:opacity-100"
            onClick={() => setIsCollapsed(!isCollapsed)}
            size="icon"
            variant="ghost"
          >
            <ChevronLeft className="size-4" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        )}
      </aside>
    )
  },
  { Header, Content, displayName: 'Sidebar' }
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
          className="flex size-10 items-center justify-center p-0 hover:bg-[rgb(var(--primary))/var(--opacity-10)] focus-visible:ring-[rgb(var(--primary))/var(--opacity-20)] md:hidden"
          variant="ghost"
        >
          <ChevronRight className="size-4" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        className="w-[300px] bg-[rgb(var(--background))/var(--opacity-95)] p-0 backdrop-blur-xl"
        side="left"
      >
        <SheetHeader className="border-b border-[rgb(var(--border))/var(--opacity-10)] p-4">
          <SheetTitle>Dashboard</SheetTitle>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto p-2">
          {sidebarLinks.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                className={cn(
                  'duration-normal group flex items-center gap-3 rounded-lg px-4 py-3 transition-all',
                  'hover:bg-[rgb(var(--primary))/var(--opacity-10)]',
                  isActive
                    ? 'bg-[rgb(var(--primary))/var(--opacity-10)] text-[rgb(var(--primary))]'
                    : 'text-[rgb(var(--foreground))/var(--opacity-70)] hover:text-[rgb(var(--foreground))]'
                )}
                href={link.href}
                key={link.href}
              >
                <link.icon
                  className={cn('size-5 shrink-0', {
                    'text-[rgb(var(--primary))]': isActive,
                    'text-[rgb(var(--foreground))/var(--opacity-60)]':
                      !isActive,
                  })}
                />
                <div className="flex flex-col">
                  <span className="font-medium leading-none">{link.title}</span>
                  <span className="mt-1 text-sm leading-none text-[rgb(var(--foreground))/var(--opacity-60)]">
                    {link.description}
                  </span>
                </div>
              </Link>
            )
          })}
        </nav>
      </SheetContent>
      <div className="hidden md:block">
        <aside
          className={cn(
            'group/sidebar relative flex flex-col',
            'h-[calc(100vh-3.5rem)] min-h-0',
            'border-r border-[rgb(var(--border))/var(--opacity-10)]',
            'bg-[rgb(var(--background))/var(--opacity-95)] backdrop-blur-xl',
            'duration-normal overflow-hidden transition-[width] ease-in-out',
            isCollapsed ? 'w-[80px]' : 'w-[280px]'
          )}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-[rgb(var(--border))/var(--opacity-10)] px-4">
            <Button
              className="size-8"
              onClick={() => setIsCollapsed(!isCollapsed)}
              size="icon"
              variant="ghost"
            >
              {isCollapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronLeft className="size-4" />
              )}
              <span className="sr-only">Toggle sidebar</span>
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="h-[72px] shrink-0 border-b border-[rgb(var(--border))/var(--opacity-10)]">
              <div
                className={cn(
                  'duration-normal h-full transition-[opacity,transform]',
                  isCollapsed
                    ? '-translate-x-full opacity-0'
                    : 'translate-x-0 opacity-100'
                )}
              >
                <div className="p-4">
                  <SearchBar />
                </div>
              </div>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {sidebarLinks.map((link) => {
                const isActive = pathname === link.href
                return (
                  <TooltipProvider key={link.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          className={cn(
                            'duration-normal group grid items-start rounded-lg transition-all',
                            'hover:bg-[rgb(var(--primary))/var(--opacity-10)]',
                            isActive
                              ? 'bg-[rgb(var(--primary))/var(--opacity-10)] text-[rgb(var(--primary))]'
                              : 'text-[rgb(var(--foreground))/var(--opacity-70)] hover:text-[rgb(var(--foreground))]',
                            isCollapsed
                              ? 'grid-cols-1 justify-items-center px-2 py-3'
                              : 'grid-cols-[24px,1fr] gap-3 p-3'
                          )}
                          href={link.href}
                        >
                          <link.icon
                            className={cn('mt-0.5 size-5', {
                              'text-[rgb(var(--primary))]': isActive,
                              'text-[rgb(var(--foreground))/var(--opacity-60)]':
                                !isActive,
                            })}
                          />
                          <div
                            className={cn(
                              'duration-normal overflow-hidden transition-[width,opacity,transform]',
                              isCollapsed
                                ? 'hidden w-0 opacity-0'
                                : 'w-auto opacity-100'
                            )}
                          >
                            <span className="block whitespace-nowrap font-medium leading-none">
                              {link.title}
                            </span>
                            <span className="mt-1 block whitespace-nowrap text-sm leading-none text-[rgb(var(--foreground))/var(--opacity-60)]">
                              {link.description}
                            </span>
                          </div>
                        </Link>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{link.title}</span>
                            <span className="text-sm text-[rgb(var(--foreground))/var(--opacity-60)]">
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
          </div>
        </aside>
      </div>
    </Sheet>
  )
}
