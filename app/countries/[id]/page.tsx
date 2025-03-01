'use client'

import { notFound } from 'next/navigation'

import { useCountry } from '@/hooks/use-country'

import CountryDisplay from '../../ssrcountries/[id]/country'

export default function CountryPage({ params }: { params: { id: string } }) {
  const countryId = parseInt(params.id)
  if (isNaN(countryId)) {
    notFound()
  }

  const { data: country, isLoading, isError, error } = useCountry(countryId)

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="mb-4 h-8 w-64 rounded bg-gray-200" />
          <div className="space-y-3">
            <div className="h-4 w-48 rounded bg-gray-200" />
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="h-4 w-40 rounded bg-gray-200" />
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-4">
        <div className="text-red-500">
          Error:{' '}
          {error instanceof Error ? error.message : 'Failed to load country'}
        </div>
      </div>
    )
  }

  if (!country) {
    notFound()
  }

  return <CountryDisplay country={country} />
}
