import logger from '@/lib/logger'
import { normalizeError, ValidationError } from '@/lib/errors'
import { apiClient } from '@/lib/api/client/api-client'
import type {
  VerificationResult,
  VerificationServiceResult,
  CompleteVerificationOptions,
} from '@/lib/types/verification'

/**
 * VerificationResultService
 * Handles final verification steps, result retrieval, and patient summary verification.
 */
export class VerificationResultService {
  /**
   * Complete the verification process.
   */
  async completeVerification(options: CompleteVerificationOptions): Promise<VerificationServiceResult<VerificationResult>> {
    const moduleLogger = logger.withMetadata({
      module: 'VerificationResultService',
      method: 'completeVerification',
      workflowId: options.workflowId,
    })

    try {
      moduleLogger.info('Completing verification', { isApproved: options.isApproved })

      // (This was local code previously. Now we rely on a direct server approach or a new endpoint
      // If there's no direct endpoint, we can keep it local. For demonstration, we do local logic
      // or a pseudo client call. For now, let's mimic an API call to "updatePatientSummaryVerification" if approved.)

      // If we do not have a separate endpoint for completeVerification, we approximate:
      // For example, if isApproved => status=verified else => status=rejected
      const updateResult = await apiClient.verification.updatePatientSummaryVerification(
        options.workflowId, // treat workflowId as patientId for example
        {
          status: options.isApproved ? 'verified' : 'rejected',
          items: options.items ?? [],
          comments: options.comments ?? '',
        }
      )

      if (!updateResult.success) {
        throw new ValidationError({
          message: 'Failed to complete verification via patient summary update',
          code: 'VERIFICATION_COMPLETION_FAILED',
          data: { originalResult: updateResult },
        })
      }

      moduleLogger.info('Verification completed')

      return {
        success: true,
        data: updateResult.data as VerificationResult,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      const normalized = normalizeError(error)
      moduleLogger.error('Failed to complete verification', {}, normalized)
      return {
        success: false,
        error: {
          message: normalized.message || 'Failed to complete verification',
          code: normalized.code || 'VERIFICATION_COMPLETION_FAILED',
          details: normalized.data || {},
        },
        timestamp: new Date().toISOString(),
        data: {
          isCompleted: true,
          isApproved: false,
          items: [],
          completedAt: new Date().toISOString(),
          verificationMetadata: {
            verificationStatus: 'failed',
            originalSummaryId: '',
            currentVersionId: '',
            correctionCount: 0,
            corrections: [],
            lastUpdated: new Date().toISOString(),
          },
        },
      }
    }
  }

  /**
   * Get patient summary verification status
   */
  async getPatientSummaryVerification(patientId: string): Promise<
    VerificationServiceResult<{
      verificationStatus: string
      items: any[]
      metadata?: any
      originalContent?: string
      currentContent?: string
    }>
  > {
    const moduleLogger = logger.withMetadata({
      module: 'VerificationResultService',
      method: 'getPatientSummaryVerification',
      patientId,
    })

    try {
      moduleLogger.info('Retrieving patient summary verification')

      // Call the API
      const result = await apiClient.verification.getPatientSummaryVerification(patientId)

      if (!result.success) {
        throw new ValidationError({
          message: 'Failed to retrieve patient summary verification',
          code: 'PATIENT_SUMMARY_VERIFICATION_FAILED',
          data: { originalResult: result },
        })
      }

      moduleLogger.info('Patient summary verification retrieved')

      return {
        success: true,
        data: {
          verificationStatus: result.data.verificationStatus,
          items: result.data.items,
          metadata: result.data.metadata,
          originalContent: result.data.originalContent,
          currentContent: result.data.currentContent,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      const normalized = normalizeError(error)
      moduleLogger.error('Failed to get patient summary verification', {}, normalized)
      return {
        success: false,
        data: {
          verificationStatus: 'pending',
          items: [],
        },
        error: {
          message: normalized.message,
          code: normalized.code || 'PATIENT_SUMMARY_VERIFICATION_ERROR',
          details: normalized.data,
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Update patient summary verification
   */
  async updatePatientSummaryVerification(
    patientId: string,
    data: {
      status: 'pending' | 'verified' | 'rejected'
      comments?: string
      items?: any[]
    }
  ): Promise<VerificationServiceResult<VerificationResult>> {
    const moduleLogger = logger.withMetadata({
      module: 'VerificationResultService',
      method: 'updatePatientSummaryVerification',
      patientId,
      status: data.status,
    })

    try {
      moduleLogger.info('Updating patient summary verification')

      // API call
      const result = await apiClient.verification.updatePatientSummaryVerification(
        patientId,
        data
      )

      if (!result.success) {
        throw new ValidationError({
          message: 'Failed to update patient summary verification',
          code: 'PATIENT_SUMMARY_VERIFICATION_UPDATE_FAILED',
          data: { originalResult: result },
        })
      }

      moduleLogger.info('Patient summary verification updated successfully')

      return {
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      const normalized = normalizeError(error)
      moduleLogger.error('Error updating patient summary verification', {}, normalized)
      return {
        success: false,
        data: {
          isCompleted: false,
          isApproved: false,
          items: [],
          completedAt: new Date().toISOString(),
          verificationMetadata: {
            verificationStatus: 'failed',
            originalSummaryId: '',
            currentVersionId: '',
            correctionCount: 0,
            corrections: [],
            lastUpdated: new Date().toISOString(),
          },
        },
        error: {
          message: normalized.message,
          code: normalized.code || 'PATIENT_SUMMARY_VERIFICATION_UPDATE_ERROR',
          details: normalized.data,
        },
        timestamp: new Date().toISOString(),
      }
    }
  }
}

export const verificationResultService = new VerificationResultService()