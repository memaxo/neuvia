/**
 * API Endpoint Tests
 * 
 * This file contains integration tests for the API endpoints to ensure
 * they handle validation correctly.
 */
import { createMocks } from 'node-mocks-http'
import { createApiRoute } from '../../lib/api/route-helpers'
import { ApiRouteMockContext, createMockContext } from '../utils/api-test-utils'

// Mock dependencies
jest.mock('../../lib/supabase/clients', () => ({
  createServerClient: jest.fn().mockImplementation(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
    }
  }))
}))

jest.mock('../../lib/logger', () => ({
  withMetadata: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}))

describe('API Endpoint Validation', () => {
  let mockContext: ApiRouteMockContext
  
  beforeEach(() => {
    mockContext = createMockContext()
  })
  
  describe('Email Sending API', () => {
    const handler = createApiRoute(async (req) => {
      const body = await req.json()
      return new Response(JSON.stringify({
        success: true,
        data: { sent: true },
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }, {
      openApiPath: '/send',
      method: 'post',
      validate: true,
      logMetadata: { endpoint: '/api/send' }
    })
    
    test('should validate request body successfully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          to: ['test@example.com'],
          subject: 'Test Subject',
          firstName: 'Test'
        }
      })
      
      await handler(req as any, mockContext)
      
      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.success).toBe(true)
    })
    
    test('should return validation error for invalid body', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          to: [], // Invalid - empty array
          subject: 'Test Subject',
          firstName: 'Test'
        }
      })
      
      await handler(req as any, mockContext)
      
      expect(res._getStatusCode()).toBe(422)
      const data = JSON.parse(res._getData())
      expect(data.error).toBeDefined()
      expect(data.error.code).toBe('VALIDATION_FAILED')
    })
  })
  
  describe('Research API', () => {
    const handler = createApiRoute(async (req) => {
      const body = await req.json()
      return new Response(JSON.stringify({
        success: true,
        data: { research: 'Test research results' },
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }, {
      openApiPath: '/perplexity',
      method: 'post',
      validate: true,
      logMetadata: { endpoint: '/api/perplexity' }
    })
    
    test('should validate request with query successfully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          query: 'What is diabetes?',
          options: {
            depth: 'comprehensive'
          }
        }
      })
      
      await handler(req as any, mockContext)
      
      expect(res._getStatusCode()).toBe(200)
    })
    
    test('should validate request with documentId successfully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          documentId: '123e4567-e89b-12d3-a456-426614174000'
        }
      })
      
      await handler(req as any, mockContext)
      
      expect(res._getStatusCode()).toBe(200)
    })
    
    test('should return validation error when neither query nor documentId provided', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          options: {
            depth: 'comprehensive'
          }
        }
      })
      
      await handler(req as any, mockContext)
      
      expect(res._getStatusCode()).toBe(422)
      const data = JSON.parse(res._getData())
      expect(data.error).toBeDefined()
    })
  })
  
  describe('Document Verification API', () => {
    const handler = createApiRoute(async (req) => {
      const body = await req.json()
      return new Response(JSON.stringify({
        success: true,
        data: { verificationItems: [] },
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }, {
      openApiPath: '/document-verification',
      method: 'post',
      validate: true,
      logMetadata: { endpoint: '/api/document-verification' }
    })
    
    test('should validate request successfully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          documentId: '123e4567-e89b-12d3-a456-426614174000',
          workflowId: '123e4567-e89b-12d3-a456-426614174000'
        }
      })
      
      await handler(req as any, mockContext)
      
      expect(res._getStatusCode()).toBe(200)
    })
    
    test('should return validation error for missing workflowId', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          documentId: '123e4567-e89b-12d3-a456-426614174000'
        }
      })
      
      await handler(req as any, mockContext)
      
      expect(res._getStatusCode()).toBe(422)
      const data = JSON.parse(res._getData())
      expect(data.error).toBeDefined()
    })
  })
  
  describe('Patient Verification API', () => {
    const handler = createApiRoute(async (req, { params }) => {
      const body = await req.json()
      return new Response(JSON.stringify({
        success: true,
        data: { 
          patientId: params.patientId, 
          verifiedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }, {
      openApiPath: '/patient/{patientId}/verify-summary',
      method: 'post',
      validate: true,
      logMetadata: { endpoint: '/api/patient/[patientId]/verify-summary' }
    })
    
    test('should validate request successfully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          status: 'verified',
          comments: 'Looks good!'
        }
      })
      
      mockContext.params = { patientId: '123e4567-e89b-12d3-a456-426614174000' }
      
      await handler(req as any, mockContext)
      
      expect(res._getStatusCode()).toBe(200)
    })
    
    test('should return validation error for invalid status', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          status: 'maybe', // Invalid status
          comments: 'Looks good!'
        }
      })
      
      mockContext.params = { patientId: '123e4567-e89b-12d3-a456-426614174000' }
      
      await handler(req as any, mockContext)
      
      expect(res._getStatusCode()).toBe(422)
      const data = JSON.parse(res._getData())
      expect(data.error).toBeDefined()
    })
  })
})