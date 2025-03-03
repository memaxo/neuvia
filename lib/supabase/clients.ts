import {
  createBrowserClient as createBrowserSupabaseClient,
  createServerClient as createServerSupabaseClient,
} from '@supabase/ssr'
import { createClient as createAdminSupabaseClient } from '@supabase/supabase-js'
import type { RealtimeChannel, RealtimePostgresChangesPayload, RealtimeChannelSnapshot } from '@supabase/supabase-js'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'
import { cookies } from 'next/headers'

import type { Database } from '@/lib/supabase'

// Singleton instances
let browserClient:
  | ReturnType<typeof createBrowserSupabaseClient<Database>>
  | undefined
let adminClient:
  | ReturnType<typeof createAdminSupabaseClient<Database>>
  | undefined

// Channels tracker to help manage active subscriptions
interface ActiveChannels {
  [key: string]: RealtimeChannel
}
const activeChannels: ActiveChannels = {}

// Cookie configuration following Supabase best practices
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 3600, // 1 hour max-age as recommended
}

interface CookieData {
  name: string
  value: string
  options?: Partial<ResponseCookie>
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
        setAll: (cookies: CookieData[]) => {
          cookies.forEach(({ name, value, options }) => {
            try {
              cookieStore.set({ name, value, ...COOKIE_OPTIONS, ...options })
            } catch (error) {
              // Log errors only in development
              if (process.env.NODE_ENV === 'development') {
                // eslint-disable-next-line no-console
                console.error(`Cookie set error for ${name}:`, error)
              }
            }
          })
        },
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
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
        setAll: () => {}, // Read-only client doesn't need to set cookies
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  )
}

/**
 * Gets or creates a Supabase client for browser-side operations
 */
export function createBrowserClient() {
  if (browserClient) {
    return browserClient
  }

  // Define cookie functions for client-side
  const clientCookies = {
    getAll: () => {
      if (typeof document === 'undefined') return []
      const cookieStr = document.cookie
      if (!cookieStr) return []
      return cookieStr.split('; ').map((pair) => {
        const [name, ...rest] = pair.split('=')
        return { name, value: rest.join('='), options: {} }
      })
    },
    setAll: (cookiesArray: CookieData[]) => {
      if (typeof document === 'undefined') return
      cookiesArray.forEach(({ name, value, options }) => {
        let cookieStr = `${name}=${value}`
        if (typeof options !== 'undefined') {
          if (typeof options.path === 'string')
            cookieStr += `; path=${options.path}`
          if (typeof options.domain === 'string')
            cookieStr += `; domain=${options.domain}`
          if (options.expires instanceof Date) {
            cookieStr += `; expires=${options.expires.toUTCString()}`
          }
          if (options.secure === true) cookieStr += '; secure'
          if (typeof options.sameSite === 'string')
            cookieStr += `; samesite=${options.sameSite}`
        }
        document.cookie = cookieStr
      })
    },
  }

  browserClient = createBrowserSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      cookies: clientCookies,
      realtime: {
        params: {
          // Make sure we get the latest server data
          eventsPerSecond: 10
        }
      }
    }
  )

  return browserClient
}

/**
 * Creates a Supabase admin client with service role access
 * Note: This should only be used in trusted server environments
 */
export function createAdminClient() {
  if (typeof process.env.SUPABASE_SERVICE_ROLE_KEY !== 'string') {
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
        persistSession: false,
      },
    }
  )

  return adminClient
}

// Type helper for Supabase real-time subscriptions
export type SubscriptionHandler<T = any> = (payload: RealtimePostgresChangesPayload<T>) => void
export type SubscriptionStatusHandler = (status: RealtimeChannelSnapshot<string, string>) => void

/**
 * Subscribes to changes on a specific table and row
 * 
 * @param table The table to subscribe to
 * @param id The row ID to filter on
 * @param events The events to listen for (default: UPDATE)
 * @param handler The handler function for changes
 * @param statusHandler Optional handler for subscription status changes
 * @returns The channel object for unsubscribing
 */
export function subscribeToRow<T = any>(
  table: string,
  id: string,
  events: ('INSERT' | 'UPDATE' | 'DELETE')[] = ['UPDATE'],
  handler: SubscriptionHandler<T>,
  statusHandler?: SubscriptionStatusHandler
): RealtimeChannel {
  const supabase = createBrowserClient()
  const channelKey = `${table}:${id}`
  
  // Reuse existing channel if possible
  if (activeChannels[channelKey]) {
    return activeChannels[channelKey]
  }
  
  // Create a channel for this subscription
  const channel = supabase
    .channel(channelKey)
    
  // Add listeners for each event type
  events.forEach(event => {
    channel.on(
      'postgres_changes',
      {
        event: event,
        schema: 'public',
        table: table,
        filter: `id=eq.${id}`
      },
      handler
    )
  })
  
  // Subscribe and handle status
  const subscription = channel.subscribe(status => {
    if (statusHandler) {
      statusHandler(status)
    }
  })
  
  // Store the channel for cleanup
  activeChannels[channelKey] = subscription
  
  return subscription
}

/**
 * Unsubscribes from a real-time channel
 * 
 * @param channelName The name of the channel to unsubscribe from
 * @returns True if successfully unsubscribed, false otherwise
 */
export function unsubscribe(channelName: string): boolean {
  const supabase = createBrowserClient()
  
  if (activeChannels[channelName]) {
    supabase.removeChannel(activeChannels[channelName])
    delete activeChannels[channelName]
    return true
  }
  
  return false
}

/**
 * Subscribes to workflow state changes
 * 
 * @param workflowId The workflow ID to subscribe to
 * @param handler The handler function for changes
 * @param statusHandler Optional handler for subscription status
 * @returns The channel object for unsubscribing
 */
export function subscribeToWorkflow<T = any>(
  workflowId: string,
  handler: SubscriptionHandler<T>,
  statusHandler?: SubscriptionStatusHandler
): RealtimeChannel {
  return subscribeToRow<T>(
    'workflow_states',
    workflowId,
    ['UPDATE'],
    handler,
    statusHandler
  )
}

// Export auth admin client for convenience
export const adminAuthClient = createAdminClient().auth
