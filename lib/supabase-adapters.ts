/**
 * Adapter file that exports Supabase client functions.
 * This centralizes imports to avoid module resolution issues.
 */

import {
  createBrowserClient as createBrowserSupabaseClient,
  createServerClient as createServerSupabaseClient,
} from './supabase/clients'

// Re-export the client functions from a single location
export {
  createServerClient,
  createReadOnlyClient,
  createBrowserClient,
  createAdminClient,
  adminAuthClient,
} from './supabase/clients'