/**
 * OpenAPI Schema Definition
 * 
 * This file serves as the entry point for our OpenAPI specifications.
 * It exports the complete OpenAPI schema and related utilities.
 */
import type { OpenAPIV3 } from 'openapi-types'
import { standardResponses } from './responses'
import { documentSchemas } from './schemas/documents'
import { verificationSchemas } from './schemas/verification'
import { reportSchemas } from './schemas/reports'
import { chatSchemas } from './schemas/chat'
import { commonSchemas } from './schemas/common'

/**
 * Complete OpenAPI schema for the Neuvia API
 */
export const openAPISpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Neuvia API',
    version: '1.0.0',
    description: 'Medical document processing, verification, and reporting API',
    contact: {
      name: 'Neuvia Support',
      email: 'support@neuvia.app'
    },
  },
  servers: [
    {
      url: '/api',
      description: 'Current API endpoint'
    }
  ],
  tags: [
    {
      name: 'documents',
      description: 'Document operations'
    },
    {
      name: 'patients',
      description: 'Patient record operations'
    },
    {
      name: 'verification',
      description: 'Document verification operations'
    },
    {
      name: 'reports',
      description: 'Report generation and management'
    },
    {
      name: 'chat',
      description: 'Chat and conversational operations'
    }
  ],
  paths: {},
  components: {
    schemas: {
      // Common schemas
      ...commonSchemas,
      
      // Domain-specific schemas
      ...documentSchemas,
      ...verificationSchemas,
      ...reportSchemas,
      ...chatSchemas,
    },
    responses: {
      ...standardResponses
    },
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase JWT token'
      }
    },
    parameters: {
      requestId: {
        name: 'x-request-id',
        in: 'header',
        schema: {
          type: 'string',
          format: 'uuid'
        },
        required: false,
        description: 'Optional request ID for correlation across logs and services'
      },
      patientId: {
        name: 'patientId',
        in: 'path',
        schema: {
          type: 'string',
          format: 'uuid'
        },
        required: true,
        description: 'Patient ID'
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ]
}

/**
 * Get the OpenAPI spec as a JSON string
 * 
 * This is useful for serving the OpenAPI specification
 * through an API endpoint for documentation tools.
 * 
 * @returns Formatted JSON string of the complete OpenAPI spec
 */
export function getOpenAPISpecAsJSON(): string {
  return JSON.stringify(openAPISpec, null, 2)
}

/**
 * Get all registered API paths from the OpenAPI spec
 * 
 * This allows for programmatic inspection of available routes.
 * 
 * @returns The complete paths object from the OpenAPI specification
 */
export function getPaths(): OpenAPIV3.PathsObject {
  return openAPISpec.paths
}

/**
 * Register a path in the OpenAPI spec
 * 
 * This allows for modular path registration from different modules.
 * Each module can define its own paths and register them with the main spec.
 * 
 * @param path The URL path to register (e.g., '/patients/{id}')
 * @param pathItemObject The OpenAPI path item object with operations
 */
export function registerPath(path: string, pathItemObject: OpenAPIV3.PathItemObject): void {
  openAPISpec.paths[path] = {
    ...openAPISpec.paths[path],
    ...pathItemObject
  }
}