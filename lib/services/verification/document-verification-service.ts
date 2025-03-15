import logger from '@/lib/logger'
import { normalizeError, ValidationError, ApplicationError } from '@/lib/errors'
import type { VerificationServiceResult, GenerateVerificationOptions } from '@/lib/types/verification'
import { verificationAdapter } from '@/lib/api/adapters/verification-adapter'
import { DOCUMENT_ERROR_CODES, WORKFLOW_ERROR_CODES } from '@/lib/errors/error-codes'
import { Result } from '@/lib/services/workflow/error/result'
import type { ProcessingPhase, WorkflowStep } from '@/lib/types/workflow'
import { DocumentCategory } from '@/lib/types/document'

// Define VerificationError class
class VerificationError extends ApplicationError {
  constructor(options: {
    message: string
    code?: string
    data?: Record<string, unknown>
    cause?: unknown
  }) {
    super({ ...options, isOperational: true })
    this.name = 'VerificationError'
  }
}

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
  /** Workflow ID for tracking */
  workflowId?: string;
}

/**
 * Document extraction options
 */
export interface DocumentExtractionOptions {
  /** User ID who requested extraction */
  userId: string;
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
  /** Workflow ID for tracking */
  workflowId?: string;
}

/**
 * DocumentVerificationService
 * Handles document-specific verification operations including:
 * - Document extraction and processing
 * - Document verification
 * - Document data transformation
 * 
 * This service owns the domain logic while delegating state transitions
 * to the workflow. It serves as the single source of truth for document
 * business logic.
 */
