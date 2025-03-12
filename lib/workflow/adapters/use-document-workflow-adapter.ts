/**
 * @fileoverview Document Workflow Hook Adapter
 * 
 * This adapter converts the DocumentWorkflowService to a React hook
 * that can be used in components.
 */

import { useState, useEffect, useCallback } from 'react'
import { DocumentWorkflowService, DocumentResult, ProcessDocumentOptions } from '../services/document-workflow-service'
import { workflowServiceFactory } from '../services/workflow-service-factory'
import { WorkflowState, WorkflowStep, ProcessingPhase } from '@/lib/types/workflow'

export interface UseDocumentWorkflowOptions {
  userId?: string
  chatId?: string
  initialStep?: WorkflowStep
}

/**
 * React hook adapter for DocumentWorkflowService
 */
export function useDocumentWorkflowAdapter(options: UseDocumentWorkflowOptions = {}) {
  const { userId, chatId, initialStep = 'idle' } = options
  
  // Get or create the document workflow service
  const service = workflowServiceFactory.getDocumentWorkflowService(userId, chatId)
  
  // State
  const [state, setState] = useState<WorkflowState>(service.getState() || {
    currentStep: initialStep,
    progress: 0,
    phase: ProcessingPhase.INITIALIZATION,
    error: null,
    metadata: {},
    timestamp: new Date().toISOString()
  })
  
  const [documentResult, setDocumentResult] = useState<DocumentResult>(
    service.getDocumentResult() || { success: false }
  )
  
  const [workflowId, setWorkflowId] = useState<string | undefined>(
    service.getWorkflowId()
  )
  
  // Subscribe to state changes
  useEffect(() => {
    // Update state when service state changes
    const handleStateChange = (newState: WorkflowState) => {
      setState(newState)
    }
    
    // Update result when document result changes
    const handleResultChange = (result: DocumentResult) => {
      setDocumentResult(result)
    }
    
    // Update workflow ID when it changes
    const handleWorkflowIdChange = (id?: string) => {
      setWorkflowId(id)
    }
    
    // Subscribe to events
    service.on('stateChange', handleStateChange)
    service.on('documentResult', handleResultChange)
    
    // Initial state sync
    setState(service.getState())
    setDocumentResult(service.getDocumentResult())
    setWorkflowId(service.getWorkflowId())
    
    // Clean up subscriptions
    return () => {
      service.off('stateChange', handleStateChange)
      service.off('documentResult', handleResultChange)
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
  
  const processDocument = useCallback(
    async (file: File, options: ProcessDocumentOptions = {}) => {
      return service.processDocument(file, options)
    },
    [service]
  )
  
  const resetDocumentWorkflow = useCallback(
    async () => {
      return service.resetDocumentWorkflow()
    },
    [service]
  )
  
  // Return hook interface
  return {
    // State
    state,
    documentResult,
    workflowId,
    
    // Computed status properties
    status: service.getStatus(),
    
    // Methods
    updateStep,
    updateProgress,
    processDocument,
    resetDocumentWorkflow
  }
}