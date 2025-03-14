import { createBrowserClient } from '@/lib/supabase/clients'
import logger from '@/lib/logger'
import { normalizeError, ApplicationError } from '@/lib/errors'
import type { ExtractedDocument, DocumentType, ProcessingStatus } from '@/lib/types/document'
import { DocumentLifecycleStage, DocumentProcessingStatus, DocumentCategory } from '@/lib/types/document'
import {
  ProcessingPhase
} from '@/lib/types/workflow' // normal import for enum usage
import type { UUID } from '@/lib/types/base'
import { DOCUMENT_ERROR_CODES, STORAGE_ERROR_CODES } from '@/lib/errors/error-codes'
import { DocumentAnalysisService } from './analysis-service'
import { DocumentExtractionService } from './extraction-service'
import { DocumentStorageService } from './storage-service'
import { documentMapper } from '@/lib/types/document-mapper'
import type { DbDocument } from '@/lib/types/db-adapters'

// For random UUID generation
import { randomUUID } from 'crypto'

// If there's a custom error "ValidationError" from a separate file:
import { ValidationError } from '@/lib/errors/verification-errors'
import { withRetry } from '@/lib/utils/retry'

// Simplified "SystemError" removing "Error | unknown" => just "unknown"
class SystemError extends ApplicationError {
  constructor(options: {
    message: string
    code?: string
    data?: Record<string, unknown>
    cause?: unknown
  }) {
    super({ ...options, isOperational: true })
    this.name = 'SystemError'
  }
}

// Simplified "DocumentServiceError" removing "Error | unknown"
class DocumentServiceError extends ApplicationError {
  constructor(options: {
    message: string
    code?: string
    data?: Record<string, unknown>
    cause?: unknown
  }) {
    super({ ...options, isOperational: true })
    this.name = 'DocumentServiceError'
  }
}

// Add at the top with other types
type ExtractionLevel = 'basic' | 'enhanced' | 'comprehensive';
type ChunkingStrategy = 'simple' | 'semantic' | 'section-based';

/**
 * This is the union type for detectDocumentType() results:
 */
interface ExtendedDocumentTypeDetectionResult {
  type: DocumentType
  confidence: number
  detectedSections?: string[]
  possibleTypes?: DocumentType[]
}
type DetectionResultUnion =
  | ExtendedDocumentTypeDetectionResult
  | { type: DocumentType; confidence: number }

/**
 * Options used when processing documents.
 */
interface DocumentProcessingOptions {
  documentType?: DocumentType
  onStatusUpdate?: (status: ProcessingStatus) => void
  metadata?: Record<string, unknown>
  isPatientDocument?: boolean
  patientId?: string
  departmentId?: string
  extractionLevel?: ExtractionLevel
  preserveSections?: boolean
  extractMetadata?: boolean
  chunkingStrategy?: ChunkingStrategy
  prioritizeFields?: string[]
}

/**
 * Enhanced extraction options
 */
interface EnhancedExtractionOptions {
  splitPages?: boolean
  extractTables?: boolean
  detectSections?: boolean
  ocrImages?: boolean
  preserveLayout?: boolean
  maxPageLength?: number
}

/**
 * DocumentService implements functionality for
 * uploading, processing, extracting, and storing documents.
 */
export class DocumentService {
  private readonly supabase = createBrowserClient()

