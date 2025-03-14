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
  async processCorrection(options: ProcessCorrectionOptions): Promise
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

      // Try workflow engine approach first
      try {
        // Import verification workflow to avoid circular dependencies
        const { verificationWorkflow } = await import('@/lib/services/workflow/domain/verification-workflow');
        
        // Get verification ID from workflow state
        const { workflowEngine } = await import('@/lib/services/workflow/coordination/workflow-engine');
        const workflowResult = await workflowEngine.getWorkflow(options.workflowId as string);
        
        if (workflowResult.isSuccess()) {
          const verificationId = workflowResult.value.context.verificationId;
          
          // Process the correction using workflow engine
          const correctionResult = await verificationWorkflow.processCorrection(
            options.workflowId as string,
            verificationId,
            {
              userId: 'system', // System user as default
              correctedFields: {
                summary: options.currentSummary,
                correction: options.correction
              },
              userComments: options.correction
            }
          );
          
          if (correctionResult.isSuccess()) {
            moduleLogger.info('Correction processed successfully via workflow engine', {
              summaryId: correctionResult.value.summaryId,
              verificationId
            });
            
            return {
              success: true,
              data: {
                summaryId: correctionResult.value.summaryId || '',
                summary: correctionResult.value.data?.currentSummary || options.currentSummary,
                structuredData: correctionResult.value.data?.structuredData,
                correctionCount: correctionResult.value.data?.correctionCount
              },
              timestamp: new Date().toISOString(),
            };
          }
        }
        
        // Fall back to API client if workflow engine approach fails
        moduleLogger.info('Falling back to API client for correction processing', {
          workflowId: options.workflowId,
          reason: 'Workflow engine approach failed'
        });
      } catch (engineError) {
        moduleLogger.warn('Error using workflow engine for correction', {
          error: engineError instanceof Error ? engineError.message : String(engineError),
          workflowId: options.workflowId
        });
      }

      // Call the API through the client (fallback approach)
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

      moduleLogger.info('Correction processed successfully via API client', {
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