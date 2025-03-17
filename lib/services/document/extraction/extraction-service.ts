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
    maxPageLength: 5000
  }
  
  /**
   * Logger instance
   */
  private readonly logger: typeof logger

  constructor(loggerInstance?: typeof logger) {
    this.logger = loggerInstance || logger
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
}