      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'DOCUMENT_PROCESSING_ERROR',
        {
          documentId: input.documentId,
          fileName: input.file?.name,
          fileSize: input.file?.size,
          processed: false
        }
      );
    }
  },
  
  /**
   * Create error result for failed operations
   */
  createErrorResult: (error: Error, input: DocumentInput): DocumentWorkflowResult => {
    const normalizedError = normalizeError(error);
    
    return {
      documentId: input.documentId,
      fileName: input.file?.name,
      fileSize: input.file?.size,
      processed: false,
      error: normalizedError.message
    };
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
    };
  },
  
  /**
   * Hook called before processing an action
   */
  beforeProcess: async (input: DocumentInput, options) => {
    logger.info('Starting document operation', {
      action: input.action,
      documentId: input.documentId,
      fileName: input.file?.name,
      workflowId: options.workflowId
    });
  },
  
  /**
   * Hook called after processing an action
   */
  afterProcess: async (result, input, options) => {
    if (result.isSuccess()) {
      logger.info('Document operation completed successfully', {
        action: input.action,
        documentId: result.value.documentId || input.documentId,
        workflowId: options.workflowId
      });
    } else {
      logger.warn('Document operation completed with errors', {
        action: input.action,
        error: result.error.message,
        documentId: input.documentId,
        workflowId: options.workflowId
      });
    }
  }
