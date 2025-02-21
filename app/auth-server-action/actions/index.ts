'use server'

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

export async function logout() {
  const supabase = await createSupbaseServerClient()
  await supabase.auth.signOut()
  redirect('/auth')
}
