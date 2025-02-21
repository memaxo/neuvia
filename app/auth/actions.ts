'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/utils/supabase/client'
import type { AuthError, User } from '@supabase/supabase-js'

export type AuthResponse<T = { user: User | null }> = {
  data: T | null
  error: AuthError | null
}

/**
 * Signs up a new user with email and password
 */
export async function signUpWithEmailAndPassword(data: {
  email: string
  password: string
  confirm: string
}): Promise<AuthResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  })

  if (error) {
    return { data: null, error }
  }

  revalidatePath('/', 'layout')
  return { data: authData, error: null }
}

/**
 * Signs in a user with email and password
 */
export async function loginWithEmailAndPassword(data: {
  email: string
  password: string
}): Promise<AuthResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: authData, error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { data: null, error }
  }

  revalidatePath('/', 'layout')
  return { data: authData, error: null }
}

/**
 * Signs in a user with Google OAuth
 */
export async function signInWithGoogle(): Promise<AuthResponse<{ url: string }>> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Signs in a user with GitHub OAuth
 */
export async function signInWithGithub(): Promise<AuthResponse<{ url: string }>> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Signs in a user with Twitter OAuth
 */
export async function signInWithTwitter(): Promise<AuthResponse<{ url: string }>> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'twitter',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Signs out the current user
 */
export async function logout(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/auth')
}

/**
 * Gets the current user session
 */
export async function getUserSession(): Promise<AuthResponse> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getSession()
  return { data, error }
}

/**
 * Gets the current user
 */
export async function getUser(): Promise<AuthResponse> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  return { data, error }
} 