'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/utils/supabase'
import type { AuthError, User } from '@supabase/supabase-js'
import { z } from 'zod'

// Validation schemas
const emailSchema = z.string().email('Please enter a valid email address')
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters')

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
  try {
    // Validate input
    const email = emailSchema.parse(data.email)
    const password = passwordSchema.parse(data.password)
    
    if (data.password !== data.confirm) {
      return { 
        data: null, 
        error: { 
          message: 'Passwords do not match',
          status: 400
        } as AuthError 
      }
    }

    const supabase = await createServerClient()
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      return { data: null, error }
    }

    revalidatePath('/', 'layout')
    return { data: authData, error: null }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          message: error.errors[0].message,
          status: 400
        } as AuthError
      }
    }
    return {
      data: null,
      error: {
        message: 'An unexpected error occurred',
        status: 500
      } as AuthError
    }
  }
}

/**
 * Signs in a user with email and password
 */
export async function loginWithEmailAndPassword(data: {
  email: string
  password: string
}): Promise<AuthResponse> {
  try {
    // Validate input
    const email = emailSchema.parse(data.email)
    const password = passwordSchema.parse(data.password)

    const supabase = await createServerClient()
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { data: null, error }
    }

    revalidatePath('/', 'layout')
    return { data: authData, error: null }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          message: error.errors[0].message,
          status: 400
        } as AuthError
      }
    }
    return {
      data: null,
      error: {
        message: 'An unexpected error occurred',
        status: 500
      } as AuthError
    }
  }
}

/**
 * Signs in a user with Google OAuth
 */
export async function signInWithGoogle(): Promise<AuthResponse<{ url: string }>> {
  const supabase = await createServerClient()
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
  const supabase = await createServerClient()
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
  const supabase = await createServerClient()
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
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/auth')
}

/**
 * Gets the current user session
 * Note: Prefer getUser() for server-side auth checks
 */
export async function getUserSession(): Promise<AuthResponse> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.getSession()
  return { data, error }
}

/**
 * Gets the current user
 * This is the preferred method for server-side auth checks
 */
export async function getUser(): Promise<AuthResponse> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.getUser()
  return { data, error }
}
