/**
 * @fileoverview Verification Workflow Hook
 * 
 * Phase 4 Implementation: Uses the Result pattern and functional composition
 * pattern to implement a verification workflow with improved error
 * handling and transaction management.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { ProcessingPhase, DomainOnlyWorkflowStep, WorkflowStep } from '@/lib/types/workflow'
import { createWorkflowHook } from './create-workflow-hook'
import { normalizeError } from '@/lib/errors'
import { transactionManager } from '@/lib/services/workflow/transaction/transaction-manager'
import { workflowVerificationService } from '@/lib/services/workflow/domain/verification-workflow'
import { processWorkflow, getDomainMetadata, updateMetadataSafely, createDomainLogger } from '@/lib/services/workflow/infrastructure/workflow-processor-helpers'
import { Result } from '@/lib/services/workflow/error/result'
import { UnifiedErrorHandler } from '@/lib/services/workflow/error/unified-error-handler'
import { VerificationStatus } from '@/lib/types/verification'

// Domain-specific logger
const domainLogger = createDomainLogger('Verification')

export interface UseVerificationWorkflowOptions {
  userId?: string
  chatId?: string | null
}

export interface VerificationSummary {
  summaryId: string
  summary: string
  structuredData?: Record<string, unknown>
  correctionCount: number
  verified: boolean
  verifiedBy?: string
  verifiedAt?: string
  status: 'pending' | 'inProgress' | 'completed' | 'rejected'
}

// Input type for verification workflow actions
interface VerificationInput {
  action: 'initiate' | 'correct' | 'complete' | 'reject' | 'reset'
  documentText?: string | Record<string, unknown>
  correctionText?: string
  currentSummary?: string
  summaryId?: string
  reason?: string
  messageId?: string
}

// Result type for verification workflow actions using Result pattern
interface VerificationResult {
  success: boolean
  summaryId?: string
  summary?: string
  structuredData?: Record<string, unknown>
  correctionCount?: number
  status?: 'pending' | 'inProgress' | 'completed' | 'rejected'
  verifiedBy?: string
  verifiedAt?: string
  error?: string
}

// State type for verification workflow
interface VerificationState extends VerificationSummary {
  error?: string
}

/**
 * Domain actions for verification workflow with Result pattern
 */
