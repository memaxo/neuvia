const ALLOWED_ORIGINS = new Set([
  'https://neuvia.vercel.app',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined
].filter(Boolean) as string[])

export function getCorsHeaders(requestOrigin?: string | null) {
  // Validate the origin
  const origin = requestOrigin && ALLOWED_ORIGINS.has(requestOrigin)
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
      'x-csrf-token'
    ].join(', '),
    'Access-Control-Max-Age': '3600',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin, Access-Control-Request-Headers',
    // Additional security headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  }
} 