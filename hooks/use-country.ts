'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getCountryById, countryKeys, type Country } from '@/queries/country-by-id'
import { createBrowserClient } from '@/lib/supabase'

export function useCountry(countryId: number) {
  const supabase = useMemo(() => createBrowserClient(), [])

  return useQuery({
    queryKey: countryKeys.detail(countryId),
    queryFn: () => getCountryById(supabase, countryId),
    staleTime: 1000 * 60 * 5, // Data stays fresh for 5 minutes
  })
}

export type UseCountryResult = ReturnType<typeof useCountry> 