const verificationWorkflowActions = {
  domainName: 'Verification',
  initialStep: 'idle' as const,
  
  /**
   * Get initial verification state
   */
  getInitialState: (): VerificationState => ({
    summaryId: '',
    summary: '',
    correctionCount: 0,
    status: 'pending',
    verified: false
  }),
  
  /**
   * Process verification workflow action using Result pattern
   */
  processAction: async (
    input: VerificationInput,
    options: {
      workflowId: string
      userId?: string
      onProgress?: (progress: number, phase: ProcessingPhase) => void
      chatId?: string | null
    }
  ): Promise<Result<VerificationResult>> => {
    const { action } = input
    const { workflowId, userId, onProgress, chatId } = options
    
    if (!workflowId) {
      return Result.failure(
        'Workflow not initialized. Make sure userId is provided.',
        'WORKFLOW_NOT_INITIALIZED'
      )
    }
    
    // Handle 'initiate' action using transaction manager
    if (action === 'initiate' && input.documentText) {
      if (!userId || !chatId) {
        return Result.failure(
          'User ID and Chat ID are required for verification',
          'MISSING_PARAMETERS',
          { missingParams: ['userId', 'chatId'] }
        )
      }
      
      // Prepare document text
      let textToVerify = typeof input.documentText === 'string'
        ? input.documentText
        : (input.documentText as { text?: string }).text ?? JSON.stringify(input.documentText)
      
      // Generate summary ID
      const summaryId = input.summaryId || crypto.randomUUID()
      
      // Use transaction manager for verification initiation
      return await transactionManager.executeTransaction(
        workflowId,
        async (transactionId, progressCallback) => {
          // Process verification with workflowVerificationService
          const result = await workflowVerificationService.initiateVerification(
            workflowId,
            {
              documentText: textToVerify,
              summaryId,
              chatId: chatId,
              messageId: input.messageId,
              useGemini: true,
              transactionId
            },
            progressCallback || onProgress
          )
          
          if (result.isSuccess()) {
            const data = result.value
            return {
              success: true,
              summaryId,
              summary: data.summary,
              structuredData: data.structuredData,
              status: 'pending'
            }
          } else {
            // Return error result
            return {
              success: false,
              error: result.error.message
            }
          }
        },
        {
          step: 'verification_pending',
          errorStep: DomainOnlyWorkflowStep.ERROR,
          metadata: {
            verificationMetadata: {
              verification_status: 'pending',
              correctionCount: 0,
              corrections: [],
              extractedData: input.documentText,
              summaryId
            }
          },
          onProgress,
          domainName: 'Verification',
          retryCount: 1
        }
      )
      .then(result => {
        if (result.isSuccess()) {
          return Result.success(result.value.data)
        } else {
          return Result.failure<VerificationResult>(
            result.error.message,
            result.error.code,
            { success: false }
          )
        }
      })
    }
    // Handle 'correct' action with processWorkflow helper
    else if (action === 'correct' && input.correctionText && input.currentSummary) {
      if (!userId || !chatId) {
        return Result.failure(
          'User ID and Chat ID are required for verification',
          'MISSING_PARAMETERS',
          { missingParams: ['userId', 'chatId'] }
        )
      }
      
      // Generate new summary ID
      const newSummaryId = crypto.randomUUID()
      
      return await processWorkflow<{
        correctionText: string,
        currentSummary: string,
        newSummaryId: string,
        messageId?: string
      }, VerificationResult>(
        workflowId,
        {
          correctionText: input.correctionText,
          currentSummary: input.currentSummary,
          newSummaryId,
          messageId: input.messageId
        },
        {
          targetStep: 'verification_in_progress',
          onProgress,
          metadata: {
            verificationMetadata: {
              verification_status: 'inProgress',
              currentSummaryId: newSummaryId
            }
          },
          recoveryStep: DomainOnlyWorkflowStep.ERROR
        },
        'Verification',
        DomainOnlyWorkflowStep.ERROR,
        async (wfId, inputData, currentState, opts) => {
          // Get current correction count
          const metadataResult = await getDomainMetadata<{
            verificationMetadata?: { correctionCount?: number }
          }>(
            wfId,
            'verificationMetadata',
            { verificationMetadata: { correctionCount: 0 } },
            'Verification'
          )
          
          const correctionCount = metadataResult.isSuccess() && 
                                metadataResult.value?.verificationMetadata?.correctionCount !== undefined
                                  ? metadataResult.value.verificationMetadata.correctionCount + 1
                                  : 1
          
          // Process verification correction
          const correctionResult = await workflowVerificationService.processVerificationCorrection(
            wfId,
            input.summaryId || '',
            {
              correctionText: inputData.correctionText,
              currentSummary: inputData.currentSummary,
              newSummaryId: inputData.newSummaryId,
              messageId: inputData.messageId
            },
            opts.progressCallback
          )
          
          if (correctionResult.isSuccess()) {
            const data = correctionResult.value
            return {
              success: true,
              summaryId: newSummaryId,
              summary: data.summary,
              structuredData: data.structuredData,
              correctionCount,
              status: 'inProgress'
            }
          } else {
            return {
              success: false,
              error: correctionResult.error.message
            }
          }
        }
      )
    }
    // Handle 'complete' action using transaction
    else if (action === 'complete') {
      if (!userId) {
        return Result.failure(
          'User ID required for verification completion',
          'MISSING_PARAMETERS',
          { missingParams: ['userId'] }
        )
      }
      
      const summaryId = input.summaryId || await extractSummaryIdFromMetadata(workflowId)
      
      if (!summaryId) {
        return Result.failure(
          'Summary ID is required to complete verification',
          'MISSING_SUMMARY_ID'
        )
      }
      
      return await transactionManager.executeTransaction(
        workflowId,
        async (transactionId) => {
          // Complete verification
          const result = await workflowVerificationService.completeVerification(
            workflowId,
            summaryId,
            userId,
            false, // don't auto-generate report
            transactionId
          )
          
          if (result.isSuccess()) {
            return {
              success: true,
              summaryId,
              verified: true,
              verifiedBy: userId,
              verifiedAt: new Date().toISOString(),
              status: 'completed'
            }
          } else {
            return {
              success: false,
              error: result.error.message
            }
          }
        },
        {
          step: 'verification_completed',
          metadata: {
            verificationMetadata: {
              verification_status: 'completed',
              verifiedAt: new Date().toISOString(),
              verifiedBy: userId,
            }
          },
          domainName: 'Verification'
        }
      )
      .then(result => {
        if (result.isSuccess()) {
          return Result.success(result.value.data)
        } else {
          return Result.failure<VerificationResult>(
            result.error.message,
            result.error.code,
            { success: false }
          )
        }
      })
    }
    // Handle 'reject' action
    else if (action === 'reject' && input.reason) {
      if (!userId) {
        return Result.failure(
          'User ID required for verification rejection',
          'MISSING_PARAMETERS',
          { missingParams: ['userId'] }
        )
      }
      
      const summaryId = input.summaryId || await extractSummaryIdFromMetadata(workflowId)
      
      if (!summaryId) {
        return Result.failure(
          'Summary ID is required to reject verification',
          'MISSING_SUMMARY_ID'
        )
      }
      
      return await transactionManager.executeTransaction(
        workflowId,
        async (transactionId) => {
          // Reject verification
          const result = await workflowVerificationService.rejectVerification(
            workflowId,
            summaryId,
            userId,
            input.reason,
            transactionId
          )
          
          if (result.isSuccess()) {
            return {
              success: true,
              status: 'rejected'
            }
          } else {
            return {
              success: false,
              error: result.error.message
            }
          }
        },
        {
          step: 'verification_failed',
          metadata: {
            verificationMetadata: {
              verification_status: 'rejected',
              rejectedAt: new Date().toISOString(),
              rejectedBy: userId,
              rejectionReason: input.reason
            }
          },
          domainName: 'Verification'
        }
      )
      .then(result => {
        if (result.isSuccess()) {
          return Result.success(result.value.data)
        } else {
          return Result.failure<VerificationResult>(
            result.error.message,
            result.error.code,
            { success: false }
          )
        }
      })
    }
    // Handle reset action
    else if (action === 'reset') {
      // Simple reset without transaction management
      return Result.success({
        success: true,
        summaryId: '',
        summary: '',
        correctionCount: 0,
        status: 'pending'
      })
    }
    
    // Default error case
    return Result.failure(
      'Invalid verification action',
      'INVALID_ACTION',
      { action }
    )
  },
  
  /**
   * Create error result for failed operations
   */
  createErrorResult: (error: Error, input: VerificationInput): VerificationResult => {
    return {
      success: false,
      error: error.message
    }
  },
  
  /**
   * Process result to update state
   */
  processResult: (
    result: VerificationResult,
    currentState: VerificationState
  ): VerificationState => {
    // Update state based on result
    return {
      ...currentState,
      summaryId: result.summaryId || currentState.summaryId,
      summary: result.summary || currentState.summary,
      structuredData: result.structuredData || currentState.structuredData,
      correctionCount: result.correctionCount !== undefined
        ? result.correctionCount
        : currentState.correctionCount,
      verified: result.status === 'completed' || currentState.verified,
      status: result.status || currentState.status,
      verifiedBy: result.verifiedBy || currentState.verifiedBy,
      verifiedAt: result.verifiedAt || currentState.verifiedAt,
      error: result.error
    }
  }
}

