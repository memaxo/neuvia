import { useState, useCallback } from 'react'
import { ProcessingPhase, DomainOnlyWorkflowStep } from '@/lib/types/workflow'
import { createWorkflowHook } from './create-workflow-hook'
import { workflowService } from '@/lib/services/workflow/core/workflow-service'
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

// Input type for document workflow actions
interface DocumentInput {
  file?: File
  documentId?: string
  options?: {
    patientId?: string
    skipExtraction?: boolean
    onProgress?: (progress: number, phase: ProcessingPhase) => void
  }
  action: 'process' | 'extract' | 'info'
}

// State type for document workflow
interface DocumentState {
  documentId?: string
  fileName?: string
  fileSize?: number
  text?: string
  extractedText?: string
  extractedData?: Record<string, unknown>
  processed: boolean
  error?: string
}

/**
 * Domain actions for document workflow
 */
const documentWorkflowActions = {
  domainName: 'Document',
  initialStep: 'idle' as const,
  
  /**
   * Get initial domain state
   */
  getInitialState: (): DocumentState => ({
    processed: false
  }),
  
  /**
   * Process document workflow action
   */
  processAction: async (
    input: DocumentInput,
    options: {
      workflowId: string
      userId?: string
      onProgress?: (progress: number, phase: ProcessingPhase) => void
    }
  ): Promise<DocumentWorkflowResult> => {
    const { action, file, documentId, options: inputOptions = {} } = input
    const { workflowId, userId, onProgress } = options
    
    // Create progress callback
    const progressCallback = (progress: number, phase: ProcessingPhase) => {
      if (onProgress) {
        onProgress(progress, phase)
      }
    }

    try {
      // Handle different actions
      if (action === 'process' && file) {
        // Process document upload
        const result = await workflowService.processDocumentUpload(
          workflowId,
          file,
          {
            userId: userId,
            patientId: inputOptions.patientId,
            skipExtraction: inputOptions.skipExtraction,
            progressCallback
          }
        )
        
        if (result.success) {
          return {
            documentId: result.documentId,
            fileName: result.fileName,
            fileSize: file.size,
            text: result.text,
            extractedData: result.data,
            processed: true
          }
        } else {
          throw new Error(result.error || 'Failed to process document')
        }
      }
      else if (action === 'extract' && documentId) {
        // Extract document content
        const result = await workflowService.extractDocumentContent(
          workflowId,
          documentId,
          { progressCallback }
        )
        
        if (result.success) {
          return {
            documentId,
            text: result.text,
            extractedData: result.data,
            processed: true
          }
        } else {
          throw new Error(result.error || 'Failed to extract document')
        }
      }
      else if (action === 'info' && documentId) {
        // Get document info
        const result = await workflowService.getDocumentInfo(
          workflowId,
          documentId
        )
        
        if (result) {
          return {
            documentId,
            fileName: result.fileName as string,
            fileSize: result.fileSize as number,
            text: result.text as string,
            extractedData: result.extractedData as Record<string, unknown>,
            processed: true
          }
        } else {
          return {
            documentId,
            processed: false,
            error: 'Document not found'
          }
        }
      }
      
      // Default error case
      return {
        processed: false,
        error: 'Invalid document action'
      }
    } catch (error) {
      throw normalizeError(error)
    }
  },
  
  /**
   * Create error result for failed operations
   */
  createErrorResult: (error: Error, input: DocumentInput): DocumentWorkflowResult => {
    return {
      documentId: input.documentId,
      fileName: input.file?.name,
      fileSize: input.file?.size,
      processed: false,
      error: error.message
    }
  },
  
  /**
   * Process result to update state
   */
  processResult: (
    result: DocumentWorkflowResult,
    currentState: DocumentState
  ): DocumentState => {
    return {
      ...currentState,
      documentId: result.documentId || currentState.documentId,
      fileName: result.fileName || currentState.fileName,
      fileSize: result.fileSize || currentState.fileSize,
      text: result.text || currentState.text,
      extractedData: result.extractedData || currentState.extractedData,
      processed: result.processed,
      error: result.error
    }
  }
}

// Create the document domain workflow hook
const useDocumentDomainWorkflow = createWorkflowHook<DocumentInput, DocumentWorkflowResult, DocumentState>(
  documentWorkflowActions
)

/**
 * Specialized hook for document processing workflows.
 * Provides an intuitive API for document upload, extraction, and analysis.
 */
export function useDocumentWorkflow(options: UseDocumentWorkflowOptions = {}) {
  const { userId, chatId, autoProcess = false } = options
  
  // Use the domain workflow hook
  const domainWorkflow = useDocumentDomainWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  // Maintain backward compatibility with existing API
  
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
    return domainWorkflow.process(
      {
        action: 'process',
        file,
        options
      },
      {
        step: 'uploading',
        successStep: 'complete',
        onProgress: options.onProgress,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          patientId: options.patientId
        }
      }
    )
  }, [domainWorkflow])
  
  /**
   * Extract content from an already uploaded document
   */
  const extractDocument = useCallback(async (
    documentId: string,
    options: {
      onProgress?: (progress: number, phase: ProcessingPhase) => void
    } = {}
  ) => {
    return domainWorkflow.process(
      {
        action: 'extract',
        documentId,
        options
      },
      {
        step: 'extracting',
        successStep: 'complete',
        onProgress: options.onProgress,
        metadata: {
          documentId
        }
      }
    )
  }, [domainWorkflow])
  
  /**
   * Get document information 
   */
  const getDocumentInfo = useCallback(async (documentId: string) => {
    try {
      return await domainWorkflow.process(
        {
          action: 'info',
          documentId
        },
        {
          metadata: {
            documentId
          }
        }
      )
    } catch (error) {
      console.error('Error getting document info:', error)
      return null
    }
  }, [domainWorkflow])
  
  /**
   * Reset the document workflow to idle state
   */
  const resetDocumentWorkflow = useCallback(async () => {
    return domainWorkflow.reset()
  }, [domainWorkflow])
  
  // Compute derived states for backward compatibility
  const isProcessingDocument =
    domainWorkflow.state.currentStep === 'uploading' ||
    domainWorkflow.state.currentStep === 'extracting'
  
  const isDocumentComplete = domainWorkflow.state.currentStep === 'complete'
  
  const documentId =
    domainWorkflow.documentId ||
    domainWorkflow.state.metadata?.documentId as string
  
  // Return the same API shape as before
  return {
    ...domainWorkflow,
    processDocument,
    extractDocument,
    getDocumentInfo,
    resetDocumentWorkflow,
    documentResult: domainWorkflow,
    isProcessingDocument,
    isDocumentComplete,
    documentId
  }
}