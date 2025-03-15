import { useCallback, useState } from 'react'
import { useBaseWorkflow, UseBaseWorkflowOptions } from './useBaseWorkflow'
import { normalizeError } from '@/lib/errors'
import { ProcessingPhase } from '@/lib/types/workflow'

/**
 * Options for document workflow
 */
export interface UseDocumentWorkflowOptions extends UseBaseWorkflowOptions {
  autoProcess?: boolean;
}

/**
 * Options for processing a document
 */
export interface ProcessDocumentOptions {
  patientId?: string;
  skipExtraction?: boolean;
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
}

/**
 * Document processing result
 */
export interface DocumentWorkflowResult {
  documentId?: string;
  fileName?: string;
  fileSize?: number;
  text?: string;
  extractedData?: Record<string, unknown>;
  processed: boolean;
  error?: string;
}

/**
 * Simplified hook for document processing workflows.
 */
export function useDocumentWorkflow(options: UseDocumentWorkflowOptions = {}) {
  const baseWorkflow = useBaseWorkflow({
    userId: options.userId,
    chatId: options.chatId,
    initialStep: options.initialStep,
    autoLoad: options.autoLoad ?? true,
    onError: options.onError,
    onStateChange: options.onStateChange
  })
  
  // Additional document state
  const [documentId, setDocumentId] = useState<string | undefined>(
    baseWorkflow.state.metadata?.documentId as string
  )

  /**
   * Process a document through the pipeline
   */
  const processDocument = useCallback(async (
    file: File,
    options: ProcessDocumentOptions = {}
  ): Promise<DocumentWorkflowResult> => {
    try {
      // Update step to uploading
      await baseWorkflow.updateStep(
        'uploading',
        {
          fileName: file.name,
          fileSize: file.size,
          uploadStartedAt: new Date().toISOString(),
          patientId: options.patientId
        }
      )
      
      // Track progress
      const onProgress = options.onProgress || (() => {});
      onProgress(10, ProcessingPhase.UPLOAD)
      
      // Use a simple fetch/AJAX call to upload document
      const formData = new FormData()
      formData.append('file', file)
      if (options.patientId) {
        formData.append('patientId', options.patientId)
      }
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Upload failed: ${error}`)
      }
      
      const uploadResult = await response.json()
      const docId = uploadResult.documentId
      
      // Save document ID and update step to extracting
      setDocumentId(docId)
      await baseWorkflow.updateStep(
        'extracting',
        {
          documentId: docId,
          extractionStartedAt: new Date().toISOString()
        }
      )
      
      onProgress(40, ProcessingPhase.EXTRACTION)
      
      // Skip extraction if requested
      if (options.skipExtraction) {
        await baseWorkflow.updateStep(
          'complete',
          {
            documentId: docId,
            fileName: file.name,
            fileSize: file.size,
            extractionSkipped: true,
            completedAt: new Date().toISOString()
          }
        )
        
        onProgress(100, ProcessingPhase.COMPLETION)
        
        return {
          documentId: docId,
          fileName: file.name,
          fileSize: file.size,
          processed: true
        }
      }
      
      // Extract content
      const extractResponse = await fetch(`/api/documents/${docId}/extract`, {
        method: 'POST'
      })
      
      if (!extractResponse.ok) {
        const error = await extractResponse.text()
        throw new Error(`Extraction failed: ${error}`)
      }
      
      const extractResult = await extractResponse.json()
      
      // Update workflow to complete
      await baseWorkflow.updateStep(
        'complete',
        {
          documentId: docId,
          fileName: file.name,
          fileSize: file.size,
          extractedData: extractResult.data,
          completedAt: new Date().toISOString()
        }
      )
      
      onProgress(100, ProcessingPhase.COMPLETION)
      
      // Return result
      return {
        documentId: docId,
        fileName: file.name,
        fileSize: file.size,
        text: extractResult.text,
        extractedData: extractResult.data,
        processed: true
      }
    } catch (error) {
      const normalizedError = normalizeError(error)
      
      // Set workflow to error state
      await baseWorkflow.updateStep(
        'error',
        {
          fileName: file.name,
          fileSize: file.size,
          error: normalizedError.message,
          errorTimestamp: new Date().toISOString()
        }
      )
      
      // Return error result
      return {
        fileName: file.name,
        fileSize: file.size,
        error: normalizedError.message,
        processed: false
      }
    }
  }, [baseWorkflow])
  
  /**
   * Extract content from an already uploaded document
   */
  const extractDocument = useCallback(async (
    docId: string,
    options: {
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
    } = {}
  ): Promise<DocumentWorkflowResult> => {
    try {
      // Update step to extracting
      await baseWorkflow.updateStep(
        'extracting',
        {
          documentId: docId,
          extractionStartedAt: new Date().toISOString()
        }
      )
      
      // Track progress
      const onProgress = options.onProgress || (() => {});
      onProgress(20, ProcessingPhase.EXTRACTION)
      
      // Extract content
      const extractResponse = await fetch(`/api/documents/${docId}/extract`, {
        method: 'POST'
      })
      
      if (!extractResponse.ok) {
        const error = await extractResponse.text()
        throw new Error(`Extraction failed: ${error}`)
      }
      
      const extractResult = await extractResponse.json()
      
      // Update workflow to complete
      await baseWorkflow.updateStep(
        'complete',
        {
          documentId: docId,
          extractedData: extractResult.data,
          completedAt: new Date().toISOString()
        }
      )
      
      onProgress(100, ProcessingPhase.COMPLETION)
      
      // Save document ID
      setDocumentId(docId)
      
      // Return result
      return {
        documentId: docId,
        text: extractResult.text,
        extractedData: extractResult.data,
        processed: true
      }
    } catch (error) {
      const normalizedError = normalizeError(error)
      
      // Set workflow to error state
      await baseWorkflow.updateStep(
        'error',
        {
          documentId: docId,
          error: normalizedError.message,
          errorTimestamp: new Date().toISOString()
        }
      )
      
      // Return error result
      return {
        documentId: docId,
        error: normalizedError.message,
        processed: false
      }
    }
  }, [baseWorkflow])
  
  /**
   * Get document information
   */
  const getDocumentInfo = useCallback(async (docId: string): Promise<DocumentWorkflowResult | null> => {
    try {
      const response = await fetch(`/api/documents/${docId}`)
      
      if (!response.ok) {
        return null
      }
      
      const documentData = await response.json()
      
      return {
        documentId: docId,
        fileName: documentData.fileName,
        fileSize: documentData.fileSize,
        text: documentData.text,
        extractedData: documentData.metadata,
        processed: true
      }
    } catch (error) {
      console.error('Error getting document info:', error)
      return null
    }
  }, [])
  
  /**
   * Reset the document workflow to idle state
   */
  const resetDocumentWorkflow = useCallback(async (): Promise<void> => {
    setDocumentId(undefined)
    await baseWorkflow.resetWorkflow()
  }, [baseWorkflow])
  
  // Compute derived states for backward compatibility
  const isProcessingDocument =
    baseWorkflow.state.currentStep === 'uploading' ||
    baseWorkflow.state.currentStep === 'extracting'
  
  const isDocumentComplete = baseWorkflow.state.currentStep === 'complete'
  
  // Return combined API
  return {
    ...baseWorkflow,
    processDocument,
    extractDocument,
    getDocumentInfo,
    resetDocumentWorkflow,
    documentResult: baseWorkflow.state,
    isProcessingDocument,
    isDocumentComplete,
    documentId
  }
}

// Export for convenience
export default useDocumentWorkflow