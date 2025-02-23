'use client'

import { Settings, User } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { NotificationCenter } from './notification-center'

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-2 border-b border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-95)] backdrop-blur-xl">
      <div className="relative flex w-full items-center justify-between px-6">
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <Button
            className="text-[rgb(var(--foreground))/var(--opacity-70)] hover:bg-[rgb(var(--primary))/var(--opacity-10)] hover:text-[rgb(var(--primary))]"
            size="icon"
            variant="ghost"
          >
            <Settings className="size-4" />
            <span className="sr-only">Settings</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="text-[rgb(var(--foreground))/var(--opacity-70)] hover:bg-[rgb(var(--primary))/var(--opacity-10)] hover:text-[rgb(var(--primary))]"
                variant="ghost"
              >
                <User className="size-4" />
                <span className="sr-only">User menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="space-y-1">
                <p className="text-sm font-medium text-[rgb(var(--foreground))]">Dr. Smith</p>
                <p className="text-xs text-[rgb(var(--foreground))/var(--opacity-60)]">dr.smith@neuvia.com</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Link className="flex w-full items-center" href={'/dashboard/profile' as Route}>
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link className="flex w-full items-center" href={'/dashboard/settings' as Route}>
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-[rgb(var(--error))] hover:text-[rgb(var(--error))/var(--opacity-90)]">
                <Link className="flex w-full items-center" href={'/auth/signout' as Route}>
                  Sign out
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
