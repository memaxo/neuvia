'use client'

import throttle from 'lodash.throttle'
import { LogOut } from 'lucide-react'
import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'

import { toast } from '@/components/ui/use-toast'
import { siteConfig } from '@/config/site'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

import { ThemeToggle } from './theme-toggle'

interface NavContainerProps {
  children: React.ReactNode
  isScrolled: boolean
}

const NavContainer = ({ children, isScrolled }: NavContainerProps) => (
  <div
    className={cn(
      'fixed inset-x-0 top-0 z-50 px-4 py-3 transition-all duration-normal',
      isScrolled &&
        'border-b border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-95)] shadow-lg backdrop-blur-xl'
    )}
  >
    <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
      {children}
    </div>
  </div>
)

interface LogoSectionProps {
  isScrolled: boolean
  isLoaded: boolean
}

const LogoSection = ({ isScrolled, isLoaded }: LogoSectionProps) => (
  <div
    className={cn(
      'flex gap-4 rounded-xl border border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] px-4 py-2 backdrop-blur-sm transition-all duration-normal md:gap-8',
      isScrolled ? 'shadow-sm' : 'shadow-lg',
      isLoaded && 'animate-fade-in'
    )}
  >
    <Link className="group flex items-center space-x-2" href={'/' as Route}>
      <div className="relative overflow-hidden rounded-full">
        <Image
          alt="Neuvia Logo"
          className={cn(
            'rounded-full transition-all duration-normal',
            'group-hover:scale-110',
            isLoaded && 'animate-scale-in'
          )}
          height={28}
          src="/neuvia-comp.jpg"
          width={28}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[rgb(var(--primary))/var(--opacity-20)] to-[rgb(var(--secondary))/var(--opacity-20)] opacity-0 transition-opacity duration-normal group-hover:opacity-100" />
      </div>
      <span
        className={cn(
          'inline-block font-bold transition-all duration-normal',
          'text-[rgb(var(--foreground))] group-hover:text-[rgb(var(--primary))]',
          isLoaded && 'animate-fade-in-right'
        )}
      >
        {siteConfig.name}
      </span>
    </Link>
  </div>
)

interface RightSectionProps {
  isScrolled: boolean
  isLoaded: boolean
  isAuthenticated: boolean
  onLogout: () => void
}

