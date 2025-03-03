import { apiClient } from '@/lib/api/client/api-client'
import { createBrowserClient } from '@/lib/supabase/clients'
import { workflowStateManager } from '@/lib/services/workflow/workflow-state-manager'
import logger from '@/lib/logger'
import { 
  ValidationError, 
  SystemError, 
  ExternalServiceError, 
  normalizeError 
} from '@/lib/errors'

// Import verification types
import type {
  VerificationItem,
  VerificationOptions,
  VerificationResult,
  VerificationMetadata,
  VerificationStatusType,
  createVerificationItem,
  createVerificationMessageMetadata,
  createCorrectionMessageMetadata,
  addCorrection,
  updateVerificationStatus,
  generateChangeSummary
} from '@/lib/processing/types/verification'

// Re-export helper functions for convenience
export {
  createVerificationItem,
  createVerificationMessageMetadata,
  createCorrectionMessageMetadata,
  addCorrection,
  updateVerificationStatus,
  generateChangeSummary
}

/**
 * Options for generating verification
 */
export interface GenerateVerificationOptions {
  /**
   * The document to be verified
   */
  document: Record<string, any>

  /**
   * The workflow ID for this verification
   */
  workflowId?: string

  /**
   * Optional ID of message associated with this verification
   */
  messageId?: string

  /**
   * Optional ID for the generated summary
   */
  summaryId?: string

  /**
   * Optional verification options
   */
  options?: VerificationOptions

  /**
   * Optional callback for status updates
   */
  onStatusUpdate?: (status: { progress: number; phase: string }) => void
}

/**
 * Options for submitting a correction
 */
export interface SubmitCorrectionOptions {
  /**
   * The correction text provided by the user
   */
  correction: string

  /**
   * The current summary content being corrected
   */
  currentSummary: string

  /**
   * The workflow ID associated with this correction
   */
  workflowId?: string

  /**
   * Optional ID of the message associated with this correction
   */
  messageId?: string

  /**
   * Optional callback for status updates
   */
  onStatusUpdate?: (status: { progress: number; phase: string }) => void
}

/**
 * Result returned from a verification operation
 */
export interface VerificationServiceResult<T> {
  /**
   * Whether the operation was successful
   */
  success: boolean

  /**
   * Data returned from the operation
   */
  data: T

  /**
   * Optional error information if the operation failed
   */
  error?: {
    message: string
    code: string
    details?: Record<string, any>
  }

  /**
   * Timestamp of the operation
   */
  timestamp: string
}

/**
 * Verification Service Implementation
 *
 * Centralized service for verification operations, providing an abstraction
 * layer between UI components and the API/database.
 */
export class VerificationService {
  private supabase = createBrowserClient()

  /**
   * Generate verification for a document
   * 
   * @param options Options for generating verification
   * @returns Generated verification with summary
   */
  async generateVerification(
    options: GenerateVerificationOptions
  ): Promise<VerificationServiceResult<{
    summaryId: string
    summary: string
    structuredData?: Record<string, any>
  }>> {
    try {
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'generateVerification',
        workflowId: options.workflowId,
        messageId: options.messageId
      })

      moduleLogger.info('Generating verification')

      // Call the API through the client
      const result = await apiClient.verification.generateVerification({
        document: options.document,
        workflowId: options.workflowId || '',
        messageId: options.messageId,
        summaryId: options.summaryId
      })

      // Handle the API response
      if (!result.success || !result.data?.summaryId) {
        throw new ValidationError({
          message: 'Failed to generate verification',
          code: 'VERIFICATION_GENERATION_FAILED',
          data: { originalResult: result }
        })
      }

      moduleLogger.info('Verification generated successfully', {
        summaryId: result.data.summaryId
      })

      // Return standardized result
      return {
        success: true,
        data: {
          summaryId: result.data.summaryId,
          summary: result.data.summary,
          structuredData: result.data.structuredData
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      // Normalize and log the error
      const normalizedError = normalizeError(error)
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'generateVerification',
        workflowId: options.workflowId,
        messageId: options.messageId,
        errorCode: normalizedError.code
      })

      moduleLogger.error('Error generating verification', {}, normalizedError)

      // Determine if this is an external API error or internal error
      const isApiError = normalizedError.origin === 'external'
      
