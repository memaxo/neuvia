/**
 * API route for generating verification for a document
 */
import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'
import { z } from 'zod'
import { validateRequest } from '@/lib/api/validation'
import { ApplicationError } from '@/lib/errors'
import { extractPatientSummary } from '@/lib/langchain/patient-summary'
import { createId } from '@/lib/utils'

// Request validation schema
const generateVerificationSchema = z.object({
  document: z.any().refine(val => !!val, 'Document is required'),
  workflowId: z.string().optional(),
  messageId: z.string().optional(),
  summaryId: z.string().optional(),
})

/**
 * POST handler for generating verification for a document
 */
export async function POST(req: NextRequest) {
  try {
    // Validate request body
    const result = await validateRequest(req, generateVerificationSchema)
    
    if (!result.success) {
      return apiError({
        message: 'Invalid request data',
        errors: result.errors,
        status: 422
      })
    }
    
    const { document, workflowId, messageId, summaryId = createId() } = result.data
    
    // Generate verification
    const extractionResult = await extractPatientSummary(document, {
      workflowId,
      messageId,
      summaryId
    })
    
    // Return success response
    return apiSuccess({
      summaryId: extractionResult.summaryId || summaryId,
      summary: extractionResult.summary,
      structuredData: extractionResult.structuredData
    })
  } catch (error) {
    console.error('Error generating verification:', error)
    
    return apiError({
      message: error instanceof ApplicationError 
        ? error.message
        : 'Failed to generate verification',
      status: error instanceof ApplicationError ? error.statusCode : 500
    })
  }
}