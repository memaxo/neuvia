/**
 * Document Extraction Service
 * 
 * Responsible for extracting text and content from various document formats
 * using specialized strategies for each format type.
 */
import crypto from 'crypto'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { Document } from 'langchain/document'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import logger from '@/lib/logger'
import { mistral } from '@ai-sdk/mistral'
import { normalizeError, SystemError, ApplicationError, ExternalServiceError } from '@/lib/errors'
import { ValidationError } from '@/lib/errors/verification-errors'

import type { 
  DocumentType, 
  ExtractedData, 
  ProcessingStatus,
  DocumentMetadata
} from '@/lib/types/document'

// Define interfaces for Mistral SDK extensions
interface MistralFiles {
  upload: (params: { file: { fileName: string, content: Uint8Array }, purpose: string }) => Promise<{ id: string }>
  getSignedUrl: (params: { file_id: string }) => Promise<{ url: string }>
}

interface MistralOCR {
  process: (params: { model: string, document: { type: string, document_url: string } }) => Promise<MistralOCRResult>
}

interface MistralSDK {
  files: MistralFiles
  ocr: MistralOCR
}

// Define interfaces for data structures
interface OcrPage {
  content: string
  bounds?: any
  coordinates?: any
  confidence?: number
  pageNumber?: number
  paragraphs?: OcrParagraph[]
  tables?: OcrTable[]
}

interface OcrParagraph {
  content: string
  bounds?: any
  confidence?: number
  isTable?: boolean
  sectionType?: string | null
  index?: number
}

interface OcrTable {
  content?: string
  text?: string
  cells?: any[]
  bounds?: any
  rows?: number
  columns?: number
  pageNumber?: number
  confidence?: number
}

interface MistralOCRResult {
  text: string
  pages?: OcrPage[]
  sections?: any[]
  structure?: { sections?: any[], documentStructure?: string }
  confidence?: number
  tables?: OcrTable[]
  processing_time?: number
  metadata?: Record<string, any>
  paragraphCount?: number
  processingTime?: number
  detectedSections?: string[]
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
   * Mistral AI client
   */
  private readonly mistralClient: typeof mistral

  constructor(loggerInstance?: typeof logger, mistralClient?: typeof mistral) {
    this.logger = loggerInstance || logger
    this.mistralClient = mistralClient || mistral
  }

  /**
   * Default enhanced extraction options
   */
  private readonly defaultExtractionOptions: EnhancedExtractionOptions = {
    splitPages: true,
    extractTables: true,
    detectSections: true,
    ocrImages: true,
    preserveLayout: true,
    maxPageLength: 5000,
  }

  /**
   * Default chunking options
   */
  private readonly defaultChunkingOptions: ChunkingOptions = {
    chunkSize: 1000,
    chunkOverlap: 200,
    preserveMetadata: true,
    strategy: 'semantic',
  }

  // The medical section patterns are now defined in SectionDetector utility

