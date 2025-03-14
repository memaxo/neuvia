/**
 * Document Extraction Service
 * 
 * Responsible for extracting text and content from various document formats
 * using specialized strategies for each format type.
 */
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { Document } from 'langchain/document'
import logger from '@/lib/logger'
import { normalizeError, ApplicationError, ExternalServiceError } from '@/lib/errors'
import { SectionDetector } from './utils/section-detection'
import { GeminiOCRClient, OCRDocument, OCRPage as GeminiOCRPage } from './gemini-ocr-client'
import { getDefaultConfig } from '@/lib/langchain/config'

import type { 
  DocumentType,
  ExtractedData, 
  DocumentMetadata
} from '@/lib/types/document'

// Define OCR data structures for internal use
export interface OcrPage {
  content: string
  bounds?: any
  coordinates?: any
  confidence?: number
  pageNumber?: number
  paragraphs?: OcrParagraph[]
  tables?: OcrTable[]
}

export interface OcrParagraph {
  content: string
  bounds?: any
  confidence?: number
  isTable?: boolean
  sectionType?: string | null
  index?: number
}

export interface OcrTable {
  content?: string
  text?: string
  cells?: any[]
  bounds?: any
  rows?: number
  columns?: number
  pageNumber?: number
  confidence?: number
}

export interface OCRResult {
  text: string
  pages?: OcrPage[]
  detectedSections?: string[]
  confidence?: number
  tables?: OcrTable[]
  metadata?: Record<string, any>
  processingTime?: number
}

