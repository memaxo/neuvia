/**
 * OpenAPI path definition for authentication-related endpoints
 */
import { OpenAPIV3 } from 'openapi-types'

/**
 * OpenAPI path definition for authentication API
 */
export const authPaths: Record<string, OpenAPIV3.PathItemObject> = {
  '/sid/callback': {
    get: {
      tags: ['auth'],
      summary: 'Auth callback endpoint',
      description: 'Handles authentication callback flow for Supabase auth',
      operationId: 'authCallback',
      security: [],
      parameters: [
        {
          name: 'code',
          in: 'query',
          required: true,
          schema: {
            type: 'string'
          },
          description: 'Authentication code to exchange for a session'
        }
      ],
      responses: {
        '302': {
          description: 'Redirect to application page',
          headers: {
            Location: {
              description: 'URL to redirect to',
              schema: {
                type: 'string',
                format: 'uri'
              }
            }
          }
        },
        '500': {
          $ref: '#/components/responses/ServerError'
        }
      }
    }
  }
}