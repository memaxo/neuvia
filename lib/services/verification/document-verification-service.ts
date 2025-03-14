import logger from '@/lib/logger'
import { normalizeError, ValidationError, ApplicationError } from '@/lib/errors'
import type { VerificationServiceResult, GenerateVerificationOptions } from '@/lib/types/verification'
import { verificationAdapter } from '@/lib/api/adapters/verification-adapter'
import { DOCUMENT_ERROR_CODES, WORKFLOW_ERROR_CODES } from '@/lib/errors/error-codes'

// Define VerificationError class
class VerificationError extends ApplicationError {
  constructor(options: {
    message: string
    code?: string
    data?: Record<string, unknown>
    cause?: unknown
  }) {
    super({ ...options, isOperational: true })
    this.name = 'VerificationError'
  }
}

/**
 * DocumentVerificationService
 * Handles document-specific verification operations (e.g., generating verification,
 * retrieving document verification status, etc.).
 */
export class DocumentVerificationService {
  /**
   * Generate verification for a document.
   *
   * Now uses the workflow engine with fallback to API client.
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

      // Try workflow engine approach first
      try {
        // Import verification workflow to avoid circular dependencies
        const { verificationWorkflow } = await import('@/lib/services/workflow/domain/verification-workflow');
        
        // Check if we have a workflowId
        if (options.workflowId) {
          // Get or create userId from document metadata
          const userId = (options.document.userId as string) ||
                         (options.document.createdBy as string) ||
                         'system';
          
          // Process using workflow engine
          const result = await verificationWorkflow.initiateVerification(
            options.workflowId,
            {
              userId,
              documentId: (options.document.id as string) || options.document.documentId as string,
              documentData: options.document,
              autoGenerateReport: false
            }
          );
          
          if (result.isSuccess()) {
            moduleLogger.info('Verification generated successfully via workflow engine', {
              summaryId: result.value.summaryId,
              verificationId: result.value.verificationId
            });
            
            return {
              success: true,
              data: {
                summaryId: result.value.summaryId || options.summaryId || '',
                summary: result.value.data?.currentSummary ||
                         (options.document.text as string) ||
                         JSON.stringify(options.document),
                structuredData: result.value.data?.structuredData || options.document,
              },
              timestamp: new Date().toISOString(),
            };
          }
          
          // Log failure but continue to API client approach
          moduleLogger.warn('Workflow engine verification failed, using API client', {
            workflowId: options.workflowId,
            error: result.error.message
          });
        }
      } catch (engineError) {
        moduleLogger.warn('Error using workflow engine for verification', {
          error: engineError instanceof Error ? engineError.message : String(engineError),
          workflowId: options.workflowId
        });
      }

      // Call the API through the adapter (fallback approach)
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
          code: WORKFLOW_ERROR_CODES.VALIDATION_FAILED,
          data: { originalResult: result },
        })
      }

      moduleLogger.info('Verification generated successfully via API client', {
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
          code: normalized.code ?? WORKFLOW_ERROR_CODES.VALIDATION_FAILED,
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
          code: DOCUMENT_ERROR_CODES.PROCESSING_ERROR,
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