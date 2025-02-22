'use client'

import { Settings, User } from 'lucide-react'
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

import { NotificationCenter } from './notification-center'

export function DashboardHeader() {
  return (
    <header className="flex h-12 items-center gap-2 border-b border-white/5 bg-black/30 px-3 backdrop-blur-lg">
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <NotificationCenter />
        <Button className="header-button" size="sm" variant="ghost">
          <Settings className="header-icon" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="header-button" variant="ghost">
              <User className="header-icon" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="header-dropdown">
            <DropdownMenuLabel className="header-dropdown-label">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-white/90">Dr. Smith</p>
                <p className="text-[10px] text-white/60">dr.smith@neuvia.com</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="header-dropdown-separator" />
            <DropdownMenuItem className="header-dropdown-item">
              <Link className="flex w-full" href="/dashboard/profile">
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="header-dropdown-item">
              <Link className="flex w-full" href="/dashboard/settings">
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="header-dropdown-separator" />
            <DropdownMenuItem className="header-dropdown-item text-red-400 hover:text-red-300">
              <Link className="flex w-full" href="/auth/signout">
                Sign out
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
