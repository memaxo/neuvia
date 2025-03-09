/**
 * Tests for PatientSummaryService
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PatientSummaryService } from '@/lib/services/patient/patient-summary-service';

// Mock generateText from ai
jest.mock('ai', () => ({
  generateText: jest.fn().mockResolvedValue({
    text: JSON.stringify({
      sections: {
        demographics: { 
          items: [
            {text: "Patient is John Doe, 45-year-old male", importance: 10, confidence: 0.9, temporalMarker: "current"}
          ]
        },
        diagnoses: { 
          items: [
            {text: "Type 2 Diabetes", importance: 8, confidence: 0.9, temporalMarker: "current"},
            {text: "Hypertension", importance: 7, confidence: 0.8, temporalMarker: "current"}
          ] 
        }
      },
      metadata: {
        extractionConfidence: 0.85
      }
    })
  })
}));

// Mock GoogleGenerativeAI
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              sections: {
                demographics: { 
                  items: [
                    {text: "Patient is John Doe, 45-year-old male", importance: 10, confidence: 0.9, temporalMarker: "current"}
                  ]
                },
                diagnoses: { 
                  items: [
                    {text: "Type 2 Diabetes", importance: 8, confidence: 0.9, temporalMarker: "current"},
                    {text: "Hypertension", importance: 7, confidence: 0.8, temporalMarker: "current"}
                  ] 
                }
              },
              metadata: {
                extractionConfidence: 0.9
              }
            })
          }
        })
      })
    }))
  };
});

// Mock Supabase
jest.mock('@/lib/supabase/clients', () => ({
  createServerClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null }),
          maybeSingle: jest.fn().mockResolvedValue({ data: null })
        })
      }),
      upsert: jest.fn().mockResolvedValue({ error: null })
    }),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } })
    }
  })
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  default: {
    withMetadata: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock getDefaultConfig
jest.mock('@/lib/langchain/config', () => ({
  getDefaultConfig: jest.fn().mockReturnValue({
    gemini: {
      apiKey: 'test-api-key',
      model: 'gemini-2.0-flash-lite',
      temperature: 0,
      maxOutputTokens: 4096
    }
  })
}));

describe('PatientSummaryService', () => {
  // Use private property accessor to reset the singleton instance
  const resetSingleton = () => {
    (PatientSummaryService as any).instance = null;
  };
  
  beforeEach(() => {
    resetSingleton();
    jest.clearAllMocks();
  });
  
  describe('extractDocumentEssentials', () => {
    it('should extract document essentials using Gemini', async () => {
      const service = PatientSummaryService.getInstance();
      
      const documentId = 'test-doc-id';
      const documentContent = 'This is a test medical document for John Doe, 45-year-old male with Type 2 Diabetes and Hypertension.';
      const documentType = { type: 'Medical Report', category: 'CLINICAL' };
      const documentDate = '2025-02-15';
      
      const result = await service.extractDocumentEssentials(
        documentId,
        documentContent,
        documentType,
        documentDate
      );
      
      // Check the results
      expect(result).toBeDefined();
      expect(result.documentId).toBe(documentId);
      expect(result.documentType).toBe(documentType);
      expect(result.documentDate).toBe(documentDate);
      expect(result.sections).toBeDefined();
      expect(result.sections.demographics).toBeDefined();
      expect(result.sections.diagnoses).toBeDefined();
      expect(result.sections.demographics.items).toHaveLength(1);
      expect(result.sections.diagnoses.items).toHaveLength(2);
      expect(result.metadata.extractionConfidence).toBeGreaterThan(0.8);
      expect(result.metadata.extractionMethod).toBe('gemini');
    });
  });
});