import { apiClient } from '@/lib/api/client/api-client'
import { createBrowserClient } from '@/lib/supabase/clients'
import { workflowStateManager } from '@/lib/services/workflow/workflow-state-manager'
import logger from '@/lib/logger'
import {
  ValidationError,
  SystemError,
  ExternalServiceError,
  normalizeError,
  ApplicationError,
  NotFoundError,
} from '@/lib/errors'
import { langChainCore } from '@/lib/langchain/core'
import { createWorkflowCallbacks, runWithWorkflow } from '@/lib/utils/langchain'
import type { ProcessingPhase } from '@/lib/processing/types/base'
import type { WorkflowStep, CorrectionEntry } from '@/lib/workflow/types'
import type { RunnableConfig } from '@langchain/core/runnables'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { z } from 'zod'
import type { Json } from '@/lib/supabase'

// Import verification types
import type {
  VerificationItem,
  VerificationOptions,
  VerificationResult,
  VerificationMetadata,
  VerificationStatusType,
} from '@/lib/processing/types/verification'

// Import verification helper functions - convert from type imports to actual imports
import {
  createVerificationItem,
  createVerificationMessageMetadata,
  createCorrectionMessageMetadata,
  addCorrection,
  updateVerificationStatus,
  generateChangeSummary,
} from '@/lib/processing/types/verification'
import { ChatPromptTemplate } from '@langchain/core/prompts'

// Re-export helper functions for convenience
export {
  createVerificationItem,
  createVerificationMessageMetadata,
  createCorrectionMessageMetadata,
  addCorrection,
  updateVerificationStatus,
  generateChangeSummary,
}

// Define schemas for output parsing
export const PatientSummarySchema = z.object({
  demographics: z
    .object({
      name: z.string().optional(),
      dateOfBirth: z.string().optional(),
      gender: z.string().optional(),
      mrn: z.string().optional(),
    })
    .optional(),
  medicalHistory: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  medications: z
    .array(
      z.object({
        name: z.string(),
        dosage: z.string().optional(),
        frequency: z.string().optional(),
      })
    )
    .optional(),
  vitalSigns: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
        unit: z.string().optional(),
        date: z.string().optional(),
      })
    )
    .optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
})

/**
 * Type definitions for workflow metadata to improve type safety
 */
export interface VerificationWorkflowMetadata {
  verificationStatus?: VerificationStatusType
  verificationItems?: VerificationItem[]
  verificationMetadata?: VerificationMetadata
  originalContent?: string
  currentContent?: string
  originalSummaryId?: string
  currentVersionId?: string
  correctionCount?: number
  corrections?: CorrectionEntry[] | string[]
  lastUpdated?: string
  startedAt?: string
}

/**
 * Helper function to safely access workflow metadata
 * @param metadata The raw metadata from workflow
 * @returns Properly typed verification workflow metadata
 */
