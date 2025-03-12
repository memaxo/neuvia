"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createContext, type ReactNode, type Dispatch } from "react";

// Import proper types from the application's type files
import {
  ChatMessageType,
  type ChatMessage,
  type ChatMessageMetadata,
} from "@/lib/types/chat";
import type {
  WorkflowStep,
  WorkflowState,
  ProcessingStatus as WorkflowProcessingStatus,
  MessageMetadata
} from "@/lib/types/workflow";
import { 
  DomainOnlyWorkflowStep,
  ProcessingPhase
} from "@/lib/types/workflow";
import { VerificationStatus } from "@/lib/types/verification";
import type {
  VerificationItem,
  VerificationResult,
  VerificationMetadata,
  CompleteVerificationOptions,
  GenerateVerificationOptions,
  SubmitCorrectionOptions,
  ProcessCorrectionOptions
} from "@/lib/types/verification";
import type { DocumentType, DocumentCategory } from "@/lib/types/document";
import type { 
  ReportType, 
  ReportStatus, 
  ReportFormat, 
  ReportOptions, 
  ReportData, 
  ReportDocument, 
  ReportSections 
} from "@/lib/types/report";
import type { 
  ResearchOptions, 
  ResearchResult
} from "@/lib/types/research";
import type { 
  DocumentStatusEventPayload, 
  DocumentProcessedEventPayload
} from "@/lib/types/events";
import { EVENT_TYPES 
} from "@/lib/types/events";

// Import integration components
import { chatWorkflowIntegration } from "@/lib/services/chat/chat-workflow-integration";
import { workflowMediator } from "@/lib/services/workflow/workflow-mediator";
import { eventService } from "@/lib/services/event-service";
import { useWorkflow } from "@/lib/services/workflow/workflow-hook";
import type { WorkflowStateManager } from "@/lib/services/workflow/workflow-hook";

// Import services (still needed for some operations)
import { ApiClient } from "@/lib/api/client/api-client";
import { verificationService } from "@/lib/services/verification/verification-service";
import { documentService } from "@/lib/services/document";
import { reportService } from "@/lib/services/report/report-service";
import { perplexityService } from "@/lib/services/perplexity/perplexity-service";
import { workflowService } from "@/lib/services/workflow/workflow-service";
import { chatService } from "@/lib/services/chat/chat-service";
import { correctionService } from "@/lib/services/verification/correction-service";

// Import error handling
import { normalizeError, ApplicationError } from "@/lib/errors";
import {
  VerificationError,
  ReportGenerationError
} from "@/lib/errors/verification-errors";

// Import logger
import logger from '@/lib/logger';

// Add module logger
const moduleLogger = logger.withMetadata({ module: 'ChatStore' });

////////////////////////////////////////////////////////////////////////////////
// Types and Interfaces
////////////////////////////////////////////////////////////////////////////////

export type ChatMode = "default" | "verification" | "research";

// Use ProcessingStatusType from workflow.ts
export type ProcessingStatusType = 'idle' | 'processing' | 'success' | 'error';

// Re-use ProcessingStatus from workflow.ts instead of redefining
// This is just for backwards compatibility - all new code should use WorkflowProcessingStatus
interface ProcessingStatus extends WorkflowProcessingStatus {
  currentStep?: string;
}

export interface VerificationOptions {
  items?: VerificationItem[];
  comments?: string;
}

// This interface defines the verification state for the chat store
interface VerificationState {
  isInVerificationMode: boolean;
  currentSummary: string | null;
  verificationStatus: VerificationStatus | string;
  verificationItems: VerificationItem[];
  
  // Additional fields not in the base type
  summaryVersions: Array<{
    id: string;
    content: string;
    timestamp: string;
    userId?: string;
  }>;
}

interface ResearchState {
  query: string | null;
  result: ResearchResult | null;
  isActive: boolean;
  progress: number;
}

// Initial workflow state
const initialWorkflowState: WorkflowState = {
  currentStep: "idle" as WorkflowStep,
  progress: 0,
  phase: ProcessingPhase.INITIALIZATION,
  error: null,
  metadata: {},
  timestamp: new Date().toISOString()
};

// Initial research state
const initialResearchState: ResearchState = {
  query: null,
  result: null,
  isActive: false,
  progress: 0
};

// Define a proper type for report data that matches what the workflow mediator returns
interface GeneratedReportData {
  report?: {
    id?: string;
    content?: string;
    title?: string;
    format?: string;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    patientId?: string;
    doctorId?: string;
    sections?: ReportSections;
    metadata?: Record<string, unknown>;
  };
  workflow?: {
    workflowId?: string;
    step?: WorkflowStep;
    progress?: number;
    phase?: string;
  };
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

// Updated chat store interface with enhanced types
export interface ChatStore {
  isLoading: boolean;
  error: string | null;
  mode: ChatMode;
  chatId?: string;
  workflowId?: string;

  messages: ChatMessage[];

  workflow: WorkflowState;

  // Verification state
  verification: VerificationState;

  // Research state
  research: ResearchState;

  // Document processing
  docProgress: number;
  isDocProcessing: boolean;
  extractedDocument: Record<string, unknown> | null;

  // Report generation
  reportGeneration?: {
    isComplete: boolean;
    format: Record<string, unknown>;
    reportId?: string;
  };

  // Workflow state manager
  workflowStateManager: WorkflowStateManager;

  ////////////////////////////////////////////////////////////////////////////
  // Actions
  ////////////////////////////////////////////////////////////////////////////
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setMode: (mode: ChatMode) => void;
  resetChat: () => void;

  // Message handling
  addMessage: (message: ChatMessage | Omit<ChatMessage, "id">) => void;
  updateMessages: (messages: ChatMessage[]) => void;
  updateMessageProgress: (messageId: string, progress: number, phase: string) => void;

  // Workflow methods
  updateWorkflowStep: (step: WorkflowStep, metadata?: Record<string, unknown>) => void;
  updateProgress: (progress: number, phase?: ProcessingPhase) => void;
  setWorkflowManager: (manager: WorkflowStateManager) => void;
  syncWorkflowState: (state: WorkflowState) => void;
  subscribeToWorkflowUpdates: (callback: (state: WorkflowState) => void) => () => void;

