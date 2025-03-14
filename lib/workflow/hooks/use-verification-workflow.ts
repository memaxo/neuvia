import { useState, useCallback } from 'react'
import { ProcessingPhase, DomainOnlyWorkflowStep } from '@/lib/types/workflow'
import { createWorkflowHook } from './create-workflow-hook'
import { workflowService } from '@/lib/services/workflow/core/workflow-service'
import { normalizeError } from '@/lib/errors'
import { VerificationStatus } from '@/lib/types/verification'

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

// Result type for verification workflow actions
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
 * Domain actions for verification workflow
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
   * Process verification workflow action
   */
  processAction: async (
    input: VerificationInput,
    options: {
      workflowId: string
      userId?: string
      onProgress?: (progress: number, phase: ProcessingPhase) => void
    }
  ): Promise<VerificationResult> => {
    const { action } = input
    const { workflowId, userId, onProgress } = options
    
    if (!workflowId) {
      throw new Error('Workflow not initialized. Make sure userId is provided.')
    }
    
    if (action === 'initiate' && input.documentText) {
      if (!userId || !options.chatId) {
        throw new Error('User ID and Chat ID are required for verification')
      }
      
      // Prepare document text
      let textToVerify = typeof input.documentText === 'string'
        ? input.documentText
        : (input.documentText as { text?: string }).text ?? JSON.stringify(input.documentText)
      
      // Generate summary ID
      const summaryId = input.summaryId || crypto.randomUUID()
      
      // Use the verification workflow processor
      const result = await workflowService.initiateVerification(
        workflowId,
        {
          documentText: textToVerify,
          summaryId,
          chatId: options.chatId,
          messageId: input.messageId,
          useGemini: true,
          progressCallback: onProgress
        }
      )
      
      return {
        success: true,
        summaryId,
        summary: result.summary,
        structuredData: result.structuredData,
        status: 'pending'
      }
    }
    else if (action === 'correct' && input.correctionText && input.currentSummary) {
      if (!userId || !options.chatId) {
        throw new Error('User ID and Chat ID are required for verification')
      }
      
      // Generate new summary ID
      const newSummaryId = crypto.randomUUID()
      
      // Use the verification workflow processor
      const result = await workflowService.processVerificationCorrection(
        workflowId,
        input.summaryId || '',
        {
          correctionText: input.correctionText,
          currentSummary: input.currentSummary,
          newSummaryId,
          messageId: input.messageId,
          progressCallback: onProgress
        }
      )
      
      return {
        success: true,
        summaryId: newSummaryId,
        summary: result.summary,
        structuredData: result.structuredData,
        correctionCount: (result.correctionCount || 0) + 1,
        status: 'inProgress'
      }
    }
    else if (action === 'complete') {
      if (!userId) {
        throw new Error('User ID required for verification completion')
      }
      
      // Use the verification workflow processor
      const result = await workflowService.completeVerification(
        workflowId,
        input.summaryId || '',
        userId,
        false // don't auto-generate report
      )
      
      return {
        success: true,
        summaryId: input.summaryId,
        verified: true,
        verifiedBy: userId,
        verifiedAt: new Date().toISOString(),
        status: 'completed'
      }
    }
    else if (action === 'reject' && input.reason) {
      if (!userId) {
        throw new Error('User ID required for verification rejection')
      }
      
      // Use the verification workflow processor
      const result = await workflowService.rejectVerification(
        workflowId,
        input.summaryId || '',
        userId,
        input.reason
      )
      
      return {
        success: true,
        status: 'rejected'
      }
    }
    else if (action === 'reset') {
      return {
        success: true,
        summaryId: '',
        summary: '',
        correctionCount: 0,
        status: 'pending'
      }
    }
    
    throw new Error('Invalid verification action')
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

// Create the verification domain workflow hook
const useVerificationDomainWorkflow = createWorkflowHook<VerificationInput, VerificationResult, VerificationState>(
  verificationWorkflowActions
)

/**
 * Specialized hook for verification workflows.
 * Provides an intuitive API for verifying extracted content.
 */
export function useVerificationWorkflow(options: UseVerificationWorkflowOptions = {}) {
  const { userId, chatId } = options
  
  // Use the domain workflow hook
  const domainWorkflow = useVerificationDomainWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  // Maintain backward compatibility with existing API
  
  /**
   * Initiate verification process with extracted data
   */
  const initiateVerification = useCallback(async (
    documentText: string | Record<string, unknown>,
    options: {
      messageId?: string,
      onProgress?: (progress: number, phase: ProcessingPhase) => void
    } = {}
  ) => {
    return domainWorkflow.process(
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
  }, [domainWorkflow])
  
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
  ) => {
    return domainWorkflow.process(
      {
        action: 'correct',
        correctionText,
        currentSummary,
        summaryId: domainWorkflow.summaryId || domainWorkflow.state.metadata?.currentSummaryId as string,
        messageId: options.messageId
      },
      {
        step: 'verification_in_progress',
        onProgress: options.onProgress
      }
    )
  }, [domainWorkflow])
  
  /**
   * Complete the verification process
   */
  const completeVerification = useCallback(async (finalSummaryId?: string) => {
    return domainWorkflow.process(
      {
        action: 'complete',
        summaryId: finalSummaryId || domainWorkflow.summaryId || domainWorkflow.state.metadata?.currentSummaryId as string
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
  }, [domainWorkflow, userId])
  
  /**
   * Reject the verification (mark as failed)
   */
  const rejectVerification = useCallback(async (reason: string) => {
    return domainWorkflow.process(
      {
        action: 'reject',
        reason,
        summaryId: domainWorkflow.summaryId || domainWorkflow.state.metadata?.currentSummaryId as string
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
  }, [domainWorkflow, userId])
  
  /**
   * Reset verification back to idle state
   */
  const resetVerification = useCallback(async () => {
    return domainWorkflow.reset()
  }, [domainWorkflow])
  
  /**
   * Get verification status
   */
  const getVerificationStatus = useCallback(async () => {
    try {
      if (!domainWorkflow.workflowId) {
        throw new Error('Workflow not initialized')
      }
      
      const summaryId = domainWorkflow.state.metadata?.currentSummaryId as string
      
      if (!summaryId) {
        return null
      }
      
      // Use service to get status
      const result = await workflowService.getVerificationStatus(
        domainWorkflow.workflowId,
        summaryId
      )
      
      return result
    } catch (err) {
      console.error('Error getting verification status:', err)
      return null
    }
  }, [domainWorkflow.workflowId, domainWorkflow.state.metadata?.currentSummaryId])
  
  // Compute derived states for backward compatibility
  const isVerifying =
    domainWorkflow.state.currentStep === 'verification' ||
    domainWorkflow.state.currentStep === 'verification_pending' ||
    domainWorkflow.state.currentStep === 'verification_in_progress'
  
  const isVerificationComplete = domainWorkflow.state.currentStep === 'verification_completed'
  
  const isVerificationFailed = domainWorkflow.state.currentStep === 'verification_failed'
  
  // Return the same API shape as before
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
    currentSummaryId: domainWorkflow.state.metadata?.currentSummaryId as string,
    correctionHistory: domainWorkflow.state.metadata?.correctionHistory as any[]
  }
}