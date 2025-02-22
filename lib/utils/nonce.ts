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
      // In development, if you absolutely need unsafe-eval (e.g., for React DevTools),
      // enable it via environment variable and warn about it
      process.env.NODE_ENV === 'development' && process.env.ALLOW_UNSAFE_EVAL === 'true'
        ? (console.warn('Warning: unsafe-eval is enabled in development mode'), "'unsafe-eval'")
        : '',
    ],
    'style-src': [
      "'self'",
      `'nonce-${nonce}'`,
      // Tailwind JIT mode requires unsafe-inline in dev only
      process.env.NODE_ENV === 'development' ? "'unsafe-inline'" : ''
    ],
    // Restrict image sources to self, data URIs, and specific HTTPS domains
    'img-src': [
      "'self'",
      'data:',
      'https://*.supabase.co',
      'https://*.vercel.app',
      'https://*.githubusercontent.com'
    ],
    // Restrict media sources to specific trusted domains
    'media-src': [
      "'self'",
      'https://*.supabase.co',
      'https://*.quantumone.b-cdn.net',
      'https://*.unsplash.com'
    ],
    // Restrict API and resource connections
    'connect-src': [
      "'self'",
      'https://*.supabase.co',
      'https://*.vercel.app',
      'https://api.openai.com',
      process.env.NODE_ENV === 'development' ? 'ws://localhost:*' : ''
    ],
    // Restrict font sources
    'font-src': [
      "'self'",
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com'
    ],
    // Restrict frame sources
    'frame-src': [
      "'self'",
      'https://*.supabase.co'
    ],
    // Prevent object injection attacks
    'object-src': ["'none'"],
    // Prevent base tag injection
    'base-uri': ["'none'"],
    // Restrict form submissions to same origin
    'form-action': ["'self'"],
    // Prevent clickjacking
    'frame-ancestors': ["'none'"],
    // Restrict manifest to same origin
    'manifest-src': ["'self'"],
    // Force HTTPS
    'upgrade-insecure-requests': [],
    // Configure Trusted Types
    'trusted-types': [
      'nextjs',
      'nextjs#bundler',
      'nextjs#inline-script',
      'nextjs#script',
      'default'
    ],
    'require-trusted-types-for': ["'script'"],
    // Enable violation reporting
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