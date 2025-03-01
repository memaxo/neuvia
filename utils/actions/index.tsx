'use server'

import { createReadOnlyClient } from '@/lib/supabase/clients'

export async function readUserSession() {
  const supabase = await createReadOnlyClient()

  return supabase.auth.getSession()
}
