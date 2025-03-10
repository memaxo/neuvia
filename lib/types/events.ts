import type { WorkflowStep, ProcessingPhase } from '@/lib/types/workflow';
import type { VerificationResult } from '@/lib/types/verification';
import type { ResearchResult } from '@/lib/types/research';
import type { DocumentType } from '@/lib/types/document';
import type { UUID } from '@/lib/types/base';

// Base event payload interface
export interface BaseEventPayload {
  timestamp?: string;
}

// Workflow event payload
export interface WorkflowEventPayload extends BaseEventPayload {
  workflowId: string;
  currentStep: WorkflowStep;
  progress: number;
  phase?: ProcessingPhase;
  metadata?: Record<string, unknown>;
}

// Chat message event payload
export interface ChatMessageEventPayload extends BaseEventPayload {
  chatId: string;
  messageId: string;
  message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: Record<string, unknown>;
  };
}

// Document processed event payload
export interface DocumentProcessedEventPayload extends BaseEventPayload {
  workflowId: string;
  documentId: string;
  patientId: string;
  document: {
    id: string;
    fileName: string;
    fileType: string;
    documentType: DocumentType;
    [key: string]: unknown;
  };
}

// Document processing status event payload
export interface DocumentStatusEventPayload extends BaseEventPayload {
  workflowId: string;
  documentId?: string;
  status: {
    status: 'processing' | 'success' | 'error';
    progress: number;
    currentStep?: string;
    phase?: ProcessingPhase;
    error?: string;
  };
}

// Verification initiated event payload
export interface VerificationInitiatedEventPayload extends BaseEventPayload {
  workflowId: string;
  documentId: string;
  patientId: string;
  summaryId: string;
  summary: string;
}

// Verification correction event payload
export interface VerificationCorrectionEventPayload extends BaseEventPayload {
  workflowId: string;
  chatId: string;
  messageId: string;
  correction: string;
  currentSummary: string;
}

// Verification confirmation event payload
export interface VerificationConfirmationEventPayload extends BaseEventPayload {
  workflowId: string;
  chatId: string;
  messageId: string;
}

// Verification completed event payload
export interface VerificationCompletedEventPayload extends BaseEventPayload {
  workflowId: string;
  patientId?: string;
  verificationResult: VerificationResult;
  isApproved: boolean;
}

// Research completed event payload
export interface ResearchCompletedEventPayload extends BaseEventPayload {
  workflowId: string;
  patientId: string;
  researchResult: ResearchResult;
}

// Report generated event payload
export interface ReportGeneratedEventPayload extends BaseEventPayload {
  workflowId: string;
  patientId: string;
  reportId: UUID;
  reportData: Record<string, unknown>;
}

// Export all event types for use in event subscriptions
export const EVENT_TYPES = {
  // Workflow events
  WORKFLOW_UPDATED: 'workflow.updated',
  
  // Chat events
  CHAT_MESSAGE_CREATED: 'chat.message.created',
  
  // Document events
  DOCUMENT_PROCESSED: 'document.processed',
  DOCUMENT_STATUS: 'document.status',
  
  // Verification events
  VERIFICATION_INITIATED: 'verification.initiated',
  VERIFICATION_CORRECTION: 'verification.correction',
  VERIFICATION_CONFIRMATION: 'verification.confirmation',
  VERIFICATION_COMPLETED: 'verification.completed',
  
  // Research events
  RESEARCH_COMPLETED: 'research.completed',
  
  // Report events
  REPORT_GENERATED: 'report.generated'
};