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

  /**
   * Medical document section patterns
   */
  private readonly medicalSectionPatterns = [
    {
      name: 'patient_information',
      patterns: ['patient information', 'demographics', 'patient data'],
    },
    {
      name: 'chief_complaint',
      patterns: ['chief complaint', 'presenting complaint', 'reason for visit'],
    },
    {
      name: 'history_of_present_illness',
      patterns: ['history of present illness', 'hpi', 'present illness'],
    },
    {
      name: 'past_medical_history',
      patterns: ['past medical history', 'pmh', 'medical history'],
    },
    {
      name: 'medications',
      patterns: ['medications', 'current medications', 'meds', 'prescription'],
    },
    {
      name: 'allergies',
      patterns: ['allergies', 'drug allergies', 'medication allergies'],
    },
    {
      name: 'review_of_systems',
      patterns: ['review of systems', 'ros', 'systems review'],
    },
    {
      name: 'physical_examination',
      patterns: [
        'physical examination',
        'physical exam',
        'examination',
        'exam',
      ],
    },
    { name: 'assessment', patterns: ['assessment', 'impression', 'diagnosis'] },
    { name: 'plan', patterns: ['plan', 'treatment plan', 'recommendations'] },
    {
      name: 'laboratory_results',
      patterns: ['laboratory', 'lab results', 'laboratory studies'],
    },
    {
      name: 'imaging_results',
      patterns: ['imaging', 'radiology', 'x-ray', 'ct scan', 'mri'],
    },
    {
      name: 'procedures',
      patterns: ['procedures', 'interventions', 'operations'],
    },
  ]

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
    try {
      const fileType = file.type
      let rawText = ''
      // Use a consistent chunk structure across all document types
      const chunks: {
        content: string
        pageNumber?: number
        paragraphIndex?: number
        tableIndex?: number
        metadata?: Record<string, any>
      }[] = []
      // Initialize common metadata across all document types
      const metadata: ExtractedMetadata = {
        filename: file.name,
        fileFormat: file.type,
        fileSize: file.size,
        extractedAt: new Date(),
        extractionMethod: 'unknown', // Will be set properly based on method used
        documentStructure: 'unknown', // Will be detected during processing
        hasStructuredData: false      // Default, will be updated if structures are found
      }

      // Create a blob from the file for processing
      const blob = new Blob([await file.arrayBuffer()], { type: fileType })

      // Use unified Mistral OCR extraction for all supported document types
      switch (fileType) {
        case 'application/pdf':
        case 'image/jpeg':
        case 'image/png':
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
          // Use unified Mistral OCR for all document types
          const result = await this.extractViaMistralOCR(blob, fileType, options)
          rawText = result.text

          // Create chunks preserving Mistral's document structure
          if (result.pages && result.pages.length > 0) {
            // Process page by page to preserve document structure
            result.pages.forEach((page: OcrPage, pageIndex: number) => {
              const pageNumber = pageIndex + 1;
              
              if (page.content) {
                // Store any page-level bounding boxes or coordinates
                const pageBounds = page.bounds || page.coordinates || null;
                
                // Check if page has paragraphs or blocks of text
                if (page.paragraphs && page.paragraphs.length > 0) {
                  // Create chunk per paragraph to preserve structure
                  page.paragraphs.forEach((paragraph: OcrParagraph, paragraphIndex: number) => {
                    chunks.push({
                      content: paragraph.content,
                      pageNumber,
                      paragraphIndex,
                      metadata: { 
                        source: 'mistral-ocr',
                        pageNumber,
                        docType: fileType,
                        bounds: paragraph.bounds || null,
                        confidence: paragraph.confidence || result.confidence,
                        isTable: paragraph.isTable || false,
                        sectionType: this.detectSectionType(paragraph.content),
                        structureType: 'paragraph'
                      }
                    });
                  });
                }
                // Check if page has identified tables
                else if (page.tables && page.tables.length > 0) {
                  // Create chunk per table
                  page.tables.forEach((table: OcrTable, tableIndex: number) => {
                    chunks.push({
                      content: table.content || table.text || JSON.stringify(table.cells),
                      pageNumber,
                      tableIndex,
                      metadata: { 
                        source: 'mistral-ocr',
                        pageNumber,
                        docType: fileType,
                        bounds: table.bounds || null,
                        isTable: true,
                        tableData: table.cells || null,
                        tableRows: table.rows || null,
                        tableCols: table.columns || null,
                        structureType: 'table'
                      }
                    });
                  });
                }
                // If no paragraphs or tables, use the whole page content
                else {
                  chunks.push({
                    content: page.content,
                    pageNumber,
                    metadata: { 
                      source: 'mistral-ocr',
                      pageNumber,
                      docType: fileType,
                      bounds: pageBounds,
                      confidence: page.confidence || result.confidence,
                      structureType: 'page'
                    }
                  });
                }
              }
            });
          } 
          // If Mistral didn't provide page structure but has sections
          else if (result.sections && result.sections.length > 0) {
            // Process the text by sections
            const sectionChunks = this.splitTextBySections(rawText);
            chunks.push(
              ...sectionChunks.map((section) => ({
                content: section.content,
                metadata: { 
                  section: section.section,
                  source: 'mistral-ocr',
                  docType: fileType,
                  confidence: result.confidence,
                  structureType: 'section'
                }
              }))
            );
          }
          // Fallback: If no structured data from Mistral, use semantic chunking
          else if (rawText) {
            // Pass Mistral's structured data to the chunking method
            const semanticChunks = await this.createSemanticChunks(
              rawText,
              this.defaultChunkingOptions,
              { 
                pages: result.pages,
                sections: result.sections
              }
            );
            
            chunks.push(
              ...semanticChunks.map((chunk: Document) => ({
                content: chunk.pageContent,
                metadata: {
                  ...chunk.metadata,
                  source: 'mistral-ocr',
                  docType: fileType,
                  confidence: result.confidence,
                  structureType: 'semantic'
                },
              }))
            );
          }

          // Add comprehensive metadata from the extraction result
          metadata.detectedSections = result.detectedSections || result.sections
          metadata.ocrConfidence = result.confidence
          metadata.pageCount = result.pages?.length || 1
          metadata.hasTables = result.tables && result.tables.length > 0 || false
          metadata.tableCount = result.tables?.length || 0
          metadata.paragraphCount = result.paragraphCount || result.metadata?.paragraphCount || 0
          metadata.extractionMethod = 'mistral-ocr'
          metadata.processingTime = result.processingTime || result.processing_time
          metadata.documentStructure = result.structure?.documentStructure || 'basic'
          
          // Store section types distribution for content analysis
          const sectionTypes = new Set<string>();
          chunks.forEach(chunk => {
            if (chunk.metadata?.sectionType) {
              sectionTypes.add(chunk.metadata.sectionType);
            }
          });
          metadata.sectionTypes = Array.from(sectionTypes);
          
          // Merge any additional metadata provided by Mistral OCR
          if (result.metadata) {
            Object.assign(metadata, result.metadata);
          }
          
          // Add structured data flags
          metadata.hasStructuredData = chunks.length > 0;
          metadata.hasPageBoundaries = result.pages?.some(p => p.bounds || p.coordinates) || false;
          
          // Add specific metadata based on document type
          if (fileType === 'application/pdf') {
            metadata.documentTypeCategory = 'pdf'
          } else if (fileType.startsWith('image/')) {
            metadata.documentTypeCategory = 'image'
            metadata.imageType = fileType
          } else if (fileType.includes('wordprocessingml') || fileType === 'application/msword') {
            metadata.documentTypeCategory = 'word'
          }
          
          break
        }

        case 'text/plain': {
          // Simple text extraction without OCR for plaintext
          const textContent = await file.text()
          rawText = textContent

          // Process the text to detect sections
          const detectedSections = this.detectSectionsInText(textContent)
          
          // Use the same semantic chunking approach for consistency
          const semanticChunks = await this.createSemanticChunks(
            textContent,
            this.defaultChunkingOptions,
            { sections: detectedSections }
          );
          
          // Convert LangChain documents to our chunk format
          chunks.push(
            ...semanticChunks.map((chunk: Document) => ({
              content: chunk.pageContent,
              metadata: {
                ...chunk.metadata,
                source: 'text-direct',
                docType: fileType,
                structureType: chunk.metadata.chunkType || 'text'
              },
            }))
          );

          // Add text-specific metadata
          metadata.lineCount = textContent.split('\n').length
          metadata.detectedSections = detectedSections
          metadata.documentTypeCategory = 'plaintext'
          metadata.extractionMethod = 'direct-text'
          metadata.hasStructuredData = chunks.length > 0
          break
        }

        default:
          throw new ValidationError({
            message: `Unsupported file type: ${fileType}`,
            code: 'UNSUPPORTED_FILE_TYPE',
            data: { fileType },
          })
      }

      // Create the unified extracted data object
      const extractedData: ExtractedData = {
        rawText,                                     // Always include raw text
        metadata: metadata as ExtractedMetadata,     // Cast to our flexible metadata type
        chunks: chunks.length > 0 ? chunks : []      // Always include chunks array (empty if none)
      }

      return extractedData
    } catch (error) {
      // Enhanced error handling with structured logging
    const moduleLogger = this.logger.withMetadata({
        module: 'DocumentExtractionService',
        method: 'extractText',
        fileType: file.type,
        fileName: file.name,
      })

      moduleLogger.error('Failed to extract text from document', {}, error)

      // Create a unified error result structure with the same shape as success
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
      
      // Return consistent error structure
      return errorExtractedData
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
    if (!text || text.trim().length === 0) {
      return null;
    }
    
    // Common section markers in medical documents
    const sectionPatterns = [
      { type: 'header', pattern: /^#+ |^TITLE:|^title:/i },
      { type: 'patient_info', pattern: /^(?:patient|personal|demographic|identification) (?:information|data|details)/i },
      { type: 'medical_history', pattern: /^(?:medical|clinical|health) (?:history|record)/i },
      { type: 'medications', pattern: /^(?:current )?(?:medication|drug|prescription)s?/i },
      { type: 'allergies', pattern: /^(?:drug |known |medication )?allerg(?:y|ies)/i },
      { type: 'vital_signs', pattern: /^(?:vital|physical) (?:signs|measurements)/i },
      { type: 'assessment', pattern: /^(?:assessment|diagnosis|impression)/i },
      { type: 'plan', pattern: /^(?:plan|treatment|recommendation|intervention)/i },
      { type: 'lab_results', pattern: /^(?:lab(?:oratory)?|test) (?:results|studies|findings)/i },
      { type: 'imaging', pattern: /^(?:imaging|radiology|xray|x-ray|ct|mri|ultrasound) (?:results|studies|findings)/i },
      { type: 'summary', pattern: /^(?:summary|conclusion|impression)/i },
      { type: 'footer', pattern: /^(?:footer|end of document|copyright|prepared by)/i }
    ];
    
    // Check if text matches any section pattern
    for (const { type, pattern } of sectionPatterns) {
      if (pattern.test(text.trim().substring(0, 30))) {
        return type;
      }
    }
    
    // Check for list items or bullet points
    if (/^(?:\s*[-•*]\s|\s*\d+\.\s)/.test(text.trim())) {
      return 'list_item';
    }
    
    return 'body_text';
  }
  
  private async extractViaMistralOCR(
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
    // Look for explicit table markers
    const tableMarkers = [
      /table \d+/i,
      /\btable\b/i,
      /\btables\b/i,
      /\bfigure \d+\b/i,
      // Patterns suggesting tabular data
      /\|\s*\w+\s*\|/,
      /\+[-+]+\+/,
      /\+={2,}\+/,
      // Column headers
      /\b(column|col\.?)\s+\d+\b/i
    ];
    
    // Check for table markers
    for (const marker of tableMarkers) {
      if (marker.test(text)) {
        return true;
      }
    }
    
    // Check for consistent spacing patterns that might indicate tables
    const lines = text.split('\n');
    let potentialTableRows = 0;
    
    for (let i = 0; i < lines.length; i++) {
      // Look for lines with multiple spaces in sequence, which often indicates column alignment
      if (/\S+\s{2,}\S+\s{2,}\S+/.test(lines[i])) {
        potentialTableRows++;
        // If we find 3+ consecutive rows with this pattern, it's likely a table
        if (potentialTableRows >= 3) {
          return true;
        }
      } else {
        potentialTableRows = 0;
      }
    }
    
    return false;
  }

  /**
  // The extractWordDocument method has been replaced by extractViaMistralOCR
  // This provides a more consistent extraction approach across document types

  // The performOcrOnImage method has been replaced by extractViaMistralOCR
  // Using Mistral OCR provides more accurate and reliable text extraction from images

  /**
   * Detect medical document sections from text
   */
  private detectSectionsInText(text: string): string[] {
    const detectedSections: string[] = []

    // Look for common medical document section headers
    for (const section of this.medicalSectionPatterns) {
      for (const pattern of section.patterns) {
        // Look for the pattern surrounded by whitespace or at the beginning of a line
        const regex = new RegExp(`(^|\\s)(${pattern})(:|\\s|$)`, 'i')
        if (regex.test(text)) {
          detectedSections.push(section.name)
          break // Found this section, no need to check other patterns
        }
      }
    }

    return detectedSections
  }

  /**
   * Split text by detected sections
   */
  private splitTextBySections(
    text: string
  ): Array<{ section: string; content: string }> {
    const sections: Array<{ section: string; content: string }> = []
    let currentContent = ''
    let currentSection = 'unknown'

    // Split text into lines for processing
    const lines = text.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check if this line is a section header
      let newSectionFound = false

      for (const section of this.medicalSectionPatterns) {
        for (const pattern of section.patterns) {
          // Look for the pattern surrounded by whitespace or at the beginning of a line
          const regex = new RegExp(`(^|\\s)(${pattern})(:|\\s|$)`, 'i')
          if (regex.test(line)) {
            // If we were already building a section, save it
            if (currentContent.trim()) {
              sections.push({
                section: currentSection,
                content: currentContent.trim(),
              })
            }

            // Start a new section
            currentSection = section.name
            currentContent = `${line}\n` // Include the header in the content
            newSectionFound = true
            break
          }
        }
        if (newSectionFound) break
      }

      // If not a new section, add to current content
      if (!newSectionFound) {
        currentContent += `${line}\n`
      }
    }

    // Add the last section if not empty
    if (currentContent.trim()) {
      sections.push({
        section: currentSection,
        content: currentContent.trim(),
      })
    }

    return sections
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