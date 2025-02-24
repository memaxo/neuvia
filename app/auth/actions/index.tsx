'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createServerClient } from '@/lib/supabase/clients'

export async function signUpWithEmailAndPassword(data: {
  email: string
  password: string
  confirm: string
}) {
  const supabase = await createServerClient()
  const result = await supabase.auth.signUp(data)
  return JSON.stringify(result)
}

export async function loginWithEmailAndPassword(data: {
  email: string
  password: string
}) {
  const supabase = await createServerClient()
  const result = await supabase.auth.signInWithPassword(data)
  return JSON.stringify(result)
}

export async function signInWithGoogle() {
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
    console.error('Error signing in with Google:', error.message)
    return JSON.stringify({ error })
  }

  if (data.url) {
    redirect(data.url)
  }

  return JSON.stringify(data)
}

export async function signInWithGithub() {
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    console.error('Error signing in with Github:', error.message)
    return JSON.stringify({ error })
  }

  if (data.url) {
    redirect(data.url)
  }

  return JSON.stringify(data)
}

export async function signInWithTwitter() {
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'twitter',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    console.error('Error signing in with Twitter:', error.message)
    return JSON.stringify({ error })
  }

  if (data.url) {
    redirect(data.url)
  }

  return JSON.stringify(data)
}

export async function logout() {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/auth')
}