// Use a type that doesn't conflict with the DocumentMetadata interface
type ExtractedMetadata = DocumentMetadata & {
  chunkCount?: number
  filename?: string
  fileFormat?: string
  fileSize?: string | number
  extractedAt?: Date
  extractionMethod?: string
  documentStructure?: string
  hasStructuredData?: boolean
  processingComplete?: boolean
  processingTimestamp?: string
  errorCode?: string
  errorTimestamp?: string
  paragraphCount?: number
  tableCount?: number
  ocrConfidence?: number
  pageCount?: number
  hasTables?: boolean
  sectionTypes?: string[]
  lineCount?: number
  imageType?: string
  detectedSections?: string[]
  hasPageBoundaries?: boolean
  processingTime?: number
  // Use string for the documentType category which will be more flexible
  documentTypeCategory?: string
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
 * Chunking options
 */
export interface ChunkingOptions {
  chunkSize: number
  chunkOverlap: number
  preserveMetadata: boolean
  strategy: 'size' | 'semantic' | 'section'
}

/**
 * Custom error class for extraction errors
 */
class ExtractionError extends ApplicationError {
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
 * Service for handling document content extraction
 */
export class DocumentExtractionService {
  /**
   * Logger instance
   */
  private readonly logger: typeof logger

  /**
   * OCR client
   */
  private readonly geminiClient: GeminiOCRClient

  constructor(loggerInstance?: typeof logger) {
    this.logger = loggerInstance || logger
    this.geminiClient = new GeminiOCRClient()
  }

  /**
  /**
   * Main method to extract text from a document file
   * Aligned with workflow events for better integration
   * 
   * @param file File to extract text from
   * @param options Extraction options
   * @param workflowId Optional workflow ID for event tracking
   * @param onProgress Optional progress callback
   * @returns Extracted text data
   */
  async extractText(
    file: File,
    options: EnhancedExtractionOptions = this.defaultExtractionOptions,
    workflowId?: string,
    onProgress?: (progress: number, phase: ProcessingPhase) => void
  ): Promise<ExtractedData> {
    const moduleLogger = this.logger.withMetadata({
      module: 'DocumentExtractionService',
      method: 'extractText',
      fileType: file.type,
      fileName: file.name,
      workflowId
    });

    try {
      moduleLogger.info('Starting document extraction', {
        fileType: file.type,
        fileSize: file.size
      });
      
      // Report initial progress
      if (onProgress) {
        onProgress(5, ProcessingPhase.EXTRACTION);
      }

      // Import extractors dynamically to avoid circular dependencies
      const { ExtractorFactory } = await import('./extractors/extractor-factory');
      
      // Create extractor factory
      const extractorFactory = new ExtractorFactory(this);
      
      // Get appropriate extractor for the file type
      const extractor = extractorFactory.getExtractorForFileType(file.type);
      
      // Report progress before extraction
      if (onProgress) {
        onProgress(20, ProcessingPhase.EXTRACTION);
      }
      
      // Emit extraction start event if workflow ID is provided
      if (workflowId) {
        await this.emitExtractionEvent(workflowId, 'extraction_started', {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          extractionOptions: {
            splitPages: options.splitPages,
            extractTables: options.extractTables,
            detectSections: options.detectSections
          }
        });
      }
      
      // Use monitorable extraction with progress reporting
      const extractStartTime = Date.now();
      let lastProgressReported = Date.now();
      const progressInterval = 1000; // Report progress at most once per second
      
      // Wrap extractor with progress monitoring
      const extractionPromise = extractor.extract(file, options);
      
      // For longer extractions, generate some intermediate progress updates
      const progressTimer = setInterval(() => {
        const elapsed = Date.now() - extractStartTime;
        
        // After 3 seconds, if we're still extracting, provide progress updates
        if (elapsed > 3000 && onProgress) {
          const progress = Math.min(80, 20 + Math.floor(elapsed / 250)); // Cap at 80%
          onProgress(progress, ProcessingPhase.EXTRACTION);
          
          // Also emit progress event to workflow if appropriate
          if (workflowId && (Date.now() - lastProgressReported) > progressInterval) {
            this.emitExtractionEvent(workflowId, 'extraction_progress', {
              progress,
              phase: ProcessingPhase.EXTRACTION
            }).catch(e => {
              // Just log if workflow update fails - non-critical
              moduleLogger.warn('Failed to emit extraction progress event', {
                error: e instanceof Error ? e.message : String(e)
              });
            });
            lastProgressReported = Date.now();
          }
        }
      }, 500);
      
      // Wait for extraction to complete
      const extractedData = await extractionPromise;
      clearInterval(progressTimer);
      
      // Calculate extraction time
      const extractionTime = Date.now() - extractStartTime;
      
      // Report progress after extraction
      if (onProgress) {
        onProgress(90, ProcessingPhase.EXTRACTION_COMPLETED);
      }
      
      // Add extraction metadata
      extractedData.metadata = {
        ...extractedData.metadata,
        extractionMethod: 'enhanced',
        processingTime: extractionTime,
        processingComplete: true,
        extractedAt: new Date(),
        chunkCount: extractedData.chunks?.length
      };
      
      moduleLogger.info('Document extraction completed successfully', {
        textLength: extractedData.rawText.length,
        chunkCount: extractedData.chunks?.length || 0,
        processingTimeMs: extractionTime
      });
      
      // Emit extraction completed event if workflow ID is provided
      if (workflowId) {
        await this.emitExtractionEvent(workflowId, 'extraction_completed', {
          processingTimeMs: extractionTime,
          textLength: extractedData.rawText.length,
          chunkCount: extractedData.chunks?.length || 0,
          detectedSections: extractedData.metadata.detectedSections,
          hasStructuredData: !!extractedData.metadata.hasStructuredData
        });
        
        // If workflow engine is available, also send action
        try {
          const { workflowEngine } = await import('../workflow/coordination/workflow-engine');
          await workflowEngine.sendAction(workflowId, {
            type: 'EXTRACTION_PROGRESS',
            payload: {
              progress: 100,
              phase: ProcessingPhase.EXTRACTION_COMPLETED
            }
          });
        } catch (error) {
          // Non-critical if this fails - just log
          moduleLogger.warn('Failed to update workflow engine', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      // Final progress update
      if (onProgress) {
        onProgress(100, ProcessingPhase.EXTRACTION_COMPLETED);
      }
      
      return extractedData;
    } catch (error) {
      moduleLogger.error('Failed to extract text from document', {}, error);

      // Create a unified error result structure
      const normError = normalizeError(error);
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
        } as ExtractedMetadata,
        chunks: [] // Empty chunks array for consistency
      };
      
      // Emit extraction failed event if workflow ID is provided
      if (workflowId) {
        try {
          await this.emitExtractionEvent(workflowId, 'extraction_failed', {
            error: normError.message,
            errorCode: normError.code,
            errorDetails: normError.data
          });
          
          // If workflow engine is available, also send failure action
          const { workflowEngine } = await import('../workflow/coordination/workflow-engine');
          await workflowEngine.sendAction(workflowId, {
            type: 'EXTRACTION_FAILED',
            payload: {
              error: normError.message,
              errorCode: normError.code || 'EXTRACTION_PROCESSING_ERROR',
              details: {
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size
              }
            }
          });
        } catch (eventError) {
          // Just log if this fails - not critical
          moduleLogger.warn('Failed to emit extraction failure event', {
            error: eventError instanceof Error ? eventError.message : String(eventError)
          });
        }
      }
      
      return errorExtractedData;
    }
  }
  
  /**
   * Helper method to emit extraction events to the workflow system
   *
   * @param workflowId Workflow ID to update
   * @param eventType Type of event to emit
   * @param payload Event data payload
   */
  private async emitExtractionEvent(
    workflowId: string,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      // First try to log event using workflowEventSourcing if available
      try {
        const { workflowEventSourcing } = await import('../workflow/infrastructure/workflow-event-source');
        await workflowEventSourcing.appendEvent(
          workflowId,
          eventType,
          payload
        );
        return;
      } catch (moduleError) {
        // If module import fails, fall back to direct logging
        // This happens when we can't dynamically import the module due to circular dependencies
      }
      
      // If direct workflow event sourcing is not available, log the event
      // In a production system, this could publish to an event bus or other messaging system
      logger.info(`[Extraction Event] ${eventType}`, {
        workflowId,
        eventType,
        ...payload
      });
    } catch (error) {
      logger.warn('Failed to emit extraction event', {
        workflowId,
        eventType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
      
      // Extract text using the specialized extractor
      const extractedData = await extractor.extract(file, options);
      
      moduleLogger.info('Document extraction completed successfully', {
        textLength: extractedData.rawText.length,
        chunkCount: extractedData.chunks?.length || 0
      });
      
      return extractedData;
    } catch (error) {
      moduleLogger.error('Failed to extract text from document', {}, error);

      // Create a unified error result structure
      const normError = normalizeError(error);
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
        } as ExtractedMetadata,
        chunks: [] // Empty chunks array for consistency
      };
      
      return errorExtractedData;
    }
  }

  /**
   * Detect tables in PDF page by analyzing text positioning
   */
  private detectTablesInPdfPage(textContent: any): boolean {
    if (!textContent.items || textContent.items.length < 10) {
      return false
    }

    // Collect all x-positions
    const xPositions: number[] = []
    textContent.items.forEach((item: any) => {
      xPositions.push(item.transform[4])
    })

    // Count frequency of each x-position
    const xFrequency: Record<number, number> = {}
    xPositions.forEach((x) => {
      // Round to handle minor variations
      const roundedX = Math.round(x)
      xFrequency[roundedX] = (xFrequency[roundedX] || 0) + 1
    })

    // Count x-positions that appear multiple times (column alignments)
    const columnCount = Object.values(xFrequency).filter(
      (count) => count > 2
    ).length

    // If we have 3+ columns with aligned text, it's likely a table
    return columnCount >= 3
  }

  /**
   * Process a text document to detect sections and create chunks
   * 
   * This method is now simplified to use our unified chunking approach
   * for all document types, ensuring consistency across formats.
   */
  private async processTextDocument(
    text: string,
    options: EnhancedExtractionOptions
  ): Promise<{
    text: string
    chunks: Array<{ content: string; metadata?: any }>
    detectedSections: string[]
  }> {
    // Detect sections in the text
    const detectedSections = options.detectSections 
      ? this.detectSectionsInText(text)
      : [];
      
    // Use our unified semantic chunking strategy
    const semanticChunks = await this.createSemanticChunks(
      text,
      this.defaultChunkingOptions,
      { sections: detectedSections }
    );
    
    // Convert LangChain document format to our chunk format
    const chunks = semanticChunks.map((chunk: Document) => ({
      content: chunk.pageContent,
      metadata: {
        ...chunk.metadata,
        structureType: chunk.metadata.chunkType || 'text',
        source: 'direct-text'
      },
    }));

    return { text, chunks, detectedSections }
  }
  
  /**
   * Detect section type from paragraph text
   * 
   * @param text Paragraph or section text to analyze
   * @returns Identified section type or null
   */
  private detectSectionType(text: string): string | null {
    return SectionDetector.detectSectionType(text);
  }
  
  /**
   * Extract document content using OCR with Gemini
   * 
   * @param blob Document blob to process
   * @param fileType MIME type of the document
   * @param options Extraction options
   * @returns OCR result with structured data
   */
  async extractViaOCR(
    blob: Blob,
    fileType: string,
    options: EnhancedExtractionOptions
  ): Promise<OCRResult> {
    const moduleLogger = logger.withMetadata({
      module: 'DocumentExtractionService',
      method: 'extractViaOCR',
      fileType
    });

    moduleLogger.info('Extracting document content using Gemini OCR', {
      fileType,
      ocrOptions: options
    });

    try {
      // Process document with Gemini
      const result = await this.geminiClient.processDocument(blob, {
        splitPages: options.splitPages,
        extractTables: options.extractTables,
        detectSections: options.detectSections,
        preserveLayout: options.preserveLayout
      });
      
      // Transform to our standard OCR result format
      return this.transformGeminiResult(result);
    } catch (error) {
      moduleLogger.error('Gemini OCR extraction failed', {
        fileType,
        error: error instanceof Error ? error.message : String(error)
      }, error);
      
      throw new ExternalServiceError({
        message: 'Failed to extract text using Gemini OCR',
        service: 'Gemini OCR',
        code: 'GEMINI_OCR_FAILED',
        data: { fileType },
        cause: error
      });
    }
  }
  
  /**
   * Helper method to detect table markers in text
   * 
   * @param text The extracted text to analyze
   * @returns Boolean indicating if tables are likely present
   */
  private detectTableMarkers(text: string): boolean {
    return SectionDetector.detectTableMarkers(text);
  }

  /**
   * Detect sections in a document
   *
   * @param text Document text
   * @returns Array of section names found in the text
   */
  detectSectionsInText(text: string): string[] {
    return SectionDetector.detectSections(text);
  }

  /**
   * Split text into sections
   *
   * @param text Document text
   * @returns Array of sections with content
   */
  splitTextBySections(
    text: string
  ): Array<{ section: string; content: string }> {
    return SectionDetector.splitTextBySections(text);
  }

  /**
   * Chunk text using appropriate strategy
   *
   * Unified method for chunking text that delegates to the proper strategy
   *
   * @param text Text to chunk
   * @param options Chunking options
   * @param structuredData Optional structured data to inform chunking
   * @returns Array of chunks with content and metadata
   */
  async chunkText(
    text: string,
    options: ChunkingOptions,
    structuredData?: any
  ): Promise<Array<{ content: string, metadata?: Record<string, any> }>> {
    // Import chunking strategies dynamically to avoid circular dependencies
    const { ChunkingStrategyFactory } = await import('./chunking/chunking-strategies');
    
    // Get appropriate chunking strategy
    const strategy = ChunkingStrategyFactory.getStrategy(text, options, structuredData);
    
    // Apply the strategy
    return strategy.createChunks(text, options, structuredData);
  }

  /**
   * Create semantic chunks from text using LangChain
   * 
   * This method implements a smart chunking strategy that:
   * 1. First respects OCR's structure if available
   * 2. Uses section-based chunking if sections are detected
   * 3. Falls back to standard RecursiveCharacterTextSplitter
   * 
   * @param text Raw text to chunk
   * @param options Chunking options
   * @param structuredData Optional structured data (pages, paragraphs)
   * @returns Array of LangChain Document objects
   */
  private async createSemanticChunks(
    text: string,
    options: ChunkingOptions,
    structuredData?: {
      pages?: OcrPage[],
      paragraphs?: OcrParagraph[],
      sections?: string[]
    }
  ): Promise<Document[]> {
    const documents: Document[] = [];
    
    // STRATEGY 1: Use OCR's page and paragraph structure if available
    if (structuredData?.pages && structuredData.pages.length > 0) {
      // For each page in the structured data
      structuredData.pages.forEach((page: OcrPage, pageIndex: number) => {
        const pageNumber = pageIndex + 1;
        
        // If page has paragraphs, create chunk per paragraph
        if (page.paragraphs && page.paragraphs.length > 0) {
          page.paragraphs.forEach((paragraph: OcrParagraph, paragraphIndex: number) => {
            if (paragraph.content && typeof paragraph.content === 'string') {
              documents.push(new Document({
                pageContent: paragraph.content,
                metadata: {
                  pageNumber,
                  paragraphIndex,
                  source: 'ocr',
                  confidence: paragraph.confidence || page.confidence || 0.9,
                  isTable: paragraph.isTable || false,
                  sectionType: paragraph.sectionType || this.detectSectionType(paragraph.content),
                  bounds: paragraph.bounds || null,
                  chunkType: 'paragraph'
                }
              }));
            }
          });
        } 
        // If no paragraphs but page has content, create chunk for the page
        else if (page.content && typeof page.content === 'string') {
          documents.push(new Document({
            pageContent: page.content,
            metadata: {
              pageNumber,
              source: 'ocr',
              confidence: page.confidence || 0.9,
              bounds: page.bounds || null,
              chunkType: 'page'
            }
          }));
        }
      });
      
      // If we found chunks using page structure, return them
      if (documents.length > 0) {
        return documents;
      }
    }
    
    // STRATEGY 2: Use section-based chunking if sections are detected
    if (structuredData?.sections && structuredData.sections.length > 0) {
      const sectionChunks = this.splitTextBySections(text);
      
      sectionChunks.forEach(section => {
        documents.push(new Document({
          pageContent: section.content,
          metadata: {
            section: section.section,
            chunkType: 'section'
          }
        }));
      });
      
      // If we found section chunks, return them
      if (documents.length > 0) {
        return documents;
      }
    }
    
    // STRATEGY 3: Fall back to standard RecursiveCharacterTextSplitter
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap,
      // Use medical-specific separators
      separators: [
        '\n\n', // Double line breaks (strong separator)
        '\n', // Single line breaks
        '. ', // End of sentences
        ': ', // Colons often introduce new content
        ', ', // Commas may separate list items
        ' ', // Last resort - split on spaces
      ],
    });

    // Create a document with the text
    const doc = new Document({
      pageContent: text,
      metadata: {
        chunkType: 'auto-split'
      },
    });

    // Split the document
    return await splitter.splitDocuments([doc]);
  }

  /**
   * Process multiple documents in parallel
   */
  async processDocuments(
    files: File[],
    options?: EnhancedExtractionOptions
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
        module: 'DocumentExtractionService',
        method: 'processDocuments',
        fileCount: files.length,
      })
      
      moduleLogger.error('Failed to process documents batch', {}, error)
      
      // Rethrow normalized error
      throw normalizeError(error)
    }
  }
  
  /**
   * Transform Gemini OCR result to our standard OCR result format
   * 
   * @param geminiResult The raw result from Gemini OCR
   * @returns Standardized OCR result
   */
  private transformGeminiResult(geminiResult: OCRDocument): OCRResult {
    // Combine all page text
    const allText = geminiResult.pages.map(page => page.text).join('\n\n');
    
    // Extract tables
    const tables = geminiResult.pages.flatMap(page =>
      (page.tables || []).map(table => ({
        content: table.join('\n'),
        pageNumber: page.page_number,
        confidence: 0.9
      }))
    );
    
    // Convert pages to our standard format
    const enhancedPages = geminiResult.pages.map(page => this.transformGeminiPage(page));
    
    // Extract section types
    const detectedSections = geminiResult.pages.flatMap(page =>
      page.metadata?.section_types || []
    ).filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
    
    return {
      text: allText,
      pages: enhancedPages,
      detectedSections,
      confidence: geminiResult.metadata?.confidence || 0.9,
      tables,
      metadata: {
        documentStructure: geminiResult.metadata?.document_structure || 'enhanced',
        paragraphCount: enhancedPages.reduce((count, page) =>
          count + (page.paragraphs?.length || 0), 0),
        tableCount: tables.length,
        extractionMethod: 'gemini-ocr'
      },
      processingTime: geminiResult.metadata?.processing_time
    };
  }

  /**
   * Transform a Gemini page to our standard page format
   * 
   * @param page The Gemini OCR page
   * @returns Standardized OCR page
   */
  private transformGeminiPage(page: GeminiOCRPage): OcrPage {
    // Split text into paragraphs
    const paragraphs = page.text
      .split(/\n\s*\n/)
      .filter(p => p.trim().length > 0)
      .map((text, paragraphIndex) => {
        // Detect if paragraph contains table-like content
        const isTable = this.detectTableMarkers(text);
        
        return {
          content: text,
          index: paragraphIndex,
          isTable,
          confidence: 0.9,
          sectionType: this.detectSectionType(text)
        };
      });
    
    return {
      content: page.text,
      paragraphs,
      pageNumber: page.page_number,
      confidence: 0.9
    };
  }
}