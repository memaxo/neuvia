'use server'

import { createReadOnlyClient } from '@/lib/supabase'

export async function readUserSession() {
  const supabase = await createReadOnlyClient()

  return supabase.auth.getSession()
}
