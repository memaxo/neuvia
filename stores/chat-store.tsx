"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createContext, type ReactNode, type Dispatch } from "react";

// Import proper types from the application's type files
import {
  ChatMessageType,
  type ChatMessage,
  type ChatMessageMetadata
} from "@/lib/types/chat";
import type {
  WorkflowStep,
  WorkflowState as WorkflowStateType,
  ProcessingStatus as WorkflowProcessingStatus,
  MessageMetadata
} from "@/lib/types/workflow";
import { DomainOnlyWorkflowStep, ProcessingPhase } from "@/lib/types/workflow";
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
import type { ReportType, ReportStatus, ReportFormat, ReportOptions , ReportData, ReportDocument, ReportSections } from "@/lib/types/report";
import type { ResearchOptions, ResearchResult } from "@/lib/types/research";

// Import services
import { ApiClient } from "@/lib/api/client/api-client";
import { verificationService } from "@/lib/services/verification/verification-service";
import { documentService } from "@/lib/services/document";
import { reportService } from "@/lib/services/report/report-service";
import { perplexityService } from "@/lib/services/perplexity/perplexity-service";
import { workflowService } from "@/lib/services/workflow/workflow-service";
import { chatService } from "@/lib/services/chat/chat-service";

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

// Workflow state manager interface for integration with useWorkflow hook
interface WorkflowStateManager {
  getCurrentWorkflowId: () => string | null;
  getCurrentChatId: () => string | null;
  resetWorkflow: () => Promise<void>;
  updateWorkflowState: (step: WorkflowStep, metadata?: Record<string, unknown>) => Promise<void>;
  initiateVerification?: (extractedDocument: any, messageId?: string) => Promise<any>;
  processCorrection?: (correctionText: string, currentSummary: string, messageId?: string) => Promise<any>;
  completeVerification?: (isApproved: boolean) => Promise<VerificationResult>;
  beginReportGeneration?: (reportMetadata?: Record<string, unknown>) => Promise<{ success: boolean }>;
}

// Default workflow state manager implementation
const defaultWorkflowStateManager: WorkflowStateManager = {
  getCurrentWorkflowId: () => null,
  getCurrentChatId: () => null,
  resetWorkflow: async () => {},
  updateWorkflowState: async (_step: WorkflowStep, _metadata?: Record<string, unknown>) => {}
};

export type ChatMode = "default" | "verification" | "research";

export type ProcessingStatusType = "idle" | "processing" | "success" | "error";

interface ProcessingStatus {
  status: ProcessingStatusType;
  progress: number;
  phase: ProcessingPhase;
  currentStep?: string;
  error?: string;
}

export interface VerificationOptions {
  items?: VerificationItem[];
  comments?: string;
}

// Improved workflow state interface
interface WorkflowState {
  currentStep: WorkflowStep;
  processingStatus: ProcessingStatus;
  workflowError: string | null;
  data: Record<string, unknown>;
}

// Improved verification state interface
interface VerificationState {
  isInVerificationMode: boolean;
  currentSummary: string | null;
  verificationStatus: VerificationStatus | string;
  verificationItems: VerificationItem[];
  summaryVersions: Array<{
    id: string;
    content: string;
    timestamp: string;
    userId?: string;
  }>;
}

// Research state interface
interface ResearchState {
  query: string | null;
  result: ResearchResult | null;
  isActive: boolean;
  progress: number;
}

// Initial workflow state
const initialWorkflowState: WorkflowState = {
  currentStep: "idle" as WorkflowStep,
  processingStatus: {
    status: "idle" as const,
    progress: 0,
    phase: ProcessingPhase.INITIALIZATION,
  },
  workflowError: null as string | null,
  data: {},
};

// Initial research state
const initialResearchState: ResearchState = {
  query: null,
  result: null,
  isActive: false,
  progress: 0
};

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
  syncWorkflowState: (state: WorkflowStateType) => void;
  subscribeToWorkflowUpdates: (callback: (state: WorkflowStateType) => void) => () => void;

  // Verification methods
  startVerification: (content: string, options?: VerificationOptions) => Promise<void>;
  submitCorrection: (correction: string) => void;
  completeVerification: (isApproved: boolean) => Promise<VerificationResult>;
  handleCorrectionMessage: (correction: string) => Promise<void>;
  confirmVerification: () => Promise<VerificationResult>;
  initiateVerification: (extractedDocument: any, messageId?: string) => Promise<any>;
  processCorrection: (correctionText: string, currentSummary: string, messageId?: string) => Promise<any>;
  resetVerification: () => Promise<{ success: boolean }>;

  // Report generation methods
  startReportGeneration: (reportOptions?: any) => void;
  completeReportGeneration: (report: any) => void;
  generateReport: () => Promise<void>;
  formatReport: (format: any) => Promise<void>;
  beginReportGeneration: (reportMetadata?: Record<string, any>) => Promise<{ success: boolean }>;

  // Document processing methods
  processDocument: (
    file: File,
    patientId: string,
    documentType?: string,
    abortSignal?: AbortSignal
  ) => Promise<any>;
  uploadDocument: (file: File, patientId: string, documentType?: string) => Promise<any>;
  resetDocumentProcessing: () => void;

  // Message sending
  sendMessage: (
    content: string,
    options?: { isCorrection?: boolean; metadata?: ChatMessageMetadata }
  ) => Promise<void>;

  // Helper methods
  addSystemMessage: (content: string, type?: string, metadata?: Record<string, unknown>) => ChatMessage;
  postSummaryMessage: (summary: string) => ChatMessage;
  updateSummaryAfterCorrection: (newSummary: string) => ChatMessage;
  clearMessages: () => void;

  // Research methods
  performResearch: (query: string, options?: ResearchOptions) => Promise<ResearchResult>;
}

