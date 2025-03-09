/**
 * Document Extractors
 *
 * Provides specialized extractors for different document types
 */

import { ValidationError } from '@/lib/errors/verification-errors'
import logger from '@/lib/logger'
import { normalizeError, SystemError, ExternalServiceError } from '@/lib/errors'
import { DocumentExtractionService } from '../extraction-service'
import { SectionDetector } from '../utils/section-detection'
import { ChunkingStrategyFactory, ChunkingOptions } from '../chunking/chunking-strategies'
import type { ExtractedData, DocumentMetadata } from '@/lib/types/document'

/**
 * Interface for document extractors
 */
export interface DocumentExtractor {
  /**
   * Extract text and metadata from a document
   *
   * @param file File to extract from
   * @param options Extraction options
   * @returns Extracted data
   */
  extract(file: File, options: EnhancedExtractionOptions): Promise<ExtractedData>;
  
  /**
   * Get supported document types
   *
   * @returns Array of MIME types this extractor supports
   */
  getSupportedTypes(): string[];
}

/**
 * Enhanced extraction options
 */
export interface EnhancedExtractionOptions {
  splitPages?: boolean
  extractTables?: boolean
  detectSections?: boolean
  ocrImages?: boolean
  preserveLayout?: boolean
  maxPageLength?: number
}

/**
 * Base extractor class with common functionality
 */
export abstract class BaseDocumentExtractor implements DocumentExtractor {
  protected logger: typeof logger;
  
  constructor(protected extractionService: DocumentExtractionService) {
    this.logger = logger;
  }
  
  abstract extract(file: File, options: EnhancedExtractionOptions): Promise<ExtractedData>;
  abstract getSupportedTypes(): string[];
  
  /**
   * Create chunks from text using the appropriate strategy
   */
  protected async createChunks(
    text: string,
    options: ChunkingOptions,
    structuredData?: Record<string, any>
  ): Promise<Array<{ content: string, metadata?: Record<string, any> }>> {
    const strategy = ChunkingStrategyFactory.getStrategy(text, options, structuredData);
    return strategy.createChunks(text, options, structuredData);
  }
}

/**
 * OCR-based document extractor for PDFs, images, and Office docs
 */
export class OcrDocumentExtractor extends BaseDocumentExtractor {
  /**
   * Extract text using OCR capabilities
   */
  async extract(file: File, options: EnhancedExtractionOptions): Promise<ExtractedData> {
    const moduleLogger = logger.withMetadata({
      module: 'OcrDocumentExtractor',
      method: 'extract',
      fileType: file.type,
      fileName: file.name,
    });

    moduleLogger.info('Extracting document using OCR', {
      fileType: file.type,
      ocrOptions: options
    });

    try {
      // Convert file to blob for processing
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      
      // Use extractViaOCR from the extraction service
      const result = await this.extractionService.extractViaOCR(blob, file.type, options);
      
      const extractedMetadata: DocumentMetadata = {
        filename: file.name,
        fileFormat: file.type,
        fileSize: file.size,
        extractedAt: new Date(),
        extractionMethod: 'gemini-ocr',
        documentStructure: result.metadata?.documentStructure || 'basic',
        hasStructuredData: true,
        detectedSections: result.detectedSections,
        ocrConfidence: result.confidence,
        pageCount: result.pages?.length || 1,
        hasTables: result.tables && result.tables.length > 0 || false,
        tableCount: result.tables?.length || 0,
        paragraphCount: result.metadata?.paragraphCount || 0,
        processingTime: result.processingTime
      };
      
      // Create chunks using appropriate strategy based on document structure
      const chunks = [];
      
      // If OCR provided structured page data, use it
      if (result.pages && result.pages.length > 0) {
        const pageBasedChunks = await this.createChunks(
          result.text,
          {
            chunkSize: options.maxPageLength || 5000,
            chunkOverlap: 200,
            preserveMetadata: true,
            strategy: 'semantic'
          },
          {
            pages: result.pages,
            source: 'ocr'
          }
        );
        
        chunks.push(...pageBasedChunks);
      }
      // If structured data not available, fall back to section-based chunking
      else {
        const sectionChunks = await this.createChunks(
          result.text,
          {
            chunkSize: options.maxPageLength || 5000,
            chunkOverlap: 200,
            preserveMetadata: true,
            strategy: 'section'
          },
          {
            sections: result.detectedSections,
            source: 'ocr'
          }
        );
        
        chunks.push(...sectionChunks);
      }
      
      moduleLogger.info('OCR extraction completed successfully', {
        textLength: result.text.length,
        chunkCount: chunks.length
      });
      
      // Return final extracted data
      return {
        rawText: result.text,
        metadata: extractedMetadata,
        chunks
      };
    } catch (error) {
      moduleLogger.error('OCR extraction failed', {
        error: error instanceof Error ? error.message : String(error)
      }, error);
      
      // Create an error result structure with the same shape
      const normError = normalizeError(error);
      
      return {
        rawText: '',
        metadata: {
          filename: file.name,
          fileFormat: file.type,
          fileSize: file.size,
          extractedAt: new Date(),
          extractionMethod: 'failed',
          documentStructure: 'unknown',
          hasStructuredData: false,
          error: normError.message,
          errorCode: normError.code,
          errorTimestamp: new Date().toISOString()
        },
        chunks: [] // Empty chunks array for consistency
      };
    }
  }
  
