'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupbaseServerClient } from '@/utils/supaone'

export async function signUpWithEmailAndPassword(data: {
  email: string
  password: string
  confirm: string
}) {
  const supabase = await createSupbaseServerClient()
  const result = await supabase.auth.signUp(data)
  return JSON.stringify(result)
}

export async function loginWithEmailAndPassword(data: {
  email: string
  password: string
}) {
  const supabase = await createSupbaseServerClient()
  const result = await supabase.auth.signInWithPassword(data)
  return JSON.stringify(result)
}

export async function signInWithGoogle() {
  const supabase = await createSupbaseServerClient()

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

  if (data.url) {
    redirect(data.url)
  }

  if (error) {
    console.error('Error signing in with Google:', error.message)
    return JSON.stringify({ error })
  }

  return JSON.stringify(data)
}

export async function signInWithGithub() {
  const supabase = await createSupbaseServerClient()

  supabase.auth.onAuthStateChange((event, session) => {
    if (session && session.provider_token) {
      window.localStorage.setItem(
        'oauth_provider_token',
        session.provider_token
      )
    }

    if (session && session.provider_refresh_token) {
      window.localStorage.setItem(
        'oauth_provider_refresh_token',
        session.provider_refresh_token
      )
    }

    if (event === 'SIGNED_OUT') {
      window.localStorage.removeItem('oauth_provider_token')
      window.localStorage.removeItem('oauth_provider_refresh_token')
    }
  })
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: '/auth/callback',
    },
  })

  if (data.url) {
    redirect(data.url)
  }
}
export async function signInWithTwitter() {
  const supabase = await createSupbaseServerClient()

  supabase.auth.onAuthStateChange((event, session) => {
    if (session && session.provider_token) {
      window.localStorage.setItem(
        'oauth_provider_token',
        session.provider_token
      )
    }

    if (session && session.provider_refresh_token) {
      window.localStorage.setItem(
        'oauth_provider_refresh_token',
        session.provider_refresh_token
      )
    }

    if (event === 'SIGNED_OUT') {
      window.localStorage.removeItem('oauth_provider_token')
      window.localStorage.removeItem('oauth_provider_refresh_token')
    }
  })
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'twitter',
    options: {
      redirectTo: '/auth/callback',
    },
  })

  if (data.url) {
    redirect(data.url)
  }
}
export async function logout() {
  const supabase = await createSupbaseServerClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/auth')
}
