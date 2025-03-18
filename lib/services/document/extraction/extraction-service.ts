/**
 * Document Extraction Service
 * 
 * Responsible for extracting text and content from various document formats.
 * This service focuses solely on core extraction functionality without
 * workflow orchestration, progress tracking, or event handling.
 */
import logger from '@/lib/logger'
import { normalizeError, ApplicationError, ExternalServiceError } from '@/lib/errors'
import type { ExtractedData, DocumentMetadata } from '@/lib/types/document'
import { ChunkingService, DEFAULT_EXTRACTION_CHUNKING_OPTIONS } from '../chunking/chunking-service'
import type { ExtractionChunk } from '@/lib/types/chunk'

/**
 * Custom error class for extraction errors
 */
export class ExtractionError extends ApplicationError {
  constructor(
    message: string,
    code: string,
    isRetryable: boolean = false,
    data?: Record<string, unknown>
  ) {
    super({
      message,
      code,
      data: {
        ...data,
        isRetryable,
      },
    })
  }
}

/**
 * Enhanced extraction options
 */
export interface ExtractionOptions {
  splitPages?: boolean
  extractTables?: boolean
  detectSections?: boolean
  ocrImages?: boolean
  preserveLayout?: boolean
  maxPageLength?: number
  /**
   * Whether to create chunks for the extracted content
   */
  createChunks?: boolean
  /**
   * Options for chunking if createChunks is true
   */
  chunkingOptions?: {
    chunkSize?: number
    chunkOverlap?: number
    strategy?: 'size' | 'semantic' | 'section'
  }
}

/**
 * Service for handling document content extraction
 */
export class ExtractionService {
  /**
   * Default extraction options
   */
  readonly defaultExtractionOptions: ExtractionOptions = {
    splitPages: true,
    extractTables: true,
    detectSections: true,
    ocrImages: true,
    preserveLayout: true,
    maxPageLength: 5000,
    createChunks: true,
    chunkingOptions: {
      chunkSize: DEFAULT_EXTRACTION_CHUNKING_OPTIONS.chunkSize,
      chunkOverlap: DEFAULT_EXTRACTION_CHUNKING_OPTIONS.chunkOverlap,
      strategy: DEFAULT_EXTRACTION_CHUNKING_OPTIONS.strategy
    }
  }
  
  /**
   * Logger instance
   */
  private readonly logger: typeof logger
  
  /**
   * Chunking service instance
   */
  private readonly chunkingService: ChunkingService

  constructor(
    loggerInstance?: typeof logger,
    chunkingService?: ChunkingService
  ) {
    this.logger = loggerInstance || logger
    this.chunkingService = chunkingService || new ChunkingService()
  }

  /**
   * Main method to extract text from a document file
   * 
   * @param file File to extract text from
   * @param options Extraction options
   * @returns Extracted text data
   */
  async extractText(
    file: File,
    options: ExtractionOptions = this.defaultExtractionOptions
  ): Promise<ExtractedData> {
    const moduleLogger = this.logger.withMetadata({
      module: 'ExtractionService',
      method: 'extractText',
      fileType: file.type,
      fileName: file.name,
    })

    try {
      moduleLogger.info('Starting document extraction', {
        fileType: file.type,
        fileSize: file.size
      })

      // Import extractors dynamically to avoid circular dependencies
      const { ExtractorFactory } = await import('./extractors/extractor-factory')
      
      // Create extractor factory
      const extractorFactory = new ExtractorFactory(this)
      
      // Get appropriate extractor for the file type
      const extractor = extractorFactory.getExtractorForFileType(file.type)
      
      // Extract text using the specialized extractor
      const extractionStartTime = Date.now()
      const extractedData = await extractor.extract(file, options)
      
      // If chunking is requested and we have text content
      if (options.createChunks !== false && extractedData.rawText) {
        await this.createChunksForExtractedData(extractedData, options)
      }
      
      const extractionTime = Date.now() - extractionStartTime
      
      // Add extraction metadata
      extractedData.metadata = {
        ...extractedData.metadata,
        extractionMethod: extractedData.metadata.extractionMethod || 'enhanced',
        processingTime: extractionTime,
        processingComplete: true,
        extractedAt: new Date(),
        chunkCount: extractedData.chunks?.length
      }
      
      moduleLogger.info('Document extraction completed successfully', {
        textLength: extractedData.rawText.length,
        chunkCount: extractedData.chunks?.length || 0,
        processingTimeMs: extractionTime
      })
      
      return extractedData
    } catch (error) {
      moduleLogger.error('Failed to extract text from document', {}, error)

      // Create a unified error result structure
      const normError = normalizeError(error)
      const errorExtractedData: ExtractedData = {
        rawText: '',
        metadata: {
          filename: file.name,
          fileFormat: file.type,
          fileSize: file.size,
          extractedAt: new Date(),
          extractionMethod: 'failed',
          documentStructure: 'unknown',
          hasStructuredData: false,
          processingComplete: false,
          error: normError.message,
          errorCode: normError.code,
          errorTimestamp: new Date().toISOString()
        } as DocumentMetadata,
        chunks: [] // Empty chunks array for consistency
      }
      
      return errorExtractedData
    }
  }