export class DocumentVerificationService {
  /**
   * Generate a unique verification ID
   * @returns A unique ID for the verification
   */
  generateVerificationId(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate a unique summary ID
   * @returns A unique ID for the summary
   */
  generateSummaryId(): string {
    return crypto.randomUUID();
  }
  
  /**
   * Generate a unique document ID
   * @returns A unique ID for the document
   */
  generateDocumentId(): string {
    return `doc-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Prepare document data for workflow processing
   * This method extracts the domain logic from the workflow file
   * 
   * @param documentData The document data to process
   * @returns Processed document data with IDs, metadata, and structured content
   */
  async prepareDocumentData(documentData: any): Promise<{
    text: string;
    patientId?: string;
    verificationId: string;
    summaryId: string;
    summary: string;
    structuredData?: Record<string, any>;
    metadata: Record<string, any>;
  }> {
    const moduleLogger = logger.withMetadata({
      module: 'DocumentVerificationService',
      method: 'prepareDocumentData'
    });

    try {
      // Generate required IDs
      const verificationId = this.generateVerificationId();
      const summaryId = this.generateSummaryId();
      
      // Extract and process text content
      const text = typeof documentData === 'string'
        ? documentData
        : documentData.content || documentData.text || JSON.stringify(documentData);
      
      // Extract patient ID if available
      const patientId = documentData.patientId;
      
      // Process structured data if available
      const structuredData = typeof documentData === 'object' ? documentData : undefined;
      
      // Build metadata for verification
      const metadata = {
        verification_status: 'pending',
        originalSummaryId: summaryId,
        currentVersionId: summaryId,
        patientId,
        correctionCount: 0,
        corrections: [],
        lastUpdated: new Date().toISOString(),
        contentLength: text.length,
        contentType: typeof documentData === 'string' ? 'text' : 'structured',
        generatedAt: new Date().toISOString()
      };
      
      moduleLogger.info('Document data prepared for workflow', {
        verificationId,
        summaryId,
        textLength: text.length
      });
      
      return {
        text,
        patientId,
        verificationId,
        summaryId,
        summary: text, // Initial summary is the same as input text
        structuredData,
        metadata
      };
    } catch (error) {
      moduleLogger.error('Failed to prepare document data', {
        error: normalizeError(error)
      });
      
      // Provide fallback data in case of error
      return {
        text: typeof documentData === 'string' ? documentData : JSON.stringify(documentData),
        verificationId: this.generateVerificationId(),
        summaryId: this.generateSummaryId(),
        summary: typeof documentData === 'string' ? documentData : '',
        metadata: {
          verification_status: 'pending',
          lastUpdated: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Process document upload - main entry point
   * The business logic is handled here and workflow state transitions are delegated
   * to the document-workflow
   * 
   * @param file The file to upload
   * @param options Upload options
   * @returns Processing result with documentId and metadata
   */
  async uploadDocument(
    file: File,
    options: DocumentUploadOptions
  ): Promise<Result<DocumentProcessingResult>> {
    const transactionId = options.transactionId || crypto.randomUUID();
    const workflowId = options.workflowId || crypto.randomUUID();
    
    const moduleLogger = logger.withMetadata({
      module: 'DocumentVerificationService',
      method: 'uploadDocument',
      workflowId,
      fileName: file.name,
      transactionId
    });
    
    try {
      moduleLogger.info('Starting document upload process');
      
      // Progress callback handling
      const progressCallback = options.onProgress || (() => {});
      progressCallback(10, ProcessingPhase.UPLOADING);
      
      // Process the file and generate a document ID
      const documentId = this.generateDocumentId();
      
      // Process the file data (in a real implementation, this would involve storage service calls)
      // Here we're just simulating the process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create document metadata
      const metadata = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadedAt: new Date().toISOString(),
        userId: options.userId,
        patientId: options.patientId,
        documentType: options.documentType,
        ...options.metadata
      };
      
      // Delegate workflow state transition
      try {
        // Import document workflow to avoid circular dependencies
        const { documentWorkflow } = await import('@/lib/services/workflow/domain/document-workflow');
        
        // Trigger the workflow state transition
        await documentWorkflow.processUpload(
          workflowId,
          file,
          {
            userId: options.userId,
            documentId,
            metadata,
            transactionId
          }
        );
      } catch (workflowError) {
        // Log workflow error but continue (the upload itself succeeded)
        moduleLogger.warn('Workflow state transition failed but document was uploaded', {
          error: workflowError instanceof Error ? workflowError.message : String(workflowError)
        });
      }
      
      progressCallback(100, ProcessingPhase.UPLOADING);
      
      // Return the upload result
      return Result.success({
        documentId,
        metadata,
        success: true,
        processingTime: 500
      });
    } catch (error) {
      const normalizedError = normalizeError(error);
      moduleLogger.error('Document upload failed', {
        error: normalizedError.message,
        stack: normalizedError.stack
      });
      
      // Try updating workflow state to error if possible
      try {
        const { documentWorkflow } = await import('@/lib/services/workflow/domain/document-workflow');
        await documentWorkflow.handleUploadError(
          workflowId,
          {
            error: normalizedError.message,
            fileName: file.name,
            userId: options.userId,
            transactionId
          }
        );
      } catch (workflowError) {
        // Just log workflow errors - primary error is more important
        moduleLogger.warn('Failed to update workflow error state', {
          error: workflowError instanceof Error ? workflowError.message : String(workflowError)
        });
      }
      
      return Result.failure(
        `Document upload failed: ${normalizedError.message}`,
        normalizedError.code || 'DOCUMENT_UPLOAD_FAILED',
        {
          fileName: file.name,
          details: normalizedError.data
        }
      );
    }
  }
  
  /**
   * Extract content from document
   * Encapsulates the extraction business logic and delegates state management
   * to document-workflow
   * 
   * @param documentId The document ID to extract content from
   * @param options Extraction options
   * @returns Extraction result with content and metadata
   */
  async extractContent(
    documentId: string,
    options: DocumentExtractionOptions
  ): Promise<Result<DocumentProcessingResult>> {
    const transactionId = options.transactionId || crypto.randomUUID();
    const workflowId = options.workflowId || crypto.randomUUID();
    
    const moduleLogger = logger.withMetadata({
      module: 'DocumentVerificationService',
      method: 'extractContent',
      workflowId,
      documentId,
      transactionId
    });
    
    try {
      moduleLogger.info('Starting document extraction process');
      
      // Progress callback handling
      const progressCallback = options.onProgress || (() => {});
      progressCallback(10, ProcessingPhase.EXTRACTION);
      
      // In a real implementation, this would invoke OCR, text extraction services, etc.
      // Here we're just simulating the process
      await new Promise(resolve => setTimeout(resolve, 500));
      progressCallback(50, ProcessingPhase.EXTRACTION);
      
      // Simulate extraction result
      const extractedContent = `Sample extracted content for document ${documentId}`;
      const extractedData = {
        contentLength: extractedContent.length,
        extractionDate: new Date().toISOString(),
        model: options.model || 'default',
        extractionMethod: 'simulated'
      };
      
      // Delegate workflow state transition
      try {
        // Import document workflow to avoid circular dependencies
        const { documentWorkflow } = await import('@/lib/services/workflow/domain/document-workflow');
        
        // Trigger the workflow state transition
        await documentWorkflow.processExtraction(
          workflowId,
          documentId,
          {
            content: extractedContent,
            metadata: extractedData,
            userId: options.userId,
            autoVerify: options.autoVerify,
            transactionId
          }
        );
      } catch (workflowError) {
        // Log workflow error but continue (the extraction itself succeeded)
        moduleLogger.warn('Workflow state transition failed but content was extracted', {
          error: workflowError instanceof Error ? workflowError.message : String(workflowError)
        });
      }
      
      progressCallback(100, ProcessingPhase.EXTRACTION);
      
      // Return the extraction result
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
        processingTime: 500
      });
    } catch (error) {
      const normalizedError = normalizeError(error);
      moduleLogger.error('Document extraction failed', {
        error: normalizedError.message,
        stack: normalizedError.stack
      });
      
      // Try updating workflow state to error if possible
      try {
        const { documentWorkflow } = await import('@/lib/services/workflow/domain/document-workflow');
        await documentWorkflow.handleExtractionError(
          workflowId,
          documentId,
          {
            error: normalizedError.message,
            userId: options.userId,
            transactionId
          }
        );
      } catch (workflowError) {
        // Just log workflow errors - primary error is more important
        moduleLogger.warn('Failed to update workflow error state', {
          error: workflowError instanceof Error ? workflowError.message : String(workflowError)
        });
      }
      
      return Result.failure(
        `Document extraction failed: ${normalizedError.message}`,
        normalizedError.code || 'DOCUMENT_EXTRACTION_FAILED',
        {
          documentId,
          details: normalizedError.data
        }
      );
    }
  }

  /**
   * Generate verification for a document.
   * 
   * Uses the workflow engine with fallback to API client.
   * This method coordinates the verification process but delegates
   * state management to workflow components.
   */
  async generateVerification(
    options: GenerateVerificationOptions
  ): Promise<VerificationServiceResult<{
    summaryId: string
    summary: string
    structuredData?: Record<string, any>
  }>> {
    const moduleLogger = logger.withMetadata({
      module: 'DocumentVerificationService',
      method: 'generateVerification',
      workflowId: options.workflowId,
      messageId: options.messageId,
    })

    try {
      moduleLogger.info('Generating verification for document', { workflowId: options.workflowId })

      // Try workflow engine approach first
      try {
        // Import verification workflow to avoid circular dependencies
        const { verificationWorkflow } = await import('@/lib/services/workflow/domain/verification-workflow');
        
        // Check if we have a workflowId
        if (options.workflowId) {
          // Get or create userId from document metadata
          const userId = (options.document.userId as string) ||
                         (options.document.createdBy as string) ||
                         'system';
          
          // Process using workflow engine
          const result = await verificationWorkflow.initiateVerification(
            options.workflowId,
            {
              userId,
              documentId: (options.document.id as string) || options.document.documentId as string,
              documentData: options.document,
              autoGenerateReport: false
            }
          );
          
          if (result.isSuccess()) {
            moduleLogger.info('Verification generated successfully via workflow engine', {
              summaryId: result.value.summaryId,
              verificationId: result.value.verificationId
            });
            
            return {
              success: true,
              data: {
                summaryId: result.value.summaryId || options.summaryId || '',
                summary: result.value.data?.currentSummary ||
                         (options.document.text as string) ||
                         JSON.stringify(options.document),
                structuredData: result.value.data?.structuredData || options.document,
              },
              timestamp: new Date().toISOString(),
            };
          }
          
          // Log failure but continue to API client approach
          moduleLogger.warn('Workflow engine verification failed, using API client', {
            workflowId: options.workflowId,
            error: result.error.message
          });
        }
      } catch (engineError) {
        moduleLogger.warn('Error using workflow engine for verification', {
          error: engineError instanceof Error ? engineError.message : String(engineError),
          workflowId: options.workflowId
        });
      }

      // Call the API through the adapter (fallback approach)
      const result = await verificationAdapter.generateVerificationRequest({
        document: options.document,
        workflowId: options.workflowId || '',
        messageId: options.messageId,
        summaryId: options.summaryId,
      })

      // Handle the API response
      if (!result.success || !result.data?.summaryId) {
        throw new VerificationError({
          message: 'Failed to generate verification',
          code: WORKFLOW_ERROR_CODES.VALIDATION_FAILED,
          data: { originalResult: result },
        })
      }

      moduleLogger.info('Verification generated successfully via API client', {
        summaryId: result.data.summaryId,
      })

      return {
        success: true,
        data: {
          summaryId: result.data.summaryId,
          summary: result.data.summary,
          structuredData: result.data.structuredData,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      const normalized = normalizeError(error)
      moduleLogger.error('Failed to generate verification', {}, normalized)
      return {
        success: false,
        data: { summaryId: '', summary: '' },
        error: {
          message: normalized.message ?? 'Verification generation failed',
          code: normalized.code ?? WORKFLOW_ERROR_CODES.VALIDATION_FAILED,
          details: normalized.data,
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get the verification status of a document by ID.
   */
  async getDocumentVerification(extractedDocumentId: string): Promise<VerificationServiceResult<any>> {
    const moduleLogger = logger.withMetadata({
      module: 'DocumentVerificationService',
      method: 'getDocumentVerification',
      extractedDocumentId,
    })

    try {
      moduleLogger.info('Fetching document verification status', { extractedDocumentId })

      const result = await verificationAdapter.getDocumentVerification(extractedDocumentId)

      if (!result.success) {
        throw new ValidationError({
          message: 'Failed to retrieve document verification status',
          code: DOCUMENT_ERROR_CODES.PROCESSING_ERROR,
          data: { originalResult: result },
        })
      }

      moduleLogger.info('Document verification status retrieved', {
        extractedDocumentId,
      })

      return {
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      const normalized = normalizeError(error)
      moduleLogger.error('Failed to get document verification', {}, normalized)
      return {
        success: false,
        data: {},
        error: {
          message: normalized.message ?? 'Document verification retrieval failed',
          code: normalized.code ?? 'DOCUMENT_VERIFICATION_ERROR',
          details: normalized.data,
        },
        timestamp: new Date().toISOString(),
      }
    }
  }
  
  /**
   * Get document info
   * This is a higher-level method that first tries to get info from the workflow state
   * and falls back to events if necessary
   * 
   * @param documentId The document ID to get info for
   * @param workflowId Optional workflow ID to query
   * @returns Document information
   */
  async getDocumentInfo(
    documentId: string,
    workflowId?: string
  ): Promise<Result<Record<string, unknown> | null>> {
    const moduleLogger = logger.withMetadata({
      module: 'DocumentVerificationService',
      method: 'getDocumentInfo',
      documentId,
      workflowId
    });
    
    try {
      moduleLogger.info('Retrieving document information');
      
      // Try to get from workflow if we have a workflow ID
      if (workflowId) {
        try {
          const { documentWorkflow } = await import('@/lib/services/workflow/domain/document-workflow');
          const result = await documentWorkflow.getDocumentInfo(workflowId, documentId);
          
          if (result.isSuccess() && result.value) {
            return result;
          }
        } catch (workflowError) {
          moduleLogger.warn('Failed to get document info from workflow', {
            error: workflowError instanceof Error ? workflowError.message : String(workflowError)
          });
        }
      }
      
      // Fallback to API or database lookup
      // In a real implementation, this would query a document repository
      moduleLogger.info('Using fallback approach to get document info');
      
      // Return simulated data
      return Result.success({
        documentId,
        fileName: `document-${documentId}.pdf`,
        fileSize: 1024 * 1024 * 2, // 2MB
        fileType: 'application/pdf',
        uploadedAt: new Date().toISOString(),
        status: 'processed'
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
        { documentId }
      );
    }
  }
  
  /**
   * Retry document processing after a failure
   * This is a higher-level method that coordinates retry logic
   * but delegates state transitions to workflow
   * 
   * @param documentId The document ID to retry processing for
   * @param workflowId The workflow ID to use
   * @param options Additional options
   * @returns Processing result
   */
  async retryDocumentProcessing(
    documentId: string,
    workflowId: string,
    options: {
      userId: string;
      transactionId?: string;
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
    }
  ): Promise<Result<DocumentProcessingResult>> {
    const moduleLogger = logger.withMetadata({
      module: 'DocumentVerificationService',
      method: 'retryDocumentProcessing',
      documentId,
      workflowId
    });
    
    try {
      moduleLogger.info('Retrying document processing');
      
      // First get document info to determine state
      const infoResult = await this.getDocumentInfo(documentId, workflowId);
      
      if (infoResult.isFailure() || !infoResult.value) {
        return Result.failure(
          'Cannot retry processing: document not found',
          'DOCUMENT_NOT_FOUND',
          { documentId, workflowId }
        );
      }
      
      // Determine what stage to retry from based on document info
      const docInfo = infoResult.value;
      const lastState = docInfo.state as string || '';
      
      // Delegate to the workflow for state transition
      try {
        const { documentWorkflow } = await import('@/lib/services/workflow/domain/document-workflow');
        await documentWorkflow.retryProcessing(
          workflowId,
          {
            documentId,
            userId: options.userId,
            transactionId: options.transactionId
          }
        );
      } catch (workflowError) {
        moduleLogger.warn('Workflow state transition failed during retry', {
          error: workflowError instanceof Error ? workflowError.message : String(workflowError)
        });
      }
      
      // Determine which operation to retry based on state
      if (lastState.includes('extract') || lastState === 'uploaded') {
        // Retry extraction
        return this.extractContent(documentId, {
          userId: options.userId,
          workflowId,
          transactionId: options.transactionId,
          onProgress: options.onProgress
        });
      } else {
        // By default, retry extraction as fallback
        return this.extractContent(documentId, {
          userId: options.userId,
          workflowId,
          transactionId: options.transactionId,
          onProgress: options.onProgress
        });
      }
    } catch (error) {
      const normalizedError = normalizeError(error);
      moduleLogger.error('Failed to retry document processing', {
        error: normalizedError.message,
        stack: normalizedError.stack
      });
      
      return Result.failure(
        `Failed to retry document processing: ${normalizedError.message}`,
        normalizedError.code || 'RETRY_FAILED',
        { documentId, workflowId }
      );
    }
  }
}

export const documentVerificationService = new DocumentVerificationService()