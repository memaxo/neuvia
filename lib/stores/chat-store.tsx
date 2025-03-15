"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createContext, type ReactNode } from "react";

// Import types from the application
import type { UUID, Timestamp } from "@/lib/types/base";
import {
  ChatMessageType,
  createUserMessage,
  createAssistantMessage,
  createSystemMessage,
  createErrorMessage,
  createProgressMessage,
  type ChatMessage,
  type ChatMessageMetadata,
} from "@/lib/types/chat";
import type {
  WorkflowStep,
  WorkflowState,
  ProcessingPhase,
  MessageMetadata as WorkflowMessageMetadata
} from "@/lib/types/workflow";
import { 
  DomainOnlyWorkflowStep,
  ProcessingPhase as PhaseEnum,
} from "@/lib/types/workflow";
import { VerificationStatus } from "@/lib/types/verification";
import type { VerificationItem, VerificationResult } from "@/lib/types/verification";
import type { ResearchOptions, ResearchResult } from "@/lib/types/research";
import { EVENT_TYPES } from "@/lib/types/events";
import type { DocumentProcessedEventPayload, DocumentStatusEventPayload } from "@/lib/types/events";
import { normalizeError, ApplicationError } from "@/lib/errors";
import logger from "@/lib/logger";

// Direct domain service imports
import { documentService } from "@/lib/services/document/document-service";
import { verificationService } from "@/lib/services/verification/verification-service";
import { reportService } from "@/lib/services/report/report-service";
import { perplexityService } from "@/lib/services/perplexity/perplexity-service";
import { workflowService } from "@/lib/services/workflow/core/workflow-service";
import { chatService } from "@/lib/services/chat/chat-service";

// Use error handler from the chat error utility
import { ChatWorkflowErrorHandler } from "@/lib/workflow/services/chat-workflow-error-handler";
import { eventService } from "@/lib/services/event-service";


// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * Simple enumeration for high-level chat mode.
 */
export type ChatMode = "default" | "verification" | "research";

/**
 * Verification state for the UI store only.
 */
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

/**
 * Research UI state
 */
interface ResearchState {
  query: string | null;
  result: ResearchResult | null;
  isActive: boolean;
  progress: number;
}

/**
 * Combined store interface for the chat UI.
 */
export interface ChatStore {
  // UI states
  isLoading: boolean;
  error: string | null;
  mode: ChatMode;
  chatId?: string;
  workflowId?: string;

  // The local in-memory list of messages
  messages: ChatMessage[];

  // Overall workflow state (phase, progress, etc.), but we keep it minimal here
  workflow: WorkflowState;

  // Verification
  verification: VerificationState;

  // Research
  research: ResearchState;

  // Document processing UI states
  docProgress: number;
  isDocProcessing: boolean;
  extractedDocument: Record<string, unknown> | null;

  // Basic report generation status
  reportGeneration?: {
    isComplete: boolean;
    format: Record<string, unknown>;
    reportId?: string;
  };

  // ============ Actions ============

  // UI state management
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setMode: (mode: ChatMode) => void;
  resetChat: () => void;

  // Message management
  addMessage: (message: ChatMessage | Omit<ChatMessage, "id">) => void;
  updateMessages: (messages: ChatMessage[]) => void;
  updateMessageProgress: (messageId: string, progress: number, phase: string) => void;

  // Workflow state
  updateWorkflowStep: (step: WorkflowStep, metadata?: Record<string, unknown>) => Promise<void>;
  updateProgress: (progress: number, phase?: ProcessingPhase) => void;
  syncWorkflowState: (state: WorkflowState) => void;
  subscribeToWorkflowUpdates: () => () => void;

  // Verification
  startVerification: (content: string, items?: VerificationItem[]) => Promise<void>;
  submitCorrection: (correction: string) => void;
  completeVerification: (isApproved: boolean) => Promise<VerificationResult>;
  handleCorrectionMessage: (correction: string) => Promise<void>;
  confirmVerification: () => Promise<VerificationResult>;
  resetVerification: () => Promise<{ success: boolean }>;

  // Basic domain or doc pipeline (calls domainCoordinator under the hood)
  processDocument: (
    file: File,
    patientId: string,
    documentType?: string
  ) => Promise<Record<string, unknown>>;
  resetDocumentProcessing: () => void;

  // Simplified message sending for UI
  sendMessage: (
    content: string,
    options?: { isCorrection?: boolean; metadata?: ChatMessageMetadata }
  ) => Promise<void>;

