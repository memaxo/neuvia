'use client'

import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { createBrowserClient } from '@/lib/supabase'
import {
  type Country,
  countryKeys,
  getCountryById,
} from '@/queries/country-by-id'

export function useCountry(countryId: number) {
  const supabase = useMemo(() => createBrowserClient(), [])

  // Using useCallback to create a stable function reference
  const fetchCountry = useCallback(
    () => getCountryById(supabase, countryId),
    [supabase, countryId]
  )

  return useQuery({
    queryKey: countryKeys.detail(countryId),
    queryFn: fetchCountry,
    staleTime: 1000 * 60 * 5, // Data stays fresh for 5 minutes
  })
}

export type UseCountryResult = ReturnType<typeof useCountry>
