/**
 * @fileoverview Document Workflow Definition
 *
 * Defines the declarative state machine for document processing workflows.
 * This definition is registered with the workflow engine to provide
 * consistent state management for document processing.
 */

import { z } from 'zod';
import { ProcessingPhase, WorkflowStep, DomainOnlyWorkflowStep } from '@/lib/types/workflow';
import { createWorkflowDefinition, WorkflowAction } from '../coordination/workflow-definition';
import { DocumentCategory } from '@/lib/types/document';
import logger from '@/lib/logger';

/**
 * Document workflow context schema
 */
export interface DocumentWorkflowContext {
  // User information
  userId: string;
  patientId?: string;
  
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
  
  // Processing state
  progress: number;
  phase?: ProcessingPhase;
  startedAt?: string;
  completedAt?: string;
  
  // Extraction results
  extractedContent?: string;
  extractedData?: Record<string, unknown>;
  chunkCount?: number;
  
  // Error handling
  error?: string;
  errorCode?: string;
  errorDetails?: Record<string, unknown>;
  retryCount?: number;
  
  // Other metadata
  transactionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Zod schema for document workflow context validation
 */
const documentContextSchema = z.object({
  // Required fields
  userId: z.string(),
  progress: z.number().min(0).max(100).default(0),
  
  // Optional fields
  patientId: z.string().optional(),
  documentId: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  fileType: z.string().optional(),
  documentType: z.object({
    category: z.nativeEnum(DocumentCategory),
    type: z.string(),
    subtype: z.string().optional()
  }).optional(),
  phase: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  extractedContent: z.string().optional(),
  extractedData: z.record(z.unknown()).optional(),
  chunkCount: z.number().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  errorDetails: z.record(z.unknown()).optional(),
  retryCount: z.number().optional(),
  transactionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Initial context for document workflows
 */
const initialDocumentContext: DocumentWorkflowContext = {
  userId: '',
  progress: 0
};

/**
 * Define common logging for effects
 */
const logTransition = (step: string) => async (context: DocumentWorkflowContext, action: WorkflowAction) => {
  logger.info(`Document workflow transitioning to ${step}`, {
    userId: context.userId,
    documentId: context.documentId,
    fileName: context.fileName,
    fromStep: action.meta?.fromStep,
    toStep: step,
    transactionId: action.meta?.transactionId || context.transactionId
  });
};

/**
 * Document workflow definition
 */
export const documentWorkflowDefinition = createWorkflowDefinition<DocumentWorkflowContext>({
  id: 'document-workflow',
  name: 'Document Processing Workflow',
  description: 'Handles document upload, extraction, and processing',
  version: '1.0.0',
  initialState: 'idle' as WorkflowStep,
  domains: ['Document'],
  context: {
    schema: documentContextSchema,
    initialValue: initialDocumentContext
  },
  
  // State machine definition
  states: {
    // Initial state - waiting for document
    'idle': {
      id: 'idle' as WorkflowStep,
      type: 'initial',
      description: 'Initial state before processing starts',
      transitions: {
        'UPLOAD_DOCUMENT': {
          target: 'uploading' as WorkflowStep,
          effects: [
            logTransition('uploading'),
            async (context, event) => {
              // Record upload start
              context.fileName = event.payload?.fileName;
              context.fileSize = event.payload?.fileSize;
              context.fileType = event.payload?.fileType;
              context.patientId = event.payload?.patientId;
              context.documentType = event.payload?.documentType;
              context.startedAt = new Date().toISOString();
              context.phase = ProcessingPhase.UPLOADING;
              context.progress = 0;
              
              // Store transaction ID if provided
              if (event.meta?.transactionId) {
                context.transactionId = event.meta.transactionId;
              }
              
              // Store user ID
              if (event.meta?.userId) {
                context.userId = event.meta.userId;
              }
            }
          ]
        }
      }
    },
    
    // Document is being uploaded
    'uploading': {
      id: 'uploading' as WorkflowStep,
      description: 'Document is being uploaded',
      onEntry: [
        async (context) => {
          context.phase = ProcessingPhase.UPLOADING;
          context.progress = 10;
        }
      ],
      transitions: {
        'UPLOAD_PROGRESS': {
          target: 'uploading' as WorkflowStep, // self-transition for progress updates
          effects: [
            async (context, event) => {
              // Update progress
              if (typeof event.payload?.progress === 'number') {
                context.progress = event.payload.progress;
              }
            }
          ]
        },
        'UPLOAD_COMPLETED': {
          target: 'extracting' as WorkflowStep,
          effects: [
            logTransition('extracting'),
            async (context, event) => {
              // Store document ID and update progress
              context.documentId = event.payload.documentId;
              context.progress = 100;
              context.phase = ProcessingPhase.UPLOADING;
              context.metadata = {
                ...context.metadata,
                uploadedAt: new Date().toISOString(),
                documentId: event.payload.documentId
              };
            }
          ]
        },
        'UPLOAD_FAILED': {
          target: DomainOnlyWorkflowStep.ERROR,
          effects: [
            logTransition('error'),
            async (context, event) => {
              context.error = event.payload.error;
              context.errorCode = event.payload.errorCode || 'UPLOAD_FAILED';
              context.phase = ProcessingPhase.ERROR;
              context.errorDetails = event.payload.details;
            }
          ]
        }
      }
    },
    
    // Document content is being extracted
    'extracting': {
      id: 'extracting' as WorkflowStep,
      description: 'Document content is being extracted',
      onEntry: [
        async (context) => {
          context.phase = ProcessingPhase.EXTRACTION;
          context.progress = 0;
        }
      ],
      transitions: {
        'EXTRACTION_PROGRESS': {
          target: 'extracting' as WorkflowStep, // self-transition for progress updates
          effects: [
            async (context, event) => {
              // Update progress
              if (typeof event.payload?.progress === 'number') {
                context.progress = event.payload.progress;
              }
              // Update phase if provided
              if (event.payload?.phase) {
                context.phase = event.payload.phase as ProcessingPhase;
              }
            }
          ]
        },
        'EXTRACTION_COMPLETED': {
          target: 'verification_pending' as WorkflowStep,
          condition: (context, event) => !!event.payload?.autoVerify,
          effects: [
            logTransition('verification_pending'),
            async (context, event) => {
              // Record extracted content and data
              context.extractedContent = event.payload.content;
              context.extractedData = event.payload.extractedData;
              context.chunkCount = event.payload.chunkCount;
              context.progress = 100;
              context.phase = ProcessingPhase.EXTRACTION_COMPLETED;
              context.metadata = {
                ...context.metadata,
                extractedAt: new Date().toISOString(),
                extractionMethod: event.payload.extractionMethod,
                contentLength: event.payload.content?.length || 0,
                chunkCount: event.payload.chunkCount
              };
            }
          ]
        },
        'EXTRACTION_COMPLETED_NO_VERIFY': {
          target: 'complete' as WorkflowStep,
          effects: [
            logTransition('complete'),
            async (context, event) => {
              // Record extracted content and data without proceeding to verification
              context.extractedContent = event.payload.content;
              context.extractedData = event.payload.extractedData;
              context.chunkCount = event.payload.chunkCount;
              context.progress = 100;
              context.phase = ProcessingPhase.COMPLETION;
              context.completedAt = new Date().toISOString();
              context.metadata = {
                ...context.metadata,
                extractedAt: new Date().toISOString(),
                extractionMethod: event.payload.extractionMethod,
                contentLength: event.payload.content?.length || 0,
                chunkCount: event.payload.chunkCount,
                skipVerification: true
              };
            }
          ]
        },
        'EXTRACTION_FAILED': {
          target: DomainOnlyWorkflowStep.ERROR,
          effects: [
            logTransition('error'),
            async (context, event) => {
              context.error = event.payload.error;
              context.errorCode = event.payload.errorCode || 'EXTRACTION_FAILED';
              context.phase = ProcessingPhase.ERROR;
              context.errorDetails = event.payload.details;
            }
          ]
        }
      }
    },
    
    // Document is awaiting verification
    'verification_pending': {
      id: 'verification_pending' as WorkflowStep,
      description: 'Document is awaiting verification',
      onEntry: [
        async (context) => {
          context.phase = ProcessingPhase.VERIFICATION;
          context.progress = 0;
        }
      ],
      transitions: {
        'START_VERIFICATION': {
          target: 'verification_in_progress' as WorkflowStep,
          effects: [
            logTransition('verification_in_progress'),
            async (context, event) => {
              // Update verification metadata
              context.metadata = {
                ...context.metadata,
                verificationStartedAt: new Date().toISOString(),
                verificationId: event.payload.verificationId
              };
            }
          ]
        },
        'VERIFICATION_PROGRESS': {
          target: 'verification_pending' as WorkflowStep, // self-transition for progress updates
          effects: [
            async (context, event) => {
              // Update progress
              if (typeof event.payload?.progress === 'number') {
                context.progress = event.payload.progress;
              }
            }
          ]
        },
        'SKIP_VERIFICATION': {
          target: 'complete' as WorkflowStep,
          effects: [
            logTransition('complete'),
            async (context) => {
              // Mark as completed without verification
              context.progress = 100;
              context.phase = ProcessingPhase.COMPLETION;
              context.completedAt = new Date().toISOString();
              context.metadata = {
                ...context.metadata,
                skipVerification: true,
                completedAt: new Date().toISOString()
              };
            }
          ]
        }
      }
    },
    
    // Verification is in progress
    'verification_in_progress': {
      id: 'verification_in_progress' as WorkflowStep,
      description: 'User is verifying document data',
      transitions: {
        'VERIFY_CONFIRM': {
          target: 'verification_completed' as WorkflowStep,
          effects: [
            logTransition('verification_completed'),
            async (context, event) => {
              // Update verification status
              context.progress = 100;
              context.metadata = {
                ...context.metadata,
                verificationCompletedAt: new Date().toISOString(),
                verificationStatus: 'completed',
                verificationData: event.payload.verificationData,
                verifiedBy: event.meta?.userId || context.userId
              };
            }
          ]
        },
        'VERIFY_CORRECT': {
          target: 'verification_in_progress' as WorkflowStep, // Stay in same state for corrections
          effects: [
            async (context, event) => {
              // Record corrections
              context.metadata = {
                ...context.metadata,
                corrections: [
                  ...(context.metadata?.corrections || []),
                  {
                    fields: event.payload.corrections,
                    timestamp: new Date().toISOString(),
                    appliedBy: event.meta?.userId || context.userId
                  }
                ]
              };
            }
          ]
        },
        'VERIFY_REJECT': {
          target: 'verification_failed' as WorkflowStep,
          effects: [
            logTransition('verification_failed'),
            async (context, event) => {
              // Record rejection
              context.metadata = {
                ...context.metadata,
                verificationRejectedAt: new Date().toISOString(),
                verificationStatus: 'failed',
                rejectionReason: event.payload.reason,
                rejectedBy: event.meta?.userId || context.userId
              };
            }
          ]
        }
      }
    },
    
    // Verification completed successfully
    'verification_completed': {
      id: 'verification_completed' as WorkflowStep,
      description: 'Document has been verified',
      transitions: {
        'GENERATE_REPORT': {
          target: 'report_generation' as WorkflowStep,
          effects: [
            logTransition('report_generation'),
            async (context, event) => {
              // Prepare for report generation
              context.progress = 0;
              context.phase = ProcessingPhase.REPORT_GENERATION;
              context.metadata = {
                ...context.metadata,
                reportGenerationStartedAt: new Date().toISOString(),
                reportType: event.payload.reportType
              };
            }
          ]
        },
        'COMPLETE_WORKFLOW': {
          target: 'complete' as WorkflowStep,
          effects: [
            logTransition('complete'),
            async (context) => {
              // Mark as completed
              context.progress = 100;
              context.phase = ProcessingPhase.COMPLETION;
              context.completedAt = new Date().toISOString();
              context.metadata = {
                ...context.metadata,
                completedAt: new Date().toISOString()
              };
            }
          ]
        }
      }
    },
    
    // Verification failed
    'verification_failed': {
      id: 'verification_failed' as WorkflowStep,
      description: 'Document verification was rejected',
      transitions: {
        'RETRY_VERIFICATION': {
          target: 'verification_in_progress' as WorkflowStep,
          effects: [
            logTransition('verification_in_progress'),
            async (context) => {
              // Reset verification for retry
              context.metadata = {
                ...context.metadata,
                verificationRetryAt: new Date().toISOString(),
                verificationRetryCount: (context.metadata?.verificationRetryCount as number || 0) + 1
              };
            }
          ]
        },
        'RESTART_EXTRACTION': {
          target: 'extracting' as WorkflowStep,
          effects: [
            logTransition('extracting'),
            async (context) => {
              // Reset for re-extraction
              context.progress = 0;
              context.phase = ProcessingPhase.EXTRACTION;
              context.metadata = {
                ...context.metadata,
                reExtractionAt: new Date().toISOString()
              };
            }
          ]
        }
      }
    },
    
    // Report generation
    'report_generation': {
      id: 'report_generation' as WorkflowStep,
      description: 'Generating report from document data',
      onEntry: [
        async (context) => {
          context.phase = ProcessingPhase.REPORT_GENERATION;
          context.progress = 0;
        }
      ],
      transitions: {
        'REPORT_PROGRESS': {
          target: 'report_generation' as WorkflowStep, // self-transition for progress updates
          effects: [
            async (context, event) => {
              // Update progress
              if (typeof event.payload?.progress === 'number') {
                context.progress = event.payload.progress;
              }
            }
          ]
        },
        'REPORT_COMPLETED': {
          target: 'complete' as WorkflowStep,
          effects: [
            logTransition('complete'),
            async (context, event) => {
              // Record report completion
              context.progress = 100;
              context.phase = ProcessingPhase.COMPLETION;
              context.completedAt = new Date().toISOString();
              context.metadata = {
                ...context.metadata,
                reportId: event.payload.reportId,
                reportType: event.payload.reportType,
                reportGeneratedAt: new Date().toISOString(),
                reportFormat: event.payload.reportFormat
              };
            }
          ]
        },
        'REPORT_FAILED': {
          target: DomainOnlyWorkflowStep.ERROR,
          effects: [
            logTransition('error'),
            async (context, event) => {
              context.error = event.payload.error;
              context.errorCode = event.payload.errorCode || 'REPORT_GENERATION_FAILED';
              context.phase = ProcessingPhase.ERROR;
              context.errorDetails = event.payload.details;
            }
          ]
        }
      }
    },
    
    // Workflow complete
    'complete': {
      id: 'complete' as WorkflowStep,
      type: 'final',
      description: 'Document processing completed successfully',
      onEntry: [
        async (context) => {
          context.phase = ProcessingPhase.COMPLETION;
          context.progress = 100;
          context.completedAt = context.completedAt || new Date().toISOString();
        }
      ],
      transitions: {
        'RESET': {
          target: 'idle' as WorkflowStep,
          effects: [
            logTransition('idle'),
            async (context) => {
              // Reset workflow but keep document/user IDs
              const userId = context.userId;
              const patientId = context.patientId;
              const documentId = context.documentId;
              
              // Reset to initial state
              Object.assign(context, initialDocumentContext);
              
              // But preserve IDs
              context.userId = userId;
              context.patientId = patientId;
              context.documentId = documentId;
              context.metadata = {
                resetAt: new Date().toISOString(),
                previousDocumentId: documentId
              };
            }
          ]
        }
      }
    },
    
    // Error state
    [DomainOnlyWorkflowStep.ERROR]: {
      id: DomainOnlyWorkflowStep.ERROR,
      type: 'error',
      description: 'Document processing encountered an error',
      onEntry: [
        async (context) => {
          context.phase = ProcessingPhase.ERROR;
          context.metadata = {
            ...context.metadata,
            errorTimestamp: new Date().toISOString(),
            errorDetails: context.errorDetails,
            errorCode: context.errorCode
          };
        }
      ],
      transitions: {
        'RETRY': {
          target: 'extracting' as WorkflowStep,
          effects: [
            logTransition('extracting'),
            async (context) => {
              // Clear error but increment retry count
              context.error = undefined;
              context.errorCode = undefined;
              context.retryCount = (context.retryCount || 0) + 1;
              context.phase = ProcessingPhase.EXTRACTION;
              context.progress = 0;
              context.metadata = {
                ...context.metadata,
                retryAt: new Date().toISOString(),
                retryCount: (context.retryCount || 0) + 1
              };
            }
          ]
        },
        'RESET': {
          target: 'idle' as WorkflowStep,
          effects: [
            logTransition('idle'),
            async (context) => {
              // Reset workflow but keep document/user IDs
              const userId = context.userId;
              const patientId = context.patientId;
              const documentId = context.documentId;
              
              // Reset to initial state
              Object.assign(context, initialDocumentContext);
              
              // But preserve IDs
              context.userId = userId;
              context.patientId = patientId;
              context.documentId = documentId;
              context.metadata = {
                resetAt: new Date().toISOString(),
                previousError: context.error,
                previousErrorCode: context.errorCode
              };
            }
          ]
        }
      }
    }
  }
});