  /**
   * Main method to extract text from a document file
   * 
   * @param file File to extract text from
   * @param options Extraction options
   * @returns Extracted text data
   */
  async extractText(
    file: File,
    options: EnhancedExtractionOptions = this.defaultExtractionOptions
  ): Promise<ExtractedData> {
    const moduleLogger = this.logger.withMetadata({
      module: 'DocumentExtractionService',
      method: 'extractText',
      fileType: file.type,
      fileName: file.name,
    });

    try {
      moduleLogger.info('Starting document extraction', {
        fileType: file.type,
        fileSize: file.size
      });

      // Import extractors dynamically to avoid circular dependencies
      const { ExtractorFactory } = await import('./extractors/extractor-factory');
      
      // Create extractor factory
      const extractorFactory = new ExtractorFactory(this);
      
      // Get appropriate extractor for the file type
      const extractor = extractorFactory.getExtractorForFileType(file.type);
      
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

  // The extractPdfWithEnhancement method has been replaced by extractViaMistralOCR
  // This provides a more reliable and consistent extraction approach for PDFs

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
    // Use SectionDetector from our utility
    const { SectionDetector } = require('./utils/section-detection');
    return SectionDetector.detectSectionType(text);
  }
  
  async extractViaMistralOCR(
    blob: Blob,
    fileType: string,
    options: EnhancedExtractionOptions
  ): Promise<MistralOCRResult> {
    const moduleLogger = logger.withMetadata({
      module: 'DocumentExtractionService',
      method: 'extractViaMistralOCR',
      fileType
    });

    moduleLogger.info('Extracting document content using Mistral OCR', {
      fileType,
      ocrOptions: options
    });

    try {
      // Convert blob to array buffer
      const arrayBuffer = await blob.arrayBuffer();
      const fileBytes = new Uint8Array(arrayBuffer);
      
      // Determine file extension based on MIME type
      let fileExtension = 'pdf'; // Default
      if (fileType === 'image/jpeg') fileExtension = 'jpg';
      else if (fileType === 'image/png') fileExtension = 'png';
      else if (fileType === 'application/msword') fileExtension = 'doc';
      else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') fileExtension = 'docx';
      
      // Upload to Mistral - use type assertion for Mistral SDK
      const mistralExt = this.mistralClient as unknown as MistralSDK;
      const uploaded = await mistralExt.files.upload({
        file: {
          fileName: `document.${fileExtension}`,
          content: fileBytes
        },
        purpose: 'ocr'
      });

      // Get signed URL
      const signed = await mistralExt.files.getSignedUrl({
        file_id: uploaded.id
      });

      // Determine document type for Mistral OCR
      let documentType = 'document_url';
      if (fileType.startsWith('image/')) {
        documentType = 'image_url';
      }

      // Process with OCR
      const ocrResult = await mistralExt.ocr.process({
        model: 'mistral-ocr-latest',
        document: {
          type: documentType,
          document_url: signed.url
        }
      });

      // Extract sections if not already provided by Mistral
      let detectedSections: string[] = [];
      
      // First check if Mistral provided section information
      if (ocrResult.sections && ocrResult.sections.length > 0) {
        // Use Mistral's sections directly if available
        detectedSections = ocrResult.sections.map((section: any) => section.type || section.name || section.title);
      } else if (ocrResult.structure?.sections) {
        // Alternative structure format
        detectedSections = ocrResult.structure.sections.map((section: any) => section.type || section.name || section.title);
      } else {
        // Fall back to our own section detection
        detectedSections = this.detectSectionsInText(ocrResult.text);
      }

      // Extract metadata
      const extractedMetadata: Record<string, any> = {
        ocrConfidence: ocrResult.confidence || 0.9,
        pageCount: ocrResult.pages?.length || 1,
        processingTime: ocrResult.processing_time,
        fileFormat: fileType,
        extractionMethod: 'mistral-ocr'
      };

      // Detect potential tables based on layout or explicit table markers in the text
      const hasTables = this.detectTableMarkers(ocrResult.text);
      if (hasTables) {
        extractedMetadata.hasTables = true;
      }

      moduleLogger.info('Mistral OCR extraction completed successfully', {
        textLength: ocrResult.text.length,
        sectionsDetected: detectedSections.length,
        pageCount: ocrResult.pages?.length || 1,
        hasTables
      });

      // Process and enhance the pages data to include structured paragraph information
      let enhancedPages = ocrResult.pages || [];
      
      // If pages exist but don't have paragraph structure, try to create it
      if (enhancedPages.length > 0) {
        enhancedPages = enhancedPages.map((page: OcrPage, index: number) => {
          // If page already has paragraphs, keep them
          if (page.paragraphs && page.paragraphs.length > 0) {
            return page;
          }
          
          // Try to break content into paragraphs based on double newlines
          if (page.content && typeof page.content === 'string') {
            const paragraphs = page.content
              .split(/\n\s*\n/)
              .filter((p: string) => p.trim().length > 0)
              .map((text: string, paragraphIndex: number) => {
                // Detect if paragraph contains table-like content
                const isTable = this.detectTableMarkers(text);
                
                return {
                  content: text,
                  index: paragraphIndex,
                  isTable,
                  confidence: page.confidence || ocrResult.confidence || 0.9,
                  sectionType: this.detectSectionType(text)
                };
              });
            
            return {
              ...page,
              paragraphs,
              pageNumber: index + 1
            };
          }
          
          return page;
        });
      }
      
      // Look for tables in the structure if not already identified
      const tables = ocrResult.tables || [];
      if (tables.length === 0) {
        // Try to find tables in the pages/paragraphs
        enhancedPages.forEach((page: OcrPage) => {
          if (page.paragraphs) {
            const tableParagraphs = page.paragraphs.filter((p: OcrParagraph) => p.isTable);
            if (tableParagraphs.length > 0) {
              tableParagraphs.forEach((tableParagraph: OcrParagraph) => {
                tables.push({
                  content: tableParagraph.content,
                  pageNumber: page.pageNumber,
                  confidence: tableParagraph.confidence
                });
              });
            }
          }
        });
      }
      
      return {
        text: ocrResult.text,
        pages: enhancedPages,
        detectedSections,
        confidence: ocrResult.confidence || 0.9,
        tables,
        metadata: {
          ...extractedMetadata,
          documentStructure: 'enhanced',
          paragraphCount: enhancedPages.reduce((count: number, page: OcrPage) => 
            count + (page.paragraphs?.length || 0), 0),
          tableCount: tables.length
        },
        processingTime: ocrResult.processing_time
      };
    } catch (error) {
      moduleLogger.error('Mistral OCR extraction failed', {
        fileType,
        error: error instanceof Error ? error.message : String(error)
      }, error);
      
      throw new ExternalServiceError({
        message: 'Failed to extract text using Mistral OCR',
        service: 'Mistral OCR',
        code: 'MISTRAL_OCR_FAILED',
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
    // Use SectionDetector from our utility
    const { SectionDetector } = require('./utils/section-detection');
    return SectionDetector.detectTableMarkers(text);
  }

  /**
  /**
   * Detect sections in a document
   *
   * @param text Document text
   * @returns Array of section names found in the text
   */
  detectSectionsInText(text: string): string[] {
    // Use SectionDetector from our utility
    const { SectionDetector } = require('./utils/section-detection');
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
    // Use SectionDetector from our utility
    const { SectionDetector } = require('./utils/section-detection');
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
   * 1. First respects Mistral's structure if available
   * 2. Uses section-based chunking if sections are detected
   * 3. Falls back to standard RecursiveCharacterTextSplitter
   * 
   * @param text Raw text to chunk
   * @param options Chunking options
   * @param structuredData Optional Mistral structured data (pages, paragraphs)
   * @param detectedSections Optional section information
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
    
    // STRATEGY 1: Use Mistral's page and paragraph structure if available
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
                  source: 'mistral-ocr',
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
              source: 'mistral-ocr',
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
}