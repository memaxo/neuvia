import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'

import { AuthForm } from '@/app/auth/components/AuthForm'
import { buttonVariants } from '@/components/ui/button'
import { siteConfig } from '@/config/site'
import { readUserSession } from '@/utils/actions'

export const metadata: Metadata = {
  title: 'Onboarding',
  description: 'Onyx new customer onboarding',
}

export default async function OnboardingPage() {
  const { data: userSession } = await readUserSession()

  if (userSession.session) {
    return redirect('/account')
  }

  return (
    <div className="bg-background relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Enhanced background with multiple layers */}
      <div className="absolute inset-0">
        {/* Grid pattern - theme aware */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              'linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Gradient overlay - theme aware */}
        <div className="animate-gradient from-primary/5 to-secondary/5 absolute inset-0 bg-gradient-to-br via-transparent" />

        {/* Additional ambient glow - theme aware */}
        <div className="absolute inset-0">
          <div className="animate-pulse-subtle bg-primary/20 absolute left-1/2 top-1/2 size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]" />
          <div
            className="animate-pulse-subtle bg-secondary/10 absolute left-1/2 top-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
            style={{ animationDelay: '-2s' }}
          />
        </div>
      </div>

      {/* Enhanced main container */}
      <div className="animate-fade-up relative mx-4 w-full max-w-[420px]">
        {/* Card with enhanced glass effect and depth */}
        <div className="border-border/50 bg-card/30 relative overflow-hidden rounded-2xl border p-8 shadow-lg backdrop-blur-xl transition-all duration-300">
          {/* Inner gradient for depth - theme aware */}
          <div className="from-background/30 to-background/10 absolute inset-0 bg-gradient-to-br" />

          {/* Card background with enhanced glass effect */}
          <div className="bg-background/40 absolute inset-0 -z-10" />

          {/* Content */}
          <div className="relative z-10 flex flex-col space-y-6">
            {/* Logo section */}
            <div className="mb-2 flex flex-col items-center space-y-2">
              <Link
                className="bg-background/5 hover:bg-background/10 hover:shadow-primary/10 group mb-6 flex items-center space-x-2 rounded-full px-4 py-2 backdrop-blur-sm transition-all duration-300 hover:shadow-lg"
                href="/"
              >
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
              </Link>
              <h1
                className="animate-fade-up text-foreground text-center text-2xl font-semibold tracking-tight"
                style={{ animationDelay: '200ms' }}
              >
                Create your account
              </h1>
              <p
                className="animate-fade-up text-muted-foreground text-center text-sm"
                style={{ animationDelay: '400ms' }}
              >
                Join Neuvia and start your journey
              </p>
            </div>

            {/* Auth form container with enhanced depth */}
            <div
              className="animate-fade-up border-border/50 bg-card/40 rounded-xl border p-6 shadow-[inset_0_1px_1px_rgba(0,0,0,0.1)]"
              style={{ animationDelay: '600ms' }}
            >
              <AuthForm />
            </div>

            {/* Enhanced terms section */}
            <p
              className="animate-fade-up text-muted-foreground px-6 text-center text-sm"
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

            {/* Sign in link */}
            <div
              className="animate-fade-up text-center text-sm"
              style={{ animationDelay: '1000ms' }}
            >
              <span className="text-muted-foreground">
                Already have an account?
              </span>{' '}
              <Link
                className="text-primary/90 hover:text-primary underline underline-offset-4 transition-colors"
                href="/auth"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
