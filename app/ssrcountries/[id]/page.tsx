import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { getCountryById } from '@/queries/country-by-id'
import { createServerClient } from '@/lib/supabase/clients'

import CountryDisplay from './country'

async function CountryContent({ id }: { id: number }) {
  const supabase = await createServerClient()
  
  try {
    const country = await getCountryById(supabase, id)
    
    if (!country) {
      notFound()
    }

    return <CountryDisplay country={country} />
  } catch (error) {
    console.error('Error fetching country:', error)
    throw error
  }
}

export default async function CountryPage({
  params,
}: {
  params: { id: string }
}) {
  const countryId = parseInt(params.id)
  if (isNaN(countryId)) {
    notFound()
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CountryContent id={countryId} />
    </Suspense>
  )
}
