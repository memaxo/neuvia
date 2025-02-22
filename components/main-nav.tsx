'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { LogOut } from 'lucide-react'
import { NavItem } from '@/types/nav'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { ThemeToggle } from './theme-toggle'

interface MainNavProps {
  items?: NavItem[]
}

export function MainNav({ items }: MainNavProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)

      // Subscribe to auth changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
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
    <div
      className={cn(
        'fixed inset-x-0 top-0 z-50 px-4 py-3 transition-all duration-300',
        isScrolled &&
          'border-b border-border/50 bg-background/80 shadow-lg backdrop-blur-lg dark:bg-background/40',
        'after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-border/50 after:to-transparent'
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <div
          className={cn(
            'flex gap-4 rounded-full px-4 py-2 transition-all duration-500 md:gap-8',
            'bg-white/[0.03] dark:bg-black/[0.03]',
            'backdrop-blur-md',
            'border border-white/10 dark:border-black/10',
            isScrolled ? 'shadow-sm' : 'shadow-spline',
            isLoaded && 'animate-fade-in'
          )}
        >
          <Link href="/" className="group flex items-center space-x-2">
            <div className="relative overflow-hidden rounded-full">
              <Image
                src="/neuvia-comp.jpg"
                alt="Neuvia Logo"
                width={28}
                height={28}
                className={cn(
                  'rounded-full transition-all duration-300',
                  'group-hover:scale-110 group-hover:brightness-110',
                  'dark:brightness-110',
                  isLoaded && 'animate-scale-in'
                )}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
            <span
              className={cn(
                'inline-block font-bold transition-all duration-300',
                'text-foreground/90 group-hover:text-primary dark:text-foreground/80',
                isLoaded && 'animate-fade-in-right'
              )}
            >
              {siteConfig.name}
            </span>
          </Link>
          {items?.length ? (
            <nav className={cn('flex gap-6', isLoaded && 'animate-fade-in')}>
              {items?.map(
                (item, index) =>
                  item.href && (
                    <Link
                      key={index}
                      href={item.href}
                      className={cn(
                        'group relative flex items-center px-3 py-1 text-sm font-medium transition-all',
                        'text-foreground/70 dark:text-foreground/60',
                        'hover:text-foreground dark:hover:text-foreground/90',
                        item.disabled && 'cursor-not-allowed opacity-80'
                      )}
                    >
                      {item.title}
                      <span className="absolute inset-x-0 -bottom-1 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary/60 via-primary/80 to-secondary/60 transition-transform group-hover:scale-x-100" />
                    </Link>
                  )
              )}
            </nav>
          ) : null}
        </div>

        <div
          className={cn(
            'flex items-center gap-4 rounded-full px-4 py-2 transition-all duration-500',
            'bg-white/[0.03] dark:bg-black/[0.03]',
            'backdrop-blur-md',
            'border border-white/10 dark:border-black/10',
            isScrolled ? 'shadow-sm' : 'shadow-spline',
            isLoaded && 'animate-fade-in'
          )}
        >
          {isAuthenticated ? (
            <>
              <Link
                href="/dashboard"
                className={buttonVariants({
                  variant: 'ghost',
                  className: cn(
                    'group relative px-4 py-2 text-base font-medium transition-all',
                    'text-foreground/70 dark:text-foreground/60',
                    'hover:text-foreground dark:hover:text-foreground/90',
                    'hover:bg-foreground/[0.03] dark:hover:bg-foreground/[0.02]'
                  ),
                })}
              >
                Dashboard
                <span className="absolute inset-x-0 -bottom-1 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary/60 via-primary/80 to-secondary/60 transition-transform group-hover:scale-x-100" />
              </Link>
              <button
                onClick={handleLogout}
                className={buttonVariants({
                  variant: 'ghost',
                  className: cn(
                    'rounded-full px-4 py-2 text-base font-medium transition-all',
                    'text-destructive/80 dark:text-destructive/70',
                    'hover:text-destructive dark:hover:text-destructive/90',
                    'hover:bg-destructive/[0.03] dark:hover:bg-destructive/[0.02]',
                    'backdrop-blur-sm'
                  ),
                })}
              >
                <LogOut className="mr-2 size-4" />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth"
                className={buttonVariants({
                  variant: 'ghost',
                  className: cn(
                    'group relative px-4 py-2 text-base font-medium transition-all',
                    'text-foreground/70 dark:text-foreground/60',
                    'hover:text-foreground dark:hover:text-foreground/90',
                    'hover:bg-foreground/[0.03] dark:hover:bg-foreground/[0.02]',
                    'after:absolute after:inset-x-2 after:-bottom-1 after:h-px',
                    'after:bg-gradient-to-r after:from-primary/0 after:via-primary/50 after:to-primary/0',
                    'after:translate-y-1 after:opacity-0',
                    'hover:after:translate-y-0 hover:after:opacity-100',
                    'after:transition-all after:duration-300'
                  ),
                })}
              >
                Sign In
              </Link>
              <Link
                href="/onboarding"
                className={cn(
                  'group relative',
                  'inline-flex items-center justify-center',
                  'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600',
                  'dark:from-blue-500 dark:via-indigo-500 dark:to-purple-500',
                  'font-semibold text-white',
                  'rounded-full px-8 py-2.5',
                  'transition-all duration-300',
                  'hover:shadow-[0_0_25px_rgba(79,70,229,0.4)] dark:hover:shadow-[0_0_25px_rgba(99,102,241,0.4)]',
                  'hover:scale-[1.02]',
                  'before:absolute before:inset-0',
                  'before:bg-gradient-to-r before:from-indigo-600 before:via-purple-600 before:to-blue-600',
                  'dark:before:from-indigo-500 dark:before:via-purple-500 dark:before:to-blue-500',
                  'before:rounded-full before:transition-[transform,opacity] before:duration-500',
                  'before:opacity-0 before:hover:opacity-100',
                  'before:scale-x-110 before:hover:scale-100',
                  'before:origin-left',
                  'after:absolute after:-inset-px',
                  'after:rounded-[100px] after:bg-gradient-to-r',
                  'after:from-blue-400/40 after:via-indigo-400/40 after:to-purple-400/40',
                  'dark:after:from-blue-300/30 dark:after:via-indigo-300/30 dark:after:to-purple-300/30',
                  'after:transition-all after:duration-500',
                  'after:opacity-20 hover:after:opacity-40',
                  'after:blur-0 hover:after:blur-sm',
                  'overflow-hidden',
                  'border-[0.5px] border-white/20 dark:border-white/10',
                  'backdrop-blur-sm',
                  'isolate'
                )}
              >
                <span className="relative z-10 flex items-center gap-2 transition-transform duration-300 group-hover:translate-x-1">
                  <span className="relative">
                    Sign Up
                    <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-0 transition-opacity delay-100 duration-500 group-hover:opacity-100" />
                  </span>
                  <svg
                    className="size-4 transition-all duration-300 group-hover:translate-x-1 group-hover:scale-110"
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
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.1),transparent_50%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_50%)]" />
                <div className="absolute -left-full top-0 h-full w-[120%] rotate-45 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-all duration-700 ease-out group-hover:left-full" />
              </Link>
            </>
          )}
          <div className="group relative">
            <div className="absolute -inset-1 -z-10 rounded-full bg-gradient-to-r from-primary/20 to-secondary/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-primary/10 dark:to-secondary/10" />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  )
}