// Create the verification domain workflow hook with Result pattern
const useVerificationDomainWorkflow = createWorkflowHook<VerificationInput, VerificationResult, VerificationState>(
  verificationWorkflowActions
)

/**
 * Helper function to extract summary ID from metadata
 */
async function extractSummaryIdFromMetadata(workflowId: string): Promise<string | undefined> {
  const metadataResult = await getDomainMetadata<{
    verificationMetadata?: { currentSummaryId?: string, summaryId?: string }
  }>(
    workflowId,
    'verificationMetadata',
    undefined,
    'Verification'
  )
  
  if (metadataResult.isSuccess() && metadataResult.value) {
    return metadataResult.value.verificationMetadata?.currentSummaryId || 
           metadataResult.value.verificationMetadata?.summaryId
  }
  
  return undefined
}

/**
 * Specialized hook for verification workflows.
 * Phase 4 implementation: Uses Result pattern and unified error handling.
 */
export function useVerificationWorkflow(options: UseVerificationWorkflowOptions = {}) {
  const { userId, chatId } = options
  
  // Unified error handler for verification domain
  const errorHandler = useMemo(() => {
    return new UnifiedErrorHandler('Verification')
  }, [])
  
  // Use the domain workflow hook
  const domainWorkflow = useVerificationDomainWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  /**
   * Initiate verification process with extracted data
   */
  const initiateVerification = useCallback(async (
    documentText: string | Record<string, unknown>,
    options: {
      messageId?: string,
      onProgress?: (progress: number, phase: ProcessingPhase) => void
    } = {}
  ): Promise<VerificationResult> => {
    try {
      const result = await domainWorkflow.process(
        {
          action: 'initiate',
          documentText,
          messageId: options.messageId
        },
        {
          step: 'verification_pending',
          onProgress: options.onProgress,
          metadata: {
            verificationMetadata: {
              verification_status: 'pending',
              correctionCount: 0,
              corrections: [],
              extractedData: documentText,
            }
          }
        }
      )
      
      if (result && 'error' in result && result.error) {
        // Log error with unified error handler
        await errorHandler.handleError({
          message: result.error,
          code: 'VERIFICATION_INITIATE_ERROR',
          workflowId: domainWorkflow.workflowId,
          details: {
            documentTextLength: typeof documentText === 'string' 
              ? documentText.length 
              : JSON.stringify(documentText).length
          }
        })
      }
      
      return result
    } catch (error) {
      // Handle unexpected errors with unified error handler
      const normalizedError = normalizeError(error)
      
      await errorHandler.handleError({
        message: normalizedError.message,
        code: normalizedError.code || 'UNEXPECTED_ERROR',
        workflowId: domainWorkflow.workflowId,
        details: {
          documentTextLength: typeof documentText === 'string' 
            ? documentText.length 
            : JSON.stringify(documentText).length
        }
      })
      
      return {
        success: false,
        error: normalizedError.message
      }
    }
  }, [domainWorkflow, errorHandler])
  
  /**
   * Process a correction for the current verification
   */
  const processCorrection = useCallback(async (
    correctionText: string,
    currentSummary: string,
    options: {
      messageId?: string,
      onProgress?: (progress: number, phase: ProcessingPhase) => void
    } = {}
  ): Promise<VerificationResult> => {
    try {
      // Get current summary ID
      const summaryId = domainWorkflow.summaryId || 
                       domainWorkflow.state.metadata?.currentSummaryId as string ||
                       domainWorkflow.state.metadata?.verificationMetadata?.currentSummaryId as string
      
      const result = await domainWorkflow.process(
        {
          action: 'correct',
          correctionText,
          currentSummary,
          summaryId,
          messageId: options.messageId
        },
        {
          step: 'verification_in_progress',
          onProgress: options.onProgress
        }
      )
      
      if (result && 'error' in result && result.error) {
        // Log error with unified error handler
        await errorHandler.handleError({
          message: result.error,
          code: 'VERIFICATION_CORRECTION_ERROR',
          workflowId: domainWorkflow.workflowId,
          details: { 
            correctionTextLength: correctionText.length,
            summaryId
          }
        })
      }
      
      return result
    } catch (error) {
      // Handle unexpected errors with unified error handler
      const normalizedError = normalizeError(error)
      
      await errorHandler.handleError({
        message: normalizedError.message,
        code: normalizedError.code || 'UNEXPECTED_ERROR',
        workflowId: domainWorkflow.workflowId,
        details: { 
          correctionTextLength: correctionText.length
        }
      })
      
      return {
        success: false,
        error: normalizedError.message
      }
    }
  }, [domainWorkflow, errorHandler])
  
  /**
   * Complete the verification process
   */
  const completeVerification = useCallback(async (finalSummaryId?: string): Promise<VerificationResult> => {
    try {
      const summaryIdToUse = finalSummaryId || 
                            domainWorkflow.summaryId || 
                            domainWorkflow.state.metadata?.currentSummaryId as string ||
                            domainWorkflow.state.metadata?.verificationMetadata?.currentSummaryId as string
      
      const result = await domainWorkflow.process(
        {
          action: 'complete',
          summaryId: summaryIdToUse
        },
        {
          step: 'verification_completed',
          metadata: {
            verificationMetadata: {
              verification_status: 'completed',
              verifiedAt: new Date().toISOString(),
              verifiedBy: userId,
            }
          }
        }
      )
      
      if (result && 'error' in result && result.error) {
        // Log error with unified error handler
        await errorHandler.handleError({
          message: result.error,
          code: 'VERIFICATION_COMPLETE_ERROR',
          workflowId: domainWorkflow.workflowId,
          details: { summaryId: summaryIdToUse }
        })
      }
      
      return result
    } catch (error) {
      // Handle unexpected errors with unified error handler
      const normalizedError = normalizeError(error)
      
      await errorHandler.handleError({
        message: normalizedError.message,
        code: normalizedError.code || 'UNEXPECTED_ERROR',
        workflowId: domainWorkflow.workflowId
      })
      
      return {
        success: false,
        error: normalizedError.message
      }
    }
  }, [domainWorkflow, userId, errorHandler])
  
  /**
   * Reject the verification (mark as failed)
   */
  const rejectVerification = useCallback(async (reason: string): Promise<VerificationResult> => {
    try {
      const summaryId = domainWorkflow.summaryId || 
                       domainWorkflow.state.metadata?.currentSummaryId as string ||
                       domainWorkflow.state.metadata?.verificationMetadata?.currentSummaryId as string
      
      const result = await domainWorkflow.process(
        {
          action: 'reject',
          reason,
          summaryId
        },
        {
          step: 'verification_failed',
          metadata: {
            verificationMetadata: {
              verification_status: 'rejected',
              rejectedAt: new Date().toISOString(),
              rejectedBy: userId,
              rejectionReason: reason
            }
          }
        }
      )
      
      if (result && 'error' in result && result.error) {
        // Log error with unified error handler
        await errorHandler.handleError({
          message: result.error,
          code: 'VERIFICATION_REJECT_ERROR',
          workflowId: domainWorkflow.workflowId,
          details: { 
            summaryId,
            reason
          }
        })
      }
      
      return result
    } catch (error) {
      // Handle unexpected errors with unified error handler
      const normalizedError = normalizeError(error)
      
      await errorHandler.handleError({
        message: normalizedError.message,
        code: normalizedError.code || 'UNEXPECTED_ERROR',
        workflowId: domainWorkflow.workflowId,
        details: { reason }
      })
      
      return {
        success: false,
        error: normalizedError.message
      }
    }
  }, [domainWorkflow, userId, errorHandler])
  
  /**
   * Reset verification back to idle state with improved error handling
   */
  const resetVerification = useCallback(async (): Promise<void> => {
    try {
      await domainWorkflow.reset()
      
      // Update metadata to reflect reset
      if (domainWorkflow.workflowId) {
        await updateMetadataSafely(
          domainWorkflow.workflowId,
          {
            verificationMetadata: {
              resetAt: new Date().toISOString(),
              resetBy: userId || 'system',
              verification_status: 'pending',
              correctionCount: 0
            }
          },
          {
            transactionId: crypto.randomUUID(),
            conflictStrategy: 'merge'
          },
          'Verification'
        )
      }
    } catch (error) {
      const normalizedError = normalizeError(error)
      domainLogger.error('Error resetting verification workflow:', {
        error: normalizedError.message,
        workflowId: domainWorkflow.workflowId
      })
      
      // Log but don't throw - reset should be best-effort
      await errorHandler.handleError({
        message: normalizedError.message,
        code: 'VERIFICATION_RESET_ERROR',
        workflowId: domainWorkflow.workflowId,
        severity: 'LOW'
      })
    }
  }, [domainWorkflow, userId, errorHandler])
  
  /**
   * Get verification status using Result pattern
   */
  const getVerificationStatus = useCallback(async (): Promise<VerificationStatus | null> => {
    try {
      if (!domainWorkflow.workflowId) {
        throw new Error('Workflow not initialized')
      }
      
      const summaryId = domainWorkflow.state.metadata?.currentSummaryId as string ||
                       domainWorkflow.state.metadata?.verificationMetadata?.currentSummaryId as string
      
      if (!summaryId) {
        return null
      }
      
      // Use read transaction for read-only operations
      const result = await transactionManager.executeReadTransaction(
        domainWorkflow.workflowId,
        async () => {
          return await workflowVerificationService.getVerificationStatus(
            domainWorkflow.workflowId,
            summaryId
          )
        }
      )
      
      if (result.isSuccess()) {
        return result.value
      } else {
        domainLogger.warn('Error getting verification status:', {
          error: result.error.message,
          workflowId: domainWorkflow.workflowId
        })
        return null
      }
    } catch (error) {
      const normalizedError = normalizeError(error)
      domainLogger.error('Error getting verification status:', {
        error: normalizedError.message,
        workflowId: domainWorkflow.workflowId
      })
      
      return null
    }
  }, [domainWorkflow.workflowId, domainWorkflow.state.metadata])
  
  // Get verification summary ID from state using getDomainMetadata helper
  const [currentSummaryId, setCurrentSummaryId] = useState<string | undefined>(
    domainWorkflow.state.metadata?.currentSummaryId as string ||
    domainWorkflow.state.metadata?.verificationMetadata?.currentSummaryId as string
  )
  
  // Fetch correction history from metadata when workflowId changes
  const [correctionHistory, setCorrectionHistory] = useState<any[]>([])
  
  // Fetch metadata from workflowId changes
  useEffect(() => {
    if (domainWorkflow.workflowId) {
      // Fetch current summary ID
      getDomainMetadata<{
        verificationMetadata?: { 
          currentSummaryId?: string,
          summaryId?: string,
          corrections?: any[]
        }
      }>(
        domainWorkflow.workflowId,
        'verificationMetadata',
        undefined,
        'Verification'
      ).then(result => {
        if (result.isSuccess() && result.value?.verificationMetadata) {
          const metadata = result.value.verificationMetadata
          
          // Update summary ID
          setCurrentSummaryId(
            metadata.currentSummaryId || 
            metadata.summaryId ||
            domainWorkflow.state.metadata?.currentSummaryId as string
          )
          
          // Update correction history
          if (metadata.corrections) {
            setCorrectionHistory(metadata.corrections)
          }
        }
      }).catch(error => {
        domainLogger.warn('Error fetching verification metadata', {
          error: error instanceof Error ? error.message : String(error),
          workflowId: domainWorkflow.workflowId
        })
      })
    }
  }, [domainWorkflow.workflowId, domainWorkflow.state.metadata])
  
  // Compute derived states for backward compatibility
  const isVerifying =
    domainWorkflow.state.currentStep === 'verification' ||
    domainWorkflow.state.currentStep === 'verification_pending' ||
    domainWorkflow.state.currentStep === 'verification_in_progress'
  
  const isVerificationComplete = domainWorkflow.state.currentStep === 'verification_completed'
  
  const isVerificationFailed = domainWorkflow.state.currentStep === 'verification_failed'
  
  // Return the same API shape as before with new implementation
  return {
    ...domainWorkflow,
    initiateVerification,
    processCorrection,
    completeVerification,
    rejectVerification,
    resetVerification,
    getVerificationStatus,
    verificationSummary: domainWorkflow,
    isVerifying,
    isVerificationComplete,
    isVerificationFailed,
    currentSummaryId,
    correctionHistory
  }
}