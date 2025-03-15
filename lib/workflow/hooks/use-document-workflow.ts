/**
 * @fileoverview Document Workflow Hook
 * 
 * Phase 4 Implementation: Uses the Result pattern and functional composition
 * pattern to implement a document processing workflow with improved error
 * handling and transaction management.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { ProcessingPhase, DomainOnlyWorkflowStep, WorkflowStep } from '@/lib/types/workflow'
import { createWorkflowHook } from './create-workflow-hook'
import { normalizeError } from '@/lib/errors'
import { transactionManager } from '@/lib/services/workflow/transaction/transaction-manager'
import { workflowDocumentService } from '@/lib/services/workflow/domain/document-workflow'
import { workflowRepository } from '@/lib/services/workflow/infrastructure/workflow-repository'
import { processWorkflow, getDomainMetadata, updateMetadataSafely, createDomainLogger } from '@/lib/services/workflow/infrastructure/workflow-processor-helpers'
import { Result } from '@/lib/services/workflow/error/result'
import { UnifiedErrorHandler } from '@/lib/services/workflow/error/unified-error-handler'

// Domain-specific logger
const domainLogger = createDomainLogger('Document')

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
 * Domain actions for document workflow with Result pattern
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
   * Process document workflow action using Result pattern
   */
  processAction: async (
    input: DocumentInput,
    options: {
      workflowId: string
      userId?: string
      onProgress?: (progress: number, phase: ProcessingPhase) => void
    }
  ): Promise<Result<DocumentWorkflowResult>> => {
    const { action, file, documentId, options: inputOptions = {} } = input
    const { workflowId, userId, onProgress } = options
    
    // Handle different actions using the new Result pattern
    if (action === 'process' && file) {
      // Use transaction manager for document upload
      return await transactionManager.executeTransaction(
        workflowId,
        async (transactionId, progressCallback) => {
          // Process document upload with the workflowDocumentService
          const result = await workflowDocumentService.processDocument(
            workflowId,
            file,
            {
              userId,
              patientId: inputOptions.patientId,
              skipExtraction: inputOptions.skipExtraction,
              transactionId
            },
            progressCallback || onProgress
          )
          
          if (result.isSuccess()) {
            const data = result.value
            return {
              documentId: data.documentId,
              fileName: data.fileName || file.name,
              fileSize: file.size,
              text: data.text,
              extractedData: data.extractedData,
              processed: true
            }
          } else {
            // Transform Result failure to DocumentWorkflowResult
            return {
              fileName: file.name,
              fileSize: file.size,
              processed: false,
              error: result.error.message
            }
          }
        },
        {
          step: 'uploading',
          errorStep: DomainOnlyWorkflowStep.ERROR,
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            patientId: inputOptions.patientId
          },
          onProgress,
          domainName: 'Document',
          retryCount: 1,
          conflictStrategy: 'merge'
        }
      )
      .then(result => {
        if (result.isSuccess()) {
          return Result.success(result.value.data)
        } else {
          return Result.failure<DocumentWorkflowResult>(
            result.error.message,
            result.error.code,
            {
              fileName: file.name,
              fileSize: file.size,
              processed: false
            }
          )
        }
      })
    }
    else if (action === 'extract' && documentId) {
      // Use processWorkflow helper for document extraction
      return await processWorkflow<string, DocumentWorkflowResult>(
        workflowId,
        documentId,
        {
          targetStep: 'extracting',
          onProgress,
          metadata: { documentId },
          recoveryStep: DomainOnlyWorkflowStep.ERROR
        },
        'Document',
        DomainOnlyWorkflowStep.ERROR,
        async (wfId, docId, currentState, opts) => {
          // Extract document with workflowDocumentService
          const extractResult = await workflowDocumentService.extractDocument(
            wfId,
            docId,
            opts.progressCallback
          )
          
          if (extractResult.isSuccess()) {
            const data = extractResult.value
            return {
              documentId: docId,
              text: data.text,
              extractedData: data.extractedData,
              processed: true
            }
          } else {
            return {
              documentId: docId,
              processed: false,
              error: extractResult.error.message
            }
          }
        }
      )
    }
    else if (action === 'info' && documentId) {
      // Use executeReadTransaction for read-only operations
      return await transactionManager.executeReadTransaction<DocumentWorkflowResult>(
        workflowId,
        async () => {
          // Get document info using workflowDocumentService
          const infoResult = await workflowDocumentService.getDocumentInfo(documentId)
          
          if (infoResult.isSuccess()) {
            const data = infoResult.value
            return {
              documentId,
              fileName: data.fileName,
              fileSize: data.fileSize,
              text: data.text,
              extractedData: data.extractedData,
              processed: true
            }
          } else {
            return {
              documentId,
              processed: false,
              error: infoResult.error.message || 'Document not found'
            }
          }
        }
      )
    }
    
    // Default error case using Result pattern
    return Result.failure(
      'Invalid document action',
      'INVALID_ACTION',
      { action }
    )
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

// Create the document domain workflow hook with updated Result handling
const useDocumentDomainWorkflow = createWorkflowHook<DocumentInput, DocumentWorkflowResult, DocumentState>(
  documentWorkflowActions
)

/**
 * Specialized hook for document processing workflows.
 * Phase 4 implementation: Uses Result pattern and unified error handling.
 */
