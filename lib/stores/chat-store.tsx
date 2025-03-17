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
import type { ResearchOptions, ResearchResult } from "@/lib/types/research";
import { EVENT_TYPES } from "@/lib/types/events";
import type { DocumentProcessedEventPayload, DocumentStatusEventPayload } from "@/lib/types/events";
import { normalizeError, ApplicationError } from "@/lib/errors";
import logger from "@/lib/logger";

// Domain service imports
import { documentService } from "@/lib/services/document/document-service";
import { reportService } from "@/lib/services/report/report-service";
import { perplexityService } from "@/lib/services/perplexity/perplexity-service";
import { eventService } from "@/lib/services/event-service";

// LangGraph and RAG specific imports
import { 
  createInitialWorkflowState, 
  type WorkflowState,
  type WorkflowProgress 
} from "@/lib/workflow/state/workflow-state";
import { 
  createSupabaseCheckpointer, 
  type SupabaseCheckpointer,
  type ThreadListOptions,
  type ThreadMetadata,
  ThreadStatus
} from "@/lib/workflow/checkpointer/supabase-checkpointer";
import { createSupervisorWorkflow } from "@/lib/workflow/graphs/supervisor-workflow";
import { 
  ragRetrievalService, 
  ragMemoryService 
} from "@/lib/services/rag";
import type { DocumentChunk, DocumentSource } from "@/lib/types/rag";

// Error handling
import { ChatWorkflowErrorHandler } from "@/lib/workflow/services/chat-workflow-error-handler";


// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * Simple enumeration for high-level chat mode.
 */
export type ChatMode = "default" | "research";

/**
 * RAG context information
 */
interface RagContext {
  retrievedChunks: DocumentChunk[];
  sources: DocumentSource[];
  lastQuery?: string;
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
 * Combined store interface for the chat UI built around LangGraph.
 */
export interface ChatStore {
  // Core identifiers
  threadId?: string;  // LangGraph thread ID - primary identifier
  patientId?: string; // Current patient context
  userId?: string;    // Current user
  chatId?: string;    // Legacy identifier (will be removed)

  // UI states
  isLoading: boolean;
  error: string | null;
  mode: ChatMode;

  // Chat UI
  messages: ChatMessage[];
  
  // LangGraph Integration
  workflowState?: WorkflowState;
  checkpointer: SupabaseCheckpointer;
  
  // RAG Context
  ragContext?: RagContext;

  // Research
  research: ResearchState;

  // Document processing UI states
  docProgress: number;
  isDocProcessing: boolean;
  extractedDocument: Record<string, unknown> | null;

  // Report generation status
  reportGeneration?: {
    isComplete: boolean;
    format: Record<string, unknown>;
    reportId?: string;
  };

  // ============ Actions ============

  // Core workflow actions
  initializeWorkflow: (patientId: string, userId: string) => Promise<string>;
  sendToWorkflow: (content: string) => Promise<void>;
  continueWorkflow: (action: string) => Promise<void>;
  handleWorkflowError: (error: any, context: any) => void;
  
  // UI state management
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setMode: (mode: ChatMode) => void;
  resetChat: (options?: { threadId?: string }) => Promise<void>;

  // Message management
  addMessage: (message: ChatMessage | Omit<ChatMessage, "id">) => void;
  updateMessages: (messages: ChatMessage[]) => void;
  updateMessageProgress: (messageId: string, progress: number, phase: string) => void;
  clearMessages: () => void;
  addSystemMessage: (
    content: string,
    type?: ChatMessageType,
    metadata?: Record<string, unknown>
  ) => ChatMessage;

  // State synchronization
  syncMessagesFromWorkflow: (state: WorkflowState) => void;
  updateWorkflowProgress: (progress: WorkflowProgress) => void;
  
  // LangGraph Checkpointing and Thread Management
  saveCheckpoint: () => Promise<void>;
  loadCheckpoint: (threadId: string) => Promise<boolean>;
  listCheckpoints: (options?: ThreadListOptions) => Promise<WorkflowState[]>;
  forkThread: (options?: { name?: string; metadata?: ThreadMetadata }) => Promise<string>;
  pauseThread: () => Promise<boolean>;
  completeThread: () => Promise<boolean>;
  archiveThread: (permanent?: boolean) => Promise<boolean>;
  restoreThread: (threadId: string) => Promise<boolean>;
  
