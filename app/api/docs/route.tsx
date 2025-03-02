/**
 * API route for serving the OpenAPI documentation with Swagger UI
 */
import { createSwaggerUIRoute } from '@/lib/api/openapi-export'

/**
 * GET handler for Swagger UI documentation
 */
export const GET = createSwaggerUIRoute('/api/openapi.json')