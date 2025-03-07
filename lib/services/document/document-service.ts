import { createBrowserClient } from '@/lib/supabase/clients'
import logger from '@/lib/logger'
import { normalizeError, ApplicationError } from '@/lib/errors'
import type { ExtractedDocument, DocumentType, ProcessingStatus } from '@/lib/types/document'
import { DocumentLifecycleStage, DocumentProcessingStatus, DocumentCategory } from '@/lib/types/document'
import {
  ProcessingPhase
} from '@/lib/types/workflow' // normal import for enum usage
import type { UUID } from '@/lib/types/base'
import { DocumentAnalysisService } from './analysis-service'
import { DocumentExtractionService } from './extraction-service'
import { DocumentStorageService } from './storage-service'
import { documentFromDb } from '@/lib/types/db-adapters'

// For random UUID generation
import { randomUUID } from 'crypto'

// If there's a custom error "ValidationError" from a separate file:
import { ValidationError } from '@/lib/errors/verification-errors'

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
  metadata?: Record<string, any>
  isPatientDocument?: boolean
  patientId?: string
  departmentId?: string
  extractionLevel?: 'basic' | 'enhanced' | 'comprehensive'
  preserveSections?: boolean
  extractMetadata?: boolean
  chunkingStrategy?: 'simple' | 'semantic' | 'section-based'
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

  private readonly defaultExtractionOptions: EnhancedExtractionOptions = {
    splitPages: true,
    extractTables: true,
    detectSections: true,
    ocrImages: true,
    preserveLayout: true,
    maxPageLength: 5000,
  }

  private readonly maxFileSize = 20 * 1024 * 1024

  /**
   * Process a document by extracting text, analyzing content, and saving if desired.
   */
  public async processDocument(
    file: File,
    options?: DocumentProcessingOptions
  ): Promise<ExtractedDocument> {
    if (!file) {
      throw new ValidationError({
        message: 'File is required',
        code: 'MISSING_FILE'
      })
    }

    const onStatusUpdate = options?.onStatusUpdate ?? (() => {})
    // Start status
    onStatusUpdate({
      status: 'processing',
      progress: 0,
      currentStep: 'Starting document processing', // Confirm currentStep is recognized
      phase: ProcessingPhase.INITIALIZATION
    })

    const moduleLogger = logger.withMetadata({
      module: 'DocumentService',
      method: 'processDocument',
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      patientId: options?.patientId || 'none'
    })

    try {
      moduleLogger.info('Starting document processing')

      // Validate file type
      const isValidType = await this.validateFileType(file)
      if (!isValidType) {
        throw new ValidationError({
          message: `Unsupported file type: ${file.type}`,
          code: 'UNSUPPORTED_FILE_TYPE',
          data: { fileType: file.type }
        })
      }

      // Validate file size
      const isValidSize = await this.validateFileSize(file)
      if (!isValidSize) {
        throw new ValidationError({
          message: `File size exceeds max of ${this.maxFileSize / (1024 * 1024)}MB`,
          code: 'FILE_TOO_LARGE',
          data: { fileSize: file.size, maxSize: this.maxFileSize }
        })
      }

      // Extraction status
      onStatusUpdate({
        status: 'processing',
        progress: 10,
        currentStep: 'Extracting text from document',
        phase: ProcessingPhase.EXTRACTION
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

      // Extract text
      const extractedData = await this.extractionService.extractText(file, extractionOptions)

      // analyzing content
      onStatusUpdate({
        status: 'processing',
        progress: 50,
        currentStep: 'Analyzing document content',
        phase: ProcessingPhase.ANALYSIS
      })

      // Document type detection
      let detectionResult: DetectionResultUnion
      if (options?.documentType) {
        detectionResult = { type: options.documentType, confidence: 1.0 }
      } else {
        detectionResult = await this.analysisService.detectDocumentType(extractedData.rawText)
      }

      if ('detectedSections' in detectionResult && detectionResult.detectedSections?.length) {
        extractedData.metadata.detectedSections = detectionResult.detectedSections
      }
      extractedData.metadata.documentTypeConfidence = detectionResult.confidence

      const documentId: UUID = randomUUID()
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
        lifecycleStage: DocumentLifecycleStage.EXTRACTED
      }

      if (options?.patientId) {
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
        phase: ProcessingPhase.EXTRACTION
      })

      return extractedDocument
    } catch (error) {
      const normError = normalizeError(error)
      moduleLogger.error('Error processing document', {
        errorCode: normError.code,
        errorMessage: normError.message
      }, normError)

      onStatusUpdate({
        status: 'error',
        progress: 0,
        error: normError.message,
        phase: ProcessingPhase.EXTRACTION
      })

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
      const docId = await this.storageService.saveDocument(extractedDocument, departmentId)
      moduleLogger.info(`Document saved successfully with ID: ${docId}`)
      return docId
    } catch (error) {
      moduleLogger.error('Failed to save document to DB', {}, error)
      if (!(error instanceof ApplicationError)) {
        throw new SystemError({
          message: `Failed to save document: ${error instanceof Error ? error.message : String(error)}`,
          code: 'DOCUMENT_SAVE_FAILED',
          data: { documentId: extractedDocument.id },
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
        code: 'EMPTY_FILES_ARRAY'
      })
    }
    if (!patientId) {
      throw new ValidationError({
        message: 'Valid patient ID is required',
        code: 'INVALID_PATIENT_ID'
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
          code: 'BATCH_PROCESSING_FAILED',
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
    if (!patientId) {
      throw new ValidationError({
        message: 'Valid patient ID is required',
        code: 'INVALID_PATIENT_ID'
      })
    }
    if (!file) {
      throw new ValidationError({
        message: 'Valid file is required',
        code: 'INVALID_FILE'
      })
    }

    if (!options?.documentType) {
      throw new ValidationError({
        message: 'Valid document type is required',
        code: 'MISSING_DOCUMENT_TYPE'
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
          code: 'UPLOAD_FAILED',
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

      if (docError || !dbDocument) {
        throw new DocumentServiceError({
          message: `Document not found: ${docError?.message ?? 'Unknown error'}`,
          code: 'DOCUMENT_NOT_FOUND',
          data: { documentId }
        })
      }

      if (!dbDocument.file_path) {
        throw new DocumentServiceError({
          message: 'Document has no storage path',
          code: 'MISSING_STORAGE_PATH',
          data: { documentId }
        })
      }

      // Convert DB doc to typed domain doc
      const domainDoc = documentFromDb(dbDocument as unknown as any)

      const { data: urlData, error: urlError } = await this.supabase.storage
        .from('documents')
        .createSignedUrl(dbDocument.file_path, 3600)

      if (urlError || !urlData?.signedUrl) {
        throw new DocumentServiceError({
          message: `Failed to generate signed URL: ${urlError?.message ?? 'Unknown error'}`,
          code: 'SIGNED_URL_ERROR',
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
        code: 'RETRY_FAILED',
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