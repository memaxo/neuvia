/**
 * @fileoverview Document Workflow Processor
 * 
 * Handles all document-related workflow operations including:
 * - Document uploading
 * - Content extraction
 * - Document storage and retrieval
 * - Metadata management
 */

import { ApplicationError, normalizeError } from '@/lib/errors'
import logger from '@/lib/logger'
import { workflowRepository } from '../infrastructure/workflow-repository'
import { workflowStateManager } from '../infrastructure/workflow-state-manager'
import { workflowEventSourcing } from '../infrastructure/workflow-event-source'
import { workflowTransactionManager } from '../workflow-transaction-manager'

import type { WorkflowStep, ProcessingPhase } from '@/lib/types/workflow'

/**
 * Document processing result
 */
export interface DocumentProcessingResult {
  /** Document ID */
  documentId: string;
  /** Extracted content */
  content?: string;
  /** Extraction metadata */
  metadata: Record<string, unknown>;
  /** Whether the extraction was successful */
  success: boolean;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Error message if processing failed */
  error?: string;
}

/**
 * Document upload options
 */
export interface DocumentUploadOptions {
  /** User ID who uploaded the document */
  userId: string;
  /** Patient ID associated with the document */
  patientId?: string;
  /** Document type */
  documentType?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Whether to automatically start extraction after upload */
  autoExtract?: boolean;
  /** Progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
  /** Transaction ID for tracking */
  transactionId?: string;
}

/**
 * Document extraction options
 */
export interface DocumentExtractionOptions {
  /** Extraction model to use */
  model?: string;
  /** Whether to use cache */
  useCache?: boolean;
  /** Progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
  /** Whether to auto-start verification after extraction */
  autoVerify?: boolean;
  /** Transaction ID for tracking */
  transactionId?: string;
}

/**
 * Document workflow processor
 */
export class DocumentWorkflow {
  private readonly logger = logger.withMetadata({ module: 'DocumentWorkflow' });
  
  /**
   * Process document upload
   */
  async processUpload(
    workflowId: string,
    file: File,
    options: DocumentUploadOptions
  ): Promise<DocumentProcessingResult> {
    try {
      // Start transaction for document upload
      return await workflowTransactionManager.executeTransaction(
        workflowId,
        async (progressCallback, transactionId) => {
          // Update workflow state to uploading
          await workflowStateManager.transitionState(
            workflowId,
            'idle',
            'uploading',
            {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              userId: options.userId,
              patientId: options.patientId,
              documentType: options.documentType,
              ...options.metadata,
              transactionId
            }
          );
          
          // Initial progress update
          progressCallback(10, ProcessingPhase.UPLOAD);
          
          // Here we would typically call a document service to handle the upload
          // For now, we'll simulate the upload process
          const documentId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
          
          // Update progress
          progressCallback(50, ProcessingPhase.UPLOAD);
          
          // Simulate upload delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Complete upload
          progressCallback(90, ProcessingPhase.UPLOAD);
          
          // Log document upload event
          await workflowEventSourcing.appendEvent(
            workflowId,
            'document_uploaded',
            {
              documentId,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              timestamp: new Date().toISOString(),
              transactionId
            }
          );
          
          // Final progress update
          progressCallback(100, ProcessingPhase.UPLOAD);
          
          // Prepare result
          const result: DocumentProcessingResult = {
            documentId,
            metadata: {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              uploadedAt: new Date().toISOString(),
              userId: options.userId,
              patientId: options.patientId,
              documentType: options.documentType
            },
            success: true,
            processingTime: 1000
          };
          
          // Auto-extract if requested
          if (options.autoExtract) {
            try {
              return await this.extractContent(workflowId, documentId, {
                onProgress: options.onProgress,
                transactionId
              });
            } catch (extractionError) {
              // Log but continue - upload was successful even if extraction failed
              this.logger.error('Auto-extraction failed after successful upload', {
                workflowId,
                documentId,
                error: extractionError instanceof Error ? extractionError.message : String(extractionError)
              });
              
              // Return upload success with extraction error
              return {
                ...result,
                error: `Upload successful but extraction failed: ${
                  extractionError instanceof Error ? extractionError.message : 'Unknown error'
                }`
              };
            }
          }
          
          return result;
        },
        {
          step: 'uploading',
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type
          },
          onProgress: options.onProgress,
          transactionId: options.transactionId,
          recoveryStep: 'idle'
        }
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Document upload failed', {
        workflowId,
        fileName: file.name,
        error: normalizedError.message
      });
      
