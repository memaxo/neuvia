/**
 * @fileoverview Document Workflow Processor
 * 
 * Handles all document-related workflow operations including:
 * - Document uploading
 * - Content extraction
 * - Document storage and retrieval
 * - Metadata management
 *
 * Refactored to leverage the workflow engine for state management.
 */

import { ApplicationError, normalizeError } from '@/lib/errors'
import logger from '@/lib/logger'
import { workflowRepository } from '../infrastructure/workflow-repository'
import { workflowStateManager } from '../infrastructure/workflow-state-manager'
import { workflowEventSourcing } from '../infrastructure/workflow-event-source'
import { workflowTransactionManager } from '../workflow-transaction-manager'
import { BaseWorkflowProcessor } from '../base/base-workflow-processor'
import { Result } from '../error/result'
import { workflowEngine } from '../coordination/workflow-engine'
import { documentWorkflowDefinition } from '../definitions/document-workflow-definition'

import type { WorkflowStep, ProcessingPhase } from '@/lib/types/workflow'
import { DocumentCategory } from '@/lib/types/document'

/**
 * Document processing result
 */
export interface DocumentProcessingResult {
  /** Document ID */
  documentId: string;
  /** Extracted content */
  content?: string;
  /** Extraction metadata */
  metadata: Record<string, unknown>;
  /** Whether the extraction was successful */
  success: boolean;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Error message if processing failed */
  error?: string;
}

/**
 * Document upload options
 */
export interface DocumentUploadOptions {
  /** User ID who uploaded the document */
  userId: string;
  /** Patient ID associated with the document */
  patientId?: string;
  /** Document type information */
  documentType?: {
    category: DocumentCategory;
    type: string;
    subtype?: string;
  };
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Whether to automatically start extraction after upload */
  autoExtract?: boolean;
  /** Whether to automatically start verification after extraction (if autoExtract is true) */
  autoVerify?: boolean;
  /** Progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
  /** Transaction ID for tracking */
  transactionId?: string;
}

/**
 * Document extraction options
 */
export interface DocumentExtractionOptions {
  /** Extraction model to use */
  model?: string;
  /** Whether to use cache */
  useCache?: boolean;
  /** Progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
  /** Whether to auto-start verification after extraction */
  autoVerify?: boolean;
  /** Transaction ID for tracking */
  transactionId?: string;
}

/**
 * Document workflow processor
 * Refactored to use workflow engine for state management
 * while preserving the BaseWorkflowProcessor API for compatibility
 */
export class DocumentWorkflow extends BaseWorkflowProcessor
  { file: File; options: DocumentUploadOptions },
  DocumentProcessingResult
