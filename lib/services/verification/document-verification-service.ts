import logger from '@/lib/logger'
import { normalizeError, ValidationError } from '@/lib/errors'
import type { VerificationServiceResult, GenerateVerificationOptions } from '@/lib/types/verification'
import { verificationAdapter } from '@/lib/api/adapters/verification-adapter'

/**
 * DocumentVerificationService
 * Handles document-specific verification operations (e.g., generating verification,
 * retrieving document verification status, etc.).
 */
export class DocumentVerificationService {
  /**
   * Generate verification for a document.
   *
   * This method now relies only on the API client approach
   * (removing the server-side fallback and UI references).
   */
  async generateVerification(
    options: GenerateVerificationOptions
  ): Promise<VerificationServiceResult<{
    summaryId: string
    summary: string
    structuredData?: Record<string, any>
  }>> {
    const moduleLogger = logger.withMetadata({
      module: 'DocumentVerificationService',
      method: 'generateVerification',
      workflowId: options.workflowId,
      messageId: options.messageId,
    })

    try {
      moduleLogger.info('Generating verification for document', { workflowId: options.workflowId })

      // Call the API through the adapter
      const result = await verificationAdapter.generateVerificationRequest({
        document: options.document,
        workflowId: options.workflowId || '',
        messageId: options.messageId,
        summaryId: options.summaryId,
      })

      // Handle the API response
      if (!result.success || !result.data?.summaryId) {
        throw new VerificationError({
          message: 'Failed to generate verification',
          code: 'VERIFICATION_GENERATION_FAILED',
          data: { originalResult: result },
        })
      }

      moduleLogger.info('Verification generated successfully', {
        summaryId: result.data.summaryId,
      })

      return {
        success: true,
        data: {
          summaryId: result.data.summaryId,
          summary: result.data.summary,
          structuredData: result.data.structuredData,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      const normalized = normalizeError(error)
      moduleLogger.error('Failed to generate verification', {}, normalized)
      return {
        success: false,
        data: { summaryId: '', summary: '' },
        error: {
          message: normalized.message ?? 'Verification generation failed',
          code: normalized.code ?? 'VERIFICATION_FAILED',
          details: normalized.data,
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get the verification status of a document by ID.
   */
  async getDocumentVerification(extractedDocumentId: string): Promise<VerificationServiceResult<any>> {
    const moduleLogger = logger.withMetadata({
      module: 'DocumentVerificationService',
      method: 'getDocumentVerification',
      extractedDocumentId,
    })

    try {
      moduleLogger.info('Fetching document verification status', { extractedDocumentId })

      const result = await verificationAdapter.getDocumentVerification(extractedDocumentId)

      if (!result.success) {
        throw new ValidationError({
          message: 'Failed to retrieve document verification status',
          code: 'DOCUMENT_VERIFICATION_FAILED',
          data: { originalResult: result },
        })
      }

      moduleLogger.info('Document verification status retrieved', {
        extractedDocumentId,
      })

      return {
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      const normalized = normalizeError(error)
      moduleLogger.error('Failed to get document verification', {}, normalized)
      return {
        success: false,
        data: {},
        error: {
          message: normalized.message ?? 'Document verification retrieval failed',
          code: normalized.code ?? 'DOCUMENT_VERIFICATION_ERROR',
          details: normalized.data,
        },
        timestamp: new Date().toISOString(),
      }
    }
  }
}

export const documentVerificationService = new DocumentVerificationService()