      // Return error result
      return {
        documentId: '',
        metadata: {},
        success: false,
        processingTime: 0,
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Extract content from document
   */
  async extractContent(
    workflowId: string,
    documentId: string,
    options: DocumentExtractionOptions = {}
  ): Promise<DocumentProcessingResult> {
    try {
      // Start transaction for content extraction
      return await workflowTransactionManager.executeTransaction(
        workflowId,
        async (progressCallback, transactionId) => {
          // Get current state
          const currentState = await workflowRepository.getWorkflowState(workflowId);
          if (!currentState) {
            throw new Error('Workflow state not found');
          }
          
          // Determine appropriate transition based on current state
          const fromStep: WorkflowStep = currentState.currentStep;
          
          // Update workflow state to extracting
          await workflowStateManager.transitionState(
            workflowId,
            fromStep,
            'extracting',
            {
              documentId,
              extractionStartedAt: new Date().toISOString(),
              model: options.model,
              useCache: options.useCache,
              transactionId
            }
          );
          
          // Initial progress update
          progressCallback(10, ProcessingPhase.EXTRACTION);
          
          // Here we would typically call a document service to handle the extraction
          // For now, we'll simulate the extraction process
          
          // Update progress during "processing"
          progressCallback(30, ProcessingPhase.EXTRACTION);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          progressCallback(50, ProcessingPhase.EXTRACTION);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          progressCallback(70, ProcessingPhase.EXTRACTION);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Simulate extraction result
          const extractedContent = `Sample extracted content for document ${documentId}`;
          
          // Log extraction completion event
          await workflowEventSourcing.appendEvent(
            workflowId,
            'document_extracted',
            {
              documentId,
              extractionCompletedAt: new Date().toISOString(),
              contentLength: extractedContent.length,
              model: options.model,
              transactionId
            }
          );
          
          // Final progress update
          progressCallback(100, ProcessingPhase.EXTRACTION);
          
          // Auto-transition to verification if requested
          if (options.autoVerify) {
            // Update to verification_pending state
            await workflowStateManager.transitionState(
              workflowId,
              'extracting',
              'verification_pending',
              {
                documentId,
                verificationStartedAt: new Date().toISOString(),
                extractedContent,
                transactionId
              }
            );
          }
          
          // Return result
          return {
            documentId,
            content: extractedContent,
            metadata: {
              extractionCompletedAt: new Date().toISOString(),
              model: options.model,
              contentLength: extractedContent.length
            },
            success: true,
            processingTime: 1500
          };
        },
        {
          step: 'extracting',
          metadata: {
            documentId,
            model: options.model
          },
          onProgress: options.onProgress,
          transactionId: options.transactionId,
          recoveryStep: 'idle'
        }
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Document extraction failed', {
        workflowId,
        documentId,
        error: normalizedError.message
      });
      
      // Return error result
      return {
        documentId,
        metadata: {},
        success: false,
        processingTime: 0,
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Get document info
   */
  async getDocumentInfo(
    workflowId: string,
    documentId: string
  ): Promise<Record<string, unknown> | null> {
    try {
      // Get current workflow state
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state || !state.metadata) {
        return null;
      }
      
      // Check if this workflow is associated with the requested document
      if (state.metadata.documentId !== documentId) {
        // Try looking at workflow events
        const events = await workflowEventSourcing.getEventHistory(workflowId, {
          eventType: ['document_uploaded', 'document_extracted']
        });
        
        // Find document info in events
        for (const event of events) {
          if (event.event_data && event.event_data.documentId === documentId) {
            return {
              documentId,
              workflowId,
              eventType: event.event_type,
              ...event.event_data
            };
          }
        }
        
        return null;
      }
      
      // Return document info from workflow state
      return {
        documentId,
        workflowId,
        state: state.currentStep,
        metadata: state.metadata
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to get document info', {
        workflowId,
        documentId,
        error: normalizedError.message
      });
      return null;
    }
  }
}

// Export singleton instance
export const documentWorkflow = new DocumentWorkflow();