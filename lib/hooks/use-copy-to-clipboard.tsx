'use client'

import * as React from 'react'
import { useState } from 'react'

interface useCopyToClipboardProps {
  timeout?: number
  maxLength?: number
}

interface CopyToClipboardResult {
  isCopied: boolean
  error: string | null
  copyToClipboard: (value: string) => Promise<void>
}

export function useCopyToClipboard({
  timeout = 2000,
  maxLength = 5000,
}: useCopyToClipboardProps): CopyToClipboardResult {
  const [isCopied, setIsCopied] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const copyToClipboard = async (value: string) => {
    try {
      // Reset states
      setError(null)
      setIsCopied(false)

      // Validate input
      if (!value || typeof value !== 'string') {
        throw new Error('Invalid content: must be a non-empty string')
      }

      if (value.length > maxLength) {
        throw new Error(`Content exceeds maximum length of ${maxLength} characters`)
      }

      // Check for clipboard API support
      if (typeof window === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API not supported')
      }

      // Sanitize the content (remove any potential script tags, etc)
      const sanitizedValue = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .trim()

      // Copy to clipboard
      await navigator.clipboard.writeText(sanitizedValue)
      setIsCopied(true)

      // Reset copied state after timeout
      setTimeout(() => {
        setIsCopied(false)
      }, timeout)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to copy content'
      setError(errorMessage)
      console.error('Copy to clipboard failed:', err)
    }
  }

  return { isCopied, error, copyToClipboard }
}
