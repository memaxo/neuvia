/**
 * API route for processing a correction to verified content
 */
import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'
import { withZodValidation } from '@/lib/api/middleware/zod-validation'
import { CorrectionSubmissionSchema } from '@/lib/schemas/verification'
import { ApplicationError, ValidationError } from '@/lib/errors'
import { processPatientSummaryCorrection } from '@/lib/langchain/patient-summary'
import { isVerificationResult } from '@/lib/types/verification'

/**
 * POST handler for processing a correction to verified content
 */
export async function POST(req: NextRequest) {
  return withZodValidation(CorrectionSubmissionSchema)(req, async (data) => {
    const correlationId = generateCorrelationId()
    try {
      const { verificationId, items } = data

      // Combine correction text from items
      const correction = items.map((item) => `${item.id}: ${item.correction}`).join('\n')

      // Let service handle the logic
      const result = await verificationService.processCorrection({
        correction,
        currentSummary: 'Current patient summary text from database',
        workflowId: verificationId,
        messageId: items[0].id,
        onStatusUpdate: () => {/* could do something if needed */},
      })

      if (!result.success) {
        throw new CorrectionError({
          message: result.error?.message || 'Failed to process correction',
          data: { ...result.error?.details, correlationId },
        })
      }

      // Return success response
      return apiSuccess({
        summaryId: result.data.summaryId,
        summary: result.data.summary,
        structuredData: result.data.structuredData,
        correctionCount: result.data.correctionCount || 1,
        isInternal: true,
      })
    } catch (error) {
      const errInfo = handleVerificationRouteError(error, correlationId, 'Failed to process correction')
      return apiError({
        message: errInfo.message,
        code: errInfo.code,
        errors: errInfo.details,
        status: errInfo.status,
      })
    }
  })
}