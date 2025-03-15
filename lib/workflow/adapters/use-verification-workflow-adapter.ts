/**
 * @fileoverview Verification Workflow Hook Adapter
 * 
 * This adapter provides backward compatibility for the new functional verification workflow architecture.
 * Phase 4 implementation: Uses Result pattern and composition pattern.
 */

import { useState, useEffect, useCallback } from 'react'
import { WorkflowState, WorkflowStep, ProcessingPhase, DomainOnlyWorkflowStep } from '@/lib/types/workflow'
import { transactionManager } from '@/lib/services/workflow/transaction/transaction-manager'
import { useVerificationWorkflow as useNewVerificationWorkflow, VerificationSummary } from '../hooks/use-verification-workflow'
import { Result } from '@/lib/services/workflow/error/result'
import { normalizeError } from '@/lib/errors'
import { createDomainLogger } from '@/lib/services/workflow/infrastructure/workflow-processor-helpers'

// Domain-specific logger
const domainLogger = createDomainLogger('Verification')

export interface UseVerificationWorkflowOptions {
  userId?: string
  chatId?: string
  initialStep?: WorkflowStep
}

/**
 * Legacy result type for backward compatibility
 */
export interface VerificationResult {
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

/**
 * React hook adapter for verification workflow with backward compatibility
 */
export function useVerificationWorkflowAdapter(options: UseVerificationWorkflowOptions = {}) {
  const { userId, chatId, initialStep = 'idle' } = options
  
  // Use the new implementation internally
  const newWorkflow = useNewVerificationWorkflow({ 
    userId, 
    chatId 
  })
  
  // Legacy state for backward compatibility
  const [state, setState] = useState<WorkflowState>({
    currentStep: newWorkflow.state.currentStep || initialStep,
    progress: newWorkflow.state.progress || 0,
    phase: newWorkflow.state.phase || ProcessingPhase.INITIALIZATION,
    error: newWorkflow.state.error || null,
    metadata: newWorkflow.state.metadata || {},
    timestamp: new Date().toISOString()
  })
  
  // Format result in legacy format for backward compatibility
  const [verificationResult, setVerificationResult] = useState<VerificationResult>(
    convertToLegacyResult(newWorkflow)
  )
  
  // Keep workflowId
  const [workflowId, setWorkflowId] = useState<string | undefined>(
    newWorkflow.workflowId
  )
  
  // Keep current summary 
  const [currentSummary, setCurrentSummary] = useState<string | null>(
    newWorkflow.summary || null
  )
  
  // Sync with the new implementation state
  useEffect(() => {
    // Format as legacy state
    setState({
      currentStep: newWorkflow.state.currentStep || initialStep,
      progress: newWorkflow.state.progress || 0,
      phase: newWorkflow.state.phase || ProcessingPhase.INITIALIZATION,
      error: newWorkflow.state.error || null,
      metadata: newWorkflow.state.metadata || {},
      timestamp: new Date().toISOString()
    })
    
    // Format as legacy result
    setVerificationResult(convertToLegacyResult(newWorkflow))
    
    // Update workflow ID
    setWorkflowId(newWorkflow.workflowId)
    
    // Update current summary
    setCurrentSummary(newWorkflow.summary || null)
  }, [
    newWorkflow.state, 
    newWorkflow.workflowId, 
    newWorkflow.summary,
    newWorkflow.summaryId,
    newWorkflow.error,
    initialStep
  ])
  
  // Convert the new result to legacy format
  function convertToLegacyResult(workflow: ReturnType<typeof useNewVerificationWorkflow>): VerificationResult {
    if (workflow.error) {
      return {
        success: false,
        error: workflow.error,
        summaryId: workflow.summaryId
      }
    }
    
    let status: 'pending' | 'inProgress' | 'completed' | 'rejected' = 'pending'
    
    // Derive status from step
    switch (workflow.state.currentStep) {
      case 'verification_pending':
        status = 'pending'
        break
      case 'verification_in_progress':
        status = 'inProgress'
        break
      case 'verification_completed':
        status = 'completed'
        break
      case 'verification_failed':
        status = 'rejected'
        break
    }
    
    return {
      success: true,
      summaryId: workflow.summaryId,
      summary: workflow.summary,
      structuredData: workflow.structuredData,
      correctionCount: workflow.correctionCount,
      status,
      verifiedBy: workflow.verifiedBy,
      verifiedAt: workflow.verifiedAt
    }
  }
  
  // Methods adapted to the new API but with the old signature
  
  // Update step with backward compatible API
  const updateStep = useCallback(
    async (step: WorkflowStep, metadata?: Record<string, unknown>) => {
      try {
        // Use the transaction manager to update step
        if (!workflowId) return false
        
        const result = await transactionManager.executeTransaction(
          workflowId,
          async () => ({ success: true }),
          {
            step,
            metadata,
            domainName: 'Verification'
          }
        )
        
        return result.isSuccess()
      } catch (error) {
        console.error('Failed to update step:', error)
        return false
      }
    },
    [workflowId]
  )
  
  // Update progress with backward compatible API
  const updateProgress = useCallback(
    async (progress: number, phase?: ProcessingPhase) => {
      try {
        if (!workflowId) return false
        
        // Use transaction manager to update progress
        const currentPhase = phase || newWorkflow.state.phase || ProcessingPhase.PROCESSING
        await transactionManager['updateProgress'](
          workflowId,
          progress,
          currentPhase,
          newWorkflow.state.currentStep
        )
        
        return true
      } catch (error) {
        console.error('Failed to update progress:', error)
        return false
      }
    },
    [workflowId, newWorkflow.state]
  )
  
  // Initiate verification with backward compatible API
  const initiateVerification = useCallback(
    async (extractedDocument: string | Record<string, unknown>, messageId?: string) => {
      try {
        // Use the new implementation
        const result = await newWorkflow.initiateVerification(
          extractedDocument,
          { messageId }
        )
        
        return result
      } catch (error) {
        const normalizedError = normalizeError(error)
        domainLogger.error('Error initiating verification:', {
          error: normalizedError.message
        })
        
        return {
          success: false,
          error: normalizedError.message
        }
      }
    },
    [newWorkflow]
  )
  
  // Process correction with backward compatible API
  const processCorrection = useCallback(
    async (correctionText: string, currentSummary?: string, messageId?: string) => {
      try {
        // Use the new implementation
        const result = await newWorkflow.processCorrection(
          correctionText,
          currentSummary || newWorkflow.summary || '',
          { messageId }
        )
        
        return result
      } catch (error) {
        const normalizedError = normalizeError(error)
        domainLogger.error('Error processing correction:', {
          error: normalizedError.message
        })
        
        return {
          success: false,
          error: normalizedError.message
        }
      }
    },
    [newWorkflow]
  )
  
  // Complete verification with backward compatible API
  const completeVerification = useCallback(
    async (finalSummaryId?: string) => {
      try {
        // Use the new implementation
        const result = await newWorkflow.completeVerification(finalSummaryId)
        
        return result
      } catch (error) {
        const normalizedError = normalizeError(error)
        domainLogger.error('Error completing verification:', {
          error: normalizedError.message
        })
        
        return {
          success: false,
          error: normalizedError.message
        }
      }
    },
    [newWorkflow]
  )
  
  // Reset verification with backward compatible API
  const resetVerification = useCallback(
    async () => {
      try {
        await newWorkflow.resetVerification()
        return true
      } catch (error) {
        console.error('Error resetting verification:', error)
        return false
      }
    },
    [newWorkflow]
  )
  
  // Compute status string from current step
  const getStatus = () => {
    switch (newWorkflow.state.currentStep) {
      case 'idle':
        return 'IDLE'
      case 'verification_pending':
        return 'PENDING'
      case 'verification_in_progress':
        return 'IN_PROGRESS'
      case 'verification_completed':
        return 'COMPLETED'
      case 'verification_failed':
        return 'REJECTED'
      case DomainOnlyWorkflowStep.ERROR:
        return 'ERROR'
      default:
        return 'PROCESSING'
    }
  }
  
  // Return the same interface as the old adapter
  return {
    // State
    state,
    verificationResult,
    workflowId,
    currentSummary,
    
    // Computed status properties
    status: getStatus(),
    
    // Methods
    updateStep,
    updateProgress,
    initiateVerification,
    processCorrection,
    completeVerification,
    resetVerification
  }
}