  /**
   * Create chunks for the extracted document data
   * 
   * @param extractedData Data from extraction process
   * @param options Extraction options
   */
  private async createChunksForExtractedData(
    extractedData: ExtractedData,
    options: ExtractionOptions
  ): Promise<void> {
    // Configure chunking options from extraction options
    const chunkingOptions = {
      chunkSize: options.chunkingOptions?.chunkSize || DEFAULT_EXTRACTION_CHUNKING_OPTIONS.chunkSize,
      chunkOverlap: options.chunkingOptions?.chunkOverlap || DEFAULT_EXTRACTION_CHUNKING_OPTIONS.chunkOverlap,
      preserveMetadata: true,
      strategy: options.chunkingOptions?.strategy || DEFAULT_EXTRACTION_CHUNKING_OPTIONS.strategy,
      domain: 'extraction'
    }
    
    // Prepare structured data for the chunking service
    const structuredData: Record<string, any> = {}
    
    // Include sections if detected
    if (options.detectSections && extractedData.metadata.detectedSections) {
      structuredData.sections = extractedData.metadata.detectedSections
    }
    
    // Include any page structure from the extraction process
    if (options.splitPages && extractedData.metadata.pages) {
      structuredData.pages = extractedData.metadata.pages
    }
    
    // Include OCR data if available
    if (extractedData.metadata.ocrData) {
      structuredData.ocrData = extractedData.metadata.ocrData
    }
    
    // Use the chunking service to create extraction chunks
    const chunks = await this.chunkingService.createExtractionChunks(
      extractedData.rawText,
      chunkingOptions,
      structuredData
    )
    
    // Add chunks to the extracted data
    extractedData.chunks = chunks.map(chunk => ({
      content: chunk.content,
      pageNumber: chunk.pageNumber,
      metadata: chunk.metadata
    }))
  }

  /**
   * Process multiple documents in parallel
   * 
   * @param files Files to process
   * @param options Extraction options
   * @returns Array of extracted data for each file
   */
  async processDocuments(
    files: File[],
    options?: ExtractionOptions
  ): Promise<ExtractedData[]> {
    if (!files || files.length === 0) {
      return []
    }

    try {
      // Process files in parallel with a concurrency limit
      const concurrencyLimit = 3
      const results: ExtractedData[] = []
      
      // Process in batches to limit concurrency
      for (let i = 0; i < files.length; i += concurrencyLimit) {
        const batch = files.slice(i, i + concurrencyLimit)
        const batchPromises = batch.map(file => this.extractText(file, options))
        
        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
      }
      
      return results
    } catch (error) {
      // Log error
      const moduleLogger = this.logger.withMetadata({
        module: 'ExtractionService',
        method: 'processDocuments',
        fileCount: files.length,
      })
      
      moduleLogger.error('Failed to process documents batch', {}, error)
      
      // Rethrow normalized error
      throw normalizeError(error)
    }
  }
  
