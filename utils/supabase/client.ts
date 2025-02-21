import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createBrowserClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'

// Singleton instance for browser client
let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined

/**
 * Creates a Supabase client for server-side operations with full read/write capabilities
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (err) {
            // Handle cookie error silently
            console.error('Cookie set error:', err)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (err) {
            // Handle cookie error silently
            console.error('Cookie remove error:', err)
          }
        },
      },
    }
  )
}

/**
 * Creates a Supabase client for server-side operations with read-only capabilities
 */
export async function createReadOnlyServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

/**
 * Gets or creates a Supabase client for browser-side operations
 */
export function getBrowserSupabaseClient() {
  if (browserClient) {
    return browserClient
  }

  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return browserClient
}

/**
 * Creates a Supabase admin client with service role access
 */
export function createSupabaseAdminClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
} 