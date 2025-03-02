/**
 * Standard API responses for OpenAPI spec
 * 
 * These responses match our application error handling patterns
 * and provide consistent documentation for all API endpoints.
 */
import { OpenAPIV3 } from 'openapi-types'

/**
 * Standard response schemas for the API
 */
export const standardResponses: Record<string, OpenAPIV3.ResponseObject> = {
  /**
   * Standard success response (200 OK)
   */
  Success: {
    description: 'Successful operation',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['success', 'data', 'timestamp'],
          properties: {
            success: { 
              type: 'boolean', 
              example: true,
              description: 'Indicates successful operation'
            },
            data: { 
              type: 'object',
              description: 'Response data' 
            },
            timestamp: { 
              type: 'string', 
              format: 'date-time',
              description: 'Server timestamp of the response'
            }
          }
        }
      }
    }
  },

  /**
   * Standard error response
   */
  Error: {
    description: 'Error response',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['message', 'timestamp'],
              properties: {
                message: { 
                  type: 'string',
                  description: 'Human-readable error message'
                },
                code: { 
                  type: 'string',
                  description: 'Error code for programmatic handling' 
                },
                timestamp: { 
                  type: 'string', 
                  format: 'date-time',
                  description: 'Server timestamp when the error occurred'
                },
                details: { 
                  type: 'object',
                  description: 'Additional error details (varies by error type)'
                }
              }
            }
          }
        }
      }
    }
  },

  /**
   * Bad request error (400)
   */
  BadRequest: {
    description: 'Bad request due to invalid input',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['message', 'code', 'timestamp'],
              properties: {
                message: { 
                  type: 'string',
                  example: 'Invalid input parameters'
                },
                code: { 
                  type: 'string',
                  example: 'INVALID_INPUT' 
                },
                timestamp: { 
                  type: 'string', 
                  format: 'date-time' 
                },
                details: { 
                  type: 'object',
                  description: 'May contain field-specific validation errors'
                }
              }
            }
          }
        }
      }
    }
  },

  /**
   * Authentication error (401)
   */
  Unauthorized: {
    description: 'Authentication required or failed',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['message', 'code', 'timestamp'],
              properties: {
                message: { 
                  type: 'string',
                  example: 'Authentication failed'
                },
                code: { 
                  type: 'string',
                  example: 'AUTHENTICATION_FAILED' 
                },
                timestamp: { 
                  type: 'string', 
                  format: 'date-time' 
                }
              }
            }
          }
        }
      }
    }
  },

  /**
   * Authorization error (403)
   */
  Forbidden: {
    description: 'Not authorized to perform the operation',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['message', 'code', 'timestamp'],
              properties: {
                message: { 
                  type: 'string',
                  example: 'You do not have permission to perform this action'
                },
                code: { 
                  type: 'string',
                  example: 'FORBIDDEN' 
                },
                timestamp: { 
                  type: 'string', 
                  format: 'date-time' 
                }
              }
            }
          }
        }
      }
    }
  },

  /**
   * Not found error (404)
   */
  NotFound: {
    description: 'Resource not found',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['message', 'code', 'timestamp'],
              properties: {
                message: { 
                  type: 'string',
                  example: 'Resource not found'
                },
                code: { 
                  type: 'string',
                  example: 'NOT_FOUND' 
                },
                timestamp: { 
                  type: 'string', 
                  format: 'date-time' 
                },
                details: {
                  type: 'object',
                  properties: {
                    resource: {
                      type: 'string',
                      description: 'The type of resource that was not found'
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  /**
   * Validation error (422)
   */
  ValidationError: {
    description: 'Validation error',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['message', 'code', 'timestamp'],
              properties: {
                message: { 
                  type: 'string',
                  example: 'Validation failed'
                },
                code: { 
                  type: 'string',
                  example: 'VALIDATION_FAILED' 
                },
                timestamp: { 
                  type: 'string', 
                  format: 'date-time' 
                },
                details: {
                  type: 'object',
                  properties: {
                    fields: {
                      type: 'object',
                      description: 'Field-specific validation errors',
                      additionalProperties: {
                        type: 'string'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  /**
   * Server error (500)
   */
  ServerError: {
    description: 'Internal server error',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['message', 'code', 'timestamp'],
              properties: {
                message: { 
                  type: 'string',
                  example: 'Internal server error'
                },
                code: { 
                  type: 'string',
                  example: 'SERVER_ERROR' 
                },
                timestamp: { 
                  type: 'string', 
                  format: 'date-time' 
                }
              }
            }
          }
        }
      }
    }
  },

  /**
   * External service error (502)
   */
  ExternalServiceError: {
    description: 'External service failure',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['message', 'code', 'timestamp'],
              properties: {
                message: { 
                  type: 'string',
                  example: 'External service error'
                },
                code: { 
                  type: 'string',
                  example: 'EXTERNAL_SERVICE_ERROR' 
                },
                timestamp: { 
                  type: 'string', 
                  format: 'date-time' 
                },
                details: {
                  type: 'object',
                  properties: {
                    service: {
                      type: 'string',
                      description: 'The external service that failed'
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}