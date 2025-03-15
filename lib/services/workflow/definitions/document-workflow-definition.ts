// lib/services/workflow/definitions/document-workflow-definition.ts
import { z } from 'zod';
import { StateMachineConfig } from '../../../state-machine/types';
import { GenericWorkflowService, WorkflowContext, baseContextSchema } from '../generic-workflow-service';
import { Result } from '../../../result/result';

// Shared processing phases for document workflow
export enum ProcessingPhase {
  INITIALIZATION = 'initialization',
  UPLOAD = 'upload',
  EXTRACTION = 'extraction',
  VERIFICATION = 'verification',
  COMPLETION = 'completion',
  ERROR = 'error',
}

// Shared workflow steps for document workflow
export enum WorkflowStep {
  IDLE = 'idle',
  UPLOAD = 'upload',
  EXTRACTION = 'extraction',
  VERIFICATION_PENDING = 'verification_pending',
  VERIFICATION_IN_PROGRESS = 'verification_in_progress',
  VERIFICATION_COMPLETED = 'verification_completed',
  VERIFICATION_FAILED = 'verification_failed',
  COMPLETE = 'complete',
  ERROR = 'error',
}

// Document types
export enum DocumentCategory {
  MEDICAL = 'medical',
  FINANCIAL = 'financial',
  LEGAL = 'legal',
  IDENTIFICATION = 'identification',
  OTHER = 'other',
}

/**
 * Document workflow context with document-specific fields
 */
export interface DocumentWorkflowContext extends WorkflowContext {
  // Document information
  documentId?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  documentType?: {
    category: DocumentCategory;
    type: string;
    subtype?: string;
  };
  
  // Patient information
  patientId?: string;
  
  // Extraction results
  extractedContent?: string;
  extractedData?: Record<string, unknown>;
  chunkCount?: number;
  
  // Error handling
  retryCount?: number;
}

/**
 * Extended schema for document workflow context validation
 */
export const documentContextSchema = baseContextSchema.extend({
  documentId: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  fileType: z.string().optional(),
  documentType: z.object({
    category: z.nativeEnum(DocumentCategory),
    type: z.string(),
    subtype: z.string().optional()
  }).optional(),
  patientId: z.string().optional(),
  extractedContent: z.string().optional(),
  extractedData: z.record(z.unknown()).optional(),
  chunkCount: z.number().optional(),
  retryCount: z.number().optional()
});

