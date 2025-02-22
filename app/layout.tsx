import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import Script from 'next/script'
import { headers } from 'next/headers'
import './globals.css'
import { siteConfig } from '@/config/site'
import { fontSans } from '@/lib/font'
import { cn } from '@/lib/utils'
import { CookieButton } from '@/components/cookie-button'
import { ReactQueryClientProvider } from '@/components/react-query-client-provider'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { TailwindIndicator as _ } from '@/components/tailwind-indicator'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })
const _inter = inter

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  manifest: 'https://neuvia.vercel.app/manifest.json',
  metadataBase: new URL('https://neuvia.vercel.app'),
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/en-US',
      'de-DE': '/de-DE',
      'es-ES': '/es-ES',
      'fr-FR': '/fr-FR',
      'jp-JP': '/jp-JP',
      'ko-KO': '/ko-KP',
      'zh-ZH': '/zh-ZH',
      'pt-PT': '/pt-PT',
    },
  },
  referrer: 'origin-when-cross-origin',
  keywords: [
    'NextJS 15 TypeScript',
    'Supabase SSR',
    'TanStack React Query',
    'vercel',
    'openai',
    'MVP Template',
    'Neuvia SaaS PWA template',
    'Zod',
    'Shadcn-UI',
    'Tailwind CSS',
    'SaaS',
    'NextJS Supabase Postgres Tailwind TanStack',
    'NextJS CSP',
    'PWA',
    'NextJS SaaS PWA Template',
    'CRUD ops',
    'secure headers',
    'NextJS templates with user authentication, RBAC, and CRUD ops',
    'NextJS templates with data validation and database integration',
    'Rust API runtime for vercel serverless functions',
    'NextJS secure headers',
    'NextJS NextMDX',
  ],
  authors: [{ name: 'Robert Mourey Jr' }],
  creator: 'Robert Mourey Jr',
  publisher: 'Robert Mourey Jr',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  generator: 'NextJS',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },

  robots: {
    index: false,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: false,
      noimageindex: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    url: 'https://neuvia.vercel.app',
    images: [
      {
        url: 'https://neuvia.vercel.app/og-image.jpg',
        width: 1230,
        height: 640,
      },
      {
        url: 'https://quantumone.b-cdn.net/neuvia/opengraph-image.jpg',
        width: 1800,
        height: 1600,
        alt: 'blockchain business',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    title: siteConfig.name,
    description: siteConfig.description,
    site: '@r_mourey_jr',
    creator: '@r_mourey_jr',
    images: [
      {
        url: 'https://neuvia.vercel.app/twitter-image.jpg',
        width: 1800,
        height: 900,
      },
      {
        url: 'https://quantumone.b-cdn.net/neuvia/twitter-image.jpg',
        width: 1800,
        height: 900,
      },
    ],
  },
}
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}
interface RootLayoutProps {
  children: React.ReactNode
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const headersList = await headers()
  const nonce = headersList.get('x-nonce') ?? ''

  return (
    <ReactQueryClientProvider>
      <html lang="en" suppressHydrationWarning>
        <head />
        <body
          className={cn(
            'min-h-screen bg-background font-sans antialiased',
            fontSans.variable
          )}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="relative flex min-h-screen flex-col">
              <SiteHeader />
              <div className="flex-1">
                {children}
                <Toaster />
                <Analytics />
                <SpeedInsights />
              </div>
            </div>
            <SiteFooter />
            <CookieButton />
          </ThemeProvider>
        </body>
      </html>
    </ReactQueryClientProvider>
  )
}
