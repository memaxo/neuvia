/**
 * OpenAPI path definition for security-related endpoints
 */
import { OpenAPIV3 } from 'openapi-types'

/**
 * OpenAPI path definition for security APIs
 */
export const securityPaths: Record<string, OpenAPIV3.PathItemObject> = {
  '/csp-report': {
    post: {
      tags: ['security'],
      summary: 'Report CSP violations',
      description: 'Endpoint for receiving Content Security Policy violation reports from browsers',
      operationId: 'reportCspViolation',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['csp-report'],
              properties: {
                'csp-report': {
                  type: 'object',
                  properties: {
                    'blocked-uri': {
                      type: 'string',
                      description: 'URI that was blocked by the CSP'
                    },
                    'violated-directive': {
                      type: 'string',
                      description: 'CSP directive that was violated'
                    },
                    'document-uri': {
                      type: 'string',
                      description: 'URI of the document where the violation occurred'
                    },
                    'source-file': {
                      type: 'string',
                      description: 'Source file where the violation occurred'
                    },
                    'line-number': {
                      oneOf: [
                        { type: 'integer' },
                        { type: 'string' }
                      ],
                      description: 'Line number in the source file where the violation occurred'
                    },
                    'column-number': {
                      oneOf: [
                        { type: 'integer' },
                        { type: 'string' }
                      ],
                      description: 'Column number in the source file where the violation occurred'
                    },
                    'effective-directive': {
                      type: 'string',
                      description: 'Effective directive that was violated'
                    },
                    'original-policy': {
                      type: 'string',
                      description: 'Original policy that was violated'
                    },
                    'disposition': {
                      type: 'string',
                      description: 'Disposition of the violation (enforce or report)'
                    },
                    'referrer': {
                      type: 'string',
                      description: 'Referrer of the document where the violation occurred'
                    },
                    'status-code': {
                      oneOf: [
                        { type: 'integer' },
                        { type: 'string' }
                      ],
                      description: 'HTTP status code of the response'
                    }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        '202': {
          description: 'CSP report accepted',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['success', 'data', 'timestamp'],
                properties: {
                  success: {
                    type: 'boolean',
                    example: true
                  },
                  data: {
                    type: 'object',
                    required: ['reported', 'timestamp'],
                    properties: {
                      reported: {
                        type: 'boolean',
                        description: 'Whether the report was successfully processed'
                      },
                      timestamp: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Timestamp when the report was processed'
                      }
                    }
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time'
                  }
                }
              }
            }
          }
        },
        '400': {
          $ref: '#/components/responses/BadRequest'
        },
        '422': {
          $ref: '#/components/responses/ValidationError'
        },
        '500': {
          $ref: '#/components/responses/ServerError'
        }
      }
    }
  }
}