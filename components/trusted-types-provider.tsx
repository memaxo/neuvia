'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { createTrustedPolicy } from '@/lib/utils/trusted-types'

export function TrustedTypesProvider() {
  useEffect(() => {
    // Initialize default policy for string-to-type conversions
    createTrustedPolicy('default', {
      createHTML: (input) => input, // You might want to add sanitization here
      createScript: (input) => input,
      createScriptURL: (url) => {
        const allowedDomains = [
          'neuvia.vercel.app',
          'supabase.co',
          'googleapis.com',
          'va.vercel-scripts.com',
          'vercel.app'
        ]
        const urlObj = new URL(url)
        if (allowedDomains.some(domain => urlObj.hostname.endsWith(domain))) {
          return url
        }
        throw new Error(`URL ${url} is not allowed`)
      }
    })
  }, [])

  return (
    <Script
      id="trusted-types-init"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          if (window.trustedTypes && !window.trustedTypes.defaultPolicy) {
            window.trustedTypes.createPolicy('default', {
              createHTML: input => input,
              createScript: input => input,
              createScriptURL: url => {
                const allowedDomains = [
                  'neuvia.vercel.app',
                  'supabase.co',
                  'googleapis.com',
                  'va.vercel-scripts.com',
                  'vercel.app'
                ];
                const urlObj = new URL(url);
                if (allowedDomains.some(domain => urlObj.hostname.endsWith(domain))) {
                  return url;
                }
                throw new Error('URL ' + url + ' is not allowed');
              }
            });
          }
        `
      }}
    />
  )
} 