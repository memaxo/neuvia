/**
 * Mistral OCR Client
 * 
 * @deprecated Use GeminiOCRClient instead. This client is maintained for backward compatibility.
 * 
 * Handles communication with Mistral AI for OCR extraction
 */
import { mistral } from '@ai-sdk/mistral'
import logger from '@/lib/logger'
import { ExternalServiceError } from '@/lib/errors'
import { getDefaultConfig } from '@/lib/langchain/config'
import { SectionDetector } from './utils/section-detection'

// Define interfaces for Mistral SDK extensions
interface MistralFiles {
  upload: (params: { file: { fileName: string, content: Uint8Array }, purpose: string }) => Promise<{ id: string }>
  getSignedUrl: (params: { file_id: string }) => Promise<{ url: string }>
}

interface MistralOCR {
  process: (params: { model: string, document: { type: string, document_url: string } }) => Promise<MistralOCRResult>
}

export interface MistralSDK {
  files: MistralFiles
  ocr: MistralOCR
}

// Define interfaces for data structures
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

export interface MistralOCRResult {
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

/**
 * Enhanced extraction options
 */
export interface MistralExtractionOptions {
  splitPages?: boolean
  extractTables?: boolean
  detectSections?: boolean
  ocrImages?: boolean
  preserveLayout?: boolean
  maxPageLength?: number
}

/**
 * @deprecated Use GeminiOCRClient instead. This client is maintained for backward compatibility.
 */
export class MistralOCRClient {
  private readonly logger: typeof logger
  private readonly mistralClient: typeof mistral

  constructor(loggerInstance?: typeof logger, mistralClient?: typeof mistral) {
    this.logger = loggerInstance || logger.withMetadata({
      module: 'MistralOCRClient',
    })
    this.mistralClient = mistralClient || mistral
  }

  /**
   * Process a document using Mistral OCR
   * 
   * @deprecated Use GeminiOCRClient instead
   */
  async processDocument(
    blob: Blob,
    fileType: string,
    options: MistralExtractionOptions
  ): Promise<MistralOCRResult> {
    const config = getDefaultConfig();
    
    // If Mistral API key is not configured, throw error
    if (!config.mistral?.apiKey) {
      throw new ExternalServiceError({
        message: 'Mistral API key not configured',
        service: 'Mistral OCR',
        code: 'MISTRAL_OCR_NOT_CONFIGURED',
        data: { fileType }
      });
    }
    
    const moduleLogger = this.logger.withMetadata({
      method: 'processDocument',
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
        detectedSections = SectionDetector.detectSections(ocrResult.text);
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
      const hasTables = SectionDetector.detectTableMarkers(ocrResult.text);
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
                const isTable = SectionDetector.detectTableMarkers(text);
                
                return {
                  content: text,
                  index: paragraphIndex,
                  isTable,
                  confidence: page.confidence || ocrResult.confidence || 0.9,
                  sectionType: SectionDetector.detectSectionType(text)
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
}

// Export singleton instance
export const mistralOCRClient = new MistralOCRClient();