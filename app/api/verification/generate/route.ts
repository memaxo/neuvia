/**
 * API route for generating verification for a document
 */
import type { NextRequest } from 'next/server'
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
    const correlationId = generateCorrelationId()
    try {
      // Pull relevant fields from data
      const { 
        document, 
        workflowId, 
        messageId, 
        summaryId = createId(),
        title,
        patientId,
        documentId,
        items,
        options,
      } = data

      // Move main logic to service layer
      const result = await verificationService.generateVerification({
        document,
        workflowId,
        messageId,
        summaryId,
        options: {
          title,
          ...options,
        },
      })

      // If needed, adapt result to the final output shape
      // The service call returns { success, data, ... }
      if (!result.success) {
        throw new VerificationError({
          message: result.error?.message || 'Failed to generate verification',
          data: { ...result.error?.details, correlationId },
        })
      }

      // If success, build the final JSON response
      return apiSuccess({
        summaryId: result.data.summaryId,
        summary: result.data.summary,
        structuredData: result.data.structuredData,
        documentId,
        patientId,
      })
    } catch (error) {
      const errInfo = handleVerificationRouteError(error, correlationId, 'Failed to generate verification')
      return apiError({
        message: errInfo.message,
        code: errInfo.code,
        errors: errInfo.details,
        status: errInfo.status,
      })
    }
  })
}