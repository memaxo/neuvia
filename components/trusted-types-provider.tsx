'use client'

import Script from 'next/script'
import { useEffect } from 'react'
import filterXSS from 'xss'

export function TrustedTypesProvider() {
  useEffect(() => {
    // Initialize default policy for string-to-type conversions
    createTrustedPolicy('default', {
      createHTML: (input) => filterXSS(input, {
        whiteList: {
          p: ['class'],
          div: ['class'],
          span: ['class'],
          h1: ['class'],
          h2: ['class'],
          h3: ['class'],
          h4: ['class'],
          h5: ['class'],
          h6: ['class'],
          ul: ['class'],
          ol: ['class'],
          li: ['class'],
          a: ['href', 'title', 'target', 'rel'],
          br: [],
          strong: [],
          em: [],
          b: [],
          i: [],
        },
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'style', 'xml']
      }),
      createScript: (input) => {
        throw new Error('Dynamic script creation is not allowed')
      },
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
      dangerouslySetInnerHTML={{
        __html: `
          if (window.trustedTypes && !window.trustedTypes.defaultPolicy) {
            window.trustedTypes.createPolicy('default', {
              createHTML: ${filterXSS.toString()},
              createScript: () => { 
                throw new Error('Dynamic script creation is not allowed');
              },
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
      id="trusted-types-init"
      strategy="beforeInteractive"
    />
  )
} 