// content security policy requirements vary from app to app head to https://nextjs.org/docs/pages/building-your-application/configuring/content-security-policy to learn how to configure nonces within middleware and or how to set policies within your next.config file

import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { generateNonce, createCSPHeader } from '@/lib/utils/nonce'

export async function middleware(request: NextRequest) {
  try {
    const response = NextResponse.next()

    // Generate nonce with enhanced entropy
    const nonce = generateNonce()
    
    // Update CSP header with Spline requirements
    const cspHeader = createCSPHeader(nonce)
    response.headers.set('Content-Security-Policy', cspHeader)
    response.headers.set('x-nonce', nonce)

    // Create Supabase client for auth
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookies) => {
            cookies.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          }
        }
      }
    )

    // Refresh session if needed and get current user
    const { data: { user }, error } = await supabase.auth.getUser()

    // Handle authentication errors
    if (error) {
      console.error('Auth error in middleware:', error)
      // Clear any invalid session cookies
      response.cookies.delete('sb-access-token')
      response.cookies.delete('sb-refresh-token')
    }

    // Add user context to request headers if authenticated
    if (user) {
      response.headers.set('x-user-id', user.id)
      response.headers.set('x-user-role', user.role || 'authenticated')
    }

    return response
  } catch (e) {
    console.error('Middleware error:', e)
    // Return basic response without auth in case of errors
    const response = NextResponse.next()
    const nonce = generateNonce()
    response.headers.set('Content-Security-Policy', createCSPHeader(nonce))
    response.headers.set('x-nonce', nonce)
    return response
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