const RightSection = ({
  isScrolled,
  isLoaded,
  isAuthenticated,
  onLogout,
}: RightSectionProps) => (
  <div
    className={cn(
      'flex items-center gap-4 rounded-xl border border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] px-4 py-2 backdrop-blur-sm transition-all duration-normal',
      isScrolled ? 'shadow-sm' : 'shadow-lg',
      isLoaded && 'animate-fade-in'
    )}
  >
    {isAuthenticated ? (
      <>
        <Link
          className={cn(
            'group relative rounded-md px-4 py-2 text-base font-medium transition-all',
            'text-[rgb(var(--foreground))/var(--opacity-70)] hover:text-[rgb(var(--foreground))]',
            'hover:bg-[rgb(var(--background))/var(--opacity-60)]'
          )}
          href={'/dashboard' as Route}
        >
          <span className="inline-block">Dashboard</span>
          <span className="absolute inset-x-0 -bottom-1 h-px bg-gradient-to-r from-[rgb(var(--primary))/var(--opacity-0)] via-[rgb(var(--primary))/var(--opacity-50)] to-[rgb(var(--primary))/var(--opacity-0)] opacity-0 transition-all duration-normal group-hover:opacity-100" />
        </Link>
        <button
          className={cn(
            'inline-flex items-center rounded-full px-4 py-2 backdrop-blur-sm',
            'text-[rgb(var(--destructive))/var(--opacity-80)] hover:bg-[rgb(var(--destructive))/var(--opacity-10)] hover:text-[rgb(var(--destructive))]'
          )}
          onClick={onLogout}
          type="button"
        >
          <LogOut className="mr-2 size-4" />
          Logout
        </button>
      </>
    ) : (
      <>
        <Link
          className={cn(
            'group relative rounded-md px-4 py-2 text-base font-medium transition-all',
            'text-[rgb(var(--foreground))/var(--opacity-70)] hover:text-[rgb(var(--foreground))]',
            'hover:bg-[rgb(var(--background))/var(--opacity-60)]'
          )}
          href={'/auth' as Route}
        >
          <span className="inline-block">Sign In</span>
          <span className="absolute inset-x-2 -bottom-1 h-px translate-y-1 bg-gradient-to-r from-[rgb(var(--primary))/var(--opacity-0)] via-[rgb(var(--primary))/var(--opacity-50)] to-[rgb(var(--primary))/var(--opacity-0)] opacity-0 transition-all duration-normal group-hover:translate-y-0 group-hover:opacity-100" />
        </Link>
        <Link
          className={cn(
            'group relative isolate inline-flex items-center justify-center overflow-hidden rounded-full border border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--primary))] px-8 py-2.5 font-semibold text-white backdrop-blur-sm transition-all duration-normal hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(var(--primary),0.3)]'
          )}
          href={'/onboarding' as Route}
        >
          <span className="relative inline-block">
            <span className="inline-block">Sign Up</span>
            <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-0 transition-all duration-normal group-hover:opacity-100" />
          </span>
          <svg
            className="size-4 transition-all duration-normal group-hover:translate-x-1 group-hover:scale-110"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              className="group-hover:stroke-[2.5]"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(var(--primary),0.1),transparent_50%)] opacity-0 transition-opacity duration-normal group-hover:opacity-100" />
          <div className="absolute -left-full top-0 h-full w-[120%] rotate-45 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-all duration-normal ease-out group-hover:left-full" />
        </Link>
      </>
    )}
    <div className="group relative">
      <div className="absolute -inset-1 -z-10 rounded-full bg-gradient-to-r from-[rgb(var(--primary))/var(--opacity-20)] to-[rgb(var(--secondary))/var(--opacity-20)] opacity-0 transition-opacity duration-normal group-hover:opacity-100" />
      <ThemeToggle />
    </div>
  </div>
)

export function MainNav() {
  const router = useRouter()
  const { session, isLoading, logout } = useAuth()
  const isAuthenticated = !!session
  const [isScrolled, setIsScrolled] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setIsLoaded(true)
    }
  }, [isLoading])

  useEffect(() => {
    const throttledScroll = throttle(() => {
      setIsScrolled(window.scrollY > 10)
    }, 200)
    window.addEventListener('scroll', throttledScroll)
    throttledScroll()
    return () => {
      window.removeEventListener('scroll', throttledScroll)
    }
  }, [])

  const handleLogout = useCallback(() => {
    void (async () => {
      try {
        await logout()
        router.refresh()
      } catch (_error) {
        toast({
          title: 'Error signing out',
          description: 'Please try again',
          variant: 'destructive',
        })
      }
    })()
  }, [logout, router])

  if (!isLoaded) {
    return (
      <NavContainer isScrolled={isScrolled}>
        <LogoSection isLoaded={isLoaded} isScrolled={isScrolled} />
        <div
          className={cn(
            'flex items-center gap-4 rounded-xl px-4 py-2',
            'bg-[rgb(var(--background))/var(--opacity-40)]',
            'backdrop-blur-sm',
            'border border-[rgb(var(--border))/var(--opacity-10)]',
            isScrolled ? 'shadow-sm' : 'shadow-lg'
          )}
        >
          <div className="group relative">
            <div className="absolute -inset-1 -z-10 rounded-full bg-gradient-to-r from-[rgb(var(--primary))/var(--opacity-20)] to-[rgb(var(--secondary))/var(--opacity-20)] opacity-0 transition-opacity duration-normal group-hover:opacity-100" />
            <ThemeToggle />
          </div>
        </div>
      </NavContainer>
    )
  }

  return (
    <NavContainer isScrolled={isScrolled}>
      <LogoSection isLoaded={isLoaded} isScrolled={isScrolled} />
      <RightSection
        isAuthenticated={isAuthenticated}
        isLoaded={isLoaded}
        isScrolled={isScrolled}
        onLogout={handleLogout}
      />
    </NavContainer>
  )
}