  // Verification methods
  startVerification: (content: string, options?: VerificationOptions) => Promise<void>;
  submitCorrection: (correction: string) => void;
  completeVerification: (isApproved: boolean) => Promise<VerificationResult>;
  handleCorrectionMessage: (correction: string) => Promise<void>;
  confirmVerification: () => Promise<VerificationResult>;
  initiateVerification: (extractedDocument: Record<string, unknown>, messageId?: string) => Promise<Record<string, unknown>>;
  processCorrection: (correctionText: string, currentSummary: string, messageId?: string) => Promise<Record<string, unknown>>;
  resetVerification: () => Promise<{ success: boolean }>;

  // Report generation methods
  startReportGeneration: (reportOptions?: Record<string, unknown>) => void;
  completeReportGeneration: (report: Record<string, unknown>) => void;
  generateReport: () => Promise<void>;
  formatReport: (format: Record<string, unknown>) => Promise<void>;
  beginReportGeneration: (reportMetadata?: Record<string, unknown>) => Promise<{ success: boolean }>;

  // Document processing methods
  processDocument: (
    file: File,
    patientId: string,
    documentType?: string,
    abortSignal?: AbortSignal
  ) => Promise<Record<string, unknown>>;
  uploadDocument: (file: File, patientId: string, documentType?: string) => Promise<Record<string, unknown>>;
  resetDocumentProcessing: () => void;

  // Message sending
  sendMessage: (
    content: string,
    options?: { isCorrection?: boolean; metadata?: ChatMessageMetadata }
  ) => Promise<void>;
  
  // Subscribe to workflow events
  subscribeToEvents: () => () => void;

  // Helper methods
  addSystemMessage: (content: string, type?: string, metadata?: Record<string, unknown>) => ChatMessage;
  postSummaryMessage: (summary: string) => ChatMessage;
  updateSummaryAfterCorrection: (newSummary: string) => ChatMessage;
  clearMessages: () => void;

  // Research methods
  performResearch: (query: string, options?: ResearchOptions) => Promise<ResearchResult>;
}

// Default workflow state manager implementation
const defaultWorkflowStateManager: WorkflowStateManager = {
  getCurrentWorkflowId: () => null,
  getCurrentChatId: () => null,
  resetWorkflow: async () => {},
  updateWorkflowState: async (_step: WorkflowStep, _metadata?: Record<string, unknown>) => {}
};

// Initial chat store state
const initialState: Omit<ChatStore, 'workflowStateManager' | 'setWorkflowManager' | 'syncWorkflowState' | 'subscribeToWorkflowUpdates' | 'performResearch'> = {
  isLoading: false,
  error: null,
  mode: "default",
  chatId: undefined,
  workflowId: undefined,
  messages: [],
  
  workflow: {
    currentStep: DomainOnlyWorkflowStep.ERROR,
    progress: 0,
    phase: ProcessingPhase.INITIALIZATION,
    error: null,
    metadata: {},
    timestamp: new Date().toISOString()
  },
  
  verification: {
    isInVerificationMode: false,
    currentSummary: null,
    verificationStatus: VerificationStatus.pending,
    verificationItems: [],
    summaryVersions: []
  },
  
  research: {
    query: null,
    result: null,
    isActive: false,
    progress: 0
  },
  
  docProgress: 0,
  isDocProcessing: false,
  extractedDocument: null,
  
  // Action implementations
  setLoading: () => {},
  setError: () => {},
  setMode: () => {},
  resetChat: () => {},
  
  addMessage: () => {},
  updateMessages: () => {},
  updateMessageProgress: () => {},
  
  updateWorkflowStep: () => {},
  updateProgress: () => {},
  
  startVerification: async () => {},
  submitCorrection: () => {},
  completeVerification: async () => ({
    isCompleted: false,
    isApproved: false,
    items: [],
    completedAt: new Date().toISOString(),
    verificationMetadata: {
      verification_status: VerificationStatus.failed,
      originalSummaryId: "",
      currentVersionId: "",
      correctionCount: 0,
      corrections: [],
      lastUpdated: new Date().toISOString(),
    },
  }),
  handleCorrectionMessage: async () => {},
  confirmVerification: async () => ({
    isCompleted: false,
    isApproved: false,
    items: [],
    completedAt: new Date().toISOString(),
    verificationMetadata: {
      verification_status: VerificationStatus.failed,
      originalSummaryId: "",
      currentVersionId: "",
      correctionCount: 0,
      corrections: [],
      lastUpdated: new Date().toISOString(),
    },
  }),
  initiateVerification: async () => ({}),
  processCorrection: async () => ({}),
  resetVerification: async () => ({ success: false }),
  
  startReportGeneration: () => {},
  completeReportGeneration: () => {},
  generateReport: async () => {},
  formatReport: async () => {},
  beginReportGeneration: async () => ({ success: false }),
  
  processDocument: async () => ({}),
  uploadDocument: async () => ({}),
  resetDocumentProcessing: () => {},
  
  sendMessage: async () => {},
  subscribeToEvents: () => () => {},
  
  addSystemMessage: () => ({ 
    id: '', 
    role: 'system', 
    content: '', 
    createdAt: '', 
    type: ChatMessageType.SYSTEM,
    metadata: {
      type: ChatMessageType.SYSTEM
    }
  }),
  postSummaryMessage: () => ({ 
    id: '', 
    role: 'system', 
    content: '', 
    createdAt: '', 
    type: ChatMessageType.SUMMARY,
    metadata: {
      type: ChatMessageType.SUMMARY
    }
  }),
  updateSummaryAfterCorrection: () => ({ 
    id: '', 
    role: 'system', 
    content: '', 
    createdAt: '', 
    type: ChatMessageType.SUMMARY,
    metadata: {
      type: ChatMessageType.SUMMARY
    }
  }),
  clearMessages: () => {}
};

// Helper function to create a fallback verification result
function createFallbackVerificationResult(state: Pick<ChatStore, 'verification'>): VerificationResult {
  return {
    isCompleted: false,
    isApproved: false,
    items: state.verification.verificationItems,
    completedAt: new Date().toISOString(),
    verificationMetadata: {
      verification_status: VerificationStatus.failed,
      originalSummaryId: state.verification.summaryVersions[0]?.id ?? "",
      currentVersionId:
        state.verification.summaryVersions[state.verification.summaryVersions.length - 1]?.id ?? "",
      correctionCount: state.verification.summaryVersions.length - 1,
      corrections: state.verification.summaryVersions.map((v) => ({
        id: v.id,
        text: v.content,
        timestamp: v.timestamp,
      })),
      startedAt: state.verification.summaryVersions[0]?.timestamp,
      lastUpdated: new Date().toISOString(),
    },
  };
}

// Create the actual store with Zustand
export const useChatStore = create<ChatStore>()(
  devtools(
    (set, get) => ({
      isLoading: false,
      error: null,
      mode: "default",
      chatId: undefined,
      workflowId: undefined,

      messages: [],

      workflow: initialWorkflowState,
      verification: {
        isInVerificationMode: false,
        currentSummary: null,
        verificationStatus: VerificationStatus.pending,
        verificationItems: [],
        summaryVersions: [],
      },
      research: initialResearchState,

      docProgress: 0,
      isDocProcessing: false,
      extractedDocument: null,

      reportGeneration: {
        isComplete: false,
        format: {},
      },

      workflowStateManager: {
        getCurrentWorkflowId: () => undefined,
        getCurrentState: () => initialWorkflowState,
        updateStep: async () => initialWorkflowState,
        updateProgress: async () => initialWorkflowState,
        resetWorkflow: async () => ({ success: true }),
      },

      // Basic state updates
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setMode: (mode) => set({ mode }),
      
      // Reset the entire chat store to initial state
      resetChat: () => set({
        messages: [],
        mode: "default",
        error: null,
        workflow: initialWorkflowState,
        verification: {
          isInVerificationMode: false,
          currentSummary: null,
          verificationStatus: VerificationStatus.pending,
          verificationItems: [],
          summaryVersions: [],
        },
        research: initialResearchState,
        docProgress: 0,
        isDocProcessing: false,
        extractedDocument: null,
        reportGeneration: {
          isComplete: false,
          format: {},
        },
      }),

      // Message methods
      addMessage: (message) => {
        const messageWithId = 'id' in message
          ? message
          : { ...message, id: crypto.randomUUID() };
          
        set((state) => ({
          ...state,
          messages: [...state.messages, messageWithId as ChatMessage],
        }));
      },
      
      updateMessages: (messages) => set({ messages }),
      
      updateMessageProgress: (messageId, progress, phase) => {
        set((state) => {
          const updatedMessages = state.messages.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  metadata: {
                    ...msg.metadata,
                    progress: {
                      ...msg.metadata?.progress,
                      value: progress,
                      phase,
                    },
                  },
                }
              : msg
          );
          
          return {
            ...state,
            messages: updatedMessages as ChatMessage[]
          };
        });
      },

      // Workflow methods
      updateWorkflowStep: async (newStep: WorkflowStep, newMetadata?: Record<string, unknown>) => {
        try {
          // Update local state first
          set((state) => ({
            ...state,
            workflow: {
              ...state.workflow,
              currentStep: newStep,
              metadata: { ...state.workflow.metadata, ...newMetadata }
            }
          }));
          
          // If workflowStateManager is available, use it to update the workflow
          if (get().workflowStateManager) {
            await get().workflowStateManager.updateWorkflowState(newStep, newMetadata);
          }
        } catch (error) {
          const normalizedError = normalizeError(error);
          set(state => ({
            ...state,
            error: normalizedError.message
          }));
        }
      },

      updateProgress: (progress, phase) => 
        set((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            progress,
            phase: phase ?? state.workflow.phase,
          },
        })),

