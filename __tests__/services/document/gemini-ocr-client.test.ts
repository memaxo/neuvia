import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GeminiOCRClient, OCRPageSchema, OCRDocumentSchema } from '@/lib/services/document/extraction/ocr/gemini-ocr-client';

// Mock the GoogleGenerativeAI
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              page_number: 1,
              text: 'Test document content',
              tables: [['Header', 'Value'], ['Item 1', 'Value 1']],
              metadata: {
                patient_name: 'John Doe',
                document_date: '2025-01-01',
                section_types: ['Demographics', 'Assessment']
              }
            })
          }
        })
      })
    }))
  };
});

describe('GeminiOCRClient', () => {
  let client: GeminiOCRClient;
  
  beforeEach(() => {
    client = new GeminiOCRClient({
      gemini: {
        apiKey: 'test-api-key',
        model: 'gemini-2.0-flash-lite',
        temperature: 0,
        maxOutputTokens: 10000
      }
    } as any);
  });
  
  it('should process a document successfully', async () => {
    // Create a test blob
    const blob = new Blob(['test'], { type: 'application/pdf' });
    
    // Process the document
    const result = await client.processDocument(blob);
    
    // Validate the result
    expect(result).toBeDefined();
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].page_number).toBe(1);
    expect(result.pages[0].text).toBe('Test document content');
    expect(result.pages[0].tables).toHaveLength(2);
    expect(result.pages[0].metadata?.patient_name).toBe('John Doe');
  });
  
  it('should validate the OCR page schema', () => {
    const validPage = {
      page_number: 1,
      text: 'Test content',
      tables: [['Header', 'Value']],
      metadata: {
        patient_name: 'John Doe'
      }
    };
    
    const result = OCRPageSchema.safeParse(validPage);
    expect(result.success).toBe(true);
    
    const invalidPage = {
      // Missing required 'text' field
      page_number: 1
    };
    
    const invalidResult = OCRPageSchema.safeParse(invalidPage);
    expect(invalidResult.success).toBe(false);
  });
  
  it('should validate the OCR document schema', () => {
    const validDoc = {
      pages: [
        {
          page_number: 1,
          text: 'Test content'
        }
      ],
      metadata: {
        document_structure: 'single-page',
        confidence: 0.9
      }
    };
    
    const result = OCRDocumentSchema.safeParse(validDoc);
    expect(result.success).toBe(true);
  });
});