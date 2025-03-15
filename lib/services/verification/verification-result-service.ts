import logger from '@/lib/logger'
import { normalizeError, ValidationError } from '@/lib/errors'
import { verificationAdapter } from '@/lib/api/adapters/verification-adapter'
import {
  VerificationStatus,
  type VerificationResult,
  type VerificationServiceResult,
  type CompleteVerificationOptions,
} from '@/lib/types/verification'
import { verificationStatusMapper } from '@/lib/types/verification-mapper'

/**
 * VerificationResultService
 * Handles final verification steps, result retrieval, and patient summary verification.
 */
export class VerificationResultService {
  /**
   * Generate a unique ID
   * @returns A unique ID for the verification
   */
  private generateId(): string {
    return crypto.randomUUID();
  }
  
  /**
   * Prepare completion metadata for workflow processing
   * This method extracts the domain logic from the workflow file
   * 
   * @param options The completion options
   * @returns Processed completion metadata with timestamps and status
   */
  async prepareCompletionMetadata(options: {
    workflowId: string;
    verificationId: string;
    userId: string;
    autoGenerateReport: boolean;
    isApproved: boolean;
  }): Promise<Record<string, any>> {
    const moduleLogger = logger.withMetadata({
      module: 'VerificationResultService',
      method: 'prepareCompletionMetadata',
      workflowId: options.workflowId,
      verificationId: options.verificationId
    });
    
    try {
      // Build completion metadata
      const completionTime = new Date().toISOString();
      
      const metadata = {
        status: options.isApproved ? VerificationStatus.completed : VerificationStatus.failed,
        completedAt: completionTime,
        completedBy: options.userId,
        autoGenerateReport: options.autoGenerateReport,
        verification_status: options.isApproved 
          ? VerificationStatus.completed 
          : VerificationStatus.failed,
        lastUpdated: completionTime
      };
      
      moduleLogger.info('Completion metadata prepared for workflow', {
        workflowId: options.workflowId,
        verificationId: options.verificationId,
        isApproved: options.isApproved
      });
      
      return metadata;
    } catch (error) {
      moduleLogger.error('Failed to prepare completion metadata', {
        error: normalizeError(error)
      });
      
      // Provide fallback data in case of error
      return {
        status: options.isApproved ? VerificationStatus.completed : VerificationStatus.failed,
        completedAt: new Date().toISOString(),
        completedBy: options.userId,
        lastUpdated: new Date().toISOString()
      };
    }
  }
  
  /**
   * Prepare rejection metadata for workflow processing
   * This method extracts the domain logic from the workflow file
   * 
   * @param options The rejection options
   * @returns Processed rejection metadata with timestamps and status
   */
  async prepareRejectionMetadata(options: {
    workflowId: string;
    verificationId: string;
    userId: string;
    reason: string;
  }): Promise<Record<string, any>> {
    const moduleLogger = logger.withMetadata({
      module: 'VerificationResultService',
      method: 'prepareRejectionMetadata',
      workflowId: options.workflowId,
      verificationId: options.verificationId
    });
    
    try {
      // Build rejection metadata
      const rejectionTime = new Date().toISOString();
      
      const metadata = {
        status: VerificationStatus.failed,
        rejectedAt: rejectionTime,
        rejectedBy: options.userId,
        rejectionReason: options.reason,
        verification_status: VerificationStatus.failed,
        lastUpdated: rejectionTime
      };
      
      moduleLogger.info('Rejection metadata prepared for workflow', {
        workflowId: options.workflowId,
        verificationId: options.verificationId,
        reason: options.reason
      });
      
      return metadata;
    } catch (error) {
      moduleLogger.error('Failed to prepare rejection metadata', {
        error: normalizeError(error)
      });
      
      // Provide fallback data in case of error
      return {
        status: VerificationStatus.failed,
        rejectedAt: new Date().toISOString(),
        rejectedBy: options.userId,
        rejectionReason: options.reason,
        lastUpdated: new Date().toISOString()
      };
    }
  }
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

      const status = options.isApproved ? VerificationStatus.completed : VerificationStatus.failed

      const updateResult = await verificationAdapter.updatePatientSummaryVerification(
        options.workflowId,
        {
          status: verificationStatusMapper.toDatabase(status),
          items: options.items ?? [],
          comments: options.comments ?? '',
        }
      )

      if (!updateResult.success) {
        throw new VerificationError({
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
            verificationStatus: VerificationStatus.failed,
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
      verificationStatus: VerificationStatus
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
      const result = await verificationAdapter.getPatientSummaryVerification(patientId)

      if (!result.success) {
        throw new VerificationError({
          message: 'Failed to retrieve patient summary verification',
          code: 'PATIENT_SUMMARY_VERIFICATION_FAILED',
          data: { originalResult: result },
        })
      }

      moduleLogger.info('Patient summary verification retrieved')

      // If the server returns "verified"/"rejected"/"pending"/"in_progress",
      // map those to the DB workflow step using verificationStatusToDb, then to domain status:
      const mappedDbStatus = (() => {
        switch (result.data.verificationStatus) {
          case 'verified':
            return verificationStatusToDb(VerificationStatus.completed)
          case 'rejected':
            return verificationStatusToDb(VerificationStatus.failed)
          case 'in_progress':
            return verificationStatusToDb(VerificationStatus.inProgress)
          case 'pending':
          default:
            return verificationStatusToDb(VerificationStatus.pending)
        }
      })()

      return {
        success: true,
        data: {
          verificationStatus: verificationStatusMapper.toDomain(mappedDbStatus),
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
          verificationStatus: VerificationStatus.pending,
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
      status: VerificationStatus
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

      // Convert domain → server. If the server expects strings like 'verified', 'rejected', 'in_progress', 'pending', do it here:
      const serverStatus = (() => {
        switch (data.status) {
          case VerificationStatus.completed:
            return 'verified'
          case VerificationStatus.failed:
            return 'rejected'
          case VerificationStatus.inProgress:
            return 'in_progress'
          case VerificationStatus.pending:
          default:
            return 'pending'
        }
      })()

      const result = await verificationAdapter.updatePatientSummaryVerification(
        patientId,
        {
          status: serverStatus,
          comments: data.comments,
          items: data.items,
        }
      )

      if (!result.success) {
        throw new VerificationError({
          message: 'Failed to update patient summary verification',
          code: 'PATIENT_SUMMARY_VERIFICATION_UPDATE_FAILED',
          data: { originalResult: result },
        })
      }

      moduleLogger.info('Patient summary verification updated successfully')

      // Convert server → domain in the returned data
      const mappedDbStatus = (() => {
        switch (result.data.verificationStatus) {
          case 'verified':
            return 'verification_completed'
          case 'rejected':
            return 'verification_failed'
          case 'in_progress':
            return 'verification_in_progress'
          case 'pending':
          default:
            return 'verification_pending'
        }
      })()

      return {
        success: true,
        data: {
          ...result.data,
          verificationStatus: dbToVerificationStatus(mappedDbStatus),
        },
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
            verificationStatus: VerificationStatus.failed,
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