      return {
        success: false,
        data: { summaryId: '', summary: '' },
        error: {
          message: normalizedError.message,
          code: normalizedError.code || 'VERIFICATION_GENERATION_ERROR',
          details: normalizedError.data
        },
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Submit a correction to verified content
   * 
   * @param options Options for submitting a correction
   * @returns Updated summary with correction applied
   */
  async submitCorrection(
    options: SubmitCorrectionOptions
  ): Promise<VerificationServiceResult<{
    summaryId: string
    summary: string
    structuredData?: Record<string, any>
    correctionCount?: number
  }>> {
    try {
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'submitCorrection',
        workflowId: options.workflowId,
        messageId: options.messageId
      })

      moduleLogger.info('Submitting correction')

      // Call the API through the client
      const result = await apiClient.verification.submitCorrection({
        correction: options.correction,
        currentSummary: options.currentSummary,
        workflowId: options.workflowId,
        messageId: options.messageId
      })

      // Handle the API response
      if (!result.success || !result.data?.summaryId) {
        throw new ValidationError({
          message: 'Failed to submit correction',
          code: 'CORRECTION_SUBMISSION_FAILED',
          data: { originalResult: result }
        })
      }

      moduleLogger.info('Correction submitted successfully', {
        summaryId: result.data.summaryId,
        correctionCount: result.data.correctionCount
      })

      // Return standardized result
      return {
        success: true,
        data: {
          summaryId: result.data.summaryId,
          summary: result.data.summary,
          structuredData: result.data.structuredData,
          correctionCount: result.data.correctionCount
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      // Normalize and log the error
      const normalizedError = normalizeError(error)
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'submitCorrection',
        workflowId: options.workflowId,
        messageId: options.messageId,
        errorCode: normalizedError.code
      })

      moduleLogger.error('Error submitting correction', {}, normalizedError)
      
      return {
        success: false,
        data: { summaryId: '', summary: '' },
        error: {
          message: normalizedError.message,
          code: normalizedError.code || 'CORRECTION_SUBMISSION_ERROR',
          details: normalizedError.data
        },
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Process a correction to verified content
   * 
   * @param options Options for processing a correction
   * @returns Updated summary with correction applied
   */
  async processCorrection(
    options: SubmitCorrectionOptions
  ): Promise<VerificationServiceResult<{
    summaryId: string
    summary: string
    structuredData?: Record<string, any>
    correctionCount?: number
  }>> {
    try {
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'processCorrection',
        workflowId: options.workflowId,
        messageId: options.messageId
      })

      moduleLogger.info('Processing correction')

      // Call the API through the client
      const result = await apiClient.verification.processCorrection({
        correction: options.correction,
        currentSummary: options.currentSummary,
        workflowId: options.workflowId,
        messageId: options.messageId
      })

      // Handle the API response
      if (!result.success || !result.data?.summaryId) {
        throw new ValidationError({
          message: 'Failed to process correction',
          code: 'CORRECTION_PROCESSING_FAILED',
          data: { originalResult: result }
        })
      }

      moduleLogger.info('Correction processed successfully', {
        summaryId: result.data.summaryId,
        correctionCount: result.data.correctionCount
      })

      // Return standardized result
      return {
        success: true,
        data: {
          summaryId: result.data.summaryId,
          summary: result.data.summary,
          structuredData: result.data.structuredData,
          correctionCount: result.data.correctionCount
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      // Normalize and log the error
      const normalizedError = normalizeError(error)
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'processCorrection',
        workflowId: options.workflowId,
        messageId: options.messageId,
        errorCode: normalizedError.code
      })

      moduleLogger.error('Error processing correction', {}, normalizedError)
      
      return {
        success: false,
        data: { summaryId: '', summary: '' },
        error: {
          message: normalizedError.message,
          code: normalizedError.code || 'CORRECTION_PROCESSING_ERROR',
          details: normalizedError.data
        },
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Complete verification with approval or rejection
   * 
   * @param workflowId Workflow ID
   * @param isApproved Whether the verification is approved
   * @param options Additional options
   * @returns Verification result
   */
  async completeVerification(
    workflowId: string,
    isApproved: boolean,
    options?: {
      comments?: string
      items?: VerificationItem[]
      userId?: string
    }
  ): Promise<VerificationServiceResult<VerificationResult>> {
    try {
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'completeVerification',
        workflowId,
        isApproved
      })

      moduleLogger.info('Completing verification')

      // Retrieve the current state from the database
      const { data: workflowData, error: workflowError } = await this.supabase
        .from('workflow_states')
        .select('*')
        .eq('id', workflowId)
        .single()

      if (workflowError || !workflowData) {
        throw new ValidationError({
          message: `Workflow not found: ${workflowError?.message || 'Unknown error'}`,
          code: 'WORKFLOW_NOT_FOUND',
          data: { workflowId, workflowError }
        })
      }

      // Get or create verification items if not provided
      const verificationItems = options?.items || 
        (workflowData.metadata?.verificationItems as VerificationItem[] || [])

      // Create the verification result
      const verificationResult: VerificationResult = {
        isCompleted: true,
        isApproved,
        items: verificationItems,
        completedAt: new Date().toISOString(),
        completedBy: options?.userId,
        changeSummary: generateChangeSummary(verificationItems),
        verificationMetadata: {
          verificationStatus: isApproved ? 'completed' : 'failed',
          originalSummaryId: workflowData.metadata?.originalSummaryId || '',
          currentVersionId: workflowData.metadata?.currentVersionId || '',
          correctionCount: workflowData.metadata?.correctionCount || 0,
          corrections: workflowData.metadata?.corrections || [],
          startedAt: workflowData.metadata?.startedAt,
          lastUpdated: new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
          verifiedBy: options?.userId,
          rejectionReason: !isApproved ? options?.comments : undefined
        }
      }

      // Update the workflow state in the database
      const { error: updateError } = await this.supabase
        .from('workflow_states')
        .update({
          step: isApproved ? 'verification_completed' : 'verification_failed',
          metadata: {
            ...workflowData.metadata,
            verificationStatus: isApproved ? 'completed' : 'failed',
            verificationResult,
            completedAt: new Date().toISOString(),
            rejectionReason: !isApproved ? options?.comments : undefined
          }
        })
        .eq('id', workflowId)

      if (updateError) {
        throw new SystemError({
          message: `Failed to update workflow state: ${updateError.message}`,
          code: 'DATABASE_ERROR',
          data: { workflowId, updateError }
        })
      }

      moduleLogger.info('Verification completed successfully', {
        isApproved,
        workflowId
      })

      // Return standardized result
      return {
        success: true,
        data: verificationResult,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      // Normalize and log the error
      const normalizedError = normalizeError(error)
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'completeVerification',
        workflowId,
        isApproved,
        errorCode: normalizedError.code
      })

      moduleLogger.error('Error completing verification', {}, normalizedError)
      
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
            lastUpdated: new Date().toISOString()
          }
        },
        error: {
          message: normalizedError.message,
          code: normalizedError.code || 'VERIFICATION_COMPLETION_ERROR',
          details: normalizedError.data
        },
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Get verification status for a workflow
   * 
   * @param workflowId Workflow ID
   * @returns Current verification status
   */
  async getVerificationStatus(
    workflowId: string
  ): Promise<VerificationServiceResult<{
    verificationStatus: VerificationStatusType
    items: VerificationItem[]
    metadata?: VerificationMetadata
    originalContent?: string
    currentContent?: string
  }>> {
    try {
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'getVerificationStatus',
        workflowId
      })

