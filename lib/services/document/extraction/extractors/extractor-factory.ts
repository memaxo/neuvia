/**
 * Document Extractors
 *
 * Provides specialized extractors for different document types.
 * This module defines the interfaces for document extraction and
 * provides a factory for creating appropriate extractors.
 */

import { ValidationError } from '@/lib/errors/verification-errors'
import logger from '@/lib/logger'
import { normalizeError } from '@/lib/errors'
import type { ExtractedData } from '@/lib/types/document'
import { ExtractionService, ExtractionOptions } from '../extraction-service'
import { OcrService } from '../ocr-service'

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
  extract(file: File, options: ExtractionOptions): Promise<ExtractedData>;
  
  /**
   * Get supported document types
   *
   * @returns Array of MIME types this extractor supports
   */
  getSupportedTypes(): string[];
}

/**
 * Factory for creating appropriate document extractors
 */
export class ExtractorFactory {
  private readonly extractors: DocumentExtractor[] = [];
  private readonly logger = logger.withMetadata({ module: 'ExtractorFactory' });
  private readonly ocrService = new OcrService();
  
  /**
   * Create extractor factory
   *
   * @param extractionService ExtractionService instance
   */
  constructor(private readonly extractionService: ExtractionService) {
    // Dynamically import and initialize extractors to avoid circular dependencies
    this.initializeExtractors();
  }
  
  /**
   * Initialize document extractors
   */
  private async initializeExtractors() {
    try {
      // Import extractors dynamically
      const { OcrDocumentExtractor } = await import('./ocr-document-extractor');
      const { PlainTextExtractor } = await import('./plain-text-extractor');
      
      // Add extractors to the registry
      this.extractors.push(new OcrDocumentExtractor(this.ocrService));
      this.extractors.push(new PlainTextExtractor());
      
      this.logger.info('Extractors initialized successfully', {
        extractorCount: this.extractors.length
      });
    } catch (error) {
      this.logger.error('Failed to initialize extractors', {}, error);
      // We'll initialize them on-demand if this fails
    }
  }
  
  /**
   * Get the appropriate extractor for a file type
   *
   * @param fileType MIME type of the file
   * @returns DocumentExtractor for the file type
   * @throws ValidationError if no suitable extractor is found
   */
  getExtractorForFileType(fileType: string): DocumentExtractor {
    // Lazily initialize extractors if needed
    if (this.extractors.length === 0) {
      // Use immediate initialization for the specific extractors we need
      const { lazyLoadExtractor } = require('./lazy-load-extractor');
      
      // Based on file type, choose the right extractor
      if (fileType === 'text/plain') {
        return lazyLoadExtractor('plain-text', this.ocrService);
      } else {
        return lazyLoadExtractor('ocr', this.ocrService);
      }
    }
    
    // If extractors are already initialized, find the matching one
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