/**
 * OpenAPI path definition for the /api/send endpoint
 */
import type { OpenAPIV3 } from 'openapi-types'

/**
 * OpenAPI path definition for the Send Email API
 */
export const sendEmailPath: Record<string, OpenAPIV3.PathItemObject> = {
  '/send': {
    post: {
      tags: ['email'],
      summary: 'Send an email using Resend',
      description: 'Sends an email using the Resend service with a templated email',
      operationId: 'sendEmail',
      security: [
        { bearerAuth: [] }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['to', 'subject', 'firstName'],
              properties: {
                to: {
                  type: 'array',
                  items: { 
                    type: 'string',
                    format: 'email'
                  },
                  description: 'Recipients email addresses',
                  minItems: 1
                },
                subject: { 
                  type: 'string',
                  description: 'Email subject',
                  minLength: 1 
                },
                firstName: { 
                  type: 'string',
                  description: 'Recipient first name for personalization'
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          $ref: '#/components/responses/Success',
          description: 'Email sent successfully',
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
                    required: ['id', 'sent', 'timestamp'],
                    properties: {
                      id: {
                        type: 'string',
                        description: 'Resend email ID'
                      },
                      sent: {
                        type: 'boolean',
                        description: 'Whether the email was sent successfully'
                      },
                      timestamp: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Timestamp when the email was sent'
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
        '401': {
          $ref: '#/components/responses/Unauthorized'
        },
        '422': {
          $ref: '#/components/responses/ValidationError'
        },
        '500': {
          $ref: '#/components/responses/ServerError'
        },
        '502': {
          $ref: '#/components/responses/ExternalServiceError'
        }
      }
    }
  }
}