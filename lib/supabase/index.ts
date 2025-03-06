export type { Database } from '@/lib/types/database'
// Export any other Supabase-related utilities

/**
 * Json type from Supabase schema
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export {
  createServerClient,
  createReadOnlyClient,
  createBrowserClient,
  createAdminClient,
  adminAuthClient,
} from './clients'