function getVerificationMetadata(
  metadata: Json | undefined
): VerificationWorkflowMetadata {
  if (!metadata) {
    return {}
  }

  // Cast to the expected type
  return metadata as unknown as VerificationWorkflowMetadata
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
  private readonly supabase = createBrowserClient()

  /**
   * Create optimized verification extraction chain
   *
   * @param workflowId Optional workflow ID for tracking
   * @param onProgress Optional progress callback
   * @returns A runnable sequence optimized for document extraction
   */
  private createVerificationExtractionChain(
    workflowId: string | null = null,
    onProgress?: (progress: number, phase: string) => void
  ) {
    const moduleLogger = logger.withMetadata({
      module: 'VerificationService',
      method: 'createVerificationExtractionChain',
      workflowId: workflowId || undefined,
    })

    moduleLogger.info('Creating verification extraction chain')

    // Create a prompt template for extraction
    const extractionPrompt = ChatPromptTemplate.fromTemplate(
      `You are a clinical documentation specialist with expertise in extracting patient information from medical documents.
      Extract a comprehensive patient summary from the medical document provided.
      
      Format your structured extraction to include the following sections:
      - demographics (name, DOB, gender, MRN if available)
      - medicalHistory (list of conditions)
      - allergies (list of allergies)
      - medications (list with dosage and frequency)
      - vitalSigns (list with values and units)
      - assessment (summary of findings)
      - plan (treatment recommendations)
      
      Here is the medical document:
      {document}`
    )

    // Create the extraction chain using structured output
    return langChainCore.createStructuredOutputChain(
      extractionPrompt,
      langChainCore.createChatOpenAI({
        temperature: 0.1,
        callbacks: createWorkflowCallbacks(
          workflowId,
          'verification_extraction',
          onProgress
            ? {
                onProgress: (progress) =>
                  onProgress(progress, 'Extracting document information'),
              }
            : undefined
        ),
      })
    )
  }

  /**
   * Create optimized correction processing chain
   *
   * @param workflowId Optional workflow ID for tracking
   * @param onProgress Optional progress callback
   * @returns A runnable sequence optimized for processing corrections
   */
  private createCorrectionChain(
    workflowId: string | null = null,
    onProgress?: (progress: number, phase: string) => void
  ) {
    const moduleLogger = logger.withMetadata({
      module: 'VerificationService',
      method: 'createCorrectionChain',
      workflowId: workflowId || undefined,
    })

    moduleLogger.info('Creating correction chain')

    // Create a prompt template for corrections
    const correctionPrompt = ChatPromptTemplate.fromTemplate(
      `You are a clinical documentation specialist helping to correct patient summaries.
      Your job is to update the existing patient summary based on the correction request.
      Maintain the original formatting but incorporate the requested changes accurately.
      If the correction is unclear, make your best medical judgment while preserving all other information.
      
      Current summary:
      {currentSummary}
      
      Correction request:
      {correction}
      
      Please provide the updated summary with the corrections incorporated:`
    )

    // Create text processing chain for corrections
    return langChainCore.createLLMChain(
      correctionPrompt,
      langChainCore.createChatOpenAI({
        temperature: 0.3,
        callbacks: createWorkflowCallbacks(
          workflowId,
          'verification_correction',
          onProgress
            ? {
                onProgress: (progress) =>
                  onProgress(progress, 'Processing correction'),
              }
            : undefined
        ),
      }),
      new StringOutputParser()
    )
  }

  /**
   * Generate verification for a document
   *
   * @param options Options for generating verification
   * @returns Generated verification with summary
   */
  async generateVerification(options: GenerateVerificationOptions): Promise<
    VerificationServiceResult<{
      summaryId: string
      summary: string
      structuredData?: Record<string, any>
    }>
  > {
    try {
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'generateVerification',
        workflowId: options.workflowId,
        messageId: options.messageId,
      })

      moduleLogger.info('Generating verification')

      // If we are in a browser environment, use the API client approach
      if (typeof window !== 'undefined') {
        // Call the API through the client
        const result = await apiClient.verification.generateVerification({
          document: options.document,
          workflowId: options.workflowId || '',
          messageId: options.messageId,
          summaryId: options.summaryId,
        })

        // Handle the API response
        if (!result.success || !result.data?.summaryId) {
          throw new ValidationError({
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
      }
      // If running on the server or in a test environment, use direct LangChain approach
      else {
        // Set up progress tracking
        const statusCallback:
          | ((status: { progress: number; phase: string }) => void)
          | undefined = options.onStatusUpdate

        // Create extraction chain
        const extractionChain = this.createVerificationExtractionChain(
          options.workflowId || null,
          (progress, phase) => {
            statusCallback?.({ progress, phase })
          }
        )

        // Prepare document text
        const documentText =
          typeof options.document === 'string'
            ? options.document
            : JSON.stringify(options.document)

        // Run the extraction chain
        const extractionResult = await extractionChain.invoke({
          document: documentText,
        })

        // Format the summary using the structured data
        const structuredData = extractionResult
        const summaryText = this.formatSummaryFromStructuredData(structuredData)

        moduleLogger.info('Direct verification extraction completed', {
          summaryLength: summaryText.length,
          structuredDataKeys: Object.keys(structuredData || {}),
        })

        return {
          success: true,
          data: {
            summaryId: options.summaryId || '',
            summary: summaryText,
            structuredData,
          },
          timestamp: new Date().toISOString(),
        }
      }
    } catch (error) {
      // Handle errors with normalized error handling
      const normalizedError = normalizeError(error)

      const errorLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'generateVerification',
        workflowId: options.workflowId,
        messageId: options.messageId,
        errorCode: normalizedError.code,
      })

      errorLogger.error('Failed to generate verification', {}, normalizedError)

      // Determine if this is an external API error or internal error
      const isExternalError = normalizedError instanceof ExternalServiceError

      return {
        success: false,
        data: { summaryId: '', summary: '' }, // Add empty data to satisfy type requirements
        error: {
          message: normalizedError.message || 'Verification generation failed',
          code: normalizedError.code || 'VERIFICATION_FAILED',
          details: normalizedError.data,
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Format a summary from structured data
   *
   * @param data Structured patient data
   * @returns Formatted markdown summary
   */
  private formatSummaryFromStructuredData(data: any): string {
    if (!data) return ''

    let summary = '# Patient Summary\n\n'

    // Demographics
    summary += '## Demographics\n'
    if (data.demographics) {
      if (data.demographics.name)
        summary += `**Name:** ${data.demographics.name}\n`
      if (data.demographics.dateOfBirth)
        summary += `**DOB:** ${data.demographics.dateOfBirth}\n`
      if (data.demographics.gender)
        summary += `**Gender:** ${data.demographics.gender}\n`
      if (data.demographics.mrn)
        summary += `**MRN:** ${data.demographics.mrn}\n`
    } else {
      summary += 'No demographics information available\n'
    }

    // Medical History
    summary += '\n## Medical History\n'
    if (data.medicalHistory && data.medicalHistory.length > 0) {
      data.medicalHistory.forEach((item: string) => {
        summary += `- ${item}\n`
      })
    } else {
      summary += 'No medical history available\n'
    }

    // Allergies
    summary += '\n## Allergies\n'
    if (data.allergies && data.allergies.length > 0) {
      data.allergies.forEach((item: string) => {
        summary += `- ${item}\n`
      })
    } else {
      summary += 'No allergies recorded\n'
    }

    // Medications
    summary += '\n## Medications\n'
    if (data.medications && data.medications.length > 0) {
      data.medications.forEach((med: any) => {
        let medText = `- ${med.name}`
        if (med.dosage) medText += ` ${med.dosage}`
        if (med.frequency) medText += ` ${med.frequency}`
        summary += `${medText}\n`
      })
    } else {
      summary += 'No medications recorded\n'
    }

    // Vital Signs
    summary += '\n## Vital Signs\n'
    if (data.vitalSigns && data.vitalSigns.length > 0) {
      data.vitalSigns.forEach((vital: any) => {
        let vitalText = `- ${vital.name}: ${vital.value}`
        if (vital.unit) vitalText += ` ${vital.unit}`
        if (vital.date) vitalText += ` (${vital.date})`
        summary += `${vitalText}\n`
      })
    } else {
      summary += 'No vital signs recorded\n'
    }

    // Assessment
    summary += '\n## Assessment\n'
    if (data.assessment) {
      summary += `${data.assessment}\n`
    } else {
      summary += 'No assessment available\n'
    }

    // Plan
    summary += '\n## Plan\n'
    if (data.plan) {
      summary += `${data.plan}\n`
    } else {
      summary += 'No plan documented\n'
    }

    return summary
  }

  /**
   * Submit a correction to the verification process
   *
   * @param options Correction options
   * @returns Updated verification with new summary
   */
  async submitCorrection(options: SubmitCorrectionOptions): Promise<
    VerificationServiceResult<{
      summaryId: string
      summary: string
      structuredData?: Record<string, any>
      correctionCount?: number
    }>
  > {
    try {
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'submitCorrection',
        workflowId: options.workflowId,
        messageId: options.messageId,
      })

      moduleLogger.info('Submitting correction')

      // Update workflow state to reflect correction in progress
      if (options.workflowId) {
        await workflowStateManager.updateWorkflowState(
          options.workflowId as unknown as WorkflowStep,
          {
            step: 'verification_in_progress' as WorkflowStep,
            progress: 50,
            phase: 'verification',
            metadata: {
              lastCorrectionTime: new Date().toISOString(),
              correctionText: options.correction,
            },
          }
        )
      }

      // Process the correction using the service method
      const result = await this.processCorrection(options)

      // Update workflow state to reflect correction completed
      if (options.workflowId && result.success) {
        await workflowStateManager.updateWorkflowState(
          options.workflowId as unknown as WorkflowStep,
          {
            step: 'verification_in_progress' as WorkflowStep,
            progress: 80,
            phase: 'verification',
            metadata: {
              currentContent: result.data.summary,
              correctionCount: result.data.correctionCount,
            },
          }
        )
      }

      return result
    } catch (error) {
      // Handle errors
      const normalizedError = normalizeError(error)

      const errorLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'submitCorrection',
        workflowId: options.workflowId,
        messageId: options.messageId,
        errorCode: normalizedError.code,
      })

      errorLogger.error('Failed to submit correction', {}, normalizedError)

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
   * Process a correction to update the patient summary
   *
   * @param options Correction options
   * @returns Updated verification with new summary
   */
  async processCorrection(options: SubmitCorrectionOptions): Promise<
    VerificationServiceResult<{
      summaryId: string
      summary: string
      structuredData?: Record<string, any>
      correctionCount?: number
    }>
  > {
    try {
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'processCorrection',
        workflowId: options.workflowId,
        messageId: options.messageId,
      })

      moduleLogger.info('Processing correction')

      // If we are in a browser environment, use the API client approach
      if (typeof window !== 'undefined') {
        // Call the API through the client
        const result = await apiClient.verification.processCorrection({
          correction: options.correction,
          currentSummary: options.currentSummary,
          workflowId: options.workflowId,
          messageId: options.messageId,
        })

        // Handle the API response
        if (!result.success || !result.data?.summaryId) {
          throw new ValidationError({
            message: 'Failed to process correction',
            code: 'CORRECTION_PROCESSING_FAILED',
            data: { originalResult: result },
          })
        }

        moduleLogger.info('Correction processed successfully', {
          summaryId: result.data.summaryId,
          correctionCount: result.data.correctionCount,
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
      }
      // If running on the server or in a test environment, use direct LangChain approach
      else {
        // Set up progress tracking
        const statusCallback:
          | ((status: { progress: number; phase: string }) => void)
          | undefined = options.onStatusUpdate

        // Create correction chain
        const correctionChain = this.createCorrectionChain(
          options.workflowId || null,
          (progress, phase) => {
            statusCallback?.({ progress, phase })
          }
        )

        // Run the correction chain
        const correctionResult = await correctionChain.invoke({
          currentSummary: options.currentSummary,
          correction: options.correction,
        })

        // Try to parse structured data from the corrected summary
        let structuredData = {}
        try {
          // Use the extraction chain to re-extract structured data
          const extractionChain = this.createVerificationExtractionChain()
          structuredData = await extractionChain.invoke({
            document: correctionResult,
          })
        } catch (error) {
          moduleLogger.warn(
            'Failed to extract structured data from correction',
            {
              error: error instanceof Error ? error.message : String(error),
            }
          )
        }

        moduleLogger.info('Direct correction processing completed', {
          summaryLength: correctionResult.length,
        })

        // Get or increment correction count
        const correctionCount = 1 // Default to 1 if we can't determine

        return {
          success: true,
          data: {
            summaryId: '',
            summary: correctionResult,
            structuredData,
            correctionCount,
          },
          timestamp: new Date().toISOString(),
        }
      }
    } catch (error) {
      // Handle errors with normalized error handling
      const normalizedError = normalizeError(error)

      const errorLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'processCorrection',
        workflowId: options.workflowId,
        messageId: options.messageId,
        errorCode: normalizedError.code,
      })

      errorLogger.error('Failed to process correction', {}, normalizedError)

      return {
        success: false,
        data: { summaryId: '', summary: '' }, // Add empty data to satisfy type requirements
        error: {
          message: normalizedError.message || 'Correction processing failed',
          code: normalizedError.code || 'CORRECTION_FAILED',
          details: normalizedError.data,
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Complete the verification process
   *
   * @param workflowId Workflow ID
   * @param isApproved Whether verification was approved
   * @param options Optional verification options
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
      })

      moduleLogger.info('Completing verification', {
        isApproved,
        hasItems: !!options?.items,
      })

      // Get the current workflow data
      const workflowState = await workflowStateManager.getWorkflowState()

      if (!workflowState) {
        throw new NotFoundError({
          message: `No workflow state found`,
          code: 'WORKFLOW_NOT_FOUND',
        })
      }

      // Check if this is the workflow we're looking for
      if (
        workflowState.step !== 'verification_in_progress' &&
        workflowState.metadata?.workflowId !== workflowId
      ) {
        throw new NotFoundError({
          message: `Workflow with ID ${workflowId} not found`,
          code: 'WORKFLOW_NOT_FOUND',
        })
      }

      // Get workflow metadata with proper typing
      const metadata = getVerificationMetadata(workflowState.metadata)

      // Get or create verification items if not provided
      const verificationItems =
        options?.items || metadata.verificationItems || []

      // Create empty corrections array if needed
      const corrections: CorrectionEntry[] =
        (metadata.corrections as unknown as CorrectionEntry[]) || []

      // Create the verification result
      const verificationResult: VerificationResult = {
        isApproved,
        isCompleted: true,
        items: verificationItems,
        completedAt: new Date().toISOString(), // Ensure this is always a string
        completedBy: options?.userId,
        verificationMetadata: {
          verificationStatus: isApproved
            ? ('completed' as VerificationStatusType)
            : ('failed' as VerificationStatusType),
          originalSummaryId: metadata.originalSummaryId || '',
          currentVersionId: metadata.currentVersionId || '',
          correctionCount: metadata.correctionCount || 0,
          corrections,
          lastUpdated: new Date().toISOString(),
        },
      }

      // Update the workflow status with proper step type
      await workflowStateManager.updateWorkflowState(
        workflowId as unknown as WorkflowStep,
        {
          step: isApproved
            ? ('verification_completed' as WorkflowStep)
            : ('verification_failed' as WorkflowStep),
          progress: 100,
          phase: 'verification' as ProcessingPhase,
          metadata: {
            ...metadata,
            verificationStatus: isApproved ? 'completed' : 'failed',
            verificationResult,
            completedAt: new Date().toISOString(),
          },
        }
      )

      moduleLogger.info('Verification completed', {
        isApproved,
        itemCount: verificationItems.length,
      })

      return {
        success: true,
        data: verificationResult,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      // Handle errors
      const normalizedError = normalizeError(error)

      const errorLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'completeVerification',
        workflowId,
        errorCode: normalizedError.code,
      })

      errorLogger.error('Failed to complete verification', {}, normalizedError)

      return {
        success: false,
        error: {
          message: normalizedError.message || 'Failed to complete verification',
          code: normalizedError.code || 'VERIFICATION_COMPLETION_FAILED',
          details: normalizedError.data || {}, // Use data property instead of details
        },
        timestamp: new Date().toISOString(),
        data: {
          isCompleted: true,
          isApproved: false,
          items: [],
          completedAt: new Date().toISOString(), // Ensure this is always a string
          verificationMetadata: {
            verificationStatus: 'failed' as VerificationStatusType,
            originalSummaryId: '',
            currentVersionId: '',
            correctionCount: 0,
            corrections: [],
            lastUpdated: new Date().toISOString(),
          },
        } as VerificationResult,
      }
    }
  }

  /**
   * Get verification status for a workflow
   *
   * @param workflowId Workflow ID
   * @returns Current verification status
   */
  async getVerificationStatus(workflowId: string): Promise<
    VerificationServiceResult<{
      verificationStatus: VerificationStatusType
      items: VerificationItem[]
      metadata?: VerificationMetadata
      originalContent?: string
      currentContent?: string
    }>
  > {
    try {
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'getVerificationStatus',
        workflowId,
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
          data: { workflowId, workflowError },
        })
      }

      // Extract verification data from workflow
      const metadata = getVerificationMetadata(workflowData.metadata)
      const verificationStatus = metadata.verificationStatus || 'pending'
      const verificationItems = metadata.verificationItems || []
      const verificationMetadata = metadata.verificationMetadata
      const originalContent = metadata.originalContent
      const currentContent = metadata.currentContent

      moduleLogger.info('Verification status retrieved successfully', {
        workflowId,
        verificationStatus,
      })

      // Return standardized result
      return {
        success: true,
        data: {
          verificationStatus,
          items: verificationItems,
          metadata: verificationMetadata,
          originalContent,
          currentContent,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      // Normalize and log the error
      const normalizedError = normalizeError(error)
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'getVerificationStatus',
        workflowId,
        errorCode: normalizedError.code,
      })

      moduleLogger.error(
        'Error retrieving verification status',
        {},
        normalizedError
      )

      return {
        success: false,
        data: {
          verificationStatus: 'pending',
          items: [],
        },
        error: {
          message: normalizedError.message,
          code: normalizedError.code || 'VERIFICATION_STATUS_ERROR',
          details: normalizedError.data,
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get verification status for a patient summary
   *
   * @param patientId Patient ID
   * @returns Current patient summary verification status
   */
  async getPatientSummaryVerification(patientId: string): Promise<
    VerificationServiceResult<{
      verificationStatus: VerificationStatusType
      items: VerificationItem[]
      metadata?: VerificationMetadata
      originalContent?: string
      currentContent?: string
    }>
  > {
    try {
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'getPatientSummaryVerification',
        patientId,
      })

      moduleLogger.info('Retrieving patient summary verification')

      // Call the API through the client
      const result =
        await apiClient.verification.getPatientSummaryVerification(patientId)

      // Handle the API response
      if (!result.success) {
        throw new ValidationError({
          message: 'Failed to retrieve patient summary verification',
          code: 'PATIENT_SUMMARY_VERIFICATION_FAILED',
          data: { originalResult: result },
        })
      }

      moduleLogger.info('Patient summary verification retrieved successfully', {
        patientId,
        verificationStatus: result.data.verificationStatus,
      })

      // Return standardized result
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
      // Normalize and log the error
      const normalizedError = normalizeError(error)
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'getPatientSummaryVerification',
        patientId,
        errorCode: normalizedError.code,
      })

      moduleLogger.error(
        'Error retrieving patient summary verification',
        {},
        normalizedError
      )

      return {
        success: false,
        data: {
          verificationStatus: 'pending',
          items: [],
        },
        error: {
          message: normalizedError.message,
          code: normalizedError.code || 'PATIENT_SUMMARY_VERIFICATION_ERROR',
          details: normalizedError.data,
        },
        timestamp: new Date().toISOString(),
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
        status: data.status,
      })

      moduleLogger.info('Updating patient summary verification')

      // Call the API through the client
      const result =
        await apiClient.verification.updatePatientSummaryVerification(
          patientId,
          data
        )

      // Handle the API response
      if (!result.success) {
        throw new ValidationError({
          message: 'Failed to update patient summary verification',
          code: 'PATIENT_SUMMARY_VERIFICATION_UPDATE_FAILED',
          data: { originalResult: result },
        })
      }

      moduleLogger.info('Patient summary verification updated successfully', {
        patientId,
        status: data.status,
      })

      // Return standardized result
      return {
        success: true,
        data: result.data as VerificationResult, // Add explicit type cast to ensure completedAt is treated as string
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      // Normalize and log the error
      const normalizedError = normalizeError(error)
      const moduleLogger = logger.withMetadata({
        module: 'VerificationService',
        method: 'updatePatientSummaryVerification',
        patientId,
        status: data.status,
        errorCode: normalizedError.code,
      })

      moduleLogger.error(
        'Error updating patient summary verification',
        {},
        normalizedError
      )

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
          message: normalizedError.message,
          code:
            normalizedError.code || 'PATIENT_SUMMARY_VERIFICATION_UPDATE_ERROR',
          details: normalizedError.data,
        },
        timestamp: new Date().toISOString(),
      }
    }
  }
}

// Export singleton instance
export const verificationService = new VerificationService()
