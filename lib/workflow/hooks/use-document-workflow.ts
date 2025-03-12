import { useState, useCallback } from 'react'
import { ProcessingPhase, DomainOnlyWorkflowStep } from '@/lib/types/workflow'
import { useWorkflow } from '../use-workflow'
import { workflowService } from '@/lib/services/workflow/core/workflow-service'
import { useWorkflowErrorHandler } from '../workflow-error-handler'
import { normalizeError } from '@/lib/errors'

export interface UseDocumentWorkflowOptions {
  userId?: string
  chatId?: string | null
  autoProcess?: boolean
}

export interface DocumentWorkflowResult {
  documentId?: string
  fileName?: string
  fileSize?: number
  text?: string
  extractedData?: Record<string, unknown>
  processed: boolean
  error?: string
}

/**
 * Specialized hook for document processing workflows.
 * Provides an intuitive API for document upload, extraction, and analysis.
 */
export function useDocumentWorkflow(options: UseDocumentWorkflowOptions = {}) {
  const { userId, chatId, autoProcess = false } = options
  const errorHandler = useWorkflowErrorHandler()
  const [documentResult, setDocumentResult] = useState<DocumentWorkflowResult>({
    processed: false
  })
  
  // Use base workflow hook
  const workflow = useWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })

  /**
   * Process a document through the entire pipeline: upload, extract, analyze
   */
  const processDocument = useCallback(async (
    file: File,
    options: {
      patientId?: string,
      skipExtraction?: boolean,
      onProgress?: (progress: number, phase: ProcessingPhase) => void
    } = {}
  ) => {
    try {
      if (!workflow.workflowId) {
        throw new Error('Workflow not initialized. Make sure userId is provided.')
      }
      
      // Start by updating to uploading state
      await workflow.updateStep('uploading', {
        fileName: file.name,
        fileSize: file.size,
        startedAt: new Date().toISOString(),
        patientId: options.patientId
      })
      
      // Callback for progress updates
      const progressCallback = (progress: number, phase: ProcessingPhase) => {
        workflow.updateProgress(progress, phase)
        if (options.onProgress) {
          options.onProgress(progress, phase)
        }
      }
      
      // Use the document workflow for processing
      const result = await workflowService.processDocumentUpload(
        workflow.workflowId,
        file,
        {
          userId: userId ?? undefined,
          patientId: options.patientId,
          progressCallback,
          skipExtraction: options.skipExtraction
        }
      )
      
      // Update local state with result
      if (result.success) {
        setDocumentResult({
          documentId: result.documentId,
          fileName: result.fileName,
          fileSize: file.size,
          text: result.text,
          extractedData: result.data,
          processed: true
        })
        
        // Update workflow state to complete
        await workflow.updateStep('complete', {
          documentId: result.documentId,
          fileName: result.fileName,
          completedAt: new Date().toISOString(),
          extractedData: result.data
        })
      } else {
        throw new Error(result.error || 'Failed to process document')
      }
      
      return result
    } catch (err) {
      const error = normalizeError(err)
      
      // Update error state
      setDocumentResult(prev => ({
        ...prev,
        error: error.message,
        processed: false
      }))
      
      // Update workflow error state
      await workflow.updateStep(DomainOnlyWorkflowStep.ERROR, {
        error: error.message,
        errorTimestamp: new Date().toISOString(),
      })
      
      // Log error properly
      await errorHandler.handleError(
        err,
        'uploading',
        {
          previousStep: workflow.state.currentStep,
          details: { fileName: file.name, fileSize: file.size },
          showToast: true,
          workflowId: workflow.workflowId ?? undefined
        }
      )
      
      return {
        success: false,
        error: error.message
      }
    }
  }, [workflow, userId, errorHandler])
  
  /**
   * Extract content from an already uploaded document
   */
  const extractDocument = useCallback(async (
    documentId: string,
    options: {
      onProgress?: (progress: number, phase: ProcessingPhase) => void
    } = {}
  ) => {
    try {
      if (!workflow.workflowId) {
        throw new Error('Workflow not initialized. Make sure userId is provided.')
      }
      
      // Update workflow state to extracting
      await workflow.updateStep('extracting', {
        documentId,
        startedAt: new Date().toISOString()
      })
      
      // Progress callback
      const progressCallback = (progress: number, phase: ProcessingPhase) => {
        workflow.updateProgress(progress, phase)
        if (options.onProgress) {
          options.onProgress(progress, phase)
        }
      }
      
      // Use document workflow to extract content
      const result = await workflowService.extractDocumentContent(
        workflow.workflowId,
        documentId,
        { progressCallback }
      )
      
      // Update local state with extracted data
      if (result.success) {
        setDocumentResult(prev => ({
          ...prev,
          documentId,
          text: result.text,
          extractedData: result.data,
          processed: true
        }))
        
        // Update workflow state
        await workflow.updateStep('complete', {
          documentId,
          extractedAt: new Date().toISOString(),
          extractedData: result.data
        })
      } else {
        throw new Error(result.error || 'Failed to extract document')
      }
      
      return result
    } catch (err) {
      const error = normalizeError(err)
      
      // Update error states
      setDocumentResult(prev => ({
        ...prev,
        error: error.message,
        processed: false
      }))
      
      await workflow.updateStep(DomainOnlyWorkflowStep.ERROR, {
        error: error.message,
        errorTimestamp: new Date().toISOString(),
      })
      
      await errorHandler.handleError(
        err,
        'extracting',
        {
          previousStep: workflow.state.currentStep,
          details: { documentId },
          showToast: true,
          workflowId: workflow.workflowId ?? undefined
        }
      )
      
      return {
        success: false,
        error: error.message
      }
    }
  }, [workflow, errorHandler])
  
  /**
   * Get document information 
   */
  const getDocumentInfo = useCallback(async (documentId: string) => {
    try {
      if (!workflow.workflowId) {
        throw new Error('Workflow not initialized')
      }
      
      // Use service to get document info
      const result = await workflowService.getDocumentInfo(
        workflow.workflowId,
        documentId
      )
      
      if (result) {
        // Update document result with info
        setDocumentResult(prev => ({
          ...prev,
          documentId,
          fileName: result.fileName as string,
          fileSize: result.fileSize as number,
          text: result.text as string,
          extractedData: result.extractedData as Record<string, unknown>,
          processed: true
        }))
      }
      
      return result
    } catch (err) {
      const error = normalizeError(err)
      console.error('Error getting document info:', error.message)
      return null
    }
  }, [workflow.workflowId])
  
  /**
   * Reset the document workflow to idle state
   */
  const resetDocumentWorkflow = useCallback(async () => {
    // Reset local state
    setDocumentResult({
      processed: false
    })
    
    // Reset workflow state
    return workflow.updateStep('idle', {
      resetAt: new Date().toISOString()
    })
  }, [workflow])
  
  return {
    ...workflow,
    processDocument,
    extractDocument,
    getDocumentInfo,
    resetDocumentWorkflow,
    documentResult,
    isProcessingDocument: workflow.state.currentStep === 'uploading' || 
                          workflow.state.currentStep === 'extracting',
    isDocumentComplete: workflow.state.currentStep === 'complete',
    documentId: documentResult.documentId || workflow.state.metadata?.documentId as string
  }
}