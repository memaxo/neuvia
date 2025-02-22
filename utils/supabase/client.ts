'use client'

import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/lib/supabase'

const clientCookies = {
  getAll: () => {
    if (typeof document === 'undefined') return [];
    const cookieStr = document.cookie;
    if (!cookieStr) return [];
    return cookieStr.split('; ').map(cookie => {
      const [name, ...rest] = cookie.split('=');
      return { name, value: rest.join('='), options: {} };
    });
  },
  setAll: (cookies) => {
    if (typeof document === 'undefined') return;
    cookies.forEach(({ name, value, options }) => {
      let cookieStr = `${name}=${value}`;
      if (options) {
        if (options.path) cookieStr += `; path=${options.path}`;
        if (options.domain) cookieStr += `; domain=${options.domain}`;
        if (options.expires) {
          const expires = options.expires instanceof Date ? options.expires.toUTCString() : options.expires;
          cookieStr += `; expires=${expires}`;
        }
        if (options.secure) cookieStr += '; secure';
        if (options.sameSite) cookieStr += `; samesite=${options.sameSite}`;
      }
      document.cookie = cookieStr;
    });
  }
};

let supabase: ReturnType<typeof createBrowserClient<Database>>

export function createClient() {
  if (!supabase) {
    supabase = createBrowserClient<Database>(
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
    )
  }
  return supabase
} 