      setWorkflowManager: (manager) => set({ workflowStateManager: manager }),

      syncWorkflowState: (workflowState) =>
        set((state) => ({
          ...state,
          workflow: {
            currentStep: workflowState.currentStep,
            progress: workflowState.progress,
            phase: workflowState.phase || ProcessingPhase.INITIALIZATION,
            error: workflowState.error,
            metadata: {
              ...(state.workflow.metadata || {}),
              ...(workflowState.metadata || {})
            },
            timestamp: workflowState.timestamp
          }
        })),

      subscribeToWorkflowUpdates: (callback: (state: WorkflowState) => void) => {
        const state = get();
        const workflowId = state.workflowStateManager.getCurrentWorkflowId();
        
        if (!workflowId) return () => {};
        
        const unsubscribeFromWorkflow = workflowService.subscribeToWorkflowChanges(
          workflowId,
          (payload: { new: { current_step: string; metadata: unknown; }; old: unknown; }) => {
            // Transform the payload into a WorkflowState
            const workflowState: WorkflowState = {
              currentStep: payload.new.current_step as WorkflowStep,
              progress: (payload.new.metadata as any)?.progress || 0,
              phase: (payload.new.metadata as any)?.phase || ProcessingPhase.INITIALIZATION,
              error: (payload.new.metadata as any)?.error || null,
              metadata: payload.new.metadata as Record<string, unknown> || {},
              timestamp: new Date().toISOString()
            };
            
            // Call the callback with the transformed state
            callback(workflowState);
          }
        );
        
        return unsubscribeFromWorkflow;
      },

      // Verification methods
      startVerification: async (content, options) => {
        try {
          // Update mode and state
          set(state => ({
            ...state,
            mode: "verification",
            verification: {
              ...state.verification,
              isInVerificationMode: true,
              verificationStatus: VerificationStatus.pending,
              verificationItems: options?.items || [],
              currentSummary: content
            },
            isLoading: true
          }));

          const workflowId = get().workflowStateManager.getCurrentWorkflowId() || get().workflowId;
          
          if (!workflowId) {
            throw new VerificationError({
              message: 'No workflow ID available to start verification',
              code: 'VERIFICATION_START_ERROR'
            });
          }
          
          // Log verification start
          const moduleLogger = logger.withMetadata({
            module: 'ChatStore',
            method: 'startVerification',
            workflowId
          });
          moduleLogger.info('Starting verification process');
          
          // Add the summary as a message
          get().postSummaryMessage(content);
          
          // Add a system message asking for verification
          get().addSystemMessage(
            "Please review this summary and type 'confirm' to approve or provide corrections.", 
            ChatMessageType.VERIFICATION
          );
          
          set(state => ({ ...state, isLoading: false }));
        } catch (error) {
          const normalizedError = normalizeError(error);
          set(state => ({
            ...state, 
            isLoading: false,
            error: normalizedError.message
          }));
          throw normalizedError;
        }
      },
      
