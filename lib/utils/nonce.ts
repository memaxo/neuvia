import { randomBytes } from 'crypto'

/**
 * Generates a cryptographically secure nonce for Content Security Policy
 * @returns A base64 encoded nonce string
 */
export function generateNonce(): string {
  // Generate 16 bytes of random data
  const randomData = randomBytes(16)
  // Convert to base64
  return randomData.toString('base64')
}

/**
 * Creates a CSP header value with the provided nonce
 * @param nonce The nonce to include in the CSP
 * @returns A string containing the complete CSP header value
 */
export function createCSPHeader(nonce: string): string {
  const directives = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'strict-dynamic'",
      `'nonce-${nonce}'`,
      // Keep unsafe-eval for development tools like React DevTools
      process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : '',
      '*.supabase.co',
      'googleapis.com',
      'va.vercel-scripts.com',
      'blob:',
      '*.vercel.app'
    ],
    'style-src': ["'self'", `'nonce-${nonce}'`],
    'img-src': ["'self'", 'blob:', 'data:', '*'],
    'media-src': [
      "'self'",
      '*.supabase.co',
      'quantumone.b-cdn.net',
      '*.unsplash.com',
      'youtube.com'
    ],
    'connect-src': ["'self'", '*'],
    'font-src': ["'self'", 'googleapis.com'],
    'frame-src': ["'self'", '*.supabase.co', 'youtube.com'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'manifest-src': ["'self'", 'https://neuvia.vercel.app'],
    'trusted-types': [
      'nextjs',
      'nextjs#bundler',
      'nextjs#inline-script',
      'nextjs#script'
    ],
    'require-trusted-types-for': ["'script'"]
  }

  // Filter out empty values and join directives
  return Object.entries(directives)
    .map(([key, values]) => {
      const filteredValues = values.filter(Boolean)
      return filteredValues.length > 0 ? `${key} ${filteredValues.join(' ')}` : ''
    })
    .filter(Boolean)
    .join('; ')
} 