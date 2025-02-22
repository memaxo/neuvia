'use server'

import { createReadOnlyClient } from '@/utils/supabase'

export async function readUserSession() {
  const supabase = await createReadOnlyClient()

  return supabase.auth.getSession()
}