// Initial chat store state
const initialState: Omit<ChatStore, 'workflowStateManager' | 'setWorkflowManager' | 'syncWorkflowState' | 'subscribeToWorkflowUpdates' | 'performResearch'> = {
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
    verificationStatus: "pending",
    verificationItems: [],
    summaryVersions: [],
  },

  research: initialResearchState,

  docProgress: 0,
  isDocProcessing: false,
  extractedDocument: null,

  reportGeneration: {
    isComplete: false,
    format: {} as Record<string, unknown>,
    reportId: undefined,
  },

  // Basic actions
  setLoading: () => {},
  setError: () => {},
  setMode: () => {},
  resetChat: () => {},

  // Message handling
  addMessage: () => {},
  updateMessages: () => {},
  updateMessageProgress: () => {},

  // Workflow methods
  updateWorkflowStep: () => {},
  updateProgress: () => {},

  // Verification methods
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
  resetVerification: async () => ({ success: true }),

  // Report generation methods
  startReportGeneration: () => {},
  completeReportGeneration: () => {},
  generateReport: async () => {},
  formatReport: async () => {},
  beginReportGeneration: async () => ({ success: true }),

  // Document processing methods
  processDocument: async () => ({}),
  uploadDocument: async () => ({}),
  resetDocumentProcessing: () => {},

  // Message sending
  sendMessage: async () => {},

  // Helper methods
  addSystemMessage: () => ({
    id: "temp",
    role: "system",
    content: "System message placeholder",
    createdAt: new Date().toISOString(),
    type: ChatMessageType.SYSTEM,
  }),
  postSummaryMessage: () => ({
    id: "temp-summary",
    role: "assistant",
    content: "Summary message placeholder",
    createdAt: new Date().toISOString(),
    type: ChatMessageType.SUMMARY,
  }),
  updateSummaryAfterCorrection: () => ({
    id: "temp-summary-correction",
    role: "assistant",
    content: "Corrected summary placeholder",
    createdAt: new Date().toISOString(),
    type: ChatMessageType.SUMMARY,
  }),
  clearMessages: () => {},
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
      // Include workflowStateManager in initial state
      ...initialState,
      workflowStateManager: defaultWorkflowStateManager,

      ///////////////////////////////////////////////////////////////////////////
      // Basic actions
      ///////////////////////////////////////////////////////////////////////////
      setLoading: (isLoading: boolean) =>
        set((state) => ({
          ...state,
          isLoading,
        })),

      setError: (error: string | null) =>
        set((state) => ({
          ...state,
          error,
          isLoading: false,
          workflow: {
            ...state.workflow,
            workflowError: error,
          },
        })),

      setMode: (mode: ChatMode) =>
        set((state) => ({
          ...state,
          mode,
        })),

      resetChat: () =>
        set((state) => ({
          ...state,
          messages: [],
          isLoading: false,
          error: null,
          verification: {
            ...state.verification,
            isInVerificationMode: false,
            summaryVersions: [],
            currentSummary: null,
            verificationItems: [],
            verificationStatus: "pending",
          },
          workflow: {
            ...initialWorkflowState,
          },
          research: {
            ...initialResearchState
          },
        })),

      ///////////////////////////////////////////////////////////////////////////
      // Message actions
      ///////////////////////////////////////////////////////////////////////////
      addMessage: (msg) =>
        set((state) => {
          const newMessage: ChatMessage = "id" in msg
            ? msg
            : {
                ...msg,
                id: crypto.randomUUID(),
              };
          return {
            ...state,
            messages: [...state.messages, newMessage],
          };
        }),

      updateMessages: (messages: ChatMessage[]) =>
        set((state) => ({
          ...state,
          messages,
        })),

      updateMessageProgress: (messageId: string, progress: number, phase: string) =>
        set((state) => {
          const updated = state.messages.map((m) => {
            if (m.id === messageId) {
              const messageType = m.metadata?.type ?? ChatMessageType.PROGRESS;
              return {
                ...m,
                metadata: {
                  ...(m.metadata ?? {}),
                  type: messageType,
                  progress: {
                    value: progress,
                    phase: phase as ProcessingPhase,
                  },
                },
              } as ChatMessage; // Explicit cast to ChatMessage
            }
            return m;
          });

          return {
            ...state,
            messages: updated,
            workflow: {
              ...state.workflow,
              processingStatus: {
                ...state.workflow.processingStatus,
                progress,
                phase: phase as ProcessingPhase,
              },
            },
          };
        }),

      ///////////////////////////////////////////////////////////////////////////
      // Workflow integration methods
      ///////////////////////////////////////////////////////////////////////////
      setWorkflowManager: (manager: WorkflowStateManager) =>
        set((state) => ({
          ...state,
          workflowStateManager: manager
        })),

      syncWorkflowState: (workflowState: WorkflowStateType) =>
        set((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            currentStep: workflowState.currentStep,
            processingStatus: {
              status: workflowState.progress > 0 ? "processing" : "idle",
              progress: workflowState.progress,
              phase: workflowState.phase || ProcessingPhase.INITIALIZATION,
              error: workflowState.error || undefined
            },
            workflowError: workflowState.error || null,
            data: {
              ...state.workflow.data,
              ...(workflowState.metadata || {})
            }
          }
        })),

      subscribeToWorkflowUpdates: (callback: (state: WorkflowStateType) => void) => {
        const state = get();
        const workflowId = state.workflowStateManager.getCurrentWorkflowId();
        
        if (!workflowId) {
          console.warn("Cannot subscribe to workflow updates: no workflow ID available");
          return () => {};
        }
        
        const channel = workflowService.subscribeToWorkflowChanges(
          workflowId,
          (payload) => {
            const newStep = payload.new.current_step as WorkflowStep;
            const newMetadata = payload.new.metadata as Record<string, unknown> || {};
            
            // Update our local state
            set((state) => ({
              ...state,
              workflow: {
                ...state.workflow,
                currentStep: newStep,
                data: {
                  ...state.workflow.data,
                  ...newMetadata
                }
              }
            }));
            
            // Call the callback with the new state
            callback({
              currentStep: newStep,
              progress: newMetadata.progress as number || 0,
              phase: newMetadata.phase as ProcessingPhase || undefined,
              error: newMetadata.error as string || null,
              metadata: newMetadata,
              timestamp: (payload.new as any).updated_at || new Date().toISOString()
            });
          }
        );
        
        // Return unsubscribe function
        return () => {
          workflowService.unsubscribeFromChannel(channel);
        };
      },

      updateWorkflowStep: (step: WorkflowStep, metadata?: Record<string, unknown>) =>
        set((state) => {
          const currentStep = state.workflow.currentStep;
          
          // Handle error steps specially
          let nextError: string | null = state.error;
          let nextWorkflowError: string | null = state.workflow.workflowError;
          
          if (step === DomainOnlyWorkflowStep.ERROR && metadata?.error) {
            nextError = typeof metadata.error === 'object' 
              ? JSON.stringify(metadata.error) 
              : String(metadata.error);
            nextWorkflowError = typeof metadata.error === 'object' 
              ? JSON.stringify(metadata.error) 
              : String(metadata.error);
          }

          const enrichedMetadata = {
            ...(metadata || {}),
            _transition: {
              from: currentStep,
              to: step,
              timestamp: new Date().toISOString(),
            },
          };

          // Call the workflow service through our manager
          void (async () => {
            try {
              await state.workflowStateManager.updateWorkflowState(step, enrichedMetadata);
            } catch (err) {
              console.error("Failed to update workflow state:", err);
            }
          })();

          return {
            ...state,
            error: nextError,
            workflow: {
              ...state.workflow,
              currentStep: step,
              workflowError: nextWorkflowError,
              data: {
                ...state.workflow.data,
                ...enrichedMetadata,
              },
            },
          };
        }),

      updateProgress: (progress: number, phase?: ProcessingPhase) =>
        set((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            processingStatus: {
              ...state.workflow.processingStatus,
              progress,
              phase: (phase ?? state.workflow.processingStatus.phase) as ProcessingPhase,
            },
          },
        })),
    
