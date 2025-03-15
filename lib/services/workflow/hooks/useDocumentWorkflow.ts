import { useState, useCallback, useEffect } from 'react'
import { ProcessingPhase } from '@/lib/types/workflow'
import { documentActions, DocumentInput, DocumentWorkflowResult, DocumentState } from './documentActions'
import { useGenericWorkflow, UseGenericWorkflowOptions } from './useGenericWorkflow'

/**
 * Options for document workflow
 */
export interface UseDocumentWorkflowOptions extends UseGenericWorkflowOptions {
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
 * Specialized hook for document processing workflows.
 * Uses the generic workflow hook with document-specific actions.
 */
export function useDocumentWorkflow(options: UseDocumentWorkflowOptions = {}) {
  // Use the generic workflow hook with document actions
  const genericWorkflow = useGenericWorkflow<DocumentInput, DocumentWorkflowResult, DocumentState>(
    documentActions,
    {
      userId: options.userId,
      chatId: options.chatId,
      initialStep: options.initialStep,
      autoLoad: options.autoLoad ?? true
    }
  );
  
  /**
   * Process a document through the entire pipeline
   */
  const processDocument = useCallback(async (
    file: File,
    options: ProcessDocumentOptions = {}
  ): Promise<DocumentWorkflowResult> => {
    return genericWorkflow.process(
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
        },
        transactionOptions: {
          isolationLevel: 'read_committed',
          retryCount: 1
        }
      }
    );
  }, [genericWorkflow]);
  
  /**
   * Extract content from an already uploaded document
   */
  const extractDocument = useCallback(async (
    documentId: string,
    options: {
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
    } = {}
  ): Promise<DocumentWorkflowResult> => {
    return genericWorkflow.process(
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
    );
  }, [genericWorkflow]);
  
  /**
   * Get document information
   */
  const getDocumentInfo = useCallback(async (documentId: string): Promise<DocumentWorkflowResult | null> => {
    try {
      return await genericWorkflow.process(
        {
          action: 'info',
          documentId
        },
        {
          metadata: {
            documentId
          }
        }
      );
    } catch (error) {
      console.error('Error getting document info:', error);
      return null;
    }
  }, [genericWorkflow]);
  
  /**
   * Reset the document workflow to idle state
   */
  const resetDocumentWorkflow = useCallback(async (): Promise<void> => {
    await genericWorkflow.reset();
  }, [genericWorkflow]);
  
  // Compute derived states for backward compatibility
  const isProcessingDocument =
    genericWorkflow.state.currentStep === 'uploading' ||
    genericWorkflow.state.currentStep === 'extracting';
  
  const isDocumentComplete = genericWorkflow.state.currentStep === 'complete';
  
  // Return the same API as before with the new implementation
  return {
    ...genericWorkflow,
    processDocument,
    extractDocument,
    getDocumentInfo,
    resetDocumentWorkflow,
    documentResult: genericWorkflow,
    isProcessingDocument,
    isDocumentComplete,
    documentId: genericWorkflow.documentId
  };
}

// Export for convenience
export default useDocumentWorkflow;