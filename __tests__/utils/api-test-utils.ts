/**
 * API Test Utilities
 * 
 * Helper functions for testing API routes and middleware
 */

/**
 * Mock context for API route handler tests
 */
export interface ApiRouteMockContext {
  params: Record<string, string>
  headers: Record<string, string>
  ip?: string
  nextUrl?: URL
}

/**
 * Create a mock API route context
 */
export function createMockContext(): ApiRouteMockContext {
  return {
    params: {},
    headers: {},
    ip: '127.0.0.1',
    nextUrl: new URL('http://localhost:3000')
  }
}

/**
 * Mock API success response
 * @param data Response data
 * @returns Mock success response
 */
export function mockApiSuccess<T>(data: T) {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString()
  }
}

/**
 * Mock API error response
 * @param message Error message
 * @param code Error code
 * @param details Additional error details
 * @returns Mock error response
 */
export function mockApiError(message: string, code?: string, details?: Record<string, any>) {
  return {
    error: {
      message,
      code: code || 'ERROR',
      timestamp: new Date().toISOString(),
      ...(details ? { details } : {})
    }
  }
}

/**
 * Create a mock Request object
 * @param method HTTP method
 * @param url Request URL
 * @param body Request body
 * @param headers Request headers
 * @returns Mock Request object
 */
export function createMockRequest(
  method: string,
  url: string,
  body?: any,
  headers: Record<string, string> = {}
): Request {
  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  }
  
  if (body) {
    requestInit.body = JSON.stringify(body)
  }
  
  return new Request(url, requestInit)
}

/**
 * Parse response JSON
 * @param response Response object
 * @returns Parsed JSON
 */
export async function parseResponseJson<T>(response: Response): Promise<T> {
  return await response.json() as T
}