export function useDocumentWorkflow(options: UseDocumentWorkflowOptions = {}) {
  const { userId, chatId, autoProcess = false } = options
  
  // Unified error handler for document domain
  const errorHandler = useMemo(() => {
    return new UnifiedErrorHandler('Document')
  }, [])
  
  // Use the domain workflow hook
  const domainWorkflow = useDocumentDomainWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  /**
   * Process a document through the entire pipeline with improved error handling
   */
  const processDocument = useCallback(async (
    file: File,
    options: {
      patientId?: string,
      skipExtraction?: boolean,
      onProgress?: (progress: number, phase: ProcessingPhase) => void
    } = {}
  ): Promise<DocumentWorkflowResult> => {
    try {
      const result = await domainWorkflow.process(
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
      
      if (result && 'error' in result && result.error) {
        // Log error with unified error handler
        await errorHandler.handleError({
          message: result.error,
          code: 'DOCUMENT_PROCESSING_ERROR',
          workflowId: domainWorkflow.workflowId,
          details: {
            fileName: file.name,
            fileSize: file.size
          }
        })
      }
      
      return result
    } catch (error) {
      // Handle unexpected errors with unified error handler
      const normalizedError = normalizeError(error)
      
      await errorHandler.handleError({
        message: normalizedError.message,
        code: normalizedError.code || 'UNEXPECTED_ERROR',
        workflowId: domainWorkflow.workflowId,
        details: {
          fileName: file.name,
          fileSize: file.size
        }
      })
      
      return {
        fileName: file.name,
        fileSize: file.size,
        processed: false,
        error: normalizedError.message
      }
    }
  }, [domainWorkflow, errorHandler])
  
  /**
   * Extract content from an already uploaded document
   */
  const extractDocument = useCallback(async (
    documentId: string,
    options: {
      onProgress?: (progress: number, phase: ProcessingPhase) => void
    } = {}
  ): Promise<DocumentWorkflowResult> => {
    try {
      const result = await domainWorkflow.process(
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
      
      if (result && 'error' in result && result.error) {
        // Log error with unified error handler
        await errorHandler.handleError({
          message: result.error,
          code: 'DOCUMENT_EXTRACTION_ERROR',
          workflowId: domainWorkflow.workflowId,
          details: { documentId }
        })
      }
      
      return result
    } catch (error) {
      // Handle unexpected errors with unified error handler
      const normalizedError = normalizeError(error)
      
      await errorHandler.handleError({
        message: normalizedError.message,
        code: normalizedError.code || 'UNEXPECTED_ERROR',
        workflowId: domainWorkflow.workflowId,
        details: { documentId }
      })
      
      return {
        documentId,
        processed: false,
        error: normalizedError.message
      }
    }
  }, [domainWorkflow, errorHandler])
  
  /**
   * Get document information with improved error handling
   */
  const getDocumentInfo = useCallback(async (documentId: string): Promise<DocumentWorkflowResult | null> => {
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
      // Handle unexpected errors with unified error handler
      const normalizedError = normalizeError(error)
      
      await errorHandler.handleError({
        message: normalizedError.message,
        code: 'DOCUMENT_INFO_ERROR',
        workflowId: domainWorkflow.workflowId,
        details: { documentId }
      })
      
      domainLogger.error('Error getting document info:', {
        documentId,
        error: normalizedError.message,
        workflowId: domainWorkflow.workflowId
      })
      
      return null
    }
  }, [domainWorkflow, errorHandler])
  
  /**
   * Reset the document workflow to idle state
   */
  const resetDocumentWorkflow = useCallback(async (): Promise<void> => {
    try {
      await domainWorkflow.reset()
      
      // Update metadata to reflect reset
      if (domainWorkflow.workflowId) {
        await updateMetadataSafely(
          domainWorkflow.workflowId,
          {
            resetAt: new Date().toISOString(),
            resetBy: userId || 'system'
          },
          {
            transactionId: crypto.randomUUID(),
            conflictStrategy: 'merge'
          },
          'Document'
        )
      }
    } catch (error) {
      const normalizedError = normalizeError(error)
      domainLogger.error('Error resetting document workflow:', {
        error: normalizedError.message,
        workflowId: domainWorkflow.workflowId
      })
    }
  }, [domainWorkflow, userId])
  
  // Compute derived states for backward compatibility
  const isProcessingDocument =
    domainWorkflow.state.currentStep === 'uploading' ||
    domainWorkflow.state.currentStep === 'extracting'
  
  const isDocumentComplete = domainWorkflow.state.currentStep === 'complete'
  
  // Get documentId from state using getDomainMetadata helper or fall back to legacy pattern
  const [documentId, setDocumentId] = useState<string | undefined>(
    domainWorkflow.state.metadata?.documentId as string
  )
  
  // Fetch document ID from metadata when workflowId changes
  useEffect(() => {
    if (domainWorkflow.workflowId) {
      getDomainMetadata<string>(
        domainWorkflow.workflowId,
        'documentId',
        undefined,
        'Document'
      ).then(result => {
        if (result.isSuccess() && result.value) {
          setDocumentId(result.value)
        } else {
          // Fall back to legacy pattern
          setDocumentId(domainWorkflow.state.metadata?.documentId as string)
        }
      }).catch(error => {
        domainLogger.warn('Error fetching document ID from metadata', {
          error: error instanceof Error ? error.message : String(error),
          workflowId: domainWorkflow.workflowId
        })
      })
    }
  }, [domainWorkflow.workflowId, domainWorkflow.state.metadata])
  
  // Return the same API shape as before with new implementation
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