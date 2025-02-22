import React from 'react'
import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { readUserSession } from '@/utils/actions'
import { siteConfig } from '@/config/site'
import { buttonVariants } from '@/components/ui/button'
import RegisterForm from '@/app/auth-server-action/components/RegisterForm'

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* Enhanced background with multiple layers */}
      <div className="absolute inset-0">
        {/* Grid pattern - theme aware */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--foreground))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground))_1px,transparent_1px)] bg-[size:24px_24px] opacity-5" />

        {/* Gradient overlay - theme aware */}
        <div className="animate-gradient absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />

        {/* Additional ambient glow - theme aware */}
        <div className="absolute inset-0">
          <div className="animate-pulse-subtle absolute left-1/2 top-1/2 size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]" />
          <div
            className="animate-pulse-subtle absolute left-1/2 top-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/10 blur-[120px]"
            style={{ animationDelay: '-2s' }}
          />
        </div>
      </div>

      {/* Enhanced main container */}
      <div className="animate-fade-up relative mx-4 w-full max-w-[420px]">
        {/* Card with enhanced glass effect and depth */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/30 p-8 shadow-lg backdrop-blur-xl transition-all duration-300">
          {/* Inner gradient for depth - theme aware */}
          <div className="absolute inset-0 bg-gradient-to-br from-background/30 to-background/10" />

          {/* Card background with enhanced glass effect */}
          <div className="absolute inset-0 -z-10 bg-background/40" />

          {/* Content */}
          <div className="relative z-10 flex flex-col space-y-6">
            {/* Logo section */}
            <div className="mb-2 flex flex-col items-center space-y-2">
              <Link
                href="/"
                className="group mb-6 flex items-center space-x-2 rounded-full bg-background/5 px-4 py-2 backdrop-blur-sm transition-all duration-300 hover:bg-background/10 hover:shadow-lg hover:shadow-primary/10"
              >
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
              </Link>
              <h1
                className="animate-fade-up text-center text-2xl font-semibold tracking-tight text-foreground"
                style={{ animationDelay: '200ms' }}
              >
                Create your account
              </h1>
              <p
                className="animate-fade-up text-center text-sm text-muted-foreground"
                style={{ animationDelay: '400ms' }}
              >
                Join Neuvia and start your journey
              </p>
            </div>

            {/* Auth form container with enhanced depth */}
            <div
              className="animate-fade-up rounded-xl border border-border/50 bg-card/40 p-6 shadow-[inset_0_1px_1px_rgba(0,0,0,0.1)]"
              style={{ animationDelay: '600ms' }}
            >
              <RegisterForm />
            </div>

            {/* Enhanced terms section */}
            <p
              className="animate-fade-up px-6 text-center text-sm text-muted-foreground"
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

            {/* Sign in link */}
            <div
              className="animate-fade-up text-center text-sm"
              style={{ animationDelay: '1000ms' }}
            >
              <span className="text-muted-foreground">
                Already have an account?
              </span>{' '}
              <Link
                href="/auth"
                className="text-primary/90 underline underline-offset-4 transition-colors hover:text-primary"
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
