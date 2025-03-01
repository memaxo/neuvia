'use client'

import type { VerificationItem } from '@/lib/processing/types'

interface DataItem {
  [key: string]: unknown
}

interface DataDisplayProps {
  data: DataItem | DataItem[]
  verificationItems: VerificationItem[]
}

export function DataDisplay({ data, verificationItems }: DataDisplayProps) {
  const renderValue = (value: unknown): JSX.Element => {
    if (Array.isArray(value)) {
      return (
        <ul className="list-disc pl-4">
          {value.map((item, index) => (
            <li key={`${JSON.stringify(item)}-${index}`}>
              {renderValue(item)}
            </li>
          ))}
        </ul>
      )
    }

    if (typeof value === 'object' && value !== null) {
      return (
        <div className="pl-4">
          {Object.entries(value as Record<string, unknown>).map(
            ([key, val]) => (
              <div className="mb-2" key={key}>
                <span className="font-medium">{formatKey(key)}: </span>
                {renderValue(val)}
              </div>
            )
          )}
        </div>
      )
    }

    return <span>{value?.toString() || 'N/A'}</span>
  }

  const formatKey = (key: string): string => {
    return key
      .split(/(?=[A-Z])|_/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  const getVerificationStatus = (
    item: DataItem
  ): {
    isVerified: boolean
    confidence: number
  } => {
    const verificationItem = verificationItems.find(
      (vi) => JSON.stringify(vi.value) === JSON.stringify(item)
    )
    return {
      isVerified: verificationItem?.isVerified ?? false,
      confidence: verificationItem?.confidence ?? 0,
    }
  }

  const renderConfidenceIndicator = (confidence: number): JSX.Element => {
    const getColor = (conf: number): string => {
      if (conf >= 0.8) return 'bg-green-500'
      if (conf >= 0.5) return 'bg-yellow-500'
      return 'bg-red-500'
    }

    return (
      <div className="flex items-center gap-2">
        <div className={`size-2 rounded-full ${getColor(confidence)}`} />
        <span className="text-muted-foreground text-xs">
          {(confidence * 100).toFixed(0)}% confidence
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Array.isArray(data) ? (
        data.map((item, index) => {
          const { isVerified, confidence } = getVerificationStatus(item)
          return (
            <div
              className={`rounded-lg border p-4 ${
                isVerified ? 'border-green-200 bg-green-50' : 'bg-background'
              }`}
              key={`${JSON.stringify(item)}-${index}`}
            >
              {renderValue(item)}
              {renderConfidenceIndicator(confidence)}
            </div>
          )
        })
      ) : (
        <div className="bg-background rounded-lg border p-4">
          {renderValue(data)}
          {renderConfidenceIndicator(getVerificationStatus(data).confidence)}
        </div>
      )}
    </div>
  )
}
