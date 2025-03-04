/**
 * API route for generating verification for a document
 */
import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'
import { withZodValidation } from '@/lib/api/middleware/zod-validation'
import { z } from 'zod'
import { ApplicationError, ValidationError } from '@/lib/errors'
import { extractPatientSummary } from '@/lib/langchain/patient-summary'
import { createId } from '@/lib/utils'
import { VerificationOptionsSchema } from '@/lib/schemas/verification'
import { isVerificationResult } from '@/lib/types/verification'

// Extend the verification options schema for this specific endpoint
const GenerateVerificationSchema = VerificationOptionsSchema.extend({
  document: z.any().refine(val => !!val, 'Document is required'),
  workflowId: z.string().uuid().optional(),
  messageId: z.string().optional(),
  summaryId: z.string().uuid().optional(),
})

/**
 * POST handler for generating verification for a document
 */
export async function POST(req: NextRequest) {
  return withZodValidation(GenerateVerificationSchema)(req, async (data) => {
    try {
      const { 
        document, 
        workflowId, 
        messageId, 
        summaryId = createId(),
        title,
        patientId,
        documentId,
        items,
        options
      } = data
      
      // Generate verification
      const extractionResult = await extractPatientSummary(document, {
        workflowId,
        messageId,
        summaryId,
        patientId,
        documentId,
        options: {
          title,
          ...options
        }
      })
      
      // Create verification result
      if (extractionResult.summary && 
          typeof extractionResult.structuredData === 'object') {
        
        // Convert extraction result to verification items
        const verificationItems = items || 
          Object.entries(extractionResult.structuredData).map(([key, value]) => ({
            id: key,
            title: key.replace(/([A-Z])/g, ' $1').trim(), // Convert camelCase to words
            content: String(value)
          }));
        
        // Build verification result
        const verificationResult = {
          isVerified: false, // Needs user verification
          items: verificationItems.map(item => ({
            id: item.id,
            title: item.title,
            content: item.content,
            status: 'pending' as const
          })),
          metadata: {
            verificationStatus: 'pending' as const,
            correctionCount: 0,
            documentId: extractionResult.documentId || documentId,
            patientId: extractionResult.patientId || patientId
          }
        }
        
        // Validate with type guard
        if (!isVerificationResult(verificationResult)) {
          console.warn('Invalid verification result format', verificationResult)
        }
      }
      
      // Return success response
      return apiSuccess({
        summaryId: extractionResult.summaryId || summaryId,
        summary: extractionResult.summary,
        structuredData: extractionResult.structuredData,
        documentId: extractionResult.documentId || documentId,
        patientId: extractionResult.patientId || patientId
      })
    } catch (error) {
      console.error('Error generating verification:', error)
      
      if (error instanceof ValidationError) {
        return apiError({
          message: error.message,
          code: error.code,
          errors: error.data,
          status: error.statusCode
        })
      }
      
      return apiError({
        message: error instanceof ApplicationError 
          ? error.message
          : 'Failed to generate verification',
        status: error instanceof ApplicationError ? error.statusCode : 500
      })
    }
  })
}