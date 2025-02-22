/**
 * Generates a cryptographically secure nonce for Content Security Policy
 * Uses 32 bytes (256-bit) of entropy for enhanced security
 * @returns A URL-safe base64 encoded nonce string
 */
export function generateNonce(): string {
  // Generate 32 bytes (256-bit) of random data for enhanced security
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  // Convert to URL-safe base64 encoding
  return Buffer.from(array).toString('base64url')
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
      // Keep unsafe-eval only for development and only if absolutely necessary
      process.env.NODE_ENV === 'development' && process.env.ALLOW_UNSAFE_EVAL === 'true' 
        ? "'unsafe-eval'" 
        : '',
    ],
    'style-src': [
      "'self'",
      `'nonce-${nonce}'`,
      // Required for Tailwind's JIT mode in development only
      process.env.NODE_ENV === 'development' ? "'unsafe-inline'" : ''
    ],
    'img-src': ["'self'", 'data:', 'https:'],
    'media-src': [
      "'self'",
      'https://*.supabase.co',
      'https://*.quantumone.b-cdn.net',
      'https://*.unsplash.com',
      'https://*.youtube.com'
    ],
    'connect-src': [
      "'self'",
      'https://*.supabase.co',
      'https://*.vercel.app',
      'https://api.openai.com'
    ],
    'font-src': ["'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
    'frame-src': ["'self'", 'https://*.supabase.co', 'https://*.youtube.com'],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'manifest-src': ["'self'"],
    'upgrade-insecure-requests': [],
    'trusted-types': [
      'nextjs',
      'nextjs#bundler',
      'nextjs#inline-script',
      'nextjs#script',
      'default'
    ],
    'require-trusted-types-for': ["'script'"],
    // Report violations to your endpoint
    'report-uri': [process.env.CSP_REPORT_URI || '/api/csp-report'],
    'report-to': ['csp-endpoint']
  }

  // Filter out empty values and join directives
  return Object.entries(directives)
    .map(([key, values]) => {
      const filteredValues = values.filter(Boolean)
      return filteredValues.length > 0 ? `${key} ${filteredValues.join(' ')}` : key
    })
    .filter(Boolean)
    .join('; ')
} 