export const documentActions: DomainActions<DocumentInput, DocumentWorkflowResult, DocumentState> = {
  domainName: 'Document',
  initialStep: 'idle' as WorkflowStep,

  /**
   * Get initial document state
   */
  getInitialState: (): DocumentState => ({
    processed: false
  }),
  
  /**
   * Error categories for specialized handling
   */
  errorCategories: {
    uploadFailure: (error) => error.message.includes('upload') || error.code?.includes('UPLOAD'),
    extractionFailure: (error) => error.message.includes('extract') || error.code?.includes('EXTRACT'),
    permissionFailure: (error) => error.message.includes('permission') || error.message.includes('access denied'),
    networkFailure: (error) => error.message.includes('network') || error.message.includes('connection')
  },
  
  /**
   * Error recovery strategies keyed by category
   */
  errorRecoveryStrategies: {
    // Retry strategy for network failures
    networkFailure: async (error, input, options) => {
      logger.info('Attempting to recover from network failure', {
        action: input.action,
        documentId: input.documentId,
        retry: true
      });
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Import document workflow to retry
      const { documentWorkflow } = await import('@/lib/services/workflow/domain/document-workflow');
      
      // Retry based on action type
      if (input.action === 'process' && input.file) {
        return documentWorkflow.processUpload(
          options.workflowId,
          input.file,
          {
            userId: options.userId || 'system',
            patientId: input.options?.patientId,
            autoExtract: !input.options?.skipExtraction,
            onProgress: options.onProgress,
            transactionId: options.transactionId
          }
        ).then(result => {
          if (result.isSuccess()) {
            const data = result.value;
            return Result.success({
              documentId: data.documentId,
              fileName: data.fileName || input.file!.name,
              fileSize: input.file!.size,
              text: data.content,
              extractedData: data.metadata,
              processed: true
            });
          } else {
            return Result.failure(
              result.error.message,
              result.error.code,
              { processed: false }
            );
          }
        });
      }
      
      return Result.failure(
        'Recovery strategy not implemented for this action',
        'RECOVERY_NOT_IMPLEMENTED',
        { action: input.action }
      );
    },
    
    // Retry extraction with different parameters
    extractionFailure: async (error, input, options) => {
      if (input.action !== 'extract' || !input.documentId) {
        return Result.failure(
          'Cannot recover non-extraction failures',
          'INVALID_RECOVERY_ACTION',
          { action: input.action }
        );
      }
      
      logger.info('Attempting to recover from extraction failure with fallback method', {
        documentId: input.documentId
      });
      
      // Import document workflow to retry with fallback method
      const { documentWorkflow } = await import('@/lib/services/workflow/domain/document-workflow');
      
      return documentWorkflow.extractDocumentWithFallback(
        options.workflowId,
        input.documentId,
        {
          onProgress: options.onProgress,
          transactionId: options.transactionId,
          useFallback: true
        }
      ).then(result => {
        if (result.isSuccess()) {
          const data = result.value;
          return Result.success({
            documentId: input.documentId,
            text: data.content,
            extractedData: data.metadata,
            processed: true
          });
        } else {
          return Result.failure(
            result.error.message,
            result.error.code,
            { processed: false }
          );
        }
      });
    }
  },
import { DomainActions } from './useGenericWorkflow';
import { ProcessingPhase, DomainOnlyWorkflowStep, WorkflowStep } from '@/lib/types/workflow';
import { Result } from '@/lib/services/workflow/error/result';
import { normalizeError } from '@/lib/errors';
import { createDomainLogger } from '@/lib/services/workflow/infrastructure/workflow-processor-helpers';

// Document-specific input, result, and state types
export interface DocumentInput {
  file?: File;
  documentId?: string;
  options?: {
    patientId?: string;
    skipExtraction?: boolean;
    onProgress?: (progress: number, phase: ProcessingPhase) => void;
  };
  action: 'process' | 'extract' | 'info';
}

export interface DocumentWorkflowResult {
  documentId?: string;
  fileName?: string;
  fileSize?: number;
  text?: string;
  extractedData?: Record<string, unknown>;
  processed: boolean;
  error?: string;
}

export interface DocumentState {
  documentId?: string;
  fileName?: string;
  fileSize?: number;
  text?: string;
  extractedText?: string;
  extractedData?: Record<string, unknown>;
  processed: boolean;
  error?: string;
}

// Create domain-specific logger
const logger = createDomainLogger('Document');

/**
 * Document domain actions configuration
 */
export const documentActions: DomainActions<DocumentInput, DocumentWorkflowResult, DocumentState> = {
  domainName: 'Document',
  initialStep: 'idle' as WorkflowStep,

  /**
   * Get initial document state
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
      workflowId: string;
      userId?: string;
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
    }
  ): Promise<Result<DocumentWorkflowResult>> => {
    const { action, file, documentId, options: inputOptions = {} } = input;
    const { workflowId, userId, onProgress } = options;

    try {
      // Import document workflow service dynamically to avoid circular dependencies
      const { documentWorkflow } = await import('@/lib/services/workflow/domain/document-workflow');
      
// Handle different actions
      if (action === 'process' && file) {
        // Process document upload and extraction
        const result = await documentWorkflow.processUpload(
          workflowId,
          file,
          {
            userId: userId || 'system',
            patientId: inputOptions.patientId,
            autoExtract: !inputOptions.skipExtraction,
            onProgress,
            transactionId: options.transactionId
          }
        );
        
        // Convert to Result pattern
        if (result.isSuccess()) {
          const data = result.value;
          return Result.success({
            documentId: data.documentId,
            fileName: data.fileName || file.name,
            fileSize: file.size,
            text: data.content,
            extractedData: data.metadata,
            processed: true
          });
        } else {
          return Result.failure(
            result.error.message,
            result.error.code,
            {
              fileName: file.name,
              fileSize: file.size,
              processed: false
            }
          );
        }
      }
      else if (action === 'extract' && documentId) {
        // Extract document content
        const result = await documentWorkflow.extractDocument(
          workflowId,
          documentId,
          {
            onProgress,
            transactionId: options.transactionId
          }
        );
        
        // Convert to Result pattern
        if (result.isSuccess()) {
          const data = result.value;
          return Result.success({
            documentId,
            text: data.content,
            extractedData: data.metadata,
            processed: true
          });
        } else {
          return Result.failure(
            result.error.message,
            result.error.code,
            {
              documentId,
              processed: false
            }
          );
        }
      }
      else if (action === 'info' && documentId) {
        // Get document information
        const result = await documentWorkflow.getDocumentInfo(
          workflowId,
          documentId
        );
        
        // Convert to Result pattern
        if (result.isSuccess()) {
          const data = result.value;
          return Result.success({
            documentId,
            fileName: data.fileName,
            fileSize: data.fileSize,
            text: data.content,
            extractedData: data.metadata,
            processed: true
          });
        } else {
          return Result.failure(
            result.error.message,
            result.error.code,
            {
              documentId,
              processed: false
            }
          );
        }
      }
      
      // Invalid action
      return Result.failure(
        'Invalid document action',
        'INVALID_ACTION',
        { action }
      );
    } catch (error) {
      const normalizedError = normalizeError(error);
      logger.error('Error processing document action', {
        action: input.action,
        documentId: input.documentId,
        fileName: input.file?.name
      }, normalizedError);
      
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'DOCUMENT_PROCESSING_ERROR',
        {
          documentId: input.documentId,
          fileName: input.file?.name,
          fileSize: input.file?.size,
          processed: false
        }
      );
    }