  /**
   * Extract text from a document file in the workflow context
   * 
   * This method handles both the domain logic of document extraction
   * and the workflow state transformations, following the pattern
   * of domain services being responsible for both concerns.
   * 
   * @param state Current workflow state
   * @param options Optional extraction options
   * @returns Partial state update with extraction results
   */
  async extractTextFromWorkflowState(
    state: any,
    options: ExtractionOptions = this.defaultExtractionOptions
  ): Promise<Partial<any>> {
    const moduleLogger = this.logger.withMetadata({
      module: 'ExtractionService',
      method: 'extractTextFromWorkflowState',
      workflowId: state.workflowId,
      documentId: state.documentId
    })
    
    // Constants for workflow steps and phases (defining here to avoid circular imports)
    const WorkflowSteps = {
      EXTRACTING: 'extracting',
      ERROR: 'error'
    }
    
    const ProcessingPhase = {
      EXTRACTION: 'extraction',
      EXTRACTION_COMPLETED: 'extraction_completed',
      ERROR: 'error'
    }
    
    try {
      // Log the start of extraction
      moduleLogger.info('Starting document extraction', {
        documentId: state.documentId,
        fileName: state.file?.name,
        fileType: state.file?.type,
        fileSize: state.file?.size
      })
      
      // Update progress state to indicate extraction is starting
      const partialState: Partial<any> = {
        progress: {
          currentStep: WorkflowSteps.EXTRACTING,
          percentage: 20,
          phase: ProcessingPhase.EXTRACTION,
          isCompleted: false
        },
        workflowUpdatedAt: new Date().toISOString()
      }
      
      // Validate input state has the required file
      if (!state.file) {
        throw new Error('No file available for extraction')
      }
      
      // Perform extraction using the extraction service
      const extractionStartTime = Date.now()
      const extractedData = await this.extractText(state.file, options)
      const extractionTime = Date.now() - extractionStartTime
      
      // Calculate confidence score based on metadata or defaults
      const customMetadata = extractedData.metadata.custom || {};
      const confidence = 
        customMetadata.confidence ? 
        Number(customMetadata.confidence) : 
        (customMetadata.processingComplete ? 0.85 : 0.5);
      
      // Log successful extraction
      moduleLogger.info('Document extraction completed', {
        documentId: state.documentId,
        textLength: extractedData.rawText.length,
        chunkCount: extractedData.chunks?.length || 0,
        processingTimeMs: extractionTime,
        success: (customMetadata.processingComplete as boolean) === true
      })
      
      // Update the state with extraction results
      return {
        ...partialState,
        extractedData: {
          text: extractedData.rawText,
          structuredData: extractedData.chunks ? 
            { chunks: extractedData.chunks } as Record<string, unknown> : 
            {} as Record<string, unknown>,
          extractedAt: new Date().toISOString()
        },
        progress: {
          currentStep: WorkflowSteps.EXTRACTING,
          percentage: 40,
          phase: ProcessingPhase.EXTRACTION_COMPLETED,
          isCompleted: false
        }
      }
    } catch (error) {
      // Log the error
      moduleLogger.error('Document extraction failed', {
        documentId: state.documentId,
        fileName: state.file?.name
      }, error)
      
      // Return error state
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown extraction error',
          domain: 'extraction',
          step: WorkflowSteps.EXTRACTING,
          timestamp: new Date().toISOString(),
          recoverable: false,
          context: { 
            error: String(error),
            fileName: state.file?.name,
            fileType: state.file?.type
          }
        },
        progress: {
          currentStep: WorkflowSteps.ERROR,
          percentage: state.progress?.percentage || 0,
          phase: ProcessingPhase.ERROR,
          isCompleted: false
        },
        workflowUpdatedAt: new Date().toISOString()
      }
    }
  }
}