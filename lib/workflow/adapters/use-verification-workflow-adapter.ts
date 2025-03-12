/**
 * @fileoverview Verification Workflow Hook Adapter
 * 
 * This adapter converts the VerificationWorkflowService to a React hook
 * that can be used in components.
 */

import { useState, useEffect, useCallback } from 'react'
import { VerificationWorkflowService, VerificationResult } from '../services/verification-workflow-service'
import { workflowServiceFactory } from '../services/workflow-service-factory'
import { WorkflowState, WorkflowStep, ProcessingPhase } from '@/lib/types/workflow'

export interface UseVerificationWorkflowOptions {
  userId?: string
  chatId?: string
  initialStep?: WorkflowStep
}

/**
 * React hook adapter for VerificationWorkflowService
 */
export function useVerificationWorkflowAdapter(options: UseVerificationWorkflowOptions = {}) {
  const { userId, chatId, initialStep = 'idle' } = options
  
  // Get or create the verification workflow service
  const service = workflowServiceFactory.getVerificationWorkflowService(userId, chatId)
  
  // State
  const [state, setState] = useState<WorkflowState>(service.getState() || {
    currentStep: initialStep,
    progress: 0,
    phase: ProcessingPhase.INITIALIZATION,
    error: null,
    metadata: {},
    timestamp: new Date().toISOString()
  })
  
  const [verificationResult, setVerificationResult] = useState<VerificationResult>(
    service.getVerificationResult() || { success: false }
  )
  
  const [workflowId, setWorkflowId] = useState<string | undefined>(
    service.getWorkflowId()
  )
  
  const [currentSummary, setCurrentSummary] = useState<string | null>(
    service.getCurrentSummary()
  )
  
  // Subscribe to state changes
  useEffect(() => {
    // Update state when service state changes
    const handleStateChange = (newState: WorkflowState) => {
      setState(newState)
    }
    
    // Update result when verification result changes
    const handleResultChange = (result: VerificationResult) => {
      setVerificationResult(result)
    }
    
    // Update workflow ID when it changes
    const handleWorkflowIdChange = (id?: string) => {
      setWorkflowId(id)
    }
    
    // Update current summary when it changes
    const handleSummaryChange = (summary: string | null) => {
      setCurrentSummary(summary)
    }
    
    // Subscribe to events
    service.on('stateChange', handleStateChange)
    service.on('verificationResult', handleResultChange)
    service.on('summaryChange', handleSummaryChange)
    
    // Initial state sync
    setState(service.getState())
    setVerificationResult(service.getVerificationResult())
    setWorkflowId(service.getWorkflowId())
    setCurrentSummary(service.getCurrentSummary())
    
    // Clean up subscriptions
    return () => {
      service.off('stateChange', handleStateChange)
      service.off('verificationResult', handleResultChange)
      service.off('summaryChange', handleSummaryChange)
    }
  }, [service, userId, chatId])
  
  // Methods
  const updateStep = useCallback(
    async (step: WorkflowStep, metadata?: Record<string, unknown>) => {
      return service.updateStep(step, metadata)
    },
    [service]
  )
  
  const updateProgress = useCallback(
    async (progress: number, phase?: ProcessingPhase) => {
      return service.updateProgress(progress, phase)
    },
    [service]
  )
  
  const initiateVerification = useCallback(
    async (extractedDocument: string | Record<string, unknown>, messageId?: string) => {
      return service.initiateVerification(extractedDocument, messageId)
    },
    [service]
  )
  
  const processCorrection = useCallback(
    async (correctionText: string, currentSummary?: string, messageId?: string) => {
      return service.processCorrection(correctionText, currentSummary, messageId)
    },
    [service]
  )
  
  const completeVerification = useCallback(
    async (finalSummaryId?: string) => {
      return service.completeVerification(finalSummaryId)
    },
    [service]
  )
  
  const resetVerification = useCallback(
    async () => {
      return service.resetVerification()
    },
    [service]
  )
  
  // Return hook interface
  return {
    // State
    state,
    verificationResult,
    workflowId,
    currentSummary,
    
    // Computed status properties
    status: service.getStatus(),
    
    // Methods
    updateStep,
    updateProgress,
    initiateVerification,
    processCorrection,
    completeVerification,
    resetVerification
  }
}