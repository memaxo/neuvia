/**
 * OpenAPI Schema Definition
 * 
 * This file serves as the entry point for our OpenAPI specifications.
 * It exports the complete OpenAPI schema and related utilities.
 */
import { OpenAPIV3 } from 'openapi-types'
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
 */
export function getOpenAPISpecAsJSON(): string {
  return JSON.stringify(openAPISpec, null, 2)
}

/**
 * Get paths from the OpenAPI spec
 */
export function getPaths(): OpenAPIV3.PathsObject {
  return openAPISpec.paths
}

/**
 * Register a path in the OpenAPI spec
 */
export function registerPath(path: string, pathItemObject: OpenAPIV3.PathItemObject): void {
  openAPISpec.paths[path] = {
    ...openAPISpec.paths[path],
    ...pathItemObject
  }
}