  /**
   * Get supported document types for OCR extraction
   */
  getSupportedTypes(): string[] {
    return [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
  }
}

/**
 * Plain text document extractor
 */
export class PlainTextExtractor extends BaseDocumentExtractor {
  /**
   * Extract text directly from plain text files
   */
  async extract(file: File, options: EnhancedExtractionOptions): Promise<ExtractedData> {
    const moduleLogger = logger.withMetadata({
      module: 'PlainTextExtractor',
      method: 'extract',
      fileType: file.type,
      fileName: file.name,
    });

    moduleLogger.info('Extracting plain text document', {
      fileSize: file.size
    });

    try {
      // Read text directly from file
      const text = await file.text();
      
      // Detect sections if requested
      const detectedSections = options.detectSections
        ? SectionDetector.detectSections(text)
        : [];
      
      // Create chunks using appropriate strategy
      const chunks = await this.createChunks(
        text,
        {
          chunkSize: options.maxPageLength || 5000,
          chunkOverlap: 200,
          preserveMetadata: true,
          strategy: 'section'
        },
        {
          sections: detectedSections,
          source: 'plain-text'
        }
      );
      
      // Prepare metadata
      const extractedMetadata: DocumentMetadata = {
        filename: file.name,
        fileFormat: file.type,
        fileSize: file.size,
        extractedAt: new Date(),
        extractionMethod: 'direct-text',
        documentStructure: detectedSections.length > 0 ? 'sectioned' : 'basic',
        hasStructuredData: chunks.length > 0,
        detectedSections: detectedSections,
        lineCount: text.split('\n').length
      };
      
      moduleLogger.info('Plain text extraction completed successfully', {
        textLength: text.length,
        chunkCount: chunks.length,
        sectionCount: detectedSections.length
      });
      
      // Return extracted data
      return {
        rawText: text,
        metadata: extractedMetadata,
        chunks
      };
    } catch (error) {
      moduleLogger.error('Plain text extraction failed', {
        error: error instanceof Error ? error.message : String(error)
      }, error);
      
      // Create an error result structure
      const normError = normalizeError(error);
      
      return {
        rawText: '',
        metadata: {
          filename: file.name,
          fileFormat: file.type,
          fileSize: file.size,
          extractedAt: new Date(),
          extractionMethod: 'failed',
          documentStructure: 'unknown',
          hasStructuredData: false,
          error: normError.message,
          errorCode: normError.code,
          errorTimestamp: new Date().toISOString()
        },
        chunks: []
      };
    }
  }
  
  /**
   * Get supported document types for plain text extraction
   */
  getSupportedTypes(): string[] {
    return ['text/plain'];
  }
}

/**
 * Factory for creating appropriate document extractors
 */
export class ExtractorFactory {
  private readonly extractors: DocumentExtractor[] = [];
  
  /**
   * Create extractor factory
   *
   * @param extractionService DocumentExtractionService instance
   */
  constructor(extractionService: DocumentExtractionService) {
    this.extractors.push(new OcrDocumentExtractor(extractionService));
    this.extractors.push(new PlainTextExtractor(extractionService));
  }
  
  /**
   * Get the appropriate extractor for a file type
   *
   * @param fileType MIME type of the file
   * @returns DocumentExtractor for the file type
   * @throws ValidationError if no suitable extractor is found
   */
  getExtractorForFileType(fileType: string): DocumentExtractor {
    const extractor = this.extractors.find(ext =>
      ext.getSupportedTypes().includes(fileType)
    );
    
    if (!extractor) {
      throw new ValidationError({
        message: `Unsupported file type: ${fileType}`,
        code: 'UNSUPPORTED_FILE_TYPE',
        data: { fileType }
      });
    }
    
    return extractor;
  }
}