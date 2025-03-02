/**
 * API route for processing a correction to verified content
 */
import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'
import { z } from 'zod'
import { validateRequest } from '@/lib/api/validation'
import { ApplicationError } from '@/lib/errors'
import { processPatientSummaryCorrection } from '@/lib/langchain/patient-summary'

// Request validation schema
const processCorrectionSchema = z.object({
  correction: z.string().min(1, 'Correction text is required'),
  currentSummary: z.string().min(1, 'Current summary is required'),
  workflowId: z.string().optional(),
  messageId: z.string().optional(),
})

/**
 * POST handler for processing a correction to verified content
 */
export async function POST(req: NextRequest) {
  try {
    // Validate request body
    const result = await validateRequest(req, processCorrectionSchema)
    
    if (!result.success) {
      return apiError({
        message: 'Invalid request data',
        errors: result.errors,
        status: 422
      })
    }
    
    const { correction, currentSummary, workflowId, messageId } = result.data
    
    // Process the correction
    const correctionResult = await processPatientSummaryCorrection(
      correction,
      currentSummary,
      {
        workflowId,
        messageId,
        isInternal: true
      }
    )
    
    // Return success response
    return apiSuccess({
      summaryId: correctionResult.summaryId,
      summary: correctionResult.summary,
      structuredData: correctionResult.structuredData,
      correctionCount: correctionResult.correctionCount || 1
    })
  } catch (error) {
    console.error('Error processing correction:', error)
    
    return apiError({
      message: error instanceof ApplicationError 
        ? error.message
        : 'Failed to process correction',
      status: error instanceof ApplicationError ? error.statusCode : 500
    })
  }
}