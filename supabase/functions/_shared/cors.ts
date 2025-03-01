// Strict list of allowed origins
const ALLOWED_ORIGINS = new Set(
  [
    'https://neuvia.vercel.app',
    // Only allow localhost in development
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : undefined,
  ].filter(Boolean) as string[]
)

// Validate origin with proper URL parsing and exact matching
function isValidOrigin(origin: string | null): boolean {
  if (!origin) return false
  try {
    const url = new URL(origin)
    return ALLOWED_ORIGINS.has(url.origin)
  } catch {
    return false
  }
}

export function getCorsHeaders(requestOrigin?: string | null) {
  // Validate and get the appropriate origin
  const origin = isValidOrigin(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS.values().next().value

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': [
      'authorization',
      'x-client-info',
      'apikey',
      'content-type',
      'x-csrf-token',
      'x-nonce',
    ].join(', '),
    'Access-Control-Max-Age': '3600',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin, Access-Control-Request-Headers',
    // Security headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=()',
    // Only set HSTS in production
    ...(process.env.NODE_ENV === 'production'
      ? {
          'Strict-Transport-Security':
            'max-age=31536000; includeSubDomains; preload',
        }
      : {}),
  }
}
