import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'

import { buttonVariants } from '@/components/ui/button'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'
import { readUserSession } from '@/utils/actions'

import { AuthForm } from './components/AuthForm'

export default async function page() {
  const { data: userSession } = await readUserSession()

  if (userSession.session) {
    return redirect('/account')
  }
  return (
    <div className="bg-background isolate flex min-h-screen items-center justify-center">
      {/* Static background layer */}
      <div className="fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              'linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* Ambient effects layer */}
      <div className="pointer-events-none fixed inset-0 z-10">
        {/* Gradient overlay */}
        <div className="animate-gradient from-primary/5 to-secondary/5 absolute inset-0 bg-gradient-to-br via-transparent" />

        {/* Glow effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="animate-pulse-subtle bg-primary/20 absolute left-1/2 top-1/2 size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]" />
          <div
            className="animate-pulse-subtle bg-secondary/10 absolute left-1/2 top-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
            style={{ animationDelay: '-2s' }}
          />
        </div>
      </div>

      {/* Content layer */}
      <div className="animate-fade-up relative z-20 mx-4 w-full max-w-[420px]">
        {/* Auth card */}
        <div className="relative isolate overflow-hidden rounded-2xl">
          {/* Card glass effect - separate stacking context */}
          <div className="absolute inset-0 z-0">
            <div className="bg-background/40 absolute inset-0 backdrop-blur-xl" />
            <div className="from-background/30 to-background/10 absolute inset-0 bg-gradient-to-br" />
            <div className="border-border/50 absolute inset-0 border" />
          </div>

          {/* Card content */}
          <div className="relative z-10 p-8">
            {/* Logo section */}
            <div className="mb-6 flex flex-col items-center space-y-2">
              <Link
                className="group relative mb-6 flex items-center space-x-2 overflow-hidden rounded-full"
                href="/"
              >
                <div className="bg-background/5 group-hover:bg-background/10 absolute inset-0 backdrop-blur-sm transition-all duration-300" />
                <div className="relative z-10 flex items-center space-x-2 px-4 py-2">
                  <Image
                    alt="Neuvia Logo"
                    className="rounded-full transition-opacity group-hover:opacity-90"
                    height={24}
                    src="/neuvia-comp.jpg"
                    width={24}
                  />
                  <span className="text-foreground group-hover:text-primary inline-block font-bold transition-colors">
                    {siteConfig.name}
                  </span>
                </div>
              </Link>
              <h1
                className="animate-fade-up text-foreground text-center text-2xl font-semibold tracking-tight"
                style={{ animationDelay: '200ms' }}
              >
                Welcome back!
              </h1>
              <p
                className="animate-fade-up text-muted-foreground text-center text-sm"
                style={{ animationDelay: '400ms' }}
              >
                Login to your Neuvia account
              </p>
            </div>

            {/* Form section - isolated stacking context */}
            <div
              className="animate-fade-up relative isolate"
              style={{ animationDelay: '600ms' }}
            >
              <div className="absolute inset-0 -z-10">
                <div className="bg-card/40 absolute inset-0 rounded-xl" />
                <div className="border-border/50 absolute inset-0 rounded-xl border" />
                <div className="absolute inset-0 rounded-xl shadow-[inset_0_1px_1px_rgba(0,0,0,0.1)]" />
              </div>
              <div className="relative z-0 p-6">
                <AuthForm />
              </div>
            </div>

            {/* Terms section */}
            <p
              className="animate-fade-up text-muted-foreground mt-6 px-6 text-center text-sm"
              style={{ animationDelay: '800ms' }}
            >
              By clicking continue, you agree to our{' '}
              <Link
                className="text-primary/90 hover:text-primary underline underline-offset-4 transition-colors"
                href="/terms"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                className="text-primary/90 hover:text-primary underline underline-offset-4 transition-colors"
                href="/privacy"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
