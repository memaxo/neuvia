/**
 * Document Metadata Service
 * 
 * Responsible for preparing, formatting, and handling document metadata.
 */
import logger from '@/lib/logger'
import { getDbCompatibleMetadata } from '@/lib/processing/types/verification'
import type { Json } from '@/lib/supabase'
import type { 
  DocumentType, 
  ExtractedDocument, 
  DocumentMetadata
} from '@/lib/types/document'
import { MetadataFormattingError } from './errors'
import { VALID_DOCUMENT_CATEGORIES, DocumentCategory } from './types'

/**
 * Service for document metadata operations
 */
export class DocumentMetadataService {
  /**
   * Logger instance
   */
  private readonly logger

  constructor(loggerInstance?: typeof logger) {
    this.logger = loggerInstance || logger
  }

  /**
   * Prepare document metadata for database storage
   * 
   * @param document Extracted document with metadata
   * @param departmentId Optional department ID
   * @returns Database-compatible metadata
   */
  prepareDocumentMetadata(
    document: ExtractedDocument,
    departmentId?: string
  ): Json {
    const moduleLogger = this.logger.withMetadata({
      module: 'DocumentMetadataService',
      method: 'prepareDocumentMetadata',
      documentId: document.id,
    })
    
    try {
      moduleLogger.info('Preparing document metadata')
      
      const metadata = getDbCompatibleMetadata({
        ...document.extracted_data.metadata,
        extractionDate: new Date().toISOString(),
        departmentId,
        processingComplete: document.is_processed,
        documentType: document.document_type
      }) as Json
      
      moduleLogger.info('Document metadata prepared successfully')
      return metadata
    } catch (error) {
      moduleLogger.error('Error preparing document metadata', {}, error)

      throw new MetadataFormattingError(
        `Failed to prepare document metadata: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      )
    }
  }

  /**
   * Validate document type category
   * 
   * @param category Document category to validate
   * @returns Valid category or default
   */
  validateDocumentCategory(category: string): DocumentCategory {
    const moduleLogger = this.logger.withMetadata({
      module: 'DocumentMetadataService',
      method: 'validateDocumentCategory',
      category,
    })
    
    const validCategory = VALID_DOCUMENT_CATEGORIES.includes(category as DocumentCategory) 
      ? category as DocumentCategory 
      : 'clinical'
      
    if (validCategory !== category) {
      moduleLogger.warn(`Invalid category: ${category}, defaulting to 'clinical'`)
    }
    
    return validCategory
  }

  /**
   * Generate a document title
   * 
   * @param docType Document type information
   * @param metadataTitle Optional title from metadata
   * @returns Generated document title
   */
  generateDocumentTitle(
    docType: DocumentType,
    metadataTitle?: string
  ): string {
    if (metadataTitle) {
      return metadataTitle
    }
    
    const category = this.validateDocumentCategory(docType.category)
    const documentType = docType.type || 'document'
    const timestamp = new Date().toISOString().split('T')[0]
    
    return `${category.charAt(0).toUpperCase() + category.slice(1)} ${documentType} - ${timestamp}`
  }
  
  /**
   * Extract safe metadata for database storage
   * 
   * @param metadata Raw metadata object
   * @returns Sanitized metadata object
   */
  sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {}
    
    // Process each key to ensure safe storage
    for (const [key, value] of Object.entries(metadata)) {
      // Skip null or undefined values
      if (value === null || value === undefined) {
        continue
      }
      
      // Handle different value types
      if (typeof value === 'object' && value !== null) {
        if (value instanceof Date) {
          // Convert dates to ISO strings
          result[key] = value.toISOString()
        } else if (Array.isArray(value)) {
          // Recursively process arrays
          result[key] = value.map(item => 
            typeof item === 'object' && item !== null 
              ? this.sanitizeMetadata(item) 
              : item
          )
        } else {
          // Recursively process objects
          result[key] = this.sanitizeMetadata(value)
        }
      } else if (typeof value === 'function') {
        // Skip functions
        continue
      } else {
        // Primitives can be stored directly
        result[key] = value
      }
    }
    
    return result
  }
}