      submitCorrection: (correction) => {
        try {
          // Add a user message with the correction
          get().addMessage({
            role: 'user',
            content: correction,
            createdAt: new Date().toISOString(),
            type: ChatMessageType.CHAT,
            metadata: {
              type: ChatMessageType.CHAT,
              isCorrection: true
            }
          });
          
          // Get the current summary
          const currentSummary = get().verification.currentSummary;
          
          if (!currentSummary) {
            throw new VerificationError({
              message: 'No summary available to correct',
              code: 'CORRECTION_ERROR'
            });
          }
          
          // Process the correction asynchronously
          // We don't await here because this is a sync function
          // The actual processing is handled in handleCorrectionMessage
          setTimeout(() => {
            get().handleCorrectionMessage(correction)
              .catch(error => {
                const normalizedError = normalizeError(error);
                set(state => ({ 
                  ...state, 
                  error: normalizedError.message 
                }));
              });
          }, 0);
        } catch (error) {
          const normalizedError = normalizeError(error);
          set(state => ({ 
            ...state, 
            error: normalizedError.message 
          }));
        }
      },
      
      completeVerification: async (isApproved) => {
        try {
          // Update verification status
          set(state => ({
            ...state,
            verification: {
              ...state.verification,
              verificationStatus: isApproved ? VerificationStatus.completed : VerificationStatus.failed
            },
            isLoading: true
          }));
          
          const workflowId = get().workflowStateManager.getCurrentWorkflowId() || get().workflowId;
          
          if (!workflowId) {
            return createFallbackVerificationResult(get());
          }
          
          // Log verification completion
          const moduleLogger = logger.withMetadata({
            module: 'ChatStore',
            method: 'completeVerification',
            workflowId,
            isApproved
          });
          moduleLogger.info('Completing verification');
          
          let result;
          // Use workflow state manager if available
          if (get().workflowStateManager?.completeVerification) {
            result = await get().workflowStateManager.completeVerification!(
              isApproved,
              { 
                items: get().verification.verificationItems,
                comments: isApproved ? "Approved" : "Rejected"
              }
            );
          } else {
            // Fall back to direct service call
            result = await verificationService.completeVerification(
              workflowId,
              isApproved,
              { 
                items: get().verification.verificationItems,
                comments: isApproved ? "Approved" : "Rejected"
              }
            );
          }
          
          // Update store state
          set(state => ({
            ...state,
            isLoading: false,
            mode: isApproved ? "default" : "verification"
          }));
          
          // Add a completion message
          get().addSystemMessage(
            isApproved 
              ? "Verification completed successfully. Proceeding to the next step." 
              : "Verification rejected. Please make necessary corrections.",
            isApproved ? ChatMessageType.SYSTEM : ChatMessageType.ERROR
          );
          
          return result.data || createFallbackVerificationResult(get());
        } catch (error) {
          const normalizedError = normalizeError(error);
          
          set(state => ({
            ...state,
            isLoading: false,
            error: normalizedError.message
          }));
          
          // Add an error message
          get().addSystemMessage(
            `Error completing verification: ${normalizedError.message}`,
            ChatMessageType.ERROR
          );
          
          return createFallbackVerificationResult(get());
        }
      },
      
      handleCorrectionMessage: async (correction) => {
        try {
          // Add a processing message
          const progressId = crypto.randomUUID();
          get().addMessage({
            id: progressId,
            role: 'system',
            content: 'Processing your correction...',
            createdAt: new Date().toISOString(),
            type: ChatMessageType.PROGRESS,
            metadata: {
              type: ChatMessageType.PROGRESS,
              progress: {
                value: 0,
                phase: ProcessingPhase.CORRECTION,
              }
            }
          });
          
          const currentSummary = get().verification.currentSummary;
          
          if (!currentSummary) {
            throw new VerificationError({
              message: 'No summary available to correct',
              code: 'CORRECTION_ERROR'
            });
          }
          
          // Update progress
          get().updateMessageProgress(progressId, 30, 'correction');
          
          // Call processCorrection to handle the actual correction
          const result = await get().processCorrection(correction, currentSummary, progressId);
          
          // Update progress
          get().updateMessageProgress(progressId, 100, 'correction_completed');
          
          // Add a message asking for confirmation
          get().addSystemMessage(
            "I've updated the summary based on your correction. Please review it and type 'confirm' to approve or provide additional corrections.",
            ChatMessageType.VERIFICATION
          );
          
          return result;
        } catch (error) {
          const normalizedError = normalizeError(error);
          set(state => ({ 
            ...state, 
            error: normalizedError.message 
          }));
          
          // Add an error message
          get().addSystemMessage(
            `Error processing correction: ${normalizedError.message}. Please try again.`,
            ChatMessageType.ERROR
          );
          
          throw normalizedError;
        }
      },
      
      confirmVerification: async () => {
        try {
          // Add a processing message
          const progressId = crypto.randomUUID();
          get().addMessage({
            id: progressId,
            role: 'system',
            content: 'Processing verification confirmation...',
            createdAt: new Date().toISOString(),
            type: ChatMessageType.PROGRESS,
            metadata: {
              type: ChatMessageType.PROGRESS,
              progress: {
                value: 0,
                phase: ProcessingPhase.VERIFICATION,
              }
            }
          });
          
          // Update progress
          get().updateMessageProgress(progressId, 50, 'verification_confirmation');
          
          // Complete the verification as approved
          const result = await get().completeVerification(true);
          
          // Update progress
          get().updateMessageProgress(progressId, 100, 'verification_completed');
          
          return result;
        } catch (error) {
          const normalizedError = normalizeError(error);
          
          set(state => ({
            ...state,
            error: normalizedError.message
          }));
          
          // Add an error message
          get().addSystemMessage(
            `Error confirming verification: ${normalizedError.message}`,
            ChatMessageType.ERROR
          );
          
          return createFallbackVerificationResult(get());
        }
      },
      
