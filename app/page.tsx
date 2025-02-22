import { CheckCircle, Shield } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import BackgroundSpline from '@/components/background-spline'
import Features from '@/components/features'
import { SecurityBadge } from '@/components/security-badge'
import { TechnicalText } from '@/components/technical-text'
import { buttonVariants } from '@/components/ui/button'
import { siteConfig } from '@/config/site'
import { readUserSession } from '@/utils/actions'

export default async function IndexPage() {
  const { data: userSession } = await readUserSession()

  if (userSession.session) {
    return redirect('/dashboard')
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Background with integrated loading/error states */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/90 to-black/40">
        <BackgroundSpline />
      </div>

      {/* Semi-transparent overlay - adjusted z-index and opacity for better visual hierarchy */}
      <div className="absolute inset-0 z-[1] bg-black/30 backdrop-blur-[2px]"></div>

      {/* Content */}
      <div className="container relative z-10 mx-auto flex grow flex-col px-4 md:px-6">
        <div className="flex min-h-[80vh] flex-col items-center justify-center py-4">
          <div className="mx-auto max-w-4xl space-y-10 text-center">
            {/* Enhanced heading with better contrast and stronger weight */}
            <h1 className="animate-fade-in font-sans text-6xl font-extrabold leading-tight tracking-tight text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)] sm:text-7xl md:text-8xl">
              Augment Your Clinical Judgment with{' '}
              <TechnicalText
                animate
                className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text font-black text-transparent"
                variant="highlight"
              >
                AI-Powered Intelligence
              </TechnicalText>
            </h1>

            {/* Improved subheading readability */}
            <p className="animate-slide-up mx-auto max-w-3xl py-2 text-lg font-medium leading-relaxed tracking-wide text-white backdrop-blur-sm sm:text-xl md:text-2xl">
              Reduce chart review time by{' '}
              <TechnicalText
                className="font-bold text-cyan-300"
                variant="technical"
              >
                60%
              </TechnicalText>{' '}
              while improving clinical accuracy. Our advanced LLM technology
              delivers evidence-based insights in seconds.
            </p>

            {/* Enhanced CTA section */}
            <div
              className="animate-fade-in flex flex-col items-center gap-10 pt-8"
              style={{ animationDelay: '0.2s' }}
            >
              <Link
                className={buttonVariants({
                  className:
                    'group relative transform overflow-hidden rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 px-10 py-7 text-xl font-bold text-white shadow-[0_0_30px_rgba(0,255,255,0.3)] transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 hover:shadow-[0_0_40px_rgba(0,255,255,0.5)]',
                })}
                href={siteConfig.links.signup as Route}
              >
                <span className="relative z-10 flex items-center">
                  Watch Clinical Demo
                  <span className="ml-2 transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </span>
                {/* Enhanced scanning line effect */}
                <span className="absolute inset-0 overflow-hidden">
                  <span className="group-hover:animate-scan absolute -left-full top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
                </span>
              </Link>

              {/* Enhanced security badges section */}
              <div className="space-y-6 rounded-2xl bg-black/20 px-6 py-4 backdrop-blur-sm">
                <p className="max-w-md text-center text-base font-medium tracking-wide text-white/90">
                  <TechnicalText variant="mono">
                    Trusted by 150+ Academic Medical Centers
                  </TechnicalText>
                </p>
                <div className="flex items-center justify-center gap-8">
                  <SecurityBadge
                    icon={<Shield className="size-5 text-cyan-400" />}
                    label="SOC 2 Type II"
                  />
                  <SecurityBadge
                    icon={<Shield className="size-5 text-cyan-400" />}
                    label="HIPAA Compliant"
                  />
                  <SecurityBadge
                    icon={<CheckCircle className="size-5 text-cyan-400" />}
                    label="FDA-Cleared"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced separator */}
        <div className="my-16 h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent md:my-20"></div>

        {/* Features section with improved spacing */}
        <div className="pb-16">
          <Features />
        </div>
      </div>
    </div>
  )
}
