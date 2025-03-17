/**
 * Document Status Service
 * 
 * Handles document status updates and tracking.
 */
import logger from '@/lib/logger'
import { DocumentDatabaseService } from './document-database-service'
import { StatusUpdateError } from './errors'
import { DocumentProcessingStatus, StatusUpdateOptions } from './types'

/**
 * Service for document status operations
 */
export class DocumentStatusService {
  /**
   * Logger instance
   */
  private readonly logger

  /**
   * Database service for storage operations
   */
  private readonly dbService: DocumentDatabaseService

  constructor(
    dbService?: DocumentDatabaseService,
    loggerInstance?: typeof logger
  ) {
    this.dbService = dbService || new DocumentDatabaseService()
    this.logger = loggerInstance || logger
  }

  /**
   * Update document processing status
   * 
   * @param documentId Document ID to update
   * @param status New processing status
   * @param options Additional update options
   * @returns True if update was successful
   */
  async updateDocumentStatus(
    documentId: string,
    status: DocumentProcessingStatus,
    options: StatusUpdateOptions = {}
  ): Promise<boolean> {
    const moduleLogger = this.logger.withMetadata({
      module: 'DocumentStatusService',
      method: 'updateDocumentStatus',
      documentId,
      status,
    })

    try {
      moduleLogger.info('Updating document status', { status, options })
      
      const updateData: Record<string, any> = {
        processing_status: status,
      }

      // Add error message if status is failed and error provided
      if (status === 'failed' && options.errorMessage) {
        updateData.processing_error = options.errorMessage
      }

      // Update is_processed flag based on status or explicit option
      if (options.isProcessed !== undefined) {
        updateData.is_processed = options.isProcessed
      } else if (status === 'completed') {
        updateData.is_processed = true
      } else if (status === 'failed') {
        updateData.is_processed = false
      }

      // Add any additional metadata if provided
      if (options.metadata) {
        // We're just updating status, so we won't merge metadata
        // This would typically be handled by a dedicated metadata update method
        updateData.metadata_update = options.metadata
      }

      // Perform the update via the database service
      const success = await this.dbService.updateDocument(documentId, updateData)
      
      moduleLogger.info('Document status updated successfully', { status })
      return success
    } catch (error) {
      moduleLogger.error('Error updating document status', {}, error)

      throw new StatusUpdateError(
        `Failed to update document status: ${error instanceof Error ? error.message : String(error)}`,
        'STATUS_UPDATE_ERROR', true, { documentId, status, originalError: error }
      )
    }
  }
  
  /**
   * Get the current status of a document
   * 
   * @param documentId Document ID to check
   * @returns Current processing status or null if not found
   */
  async getDocumentStatus(documentId: string): Promise<DocumentProcessingStatus | null> {
    const moduleLogger = this.logger.withMetadata({
      module: 'DocumentStatusService',
      method: 'getDocumentStatus',
      documentId,
    })
    
    try {
      moduleLogger.info('Getting document status')
      
      const document = await this.dbService.getDocumentById(documentId)
      
      if (!document) {
        moduleLogger.info('Document not found')
        return null
      }
      
      const status = document.processing_status as DocumentProcessingStatus
      
      moduleLogger.info('Document status retrieved', { status })
      return status
    } catch (error) {
      moduleLogger.error('Error getting document status', {}, error)
      
      throw new StatusUpdateError(
        `Failed to get document status: ${error instanceof Error ? error.message : String(error)}`,
        'STATUS_RETRIEVAL_ERROR', true, { documentId, originalError: error }
      )
    }
  }
}