  // Subscribes to domain events (document status, processed, etc.)
  subscribeToEvents: () => () => void;

  // Helper methods to add messages in a standardized way
  addSystemMessage: (
    content: string,
    type?: ChatMessageType,
    metadata?: Record<string, unknown>
  ) => ChatMessage;
  postSummaryMessage: (summary: string) => ChatMessage;
  updateSummaryAfterCorrection: (newSummary: string) => ChatMessage;
  clearMessages: () => void;

  // Research
  performResearch: (query: string, options?: ResearchOptions) => Promise<ResearchResult>;
}

// =============================================================================
// Error Handler
// =============================================================================

/**
 * Create a single shared error handler instance in this store for consistent usage.
 * Reused across the store methods. We pass store actions in so it can post messages, etc.
 */
function buildChatStoreErrorHandler(store: ChatStore) {
  const formatErrorMessage = (errMsg: string, context?: Record<string, unknown>) => {
    const category = context?.category || "general";
    switch (category) {
      case "network":
        return `Network error: ${errMsg}. Check your connection.`;
      case "permission":
        return `Permission error: ${errMsg}. You might lack access rights.`;
      case "validation":
        return `Validation error: ${errMsg}. Verify your input and try again.`;
      case "processing":
        return `Processing error: ${errMsg}. Encountered an issue in data processing.`;
      case "verification":
        return `Verification error: ${errMsg}. Something went wrong verifying data.`;
      case "report":
        return `Report error: ${errMsg}. Issue generating your report.`;
      default:
        return `Error: ${errMsg}`;
    }
  };

  // Handler to show system error messages in the chat
  const postErrorMessageToChat = (msg: string, metadata?: Record<string, unknown>) => {
    store.addMessage(createErrorMessage(msg, metadata?.error));
  };

  return new ChatWorkflowErrorHandler(formatErrorMessage, postErrorMessageToChat);
}

// =============================================================================
// Zustand Store
// =============================================================================