      moduleLogger.info('Retrieving verification status')

      // Retrieve the workflow state from the database
      const { data: workflowData, error: workflowError } = await this.supabase
        .from('workflow_states')
        .select('*')
        .eq('id', workflowId)
        .single()

      if (workflowError || !workflowData) {
        throw new ValidationError({
          message: `Workflow not found: ${workflowError?.message || 'Unknown error'}`,
          code: 'WORKFLOW_NOT_FOUND',
          data: { workflowId, workflowError }
        })
      }

      // Extract verification data from workflow
      const verificationStatus = workflowData.metadata?.verificationStatus as VerificationStatusType || 'pending'
      const verificationItems = workflowData.metadata?.verificationItems as VerificationItem[] || []
      const verificationMetadata = workflowData.metadata?.verificationMetadata as VerificationMetadata
      const originalContent = workflowData.metadata?.originalContent
      const currentContent = workflowData.metadata?.currentContent

      moduleLogger.info('Verification status retrieved successfully', {
        workflowId,
        verificationStatus
      })

      // Return standardized result
      return {
        success: true,
        data: {
          verificationStatus,
          items: verificationItems,
          metadata: verificationMetadata,
          originalContent,
          currentContent
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      // Normalize and log the error
      const normalizedError = normalizeError(error)
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'getVerificationStatus',
        workflowId,
        errorCode: normalizedError.code
      })

