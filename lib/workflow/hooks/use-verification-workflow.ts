import { useState, useCallback } from 'react'
import type { VerificationMetadata } from '@/lib/types/verification'
import { ProcessingPhase, DomainOnlyWorkflowStep } from '@/lib/types/workflow'
import { useWorkflow } from '../use-workflow'
import { workflowService } from '@/lib/services/workflow/core/workflow-service'
import { useWorkflowErrorHandler } from '../workflow-error-handler'
import { normalizeError } from '@/lib/errors'

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

/**
 * Specialized hook for verification workflows.
 * Provides an intuitive API for verifying extracted content.
 */
export function useVerificationWorkflow(options: UseVerificationWorkflowOptions = {}) {
  const { userId, chatId } = options
  const errorHandler = useWorkflowErrorHandler()
  const [verificationSummary, setVerificationSummary] = useState<VerificationSummary>({
    summaryId: '',
    summary: '',
    correctionCount: 0,
    status: 'pending',
    verified: false
  })
  
  // Use base workflow hook
  const workflow = useWorkflow({
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
  ) => {
    try {
      if (!workflow.workflowId) {
        throw new Error('Workflow not initialized. Make sure userId is provided.')
      }
      
      if (!userId || !chatId) {
        throw new Error('User ID and Chat ID are required for verification')
      }
      
      // Prepare document text
      let textToVerify = typeof documentText === 'string' 
        ? documentText 
        : (documentText as { text?: string }).text ?? JSON.stringify(documentText)
      
      // Generate summary ID
      const summaryId = crypto.randomUUID()
      
      // Update workflow state to verification pending
      await workflow.updateStep("verification_pending", {
        verificationMetadata: {
          verification_status: 'pending',
          originalSummaryId: summaryId,
          currentVersionId: summaryId,
          correctionCount: 0,
          corrections: [],
          extractedData: documentText,
        } as unknown as VerificationMetadata,
        currentSummaryId: summaryId,
        correctionHistory: [],
      })
      
      // Progress callback function
      const progressCallback = (progress: number, phase: ProcessingPhase) => {
        workflow.updateProgress(progress, phase)
        if (options.onProgress) {
          options.onProgress(progress, phase)
        }
      }
      
      // Use the verification workflow processor
      const result = await workflowService.initiateVerification(
        workflow.workflowId,
        {
          documentText: textToVerify,
          summaryId,
          chatId: chatId,
          messageId: options.messageId,
          useGemini: true,
          progressCallback
        }
      )
      
      // Update local state
      setVerificationSummary({
        summaryId,
        summary: result.summary,
        structuredData: result.structuredData,
        correctionCount: 0,
        verified: false,
        status: 'pending'
      })
      
      return {
        summaryId,
        summary: result.summary,
        structuredData: result.structuredData
      }
    } catch (err) {
      const error = normalizeError(err)
      
      // Update error state
      await workflow.updateStep(DomainOnlyWorkflowStep.ERROR, {
        error: error.message,
        errorTimestamp: new Date().toISOString(),
      })
      
      await errorHandler.handleError(
        err,
        "verification_pending",
        { 
          previousStep: workflow.state.currentStep, 
          details: { documentText, messageId: options.messageId }, 
          showToast: true,
          workflowId: workflow.workflowId ?? undefined
        }
      )
      
      throw error
    }
  }, [workflow, userId, chatId, errorHandler])
  
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
    try {
      if (!workflow.workflowId || !userId || !chatId) {
        throw new Error('Missing required IDs for correction processing')
      }
      
      if (!workflow.state.metadata?.currentSummaryId) {
        throw new Error('No active verification summary found')
      }
      
      // Get current summary ID
      const currentSummaryId = workflow.state.metadata.currentSummaryId as string
      
      // Generate new summary ID
      const newSummaryId = crypto.randomUUID()
      
      // Update local state
      const correctionHistory = [
        ...(workflow.state.metadata?.correctionHistory as any[] || []),
        {
          correction_text: correctionText,
          timestamp: new Date().toISOString(),
          summary_id: newSummaryId,
          message_id: options.messageId,
        },
      ]
      
      // Update workflow state
      await workflow.updateStep("verification_in_progress", {
        correctionHistory,
        currentSummaryId: newSummaryId,
      })
      
      // Progress callback
      const progressCallback = (progress: number, phase: ProcessingPhase) => {
        workflow.updateProgress(progress, phase)
        if (options.onProgress) {
          options.onProgress(progress, phase)
        }
      }
      
      // Use the verification workflow processor
      const result = await workflowService.processVerificationCorrection(
        workflow.workflowId,
        currentSummaryId,
        {
          correctionText,
          currentSummary,
          newSummaryId,
          messageId: options.messageId,
          progressCallback
        }
      )
      
      // Update local verification state
      setVerificationSummary(prev => ({
        ...prev,
        summaryId: newSummaryId,
        summary: result.summary,
        structuredData: result.structuredData,
        correctionCount: correctionHistory.length,
        status: 'inProgress'
      }))
      
      return {
        summaryId: newSummaryId,
        summary: result.summary,
        structuredData: result.structuredData,
        correctionCount: correctionHistory.length,
      }
    } catch (err) {
      const error = normalizeError(err)
      
      // Update error state
      await workflow.updateStep(DomainOnlyWorkflowStep.ERROR, {
        error: error.message,
        errorTimestamp: new Date().toISOString(),
      })
      
      await errorHandler.handleError(
        err,
        "verification_in_progress",
        { 
          previousStep: workflow.state.currentStep, 
          details: { correctionText, messageId: options.messageId }, 
          showToast: true,
          workflowId: workflow.workflowId ?? undefined
        }
      )
      
      throw error
    }
  }, [workflow, userId, chatId, errorHandler])
  
  /**
   * Complete the verification process
   */
  const completeVerification = useCallback(async (finalSummaryId?: string) => {
    try {
      if (!workflow.workflowId || !userId) {
        throw new Error('Workflow ID and User ID are required for verification completion')
      }
      
      // Get summary ID to use
      const summaryIdToUse = finalSummaryId ?? (workflow.state.metadata?.currentSummaryId as string)
      
      if (!summaryIdToUse) {
        throw new Error('No summary ID available for verification completion')
      }
      
      // Use verification workflow processor
      const result = await workflowService.completeVerification(
        workflow.workflowId,
        summaryIdToUse,
        userId,
        false // don't auto-generate report
      )
      
      // Update local state
      setVerificationSummary(prev => ({
        ...prev,
        verified: true,
        verifiedBy: userId,
        verifiedAt: new Date().toISOString(),
        status: 'completed'
      }))
      
      // Update workflow state
      await workflow.updateStep("verification_completed", {
        verificationMetadata: {
          verification_status: 'completed',
          verifiedAt: new Date().toISOString(),
          verifiedBy: userId,
        }
      })
      
      return {
        success: true,
        summaryId: summaryIdToUse,
        correctionCount: verificationSummary.correctionCount
      }
    } catch (err) {
      const error = normalizeError(err)
      
      // Update error state
      await workflow.updateStep(DomainOnlyWorkflowStep.ERROR, {
        error: error.message,
        errorTimestamp: new Date().toISOString(),
      })
      
      await errorHandler.handleError(
        err,
        "verification_completed",
        { 
          previousStep: workflow.state.currentStep, 
          details: { finalSummaryId }, 
          showToast: true,
          workflowId: workflow.workflowId ?? undefined
        }
      )
      
      throw error
    }
  }, [workflow, userId, verificationSummary.correctionCount, errorHandler])
  
  /**
   * Reject the verification (mark as failed)
   */
  const rejectVerification = useCallback(async (reason: string) => {
    try {
      if (!workflow.workflowId || !userId) {
        throw new Error('Workflow ID and User ID are required for verification rejection')
      }
      
      const summaryId = workflow.state.metadata?.currentSummaryId as string
      
      if (!summaryId) {
        throw new Error('No summary ID available for verification rejection')
      }
      
      // Use verification workflow processor
      const result = await workflowService.rejectVerification(
        workflow.workflowId,
        summaryId,
        userId,
        reason
      )
      
      // Update local state
      setVerificationSummary(prev => ({
        ...prev,
        status: 'rejected'
      }))
      
      // Update workflow state
      await workflow.updateStep("verification_failed", {
        verificationMetadata: {
          verification_status: 'rejected',
          rejectedAt: new Date().toISOString(),
          rejectedBy: userId,
          rejectionReason: reason
        }
      })
      
      return {
        success: true,
        reason
      }
    } catch (err) {
      const error = normalizeError(err)
      
      // Update error state
      await workflow.updateStep(DomainOnlyWorkflowStep.ERROR, {
        error: error.message,
        errorTimestamp: new Date().toISOString(),
      })
      
      throw error
    }
  }, [workflow, userId])
  
  /**
   * Reset verification back to idle state
   */
  const resetVerification = useCallback(async () => {
    try {
      // Reset local state
      setVerificationSummary({
        summaryId: '',
        summary: '',
        correctionCount: 0,
        verified: false,
        status: 'pending'
      })
      
      // Reset workflow state
      await workflow.updateStep("idle", {
        verificationMetadata: null,
        currentSummaryId: null,
        correctionHistory: [],
      })
      
      return { success: true }
    } catch (err) {
      const error = normalizeError(err)
      console.error('Error resetting verification:', error.message)
      
      await errorHandler.handleError(
        err,
        "idle", 
        { 
          previousStep: workflow.state.currentStep, 
          details: { action: 'resetVerification' }, 
          showToast: true,
          workflowId: workflow.workflowId ?? undefined
        }
      )
      
      throw error
    }
  }, [workflow, errorHandler])
  
  /**
   * Get verification status
   */
  const getVerificationStatus = useCallback(async () => {
    try {
      if (!workflow.workflowId) {
        throw new Error('Workflow not initialized')
      }
      
      const summaryId = workflow.state.metadata?.currentSummaryId as string
      
      if (!summaryId) {
        return null
      }
      
      // Use service to get status
      const result = await workflowService.getVerificationStatus(
        workflow.workflowId,
        summaryId
      )
      
      if (result) {
        // Update local state with latest status
        setVerificationSummary({
          summaryId,
          summary: result.summary || '',
          structuredData: result.structuredData,
          correctionCount: result.correctionCount || 0,
          verified: result.status === 'completed',
          verifiedBy: result.verifiedBy,
          verifiedAt: result.verifiedAt,
          status: result.status as any
        })
      }
      
      return result
    } catch (err) {
      console.error('Error getting verification status:', err)
      return null
    }
  }, [workflow.workflowId, workflow.state.metadata?.currentSummaryId])
  
  return {
    ...workflow,
    initiateVerification,
    processCorrection,
    completeVerification,
    rejectVerification,
    resetVerification,
    getVerificationStatus,
    verificationSummary,
    isVerifying: workflow.state.currentStep === 'verification' || 
                 workflow.state.currentStep === 'verification_pending' || 
                 workflow.state.currentStep === 'verification_in_progress',
    isVerificationComplete: workflow.state.currentStep === 'verification_completed',
    isVerificationFailed: workflow.state.currentStep === 'verification_failed',
    currentSummaryId: workflow.state.metadata?.currentSummaryId as string,
    correctionHistory: workflow.state.metadata?.correctionHistory as any[]
  }
}