/**
 * OCR Service
 * 
 * Dedicated service for OCR (Optical Character Recognition) operations.
 * Extracted from the main extraction service to provide a focused, reusable OCR capability.
 */

import logger from '@/lib/logger'
import { ExternalServiceError } from '@/lib/errors'
import { SectionDetector } from '../utils/section-detection'

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

// OCR Options
export interface OCROptions {
  splitPages?: boolean
  extractTables?: boolean
  detectSections?: boolean
  preserveLayout?: boolean
}

/**
 * Service for performing OCR operations
 */
export class OcrService {
  private readonly logger = logger.withMetadata({ module: 'OcrService' });
  
  /**
   * Process a document with OCR
   * 
   * @param blob Document blob to process
   * @param fileType MIME type of the document
   * @param options OCR options
   * @returns OCR result with structured data
   */
  async processDocument(
    blob: Blob,
    fileType: string,
    options: OCROptions
  ): Promise<OCRResult> {
    this.logger.info('Processing document with OCR', {
      fileType,
      ocrOptions: options
    });

    try {
      // Dynamically import OCR clients to avoid circular dependencies
      const { GeminiOCRClient } = await import('./ocr/gemini-ocr-client');
      
      // Create Gemini client
      const geminiClient = new GeminiOCRClient();
      
      // Process document with Gemini
      const startTime = Date.now();
      const result = await geminiClient.processDocument(blob, {
        splitPages: options.splitPages,
        extractTables: options.extractTables,
        detectSections: options.detectSections,
        preserveLayout: options.preserveLayout
      });
      const processingTime = Date.now() - startTime;
      
      // Transform to our standard OCR result format
      return this.transformGeminiResult(result, processingTime);
    } catch (error) {
      this.logger.error('OCR processing failed', {
        fileType,
        error: error instanceof Error ? error.message : String(error)
      }, error);
      
      throw new ExternalServiceError({
        message: 'Failed to extract text using OCR',
        service: 'OCR Service',
        code: 'OCR_PROCESSING_FAILED',
        data: { fileType },
        cause: error
      });
    }
  }
  
  /**
   * Transform Gemini OCR result to our standard OCR result format
   * 
   * @param geminiResult The raw result from Gemini OCR
   * @param processingTime Processing time in milliseconds
   * @returns Standardized OCR result
   */
  private transformGeminiResult(geminiResult: any, processingTime: number): OCRResult {
    // Combine all page text
    const allText = geminiResult.pages.map((page: any) => page.text).join('\n\n');
    
    // Extract tables
    const tables = geminiResult.pages.flatMap((page: any) =>
      (page.tables || []).map((table: any) => ({
        content: Array.isArray(table) ? table.join('\n') : table.text || '',
        pageNumber: page.page_number,
        confidence: 0.9
      }))
    );
    
    // Convert pages to our standard format
    const enhancedPages = geminiResult.pages.map((page: any) => this.transformGeminiPage(page));
    
    // Extract section types
    const detectedSections = geminiResult.pages.flatMap((page: any) =>
      page.metadata?.section_types || []
    ).filter((value: any, index: number, self: any[]) => self.indexOf(value) === index); // Remove duplicates
    
    return {
      text: allText,
      pages: enhancedPages,
      detectedSections,
      confidence: geminiResult.metadata?.confidence || 0.9,
      tables,
      metadata: {
        documentStructure: geminiResult.metadata?.document_structure || 'enhanced',
        paragraphCount: enhancedPages.reduce((count: number, page: OcrPage) =>
          count + (page.paragraphs?.length || 0), 0),
        tableCount: tables.length,
        extractionMethod: 'gemini-ocr'
      },
      processingTime
    };
  }

  /**
   * Transform a Gemini page to our standard page format
   * 
   * @param page The Gemini OCR page
   * @returns Standardized OCR page
   */
  private transformGeminiPage(page: any): OcrPage {
    // Split text into paragraphs
    const paragraphs = page.text
      .split(/\n\s*\n/)
      .filter((p: string) => p.trim().length > 0)
      .map((text: string, paragraphIndex: number) => {
        // Detect if paragraph contains table-like content
        const isTable = this.detectTableMarkers(text);
        
        return {
          content: text,
          index: paragraphIndex,
          isTable,
          confidence: 0.9,
          sectionType: SectionDetector.detectSectionType(text)
        };
      });
    
    return {
      content: page.text,
      paragraphs,
      pageNumber: page.page_number,
      confidence: 0.9
    };
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
}