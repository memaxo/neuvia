import { useCallback, useState } from 'react'
import { useBaseWorkflow, UseBaseWorkflowOptions } from './useBaseWorkflow'
import { normalizeError } from '@/lib/errors'
import { ProcessingPhase } from '@/lib/types/workflow'

/**
 * Options for verification workflow
 */
export interface UseVerificationWorkflowOptions extends UseBaseWorkflowOptions {
  autoVerify?: boolean;
}

/**
 * Verification result
 */
export interface VerificationResult {
  summaryId?: string;
  summary?: string;
  structuredData?: Record<string, unknown>;
  correctionCount?: number;
  status?: 'pending' | 'inProgress' | 'completed' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  success: boolean;
  error?: string;
}

/**
 * Simplified hook for verification workflows.
 */
export function useVerificationWorkflow(options: UseVerificationWorkflowOptions = {}) {
  const baseWorkflow = useBaseWorkflow({
    userId: options.userId,
    chatId: options.chatId,
    initialStep: options.initialStep || 'verification_pending',
    autoLoad: options.autoLoad ?? true,
    onError: options.onError,
    onStateChange: options.onStateChange
  })
  
  // Get current summary from metadata
  const [currentSummary, setCurrentSummary] = useState<string | null>(
    (baseWorkflow.state.metadata?.summary as string) || null
  )
  
  /**
   * Initialize verification process with document text
   */
  const initiateVerification = useCallback(async (
    documentText: string | Record<string, unknown>,
    options?: {
      messageId?: string;
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
    }
  ): Promise<VerificationResult> => {
    try {
      // Update step to verification_pending
      await baseWorkflow.updateStep(
        'verification_pending',
        {
          verificationStartedAt: new Date().toISOString(),
          messageId: options?.messageId
        }
      )
      
      // Track progress
      const onProgress = options?.onProgress || (() => {});
      onProgress(10, ProcessingPhase.VERIFICATION_PENDING)
      
      // Convert document to string if needed
      let textContent: string;
      if (typeof documentText === 'object' && documentText !== null) {
        textContent = (documentText as { text?: string }).text || JSON.stringify(documentText);
      } else {
        textContent = String(documentText);
      }
      
      // Call API to generate the summary
      const response = await fetch('/api/verification/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: textContent,
          messageId: options?.messageId
        })
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Verification initiation failed: ${error}`)
      }
      
      const result = await response.json()
      
      // Update the state with summary
      const summary = result.summary
      setCurrentSummary(summary)
      
      // Update workflow to verification_in_progress
      await baseWorkflow.updateStep(
        'verification_in_progress',
        {
          summaryId: result.summaryId,
          summary,
          structuredData: result.structuredData,
          correctionCount: 0,
          verificationStatus: 'pending'
        }
      )
      
      onProgress(100, ProcessingPhase.VERIFICATION_PENDING)
      
      // Return result
      return {
        summaryId: result.summaryId,
        summary,
        structuredData: result.structuredData,
        correctionCount: 0,
        status: 'pending',
        success: true
      }
    } catch (error) {
      const normalizedError = normalizeError(error)
      
      // Set workflow to error state
      await baseWorkflow.updateStep(
        'error',
        {
          error: normalizedError.message,
          errorTimestamp: new Date().toISOString()
        }
      )
      
      // Return error result
      return {
        success: false,
        error: normalizedError.message
      }
    }
  }, [baseWorkflow])
  
  /**
   * Process a correction to the summary
   */
  const processCorrection = useCallback(async (
    correctionText: string,
    summary: string,
    options?: {
      messageId?: string;
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
    }
  ): Promise<VerificationResult> => {
    try {
      // Verify we have a summary
      if (!summary) {
        throw new Error('No summary available to correct')
      }
      
      // Track progress
      const onProgress = options?.onProgress || (() => {});
      onProgress(20, ProcessingPhase.VERIFICATION)
      
      // Get current correction count
      const correctionCount = (baseWorkflow.state.metadata?.correctionCount as number) || 0
      
      // Call API to process correction
      const response = await fetch('/api/verification/correct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          correctionText,
          currentSummary: summary,
          messageId: options?.messageId
        })
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Correction processing failed: ${error}`)
      }
      
      const result = await response.json()
      
      // Update the state with new summary
      const newSummary = result.summary
      setCurrentSummary(newSummary)
      
      // Update workflow with new summary
      await baseWorkflow.updateStep(
        'verification_in_progress',
        {
          summaryId: result.summaryId,
          summary: newSummary,
          correctionCount: correctionCount + 1,
          correctionTimestamp: new Date().toISOString(),
          verificationStatus: 'inProgress'
        }
      )
      
      onProgress(100, ProcessingPhase.VERIFICATION)
      
      // Return result
      return {
        summaryId: result.summaryId,
        summary: newSummary,
        correctionCount: correctionCount + 1,
        status: 'inProgress',
        success: true
      }
    } catch (error) {
      const normalizedError = normalizeError(error)
      
      // Verification stays in_progress even with error
      // Return error result
      return {
        success: false,
        error: normalizedError.message
      }
    }
  }, [baseWorkflow])
  
  /**
   * Complete verification process
   */
  const completeVerification = useCallback(async (): Promise<VerificationResult> => {
    try {
      // Get necessary info from state
      const summaryId = baseWorkflow.state.metadata?.summaryId as string
      
      if (!summaryId) {
        throw new Error('No summary ID available')
      }
      
      // Call API to complete verification
      const response = await fetch('/api/verification/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ summaryId })
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Verification completion failed: ${error}`)
      }
      
      // Update workflow to verification_completed
      await baseWorkflow.updateStep(
        'verification_completed',
        {
          verificationCompletedAt: new Date().toISOString(),
          verificationStatus: 'completed'
        }
      )
      
      // Return result
      return {
        summaryId,
        status: 'completed',
        verifiedBy: baseWorkflow.state.metadata?.userId as string,
        verifiedAt: new Date().toISOString(),
        success: true
      }
    } catch (error) {
      const normalizedError = normalizeError(error)
      
      // Set workflow to error state
      await baseWorkflow.updateStep(
        'error',
        {
          error: normalizedError.message,
          errorTimestamp: new Date().toISOString()
        }
      )
      
      // Return error result
      return {
        success: false,
        error: normalizedError.message
      }
    }
  }, [baseWorkflow])
  
  /**
   * Reject verification
   */
  const rejectVerification = useCallback(async (
    reason: string
  ): Promise<VerificationResult> => {
    try {
      // Update workflow to verification_failed
      await baseWorkflow.updateStep(
        'verification_failed',
        {
          verificationRejectedAt: new Date().toISOString(),
          rejectionReason: reason,
          verificationStatus: 'rejected'
        }
      )
      
      // Return result
      return {
        status: 'rejected',
        success: true
      }
    } catch (error) {
      const normalizedError = normalizeError(error)
      
      // Return error result
      return {
        success: false,
        error: normalizedError.message
      }
    }
  }, [baseWorkflow])
  
  /**
   * Reset verification to pending state
   */
  const resetVerification = useCallback(async (): Promise<boolean> => {
    setCurrentSummary(null)
    await baseWorkflow.resetWorkflow()
    return true
  }, [baseWorkflow])
  
  // Compute derived states for backward compatibility
  const isVerifying =
    baseWorkflow.state.currentStep === 'verification_pending' ||
    baseWorkflow.state.currentStep === 'verification_in_progress'
  
  const isVerificationComplete = baseWorkflow.state.currentStep === 'verification_completed'
  
  // Return combined API
  return {
    ...baseWorkflow,
    initiateVerification,
    processCorrection,
    completeVerification,
    rejectVerification,
    resetVerification,
    verificationResult: baseWorkflow.state,
    isVerifying,
    isVerificationComplete,
    currentSummary,
    getCurrentSummary: () => currentSummary
  }
}

// Export for convenience
export default useVerificationWorkflow