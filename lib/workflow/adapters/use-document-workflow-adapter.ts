/**
 * @fileoverview Document Workflow Hook Adapter
 * 
 * This adapter provides backward compatibility for the new functional workflow architecture.
 * Phase 4 implementation: Uses Result pattern and composition pattern.
 */

import { useState, useEffect, useCallback } from 'react'
import { DocumentWorkflowResult } from '../hooks/use-document-workflow'
import { workflowServiceFactory } from '../services/workflow-service-factory'
import { WorkflowState, WorkflowStep, ProcessingPhase, DomainOnlyWorkflowStep } from '@/lib/types/workflow'
import { transactionManager } from '@/lib/services/workflow/transaction/transaction-manager'
import { useDocumentWorkflow as useNewDocumentWorkflow } from '../hooks/use-document-workflow'
import { Result } from '@/lib/services/workflow/error/result'

export interface UseDocumentWorkflowOptions {
  userId?: string
  chatId?: string
  initialStep?: WorkflowStep
  autoProcess?: boolean
}

/**
 * Legacy result type for backward compatibility
 */
export interface DocumentResult {
  documentId?: string
  fileName?: string
  fileSize?: number
  text?: string
  extractedData?: Record<string, unknown>
  success: boolean
  error?: string
}

/**
 * Legacy options type for backward compatibility
 */
export interface ProcessDocumentOptions {
  patientId?: string
  skipExtraction?: boolean
  onProgress?: (progress: number, phase: ProcessingPhase) => void
}

/**
 * React hook adapter for document workflow with backward compatibility
 */
export function useDocumentWorkflowAdapter(options: UseDocumentWorkflowOptions = {}) {
  const { userId, chatId, initialStep = 'idle', autoProcess = false } = options
  
  // Use the new implementation internally
  const newWorkflow = useNewDocumentWorkflow({ 
    userId, 
    chatId, 
    autoProcess 
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
  const [documentResult, setDocumentResult] = useState<DocumentResult>(
    convertToLegacyResult(newWorkflow)
  )
  
  // Keep workflowId
  const [workflowId, setWorkflowId] = useState<string | undefined>(
    newWorkflow.workflowId
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
    setDocumentResult(convertToLegacyResult(newWorkflow))
    
    // Update workflow ID
    setWorkflowId(newWorkflow.workflowId)
  }, [
    newWorkflow.state, 
    newWorkflow.workflowId, 
    newWorkflow.documentId,
    newWorkflow.fileName,
    newWorkflow.fileSize,
    newWorkflow.text,
    newWorkflow.extractedData,
    initialStep
  ])
  
  // Convert the new result to legacy format
  function convertToLegacyResult(workflow: ReturnType<typeof useNewDocumentWorkflow>): DocumentResult {
    if (workflow.error) {
      return {
        documentId: workflow.documentId,
        fileName: workflow.fileName,
        fileSize: workflow.fileSize,
        success: false,
        error: workflow.error
      }
    }
    
    return {
      documentId: workflow.documentId,
      fileName: workflow.fileName,
      fileSize: workflow.fileSize,
      text: workflow.text,
      extractedData: workflow.extractedData,
      success: !!workflow.processed
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
            domainName: 'Document'
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
  
  // Process document with backward compatible API
  const processDocument = useCallback(
    async (file: File, options: ProcessDocumentOptions = {}) => {
      try {
        // Use the new implementation but convert result
        const result = await newWorkflow.processDocument(file, options)
        return convertToLegacyResult({
          ...newWorkflow,
          ...result
        })
      } catch (error) {
        console.error('Error processing document:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to process document'
        }
      }
    },
    [newWorkflow]
  )
  
  // Reset workflow with backward compatible API
  const resetDocumentWorkflow = useCallback(
    async () => {
      try {
        await newWorkflow.resetDocumentWorkflow()
        return true
      } catch (error) {
        console.error('Error resetting workflow:', error)
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
      case 'uploading':
        return 'UPLOADING'
      case 'extracting':
        return 'EXTRACTING'
      case 'complete':
        return 'COMPLETE'
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
    documentResult,
    workflowId,
    
    // Computed status properties
    status: getStatus(),
    
    // Methods
    updateStep,
    updateProgress,
    processDocument,
    resetDocumentWorkflow
  }
}