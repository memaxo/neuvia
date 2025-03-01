import type { Database } from '@/lib/supabase'
import type { TypedSupabaseClient } from '@/utils/typed-supabase-client'

export type Country = Database['public']['Tables']['countries']['Row']

export async function getCountryById(
  client: TypedSupabaseClient,
  countryId: number
) {
  const { data, error } = await client
    .from('countries')
    .select(`
      id,
      name,
      iso2,
      iso3,
      local_name,
      continent
    `)
    .eq('id', countryId)
    .single()

  if (error) {
    throw error
  }

  return data
}

// React Query key factory - using a stable identifier for the client
export const countryKeys = {
  scope: 'countries' as const,
  all: () => [countryKeys.scope] as const,
  lists: () => [...countryKeys.all(), 'list'] as const,
  list: (filters: Record<string, any>) =>
    [...countryKeys.lists(), { filters }] as const,
  details: () => [...countryKeys.all(), 'detail'] as const,
  detail: (id: number) => [...countryKeys.details(), id] as const,
}
