import { apiClient } from '@/lib/api/client/api-client'
import logger from '@/lib/logger'
import { normalizeError, ValidationError } from '@/lib/errors'
import type {
  VerificationServiceResult,
  SubmitCorrectionOptions,
  ProcessCorrectionOptions
} from '@/lib/types/verification'

/**
 * CorrectionService
 * Handles user corrections for verified content (submitting and processing).
 */
export class CorrectionService {
  /**
   * Submit a correction to the verification process.
   *
   * This used to call processCorrection internally, but we'll keep them separate.
   */
  async submitCorrection(options: SubmitCorrectionOptions): Promise<
    VerificationServiceResult<{
      summaryId: string
      summary: string
      structuredData?: Record<string, any>
      correctionCount?: number
    }>
  > {
    const moduleLogger = logger.withMetadata({
      module: 'CorrectionService',
      method: 'submitCorrection',
      workflowId: options.workflowId,
      messageId: options.messageId,
    })

    try {
      moduleLogger.info('Submitting correction', { workflowId: options.workflowId })

      // Call the API through the client
      const result = await apiClient.verification.submitCorrection({
        correction: options.correction,
        currentSummary: options.currentSummary,
        workflowId: options.workflowId,
        messageId: options.messageId,
      })

      // Handle the API response
      if (!result.success || !result.data?.summaryId) {
        throw new CorrectionError({
          message: 'Failed to submit correction',
          code: 'CORRECTION_SUBMISSION_FAILED',
          data: { originalResult: result },
        })
      }

      moduleLogger.info('Correction submitted successfully', {
        summaryId: result.data.summaryId,
      })

      return {
        success: true,
        data: {
          summaryId: result.data.summaryId,
          summary: result.data.summary,
          structuredData: result.data.structuredData,
          correctionCount: result.data.correctionCount,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      const normalizedError = normalizeError(error)
      moduleLogger.error('Failed to submit correction', {}, normalizedError)
      return {
        success: false,
        data: {
          summaryId: '',
          summary: '',
        },
        error: {
          message: normalizedError.message || 'Failed to submit correction',
          code: normalizedError.code || 'CORRECTION_SUBMISSION_FAILED',
          details: normalizedError.data || {},
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Process a correction to update the patient summary.
   */
  async processCorrection(options: ProcessCorrectionOptions): Promise<
    VerificationServiceResult<{
      summaryId: string
      summary: string
      structuredData?: Record<string, any>
      correctionCount?: number
    }>
  > {
    const moduleLogger = logger.withMetadata({
      module: 'CorrectionService',
      method: 'processCorrection',
      workflowId: options.workflowId,
      messageId: options.messageId,
    })

    try {
      moduleLogger.info('Processing correction', { workflowId: options.workflowId })

      // Call the API through the client
      const result = await apiClient.verification.processCorrection({
        correction: options.correction,
        currentSummary: options.currentSummary,
        workflowId: options.workflowId,
        messageId: options.messageId,
      })

      // Handle the API response
      if (!result.success || !result.data?.summaryId) {
        throw new CorrectionError({
          message: 'Failed to process correction',
          code: 'CORRECTION_PROCESSING_FAILED',
          data: { originalResult: result },
        })
      }

      moduleLogger.info('Correction processed successfully', {
        summaryId: result.data.summaryId,
      })

      return {
        success: true,
        data: {
          summaryId: result.data.summaryId,
          summary: result.data.summary,
          structuredData: result.data.structuredData,
          correctionCount: result.data.correctionCount,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      const normalized = normalizeError(error)
      moduleLogger.error('Failed to process correction', {}, normalized)
      return {
        success: false,
        data: { summaryId: '', summary: '' },
        error: {
          message: normalized.message ?? 'Correction processing failed',
          code: normalized.code ?? 'CORRECTION_FAILED',
          details: normalized.data,
        },
        timestamp: new Date().toISOString(),
      }
    }
  }
}

export const correctionService = new CorrectionService()