      moduleLogger.error('Error retrieving verification status', {}, normalizedError)
      
      return {
        success: false,
        data: {
          verificationStatus: 'pending',
          items: []
        },
        error: {
          message: normalizedError.message,
          code: normalizedError.code || 'VERIFICATION_STATUS_ERROR',
          details: normalizedError.data
        },
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Get verification status for a patient summary
   * 
   * @param patientId Patient ID
   * @returns Current patient summary verification status
   */
  async getPatientSummaryVerification(
    patientId: string
  ): Promise<VerificationServiceResult<{
    verificationStatus: VerificationStatusType
    items: VerificationItem[]
    metadata?: VerificationMetadata
    originalContent?: string
    currentContent?: string
  }>> {
    try {
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'getPatientSummaryVerification',
        patientId
      })

      moduleLogger.info('Retrieving patient summary verification')

      // Call the API through the client
      const result = await apiClient.verification.getPatientSummaryVerification(patientId)

      // Handle the API response
      if (!result.success) {
        throw new ValidationError({
          message: 'Failed to retrieve patient summary verification',
          code: 'PATIENT_SUMMARY_VERIFICATION_FAILED',
          data: { originalResult: result }
        })
      }

      moduleLogger.info('Patient summary verification retrieved successfully', {
        patientId,
        verificationStatus: result.data.verificationStatus
      })

      // Return standardized result
      return {
        success: true,
        data: {
          verificationStatus: result.data.verificationStatus,
          items: result.data.items,
          metadata: result.data.metadata,
          originalContent: result.data.originalContent,
          currentContent: result.data.currentContent
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      // Normalize and log the error
      const normalizedError = normalizeError(error)
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'getPatientSummaryVerification',
        patientId,
        errorCode: normalizedError.code
      })

      moduleLogger.error('Error retrieving patient summary verification', {}, normalizedError)
      
      return {
        success: false,
        data: {
          verificationStatus: 'pending',
          items: []
        },
        error: {
          message: normalizedError.message,
          code: normalizedError.code || 'PATIENT_SUMMARY_VERIFICATION_ERROR',
          details: normalizedError.data
        },
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Update patient summary verification status
   * 
   * @param patientId Patient ID
   * @param data Update data
   * @returns Updated verification result
   */
  async updatePatientSummaryVerification(
    patientId: string,
    data: {
      status: 'pending' | 'verified' | 'rejected'
      comments?: string
      items?: VerificationItem[]
    }
  ): Promise<VerificationServiceResult<VerificationResult>> {
    try {
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'updatePatientSummaryVerification',
        patientId,
        status: data.status
      })

      moduleLogger.info('Updating patient summary verification')

      // Call the API through the client
      const result = await apiClient.verification.updatePatientSummaryVerification(
        patientId,
        data
      )

      // Handle the API response
      if (!result.success) {
        throw new ValidationError({
          message: 'Failed to update patient summary verification',
          code: 'PATIENT_SUMMARY_VERIFICATION_UPDATE_FAILED',
          data: { originalResult: result }
        })
      }

      moduleLogger.info('Patient summary verification updated successfully', {
        patientId,
        status: data.status
      })

      // Return standardized result
      return {
        success: true,
        data: result.data,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      // Normalize and log the error
      const normalizedError = normalizeError(error)
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'updatePatientSummaryVerification',
        patientId,
        status: data.status,
        errorCode: normalizedError.code
      })

      moduleLogger.error('Error updating patient summary verification', {}, normalizedError)
      
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
            lastUpdated: new Date().toISOString()
          }
        },
        error: {
          message: normalizedError.message,
          code: normalizedError.code || 'PATIENT_SUMMARY_VERIFICATION_UPDATE_ERROR',
          details: normalizedError.data
        },
        timestamp: new Date().toISOString()
      }
    }
  }
}

// Export singleton instance
export const verificationService = new VerificationService()