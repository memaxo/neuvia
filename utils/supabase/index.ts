import { cookies } from 'next/headers'
import { createServerClient as createServerSupabaseClient, createBrowserClient as createBrowserSupabaseClient } from '@supabase/ssr'
import { createClient as createAdminSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'

// Singleton instances
let browserClient: ReturnType<typeof createBrowserSupabaseClient<Database>> | undefined
let adminClient: ReturnType<typeof createAdminSupabaseClient<Database>> | undefined

// Cookie configuration following Supabase best practices
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 3600 // 1 hour max-age as recommended
}

/**
 * Creates a Supabase client for server-side operations with full read/write capabilities
 */
export async function createServerClient() {
  const cookieStore = await cookies()

  return createServerSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, { ...COOKIE_OPTIONS, ...options })
            } catch (error) {
              console.error(`Cookie set error for ${name}:`, error)
              if (process.env.NODE_ENV === 'development') {
                console.warn(`Cookie operation failed for ${name}. Check server logs.`)
              }
            }
          })
        }
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }
  )
}

/**
 * Creates a Supabase client for server-side operations with read-only capabilities
 */
export async function createReadOnlyClient() {
  const cookieStore = await cookies()

  return createServerSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {} // Read-only client doesn't need to set cookies
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }
  )
}

/**
 * Gets or creates a Supabase client for browser-side operations
 */
export function createBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  // Define cookie functions for client-side
  const clientCookies = {
    getAll: () => {
      if (typeof document === 'undefined') return [];
      const cookieStr = document.cookie;
      if (!cookieStr) return [];
      return cookieStr.split('; ').map(pair => {
        const [name, ...rest] = pair.split('=');
        return { name, value: rest.join('='), options: {} };
      });
    },
    setAll: (cookiesArray) => {
      if (typeof document === 'undefined') return;
      cookiesArray.forEach(({ name, value, options }) => {
        let cookieStr = `${name}=${value}`;
        if (options) {
          if (options.path) cookieStr += `; path=${options.path}`;
          if (options.domain) cookieStr += `; domain=${options.domain}`;
          if (options.expires) {
            const exp = options.expires instanceof Date ? options.expires.toUTCString() : options.expires;
            cookieStr += `; expires=${exp}`;
          }
          if (options.secure) cookieStr += '; secure';
          if (options.sameSite) cookieStr += `; samesite=${options.sameSite}`;
        }
        document.cookie = cookieStr;
      });
    }
  };

  browserClient = createBrowserSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      cookies: clientCookies
    }
  );

  return browserClient;
}

/**
 * Creates a Supabase admin client with service role access
 * Note: This should only be used in trusted server environments
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin client')
  }

  if (adminClient) {
    return adminClient
  }

  adminClient = createAdminSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  return adminClient
}

// Export auth admin client for convenience
export const adminAuthClient = createAdminClient().auth 