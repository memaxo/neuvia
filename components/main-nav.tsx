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
  const [isScrolled, setIsScrolled] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
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
    setIsLoaded(true)

    // Handle scroll events
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 px-4 py-3 transition-all duration-300",
      isScrolled && "bg-background/80 backdrop-blur-lg shadow-lg border-b border-border/50 dark:bg-background/40",
      "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-border/50 after:to-transparent"
    )}>
      <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
        <div className={cn(
          "flex gap-4 md:gap-8 px-4 py-2 rounded-full transition-all duration-500",
          "bg-white/[0.03] dark:bg-black/[0.03]",
          "backdrop-blur-md",
          "border border-white/10 dark:border-black/10",
          isScrolled ? "shadow-sm" : "shadow-spline",
          isLoaded && "animate-fade-in"
        )}>
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="relative overflow-hidden rounded-full">
              <Image 
                src="/neuvia-comp.jpg" 
                alt="Neuvia Logo" 
                width={28} 
                height={28} 
                className={cn(
                  "rounded-full transition-all duration-300 transform",
                  "group-hover:scale-110 group-hover:brightness-110",
                  "dark:brightness-110",
                  isLoaded && "animate-scale-in"
                )}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className={cn(
              "inline-block font-bold transition-all duration-300",
              "text-foreground/90 group-hover:text-primary dark:text-foreground/80",
              isLoaded && "animate-fade-in-right"
            )}>
              {siteConfig.name}
            </span>
          </Link>
          {items?.length ? (
            <nav className={cn("flex gap-6", isLoaded && "animate-fade-in")}>
              {items?.map(
                (item, index) =>
                  item.href && (
                    <Link
                      key={index}
                      href={item.href}
                      className={cn(
                        "flex items-center text-sm font-medium transition-all relative group px-3 py-1",
                        "text-foreground/70 dark:text-foreground/60",
                        "hover:text-foreground dark:hover:text-foreground/90",
                        item.disabled && "cursor-not-allowed opacity-80"
                      )}
                    >
                      {item.title}
                      <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-primary/60 via-primary/80 to-secondary/60 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                    </Link>
                  )
              )}
            </nav>
          ) : null}
        </div>

        <div className={cn(
          "flex items-center gap-4 px-4 py-2 rounded-full transition-all duration-500",
          "bg-white/[0.03] dark:bg-black/[0.03]",
          "backdrop-blur-md",
          "border border-white/10 dark:border-black/10",
          isScrolled ? "shadow-sm" : "shadow-spline",
          isLoaded && "animate-fade-in"
        )}>
          {isAuthenticated ? (
            <>
              <Link
                href="/dashboard"
                className={buttonVariants({
                  variant: "ghost",
                  className: cn(
                    "text-base font-medium transition-all relative group px-4 py-2",
                    "text-foreground/70 dark:text-foreground/60",
                    "hover:text-foreground dark:hover:text-foreground/90",
                    "hover:bg-foreground/[0.03] dark:hover:bg-foreground/[0.02]"
                  )
                })}
              >
                Dashboard
                <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-primary/60 via-primary/80 to-secondary/60 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              </Link>
              <button
                onClick={handleLogout}
                className={buttonVariants({
                  variant: "ghost",
                  className: cn(
                    "text-base font-medium transition-all px-4 py-2 rounded-full",
                    "text-destructive/80 dark:text-destructive/70",
                    "hover:text-destructive dark:hover:text-destructive/90",
                    "hover:bg-destructive/[0.03] dark:hover:bg-destructive/[0.02]",
                    "backdrop-blur-sm"
                  )
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
                  className: cn(
                    "text-base font-medium transition-all relative group px-4 py-2",
                    "text-foreground/70 dark:text-foreground/60",
                    "hover:text-foreground dark:hover:text-foreground/90",
                    "hover:bg-foreground/[0.03] dark:hover:bg-foreground/[0.02]",
                    "after:absolute after:inset-x-2 after:-bottom-1 after:h-px",
                    "after:bg-gradient-to-r after:from-primary/0 after:via-primary/50 after:to-primary/0",
                    "after:translate-y-1 after:opacity-0",
                    "hover:after:translate-y-0 hover:after:opacity-100",
                    "after:transition-all after:duration-300"
                  )
                })}
              >
                Sign In
              </Link>
              <Link
                href="/onboarding"
                className={cn(
                  "relative group",
                  "inline-flex items-center justify-center",
                  "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600",
                  "dark:from-blue-500 dark:via-indigo-500 dark:to-purple-500",
                  "text-white font-semibold",
                  "px-8 py-2.5 rounded-full",
                  "transition-all duration-300",
                  "hover:shadow-[0_0_25px_rgba(79,70,229,0.4)] dark:hover:shadow-[0_0_25px_rgba(99,102,241,0.4)]",
                  "hover:scale-[1.02]",
                  "before:absolute before:inset-0",
                  "before:bg-gradient-to-r before:from-indigo-600 before:via-purple-600 before:to-blue-600",
                  "dark:before:from-indigo-500 dark:before:via-purple-500 dark:before:to-blue-500",
                  "before:rounded-full before:transition-[transform,opacity] before:duration-500",
                  "before:opacity-0 before:hover:opacity-100",
                  "before:scale-x-[1.1] before:hover:scale-100",
                  "before:origin-left",
                  "after:absolute after:inset-[-1px]",
                  "after:rounded-[100px] after:bg-gradient-to-r",
                  "after:from-blue-400/40 after:via-indigo-400/40 after:to-purple-400/40",
                  "dark:after:from-blue-300/30 dark:after:via-indigo-300/30 dark:after:to-purple-300/30",
                  "after:transition-all after:duration-500",
                  "after:opacity-20 hover:after:opacity-40",
                  "after:blur-0 hover:after:blur-sm",
                  "overflow-hidden",
                  "border-[0.5px] border-white/20 dark:border-white/10",
                  "backdrop-blur-sm",
                  "isolate"
                )}
              >
                <span className="relative z-10 flex items-center gap-2 transition-transform duration-300 group-hover:translate-x-1">
                  <span className="relative">
                    Sign Up
                    <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100" />
                  </span>
                  <svg 
                    className="w-4 h-4 transform transition-all duration-300 group-hover:translate-x-1 group-hover:scale-110" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M13 7l5 5m0 0l-5 5m5-5H6" 
                      className="group-hover:stroke-[2.5]"
                    />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.1),transparent_50%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute top-0 left-[-100%] h-full w-[120%] rotate-45 bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:left-[100%] transition-all duration-700 ease-out" />
              </Link>
            </>
          )}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 dark:from-primary/10 dark:to-secondary/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  )
}
