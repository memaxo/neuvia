// content security policy requirements vary from app to app head to https://nextjs.org/docs/pages/building-your-application/configuring/content-security-policy to learn how to configure nonces within middleware and or how to set policies within your next.config file

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { generateNonce, createCSPHeader } from '@/lib/utils/nonce'

export async function middleware(request: NextRequest) {
  try {
    const res = NextResponse.next()
    
    // Create Supabase client with cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            res.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            res.cookies.set({ name, value: '', ...options })
          }
        }
      }
    )

    // Generate nonce for CSP
    const nonce = generateNonce()
    
    // Set CSP header with nonce
    const cspHeader = createCSPHeader(nonce)
    res.headers.set('Content-Security-Policy', cspHeader)
    
    // Set nonce in header for access in components
    res.headers.set('x-nonce', nonce)

    // Handle Supabase session
    await supabase.auth.getSession()

    return res
  } catch (e) {
    console.error('Middleware error:', e)
    return NextResponse.next()
  }
}

// Specify which paths should be processed by middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes
     */
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|.*\\.(?:jpg|jpeg|gif|png|svg|ico)).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