      initiateVerification: async (extractedDocument, messageId) => {
        try {
          // Update state to indicate verification is starting
          set(state => ({
            ...state,
            mode: "verification",
            verification: {
              ...state.verification,
              isInVerificationMode: true,
              verificationStatus: VerificationStatus.pending
            },
            isLoading: true
          }));

          // Get the current workflow ID or fall back to the one in state
          const workflowId = get().workflowStateManager.getCurrentWorkflowId() || get().workflowId;
          
          if (!workflowId) {
            throw new VerificationError({
              message: 'No workflow ID available to initiate verification',
              code: 'VERIFICATION_INITIALIZATION_ERROR'
            });
          }
          
          // Log verification initiation
          const moduleLogger = logger.withMetadata({
            module: 'ChatStore',
            method: 'initiateVerification',
            workflowId
          });
          moduleLogger.info('Initiating verification process');

          let result;
          // Check if we have a workflowStateManager with initiateVerification method
          if (get().workflowStateManager?.initiateVerification) {
            // Use the workflow state manager to initiate verification
            result = await get().workflowStateManager?.initiateVerification!(
              extractedDocument,
              messageId
            );
          } else {
            // Fallback to direct service call if no manager
            result = await verificationService.generateVerification({
              document: extractedDocument,
              workflowId,
              messageId,
              summaryId: crypto.randomUUID()
            });
          }

          // Set the extracted document in state
          set(state => ({
            ...state,
            extractedDocument,
            isLoading: false,
            verification: {
              ...state.verification,
              currentSummary: result?.summary || null,
              verificationStatus: VerificationStatus.inProgress,
              summaryVersions: [
                ...state.verification.summaryVersions,
                {
                  id: result?.summaryId || crypto.randomUUID(),
                  content: result?.summary || '',
                  timestamp: new Date().toISOString(),
                }
              ]
            }
          }));

          // Return the verification result
          return result || {};
        } catch (error) {
          const normalizedError = normalizeError(error);
          
          // Log the error
          logger.error('Failed to initiate verification', {
            module: 'ChatStore',
            method: 'initiateVerification'
          }, normalizedError);
          
          // Update store with error state
          set(state => ({
            ...state,
            isLoading: false,
            error: normalizedError.message || 'Failed to initiate verification',
            verification: {
              ...state.verification,
              verificationStatus: VerificationStatus.failed
            }
          }));
          
          // Re-throw the error for handling upstream
          throw normalizedError;
        }
      },
      
      processCorrection: async (correctionText, currentSummary, messageId) => {
        try {
          // Update state to indicate correction is being processed
          set(state => ({
            ...state,
            isLoading: true,
            verification: {
              ...state.verification,
              verificationStatus: VerificationStatus.inProgress
            }
          }));

          // Get the current workflow ID
          const workflowId = get().workflowStateManager.getCurrentWorkflowId() || get().workflowId;
          
          if (!workflowId) {
            throw new VerificationError({
              message: 'No workflow ID available to process correction',
              code: 'CORRECTION_PROCESSING_ERROR'
            });
          }
          
          // Log correction processing
          const moduleLogger = logger.withMetadata({
            module: 'ChatStore',
            method: 'processCorrection',
            workflowId
          });
          moduleLogger.info('Processing correction', {
            correctionLength: correctionText.length
          });

          let result;
          // Check if we have a workflowStateManager with processCorrection method
          if (get().workflowStateManager?.processCorrection) {
            // Use the workflow state manager to process the correction
            result = await get().workflowStateManager?.processCorrection!(
              correctionText,
              currentSummary,
              messageId
            );
          } else {
            // Fallback to direct service call
            result = await correctionService.processCorrection({
              correction: correctionText,
              currentSummary,
              workflowId,
              messageId
            });
          }

          // If successful, update the summary in the state
          if (result && result.success !== false) {
            const newSummary = result.summary || '';
            const summaryId = result.summaryId || crypto.randomUUID();
            
            // Update the verification state with the new summary
            set(state => ({
              ...state,
              isLoading: false,
              verification: {
                ...state.verification,
                currentSummary: newSummary,
                verificationStatus: VerificationStatus.inProgress,
                summaryVersions: [
                  ...state.verification.summaryVersions,
                  {
                    id: summaryId,
                    content: newSummary,
                    timestamp: new Date().toISOString()
                  }
                ]
              }
            }));
            
            // Post the updated summary as a message
            get().updateSummaryAfterCorrection(newSummary);
          }

          // Return the correction result
          return result || {};
        } catch (error) {
          const normalizedError = normalizeError(error);
          
          // Log the error
          logger.error('Failed to process correction', {
            module: 'ChatStore',
            method: 'processCorrection'
          }, normalizedError);
          
          // Update store with error state
          set(state => ({
            ...state,
            isLoading: false,
            error: normalizedError.message || 'Failed to process correction'
          }));
          
          // Re-throw the error for handling upstream
          throw normalizedError;
        }
      },
      
      resetVerification: async () => {
        try {
          // Update state to reset verification
          set(state => ({
            ...state,
            verification: {
              isInVerificationMode: false,
              currentSummary: null,
              verificationStatus: VerificationStatus.pending,
              verificationItems: [],
              summaryVersions: []
            }
          }));

          // Check if we should reset the workflow as well
          const workflowId = get().workflowStateManager.getCurrentWorkflowId();
          if (workflowId && get().workflowStateManager.resetWorkflow) {
            await get().workflowStateManager.resetWorkflow();
          }

          return { success: true };
        } catch (error) {
          const normalizedError = normalizeError(error);
          
          // Log the error
          logger.error('Failed to reset verification', {
            module: 'ChatStore',
            method: 'resetVerification'
          }, normalizedError);
          
          // Update store with error state but still leave verification reset
          set(state => ({
            ...state,
            error: normalizedError.message || 'Failed to reset verification workflow'
          }));
          
          return { success: false, error: normalizedError.message };
        }
      },
      
      // Report generation methods
      startReportGeneration: (reportOptions) => {
        // Update the state to indicate that report generation is starting
        set(state => ({
          ...state,
          mode: "default", // Not switching to a special mode for reports
          reportGeneration: {
            isComplete: false,
            format: reportOptions?.format as Record<string, unknown> || { type: 'markdown' } as Record<string, unknown>,
            reportId: undefined
          }
        }));

        // Add a system message
        get().addSystemMessage(
          'Report generation has started. You can specify a format like PDF, HTML, or Markdown.',
          ChatMessageType.SYSTEM
        );
      },
      
      completeReportGeneration: (report) => {
        // Update the state to mark report generation as complete
        set(state => ({
          ...state,
          reportGeneration: {
            isComplete: true,
            format: report.format as Record<string, unknown> || state.reportGeneration?.format || { type: 'markdown' } as Record<string, unknown>,
            reportId: report.id as string || state.reportGeneration?.reportId
          }
        }));

        // If we don't already have a report in the messages, add it
        const reportExists = get().messages.some(msg => 
          msg.metadata?.isReport && msg.metadata?.reportId === report.id
        );

        if (!reportExists && report.content) {
          get().addMessage({
            role: 'assistant',
            content: report.content as string,
            createdAt: new Date().toISOString(),
            type: ChatMessageType.REPORT,
            metadata: {
              type: ChatMessageType.REPORT,
              isReport: true,
              reportId: report.id as string,
              format: (report.format as Record<string, unknown>)?.type as string || 'markdown'
            }
          });
        }
      },
      
