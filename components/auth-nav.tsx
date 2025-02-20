"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import useSupabaseBrowser from "@/utils/supabase-browser"
import { ThemeToggle } from "./theme-toggle"
import { LogOut } from "lucide-react"

export function AuthNav() {
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

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className={buttonVariants({
            variant: "ghost",
            className: "text-base font-semibold"
          })}
        >
          Dashboard
        </Link>
        <button
          onClick={handleLogout}
          className={buttonVariants({
            variant: "ghost",
            className: "text-base font-semibold text-red-500 hover:text-red-600 hover:bg-red-100/10"
          })}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </button>
        <ThemeToggle />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <Link
        href="/auth"
        className={buttonVariants({
          variant: "ghost",
          className: "text-base font-semibold"
        })}
      >
        Sign In
      </Link>
      <Link
        href="/onboarding"
        className={buttonVariants({
          className: "bg-cyan-500 hover:bg-cyan-600 text-base font-semibold"
        })}
      >
        Sign Up
      </Link>
      <ThemeToggle />
    </div>
  )
} 