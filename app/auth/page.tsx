import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { readUserSession } from '@/utils/actions'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import AuthForm from './components/AuthForm'

export default async function page() {
  const { data: userSession } = await readUserSession()

  if (userSession.session) {
    return redirect('/account')
  }
  return (
    <div className="isolate flex min-h-screen items-center justify-center bg-background">
      {/* Static background layer */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--foreground))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground))_1px,transparent_1px)] bg-[size:24px_24px] opacity-[0.05]" />
      </div>

      {/* Ambient effects layer */}
      <div className="pointer-events-none fixed inset-0 z-10">
        {/* Gradient overlay */}
        <div className="animate-gradient absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />

        {/* Glow effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="animate-pulse-subtle absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]" />
          <div
            className="animate-pulse-subtle absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/10 blur-[120px]"
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
            <div className="absolute inset-0 bg-background/40 backdrop-blur-xl" />
            <div className="absolute inset-0 bg-gradient-to-br from-background/30 to-background/10" />
            <div className="absolute inset-0 border border-border/50" />
          </div>

          {/* Card content */}
          <div className="relative z-10 p-8">
            {/* Logo section */}
            <div className="mb-6 flex flex-col items-center space-y-2">
              <Link
                href="/"
                className="group relative mb-6 flex items-center space-x-2 overflow-hidden rounded-full"
              >
                <div className="absolute inset-0 bg-background/5 backdrop-blur-sm transition-all duration-300 group-hover:bg-background/10" />
                <div className="relative z-10 flex items-center space-x-2 px-4 py-2">
                  <Image
                    src="/neuvia-comp.jpg"
                    alt="Neuvia Logo"
                    width={24}
                    height={24}
                    className="rounded-full transition-opacity group-hover:opacity-90"
                  />
                  <span className="inline-block font-bold text-foreground transition-colors group-hover:text-primary">
                    {siteConfig.name}
                  </span>
                </div>
              </Link>
              <h1
                className="animate-fade-up text-center text-2xl font-semibold tracking-tight text-foreground"
                style={{ animationDelay: '200ms' }}
              >
                Welcome back!
              </h1>
              <p
                className="animate-fade-up text-center text-sm text-muted-foreground"
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
                <div className="absolute inset-0 rounded-xl bg-card/40" />
                <div className="absolute inset-0 rounded-xl border border-border/50" />
                <div className="absolute inset-0 rounded-xl shadow-[inset_0_1px_1px_rgba(0,0,0,0.1)]" />
              </div>
              <div className="relative z-0 p-6">
                <AuthForm />
              </div>
            </div>

            {/* Terms section */}
            <p
              className="animate-fade-up mt-6 px-6 text-center text-sm text-muted-foreground"
              style={{ animationDelay: '800ms' }}
            >
              By clicking continue, you agree to our{' '}
              <Link
                href="/terms"
                className="text-primary/90 underline underline-offset-4 transition-colors hover:text-primary"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                className="text-primary/90 underline underline-offset-4 transition-colors hover:text-primary"
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