      generateReport: async (): Promise<void> => {
        try {
          // Add a message to show generation is in progress
          const progressId = crypto.randomUUID();
          get().addMessage({
            id: progressId,
            role: 'system',
            content: 'Generating report...',
            createdAt: new Date().toISOString(),
            type: ChatMessageType.PROGRESS,
            metadata: {
              type: ChatMessageType.PROGRESS,
              progress: {
                value: 0,
                phase: ProcessingPhase.REPORT_GENERATION
              }
            }
          });

          // Update state to indicate report generation is in progress
          set(state => ({
            ...state,
            isLoading: true
          }));

          // Get the current workflow ID
          const workflowId = get().workflowStateManager.getCurrentWorkflowId() || get().workflowId;
          
          if (!workflowId) {
            throw new ApplicationError({
              message: 'No workflow ID available to generate report',
              code: 'REPORT_GENERATION_ERROR'
            });
          }

          // Get patient ID and format from state
          const patientId = get().workflow.metadata?.patientId as string || '';
          const format = (get().reportGeneration?.format?.type as string) || 'markdown';
          
          // Define the update progress function
          const updateProgress = (progress: number) => {
            get().updateMessageProgress(progressId, progress, ProcessingPhase.REPORT_GENERATION);
          };
          
          // Begin with 20% progress
          updateProgress(20);

          // Get the research result from state
          const researchResult = get().research.result;
          
          if (!researchResult) {
            throw new ApplicationError({
              message: 'No research result available for report generation',
              code: 'MISSING_RESEARCH_RESULT'
            });
          }

          // Call the report service through workflow mediator or directly
          let reportData: { report: { id: string } } | { success: boolean };
          if (get().workflowStateManager?.beginReportGeneration) {
            // This is a simplified call - the actual implementation would depend on the workflow manager
            reportData = await get().workflowStateManager.beginReportGeneration!({
              format: { type: format }
            });
          } else {
            // Direct call to report service
            reportData = await reportService.generateMedicalDiagnosisReport(
              researchResult,
              patientId,
              {
                onProgress: (phase: string, progress: number) => {
                  updateProgress(progress);
                },
                contextData: {
                  patientId,
                  format
                },
                saveToDatabase: true
              }
            );
          }

          // Update progress to 90%
          updateProgress(90);

          // Update the store with the report data
          set(state => ({
            ...state,
            reportGeneration: {
              isComplete: false,
              format: { type: format } as Record<string, unknown>,
              reportId: 'report' in reportData ? reportData.report.id : undefined
            },
            isLoading: false
          }));

          // Complete the progress
          updateProgress(100);

          // Update progress message to complete
          get().addSystemMessage(
            'Report generated successfully. You can now format it as needed.',
            ChatMessageType.SYSTEM
          );

        } catch (error) {
          const normalizedError = normalizeError(error);
          
          // Log the error
          logger.error('Failed to generate report', {
            module: 'ChatStore',
            method: 'generateReport'
          }, normalizedError);
          
          // Update state with error
          set(state => ({
            ...state,
            isLoading: false,
            error: normalizedError.message
          }));
          
          // Add an error message
          get().addSystemMessage(
            `Failed to generate report: ${normalizedError.message}`,
            ChatMessageType.ERROR
          );
        }
      },
      
      formatReport: async (format: Record<string, unknown>): Promise<void> => {
        try {
          // Add a message to show formatting is in progress
          const progressId = crypto.randomUUID();
          get().addMessage({
            id: progressId,
            role: 'system',
            content: `Formatting report to ${format.type || 'requested format'}...`,
            createdAt: new Date().toISOString(),
            type: ChatMessageType.PROGRESS,
            metadata: {
              type: ChatMessageType.PROGRESS,
              progress: {
                value: 0,
                phase: ProcessingPhase.REPORT_FORMATTING
              }
            }
          });

          // Update state to indicate report formatting is in progress
          set((state: ChatStore) => ({
            ...state,
            isLoading: true,
            reportGeneration: {
              ...state.reportGeneration!,
              format
            }
          }));

          // Get the report ID from state
          const reportId = get().reportGeneration?.reportId;
          
          if (!reportId) {
            throw new ApplicationError({
              message: 'No report ID available to format report',
              code: 'REPORT_FORMATTING_ERROR'
            });
          }

          // Format the report
          const formatType = format.type as string || 'markdown';
          let formattedContent: string;

          // Update progress to 50%
          get().updateMessageProgress(progressId, 50, ProcessingPhase.REPORT_FORMATTING);

          // Get report data either from store or by querying the service
          const reportData = get().workflow.metadata?.reportData as Record<string, unknown> || null;
          
          if (reportData) {
            // Use the report service to format the report
            formattedContent = await reportService.formatReportOutput(
              reportData as any,
              formatType
            );
          } else {
            // If we don't have the report data, we need to fetch it first
            // This is a simplified example - actual implementation would depend on your API
            const report = await reportService.formatReportOutput(
              { report: { id: reportId } } as any,
              formatType
            );
            formattedContent = report;
          }

          // Update progress to 100%
          get().updateMessageProgress(progressId, 100, ProcessingPhase.REPORT_FORMATTING);

          // Add the formatted report as a message
          get().addMessage({
            role: 'assistant',
            content: formattedContent,
            createdAt: new Date().toISOString(),
            type: ChatMessageType.REPORT,
            metadata: {
              type: ChatMessageType.REPORT,
              isReport: true,
              reportId,
              format: formatType
            }
          });

          // Mark report generation as complete
          set(state => ({
            ...state,
            isLoading: false,
            reportGeneration: {
              isComplete: true,
              format,
              reportId
            }
          }));

          // Add completion message
          get().addSystemMessage(
            'Report formatting complete.',
            ChatMessageType.SYSTEM
          );

        } catch (error) {
          const normalizedError = normalizeError(error);
          
          // Log the error
          logger.error('Failed to format report', {
            module: 'ChatStore',
            method: 'formatReport',
            formatType: format.type
          }, normalizedError);
          
          // Update state with error
          set(state => ({
            ...state,
            isLoading: false,
            error: normalizedError.message
          }));
          
          // Add an error message
          get().addSystemMessage(
            `Failed to format report: ${normalizedError.message}`,
            ChatMessageType.ERROR
          );
        }
      },
      
