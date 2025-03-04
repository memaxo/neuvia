/**
 * API route for submitting a correction to verified content
 */
import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'
import { withZodValidation } from '@/lib/api/middleware/zod-validation'
import { CorrectionSubmissionSchema } from '@/lib/schemas/verification'
import { ApplicationError, ValidationError } from '@/lib/errors'
import { processPatientSummaryCorrection } from '@/lib/langchain/patient-summary'
import { isVerificationResult } from '@/lib/types/verification'

/**
 * POST handler for submitting a correction to verified content
 */
export async function POST(req: NextRequest) {
  return withZodValidation(CorrectionSubmissionSchema)(req, async (data) => {
    try {
      const { verificationId, items } = data
      
      // Get the current summary from the first item for backwards compatibility
      // (This adapts our new schema to work with the existing processing logic)
      const correction = items.map(item => `${item.id}: ${item.correction}`).join('\n')
      
      // Find current summary for this verification
      // This is a simplification - in a real implementation we'd fetch this from the database
      const currentSummary = "Current patient summary text from database"
      
      // Process the correction
      const correctionResult = await processPatientSummaryCorrection(
        correction,
        currentSummary,
        {
          workflowId: verificationId,
          messageId: items[0].id
        }
      )
      
      // Validate result with type guard
      if (correctionResult.summary && 
          typeof correctionResult.structuredData === 'object') {
        
        // Build verification result in our standardized format
        const verificationResult = {
          isVerified: true,
          items: items.map(item => ({
            id: item.id,
            title: `Item ${item.id}`,
            content: item.correction,
            status: 'verified' as const,
            correction: item.correction,
            reason: item.reason
          })),
          metadata: {
            verificationStatus: 'verified' as const,
            correctionCount: correctionResult.correctionCount || 1,
            documentId: correctionResult.documentId,
            patientId: correctionResult.patientId
          }
        }
        
        // Validate with type guard before returning
        if (!isVerificationResult(verificationResult)) {
          console.warn('Invalid verification result format', verificationResult)
        }
      }
      
      // Return success response
      return apiSuccess({
        summaryId: correctionResult.summaryId,
        summary: correctionResult.summary,
        structuredData: correctionResult.structuredData,
        correctionCount: correctionResult.correctionCount || 1
      })
    } catch (error) {
      console.error('Error processing correction:', error)
      
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
          : 'Failed to process correction',
        status: error instanceof ApplicationError ? error.statusCode : 500
      })
    }
  })
}