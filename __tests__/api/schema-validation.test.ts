/**
 * OpenAPI Schema Validation Tests
 * 
 * This file contains tests to validate that our OpenAPI schemas
 * correctly validate API requests and responses.
 */
import { validateSchema } from '../../lib/api/ajv'
import { openAPISpec } from '../../lib/api/openapi'
import { OpenAPIV3 } from 'openapi-types'

// Helper functions for testing
function getRequestBodySchema(path: string, method: string, contentType = 'application/json'): OpenAPIV3.SchemaObject | undefined {
  const pathObj = openAPISpec.paths[path] as OpenAPIV3.PathItemObject
  if (!pathObj) return undefined
  
  const operation = pathObj[method.toLowerCase()] as OpenAPIV3.OperationObject
  if (!operation || !operation.requestBody) return undefined
  
  const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject
  const content = requestBody.content[contentType]
  
  return content?.schema as OpenAPIV3.SchemaObject
}

function getResponseSchema(path: string, method: string, statusCode = '200', contentType = 'application/json'): OpenAPIV3.SchemaObject | undefined {
  const pathObj = openAPISpec.paths[path] as OpenAPIV3.PathItemObject
  if (!pathObj) return undefined
  
  const operation = pathObj[method.toLowerCase()] as OpenAPIV3.OperationObject
  if (!operation || !operation.responses) return undefined
  
  const response = operation.responses[statusCode] as OpenAPIV3.ResponseObject
  if (!response || !response.content) return undefined
  
  const content = response.content[contentType]
  
  return content?.schema as OpenAPIV3.SchemaObject
}

describe('OpenAPI Schema Validation', () => {
  describe('Request Body Validation', () => {
    test('Send Email API validates request body correctly', () => {
      const schema = getRequestBodySchema('/send', 'post')
      expect(schema).toBeDefined()
      
      // Valid request
      const validRequest = {
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        firstName: 'John'
      }
      expect(validateSchema(schema!, validRequest).valid).toBe(true)
      
      // Invalid - missing required field
      const missingField = {
        to: ['recipient@example.com'],
        subject: 'Test Subject'
      }
      expect(validateSchema(schema!, missingField).valid).toBe(false)
      
      // Invalid - wrong type
      const wrongType = {
        to: 'recipient@example.com', // Should be array
        subject: 'Test Subject',
        firstName: 'John'
      }
      expect(validateSchema(schema!, wrongType).valid).toBe(false)
      
      // Invalid - empty array
      const emptyArray = {
        to: [],
        subject: 'Test Subject',
        firstName: 'John'
      }
      expect(validateSchema(schema!, emptyArray).valid).toBe(false)
    })
    
    test('Perplexity API validates request body correctly', () => {
      const schema = getRequestBodySchema('/perplexity', 'post')
      expect(schema).toBeDefined()
      
      // Valid request with query
      const validQuery = {
        query: 'What is diabetes?',
        options: {
          depth: 'comprehensive',
          sourcesLimit: 5,
          includeSourceContent: true
        }
      }
      expect(validateSchema(schema!, validQuery).valid).toBe(true)
      
      // Valid request with documentId
      const validDocId = {
        documentId: '123e4567-e89b-12d3-a456-426614174000',
        options: {
          isMedicalDiagnosis: true
        }
      }
      expect(validateSchema(schema!, validDocId).valid).toBe(true)
      
      // Invalid - missing both query and documentId
      const missingBoth = {
        options: {
          depth: 'comprehensive'
        }
      }
      expect(validateSchema(schema!, missingBoth).valid).toBe(false)
    })
    
    test('Document Verification API validates request body correctly', () => {
      const schema = getRequestBodySchema('/document-verification', 'post')
      expect(schema).toBeDefined()
      
      // Valid request
      const validRequest = {
        documentId: '123e4567-e89b-12d3-a456-426614174000',
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        options: {
          isRequired: true
        }
      }
      expect(validateSchema(schema!, validRequest).valid).toBe(true)
      
      // Invalid - missing workflowId
      const missingWorkflow = {
        documentId: '123e4567-e89b-12d3-a456-426614174000'
      }
      expect(validateSchema(schema!, missingWorkflow).valid).toBe(false)
    })
    
    test('Patient Verify Summary API validates request body correctly', () => {
      const schema = getRequestBodySchema('/patient/{patientId}/verify-summary', 'post')
      expect(schema).toBeDefined()
      
      // Valid request
      const validRequest = {
        status: 'verified',
        comments: 'Looks good!'
      }
      expect(validateSchema(schema!, validRequest).valid).toBe(true)
      
      // Valid - only status
      const onlyStatus = {
        status: 'rejected'
      }
      expect(validateSchema(schema!, onlyStatus).valid).toBe(true)
      
      // Invalid - wrong status value
      const wrongStatus = {
        status: 'maybe'
      }
      expect(validateSchema(schema!, wrongStatus).valid).toBe(false)
    })
  })
  
  describe('Response Body Validation', () => {
    test('Success response schema is valid', () => {
      const schema = getResponseSchema('/send', 'post')
      expect(schema).toBeDefined()
      
      // Valid response
      const validResponse = {
        success: true,
        data: {
          id: 'email_123',
          sent: true,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      }
      expect(validateSchema(schema!, validResponse).valid).toBe(true)
      
      // Invalid - missing required field
      const missingField = {
        success: true,
        data: {
          id: 'email_123',
          sent: true
        }
      }
      expect(validateSchema(schema!, missingField).valid).toBe(false)
    })
    
    test('Error response schema is valid', () => {
      const schema = getResponseSchema('/send', 'post', '400')
      expect(schema).toBeDefined()
      
      // Valid error response
      const validError = {
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
          details: {
            fields: {
              to: 'Required non-empty array'
            }
          }
        }
      }
      expect(validateSchema(schema!, validError).valid).toBe(true)
      
      // Invalid - missing required field
      const missingField = {
        error: {
          message: 'Validation failed'
        }
      }
      expect(validateSchema(schema!, missingField).valid).toBe(false)
    })
  })
})