> {
  private readonly logger = logger.withMetadata({ module: 'DocumentWorkflow' });
  
  constructor() {
    super('Document', 'error'); // Pass domain name and default error step
    
    // Register document workflow definition with the engine
    // This ensures the workflow definition is available when needed
    this.registerWorkflowDefinition();
  }
  
  /**
   * Register the document workflow definition with the engine
   */
  private registerWorkflowDefinition(): void {
    try {
      workflowEngine.registerWorkflow(documentWorkflowDefinition);
      this.logger.info('Document workflow definition registered with engine');
    } catch (error) {
      // If already registered, this is fine - just log and continue
      this.logger.warn('Failed to register document workflow definition', {
        error: error instanceof Error ? error.message : String(error),
        definitionId: documentWorkflowDefinition.id
      });
    }
  }
  
  /**
   * Process document upload
   * Returns Result<DocumentProcessingResult> for consistent error handling
   * Now uses the workflow engine for state management
   */
  async processUpload(
    workflowId: string,
    file: File,
    options: DocumentUploadOptions
  ): Promise<Result<DocumentProcessingResult>> {
    const transactionId = options.transactionId || crypto.randomUUID();
    const moduleLogger = this.logger.withMetadata({
      method: 'processUpload',
      workflowId,
      fileName: file.name,
      transactionId
    });
    
    try {
      moduleLogger.info('Starting document upload process');
      
      // Function to handle progress updates
      const progressCallback = options.onProgress || (() => {});
      
      // Step 1: Create or get workflow instance
      let workflowResult = await workflowEngine.getWorkflow(workflowId);
      
      if (workflowResult.isFailure() && workflowResult.error.code === 'WORKFLOW_NOT_FOUND') {
        // Create new workflow
        moduleLogger.info('Creating new document workflow instance');
        workflowResult = await workflowEngine.createWorkflow(
          'document-workflow',
          workflowId,
          {
            userId: options.userId,
            patientId: options.patientId,
            progress: 0
          }
        );
      }
      
      if (workflowResult.isFailure()) {
        const errorMsg = `Failed to initialize workflow: ${workflowResult.error.message}`;
        moduleLogger.error(errorMsg, { errorCode: workflowResult.error.code });
        return Result.failure(
          errorMsg,
          workflowResult.error.code,
          { workflowId, fileName: file.name }
        );
      }
      
      // Initial progress update
      progressCallback(10, ProcessingPhase.UPLOADING);
      
      // Step 2: Create upload action
      const uploadAction = {
        type: 'UPLOAD_DOCUMENT',
        payload: {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          documentType: options.documentType,
          patientId: options.patientId,
          metadata: options.metadata
        },
        meta: {
          transactionId,
          userId: options.userId
        }
      };
      
      // Send action to workflow engine
      const uploadActionResult = await workflowEngine.sendAction(workflowId, uploadAction, {
        transactionId,
        userId: options.userId
      });
      
      if (uploadActionResult.isFailure()) {
        const errorMsg = `Failed to start upload: ${uploadActionResult.error.message}`;
        moduleLogger.error(errorMsg, { errorCode: uploadActionResult.error.code });
        return Result.failure(
          errorMsg,
          uploadActionResult.error.code,
          { workflowId, fileName: file.name }
        );
      }
      
      // Step 3: Perform the actual upload business logic
      
      // Update progress
      const updateProgressAction = {
        type: 'UPLOAD_PROGRESS',
        payload: {
          progress: 50
        },
        meta: {
          transactionId,
          userId: options.userId
        }
      };
      
      await workflowEngine.sendAction(workflowId, updateProgressAction);
      progressCallback(50, ProcessingPhase.UPLOADING);
      
      // Simulate document upload processing
      // In a real implementation, this would involve storage service calls
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate document ID
      const documentId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      
      // Log document uploaded event
      await workflowEventSourcing.appendEvent(
        workflowId,
        'document_uploaded',
        {
          documentId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          documentType: options.documentType,
          transactionId
        },
        options.userId
      );
      
      // Step 4: Mark upload as completed
      const uploadCompletedAction = {
        type: 'UPLOAD_COMPLETED',
        payload: {
          documentId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        },
        meta: {
          transactionId,
          userId: options.userId
        }
      };
      
      const completedResult = await workflowEngine.sendAction(workflowId, uploadCompletedAction, {
        transactionId,
        userId: options.userId
      });
      
      if (completedResult.isFailure()) {
        const errorMsg = `Failed to complete upload: ${completedResult.error.message}`;
        moduleLogger.error(errorMsg, { errorCode: completedResult.error.code });
        return Result.failure(
          errorMsg,
          completedResult.error.code,
          { workflowId, fileName: file.name, documentId }
        );
      }
      
      // Final progress update
      progressCallback(100, ProcessingPhase.UPLOADING);
      
      // Prepare result
      const result: DocumentProcessingResult = {
        documentId,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          uploadedAt: new Date().toISOString(),
          userId: options.userId,
          patientId: options.patientId,
          documentType: options.documentType
        },
        success: true,
        processingTime: 1000
      };
      
      // Step 5: Auto-extract if requested
      if (options.autoExtract) {
        moduleLogger.info('Auto-extraction requested, initiating extraction process', {
          documentId
        });
        
        const extractionResult = await this.extractContent(workflowId, documentId, {
          onProgress: options.onProgress,
          transactionId,
          autoVerify: options.autoVerify
        });
        
        if (extractionResult.isSuccess()) {
          return extractionResult;
        } else {
          // Log but continue - upload was successful even if extraction failed
          moduleLogger.error('Auto-extraction failed after successful upload', {
            documentId,
            error: extractionResult.error.message
          });
          
          // Add extraction error to result
          result.error = `Upload successful but extraction failed: ${extractionResult.error.message}`;
        }
      }
      
      return Result.success(result);
    } catch (error) {
      const normalizedError = normalizeError(error);
      moduleLogger.error('Unexpected error in document upload processing', {
        error: normalizedError.message,
        stack: normalizedError.stack
      });
      
      // Try to update workflow to error state
      try {
        await workflowEngine.sendAction(workflowId, {
          type: 'UPLOAD_FAILED',
          payload: {
            error: normalizedError.message,
            errorCode: normalizedError.code || 'UPLOAD_PROCESSING_ERROR',
            details: {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type
            }
          },
          meta: {
            transactionId,
            userId: options.userId
          }
        });
      } catch (stateError) {
        // Just log if this fails
        moduleLogger.warn('Failed to update workflow error state', {
          error: stateError instanceof Error ? stateError.message : String(stateError)
        });
      }
      
      // Return failure result
      return Result.failure(
        `Document upload failed: ${normalizedError.message}`,
        normalizedError.code || 'DOCUMENT_UPLOAD_FAILED',
        {
          workflowId,
          fileName: file.name,
          details: normalizedError.data
        }
      );
    }
  }
  
  /**
   * Extract content from document
   * Returns Result<DocumentProcessingResult> for consistent error handling
   * Now uses the workflow engine for state management
   */
  async extractContent(
    workflowId: string,
    documentId: string,
    options: DocumentExtractionOptions = {}
  ): Promise<Result<DocumentProcessingResult>> {
    const transactionId = options.transactionId || crypto.randomUUID();
    const moduleLogger = this.logger.withMetadata({
      method: 'extractContent',
      workflowId,
      documentId,
      transactionId
    });
    
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'WORKFLOW_INVALID_ID',
        { documentId }
      );
    }
    
    if (!documentId) {
      return Result.failure(
        'Document ID is required',
        'DOCUMENT_INVALID_ID',
        { workflowId }
      );
    }
    
    try {
      moduleLogger.info('Starting document content extraction');
      
      // Function to handle progress updates
      const progressCallback = options.onProgress || (() => {});
      
      // Create extraction action
      const extractAction = {
        type: 'EXTRACT_DOCUMENT',
        payload: {
          documentId,
          model: options.model,
          useCache: options.useCache
        },
        meta: {
          transactionId
        }
      };
      
      // Step 1: Send extraction action to workflow engine
      const extractActionResult = await workflowEngine.sendAction(workflowId, extractAction, {
        transactionId
      });
      
      if (extractActionResult.isFailure()) {
        const errorMsg = `Failed to start extraction: ${extractActionResult.error.message}`;
        moduleLogger.error(errorMsg, { errorCode: extractActionResult.error.code });
        return Result.failure(
          errorMsg,
          extractActionResult.error.code,
          { workflowId, documentId }
        );
      }
      
      // Step 2: Perform the actual extraction business logic
      
      // Initial progress update
      progressCallback(10, ProcessingPhase.EXTRACTION);
      
      // Update progress to workflow
      const updateProgressAction = {
        type: 'EXTRACTION_PROGRESS',
        payload: {
          progress: 25,
          phase: ProcessingPhase.EXTRACTION
        },
        meta: { transactionId }
      };
      
      await workflowEngine.sendAction(workflowId, updateProgressAction);
      progressCallback(25, ProcessingPhase.EXTRACTION);
      
      // Simulate extraction processing steps
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await workflowEngine.sendAction(workflowId, {
        type: 'EXTRACTION_PROGRESS',
        payload: {
          progress: 50,
          phase: ProcessingPhase.EXTRACTION
        },
        meta: { transactionId }
      });
      progressCallback(50, ProcessingPhase.EXTRACTION);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await workflowEngine.sendAction(workflowId, {
        type: 'EXTRACTION_PROGRESS',
        payload: {
          progress: 75,
          phase: ProcessingPhase.EXTRACTION
        },
        meta: { transactionId }
      });
      progressCallback(75, ProcessingPhase.EXTRACTION);
      
      // Simulate extraction result
      const extractedContent = `Sample extracted content for document ${documentId}`;
      const extractedData = {
        contentLength: extractedContent.length,
        extractionDate: new Date().toISOString(),
        model: options.model || 'default'
      };
      
      // Log extraction completion event
      await workflowEventSourcing.appendEvent(
        workflowId,
        'document_extracted',
        {
          documentId,
          extractionCompletedAt: new Date().toISOString(),
          contentLength: extractedContent.length,
          model: options.model,
          transactionId
        }
      );
      
      // Step 3: Mark extraction as completed with the appropriate action based on autoVerify
      const completionActionType = options.autoVerify ? 'EXTRACTION_COMPLETED' : 'EXTRACTION_COMPLETED_NO_VERIFY';
      
      const extractionCompletedAction = {
        type: completionActionType,
        payload: {
          documentId,
          content: extractedContent,
          extractedData,
          chunkCount: 1,
          autoVerify: options.autoVerify,
          extractionMethod: 'simulated'
        },
        meta: { transactionId }
      };
      
      const completedResult = await workflowEngine.sendAction(workflowId, extractionCompletedAction, {
        transactionId
      });
      
      if (completedResult.isFailure()) {
        const errorMsg = `Failed to complete extraction: ${completedResult.error.message}`;
        moduleLogger.error(errorMsg, { errorCode: completedResult.error.code });
        return Result.failure(
          errorMsg,
          completedResult.error.code,
          { workflowId, documentId }
        );
      }
      
      // Final progress update
      progressCallback(100, ProcessingPhase.EXTRACTION);
      
      // Return successful result
      return Result.success({
        documentId,
        content: extractedContent,
        metadata: {
          extractionCompletedAt: new Date().toISOString(),
          model: options.model,
          contentLength: extractedContent.length,
          extractedData
        },
        success: true,
        processingTime: 1500
      });
    } catch (error) {
      const normalizedError = normalizeError(error);
      moduleLogger.error('Document extraction failed', {
        error: normalizedError.message,
        stack: normalizedError.stack
      });
      
      // Try to update workflow to error state
      try {
        await workflowEngine.sendAction(workflowId, {
          type: 'EXTRACTION_FAILED',
          payload: {
            error: normalizedError.message,
            errorCode: normalizedError.code || 'EXTRACTION_PROCESSING_ERROR',
            details: { documentId }
          },
          meta: { transactionId }
        });
      } catch (stateError) {
        // Just log if this fails
        moduleLogger.warn('Failed to update workflow error state', {
          error: stateError instanceof Error ? stateError.message : String(stateError)
        });
      }
      
      // Return failure result
      return Result.failure(
        `Document extraction failed: ${normalizedError.message}`,
        normalizedError.code || 'DOCUMENT_EXTRACTION_FAILED',
        {
          workflowId,
          documentId,
          details: normalizedError.data
        }
      );
    }
  }
  
  /**
   * Get document info from the workflow state
   * Returns Result<Record<string, unknown> | null> for consistent error handling
   */
  async getDocumentInfo(
    workflowId: string,
    documentId: string
  ): Promise<Result<Record<string, unknown> | null>> {
    const moduleLogger = this.logger.withMetadata({
      method: 'getDocumentInfo',
      workflowId,
      documentId
    });
    
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'WORKFLOW_INVALID_ID',
        { documentId }
      );
    }
    
    if (!documentId) {
      return Result.failure(
        'Document ID is required',
        'DOCUMENT_INVALID_ID',
        { workflowId }
      );
    }
    
    try {
      moduleLogger.info('Retrieving document info from workflow state');
      
      // Get workflow from engine
      const workflowResult = await workflowEngine.getWorkflow(workflowId);
      
      if (workflowResult.isFailure()) {
        moduleLogger.warn('Failed to retrieve workflow', {
          error: workflowResult.error.message
        });
        
        // Try to get info from events if workflow state not found
        return this.getDocumentInfoFromEvents(workflowId, documentId);
      }
      
      const workflow = workflowResult.value;
      
      // Check if this workflow is associated with the requested document
      if (workflow.context.documentId !== documentId) {
        moduleLogger.info('Document ID mismatch, querying events instead', {
          workflowDocumentId: workflow.context.documentId
        });
        
        // Try to get info from events if document ID doesn't match
        return this.getDocumentInfoFromEvents(workflowId, documentId);
      }
      
      // Return document info from workflow context
      return Result.success({
        documentId,
        workflowId,
        state: workflow.currentState,
        fileName: workflow.context.fileName,
        fileSize: workflow.context.fileSize,
        fileType: workflow.context.fileType,
        patientId: workflow.context.patientId,
        documentType: workflow.context.documentType,
        progress: workflow.context.progress,
        phase: workflow.context.phase,
        extractedContent: workflow.context.extractedContent,
        extractedData: workflow.context.extractedData,
        metadata: workflow.context.metadata
      });
    } catch (error) {
      const normalizedError = normalizeError(error);
      moduleLogger.error('Failed to get document info', {
        error: normalizedError.message,
        stack: normalizedError.stack
      });
      
      return Result.failure(
        `Failed to get document info: ${normalizedError.message}`,
        normalizedError.code || 'DOCUMENT_INFO_RETRIEVAL_FAILED',
        {
          workflowId,
          documentId,
          details: normalizedError.data
        }
      );
    }
  }
  
  /**
   * Helper method to get document info from workflow events
   */
  private async getDocumentInfoFromEvents(
    workflowId: string,
    documentId: string
  ): Promise<Result<Record<string, unknown> | null>> {
    const moduleLogger = this.logger.withMetadata({
      method: 'getDocumentInfoFromEvents',
      workflowId,
      documentId
    });
    
    try {
      moduleLogger.info('Looking for document info in workflow events');
      
      // Try looking at workflow events
      const eventsResult = await Result.fromPromise(
        workflowEventSourcing.getEventHistory(workflowId, {
          eventType: ['document_uploaded', 'document_extracted']
        })
      );
      
      if (eventsResult.isFailure()) {
        return Result.failure(
          `Failed to retrieve workflow events: ${eventsResult.error.message}`,
          eventsResult.error.code,
          { workflowId, documentId }
        );
      }
      
      const events = eventsResult.value;
      
      // Find document info in events
      for (const event of events) {
        if (event.event_data && event.event_data.documentId === documentId) {
          return Result.success({
            documentId,
            workflowId,
            eventType: event.event_type,
            ...event.event_data
          });
        }
      }
      
      // Document not found in events
      moduleLogger.info('Document not found in workflow events');
      return Result.success(null);
    } catch (error) {
      const normalizedError = normalizeError(error);
      moduleLogger.error('Failed to get document info from events', {
        error: normalizedError.message,
        stack: normalizedError.stack
      });
      
      return Result.failure(
        `Failed to get document info from events: ${normalizedError.message}`,
        normalizedError.code || 'EVENT_RETRIEVAL_FAILED',
        { workflowId, documentId }
      );
    }
  }
  
  /**
   * Retry failed document processing
   */
  async retryDocumentProcessing(
    workflowId: string,
    documentId: string
  ): Promise<Result<DocumentProcessingResult>> {
    const moduleLogger = this.logger.withMetadata({
      method: 'retryDocumentProcessing',
      workflowId,
      documentId
    });
    
    try {
      moduleLogger.info('Retrying document processing');
      
      // Send retry action to workflow engine
      const retryAction = {
        type: 'RETRY',
        payload: {
          documentId,
          timestamp: new Date().toISOString()
        },
        meta: {
          transactionId: crypto.randomUUID()
        }
      };
      
      const retryResult = await workflowEngine.sendAction(workflowId, retryAction);
      
      if (retryResult.isFailure()) {
        return Result.failure(
          `Failed to initiate retry: ${retryResult.error.message}`,
          retryResult.error.code,
          { workflowId, documentId }
        );
      }
      
      // Retry extraction since that's the default retry path
      return this.extractContent(workflowId, documentId);
    } catch (error) {
      const normalizedError = normalizeError(error);
      moduleLogger.error('Failed to retry document processing', {
        error: normalizedError.message,
        stack: normalizedError.stack
      });
      
      return Result.failure(
        `Failed to retry document processing: ${normalizedError.message}`,
        normalizedError.code || 'RETRY_FAILED',
        { workflowId, documentId }
      );
    }
  }
  
  /**
   * Reset document workflow to idle state
   */
  async resetWorkflow(
    workflowId: string
  ): Promise<Result<void>> {
    const moduleLogger = this.logger.withMetadata({
      method: 'resetWorkflow',
      workflowId
    });
    
    try {
      moduleLogger.info('Resetting document workflow');
      
      // Send reset action to workflow engine
      const resetAction = {
        type: 'RESET',
        payload: {
          timestamp: new Date().toISOString()
        },
        meta: {
          transactionId: crypto.randomUUID()
        }
      };
      
      const resetResult = await workflowEngine.sendAction(workflowId, resetAction);
      
      if (resetResult.isFailure()) {
        return Result.failure(
          `Failed to reset workflow: ${resetResult.error.message}`,
          resetResult.error.code,
          { workflowId }
        );
      }
      
      return Result.success(undefined);
    } catch (error) {
      const normalizedError = normalizeError(error);
      moduleLogger.error('Failed to reset workflow', {
        error: normalizedError.message,
        stack: normalizedError.stack
      });
      
      return Result.failure(
        `Failed to reset workflow: ${normalizedError.message}`,
        normalizedError.code || 'RESET_FAILED',
        { workflowId }
      );
    }
  }
  
  /**
   * Domain-specific processing implementation
   * @deprecated Use engine-based methods instead
   */
  protected async doProcess(
    workflowId: string,
    input: { file: File; options: DocumentUploadOptions },
    currentState: any,
    options: WorkflowProcessOptions & {
      progressCallback?: (progress: number, phase: ProcessingPhase) => void
    }
  ): Promise<DocumentProcessingResult> {
    // This method is kept for backward compatibility
    // Delegate to the new engine-based implementation
    const result = await this.processUpload(
      workflowId,
      input.file,
      {
        ...input.options,
        onProgress: options.progressCallback
      }
    );
    
    // Convert Result to direct return value for compatibility
    if (result.isSuccess()) {
      return result.value;
    } else {
      return {
        documentId: '',
        metadata: {
          fileName: input.file.name,
          fileSize: input.file.size,
          fileType: input.file.type,
          error: result.error.message,
          errorCode: result.error.code
        },
        success: false,
        processingTime: 0,
        error: result.error.message
      };
    }
  }
}

// Export singleton instance
export const documentWorkflow = new DocumentWorkflow();