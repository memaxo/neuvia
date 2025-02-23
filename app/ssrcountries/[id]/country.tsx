// app/posts/posts.jsx
'use client'

import type { Country } from '@/queries/country-by-id'

interface CountryDisplayProps {
  country: Country
}

export default function CountryDisplay({ country }: CountryDisplayProps) {
  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold">{country.name}</h1>
      <div className="space-y-2">
        <p><span className="font-semibold">ISO2:</span> {country.iso2}</p>
        {country.iso3 && <p><span className="font-semibold">ISO3:</span> {country.iso3}</p>}
        {country.local_name && <p><span className="font-semibold">Local Name:</span> {country.local_name}</p>}
        {country.continent && <p><span className="font-semibold">Continent:</span> {country.continent}</p>}
      </div>
    </div>
  )
}
