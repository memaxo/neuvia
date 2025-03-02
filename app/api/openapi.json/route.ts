/**
 * API route for serving the OpenAPI specification in JSON format
 */
import { createOpenAPIRoute } from '@/lib/api/openapi-export'

/**
 * GET handler for OpenAPI spec
 */
export const GET = createOpenAPIRoute()