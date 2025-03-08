/**
 * Common schema definitions for the OpenAPI specification
 * 
 * These schemas are used across multiple endpoints and provide
 * consistent typing for common patterns.
 */
import type { OpenAPIV3 } from 'openapi-types'

export const commonSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  /**
   * Standard API success response
   */
  ApiSuccessResponse: {
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
        description: 'Response data payload'
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'ISO timestamp of when the response was generated'
      }
    }
  },

  /**
   * Standard API error response
   */
  ApiErrorResponse: {
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
            description: 'ISO timestamp of when the error occurred'
          },
          details: {
            type: 'object',
            description: 'Additional error details, varies by error type'
          }
        }
      }
    }
  },

  /**
   * Pagination parameters for list endpoints
   */
  PaginationParams: {
    type: 'object',
    properties: {
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
        description: 'Page number (1-based)'
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
        description: 'Number of items per page'
      }
    }
  },

  /**
   * Pagination metadata for list responses
   */
  PaginationMeta: {
    type: 'object',
    required: ['page', 'limit', 'total', 'totalPages'],
    properties: {
      page: {
        type: 'integer',
        description: 'Current page number'
      },
      limit: {
        type: 'integer',
        description: 'Items per page'
      },
      total: {
        type: 'integer',
        description: 'Total items available'
      },
      totalPages: {
        type: 'integer',
        description: 'Total number of pages'
      }
    }
  },

  /**
   * UUID schema for IDs
   */
  UUID: {
    type: 'string',
    format: 'uuid',
    description: 'UUID identifier'
  },

  /**
   * Timestamp schema
   */
  Timestamp: {
    type: 'string',
    format: 'date-time',
    description: 'ISO 8601 formatted timestamp'
  },

  /**
   * Success/failure indicator
   */
  SuccessResponse: {
    type: 'object',
    required: ['success'],
    properties: {
      success: {
        type: 'boolean',
        description: 'Indicates if the operation was successful'
      },
      message: {
        type: 'string',
        description: 'Optional success message'
      }
    }
  }
}