      // Document processing methods
      processDocument: async (file, patientId, documentType, abortSignal) => {
        const store = get();
        
        try {
          // Initialize processing state
          store.setLoading(true);
          set({ 
            isDocProcessing: true, 
            docProgress: 0,
            extractedDocument: null 
          });
          
          // Add initial system message
          store.addSystemMessage(
            `Processing document: ${file.name}`,
            ChatMessageType.SYSTEM,
            { 
              isProgress: true,
              documentName: file.name,
              fileSize: file.size,
              documentType 
            }
          );
          
          // Subscribe to document processing events
          const unsubDocumentStatus = eventService.subscribe(
            EVENT_TYPES.DOCUMENT_STATUS,
            (payload: DocumentStatusEventPayload) => {
              // Update progress state
              set({ docProgress: payload.status.progress || 0 });
              
              // Update message progress if we have a processing message
              const processingMessages = store.messages.filter(
                (m) => m.metadata?.isProgress && !m.metadata.isCompleted
              );
              
              if (processingMessages.length > 0) {
                const lastProcessingMessage = processingMessages[processingMessages.length - 1];
                store.updateMessageProgress(
                  lastProcessingMessage.id,
                  payload.status.progress || 0,
                  payload.status.phase || 'processing'
                );
              }
            }
          );
          
          // Subscribe to document processed events
          const unsubDocumentProcessed = eventService.subscribe(
            EVENT_TYPES.DOCUMENT_PROCESSED,
            (payload: DocumentProcessedEventPayload) => {
              // Store extracted document
              set({ 
                extractedDocument: payload.document,
                docProgress: 100,
                isDocProcessing: false
              });
              
              // Add completion message
              store.addSystemMessage(
                `Document processed successfully: ${payload.document.fileName}`,
                ChatMessageType.SYSTEM,
                { 
                  isProgress: true,
                  isCompleted: true,
                  documentId: payload.documentId,
                  documentName: payload.document.fileName,
                  documentType: payload.document.documentType
                }
              );
              
              // Clean up subscriptions
              unsubDocumentStatus();
              unsubDocumentProcessed();
            }
          );
          
          // Ensure we have a workflow ID
          const { chatId } = store;
          let currentWorkflowId = store.workflowId;
          
          if (!currentWorkflowId && store.workflowStateManager) {
            // Get workflow ID from the manager or create a new one
            currentWorkflowId = store.workflowStateManager.getCurrentWorkflowId() || undefined;
            
            if (!currentWorkflowId && chatId) {
              // Create new workflow - this would typically be handled by the workflow hook
              // but we accommodate the case where we don't have a workflow yet
              await store.workflowStateManager.updateWorkflowState('idle', {
                initiatedAt: new Date().toISOString(),
                patientId
              });
              
              currentWorkflowId = store.workflowStateManager.getCurrentWorkflowId() || undefined;
            }
            
            if (!currentWorkflowId) {
              throw new Error('Unable to create workflow for document processing');
            }
            
            // Update store with new workflow ID
            set({ workflowId: currentWorkflowId });
          }
          
          if (!currentWorkflowId) {
            throw new Error('No workflow ID available for document processing');
          }
          
          // Call workflow mediator to process document
          const documentId = await workflowMediator.initiateDocumentProcessing(
            currentWorkflowId,
            file,
            patientId,
            { documentType, abortSignal }
          );
          
          // Return document data
          return store.extractedDocument || { id: documentId };
          
        } catch (error) {
          // Handle errors
          set({ isDocProcessing: false });
          
          // Add error message
          store.addSystemMessage(
            `Error processing document: ${error instanceof Error ? error.message : String(error)}`,
            ChatMessageType.ERROR,
            { isError: true }
          );
          
          // Log error
          console.error('Document processing error:', error);
          
          // Set error in store
          store.setError(`Document processing failed: ${error instanceof Error ? error.message : String(error)}`);
          
          // Return error object
          return { 
            error: error instanceof Error ? error.message : String(error),
            success: false
          };
          
        } finally {
          // Clean up
          store.setLoading(false);
        }
      },
      
      uploadDocument: async (file, patientId, documentType) => {
        const store = get();
        
        try {
          // Check for file validity
          if (!file || !(file instanceof File)) {
            throw new Error('Invalid file provided for upload');
          }
          
          // Check for patient ID
          if (!patientId) {
            throw new Error('Patient ID is required for document upload');
          }
          
          // Reset any previous document processing state
          store.resetDocumentProcessing();
          
          // Add a message indicating upload is starting
          store.addSystemMessage(
            `Uploading and processing document: ${file.name}`,
            ChatMessageType.SYSTEM,
            {
              isUpload: true,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              documentType,
              patientId
            }
          );
          
          // Process the document
          const result = await store.processDocument(file, patientId, documentType);
          
          // If processing was successful and we have a document, automatically start verification
          if (result && !result.error && store.extractedDocument && store.workflowStateManager?.initiateVerification) {
            // Start verification process if needed
            const verificationResult = await store.initiateVerification(store.extractedDocument);
            
            // Return combined results
            return {
              ...result,
              verificationInitiated: true,
              verificationResult
            };
          }
          
          // Return the processing result
          return result;
          
        } catch (error) {
          // Log the error
          console.error('Document upload error:', error);
          
          // Set error state
          store.setError(`Document upload failed: ${error instanceof Error ? error.message : String(error)}`);
          
          // Add error message to chat
          store.addSystemMessage(
            `Document upload failed: ${error instanceof Error ? error.message : String(error)}`,
            ChatMessageType.ERROR,
            { isError: true }
          );
          
          // Return error result
          return {
            error: error instanceof Error ? error.message : String(error),
            success: false
          };
        }
      },
      
      resetDocumentProcessing: () => {
        // Reset document processing state
        set({
          isDocProcessing: false,
          docProgress: 0,
          extractedDocument: null
        });
      },
      
