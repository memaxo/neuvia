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
 * This implements a strict Content Security Policy that:
 * 1. Uses nonces for script/style validation
 * 2. Implements Trusted Types for DOM XSS prevention
 * 3. Handles development vs production differences
 * 4. Supports Spline 3D and other third-party integrations
 * 
 * @param nonce The nonce to include in the CSP
 * @returns A string containing the complete CSP header value
 */
export function createCSPHeader(nonce: string): string {
  const directives = {
    // Restrict default loading to same origin
    'default-src': ["'self'"],

    // Script execution policy
    'script-src': [
      "'self'",
      "'strict-dynamic'",  // Allow scripts loaded by trusted scripts
      `'nonce-${nonce}'`,  // Allow scripts with matching nonce
      'wasm-unsafe-eval',  // Required for Spline's WebAssembly
      // Third-party domains
      'https://*.spline.design',
      'https://unpkg.com',
      // Development-only relaxations
      ...(process.env.NODE_ENV === 'development' 
        ? [
            "'unsafe-eval'",   // Required for React DevTools/HMR
            "'unsafe-inline'" // Fallback for older browsers
          ]
        : [])
    ],

    // Style loading policy
    'style-src': [
      "'self'",
      `'nonce-${nonce}'`,
      // Development-only relaxations for Tailwind JIT
      ...(process.env.NODE_ENV === 'development' 
        ? ["'unsafe-inline'"]
        : [])
    ],

    // Image loading policy - includes blob: for Spline's dynamic textures
    'img-src': [
      "'self'",
      'data:',    // For embedded images
      'blob:',    // For Spline's dynamic content
      'https://*.supabase.co',
      'https://*.vercel.app',
      'https://*.githubusercontent.com',
      'https://*.spline.design'
    ],

    // Media loading policy
    'media-src': [
      "'self'",
      'https://*.supabase.co',
      'https://*.quantumone.b-cdn.net',
      'https://*.unsplash.com',
      'https://*.spline.design'
    ],

    // API and WebSocket connections
    'connect-src': [
      "'self'",
      'https://*.supabase.co',
      'https://*.vercel.app',
      'https://api.openai.com',
      'https://*.spline.design',
      // Allow WebSocket in development for HMR
      process.env.NODE_ENV === 'development' ? 'ws://localhost:*' : ''
    ],

    // Font loading restrictions
    'font-src': [
      "'self'",
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com'
    ],

    // Frame loading policy
    'frame-src': [
      "'self'",
      'https://*.supabase.co',
      'https://*.spline.design'
    ],

    // Prevent object injection attacks
    'object-src': ["'none'"],

    // Worker and frame policies for Spline
    'child-src': ["'self'", "blob:", "https://*.spline.design"],
    'worker-src': ["'self'", "blob:", "https://*.spline.design"],

    // Prevent base tag injection
    'base-uri': ["'self'"],

    // Form submission restrictions
    'form-action': ["'self'"],

    // Prevent clickjacking
    'frame-ancestors': ["'none'"],

    // PWA manifest location
    'manifest-src': ["'self'", "https://neuvia.vercel.app"],

    // Force HTTPS in production
    ...(process.env.NODE_ENV === 'production' 
      ? { 'upgrade-insecure-requests': [] } 
      : {}),

    // Trusted Types Configuration
    ...(process.env.NODE_ENV === 'development' && process.env.DISABLE_TRUSTED_TYPES === 'true'
      ? {}  // Skip Trusted Types in development if explicitly disabled
      : {
          // Define allowed Trusted Type policies
          'trusted-types': [
            'nextjs',              // Next.js core policy
            'nextjs#bundler',      // Next.js bundler policy
            'nextjs#inline-script',// Next.js inline scripts
            'nextjs#script',       // Next.js script loading
            'default'              // Default policy
          ],
          // Allow duplicate policies (fixes Firefox extensions)
          'trusted-types-allow-duplicates': [],
          // Only enforce in production
          ...(process.env.NODE_ENV === 'production' 
            ? { 'require-trusted-types-for': ["'script'"] }
            : {})
        }),

    // CSP violation reporting
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