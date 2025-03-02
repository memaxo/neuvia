// content security policy requirements vary from app to app head to https://nextjs.org/docs/pages/building-your-application/configuring/content-security-policy to learn how to configure nonces within middleware and or how to set policies within your next.config file

import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'

import { createCSPHeader, generateNonce } from '@/lib/utils/nonce'

export async function middleware(request: NextRequest) {
  try {
    const response = NextResponse.next()

    // Generate request ID for tracing
    const requestId = request.headers.get('x-request-id') || randomUUID()
    response.headers.set('x-request-id', requestId)
    
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
          },
        },
      }
    )

    // Refresh session if needed and get current user
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    // Handle authentication errors
    if (error) {
      // Use structured error metadata for logging
      const errorMetadata = {
        requestId,
        url: request.url,
        method: request.method,
        errorMessage: error.message,
        statusCode: error.status || 500
      }
      
      // Log with structured data instead of console.error
      if (process.env.NODE_ENV === 'development') {
        console.error('[Auth Middleware Error]', errorMetadata)
      } else {
        // In production, use structured JSON for log aggregation
        console.log(JSON.stringify({
          level: 'error',
          message: 'Auth error in middleware',
          timestamp: new Date().toISOString(),
          metadata: errorMetadata,
          error: { 
            name: error.name,
            message: error.message
          }
        }))
      }
      
      // Clear any invalid session cookies
      response.cookies.delete('sb-access-token')
      response.cookies.delete('sb-refresh-token')
    }

    // Add context to request headers
    if (user) {
      response.headers.set('x-user-id', user.id)
      response.headers.set('x-user-role', user.role || 'authenticated')
    }
    
    // Add timing header for performance monitoring
    response.headers.set('server-timing', `middleware;dur=${Date.now() - performance.now()}`)

    return response
  } catch (error) {
    const requestId = request.headers.get('x-request-id') || randomUUID()
    
    // Use structured error data
    const errorMetadata = {
      requestId,
      url: request.url,
      method: request.method,
      errorType: error instanceof Error ? error.name : 'UnknownError'
    }
    
    // Structured logging
    if (process.env.NODE_ENV === 'development') {
      console.error('[Middleware Critical Error]', errorMetadata, error)
    } else {
      console.log(JSON.stringify({
        level: 'fatal',
        message: 'Critical middleware failure',
        timestamp: new Date().toISOString(),
        metadata: errorMetadata,
        error: error instanceof Error ? { 
          name: error.name,
          message: error.message,
          stack: error.stack 
        } : String(error)
      }))
    }
    
    // Return basic response without auth in case of errors
    const response = NextResponse.next()
    const nonce = generateNonce()
    response.headers.set('Content-Security-Policy', createCSPHeader(nonce))
    response.headers.set('x-nonce', nonce)
    response.headers.set('x-request-id', requestId)
    
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
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|.*\\.(?:jpg|jpeg|gif|png|svg|ico)).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
