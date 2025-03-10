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
import { EVENT_TYPES } from "@/lib/types/events";

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
import { normalizeError } from "@/lib/errors";
import {
  VerificationError,
  DocumentProcessingError,
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
            type: ChatMessageType.CORRECTION,
            metadata: {
              type: ChatMessageType.CORRECTION,
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
        // Implement this method
      },
      
      completeReportGeneration: (report) => {
        // Implement this method
      },
      
      generateReport: async () => {
        // Implement this method
      },
      
      formatReport: async (format) => {
        // Implement this method
      },
      
      beginReportGeneration: async (reportMetadata) => {
        // Return a placeholder implementation
        return { success: false };
      },
      
      // Document processing methods
      processDocument: async (file, patientId, documentType, abortSignal) => {
        // Return a placeholder implementation
        return {};
      },
      
      uploadDocument: async (file, patientId, documentType) => {
        // Return a placeholder implementation
        return {};
      },
      
      resetDocumentProcessing: () => {
        // Implement this method
      },
      
      // Message sending
      sendMessage: async (content, options) => {
        // Implement this method
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
      performResearch: async (query, options) => {
        try {
          // Placeholder implementation
          return { 
            query,
            text: "Research result placeholder",
            sources: []
          };
        } catch (error) {
          throw error;
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