import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/clients'
import { createApiRoute } from '@/lib/api/route-helpers'

/**
 * Auth callback endpoint
 * 
 * The `/auth/callback` route is required for the server-side auth flow implemented
 * by the Auth Helpers package. It exchanges an auth code for the user's session.
 * https://supabase.com/docs/guides/auth/auth-helpers/nextjs#managing-sign-in-with-code-exchange
 */
export const GET = createApiRoute(async (request: Request) => {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(requestUrl.origin)
}, {
  openApiPath: '/sid/callback',
  method: 'get',
  validate: true,
  logMetadata: { endpoint: '/api/sid/callback' }
})