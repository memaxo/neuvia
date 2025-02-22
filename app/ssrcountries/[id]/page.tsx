import { getCountryById } from '@/queries/country-by-id'
import { createReadOnlyClient } from '@/utils/supabase'
import { prefetchQuery } from '@supabase-cache-helpers/postgrest-react-query'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import Country from './country'

export default async function CountryPage({
  params,
}: {
  params: { id: string }
}) {
  const queryClient = new QueryClient()
  const supabase = await createReadOnlyClient()
  const countryId = parseInt(params.id)
  if (isNaN(countryId)) {
    throw new Error('Invalid country ID')
  }

  await prefetchQuery(queryClient, getCountryById(supabase, countryId))

  return (
    // Neat! Serialization is now as easy as passing props.
    // HydrationBoundary is a Client Component, so hydration will happen there.
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Country id={countryId} />
    </HydrationBoundary>
  )
}
