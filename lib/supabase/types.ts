import type { Database } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

export type TypedSupabaseClient = SupabaseClient<Database>