  // RAG Integration
  clearRagContext: () => void;
  updateRagContext: (context: RagContext) => void;

  // Document processing
  processDocument: (
    file: File,
    patientId: string,
    documentType?: string
  ) => Promise<Record<string, unknown>>;
  resetDocumentProcessing: () => void;

  // Simplified message sending for UI (wraps sendToWorkflow)
  sendMessage: (
    content: string,
    options?: { metadata?: ChatMessageMetadata }
  ) => Promise<void>;

  // Event subscriptions
  subscribeToEvents: () => () => void;

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
    // Create the checkpointer instance
    const checkpointer = createSupabaseCheckpointer();
    
    const store: ChatStore = {
      // =========================
      // Core IDs
      // =========================
      threadId: undefined,
      patientId: undefined,
      userId: undefined,
      chatId: undefined,

      // =========================
      // UI State
      // =========================
      isLoading: false,
      error: null,
      mode: "default",
      messages: [],
      
      // =========================
      // LangGraph Integration
      // =========================
      workflowState: undefined,
      checkpointer,
      
      // =========================
      // RAG Context
      // =========================
      ragContext: undefined,

      // =========================
      // Research
      // =========================
      research: {
        query: null,
        result: null,
        isActive: false,
        progress: 0,
      },

      // =========================
      // Document Processing
      // =========================
      docProgress: 0,
      isDocProcessing: false,
      extractedDocument: null,

      // =========================
      // Report Generation
      // =========================
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
      
      resetChat: async (options) => {
        // If we have an active thread and it's not being replaced, 
        // mark it as completed before clearing
        const currentThreadId = get().threadId;
        if (currentThreadId && (!options?.threadId || options.threadId !== currentThreadId)) {
          try {
            // Only try to complete if we're not switching to a new thread
            if (!options?.threadId) {
              await get().completeThread();
            }
          } catch (error) {
            console.error('Error completing thread during reset:', error);
          }
        }
        
        set({
          isLoading: false,
          error: null,
          threadId: undefined,
          mode: "default",
          messages: [],
          workflowState: undefined,
          ragContext: undefined,
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
        
        // If a threadId is provided, try to restore from checkpoint
        if (options?.threadId) {
          await get().loadCheckpoint(options.threadId);
        }
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
        
        // Save checkpoint after state update if we have a threadId
        // We use setTimeout to avoid blocking the UI and make this non-blocking
        if (get().threadId) {
          setTimeout(() => {
            get().saveCheckpoint().catch(err => {
              console.error('Error auto-saving checkpoint:', err);
            });
          }, 0);
        }
      },

      subscribeToWorkflowUpdates: () => {
        // First attempt to subscribe to LangGraph updates through checkpointer
        const threadId = get().threadId;
        if (threadId) {
          // Set up a subscription for changes to the LangGraph workflow state
          try {
            const unsubscribe = get().checkpointer.subscribe(threadId, (state) => {
              if (state && state.threadId) {
                // Update the LangGraph state in the store
                set({ langGraphState: state });
                
                // Sync messages from the workflow state
                get().syncMessagesFromWorkflow(state);
              }
            });
            return unsubscribe;
          } catch (error) {
            console.error('Error setting up LangGraph subscription:', error);
            // Fall back to legacy workflow subscription
          }
        }
        
        // Legacy workflow subscription as fallback
        const workflowId = get().workflowId;
        if (workflowId) {
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
        }
        
        return () => {}; // No-op if we don't have any ID
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
      ) => {
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
          
          // Initialize workflow if needed
          if (!get().threadId) {
            const userId = get().userId || crypto.randomUUID();
            await get().initializeWorkflow(patientId, userId);
          }
          
          // Set patientId if not already set
          if (!get().patientId) {
            set({ patientId });
          }
          
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
              threadId: get().threadId,
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
            
            // Update workflow state
            if (get().threadId && get().workflowState) {
              const currentState = get().workflowState;
              const updatedState = {
                ...currentState,
                documentId: result.id,
                extractedData: {
                  text: result.extractedData?.text || '',
                  structuredData: result.extractedData || {},
                  extractedAt: new Date().toISOString(),
                },
                progress: {
                  ...currentState.progress,
                  currentStep: 'document_processed',
                  percentage: 100,
                }
              };
              
              // Update state and save checkpoint
              set({ workflowState: updatedState });
              await get().saveCheckpoint();
              
              // Continue the workflow to process the document
              await get().continueWorkflow('process_document');
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
          
          const { metadata } = options || {};
          
          // Add user message to UI
          get().addMessage(createUserMessage(content, { ...metadata }));
          
          // Branch by mode
          const mode = get().mode;
          
          // Process research mode messages
          if (mode === "research") {
            if (get().research.isActive) {
              get().addSystemMessage("Research is already in progress.");
            } else {
              await get().performResearch(content);
            }
            return;
          }
          
          // Default mode - determine action
          const contentLower = content.toLowerCase().trim();
          
          // Research intent
          if (contentLower.includes("research") ||
              contentLower.includes("look up") ||
              contentLower.includes("find information")) {
            await get().performResearch(content);
            return;
          }
          
          // Handle via LangGraph workflow
          if (get().threadId) {
            await get().sendToWorkflow(content);
            return;
          } 
          
          // No active thread - create one
          const userId = get().userId || crypto.randomUUID();
          const patientId = get().patientId || 'default';
          
          // Initialize workflow first
          const threadId = await get().initializeWorkflow(patientId, userId);
          
          // Then send the message to the new workflow
          await get().sendToWorkflow(content);
          
        } catch (err) {
          ephemeralErrorHandler.handleError(err, {
            domain: "chat",
            step: "sendMessage",
            content,
          });
          
          get().setLoading(false);
          
          get().addSystemMessage(
            `Error processing message: ${normalizeError(err).message}`,
            ChatMessageType.ERROR
          );
        }
      },

      // =========================
      // Subscribe to domain events
      // =========================
      subscribeToEvents: () => {
        // Document status updates
        const unsubDocumentStatus = eventService.subscribe(
          EVENT_TYPES.DOCUMENT_STATUS, 
          (payload: DocumentStatusEventPayload) => {
            set({ docProgress: payload.status.progress ?? 0 });
            
            // Update progress messages in the UI
            const progs = get().messages.filter((m) => m.metadata?.isProgress && !m.metadata?.isCompleted);
            if (progs.length > 0) {
              const lastProg = progs[progs.length - 1];
              get().updateMessageProgress(
                lastProg.id, 
                payload.status.progress ?? 0, 
                payload.status.phase ?? "processing"
              );
            }
            
            // Update workflow state with progress if available
            if (get().workflowState && get().threadId) {
              const currentState = get().workflowState;
              const updatedState = {
                ...currentState,
                progress: {
                  ...currentState.progress,
                  percentage: payload.status.progress ?? 0,
                  phase: payload.status.phase ?? currentState.progress?.phase
                },
                documentProcessingStatus: {
                  status: payload.status.status,
                  progress: payload.status.progress ?? 0,
                  phase: payload.status.phase,
                  updatedAt: new Date().toISOString()
                }
              };
              
              set({ workflowState: updatedState });
              
              // Save checkpoint without blocking UI
              setTimeout(() => {
                get().saveCheckpoint().catch(console.error);
              }, 0);
            }
          }
        );
        
        // Document completed processing
        const unsubDocumentProcessed = eventService.subscribe(
          EVENT_TYPES.DOCUMENT_PROCESSED,
          (payload: DocumentProcessedEventPayload) => {
            set({ 
              extractedDocument: payload.document,
              docProgress: 100,
              isDocProcessing: false,
            });
            
            get().addSystemMessage(
              `Document processed: ${payload.document.fileName}`, 
              ChatMessageType.SYSTEM, 
              {
                isProgress: true,
                isCompleted: true,
              }
            );
            
            // Update workflow state with document data
            if (get().threadId && get().workflowState) {
              const currentState = get().workflowState;
              const updatedState = {
                ...currentState,
                documentId: payload.document.id,
                extractedData: {
                  text: payload.document.text || '',
                  structuredData: payload.document,
                  extractedAt: new Date().toISOString()
                },
                progress: {
                  ...currentState.progress,
                  currentStep: 'document_processed',
                  percentage: 100,
                  phase: 'document_complete'
                }
              };
              
              set({ workflowState: updatedState });
              
              // Save checkpoint and continue workflow
              setTimeout(async () => {
                try {
                  await get().saveCheckpoint();
                  await get().continueWorkflow('process_document');
                } catch (error) {
                  console.error('Error updating workflow after document processing:', error);
                }
              }, 0);
            }
          }
        );
        
        // RAG context updates
        let unsubRagEvents = () => {};
        try {
          if (typeof ragMemoryService.subscribeToRagUpdates === 'function') {
            unsubRagEvents = ragMemoryService.subscribeToRagUpdates((update) => {
              if (update.chatId === get().chatId || update.threadId === get().threadId) {
                // Update RAG context in the UI
                set({
                  ragContext: {
                    retrievedChunks: update.chunks || [],
                    sources: update.sources || [],
                    lastQuery: update.query
                  }
                });
                
                // Update workflow state with RAG context
                if (get().threadId && get().workflowState) {
                  set(prevState => ({
                    workflowState: {
                      ...prevState.workflowState,
                      ragContext: {
                        retrievedChunks: update.chunks || [],
                        sources: update.sources || [],
                        query: update.query,
                        updatedAt: new Date().toISOString()
                      }
                    }
                  }));
                  
                  // Save checkpoint without blocking UI
                  setTimeout(() => {
                    get().saveCheckpoint().catch(console.error);
                  }, 0);
                }
              }
            });
          }
        } catch (error) {
          console.error('Error subscribing to RAG updates:', error);
        }
        
        // Subscribe to workflow state updates through checkpointer
        const unsubWorkflow = () => {};
        if (get().threadId) {
          try {
            const subscription = get().checkpointer.subscribe(get().threadId, (state) => {
              if (state && state.threadId) {
                // Update state and sync messages
                set({ workflowState: state });
                get().syncMessagesFromWorkflow(state);
              }
            });
            
            return () => {
              unsubDocumentStatus();
              unsubDocumentProcessed();
              unsubRagEvents();
              subscription();
            };
          } catch (error) {
            console.error('Error subscribing to workflow updates:', error);
          }
        }
        
        return () => {
          unsubDocumentStatus();
          unsubDocumentProcessed();
          unsubRagEvents();
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
      // Core Workflow Actions
      // =========================
      initializeWorkflow: async (patientId, userId) => {
        try {
          // Generate a new thread ID
          const threadId = crypto.randomUUID();
          
          // Create initial workflow state
          const initialState = createInitialWorkflowState(patientId, userId, threadId);
          
          // Create and invoke the workflow
          const workflow = createSupervisorWorkflow(get().checkpointer);
          await workflow.invoke(initialState);
          
          // Update store with IDs
          set({ 
            threadId,
            patientId,
            userId,
            workflowState: initialState
          });
          
          // Add a system message to indicate the workflow has started
          get().addSystemMessage(
            "Medical workflow initialized",
            ChatMessageType.SYSTEM,
            { threadId, patientId }
          );
          
          return threadId;
        } catch (error) {
          ephemeralErrorHandler.handleError(error, {
            domain: "workflow",
            step: "initializeWorkflow",
          });
          
          throw error;
        }
      },
      
      sendToWorkflow: async (content) => {
        try {
          const { threadId, checkpointer } = get();
          
          if (!threadId) {
            throw new Error("No active workflow thread");
          }
          
          // Set loading state
          set({ isLoading: true });
          
          // Load the current workflow state
          const currentState = await checkpointer.load(threadId);
          
          if (!currentState || !currentState.threadId) {
            throw new Error("Failed to load workflow state");
          }
          
          // Update the current message in the state
          const updatedState = {
            ...currentState,
            currentMessage: {
              content,
              role: 'user',
              createdAt: new Date().toISOString()
            },
            interactionHistory: [
              ...(currentState.interactionHistory || []),
              {
                id: crypto.randomUUID(),
                message: content,
                timestamp: new Date().toISOString(),
                userId: get().userId,
                role: 'user'
              }
            ]
          };
          
          // Save the updated state
          await checkpointer.save(updatedState, threadId);
          
          // Get the workflow
          const workflow = createSupervisorWorkflow(checkpointer);
          
          // Continue the workflow with the current state
          const result = await workflow.continue(threadId);
          
          // Update store with new state
          set({ 
            workflowState: result,
            isLoading: false
          });
          
          // Sync messages from the workflow state
          get().syncMessagesFromWorkflow(result);
          
          // Save a checkpoint
          await get().saveCheckpoint();
          
        } catch (error) {
          set({ isLoading: false });
          
          ephemeralErrorHandler.handleError(error, {
            domain: "workflow",
            step: "sendToWorkflow",
            content
          });
          
          get().addSystemMessage(
            `Error processing message: ${normalizeError(error).message}`,
            ChatMessageType.ERROR
          );
        }
      },
      
      syncMessagesFromWorkflow: (state) => {
        if (!state || !state.interactionHistory) return;
        
        try {
          // Convert workflow interactions to chat messages
          const messages = state.interactionHistory.map(interaction => ({
            id: interaction.id || crypto.randomUUID(),
            role: interaction.role,
            content: interaction.message,
            createdAt: interaction.timestamp,
            type: interaction.messageType || ChatMessageType.CHAT,
            metadata: {
              type: interaction.messageType,
              contextual: interaction.contextual,
              step: state.progress?.currentStep,
              sources: interaction.sources
            }
          }));
          
          // Update the store's messages
          get().updateMessages(messages);
          
          // Update RAG context if available
          if (state.ragContext) {
            set({
              ragContext: {
                retrievedChunks: state.ragContext.retrievedChunks || [],
                sources: state.ragContext.sources || [],
                lastQuery: state.ragContext.query
              }
            });
          }
          
        } catch (error) {
          ephemeralErrorHandler.handleError(error, {
            domain: "workflow",
            step: "syncMessagesFromWorkflow",
          });
        }
      },
      
      continueWorkflow: async (action) => {
        try {
          const { threadId, checkpointer, workflowState } = get();
          
          if (!threadId || !workflowState) {
            throw new Error("No active workflow");
          }
          
          // Set loading state
          set({ isLoading: true });
          
          // Update the current action in the state
          const updatedState = {
            ...workflowState,
            currentAction: action,
            lastUpdated: new Date().toISOString()
          };
          
          // Save the updated state
          await checkpointer.save(updatedState, threadId);
          
          // Get the workflow
          const workflow = createSupervisorWorkflow(checkpointer);
          
          // Continue the workflow with the action
          const result = await workflow.continue(threadId);
          
          // Update store with new state
          set({ 
            workflowState: result,
            isLoading: false
          });
          
          // Sync messages from the workflow state
          get().syncMessagesFromWorkflow(result);
          
        } catch (error) {
          set({ isLoading: false });
          
          ephemeralErrorHandler.handleError(error, {
            domain: "workflow",
            step: "continueWorkflow",
            action
          });
          
          get().addSystemMessage(
            `Error continuing workflow: ${normalizeError(error).message}`,
            ChatMessageType.ERROR
          );
        }
      },
      
      handleWorkflowError: (error, context) => {
        const formattedError = error.message || "Unknown workflow error";
        
        // Add error message to chat
        get().addSystemMessage(formattedError, ChatMessageType.ERROR, {
          domain: context.domain || "workflow",
          step: context.step,
          timestamp: new Date().toISOString(),
          recoverable: context.recoverable || false
        });
        
        // Update workflow state to reflect error
        if (get().workflowState) {
          set(prevState => ({
            workflowState: {
              ...prevState.workflowState,
              error: {
                message: formattedError,
                timestamp: new Date().toISOString(),
                domain: context.domain || "workflow",
                step: context.step,
                recoverable: context.recoverable || false
              }
            }
          }));
        }
        
        // Log the error
        logger.error("Workflow error", {
          threadId: get().threadId,
          error: formattedError,
          context
        });
      },
      
      updateWorkflowProgress: (progress) => {
        if (!get().workflowState) return;
        
        set(prevState => ({
          workflowState: {
            ...prevState.workflowState,
            progress
          }
        }));
      },
      
      // =========================
      // LangGraph Checkpointing & Thread Management
      // =========================
      saveCheckpoint: async () => {
        try {
          const { threadId, workflowState } = get();
          
          if (!threadId) {
            throw new Error('Cannot save checkpoint: Missing thread ID');
          }
          
          if (workflowState) {
            const updatedState = {
              ...workflowState,
              workflowUpdatedAt: new Date().toISOString()
            };
            
            await get().checkpointer.save(updatedState, threadId);
            return;
          }
          
          // If no workflow state exists yet, try to load it first
          const loadedState = await get().checkpointer.load(threadId);
          
          if (loadedState && loadedState.threadId) {
            const updatedState = {
              ...loadedState,
              workflowUpdatedAt: new Date().toISOString()
            };
            
            await get().checkpointer.save(updatedState, threadId);
          } else {
            // Create a new state if no existing state was found
            const initialState = createInitialWorkflowState(
              get().patientId || 'unknown',
              get().userId || 'anonymous',
              threadId
            );
            
            await get().checkpointer.save(initialState, threadId);
            set({ workflowState: initialState });
          }
          
        } catch (error) {
          console.error('Error saving checkpoint:', error);
          throw error;
        }
      },
      
      loadCheckpoint: async (threadId) => {
        try {
          // Load workflow state from Supabase
          const state = await get().checkpointer.load(threadId);
          
          // Check if state exists (empty object means not found)
          if (!state || !state.threadId) {
            return false;
          }
          
          // Set the state into the store
          set({ 
            threadId: state.threadId,
            patientId: state.patientId,
            userId: state.userId,
            workflowState: state
          });
          
          // Sync the interaction history to messages
          get().syncMessagesFromWorkflow(state);
          
          // Set RAG context if available
          if (state.ragContext) {
            set({
              ragContext: {
                retrievedChunks: state.ragContext.retrievedChunks || [],
                sources: state.ragContext.sources || [],
                lastQuery: state.ragContext.query
              }
            });
          }
          
          // Set document state if available
          if (state.extractedData) {
            set({
              extractedDocument: {
                id: state.documentId,
                text: state.extractedData.text,
                ...state.extractedData.structuredData,
              },
              docProgress: 100,
              isDocProcessing: false
            });
          }
          
          return true;
        } catch (error) {
          console.error('Error loading checkpoint:', error);
          return false;
        }
      },
      
      listCheckpoints: async (options) => {
        try {
          return await get().checkpointer.list(options);
        } catch (error) {
          console.error('Error listing checkpoints:', error);
          return [];
        }
      },
      
      /**
       * Creates a fork of the current thread
       */
      forkThread: async (options) => {
        try {
          const { threadId, workflowState } = get();
          
          if (!threadId) {
            throw new Error('Cannot fork: No active thread');
          }
          
          // Make sure current state is saved
          await get().saveCheckpoint();
          
          // Fork the thread
          const newThreadId = await get().checkpointer.fork({
            parentThreadId: threadId,
            name: options?.name || `Fork of ${threadId.substring(0, 8)}`,
            metadata: options?.metadata || {
              createdAt: new Date().toISOString(),
              parentState: workflowState?.progress?.currentStep || 'unknown'
            }
          });
          
          if (!newThreadId) {
            throw new Error('Failed to create thread fork');
          }
          
          // Add a system message in the current thread
          get().addSystemMessage(
            `Created a fork of this conversation: ${newThreadId.substring(0, 8)}`,
            ChatMessageType.SYSTEM,
            { 
              isThreadOperation: true,
              forkedThreadId: newThreadId,
              threadOperation: 'fork' 
            }
          );
          
          return newThreadId;
        } catch (error) {
          console.error('Error forking thread:', error);
          
          get().addSystemMessage(
            `Error creating fork: ${normalizeError(error).message}`,
            ChatMessageType.ERROR
          );
          
          throw error;
        }
      },
      
      /**
       * Pauses the current thread
       */
      pauseThread: async () => {
        try {
          const { threadId } = get();
          
          if (!threadId) {
            throw new Error('Cannot pause: No active thread');
          }
          
          // Save current state
          await get().saveCheckpoint();
          
          // Pause the thread
          const result = await get().checkpointer.pause(threadId);
          
          // Add a system message
          get().addSystemMessage(
            'Conversation paused. You can resume it later.',
            ChatMessageType.SYSTEM,
            { 
              isThreadOperation: true,
              threadOperation: 'pause'
            }
          );
          
          return result;
        } catch (error) {
          console.error('Error pausing thread:', error);
          
          get().addSystemMessage(
            `Error pausing conversation: ${normalizeError(error).message}`,
            ChatMessageType.ERROR
          );
          
          throw error;
        }
      },
      
      /**
       * Marks the current thread as completed
       */
      completeThread: async () => {
        try {
          const { threadId } = get();
          
          if (!threadId) {
            throw new Error('Cannot complete: No active thread');
          }
          
          // Save current state
          await get().saveCheckpoint();
          
          // Complete the thread
          const result = await get().checkpointer.complete(threadId);
          
          // Add a system message
          get().addSystemMessage(
            'Conversation completed. Starting a new conversation will create a new thread.',
            ChatMessageType.SYSTEM,
            { 
              isThreadOperation: true,
              threadOperation: 'complete'
            }
          );
          
          return result;
        } catch (error) {
          console.error('Error completing thread:', error);
          
          get().addSystemMessage(
            `Error completing conversation: ${normalizeError(error).message}`,
            ChatMessageType.ERROR
          );
          
          throw error;
        }
      },
      
      /**
       * Archives the current thread
       */
      archiveThread: async (permanent = false) => {
        try {
          const { threadId } = get();
          
          if (!threadId) {
            throw new Error('Cannot archive: No active thread');
          }
          
          // Save current state
          await get().saveCheckpoint();
          
          // Archive the thread
          const result = await get().checkpointer.archive(threadId, permanent);
          
          // Add a system message
          get().addSystemMessage(
            permanent 
              ? 'Conversation permanently deleted.'
              : 'Conversation archived. It can be restored later.',
            ChatMessageType.SYSTEM,
            { 
              isThreadOperation: true,
              threadOperation: permanent ? 'delete' : 'archive'
            }
          );
          
          return result;
        } catch (error) {
          console.error('Error archiving thread:', error);
          
          get().addSystemMessage(
            `Error archiving conversation: ${normalizeError(error).message}`,
            ChatMessageType.ERROR
          );
          
          throw error;
        }
      },
      
      /**
       * Restores an archived thread
       */
      restoreThread: async (threadId) => {
        try {
          if (!threadId) {
            throw new Error('Cannot restore: No thread ID provided');
          }
          
          // Restore the thread
          const result = await get().checkpointer.restore(threadId);
          
          // Load the thread
          await get().loadCheckpoint(threadId);
          
          // Add a system message
          get().addSystemMessage(
            'Restored archived conversation.',
            ChatMessageType.SYSTEM,
            { 
              isThreadOperation: true,
              threadOperation: 'restore'
            }
          );
          
          return result;
        } catch (error) {
          console.error('Error restoring thread:', error);
          
          get().addSystemMessage(
            `Error restoring conversation: ${normalizeError(error).message}`,
            ChatMessageType.ERROR
          );
          
          throw error;
        }
      },
      
      // =========================
      // RAG Integration
      // =========================
      clearRagContext: () => set({ ragContext: undefined }),
      
      updateRagContext: (context) => set({ ragContext: context }),

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
          
              // If we have a thread, update the workflow state
          if (get().threadId && get().workflowState) {
            const state = get().workflowState;
            const updatedState = {
              ...state,
              researchResults: {
                query,
                result: result,
                completedAt: new Date().toISOString()
              }
            };
            
            // Update the workflow state
            set({ workflowState: updatedState });
            
            // Save the updated state
            await get().saveCheckpoint();
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