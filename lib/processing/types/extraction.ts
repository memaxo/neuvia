import type { DocumentBase } from './base'

/**
 * Represents a chunk of extracted text from a document
 */
export interface DocumentChunk {
  /**
   * The content of the chunk
   */
  content: string

  /**
   * Optional page number where the chunk was found
   */
  pageNumber?: number

  /**
   * Optional position within the document
   */
  position?: {
    startOffset: number
    endOffset: number
  }

  /**
   * Optional metadata for the chunk
   */
  metadata?: Record<string, unknown>
}

/**
 * Metadata for extracted documents
 */
export interface DocumentMetadata {
  /**
   * Number of pages in the document
   */
  pageCount?: number

  /**
   * Type of document detected
   */
  docType?: string

  /**
   * Original filename
   */
  filename?: string

  /**
   * File format (PDF, DOCX, etc.)
   */
  fileFormat?: string

  /**
   * File size in bytes
   */
  fileSize?: number

  /**
   * Extraction timestamp
   */
  extractedAt: Date

  /**
   * Confidence score of the extraction (0-1)
   */
  confidence?: number

  /**
   * Any other metadata fields
   */
  [key: string]: any
}

/**
 * Data extracted from a document
 */
export interface ExtractedData {
  /**
   * Raw extracted text from the document
   */
  rawText: string

  /**
   * Additional metadata about the document
   */
  metadata: DocumentMetadata

  /**
   * Optional chunked data
   */
  chunks?: DocumentChunk[]
}

/**
 * Represents a document that has been processed through extraction
 */
export interface ExtractedDocument extends DocumentBase {
  /**
   * The extracted data from the document
   */
  extractedData: ExtractedData

  /**
   * Whether the extraction was successful
   */
  isSuccessful: boolean

  /**
   * Error message if the extraction failed
   */
  errorMessage?: string
}
