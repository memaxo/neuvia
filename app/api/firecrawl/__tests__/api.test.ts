/**
 * Firecrawl API Tests
 * 
 * Tests for the Firecrawl API endpoints.
 * Note: These tests are designed to be run with Jest.
 */

import { NextRequest } from 'next/server';
import { GET as getInfo } from '../route';
import { POST as postSearch } from '../search/route';
import { POST as postExtract } from '../extract/route';
import { POST as postScrape } from '../scrape/route';

// Mock imports
jest.mock('@/app/auth/actions', () => ({
  getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'test-user-id' } } }))
}));

jest.mock('@/lib/rate-limit', () => ({
  rateLimiter: {
    check: jest.fn(() => Promise.resolve())
  }
}));

jest.mock('@/lib/services/firecrawl/actions', () => ({
  search: jest.fn(() => Promise.resolve({
    success: true,
    data: [{ title: 'Test Result', url: 'https://example.com', description: 'Test description' }]
  })),
  extract: jest.fn(() => Promise.resolve({
    success: true,
    data: [{ url: 'https://example.com', data: { title: 'Example' } }]
  })),
  scrape: jest.fn(() => Promise.resolve({
    success: true,
    data: { url: 'https://example.com', data: 'Test content', title: 'Test Page' }
  }))
}));

// Helper to create NextRequest objects
function createNextRequest(method: string, url: string, body?: any): NextRequest {
  const request = new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  
  // @ts-ignore - NextRequest is not fully compatible with Request
  return new NextRequest(request, { params: {} });
}

// Helper to parse response
async function parseJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

describe('Firecrawl API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/firecrawl', () => {
    it('should return API information', async () => {
      const req = createNextRequest('GET', 'https://example.com/api/firecrawl');
      const res = await getInfo(req);
      
      expect(res.status).toBe(200);
      const data = await parseJsonResponse(res);
      
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('version');
      expect(data.data).toHaveProperty('availableTools');
      expect(data.data).toHaveProperty('endpoints');
    });
  });

  describe('POST /api/firecrawl/search', () => {
    it('should validate request parameters', async () => {
      const req = createNextRequest('POST', 'https://example.com/api/firecrawl/search', {});
      const res = await postSearch(req);
      
      expect(res.status).toBe(400);
      const data = await parseJsonResponse(res);
      
      expect(data.success).toBe(false);
      expect(data).toHaveProperty('error');
    });
    
    it('should return search results', async () => {
      const req = createNextRequest('POST', 'https://example.com/api/firecrawl/search', {
        query: 'test query'
      });
      
      const res = await postSearch(req);
      expect(res.status).toBe(200);
      
      const data = await parseJsonResponse(res);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });
  
  describe('POST /api/firecrawl/extract', () => {
    it('should validate request parameters', async () => {
      const req = createNextRequest('POST', 'https://example.com/api/firecrawl/extract', {});
      const res = await postExtract(req);
      
      expect(res.status).toBe(400);
      const data = await parseJsonResponse(res);
      
      expect(data.success).toBe(false);
      expect(data).toHaveProperty('error');
    });
    
    it('should return extraction results', async () => {
      const req = createNextRequest('POST', 'https://example.com/api/firecrawl/extract', {
        urls: ['https://example.com'],
        prompt: 'Extract the title'
      });
      
      const res = await postExtract(req);
      expect(res.status).toBe(200);
      
      const data = await parseJsonResponse(res);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });
  
  describe('POST /api/firecrawl/scrape', () => {
    it('should validate request parameters', async () => {
      const req = createNextRequest('POST', 'https://example.com/api/firecrawl/scrape', {});
      const res = await postScrape(req);
      
      expect(res.status).toBe(400);
      const data = await parseJsonResponse(res);
      
      expect(data.success).toBe(false);
      expect(data).toHaveProperty('error');
    });
    
    it('should return scrape results', async () => {
      const req = createNextRequest('POST', 'https://example.com/api/firecrawl/scrape', {
        url: 'https://example.com'
      });
      
      const res = await postScrape(req);
      expect(res.status).toBe(200);
      
      const data = await parseJsonResponse(res);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('url');
      expect(data.data).toHaveProperty('data');
    });
  });
}); 