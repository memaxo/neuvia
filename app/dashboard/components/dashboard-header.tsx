"use client"

import { Bell, Settings, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function DashboardHeader() {
  return (
    <header className="flex h-14 items-center gap-4 px-6 bg-black/30 backdrop-blur-lg border-b border-spline-cyan/10">
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="icon"
        className="text-white/70 hover:text-spline-cyan hover:bg-spline-blue/10 transition-colors"
      >
        <Bell className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-white/70 hover:text-spline-cyan hover:bg-spline-blue/10 transition-colors"
      >
        <Settings className="h-5 w-5" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="relative h-8 w-8 rounded-full bg-spline-blue/10 hover:bg-spline-blue/20 transition-colors"
          >
            <User className="h-5 w-5 text-white/70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">Dr. Smith</p>
              <p className="text-xs leading-none text-muted-foreground">dr.smith@neuvia.com</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Link href="/dashboard/profile" className="flex w-full">
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link href="/dashboard/settings" className="flex w-full">
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Link href="/auth/signout" className="flex w-full text-red-500">
              Sign out
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
} 