/**
 * Document Extraction
 * 
 * This module provides services for document text extraction.
 */

export * from './extraction-service'
export * from './ocr-service'
export * from './extractors/extractor-factory'

// Singleton instances for use throughout the application
import { ExtractionService } from './extraction-service'
import { OcrService } from './ocr-service'

export const extractionService = new ExtractionService()
export const ocrService = new OcrService()