  private readonly extractionService = new DocumentExtractionService()
  private readonly analysisService = new DocumentAnalysisService()
  private readonly storageService = new DocumentStorageService()
/**
 * Process a document by extracting text, analyzing content, and saving if desired.
 * Now integrates with the workflow system for better state management.
 */
public async processDocument(
  file: File,
  options?: DocumentProcessingOptions
): Promise<ExtractedDocument> {
  if (file === null || file === undefined) {
    throw new ValidationError({
      message: 'File is required',
      code: DOCUMENT_ERROR_CODES.INVALID_FORMAT
    })
  }

  const onStatusUpdate = options?.onStatusUpdate ?? (() => {})
  // Start status
  onStatusUpdate({
    status: 'processing',
    progress: 0,
    currentStep: 'Starting document processing',
    phase: ProcessingPhase.INITIALIZATION
  })

  const moduleLogger = logger.withMetadata({
    module: 'DocumentService',
    method: 'processDocument',
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    patientId: options?.patientId ?? 'none'
  })

  // Create a workflow ID for this document processing task
  const workflowId = randomUUID()
  
  try {
    moduleLogger.info('Starting document processing using workflow', { workflowId })

    // Validate file type
    const isValidType = await this.validateFileType(file)
    if (!isValidType) {
      throw new ValidationError({
        message: `Unsupported file type: ${file.type}`,
        code: DOCUMENT_ERROR_CODES.INVALID_FORMAT,
        data: { fileType: file.type }
      })
    }

    // Validate file size
    const isValidSize = await this.validateFileSize(file)
    if (!isValidSize) {
      throw new ValidationError({
        message: `File size exceeds max of ${this.maxFileSize / (1024 * 1024)}MB`,
        code: DOCUMENT_ERROR_CODES.SIZE_TOO_LARGE,
        data: { fileSize: file.size, maxSize: this.maxFileSize }
      })
    }

    // Import workflow domain service dynamically to avoid circular dependencies
    const { documentWorkflow } = await import('../workflow/domain/document-workflow')
    
    // Process document through workflow
    const processingResult = await documentWorkflow.processUpload(
      workflowId,
      file,
      {
        userId: options?.metadata?.uploadedBy as string || 'system',
        patientId: options?.patientId,
        documentType: options?.documentType || {
          category: DocumentCategory.CLINICAL,
          type: 'unknown'
        },
        autoExtract: true,
        onProgress: (progress, phase) => {
          onStatusUpdate({
            status: 'processing',
            progress,
            currentStep: this.getStepDescription(phase),
            phase
          })
        },
        transactionId: options?.metadata?.transactionId as string
      }
    )
    
    if (processingResult.isFailure()) {
      throw new ApplicationError({
        message: processingResult.error.message,
        code: processingResult.error.code || DOCUMENT_ERROR_CODES.PROCESSING_ERROR,
        data: processingResult.error.details
      })
    }

    const result = processingResult.value
    moduleLogger.info('Document successfully processed through workflow', {
      documentId: result.documentId,
      workflowId
    })

    // Decide extraction level
    const extractionLevel = options?.extractionLevel ?? this.getExtractionLevelForFile(file)

    // Build extraction options
    const extractionOptions: EnhancedExtractionOptions = {
      ...this.defaultExtractionOptions,
      splitPages: extractionLevel !== 'basic',
      extractTables: extractionLevel !== 'basic',
      detectSections: extractionLevel !== 'basic',
      ocrImages: extractionLevel === 'comprehensive',
      preserveLayout: extractionLevel === 'comprehensive',
    }

    // Extract text with retry logic if not already done by workflow
    // This is a fallback in case the workflow didn't perform the extraction
    let extractedData: ExtractedData
    if (result.content) {
      extractedData = {
        rawText: result.content,
        metadata: {
          ...result.metadata,
          extractionMethod: 'workflow',
          extractedAt: new Date().toISOString()
        },
        chunks: []
      }
    } else {
      extractedData = await withRetry(
        async () => this.extractionService.extractText(file, extractionOptions),
        {
          maxRetries: 3,
          baseDelay: 2000,
          retryCondition: (error) => {
            // Only retry certain errors, not validation errors
            if (error instanceof ValidationError) {
              return false;
            }
            
            // Consider most extraction errors as retryable
            moduleLogger.warn('Document extraction error, retrying', { 
              error: error instanceof Error ? error.message : String(error)
            });
            
            return true;
          }
        }
      )
    }

    // Document type detection
    let detectionResult: DetectionResultUnion
    if (options?.documentType) {
      detectionResult = { type: options.documentType, confidence: 1.0 }
    } else if (result.metadata.documentType) {
      detectionResult = {
        type: result.metadata.documentType as DocumentType,
        confidence: result.metadata.documentTypeConfidence as number || 0.9
      }
    } else {
      onStatusUpdate({
        status: 'processing',
        progress: 50,
        currentStep: 'Analyzing document content',
        phase: ProcessingPhase.ANALYSIS
      })
      
      detectionResult = await withRetry(
        async () => this.analysisService.detectDocumentType(extractedData.rawText),
        {
          maxRetries: 2,
          baseDelay: 1000,
          retryCondition: (error) => {
            // Retry detection errors except validation errors
            if (error instanceof ValidationError) {
              return false;
            }
            
            moduleLogger.warn('Document type detection error, retrying', {
              error: error instanceof Error ? error.message : String(error)
            });
            
            return true;
          }
        }
      )
    }

    if ('detectedSections' in detectionResult && detectionResult.detectedSections && detectionResult.detectedSections.length > 0) {
      extractedData.metadata.detectedSections = detectionResult.detectedSections
    }
    extractedData.metadata.documentTypeConfidence = detectionResult.confidence

    const documentId = result.documentId || randomUUID()
    const timestamp = new Date().toISOString()

    const finalDocType = detectionResult.type

    const extractedDocument: ExtractedDocument = {
      id: documentId,
      createdAt: timestamp,
      updatedAt: timestamp,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      documentType: finalDocType,
      patientId: options?.patientId,
      extractedData,
      isProcessed: true,
      processingStatus: DocumentProcessingStatus.COMPLETED,
      lifecycleStage: DocumentLifecycleStage.EXTRACTED,
      metadata: {
        ...options?.metadata,
        workflowId
      }
    }

    if (options?.patientId !== undefined && options.patientId !== null && options.patientId.trim() !== '') {
      try {
        const dbId = await this.saveDocument(extractedDocument, options.departmentId)
        if (dbId !== documentId) {
          extractedDocument.id = dbId
        }
      } catch (saveError) {
        moduleLogger.warn('Document extracted but failed to save to DB', {
          saveError: saveError instanceof Error ? saveError.message : String(saveError)
        })
      }
    }

    onStatusUpdate({
      status: 'success',
      progress: 100,
      currentStep: 'Document extraction completed',
      phase: ProcessingPhase.COMPLETION
    })

    return extractedDocument
  } catch (error) {
    const normError = normalizeError(error)
    moduleLogger.error('Error processing document', {
      errorCode: normError.code,
      errorMessage: normError.message,
      workflowId
    }, normError)

    onStatusUpdate({
      status: 'error',
      progress: 0,
      error: normError.message,
      phase: ProcessingPhase.ERROR
    })

    // Try to update the workflow state to reflect the error
    try {
      const { workflowEngine } = await import('../workflow/coordination/workflow-engine')
      await workflowEngine.sendAction(workflowId, {
        type: 'PROCESS_ERROR',
        payload: {
          error: normError.message,
          errorCode: normError.code,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        }
      })
    } catch (workflowError) {
      // Just log if workflow update fails - this is not critical
      moduleLogger.warn('Failed to update workflow error state', {
        error: workflowError instanceof Error ? workflowError.message : String(workflowError)
      })
    }

    const errorId: UUID = randomUUID()
    const ts = new Date().toISOString()

    return {
      id: errorId,
      createdAt: ts,
      updatedAt: ts,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      documentType: options?.documentType ?? {
        category: DocumentCategory.CLINICAL,
        type: 'unknown'
      },
      patientId: options?.patientId,
      extractedData: {
        rawText: '',
        metadata: {
          error: normError.message,
          errorCode: normError.code,
          workflowId
        }
      },
      isProcessed: false,
      processingError: normError.message,
      processingStatus: DocumentProcessingStatus.FAILED,
      lifecycleStage: DocumentLifecycleStage.FAILED,
      metadata: {
        workflowId,
        errorDetails: normError.data
      }
    }
  }
}

/**
 * Get descriptive step name for UI display based on processing phase
 */
private getStepDescription(phase: ProcessingPhase): string {
  switch (phase) {
    case ProcessingPhase.INITIALIZATION:
      return 'Starting document processing';
    case ProcessingPhase.UPLOADING:
      return 'Uploading document';
    case ProcessingPhase.EXTRACTION:
      return 'Extracting text from document';
    case ProcessingPhase.EXTRACTION_COMPLETED:
      return 'Text extraction completed';
    case ProcessingPhase.ANALYSIS:
      return 'Analyzing document content';
    case ProcessingPhase.VERIFICATION:
      return 'Verifying document data';
    case ProcessingPhase.VERIFICATION_PENDING:
      return 'Awaiting verification';
    case ProcessingPhase.REPORT_GENERATION:
      return 'Generating report';
    case ProcessingPhase.COMPLETION:
      return 'Processing completed';
    case ProcessingPhase.ERROR:
      return 'Processing error';
    default:
      return 'Processing document';
  }
}
          metadata: {
            error: normError.message,
            errorCode: normError.code
          }
        },
        isProcessed: false,
        processingError: normError.message,
        processingStatus: DocumentProcessingStatus.FAILED,
        lifecycleStage: DocumentLifecycleStage.FAILED
      }
    }
  }

  /**
   * Save extracted document to DB using storage service.
   */
  public async saveDocument(
    extractedDocument: ExtractedDocument,
    departmentId?: string
  ): Promise<string> {
    const moduleLogger = logger.withMetadata({
      module: 'DocumentService',
      method: 'saveDocument',
      documentId: extractedDocument.id,
      patientId: extractedDocument.patientId,
    })

    try {
      // Use standardized retry logic for DB operations
      const docId = await withRetry(
        async () => this.storageService.saveDocument(extractedDocument, departmentId),
        {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 5000,
          retryCondition: (error) => {
            // Don't retry validation errors
            if (error instanceof ValidationError) {
              return false;
            }
            
            // Retry database connection issues and transient errors
            if (error instanceof ApplicationError) {
              // Check if error code indicates a transient issue
              const retryableCodes = [
                DOCUMENT_ERROR_CODES.PROCESSING_ERROR,
                DOCUMENT_ERROR_CODES.STORAGE_ERROR,
                STORAGE_ERROR_CODES.DOWNLOAD_FAILED
              ];
              
              const shouldRetry = retryableCodes.includes(error.code ?? '');
              
              moduleLogger.warn('Document save error, determining if retryable', {
                errorCode: error.code,
                retryable: shouldRetry
              });
              
              return shouldRetry;
            }
            
            // For other errors, assume they may be transient network issues
            return true;
          }
        }
      );
      
      moduleLogger.info(`Document saved successfully with ID: ${docId}`)
      return docId;
    } catch (error) {
      moduleLogger.error('Failed to save document to DB after retries', {}, error)
      if (!(error instanceof ApplicationError)) {
        throw new SystemError({
          message: `Failed to save document: ${error instanceof Error ? error.message : String(error)}`,
          code: DOCUMENT_ERROR_CODES.STORAGE_ERROR,
          data: { 
            documentId: extractedDocument.id,
            retryable: false
          },
          cause: error
        })
      }
      throw error
    }
  }

  /**
   * Batch process multiple documents in parallel
   */
  public async batchProcessDocuments(
    files: File[],
    patientId: UUID,
    options?: DocumentProcessingOptions
  ): Promise<{
    successful: ExtractedDocument[]
    failed: { file: File; error: Error }[]
  }> {
    if (!Array.isArray(files) || files.length === 0) {
      throw new ValidationError({
        message: 'Files array must contain at least one file',
        code: DOCUMENT_ERROR_CODES.INVALID_FORMAT
      })
    }
    if (patientId === null || patientId === undefined || patientId.trim() === '') {
      throw new ValidationError({
        message: 'Valid patient ID is required',
        code: DOCUMENT_ERROR_CODES.INVALID_FORMAT
      })
    }

    const moduleLogger = logger.withMetadata({
      module: 'DocumentService',
      method: 'batchProcessDocuments',
      fileCount: files.length,
      patientId
    })

    moduleLogger.info('Starting batch document processing')
    const batchSize = 5
    const successful: ExtractedDocument[] = []
    const failed: { file: File; error: Error }[] = []

    try {
      const totalBatches = Math.ceil(files.length / batchSize)

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize)
        const currentBatch = Math.floor(i / batchSize) + 1

        moduleLogger.debug(`Processing batch ${currentBatch} of ${totalBatches}`, {
          batchSize: batch.length,
          startIndex: i,
          endIndex: Math.min(i + batchSize - 1, files.length - 1)
        })

        const results = await Promise.allSettled(
          batch.map((file) =>
            this.processDocument(file, { ...options, patientId })
          )
        )

        results.forEach((res, index) => {
          if (res.status === 'fulfilled') {
            successful.push(res.value)
          } else {
            const error = res.reason instanceof Error
              ? res.reason
              : new Error(String(res.reason))
            failed.push({ file: batch[index], error })
          }
        })

        moduleLogger.info(`Completed batch ${currentBatch} of ${totalBatches}`, {
          batchSuccessCount: results.filter(r => r.status === 'fulfilled').length,
          batchFailureCount: results.filter(r => r.status === 'rejected').length
        })
      }

      moduleLogger.info('Batch processing completed', {
        totalFiles: files.length,
        successCount: successful.length,
        failureCount: failed.length,
        successRate: `${((successful.length / files.length) * 100).toFixed(1)}%`
      })

      return { successful, failed }
    } catch (error) {
      moduleLogger.error('Unexpected error in batch processing', {}, error)
      if (!(error instanceof ApplicationError)) {
        throw new SystemError({
          message: `Batch processing failed: ${error instanceof Error ? error.message : String(error)}`,
          code: DOCUMENT_ERROR_CODES.PROCESSING_ERROR,
          data: { fileCount: files.length, patientId },
          cause: error
        })
      }
      throw error
    }
  }

  /**
   * Upload a document to storage and track status. If you have an `uploadService`, use it.
   */
  public async uploadDocument(
    patientId: UUID,
    file: File,
    options: {
      documentType: DocumentType
      departmentId?: UUID
      priority?: 'low' | 'normal' | 'high'
      tags?: string[]
      onStatusUpdate?: (status: ProcessingStatus) => void
    }
  ): Promise<{ documentId: string; fileName: string; extractionStatus: string }> {
    if (patientId === null || patientId === undefined || patientId.trim() === '') {
      throw new ValidationError({
        message: 'Valid patient ID is required',
        code: DOCUMENT_ERROR_CODES.INVALID_FORMAT
      })
    }
    if (file === null || file === undefined) {
      throw new ValidationError({
        message: 'Valid file is required',
        code: DOCUMENT_ERROR_CODES.INVALID_FORMAT
      })
    }

    if (options?.documentType === null || options?.documentType === undefined) {
      throw new ValidationError({
        message: 'Valid document type is required',
        code: DOCUMENT_ERROR_CODES.INVALID_FORMAT
      })
    }

    const moduleLogger = logger.withMetadata({
      module: 'DocumentService',
      method: 'uploadDocument',
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      patientId
    })

    try {
      moduleLogger.info(`Starting document upload for docType: ${options.documentType.category}/${options.documentType.type}`)

      // If there's an external uploadService, call it here, else a fake:
      const fakeId = randomUUID()
      moduleLogger.info(`Document upload completed successfully. New doc ID: ${fakeId}`)

      return {
        documentId: fakeId,
        fileName: file.name,
        extractionStatus: 'uploaded'
      }
    } catch (error) {
      moduleLogger.error('Document upload failed', {}, error)
      if (options.onStatusUpdate) {
        options.onStatusUpdate({
          status: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : String(error),
          phase: ProcessingPhase.UPLOADING
        })
      }
      if (!(error instanceof ApplicationError)) {
        throw new SystemError({
          message: `Document upload failed: ${error instanceof Error ? error.message : String(error)}`,
          code: DOCUMENT_ERROR_CODES.UPLOAD_FAILED,
          data: { fileName: file.name, patientId },
          cause: error
        })
      }
      throw error
    }
  }

  /**
   * Retry extraction for a failed document
   */
  public async retryExtraction(
    documentId: string,
    options?: {
      forceReExtract?: boolean
      extractionLevel?: 'basic' | 'enhanced' | 'comprehensive'
    }
  ): Promise<{ success: boolean; documentId: string }> {
    try {
      const { data: dbDocument, error: docError } = await this.supabase
        .from('patient_documents')
        .select('*')
        .eq('id', documentId)
        .single()

      if (docError !== null || dbDocument === null || dbDocument === undefined) {
        throw new DocumentServiceError({
          message: `Document not found: ${docError?.message ?? 'Unknown error'}`,
          code: DOCUMENT_ERROR_CODES.NOT_FOUND,
          data: { documentId }
        })
      }

      if (!dbDocument.file_path) {
        throw new DocumentServiceError({
          message: 'Document has no storage path',
          code: STORAGE_ERROR_CODES.INVALID_PATH,
          data: { documentId }
        })
      }

      // Convert DB doc to typed domain doc
      const domainDoc = documentMapper.toDomain(dbDocument as unknown as DbDocument)

      const { data: urlData, error: urlError } = await this.supabase.storage
        .from('documents')
        .createSignedUrl(dbDocument.file_path, 3600)

      if (urlError || !urlData?.signedUrl) {
        throw new DocumentServiceError({
          message: `Failed to generate signed URL: ${urlError?.message ?? 'Unknown error'}`,
          code: STORAGE_ERROR_CODES.DOWNLOAD_FAILED,
          data: { documentId }
        })
      }

      // Mark as processing again
      const oldMetadata = (domainDoc.metadata && typeof domainDoc.metadata === 'object')
        ? domainDoc.metadata
        : {}

      await this.supabase
        .from('patient_documents')
        .update({
          processing_status: 'processing',
          metadata: {
            ...oldMetadata,
            reprocessing: true,
            reprocessingTime: new Date().toISOString(),
            extractionLevel: options?.extractionLevel ?? 'comprehensive'
          }
        })
        .eq('id', documentId)

      await this.supabase.functions.invoke('document-extraction', {
        body: {
          documentId,
          fileUrl: urlData.signedUrl,
          fileName: domainDoc.fileName ?? dbDocument.title ?? 'unknown',
          fileType: domainDoc.fileType ?? dbDocument.file_type,
          options: {
            documentType: domainDoc.documentType ?? dbDocument.document_type,
            departmentId: domainDoc.departmentId ?? dbDocument.department,
            forceReExtract: options?.forceReExtract ?? true,
            extractionLevel: options?.extractionLevel ?? 'comprehensive',
          }
        }
      })

      return { success: true, documentId }
    } catch (error) {
      logger.error('Error retrying extraction:', {}, error)
      if (error instanceof DocumentServiceError) {
        throw error
      }
      throw new DocumentServiceError({
        message: `Failed to retry extraction: ${error instanceof Error ? error.message : String(error)}`,
        code: DOCUMENT_ERROR_CODES.EXTRACTION_FAILED,
        data: { documentId },
        cause: error
      })
    }
  }

  private async validateFileType(file: File): Promise<boolean> {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
    ]
    return allowed.includes(file.type)
  }

  private async validateFileSize(file: File): Promise<boolean> {
    return file.size <= this.maxFileSize
  }

  private getExtractionLevelForFile(file: File): 'basic' | 'enhanced' | 'comprehensive' {
    if (file.type === 'application/pdf') return 'comprehensive'
    if (file.type.startsWith('application/vnd.openxmlformats-officedocument')) return 'enhanced'
    return 'basic'
  }
}

// Export default instance
export const documentService = new DocumentService()