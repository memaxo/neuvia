'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { MainNav } from '@/components/main-nav'
import { MobileNav } from '@/components/mobile-nav'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/config/site'
import { useAuth } from '@/contexts/AuthContext'

export function SiteHeader() {
  const pathname = usePathname()
  const { session } = useAuth()
  const isAuthenticated = !!session

  const isAuthPage = pathname?.startsWith('/auth')
  const isDashboard = pathname?.startsWith('/dashboard')

  if (isAuthPage) return null

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[rgb(var(--border)/var(--opacity-10))] bg-[rgb(var(--background)/var(--opacity-40))] backdrop-blur-xl">
      <div className="container flex h-16 items-center">
        <MainNav />
        <MobileNav />
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            {!isAuthenticated && !isDashboard ? (
              <>
                <Link href={'/auth/login' as Route}>
                  <Button
                    className="text-[rgb(var(--foreground)/var(--opacity-70))] hover:bg-[rgb(var(--primary)/var(--opacity-10))] hover:text-[rgb(var(--primary))]"
                    variant="ghost"
                  >
                    Login
                  </Button>
                </Link>
                <Link href={'/auth/register' as Route}>
                  <Button
                    className="group relative overflow-hidden"
                    variant="premium"
                  >
                    Get Started
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                    </div>
                  </Button>
                </Link>
              </>
            ) : null}
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  )
}