///////////////////////////////////////////////////////////////////////////
      // Verification actions
      ///////////////////////////////////////////////////////////////////////////
      startVerification: async (content: string, options?: VerificationOptions) => {
        set((state) => ({
          ...state,
          mode: "verification",
          verification: {
            ...state.verification,
            isInVerificationMode: true,
            currentSummary: content,
            verificationItems: options?.items ?? [],
            verificationStatus: "in_progress",
            summaryVersions: [
              ...state.verification.summaryVersions,
              {
                id: crypto.randomUUID(),
                content,
                timestamp: new Date().toISOString(),
              },
            ],
          },
          workflow: {
            ...state.workflow,
            currentStep: "verification",
            processingStatus: {
              status: "processing",
              progress: 70,
              phase: ProcessingPhase.VERIFICATION,
            },
            data: {
              ...state.workflow.data,
              verification: {
                isInVerificationMode: true,
              },
            },
          },
        }));
      },

      submitCorrection: (correction: string) =>
        set((state) => ({
          ...state,
          verification: {
            ...state.verification,
            verificationStatus: "in_progress",
          },
          workflow: {
            ...state.workflow,
            data: {
              ...state.workflow.data,
              lastCorrection: correction,
            },
          },
        })),

      completeVerification: async (isApproved: boolean) => {
        const state = get();
        const workflowId = state.workflowStateManager.getCurrentWorkflowId() ?? "";

        // Update local state to show processing
        set((s) => ({
          ...s,
          workflow: {
            ...s.workflow,
            processingStatus: {
              status: "processing",
              progress: 85,
              phase: ProcessingPhase.VERIFICATION,
            }
          }
        }));

        try {
          // Use the complete CompleteVerificationOptions type
          const options: CompleteVerificationOptions = {
            workflowId,
            isApproved,
            items: state.verification.verificationItems,
            comments: state.workflow.data.verificationComments as string
          };
          
          // Call verification service with proper options
          const result = await verificationService.completeVerification(workflowId, isApproved, {
            items: state.verification.verificationItems,
            comments: options.comments
          });
          
          if (!result.success) {
            throw new VerificationError({
              message: result.error?.message ?? "Failed to complete verification",
              code: result.error?.code ?? "VERIFICATION_COMPLETION_FAILED",
              data: { details: result.error?.details },
            });
          }

          // Update workflow step based on verification status
          const nextStep = isApproved ? "report_generation" : "verification_failed";
          
          // Update local state
          set((s) => ({
            ...s,
            verification: {
              ...s.verification,
              isInVerificationMode: false,
              verificationStatus: isApproved ? "completed" : "failed",
            },
            workflow: {
              ...s.workflow,
              currentStep: nextStep,
              processingStatus: {
                status: "success",
                progress: 100,
                phase: ProcessingPhase.VERIFICATION,
              },
              data: {
                ...s.workflow.data,
                verification: {
                  isInVerificationMode: false,
                  isApproved,
                  completedAt: new Date().toISOString(),
                  verificationResult: result.data,
                },
              },
            },
            mode: isApproved ? "default" : s.mode,
          }));

          // Add a system message about verification completion
          get().addSystemMessage(
            isApproved
              ? "Verification completed successfully. Generating report..."
              : "Verification rejected. Please make necessary corrections.",
            isApproved ? ChatMessageType.SYSTEM : ChatMessageType.ERROR,
            { verificationComplete: true, isApproved }
          );
          
          return result.data;
        } catch (error) {
          // Enhanced error handling
          const normalizedError = normalizeError(error);
          
          // Update local state to show error
          set((s) => ({
            ...s,
            workflow: {
              ...s.workflow,
              currentStep: DomainOnlyWorkflowStep.ERROR,
              processingStatus: {
                status: "error",
                progress: 0,
                phase: ProcessingPhase.ERROR,
              },
              workflowError: normalizedError.message
            }
          }));
          
          // Add error message to chat
          get().addSystemMessage(
            `Verification failed: ${normalizedError.message}`,
            ChatMessageType.ERROR,
            { errorCode: normalizedError.code }
          );
          
          // Return fallback verification result
          return createFallbackVerificationResult(state);
        }
      },

      handleCorrectionMessage: async (correction: string) => {
        const state = get();
        const workflowId = state.workflowStateManager.getCurrentWorkflowId() ?? "";

        // Add user correction message
        get().addMessage({
          id: crypto.randomUUID(),
          role: "user",
          content: correction,
          createdAt: new Date().toISOString(),
          type: ChatMessageType.CORRECTION,
          metadata: {
            type: ChatMessageType.CORRECTION,
            workflowId,
          },
        });

        const progressMessageId = crypto.randomUUID();
        get().addMessage({
          id: progressMessageId,
          role: "system",
          content: "Processing your correction...",
          createdAt: new Date().toISOString(),
          type: ChatMessageType.PROGRESS,
          metadata: {
            type: ChatMessageType.PROGRESS,
            progress: { value: 0, phase: ProcessingPhase.CORRECTION },
            workflowId,
          },
        });

        get().submitCorrection(correction);

        try {
          const currentSummary = state.verification.currentSummary ?? "";
          
          // Use proper SubmitCorrectionOptions
          const correctionOptions: SubmitCorrectionOptions & {
            onStatusUpdate?: (status: any) => void;
          } = {
            correction,
            currentSummary,
            workflowId,
            messageId: progressMessageId,
            onStatusUpdate: (st: {
              progress?: number;
              phase?: string;
              status?: string;
              error?: string;
            }) => {
              if (st.progress !== undefined) {
                get().updateMessageProgress(
                  progressMessageId,
                  st.progress,
                  st.phase ?? "correction"
                );
              }
            },
          };
          
          const result = await verificationService.submitCorrection(correctionOptions);
          
          if (!result.success) {
            throw new VerificationError({
              message: result.error?.message ?? "Failed to submit correction",
              code: result.error?.code ?? "CORRECTION_SUBMISSION_FAILED",
            });
          }

          get().updateMessageProgress(progressMessageId, 100, "completed");

          const newSummaryId = result.data.summaryId;
          const newSummary = result.data.summary;
          const timestamp = new Date().toISOString();

          get().addMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: newSummary,
            createdAt: new Date().toISOString(),
            type: ChatMessageType.SUMMARY,
            metadata: {
              type: ChatMessageType.SUMMARY,
              summaryVersionId: newSummaryId,
              timestamp,
              workflowId,
            },
          });

          get().addMessage({
            id: crypto.randomUUID(),
            role: "system",
            content:
              "I've updated the summary based on your correction. Please review and type 'confirm' or provide more corrections.",
            createdAt: new Date().toISOString(),
            type: ChatMessageType.VERIFICATION,
            metadata: {
              type: ChatMessageType.VERIFICATION,
              workflowId,
            },
          });

          set((s) => ({
            ...s,
            verification: {
              ...s.verification,
              currentSummary: newSummary,
              verificationStatus: "in_progress",
              summaryVersions: [
                ...s.verification.summaryVersions,
                {
                  id: newSummaryId,
                  content: newSummary,
                  timestamp,
                  userId: "",
                },
              ],
            },
            workflow: {
              ...s.workflow,
              currentStep: "verification_in_progress",
              processingStatus: {
                status: "success",
                progress: 100,
                phase: ProcessingPhase.CORRECTION,
              },
              data: {
                ...s.workflow.data,
                verificationMetadata: {
                  ...(s.workflow.data.verificationMetadata ?? {}),
                  currentVersionId: newSummaryId,
                },
              },
            },
          }));
        } catch (error) {
          const normalizedError = normalizeError(error);
          
          get().addMessage({
            id: crypto.randomUUID(),
            role: "system",
            content: `Error processing correction: ${normalizedError.message}`,
            createdAt: new Date().toISOString(),
            type: ChatMessageType.ERROR,
            metadata: {
              type: ChatMessageType.ERROR,
              errorCode: normalizedError.code
            }
          });
          
          get().updateMessageProgress(progressMessageId, 100, ProcessingPhase.ERROR);
          
          // Update workflow state
          get().updateWorkflowStep(DomainOnlyWorkflowStep.ERROR, {
            error: normalizedError.message,
            errorDetails: normalizedError.data,
            errorTimestamp: new Date().toISOString()
          });
        }
      },

      initiateVerification: async (extractedDocument, messageId?: string) => {
        try {
          const summaryId = crypto.randomUUID();
          set((state) => ({
            ...state,
            workflow: {
              ...state.workflow,
              currentStep: "verification_pending",
              processingStatus: {
                status: "processing",
                progress: 50,
                phase: ProcessingPhase.VERIFICATION,
              },
              data: {
                ...state.workflow.data,
                documentId: extractedDocument.documentId !== undefined ? extractedDocument.documentId : "",
                patientId: extractedDocument.patientId !== undefined ? extractedDocument.patientId : "",
              },
            },
            mode: "verification",
          }));

          // Use proper GenerateVerificationOptions
          const verificationOptions: GenerateVerificationOptions = {
            document: extractedDocument,
            workflowId: get().workflowStateManager.getCurrentWorkflowId() ?? "",
            messageId: messageId ?? "",
            summaryId,
          };
          
          const result = await verificationService.generateVerification(verificationOptions);
          
          if (!result.success) {
            throw new VerificationError({
              message: result.error?.message ?? "Failed to generate verification",
              code: result.error?.code ?? "VERIFICATION_GENERATION_FAILED",
            });
          }

          const timestamp = new Date().toISOString();
          set((s) => ({
            ...s,
            workflow: {
              ...s.workflow,
              currentStep: "verification",
              processingStatus: {
                status: "success",
                progress: 100,
                phase: ProcessingPhase.VERIFICATION,
              },
              data: {
                ...s.workflow.data,
                extractedData: result.data.structuredData || extractedDocument,
                summaryId,
                verificationMetadata: {
                  verification_status: VerificationStatus.pending,
                  originalSummaryId: summaryId,
                  currentVersionId: summaryId,
                  correctionCount: 0,
                  startedAt: timestamp,
                  lastUpdated: timestamp,
                  corrections: [],
                },
              },
            },
            verification: {
              ...s.verification,
              isInVerificationMode: true,
              currentSummary: result.data.summary,
              verificationStatus: "pending",
              summaryVersions: [
                {
                  id: summaryId,
                  content: result.data.summary,
                  timestamp,
                  userId: "",
                },
              ],
            },
          }));
          
          // Add a system message about verification
          get().addSystemMessage(
            "Please review the extracted information and make any necessary corrections.",
            ChatMessageType.VERIFICATION,
            { verificationStarted: true }
          );

          return {
            summaryId,
            summary: result.data.summary,
            structuredData: result.data.structuredData || {},
          };
        } catch (error) {
          const normalizedError = normalizeError(error);
          
          // Update to error state
          get().updateWorkflowStep(DomainOnlyWorkflowStep.ERROR, {
            error: normalizedError.message,
            errorDetails: normalizedError.data || {},
            errorTimestamp: new Date().toISOString()
          });
          
          // Add error message
          get().addSystemMessage(
            `Verification initialization failed: ${normalizedError.message}`,
            ChatMessageType.ERROR,
            { errorCode: normalizedError.code }
          );
          
          return {};
        }
      },

      processCorrection: async (correctionText, currentSummary, messageId?: string) => {
        try {
          set((s) => ({
            ...s,
            workflow: {
              ...s.workflow,
              currentStep: "verification_in_progress",
              processingStatus: {
                status: "processing",
                progress: 0,
                phase: ProcessingPhase.CORRECTION,
              },
            },
            verification: {
              ...s.verification,
              verificationStatus: "in_progress",
            },
          }));

          // Use proper ProcessCorrectionOptions
          const correctionOptions: ProcessCorrectionOptions = {
            correction: correctionText,
            currentSummary,
            workflowId: get().workflowStateManager.getCurrentWorkflowId() ?? "",
            messageId,
          };
          
          const result = await verificationService.processCorrection(correctionOptions);
          
          if (!result.success) {
            throw new VerificationError({
              message: result.error?.message ?? "Failed to process correction",
              code: result.error?.code ?? "CORRECTION_PROCESSING_FAILED",
            });
          }

          const newSummaryId = result.data.summaryId;
          const newSummary = result.data.summary;
          const timestamp = new Date().toISOString();
          
          set((state) => ({
            ...state,
            workflow: {
              ...state.workflow,
              currentStep: "verification_in_progress",
              processingStatus: {
                status: "success",
                progress: 100,
                phase: ProcessingPhase.CORRECTION,
              },
              data: {
                ...state.workflow.data,
                verificationMetadata: {
                  ...(state.workflow.data.verificationMetadata ?? {}),
                  currentVersionId: newSummaryId,
                  correctionCount:
                    ((state.workflow.data as any).verificationMetadata?.correctionCount || 0) + 1,
                  lastUpdated: timestamp
                },
              },
            },
            verification: {
              ...state.verification,
              currentSummary: newSummary,
              summaryVersions: [
                ...state.verification.summaryVersions,
                {
                  id: newSummaryId,
                  content: newSummary,
                  timestamp,
                  userId: "",
                },
              ],
            },
          }));

          return {
            summaryId: newSummaryId,
            summary: newSummary,
            structuredData: result.data.structuredData || {},
          };
        } catch (error) {
          const normalizedError = normalizeError(error);
          
          // Update to error state
          get().updateWorkflowStep(DomainOnlyWorkflowStep.ERROR, {
            error: normalizedError.message,
            errorDetails: normalizedError.data || {},
            errorTimestamp: new Date().toISOString()
          });
          
          throw error;
        }
      },

      resetVerification: async () => {
        try {
          await get().workflowStateManager.resetWorkflow();
          
          set((state) => ({
            ...state,
            workflow: {
              ...state.workflow,
              currentStep: "idle",
              processingStatus: {
                status: "idle",
                progress: 0,
                phase: ProcessingPhase.INITIALIZATION,
              },
              data: {
                ...state.workflow.data,
                verificationMetadata: null,
              },
              workflowError: null,
            },
            verification: {
              ...state.verification,
              isInVerificationMode: false,
              currentSummary: null,
              summaryVersions: [],
              verificationStatus: "pending",
              verificationItems: [],
            },
          }));
          
          return { success: true };
        } catch (error) {
          const normalizedError = normalizeError(error);
          
          get().setError(normalizedError.message);
          throw error;
        }
      },

      confirmVerification: async () => {
        return get().completeVerification(true);
      },

      ///////////////////////////////////////////////////////////////////////////
      // Report generation
      ///////////////////////////////////////////////////////////////////////////
      startReportGeneration: (reportOptions?: any) =>
        set((state) => ({
          ...state,
          mode: "default",
          reportGeneration: {
            ...state.reportGeneration,
            isComplete: false,
            format: reportOptions || {},
          },
          workflow: {
            ...state.workflow,
            currentStep: "report_generation",
            processingStatus: {
              status: "processing",
              progress: 85,
              phase: ProcessingPhase.REPORT_GENERATION,
            },
          },
        })),

      completeReportGeneration: (report: any) =>
        set((state) => ({
          ...state,
          reportGeneration: {
            ...state.reportGeneration,
            isComplete: true,
            format: report,
            reportId: report.reportId || state.reportGeneration?.reportId
          },
          workflow: {
            ...state.workflow,
            currentStep: "complete",
            processingStatus: {
              status: "success",
              progress: 100,
              phase: ProcessingPhase.COMPLETION,
            },
            data: {
              ...state.workflow.data,
              reportCompleted: true,
              reportCompletedAt: new Date().toISOString(),
              reportId: report.reportId || state.reportGeneration?.reportId
            }
          },
        })),

      async generateReport(): Promise<void> {
        try {
          // Get state first
          const state = get();
          
          // Safely access workflow state manager
          const workflowManager = state.workflowStateManager;
          if (!workflowManager) {
            throw new Error("Workflow state manager is not available");
          }
          
          // Safely extract metadata
          const metadata = state.workflow.data.reportMetadata as Record<string, unknown> ?? {};
          
          // Safely get workflowId
          const workflowId = typeof workflowManager.getCurrentWorkflowId === 'function' 
            ? workflowManager.getCurrentWorkflowId() 
            : null;
            
          // Log the operation
          moduleLogger.info('Generating report', { 
            workflowId: workflowId ?? 'unknown',
            hasWorkflowManager: !!workflowManager
          });
          
          // Check if we can use the workflow manager's method
          if (typeof workflowManager.beginReportGeneration === 'function') {
            // Call the implementation from workflow manager
            await workflowManager.beginReportGeneration(metadata);
          } else {
            // Fallback implementation
            moduleLogger.info('Using fallback report generation');
            
            if (workflowId) {
              // Update workflow state directly
              await workflowService.updateWorkflowState(
                workflowId,
                "report_generation" as WorkflowStep,
                { reportStartedAt: new Date().toISOString() }
              );
            }
            
            // Call our local implementation
            await get().beginReportGeneration(metadata);
          }
          
          return;
        } catch (error) {
          moduleLogger.error('Failed to generate report', { error });
          get().updateWorkflowStep("error" as WorkflowStep, {
            error: error instanceof Error ? error.message : "Unknown error"
          });
          throw error;
        }
      },

      formatReport: async (format: any) => {
        try {
          const state = get();
          const { reportGeneration, workflow } = state;
          const reportId = reportGeneration?.reportId ?? workflow.data.reportId as string ?? crypto.randomUUID();
          
          moduleLogger.info('Formatting report', { format, reportId });
          
          if (!reportId) {
            throw new Error('No report ID found for formatting');
          }
          
          // Create a properly structured ReportData object for formatting
          const reportData: ReportData = {
            report: {
              id: reportId,
              title: "Medical Report",
              patientId: state.workflow.data.patientId as string ?? "",
              reportType: "custom" as unknown as ReportType,
              status: "completed" as unknown as ReportStatus,
              sections: {},
              sourceDocuments: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              metadata: {
                generatedAt: new Date().toISOString(),
                generationTimeMs: 0,
                parameters: {},
                modelName: "system",
                confidence: 1.0,
                version: "1.0"
              }
            },
            patient: {
              id: state.workflow.data.patientId as string ?? "",
              firstName: "Unknown",
              lastName: "Patient",
            },
            sourceDocuments: []
          };
          
          // If we have content, add it to the report sections
          if (state.reportGeneration?.format?.content) {
            reportData.report.sections = {
              content: {
                title: "Content",
                content: state.reportGeneration.format.content as string,
                order: 0,
                editable: true
              }
            };
          }
          
          const formattedReport = await reportService.formatReportOutput(
            reportData,
            format.type ?? "markdown"
          );
          
          get().completeReportGeneration({
            format,
            content: formattedReport ?? "Formatted report content",
            formattedAt: new Date().toISOString(),
            reportId,
          });
          
          // Add the formatted report to chat
          get().addMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Report has been formatted as ${format.format || 'PDF'}.`,
            createdAt: new Date().toISOString(),
            type: ChatMessageType.SYSTEM,
            metadata: {
              type: ChatMessageType.SYSTEM,
              reportId,
              format: format.format
            }
          });
          
        } catch (error) {
          moduleLogger.error('Report formatting failed', { error });
          throw error;
        }
      },
      
      beginReportGeneration: async (reportMetadata) => {
        try {
          const state = get();
          const currentStep = state.workflow.currentStep;
          
          // Check if the current step allows report generation
           if (currentStep !== "verification_complete" as WorkflowStep && 
               currentStep !== "ready_for_report" as WorkflowStep) {
              throw new Error(
                `Verification must be completed before generating report, current step: ${currentStep}`
              );
            }
          
          // Safely access the workflow manager and its methods
          const workflowManager = get().workflowStateManager;
          
          // Safely get workflowId
          const workflowId = workflowManager && typeof workflowManager.getCurrentWorkflowId === 'function'
            ? workflowManager.getCurrentWorkflowId() ?? ""
            : "";
          
          // Safely invoke the beginReportGeneration method if it exists
          if (workflowManager && typeof workflowManager.beginReportGeneration === 'function') {
            return await workflowManager.beginReportGeneration(reportMetadata);
          } else {
            if (workflowId) {
              await workflowService.updateWorkflowState(
                workflowId,
                "report_generation",
                {
                  ...(reportMetadata || {}),
                  reportGenerationStartedAt: new Date().toISOString(),
                }
              );
            }
          }

          set((state) => ({
            ...state,
            workflow: {
              ...state.workflow,
              currentStep: "report_generation",
              processingStatus: {
                status: "processing",
                progress: 0,
                phase: ProcessingPhase.REPORT_GENERATION,
              },
              data: {
                ...state.workflow.data,
                reportMetadata: reportMetadata || {},
              },
            },
          }));
          
          return { success: true };
        } catch (error) {
          const normalizedError = normalizeError(error);
          
          get().updateWorkflowStep(DomainOnlyWorkflowStep.ERROR, {
            error: normalizedError.message,
            errorTimestamp: new Date().toISOString(),
          });
          
          throw error;
        }
      },

      ///////////////////////////////////////////////////////////////////////////
      // Document processing
      ///////////////////////////////////////////////////////////////////////////
      processDocument: async (file: File, patientId: string, documentType?: string, abortSignal?: AbortSignal) => {
        try {
          const workflowId = get().workflowId;
          set({ isDocProcessing: true, docProgress: 0 });
          
          // Create status update handler
          const onStatusUpdate = (status: WorkflowProcessingStatus) => {
            set({
              docProgress: status.progress ?? 0,
              isDocProcessing: status.status === "processing",
            });
          };
          
          // Create document type object with proper typing
          const docTypeObj = documentType
            ? { category: "clinical", type: documentType }
            : { category: "clinical", type: "document" };
          
          // Process the document - fix the options object
          const result = await documentService.processDocument(file, {
            documentType: docTypeObj as DocumentType,
            patientId,
            onStatusUpdate: onStatusUpdate as any,
            extractionLevel: "comprehensive"
          });
          
          // Update local state with extracted document - fix the type conversion
          set({
            extractedDocument: result as any as Record<string, unknown>,
            docProgress: 100,
            isDocProcessing: false,
          });
          
          return result;
        } catch (error) {
          set({ isDocProcessing: false, docProgress: 0 });
          throw error;
        }
      },

      uploadDocument: async (file: File, patientId: string, documentType?: string) => {
        try {
          set({ isDocProcessing: true, docProgress: 0 });
          
          const onStatusUpdate = (status: WorkflowProcessingStatus) => {
            set({
              docProgress: status.progress ?? 0,
              isDocProcessing: status.status === "processing",
            });
          };
          
          // Create document type object
          const docTypeObj = documentType
            ? { category: "clinical", type: documentType }
            : { category: "clinical", type: "document" };
          
          // Fix method signature and parameters
          const result = await documentService.uploadDocument(
            patientId,
            file,
            {
              documentType: docTypeObj as DocumentType,
              priority: "normal",
              onStatusUpdate: onStatusUpdate as any
            }
          );
          
          set({
            docProgress: 100,
            isDocProcessing: false,
          });
          
          // Update workflow step
          get().updateWorkflowStep("extracting", {
            documentId: result.documentId,
            fileName: result.fileName,
            extractionStatus: result.extractionStatus
          });
          
          // Add system message
          get().addSystemMessage(
            `Document uploaded successfully. Extracting content...`,
            ChatMessageType.SYSTEM,
            { documentId: result.documentId }
          );

          return result;
        } catch (error) {
          const normalizedError = normalizeError(error);
          
          get().setError(normalizedError.message);
          get().updateWorkflowStep(DomainOnlyWorkflowStep.ERROR, {
            error: normalizedError.message,
            errorDetails: normalizedError.data || {},
            errorTimestamp: new Date().toISOString(),
          });
          
          // Add error message
          get().addSystemMessage(
            `Document upload failed: ${normalizedError.message}`,
            ChatMessageType.ERROR,
            { errorCode: normalizedError.code }
          );
          
          throw error;
        }
      },

      resetDocumentProcessing: () => {
        set({
          docProgress: 0,
          isDocProcessing: false,
          extractedDocument: null,
        });
      },

      ///////////////////////////////////////////////////////////////////////////
      // Message sending and helpers
      ///////////////////////////////////////////////////////////////////////////
      sendMessage: async (content: string, options?: { isCorrection?: boolean; metadata?: ChatMessageMetadata }) => {
        if (!content.trim()) return;
        
        try {
          get().setLoading(true);

          const messageType = options?.isCorrection ? ChatMessageType.CORRECTION : ChatMessageType.CHAT;
          const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content,
            createdAt: new Date().toISOString(),
            type: messageType,
            metadata: options?.metadata ?? { type: messageType },
          };
          
          get().addMessage(userMessage);

          // Handle corrections specially
          if (options?.isCorrection) {
            await get().handleCorrectionMessage(content);
            return;
          }
          
          // Update workflow step for normal messages
          get().updateWorkflowStep("chat_in_progress", {
            lastUserMessage: content,
            lastUserMessageAt: new Date().toISOString()
          });
          
          // Here you could add logic to send to API, or handle different message types
          // For now we'll just simulate a bot response with a delay
          setTimeout(() => {
            const responseMessage: ChatMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `I've received your message: "${content}"`,
              createdAt: new Date().toISOString(),
              type: ChatMessageType.CHAT,
              metadata: { type: ChatMessageType.CHAT }
            };
            
            get().addMessage(responseMessage);
            get().updateWorkflowStep("chat_completed", {
              lastAssistantMessage: responseMessage.content,
              lastAssistantMessageAt: new Date().toISOString()
            });
            
            get().setLoading(false);
          }, 500);
          
        } catch (error) {
          const normalizedError = normalizeError(error);
          
          get().setError(normalizedError.message);
          get().setLoading(false);
          
          // Add error message
          get().addSystemMessage(
            `Failed to send message: ${normalizedError.message}`,
            ChatMessageType.ERROR,
            { errorCode: normalizedError.code }
          );
        }
      },

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
        const summaryId = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        void get().startVerification(summary); // Might do something async
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: summary,
          createdAt: new Date().toISOString(),
          type: ChatMessageType.SUMMARY,
          metadata: {
            type: ChatMessageType.SUMMARY,
            summaryVersionId: summaryId,
            verificationMetadata: {
              verification_status: VerificationStatus.pending,
              originalSummaryId: summaryId,
              currentVersionId: summaryId,
              correctionCount: 0,
              startedAt: timestamp,
              lastUpdated: timestamp,
              corrections: [],
            },
          },
        };
        get().addMessage(message);
        return message;
      },

      updateSummaryAfterCorrection: (newSummary) => {
        const newVersionId = crypto.randomUUID();
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: newSummary,
          createdAt: new Date().toISOString(),
          type: ChatMessageType.SUMMARY,
          metadata: {
            type: ChatMessageType.SUMMARY,
            summaryVersionId: newVersionId,
          },
        };
        get().addMessage(message);
        return message;
      },

      clearMessages: () => {
        get().resetChat();
      },

      ///////////////////////////////////////////////////////////////////////////
      // Research methods
      ///////////////////////////////////////////////////////////////////////////
      performResearch: async (query: string, options?: ResearchOptions) => {
        try {
          // Set loading state
          set((state) => ({
            ...state,
            isLoading: true,
            mode: "research",
            research: {
              ...state.research,
              isActive: true,
              query,
              progress: 0
            },
            workflow: {
              ...state.workflow,
              currentStep: DomainOnlyWorkflowStep.RESEARCH,
              processingStatus: {
                status: "processing",
                progress: 0,
                phase: ProcessingPhase.RESEARCH
              }
            }
          }));
          
          // Add user message
          get().addMessage({
            id: crypto.randomUUID(),
            role: "user",
            content: query,
            createdAt: new Date().toISOString(),
            type: ChatMessageType.CHAT,
            metadata: {
              type: ChatMessageType.CHAT,
              isResearchQuery: true
            }
          });
          
          // Add progress message
          const progressMessageId = crypto.randomUUID();
          get().addMessage({
            id: progressMessageId,
            role: "system",
            content: "Researching your query...",
            createdAt: new Date().toISOString(),
            type: ChatMessageType.PROGRESS,
            metadata: {
              type: ChatMessageType.PROGRESS,
              progress: {
                value: 0,
                phase: ProcessingPhase.RESEARCH
              }
            }
          });
          
          // Perform research using perplexityService
          const researchResult = await perplexityService.performDeepResearch(
            query,
            {
              ...options,
              onProgress: (progress: number) => {
                // Update progress in our message and workflow
                get().updateMessageProgress(progressMessageId, progress, ProcessingPhase.RESEARCH);
                get().updateProgress(progress, ProcessingPhase.RESEARCH);
                
                // Update research state
                set((state) => ({
                  ...state,
                  research: {
                    ...state.research,
                    progress
                  }
                }));
              }
            }
          );
          
          // Update workflow state
          get().updateWorkflowStep("chat_completed", {
            researchCompleted: true,
            researchTimestamp: new Date().toISOString(),
            query
          });
          
          // Update research state
          set((state) => ({
            ...state,
            research: {
              ...state.research,
              result: researchResult,
              progress: 100,
              isActive: false
            }
          }));
          
          // Add research result as message
          get().addMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: researchResult.text,
            createdAt: new Date().toISOString(),
            type: ChatMessageType.RESEARCH,
            metadata: {
              type: ChatMessageType.RESEARCH,
              summary: researchResult.summary,
              keyFindings: researchResult.keyFindings,
              sources: researchResult.sources,
              confidence: researchResult.confidence,
              modelName: researchResult.modelName
            }
          });
          
          // Add a sources summary message if there are sources
          if (researchResult.sources && researchResult.sources.length > 0) {
            const sourcesText = `Sources:\n${researchResult.sources
              .map((source, index) => `${index + 1}. ${source.title || 'Source'}: ${source.url}`)
              .join("\n")}`;
            
            get().addMessage({
              id: crypto.randomUUID(),
              role: "system",
              content: sourcesText,
              createdAt: new Date().toISOString(),
              type: ChatMessageType.SYSTEM,
              metadata: {
                type: ChatMessageType.SYSTEM,
                isSourcesList: true
              }
            });
          }
          
          return researchResult;
        } catch (error) {
          // Enhanced error handling
          const normalizedError = normalizeError(error);
          
          get().setError(normalizedError.message);
          get().updateWorkflowStep(DomainOnlyWorkflowStep.ERROR, {
            error: normalizedError.message,
            errorDetails: normalizedError.data || {},
            errorTimestamp: new Date().toISOString()
          });
          
          // Update research state
          set((state) => ({
            ...state,
            research: {
              ...state.research,
              isActive: false,
              progress: 0
            }
          }));
          
          // Add error message
          get().addSystemMessage(
            `Research failed: ${normalizedError.message}`,
            ChatMessageType.ERROR,
            { errorCode: normalizedError.code }
          );
          
          throw error;
        } finally {
          set({ isLoading: false });
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