// Define the document workflow configuration
export const documentWorkflowConfig: StateMachineConfig<DocumentWorkflowContext> = {
  id: 'document-workflow',
  name: 'Document Processing Workflow',
  initial: WorkflowStep.IDLE,
  
  states: {
    [WorkflowStep.IDLE]: {
      id: WorkflowStep.IDLE,
      description: 'Initial state before processing starts',
      onEnter: [
        async (context) => {
          context.progress = 0;
          context.phase = ProcessingPhase.INITIALIZATION;
        }
      ]
    },
    [WorkflowStep.UPLOAD]: {
      id: WorkflowStep.UPLOAD,
      description: 'Document is being uploaded',
      onEnter: [
        async (context) => {
          context.phase = ProcessingPhase.UPLOAD;
          context.progress = 10;
        }
      ]
    },
    [WorkflowStep.EXTRACTION]: {
      id: WorkflowStep.EXTRACTION,
      description: 'Document content is being extracted',
      onEnter: [
        async (context) => {
          context.phase = ProcessingPhase.EXTRACTION;
          context.progress = 0;
        }
      ]
    },
    [WorkflowStep.VERIFICATION_PENDING]: {
      id: WorkflowStep.VERIFICATION_PENDING,
      description: 'Document is waiting for verification',
      onEnter: [
        async (context) => {
          context.phase = ProcessingPhase.VERIFICATION;
          context.progress = 0;
        }
      ]
    },
    [WorkflowStep.VERIFICATION_IN_PROGRESS]: {
      id: WorkflowStep.VERIFICATION_IN_PROGRESS,
      description: 'Document verification is in progress',
      onEnter: [
        async (context) => {
          context.phase = ProcessingPhase.VERIFICATION;
          context.progress = 50;
        }
      ]
    },
    [WorkflowStep.VERIFICATION_COMPLETED]: {
      id: WorkflowStep.VERIFICATION_COMPLETED,
      description: 'Document verification completed successfully',
      onEnter: [
        async (context) => {
          context.phase = ProcessingPhase.VERIFICATION;
          context.progress = 100;
        }
      ]
    },
    [WorkflowStep.VERIFICATION_FAILED]: {
      id: WorkflowStep.VERIFICATION_FAILED,
      description: 'Document verification failed',
      onEnter: [
        async (context) => {
          context.phase = ProcessingPhase.ERROR;
          context.progress = 100;
          context.error = 'Document verification failed';
          context.errorCode = 'VERIFICATION_FAILED';
        }
      ]
    },
    [WorkflowStep.COMPLETE]: {
      id: WorkflowStep.COMPLETE,
      description: 'Document processing completed successfully',
      onEnter: [
        async (context) => {
          context.phase = ProcessingPhase.COMPLETION;
          context.progress = 100;
          context.completedAt = context.completedAt || new Date().toISOString();
        }
      ]
    },
    [WorkflowStep.ERROR]: {
      id: WorkflowStep.ERROR,
      description: 'Document processing encountered an error',
      onEnter: [
        async (context) => {
          context.phase = ProcessingPhase.ERROR;
          context.metadata = {
            ...context.metadata,
            errorTimestamp: new Date().toISOString()
          };
        }
      ]
    }
  },
  
  transitions: [
    {
      from: WorkflowStep.IDLE,
      to: WorkflowStep.UPLOAD,
      on: 'UPLOAD_DOCUMENT',
      actions: [
        async (context, event) => {
          context.fileName = event.payload?.fileName as string;
          context.fileSize = event.payload?.fileSize as number;
          context.fileType = event.payload?.fileType as string;
          context.patientId = event.payload?.patientId as string;
          context.documentType = event.payload?.documentType as any;
          context.startedAt = new Date().toISOString();
          context.phase = ProcessingPhase.UPLOAD;
          context.progress = 0;
        }
      ]
    },
    {
      from: WorkflowStep.UPLOAD,
      to: WorkflowStep.UPLOAD,
      on: 'UPLOAD_PROGRESS',
      actions: [
        async (context, event) => {
          if (typeof event.payload?.progress === 'number') {
            context.progress = event.payload.progress as number;
          }
        }
      ]
    },
    {
      from: WorkflowStep.UPLOAD,
      to: WorkflowStep.EXTRACTION,
      on: 'UPLOAD_COMPLETED',
      actions: [
        async (context, event) => {
          context.documentId = event.payload?.documentId as string;
          context.progress = 100;
          context.metadata = {
            ...context.metadata,
            uploadedAt: new Date().toISOString(),
            documentId: event.payload?.documentId
          };
        }
      ]
    },
    {
      from: WorkflowStep.UPLOAD,
      to: WorkflowStep.ERROR,
      on: 'UPLOAD_FAILED',
      actions: [
        async (context, event) => {
          context.error = event.payload?.error as string;
          context.errorCode = (event.payload?.errorCode as string) || 'UPLOAD_FAILED';
          context.phase = ProcessingPhase.ERROR;
          context.errorDetails = event.payload?.details as Record<string, unknown>;
        }
      ]
    },
    {
      from: WorkflowStep.EXTRACTION,
      to: WorkflowStep.EXTRACTION,
      on: 'EXTRACTION_PROGRESS',
      actions: [
        async (context, event) => {
          if (typeof event.payload?.progress === 'number') {
            context.progress = event.payload.progress as number;
          }
          if (event.payload?.phase) {
            context.phase = event.payload.phase as string;
          }
        }
      ]
    },
    {
      from: WorkflowStep.EXTRACTION,
      to: WorkflowStep.VERIFICATION_PENDING,
      on: 'EXTRACTION_COMPLETED',
      actions: [
        async (context, event) => {
          context.extractedContent = event.payload?.content as string;
          context.extractedData = event.payload?.extractedData as Record<string, unknown>;
          context.chunkCount = event.payload?.chunkCount as number;
          context.progress = 100;
          context.phase = ProcessingPhase.VERIFICATION;
          context.metadata = {
            ...context.metadata,
            extractedAt: new Date().toISOString(),
            extractionMethod: event.payload?.extractionMethod,
            contentLength: (event.payload?.content as string)?.length || 0,
            chunkCount: event.payload?.chunkCount
          };
        }
      ]
    },
    {
      from: WorkflowStep.EXTRACTION,
      to: WorkflowStep.ERROR,
      on: 'EXTRACTION_FAILED',
      actions: [
        async (context, event) => {
          context.error = event.payload?.error as string;
          context.errorCode = (event.payload?.errorCode as string) || 'EXTRACTION_FAILED';
          context.phase = ProcessingPhase.ERROR;
          context.errorDetails = event.payload?.details as Record<string, unknown>;
        }
      ]
    },
    {
      from: 'verification_pending',
      to: 'verification_in_progress',
      on: 'PREPARE_VERIFICATION',
      actions: [
        async (context, event) => {
          context.progress = 20;
          context.metadata = {
            ...context.metadata,
            verificationId: event.payload?.verificationId || `verification-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            fromChat: event.payload?.fromChat === true,
            chatId: event.payload?.chatId
          };
        }
      ]
    },
    {
      from: 'verification_in_progress',
      to: 'verification_completed',
      on: 'CONFIRM_VERIFICATION',
      actions: [
        async (context, event) => {
          context.completedAt = new Date().toISOString();
          context.status = 'completed';
          context.metadata = {
            ...context.metadata,
            verification_status: 'completed',
            verifiedAt: context.completedAt,
            verifiedBy: event.meta?.userId || context.userId,
            lastUpdated: context.completedAt
          };
          
          logger.info('Verification confirmed and completed', {
            verificationId: context.metadata.verificationId,
            documentId: context.documentId,
            userId: event.meta?.userId || context.userId,
            correctionCount: context.correctionCount
          });
        }
      ]
    },
    {
      from: 'verification_in_progress',
      to: 'verification_failed',
      on: 'REJECT_VERIFICATION',
      actions: [
        async (context, event) => {
          context.completedAt = new Date().toISOString();
          context.status = 'failed';
          context.error = event.payload?.reason || 'Verification rejected by user';
          context.metadata = {
            ...context.metadata,
            verification_status: 'failed',
            rejectedAt: context.completedAt,
            rejectedBy: event.meta?.userId || context.userId,
            rejectionReason: context.error,
            lastUpdated: context.completedAt
          };
          
          logger.info('Verification rejected', {
            verificationId: context.metadata.verificationId,
            documentId: context.documentId,
            userId: event.meta?.userId || context.userId,
            reason: context.error
          });
        }
      ]
    },
    {
      from: 'verification_in_progress',
      to: 'error',
      on: 'VERIFICATION_ERROR',
      actions: [
        async (context, event) => {
          context.error = event.payload?.error || 'Error during verification';
          context.status = 'failed';
          context.metadata = {
            ...context.metadata,
            error: event.payload?.error || 'Error during verification'
          };
          
          logger.error('Verification in-progress error', {
            verificationId: context.metadata.verificationId,
            documentId: context.documentId,
            error: context.error
          });
        }
      ]
    },
    {
      from: 'verification_completed',
      to: 'report_generation',
      on: 'GENERATE_REPORT',
      condition: (context) => context.autoGenerateReport === true,
      effects: [
        async (context, event) => {
          context.metadata = {
            ...context.metadata,
            reportGenerationStartedAt: new Date().toISOString(),
            autoGenerateReport: true
          };
        }
      ]
    },
    {
      from: 'verification_completed',
      to: 'chat_return',
      on: 'RETURN_TO_CHAT',
      condition: (context, event) => context.metadata.fromChat === true && context.metadata.chatId !== undefined,
      effects: [
        async (context, event) => {
          context.metadata = {
            ...context.metadata,
            returnToChat: true,
            chatCompletedAt: new Date().toISOString()
          };
        }
      ]
    },
    {
      from: 'verification_completed',
      to: 'verification_pending',
      on: 'START_NEW_RESEARCH',
      effects: [
        async (context, event) => {
          context.metadata = {
            ...context.metadata,
            previousResearchId: context.metadata.verificationId,
            previousResearchContent: context.currentSummary,
            previousSources: context.metadata.sources,
            previousCompletedAt: context.completedAt
          };
          context.documentId = event.payload?.documentId;
          context.progress = 10;
          context.verificationId = undefined;
          context.currentSummary = undefined;
          const { verificationId, summaryId, originalContent, currentSummary, status, autoGenerateReport, ...rest } = context.metadata;
          context.metadata = { ...rest };
          context.completedAt = undefined;
        }
      ]
    },
    {
      from: 'verification_completed',
      to: 'complete',
      on: 'COMPLETE_WORKFLOW',
      effects: [
        async (context, event) => {
          // No additional actions
        }
      ]
    },
    {
      from: 'verification_error',
      to: 'verification_pending',
      on: 'RETRY_VERIFICATION',
      effects: [
        async (context, event) => {
          context.error = undefined;
          context.status = 'pending';
          context.progress = 10;
        }
      ]
    },
    {
      from: 'verification_error',
      to: 'chat_return',
      on: 'RETURN_TO_CHAT',
      condition: (context, event) => context.metadata.fromChat === true && context.metadata.chatId !== undefined,
      effects: [
        async (context, event) => {
          context.metadata = {
            ...context.metadata,
            returnToChat: true,
            chatCompletedAt: new Date().toISOString()
          };
        }
      ]
    },
    {
      from: 'verification_error',
      to: 'complete',
      on: 'COMPLETE_WORKFLOW',
      effects: [
        async (context, event) => {
          // No additional actions
        }
      ]
    }
  ]
});

export default verificationWorkflowDefinition;