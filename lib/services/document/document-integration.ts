import { workflowMediator } from '@/lib/services/workflow/workflow-mediator';
import { eventService } from '@/lib/services/event-service';
import { documentService } from '@/lib/services/document';
import { chatService } from '@/lib/services/chat/chat-service';
import { EVENT_TYPES } from '@/lib/types/events';
import { ChatMessageType } from '@/lib/types/chat';
import { ProcessingPhase } from '@/lib/types/workflow';
import { normalizeError } from '@/lib/errors';
import logger from '@/lib/logger';

import type {
  DocumentStatusEventPayload,
  DocumentProcessedEventPayload
} from '@/lib/types/events';

/**
 * Document Integration Service
 *
 * Provides integration between document processing and chat/workflow.
 * Handles document uploads and extraction in the context of workflows.
 */
export class DocumentIntegrationService {
  private readonly logger = logger.withMetadata({ module: 'DocumentIntegrationService' });

  constructor() {
    this.logger.info('DocumentIntegrationService initialized');
    this.registerEventHandlers();
  }

  private registerEventHandlers(): void {
    // Listen for document processing status events
    eventService.subscribe(
      EVENT_TYPES.DOCUMENT_STATUS,
      this.handleDocumentStatus.bind(this)
    );
    
    // Listen for document processed events
    eventService.subscribe(
      EVENT_TYPES.DOCUMENT_PROCESSED,
      this.handleDocumentProcessed.bind(this)
    );
  }

  /**
   * Process a document upload within a workflow
   *
   * @param file Document file
   * @param patientId Patient ID
   * @param workflowId Workflow ID
   * @param chatId Optional chat ID for adding messages
   */
  async processDocumentUpload(
    file: File,
    patientId: string,
    workflowId: string,
    chatId?: string
  ): Promise<string> {
    try {
      // Add processing message to chat if chatId provided
      let progressMessageId: string | undefined;
      
      if (chatId) {
        progressMessageId = crypto.randomUUID();
        await chatService.saveMessage({
          id: progressMessageId,
          role: 'system',
          content: `Processing document: ${file.name}`,
          createdAt: new Date(),
          metadata: {
            type: ChatMessageType.PROGRESS,
            progress: {
              value: 0,
              phase: ProcessingPhase.EXTRACTION
            },
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type
          }
        }, chatId);
      }
      
      // Process document through the workflow mediator
      const documentId = await workflowMediator.initiateDocumentProcessing(
        workflowId,
        file,
        patientId,
        { progressMessageId, chatId }
      );
      
      // Return the document ID
      return documentId;
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Error processing document upload', {
        fileName: file.name,
        patientId,
        workflowId
      }, error);
      
      // Add error message to chat if chatId provided
      if (chatId) {
        await chatService.saveMessage({
          id: crypto.randomUUID(),
          role: 'system',
          content: `Error processing document: ${normalizedError.message}`,
          createdAt: new Date(),
          metadata: {
            type: ChatMessageType.ERROR,
            errorCode: normalizedError.code,
            fileName: file.name
          }
        }, chatId);
      }
      
      throw error;
    }
  }
  
  /**
   * Event handler for document status updates
   */
  private async handleDocumentStatus(payload: DocumentStatusEventPayload): Promise<void> {
    const { workflowId, status, documentId } = payload;
    
    this.logger.debug('Document status update', {
      workflowId,
      documentId,
      status: status.status,
      progress: status.progress
    });
    
    // Get current workflow state to check if there's an associated chat
    try {
      const workflowState = await workflowMediator.getWorkflowState(workflowId);
      
      if (!workflowState) {
        return;
      }
      
      const chatId = workflowState.metadata?.chatId as string;
      const progressMessageId = workflowState.metadata?.progressMessageId as string;
      
      // If we have both chatId and progressMessageId, update the progress message
      if (chatId && progressMessageId) {
        await chatService.updateMessage(progressMessageId, {
          metadata: {
            type: ChatMessageType.PROGRESS,
            progress: {
              value: status.progress,
              phase: status.phase || ProcessingPhase.EXTRACTION
            },
            currentStep: status.currentStep,
            error: status.error
          }
        });
      }
    } catch (error) {
      this.logger.error('Error handling document status update', {
        workflowId,
        documentId
      }, error);
    }
  }
  
  /**
   * Event handler for processed documents
   */
  private async handleDocumentProcessed(payload: DocumentProcessedEventPayload): Promise<void> {
    const { workflowId, documentId, patientId, document } = payload;
    
    this.logger.info('Document processing completed', {
      workflowId,
      documentId,
      patientId
    });
    
    // Get current workflow state to check if there's an associated chat
    try {
      const workflowState = await workflowMediator.getWorkflowState(workflowId);
      
      if (!workflowState) {
        return;
      }
      
      const chatId = workflowState.metadata?.chatId as string;
      
      // If we have a chatId, add a completion message
      if (chatId) {
        await chatService.saveMessage({
          id: crypto.randomUUID(),
          role: 'system',
          content: `Document processing completed: ${document.fileName}`,
          createdAt: new Date(),
          metadata: {
            type: ChatMessageType.SYSTEM,
            documentId,
            fileName: document.fileName
          }
        }, chatId);
      }
    } catch (error) {
      this.logger.error('Error handling document processed event', {
        workflowId,
        documentId
      }, error);
    }
  }
}

// Singleton instance
export const documentIntegrationService = new DocumentIntegrationService();