      // Message sending
      sendMessage: async (content, options = {}) => {
        const store = get();
        const { isCorrection = false, metadata = {} } = options;
        
        try {
          // Don't allow empty messages
          if (!content || content.trim() === '') {
            return;
          }
          
          // Get current workflow and verification state
          const { 
            mode, 
            verification, 
            workflowStateManager, 
            messages
          } = store;
          
          // Add the user message to the chat
          const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content,
            createdAt: new Date().toISOString(),
            type: ChatMessageType.CHAT,
            metadata: {
              type: ChatMessageType.CHAT,
              isCorrection,
              ...metadata
            }
          };
          
          store.addMessage(userMessage);
          
          // Handle message differently based on mode
          switch (mode) {
            case 'verification': {
              // In verification mode, handle corrections
              if (isCorrection && verification.isInVerificationMode && verification.currentSummary) {
                // Add a system message indicating processing of correction
                store.addSystemMessage(
                  'Processing your correction...',
                  ChatMessageType.SYSTEM,
                  { isProgress: true }
                );
                
                // Process the correction
                if (workflowStateManager?.processCorrection) {
                  const result = await store.handleCorrectionMessage(content);
                  
                  // Add processing completion message
                  store.addSystemMessage(
                    'Correction processed successfully.',
                    ChatMessageType.SYSTEM,
                    { 
                      isProgress: true, 
                      isCompleted: true,
                      correctionResult: result 
                    }
                  );
                }
              } else {
                // Not a correction, handle as regular message in verification mode
                // This could trigger a verification confirmation, response, etc.
                store.addSystemMessage(
                  'In verification mode. Please use the verification controls to approve or reject the summary, or provide specific corrections.',
                  ChatMessageType.SYSTEM
                );
              }
              break;
            }
              
            case 'research': {
              // In research mode, trigger research workflow
              if (store.research.isActive) {
                store.addSystemMessage(
                  'Research is already in progress. Please wait for it to complete.',
                  ChatMessageType.SYSTEM
                );
              } else {
                // Start research with the message content as the query
                await store.performResearch(content);
              }
              break;
            }
              
            case 'default':
            default: {
              // Default chat behavior - simply acknowledge the message
              // In a real implementation, this would likely call an AI service
              
              // Update workflow state if needed
              if (workflowStateManager?.updateWorkflowState) {
                await workflowStateManager.updateWorkflowState('chat_in_progress', {
                  lastMessageAt: new Date().toISOString(),
                  lastMessage: content.substring(0, 100) + (content.length > 100 ? '...' : '')
                });
              }
              
              // Add assistant response
              store.addMessage({
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `I received your message: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
                createdAt: new Date().toISOString(),
                type: ChatMessageType.CHAT,
                metadata: {
                  type: ChatMessageType.CHAT
                }
              });
            }
          }
          
        } catch (error) {
          // Handle errors
          console.error('Error sending message:', error);
          
          // Set error in store
          store.setError(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
          
          // Add error message
          store.addSystemMessage(
            `Error: ${error instanceof Error ? error.message : String(error)}`,
            ChatMessageType.ERROR,
            { isError: true }
          );
        }
      },
      
      subscribeToEvents: () => {
        // Return a placeholder unsubscribe function
        return () => {};
      },
      
      // Helper methods
      addSystemMessage: (content, type, metadata) => {
        const messageType = type ? (type as ChatMessageType) : ChatMessageType.SYSTEM;
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          role: "system",
          content,
          createdAt: new Date().toISOString(),
          type: messageType,
          metadata: metadata ? { type: messageType, ...metadata } : { type: messageType },
        };
        get().addMessage(message);
        return message;
      },
      
      postSummaryMessage: (summary) => {
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: summary,
          createdAt: new Date().toISOString(),
          type: ChatMessageType.SUMMARY,
          metadata: {
            type: ChatMessageType.SUMMARY
          }
        };
        get().addMessage(message);
        return message;
      },
      
      updateSummaryAfterCorrection: (newSummary) => {
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant", 
          content: newSummary,
          createdAt: new Date().toISOString(),
          type: ChatMessageType.SUMMARY,
          metadata: {
            type: ChatMessageType.SUMMARY
          }
        };
        get().addMessage(message);
        return message;
      },
      
      clearMessages: () => {
        get().resetChat();
      },
      
      // Research methods
      performResearch: async (query: string, options?: ResearchOptions): Promise<ResearchResult> => {
        try {
          // Update state to indicate research is in progress
          set(state => ({
            ...state,
            mode: "research",
            research: {
              ...state.research,
              isActive: true,
              query,
              progress: 0
            },
            isLoading: true
          }));

          // Log the start of research
          const moduleLogger = logger.withMetadata({
            module: 'ChatStore',
            method: 'performResearch',
            query
          });
          moduleLogger.info('Starting research query');

          // Create a progress callback
          const onProgress = (progress: number) => {
            set(state => ({
              ...state,
              research: {
                ...state.research,
                progress
              }
            }));
          };

          // Merge options with progress callback
          const researchOptions: ResearchOptions = {
            ...options,
            onProgress
          };

          // Determine if this is a medical diagnosis
          const isMedicalDiagnosis = options?.isMedicalDiagnosis === true;
          const patientData = options?.patientData;

          // Call the appropriate perplexity service method
          let result: ResearchResult;
          if (isMedicalDiagnosis && patientData) {
            result = await perplexityService.performMedicalDiagnosis(
              query,
              patientData,
              researchOptions
            );
          } else {
            result = await perplexityService.performDeepResearch(
              query,
              researchOptions
            );
          }

          // Update store with the result
          set(state => ({
            ...state,
            research: {
              ...state.research,
              result,
              progress: 100,
              isActive: false
            },
            isLoading: false
          }));

          // Add a research result message
          get().addMessage({
            role: 'assistant',
            content: result.summary || result.text,
            createdAt: new Date().toISOString(),
            type: ChatMessageType.RESEARCH,
            metadata: {
              type: ChatMessageType.RESEARCH,
              isResearchResult: true,
              query,
              keyFindings: result.keyFindings,
              sources: result.sources
            }
          });

          return result;
        } catch (error) {
          // Handle errors
          const normalizedError = normalizeError(error);
          
          // Log the error
          logger.error('Research failed', {
            module: 'ChatStore',
            method: 'performResearch',
            query
          }, normalizedError);
          
          // Update state to reflect the error
          set(state => ({
            ...state,
            research: {
              ...state.research,
              isActive: false,
              progress: 0
            },
            isLoading: false,
            error: normalizedError.message
          }));
          
          // Add an error message
          get().addSystemMessage(
            `Research failed: ${normalizedError.message}`,
            ChatMessageType.ERROR
          );
          
          throw normalizedError;
        }
      }
    }),
    { name: "chat-store" }
  )
);

export function ChatProvider({ children }: { readonly children: ReactNode }) {
  return children;
}

export function useChatState(): ChatStore {
  return useChatStore();
}