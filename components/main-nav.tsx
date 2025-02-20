"use client"

import * as React from "react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { LogOut } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { ThemeToggle } from "./theme-toggle"
import useSupabaseBrowser from "@/utils/supabase-browser"
import Image from "next/image"

import { NavItem } from "@/types/nav"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

interface MainNavProps {
  items?: NavItem[]
}

export function MainNav({ items }: MainNavProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const supabase = useSupabaseBrowser()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)

      // Subscribe to auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        setIsAuthenticated(!!session)
      })

      return () => subscription.unsubscribe()
    }

    checkSession()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex gap-4 md:gap-8 backdrop-blur-sm bg-spline-blue/5 px-4 py-2 rounded-full shadow-spline">
        <Link href="/" className="flex items-center space-x-2 group">
          <Image 
            src="/neuvia-comp.jpg" 
            alt="Neuvia Logo" 
            width={24} 
            height={24} 
            className="rounded-full group-hover:opacity-90 transition-opacity"
          />
          <span className="inline-block font-bold text-white group-hover:text-spline-cyan transition-colors">{siteConfig.name}</span>
        </Link>
        {items?.length ? (
          <nav className="flex gap-6">
            {items?.map(
              (item, index) =>
                item.href && (
                  <Link
                    key={index}
                    href={item.href}
                    className={cn(
                      "flex items-center text-sm font-medium text-white/80 hover:text-spline-cyan transition-all relative group px-3 py-1",
                      item.disabled && "cursor-not-allowed opacity-80"
                    )}
                  >
                    {item.title}
                    <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-spline-cyan via-spline-blue to-spline-magenta scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
                  </Link>
                )
            )}
          </nav>
        ) : null}
      </div>

      <div className="flex items-center gap-4 backdrop-blur-sm bg-spline-blue/5 px-4 py-2 rounded-full shadow-spline">
        {isAuthenticated ? (
          <>
            <Link
              href="/dashboard"
              className={buttonVariants({
                variant: "ghost",
                className: "text-base font-medium text-white/80 hover:text-spline-cyan transition-all relative group px-4 py-2"
              })}
            >
              Dashboard
              <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-spline-cyan via-spline-blue to-spline-magenta scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
            </Link>
            <button
              onClick={handleLogout}
              className={buttonVariants({
                variant: "ghost",
                className: "text-base font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all px-4 py-2 rounded-full backdrop-blur-sm"
              })}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              href="/auth"
              className={buttonVariants({
                variant: "ghost",
                className: "text-base font-medium text-white/80 hover:text-spline-cyan transition-all relative group px-4 py-2"
              })}
            >
              Sign In
              <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-spline-cyan via-spline-blue to-spline-magenta scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
            </Link>
            <Link
              href="/onboarding"
              className={buttonVariants({
                className: "bg-gradient-to-r from-spline-cyan via-spline-blue to-spline-magenta hover:from-spline-cyan/90 hover:via-spline-blue/90 hover:to-spline-magenta/90 text-base font-semibold text-white px-6 py-2 rounded-full shadow-spline hover:shadow-xl transition-all hover:-translate-y-0.5"
              })}
            >
              Sign Up
            </Link>
          </>
        )}
        <ThemeToggle />
      </div>
    </div>
  )
}