export const useChatStore = create<ChatStore>()(
  devtools((set, get) => {
    // The store's single error handler instance
    let storeRef: ChatStore | null = null;
    const ephemeralErrorHandler = {
      handleError: (error: unknown, context?: Record<string, unknown>) => {
        // fallback
        console.warn("Store not yet initialized, ephemeral error. Error:", error, context);
      },
    };

    /**
     * Build store's base structure. We'll fill in references after definition.
     */
    const store: ChatStore = {
      // =========================
      // UI State
      // =========================
      isLoading: false,
      error: null,
      mode: "default",
      chatId: undefined,
      workflowId: undefined,

      messages: [],
      workflow: {
        currentStep: DomainOnlyWorkflowStep.IDLE,
        progress: 0,
        phase: PhaseEnum.INITIALIZATION,
        error: null,
        metadata: {},
        timestamp: new Date().toISOString(),
      },

      verification: {
        isInVerificationMode: false,
        currentSummary: null,
        verificationStatus: VerificationStatus.pending,
        verificationItems: [],
        summaryVersions: [],
      },

      research: {
        query: null,
        result: null,
        isActive: false,
        progress: 0,
      },

      docProgress: 0,
      isDocProcessing: false,
      extractedDocument: null,

      reportGeneration: {
        isComplete: false,
        format: {},
      },

      // =========================
      // UI / Basic State Methods
      // =========================
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setMode: (mode) => set({ mode }),

      generateReport: async () => {
        try {
          // Check prerequisites
          if (!get().verification.isInVerificationMode &&
              get().verification.verificationStatus !== VerificationStatus.completed) {
            get().addSystemMessage(
              "Please complete verification before generating a report.",
              ChatMessageType.SYSTEM
            );
            return { success: false, error: "Verification not completed" };
          }
          
          const patientId = get().patientId;
          const documentId = get().extractedDocument?.id as string;
          
          if (!patientId || !documentId) {
            get().addSystemMessage(
              "Missing patient or document information for report generation.",
              ChatMessageType.ERROR
            );
            return { success: false, error: "Missing required data" };
          }
          
          // Update UI
          set({ isLoading: true });
          get().addSystemMessage("Generating the formal patient report...");
          
          // Create a progress message
          const progressMsg = createProgressMessage(
            "Generating report...",
            0,
            ProcessingPhase.REPORT_GENERATION
          );
          get().addMessage(progressMsg);
          
          // Update workflow step
          if (get().workflowId) {
            await get().updateWorkflowStep('report_generation', {
              reportGenerationStartedAt: new Date().toISOString(),
              patientId,
              documentId,
              verificationId: get().verification.verificationId
            });
          }
          
          // Directly call reportService
          const result = await reportService.generateReport({
            type: 'medical-diagnosis',
            patientId,
            researchData: {
              text: get().verification.currentSummary || "",
              sources: [],
              summary: get().verification.currentSummary || "",
              keyFindings: get().verification.verificationItems?.map(item => item.field + ": " + item.value) || [],
              timestamp: new Date(),
              confidence: 0.9,
              modelName: 'verification'
            },
            contextData: {
              userId: get().userId,
              patient: {
                id: patientId,
                firstName: get().extractedDocument?.patientFirstName || "Unknown",
                lastName: get().extractedDocument?.patientLastName || "Patient",
              },
              verificationId: get().verification.verificationId,
              documentId
            },
            saveToDatabase: true
          }, {
            onProgress: (phase, progress) => {
              get().updateMessageProgress(progressMsg.id, progress, phase);
            }
          });
          
          // Update progress to 100%
          get().updateMessageProgress(progressMsg.id, 100, ProcessingPhase.COMPLETION);
          
          // Update workflow step if we have a workflow ID
          if (get().workflowId) {
            await get().updateWorkflowStep('complete', {
              reportId: result.report.id,
              reportGeneratedAt: new Date().toISOString(),
              reportType: result.report.reportType
            });
          }
          
          // Update store
          set({
            reportGeneration: {
              isComplete: true,
              reportId: result.report.id,
              format: result.report
            },
            isLoading: false
          });
          
          // Add completion message and report content
          get().addSystemMessage(
            "Report generated successfully",
            ChatMessageType.SYSTEM,
            { isComplete: true }
          );
          
          // Extract sections from the report to show as a message
          const reportContent = Object.values(result.report.sections)
            .sort((a, b) => a.order - b.order)
            .map(section => `## ${section.title}\n\n${section.content}`)
            .join('\n\n');
          
          get().addMessage(createAssistantMessage(
            reportContent,
            {
              type: ChatMessageType.REPORT,
              reportId: result.report.id,
              reportGenerated: true
            }
          ));
          
          return {
            success: true,
            reportId: result.report.id,
            report: result
          };
        } catch (err) {
          ephemeralErrorHandler.handleError(err, {
            domain: "report",
            step: "generateReport",
          });
          
          get().addSystemMessage(
            `Error generating report: ${normalizeError(err).message}`,
            ChatMessageType.ERROR
          );
          
          set({ isLoading: false });
          
          return {
            success: false,
            error: normalizeError(err).message
          };
        }
      },
      
      resetChat: () => {
        set({
          isLoading: false,
          error: null,
          mode: "default",
          messages: [],
          workflow: {
            currentStep: DomainOnlyWorkflowStep.IDLE,
            progress: 0,
            phase: PhaseEnum.INITIALIZATION,
            error: null,
            metadata: {},
            timestamp: new Date().toISOString(),
          },
          verification: {
            isInVerificationMode: false,
            currentSummary: null,
            verificationStatus: VerificationStatus.pending,
            verificationItems: [],
            summaryVersions: [],
          },
          research: {
            query: null,
            result: null,
            isActive: false,
            progress: 0,
          },
          docProgress: 0,
          isDocProcessing: false,
          extractedDocument: null,
          reportGeneration: {
            isComplete: false,
            format: {},
          },
        });
      },

      // =========================
      // Message Handling
      // =========================
      addMessage: (message) => {
        try {
          const msgWithId =
            "id" in message ? (message as ChatMessage) : { ...message, id: crypto.randomUUID() };
          set((state) => ({
            ...state,
            messages: [...state.messages, msgWithId],
          }));
        } catch (error) {
          ephemeralErrorHandler.handleError(error, {
            domain: "chat",
            step: "addMessage",
          });
        }
      },

      updateMessages: (messages: ChatMessage[]) => {
        set({ messages });
      },

      updateMessageProgress: (messageId, progress, phase) => {
        try {
          set((state) => {
            const updated = state.messages.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    metadata: {
                      ...m.metadata,
                      progress: {
                        value: progress,
                        phase,
                        updatedAt: new Date().toISOString(),
                      },
                    },
                  }
                : m
            );
            return { messages: updated };
          });
        } catch (error) {
          ephemeralErrorHandler.handleError(error, {
            domain: "chat",
            step: "updateMessageProgress",
          });
        }
      },

      // =========================
      // Workflow State
      // =========================
      updateWorkflowStep: async (step, metadata) => {
        try {
          const workflowId = get().workflowId;
          if (!workflowId) {
            throw new Error("Missing workflow ID for step update");
          }
          
          // Directly call workflowService
          const result = await workflowService.updateWorkflowState(
            workflowId,
            step,
            {
              ...metadata,
              userId: get().userId,
              updatedAt: new Date().toISOString()
            }
          );
          
          if (result.isFailure()) {
            throw new ApplicationError({
              message: result.error.message,
              code: result.error.code,
              data: result.error.details
            });
          }
          
          // Reflect new step in store
          set((state) => ({
            workflow: {
              ...state.workflow,
              currentStep: step,
              metadata: { ...state.workflow.metadata, ...metadata },
              timestamp: new Date().toISOString(),
            },
          }));
          
          return result.value; // Return the transaction ID
        } catch (error) {
          ephemeralErrorHandler.handleError(error, {
            domain: "workflow",
            step,
            details: metadata,
          });
          
          // Log but don't throw to avoid UI disruption
          logger.error("Failed to update workflow step", {
            workflowId: get().workflowId,
            step,
            error: normalizeError(error).message
          });
        }
      },

      updateProgress: (progress, phase) => {
        // Update local store's workflow progress
        set((state) => ({
          workflow: {
            ...state.workflow,
            progress,
            phase: phase ?? state.workflow.phase,
          },
          docProgress: progress,
        }));
      },

      syncWorkflowState: (workflowState) => {
        set((state) => ({
          workflow: {
            ...state.workflow,
            ...workflowState,
          },
        }));
      },

      subscribeToWorkflowUpdates: () => {
        const workflowId = get().workflowId;
        if (!workflowId) {
          return () => {}; // No-op if we don't have a workflow ID
        }
        
        // Directly use workflowService
        const channel = workflowService.subscribeToWorkflowChanges(
          workflowId,
          (payload) => {
            // Extract workflow state from payload
            const newData = payload.new;
            
            if (newData && typeof newData === 'object') {
              const workflowState = {
                currentStep: newData.current_step as WorkflowStep,
                progress: typeof newData.metadata?.progress === 'number'
                  ? newData.metadata.progress : 0,
                phase: newData.metadata?.phase as ProcessingPhase || PhaseEnum.PROCESSING,
                error: newData.metadata?.error as string || null,
                metadata: newData.metadata || {},
                timestamp: newData.updated_at || new Date().toISOString()
              };
              
              // Sync the workflow state to our local store
              get().syncWorkflowState(workflowState);
              
              // Handle error states
              if (workflowState.error &&
                  (workflowState.currentStep === DomainOnlyWorkflowStep.ERROR ||
                   workflowState.currentStep === 'error')) {
                get().addSystemMessage(
                  `Workflow error: ${workflowState.error}`,
                  ChatMessageType.ERROR
                );
              }
            }
          }
        );
        
        return () => {
          workflowService.unsubscribeFromChannel(channel);
        };
      },

      // =========================
      // Verification
      // =========================
      startVerification: async (content, items = []) => {
        try {
          set({ isLoading: true, mode: "verification" });
          
          // Add a system message prompting user to confirm or correct
          get().addSystemMessage(
            "Starting verification mode. Please confirm or provide corrections.",
            ChatMessageType.VERIFICATION
          );
          
          // If we have a workflow ID, call verification service to initiate verification
          if (get().workflowId) {
            const workflowId = get().workflowId;
            
            // Create a progress message for verification initialization
            const progressMsg = createProgressMessage(
              "Preparing verification...",
              10,
              ProcessingPhase.VERIFICATION_PENDING
            );
            get().addMessage(progressMsg);
            
            // Call verification service to initiate
            const result = await verificationService.initiateVerification(
              workflowId,
              {
                userId: get().userId,
                documentId: get().extractedDocument?.id as string,
                documentData: {
                  content,
                  items,
                  ...get().extractedDocument
                },
                autoGenerateReport: false,
                onProgress: (progress, phase) => {
                  get().updateMessageProgress(progressMsg.id, progress, phase);
                }
              }
            );
            
            if (result.success) {
              // Update verification state with data from the service
              set((state) => ({
                verification: {
                  ...state.verification,
                  isInVerificationMode: true,
                  verificationStatus: VerificationStatus.pending,
                  verificationItems: items,
                  currentSummary: content,
                  verificationId: result.data.verificationId,
                  summaryId: result.data.summaryId
                },
              }));
              
              // Update progress message to completion
              get().updateMessageProgress(progressMsg.id, 100, ProcessingPhase.VERIFICATION_PENDING);
            } else {
              throw new Error(result.error?.message || "Failed to start verification");
            }
          } else {
            // No workflow ID, just update local state
            set((state) => ({
              verification: {
                ...state.verification,
                isInVerificationMode: true,
                verificationStatus: VerificationStatus.pending,
                verificationItems: items,
                currentSummary: content,
              },
            }));
          }
          
          // Post the summary message in the chat
          get().postSummaryMessage(content);
          set({ isLoading: false });
        completeVerification: async (isApproved) => {
        try {
          set({ isLoading: true });
          
          const workflowId = get().workflowId;
          
          get().addSystemMessage(
            `Error starting verification: ${normalizeError(err).message}`,
            ChatMessageType.ERROR
          );
          
          if (!workflowId) {
            throw new Error("Missing workflow ID for verification completion");
          }
          
          // Create a progress message
          const progressMsg = createProgressMessage(
            isApproved ? "Completing verification..." : "Rejecting verification...",
            0,
            isApproved ? ProcessingPhase.VERIFICATION_COMPLETION : ProcessingPhase.VERIFICATION_REJECTION
          );
          get().addMessage(progressMsg);
          
          // Directly call verification service
          const result = await verificationService.completeVerification(
            workflowId,
            isApproved,
            {
              userId: get().userId,
              verificationId: get().verification.verificationId,
              comments: get().verification.currentSummary,
              items: get().verification.verificationItems
            }
          );
          
          // Update progress to 100%
          get().updateMessageProgress(progressMsg.id, 100, "verification_complete");
          
          // Show system or error messages based on result
          if (result.success) {
            get().addSystemMessage(
              isApproved 
                ? "Verification completed successfully."
                : "Verification was not approved. You may need more corrections."
            );
            
            // If verified, exit verification mode and update workflow step
            if (isApproved) {
              set((state) => ({
                mode: "default",
                verification: {
                  ...state.verification,
                  isInVerificationMode: false,
                  verificationStatus: VerificationStatus.completed,
                },
              }));
              
              // Update workflow step if approval was successful
              if (get().workflowId) {
                await get().updateWorkflowStep('verification_completed', {
                  verificationId: get().verification.verificationId,
                  verifiedAt: new Date().toISOString(),
                  verifiedBy: get().userId
                });
              }
              
              // Prompt for report generation
              get().addSystemMessage(
                "Verification complete. Would you like to generate a report?",
                ChatMessageType.SYSTEM,
                { showReportOption: true }
              );
            }
          } else {
            get().addSystemMessage(
              `Verification failed: ${result.error?.message || "Unknown error"}`,
              ChatMessageType.ERROR
            );
          }
          
          set({ isLoading: false });
          return result;
        } catch (err) {
          ephemeralErrorHandler.handleError(err, {
            domain: "verification",
            step: "completeVerification",
            details: { isApproved },
          });
          
          get().addSystemMessage(
            `Error completing verification: ${normalizeError(err).message}`,
            ChatMessageType.ERROR
          );
          
          set({ isLoading: false });
          
          return {
            isCompleted: false,
          submitCorrection: (correction) => {
        // Just add the user's correction as a message, then handle correction logic
        get().addMessage(createUserMessage(correction, { isCorrection: true }));
        
        // Defer actual correction processing
        setTimeout(() => {
          get().handleCorrectionMessage(correction).catch((err) => {
            ephemeralErrorHandler.handleError(err, {
              domain: "verification",
              step: "submitCorrection",
              correction,
            });
          });
        }, 0);
      },
    
      handleCorrectionMessage: async (correction) => {
        try {
          // Get necessary data from store
          const workflowId = get().workflowId;
          const currentSummary = get().verification.currentSummary || "";
          const verificationId = get().verification.verificationId;
          
          if (!workflowId || !currentSummary) {
    
      confirmVerification: async () => {
        try {
          // Add a user message for the confirmation
          get().addMessage(createUserMessage("confirm", { isConfirmation: true }));
          
          // Call the complete verification method with approval
          const result = await get().completeVerification(true);
          return result;
        } catch (err) {
          ephemeralErrorHandler.handleError(err, {
            domain: "verification",
            step: "confirmVerification",
          });
          
          return {
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
          };
        }
      },
          
          // Show a progress message
          const progressId = crypto.randomUUID();
          get().addMessage({
            id: progressId,
            role: "system",
            content: "Applying correction...",
            createdAt: new Date().toISOString(),
            type: ChatMessageType.PROGRESS,
            metadata: {
              type: ChatMessageType.PROGRESS,
              progress: { value: 0, phase: "correction" },
            },
          });
          
          // Directly call verification service
          const result = await verificationService.processCorrection({
            workflowId,
            userId: get().userId,
            correction: {
              correctionText: correction,
              currentSummary,
              userId: get().userId,
              verificationId
            },
            messageId: progressId
          });
          
          // Update progress to 100%
          get().updateMessageProgress(progressId, 100, "correction_done");
          
          if (result.success && result.data?.summary) {
            // Overwrite the store's summary with corrected version
            set((state) => ({
              verification: {
                ...state.verification,
                currentSummary: result.data.summary,
                verificationStatus: VerificationStatus.inProgress,
                summaryId: result.data.summaryId,
                summaryVersions: [
                  ...state.verification.summaryVersions,
                  {
                    id: result.data.summaryId || crypto.randomUUID(),
                    content: result.data.summary,
                    timestamp: new Date().toISOString(),
                    userId: get().userId
                  },
                ],
              },
            }));
            
            // Add the corrected summary to the chat
            get().updateSummaryAfterCorrection(result.data.summary);
            
            // Prompt user for next action
            get().addSystemMessage(
              "Correction applied. Type 'confirm' to finalize or provide further edits.",
              ChatMessageType.VERIFICATION
            );
          } else {
            // Show error message
            get().addSystemMessage(
              `Correction failed: ${result.error || "Unknown error"}`,
              ChatMessageType.ERROR
            );
          }
        } catch (err) {
          ephemeralErrorHandler.handleError(err, {
            domain: "verification",
            step: "processCorrection",
            correction,
          });
          
          get().addSystemMessage(
            `Error applying correction: ${normalizeError(err).message}`,
            ChatMessageType.ERROR
          );
          
          throw err;
        }
      },

      confirmVerification: async () => {
        try {
          // Confirm final verification
          const result = await get().completeVerification(true);
          return result;
        } catch (err) {
          ephemeralErrorHandler.handleError(err, {
            domain: "verification",
            step: "confirmVerification",
          });
          return {
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
          };
        }
      },

      resetVerification: async () => {
        try {
          // Let domain coordinator reset verification state
          const result = await domainCoordinator.resetVerification(get().workflowId);
          if (result.success) {
            set((state) => ({
              verification: {
                isInVerificationMode: false,
                currentSummary: null,
                verificationStatus: VerificationStatus.pending,
                verificationItems: [],
                summaryVersions: [],
              },
            }));
          }
          return result;
        } catch (err) {
          ephemeralErrorHandler.handleError(err, {
            domain: "verification",
            step: "resetVerification",
          });
          return { success: false };
        }
      },
    processDocument: async (
        file: File,
        patientId: string,
        documentType?: string
      ) => Promise<Record<string, unknown>> => {
        try {
          set({ isLoading: true, isDocProcessing: true, docProgress: 0 });
          
          // Add a system message for tracking progress
          const msg = createSystemMessage(
            `Processing document: ${file.name}`,
            {
              isProgress: true,
              fileName: file.name,
              fileSize: file.size,
              patientId,
              documentType,
            }
          );
          get().addMessage(msg);
          
          // Directly call documentService
          const result = await documentService.processDocument(file, {
            patientId,
            documentType: documentType ? {
              category: documentType.split('/')[0] || 'clinical',
              type: documentType.split('/')[1] || 'note'
            } : undefined,
            onStatusUpdate: (status) => {
              // Update progress in UI
              get().updateMessageProgress(msg.id, status.progress, status.phase);
              set({ docProgress: status.progress });
            },
            metadata: {
              uploadedBy: get().userId,
              workflowId: get().workflowId,
            }
          });
          
          if (result.isProcessed) {
            set({
              isDocProcessing: false,
              docProgress: 100,
              extractedDocument: result.extractedData ?? null,
            });
            
            // Add success message
            get().addSystemMessage(
              `Document processed: ${file.name}`,
              ChatMessageType.SYSTEM,
              { isCompleted: true }
            );
            
            // If we have workflow ID, update the workflow step
            if (get().workflowId) {
              await get().updateWorkflowStep('verification_pending', {
                documentId: result.id,
                extractedAt: new Date().toISOString(),
                fileName: file.name
              });
            }
          } else {
            throw new ApplicationError({
              message: result.processingError || "Processing failed",
              code: "DOC_PROCESS_ERR"
            });
          }
          
          set({ isLoading: false });
          return {
            success: true,
            documentId: result.id,
            extractedData: result.extractedData,
            fileName: file.name
          };
        } catch (err) {
          ephemeralErrorHandler.handleError(err, {
            domain: "document",
            step: "processDocument",
            fileName: file.name,
          });
          
          get().addSystemMessage(
            `Document processing error: ${normalizeError(err).message}`,
            ChatMessageType.ERROR
          );
          
          set({ isLoading: false, isDocProcessing: false });
          
          return {
            success: false,
            error: normalizeError(err).message
          };
        }
      },

      resetDocumentProcessing: () => {
        set({
          isDocProcessing: false,
          docProgress: 0,
          extractedDocument: null,
        });
      },

      // =========================
      // Send Message
      // =========================
      sendMessage: async (content, options) => {
        try {
          if (!content || !content.trim()) return;
          
          const { isCorrection = false, metadata } = options || {};
          
          // Add user message
          get().addMessage(createUserMessage(content, { ...metadata, isCorrection }));
          
          // Branch by mode
          const mode = get().mode;
          
          // Process verification mode messages
          if (mode === "verification") {
            const contentLower = content.toLowerCase().trim();
            
            if (contentLower === "confirm") {
              await get().confirmVerification();
            } else {
              // treat as correction
              get().submitCorrection(content);
            }
            return;
          }
          
          // Process research mode messages
          if (mode === "research") {
            if (get().research.isActive) {
              get().addSystemMessage("Research is already in progress.");
            } else {
              await get().performResearch(content);
            }
            return;
          }
          
          // Default mode - handle based on intent
          const contentLower = content.toLowerCase().trim();
          
          // Report generation intent
          if (contentLower.includes("generate report") ||
              contentLower.includes("create report") ||
              contentLower === "report") {
            await get().generateReport();
            return;
          }
          
          // Research intent
          if (contentLower.includes("research") ||
              contentLower.includes("look up") ||
              contentLower.includes("find information")) {
            await get().performResearch(content);
            return;
          }
          
          // Otherwise, handle as a regular chat message
          // In a real implementation, you would call your AI service here
          
          // For now, just simulate an AI response
          set({ isLoading: true });
          
          try {
            // Call chatService for a response or your AI service
            const response = await chatService.generateAssistantResponse(content, {
              workflowId: get().workflowId || '',
              chatId: get().chatId || '',
              context: {
                isResearchModeActive: mode === "research",
                isVerificationModeActive: mode === "verification",
                isReportModeActive: false,
                patientId: get().patientId
              },
              model: "default",
              patientId: get().patientId,
              documentId: get().extractedDocument?.id,
              userId: get().userId
            });
            
            // Add the assistant message
            get().addMessage(createAssistantMessage(response));
            
          } catch (aiError) {
            get().addSystemMessage(
              `Error getting response: ${normalizeError(aiError).message}`,
              ChatMessageType.ERROR
            );
          }
          
          set({ isLoading: false });
          
        } catch (err) {
          ephemeralErrorHandler.handleError(err, {
            domain: "chat",
            step: "sendMessage",
            content,
          });
        }
      },

      // =========================
      // Subscribe to domain events
      // =========================
      subscribeToEvents: () => {
        const unsubDocumentStatus = eventService.subscribe(EVENT_TYPES.DOCUMENT_STATUS, (payload: DocumentStatusEventPayload) => {
          set({ docProgress: payload.status.progress ?? 0 });
          const progs = get().messages.filter((m) => m.metadata?.isProgress && !m.metadata?.isCompleted);
          if (progs.length > 0) {
            const lastProg = progs[progs.length - 1];
            get().updateMessageProgress(lastProg.id, payload.status.progress ?? 0, payload.status.phase ?? "processing");
          }
        });
        const unsubDocumentProcessed = eventService.subscribe(
          EVENT_TYPES.DOCUMENT_PROCESSED,
          (payload: DocumentProcessedEventPayload) => {
            set({ 
              extractedDocument: payload.document,
              docProgress: 100,
              isDocProcessing: false,
            });
            get().addSystemMessage(`Document processed: ${payload.document.fileName}`, ChatMessageType.SYSTEM, {
              isProgress: true,
              isCompleted: true,
            });
          }
        );
        const unsubWorkflow = get().subscribeToWorkflowUpdates();
        return () => {
          unsubDocumentStatus();
          unsubDocumentProcessed();
          unsubWorkflow();
        };
      },

      // =========================
      // Helper Methods
      // =========================
      addSystemMessage: (content, type, metadata) => {
        const msg = createSystemMessage(content, {
          ...metadata,
          type: type || ChatMessageType.SYSTEM,
        });
        get().addMessage(msg);
        return msg;
      },

      postSummaryMessage: (summary) => {
        const msg = createAssistantMessage(summary, { type: ChatMessageType.SUMMARY });
        get().addMessage(msg);
        return msg;
      },

      updateSummaryAfterCorrection: (newSummary) => {
        const msg = createAssistantMessage(newSummary, { type: ChatMessageType.SUMMARY });
        get().addMessage(msg);
        return msg;
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      // =========================
      // Research
      // =========================
      performResearch: async (query, options) => {
        try {
          // Update store state to indicate research is starting
          set((state) => ({
            mode: "research",
            research: { ...state.research, isActive: true, query, progress: 0 },
            isLoading: true,
          }));
          
          // Create a progress message
          const progressMsg = createProgressMessage(
            `Researching: "${query}"`,
            0,
            ProcessingPhase.RESEARCH
          );
          get().addMessage(progressMsg);
          
          // Directly call perplexityService
          const result = await perplexityService.performDeepResearch(
            query,
            {
              ...options,
              onProgress: (progress) => {
                // Update both message and store progress
                get().updateMessageProgress(progressMsg.id, progress, ProcessingPhase.RESEARCH);
                set((state) => ({
                  research: { ...state.research, progress },
                }));
              },
              patientId: get().patientId,
              userId: get().userId
            }
          );
          
          // Update progress to 100%
          get().updateMessageProgress(progressMsg.id, 100, ProcessingPhase.COMPLETION);
          
          // Add the results as a chat message
          get().addMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.summary || result.text || "No summary provided.",
            createdAt: new Date().toISOString(),
            type: ChatMessageType.RESEARCH,
            metadata: {
              type: ChatMessageType.RESEARCH,
              isResearchResult: true,
              query,
              sources: result.sources,
              confidence: result.confidence,
              modelName: result.modelName
            },
          });
          
          // Update store state to indicate research is complete
          set((state) => ({
            isLoading: false,
            research: {
              ...state.research,
              isActive: false,
              progress: 100,
              result: result,
            },
          }));
          
          // If workflow exists, update it
          if (get().workflowId) {
            await get().updateWorkflowStep('complete', {
              researchId: crypto.randomUUID(),
              researchQuery: query,
              researchCompletedAt: new Date().toISOString()
            });
          }
          
          return result;
        } catch (err) {
          ephemeralErrorHandler.handleError(err, {
            domain: "research",
            step: "performResearch",
            query,
          });
          
          get().addSystemMessage(
            `Research error: ${normalizeError(err).message}`,
            ChatMessageType.ERROR
          );
          
          set((state) => ({
            isLoading: false,
            research: { ...state.research, isActive: false, progress: 0 },
          }));
          
          throw err;
        }
      },
    };

    // Build error handler with the store reference
    const errorHandler = buildChatStoreErrorHandler(store);
    (ephemeralErrorHandler.handleError as any) = (error: unknown, context?: Record<string, unknown>) => {
      errorHandler.handleError(error, context);
    };
    storeRef = store;

    return store;
  }, { name: "chat-store" })
);

// =============================================================================
// ChatProvider for usage in React components
// =============================================================================

export function ChatProvider({ children }: { readonly children: ReactNode }) {
  return children;
}

export function useChatState(): ChatStore {
  return useChatStore();
}

// Basic custom hook to get a direct reference to the chat store's error handler
// The store creates a single ChatWorkflowErrorHandler. Usually we don't need
// this if we route all errors via the store's ephemeralErrorHandler or domain calls.
export function useErrorHandler() {
  // We can just re-use ephemeral approach
  const store = useChatStore();
  return {
    handleError: (error: unknown, context?: Record<string, unknown>) => {
      const normalized = normalizeError(error);
      store.addSystemMessage(`Error: ${normalized.message}`, ChatMessageType.ERROR, context);
    },
  };
}