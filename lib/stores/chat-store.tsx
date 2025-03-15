"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createContext, type ReactNode } from "react";

// Import proper types from the application's type files
import {
  ChatMessageType,
  createMessage,
  createUserMessage,
  createAssistantMessage,
  createSystemMessage,
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
} from "@/lib/types/verification";
import type { DocumentType, DocumentCategory } from "@/lib/types/document";
import type { 
  ReportFormat, 
  ReportOptions, 
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
import { EVENT_TYPES } from "@/lib/types/events";

// Import services (for non-workflow operations)
import { ApiClient } from "@/lib/api/client/api-client";
import { perplexityService } from "@/lib/services/perplexity/perplexity-service";
import { chatService } from "@/lib/services/chat/chat-service";
import { eventService } from "@/lib/services/event-service";

// Import workflow services
import { 
  workflowServiceFactory,
  getDocumentWorkflowService,
  getVerificationWorkflowService,
  getReportWorkflowService
} from "@/lib/workflow/services/workflow-service-factory";
import type { DocumentResult } from "@/lib/workflow/services/document-workflow-service";
import type { ReportResult } from "@/lib/workflow/services/report-workflow-service";
import { ChatWorkflowErrorHandler } from "@/lib/workflow/services/chat-workflow-error-handler";

// Import error handling
import { normalizeError, ApplicationError } from "@/lib/errors";

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
  syncWorkflowState: (state: WorkflowState) => void;
  subscribeToWorkflowUpdates: () => () => void;

  // Verification methods
  startVerification: (content: string, options?: VerificationOptions) => Promise<void>;
  submitCorrection: (correction: string) => void;
  completeVerification: (isApproved: boolean) => Promise<VerificationResult>;
  handleCorrectionMessage: (correction: string) => Promise<void>;
  confirmVerification: () => Promise<VerificationResult>;
  initiateVerification: (extractedDocument: Record<string, unknown>, messageId?: string) => Promise<Record<string, unknown>>;
  processCorrection: (correctionText: string, currentSummary: string, messageId?: string) => Promise<Record<string, unknown>>;
  resetVerification: () => Promise<{ success: boolean }>;

//=============================================================================
// REPORT GENERATION WORKFLOW ACTIONS
//=============================================================================
// These actions manage the report generation workflow
// They handle creating, formatting, and managing reports
//=============================================================================

// Initialize report generation process
startReportGeneration: (reportOptions?: Record<string, unknown>) => {
  completeReportGeneration: (report: Record<string, unknown>) => void;
  generateReport: () => Promise<void>;
  formatReport: (format: Record<string, unknown>) => Promise<void>;
  beginReportGeneration: (reportMetadata?: Record<string, unknown>) => Promise<{ success: boolean }>;

//=============================================================================
// DOCUMENT PROCESSING WORKFLOW ACTIONS
//=============================================================================
// These actions manage the document processing workflow
// They handle document upload, parsing, and extraction
//=============================================================================

// Process a document through the complete workflow pipeline
processDocument: (
    file: File,
    patientId: string,
    documentType?: string,
    abortSignal?: AbortSignal
  ) => Promise<Record<string, unknown>>;
  uploadDocument: (file: File, patientId: string, documentType?: string) => Promise<Record<string, unknown>>;
  resetDocumentProcessing: () => void;

//=============================================================================
// MESSAGE INTERACTION ACTIONS
//=============================================================================
// These actions handle user message inputs and drive the conversation flow
// They interpret messages and may trigger workflow transitions
//=============================================================================

// Send a user message and handle based on current mode
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

// Create the error handler for workflow errors that integrates with the chat store
// This function returns an error handler factory function that will
// create a new error handler with correct message functions when the store is ready
const createErrorHandlerFactory = () => {
  return (store: ChatStore) => {
    // Create error message formatter
    const formatErrorMessage = (error: string, context?: Record<string, unknown>) => {
      // This function formats error messages for display in the chat
      const category = context?.category || 'general';
      
      if (category === 'network') {
        return `Network error: ${error}. Please check your connection and try again.`;
      } else if (category === 'permission') {
        return `Permission error: ${error}. You may not have access to this resource.`;
      } else if (category === 'validation') {
        return `Validation error: ${error}. Please check your input and try again.`;
      } else if (category === 'processing') {
        return `Processing error: ${error}. There was a problem processing your document.`;
      } else if (category === 'verification') {
        return `Verification error: ${error}. There was a problem with the verification process.`;
      } else if (category === 'report') {
        return `Report generation error: ${error}. There was a problem generating your report.`;
      } else {
        return `Error: ${error}`;
      }
    };
    
    // Return a new error handler
    return new ChatWorkflowErrorHandler(
      formatErrorMessage,
      store.addSystemMessage
    );
  };
};

// Error handler factory
const errorHandlerFactory = createErrorHandlerFactory();

// Initial chat store state
// The following state is divided into two main areas:
// • UI State: Handles chat messages, loading indicators, errors, and display modes.
// • Workflow State Management: Manages persistent workflow state (steps, progress, metadata)
// This separation helps keep UI logic distinct from domain-specific workflow operations.
const initialState: Omit<ChatStore, 'syncWorkflowState' | 'subscribeToWorkflowUpdates' | 'performResearch'> = {
  //=============================================================================
  // UI STATE SECTION
  //=============================================================================
  // These properties manage UI-specific concerns like loading indicators, errors,
  // and the current display mode. They don't directly affect workflow logic.
  //=============================================================================
  isLoading: false,
  error: null,
  mode: "default",
  chatId: undefined,
  workflowId: undefined,
  messages: [], // UI representation of chat messages
  
  //=============================================================================
  // WORKFLOW STATE SECTION
  //=============================================================================
  // These properties represent the persistent workflow state that's synchronized
  // with the database. They drive the business logic and process flow.
  //=============================================================================
  workflow: {
    currentStep: DomainOnlyWorkflowStep.ERROR,
    progress: 0,
    phase: ProcessingPhase.INITIALIZATION,
    error: null,
    metadata: {},
    timestamp: new Date().toISOString()
  },
  
  //=============================================================================
  // DOMAIN-SPECIFIC WORKFLOW STATES
  //=============================================================================
  // These sections maintain state for specific workflow domains
  // Each has its own lifecycle and state machine
  //=============================================================================
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
  
  // Document processing state (legacy format - maintained for compatibility)
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

// Create the actual store with Zustand
export const useChatStore = create<ChatStore>()(
  devtools(
    (set, get) => {
      /**
       * Create workflow services and error handler
       */
      const userId = typeof localStorage !== 'undefined' 
        ? localStorage.getItem('current_user_id') || undefined 
        : undefined;
        
      const chatId = typeof localStorage !== 'undefined' 
        ? localStorage.getItem('current_chat_id') || undefined 
        : undefined;
      
      // Create the error handler with this store instance
      const errorHandler = errorHandlerFactory({
        ...initialState,
        addSystemMessage: (content, type, metadata) => {
          const message: ChatMessage = {
            id: crypto.randomUUID(),
            role: "system",
            content,
            createdAt: new Date().toISOString(),
            type: type ? (type as ChatMessageType) : ChatMessageType.SYSTEM,
            metadata: metadata ? { type: type || ChatMessageType.SYSTEM, ...metadata } : { type: type || ChatMessageType.SYSTEM },
          };
          
          set(state => ({
            ...state,
            messages: [...state.messages, message]
          }));
          
          return message;
        }
      });
      
      // Initialize the workflow services
      const documentService = getDocumentWorkflowService(userId, chatId);
      const verificationService = getVerificationWorkflowService(userId, chatId);
      const reportService = getReportWorkflowService(userId, chatId);
      
      // Helper to derive workflow state from the specialized services
      const deriveWorkflowState = (): WorkflowState => {
        const documentState = documentService.getState();
        const verificationState = verificationService.getState();
        const reportState = reportService.getState();
        
        // Determine current step based on priority order
        const currentStep = documentState.currentStep !== 'idle' ? documentState.currentStep :
                            verificationState.currentStep !== 'idle' ? verificationState.currentStep :
                            reportState.currentStep !== 'idle' ? reportState.currentStep : 'idle';
                            
        // Determine progress, phase, and error
        const progress = documentState.progress || verificationState.progress || reportState.progress || 0;
        const phase = documentState.phase || verificationState.phase || reportState.phase;
        const error = documentState.error || verificationState.error || reportState.error;
        
        // Combine metadata
        const metadata = {
          ...documentState.metadata,
          ...verificationState.metadata,
          ...reportState.metadata,
          currentStep
        };
        
        // Return derived state
        return {
          currentStep,
          progress,
          phase,
          error,
          metadata,
          timestamp: new Date().toISOString()
        };
      };
      
      return {
        isLoading: false,
        error: null,
        mode: "default",
        chatId: chatId,
        workflowId: undefined,
        messages: [],
        
        workflow: deriveWorkflowState(),
        
        verification: {
          isInVerificationMode: false,
          currentSummary: null,
          verificationStatus: VerificationStatus.pending,
          verificationItems: [],
          summaryVersions: []
        },
        
        research: initialResearchState,
        
        docProgress: 0,
        isDocProcessing: false,
        extractedDocument: null,
        
        reportGeneration: {
          isComplete: false,
          format: {},
        },
        
        //=============================================================================
        // UI ACTION HANDLERS
        //=============================================================================
        // These actions manage UI-specific concerns and don't directly interact
        // with the workflow system or persistent state
        //=============================================================================
        
        // Update loading state (UI-only)
        setLoading: (isLoading) => set({ isLoading }),
        
        // Set error message (UI-only)
        setError: (error) => set({ error }),
        
        // Change display mode (UI-only)
        setMode: (mode) => set({ mode }),
        
        //=============================================================================
        // WORKFLOW ACTION HANDLERS
        //=============================================================================
        // These actions manage workflow state and typically interact with
        // both local state and persistent database state
        //=============================================================================
        
        // Reset the entire chat store to initial state
        resetChat: () => {
          // Reset specialized services
          documentService.resetDocumentWorkflow().catch(console.error);
          verificationService.resetVerification().catch(console.error);
          reportService.resetReportWorkflow().catch(console.error);
          
          // Reset store state
          set({
            messages: [],
            mode: "default",
            error: null,
            workflow: deriveWorkflowState(),
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
          });
        },
        
        //=============================================================================
        // MESSAGE HANDLING ACTIONS
        //=============================================================================
        // These actions manage the UI representation of messages
        // They don't directly affect workflow state but may be triggered by workflow events
        //=============================================================================
        
        // Add a message to the chat UI
        addMessage: (message) => {
          try {
            const messageWithId = 'id' in message
              ? message
              : { ...message, id: crypto.randomUUID() };
            set((state) => ({
              ...state,
              messages: [...state.messages, messageWithId as ChatMessage],
            }));
          } catch (error) {
            const normalized = normalizeError(error);
            moduleLogger.error('Failed to add message', { error: normalized.message });
          }
        },
        
        // Replace all messages at once
        updateMessages: (messages) => set({ messages }),
        
        // Update progress indicator on a specific message
        updateMessageProgress: (messageId, progress, phase) => {
          try {
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
          } catch (error) {
            const normalized = normalizeError(error);
            moduleLogger.error('Failed to update message progress', { messageId, error: normalized.message });
          }
        },
        
        //=============================================================================
        // WORKFLOW STATE MANAGEMENT ACTIONS
        //=============================================================================
        // These actions directly interact with the workflow system and persistent state
        // They handle transitions between workflow states and synchronization with the database
        //=============================================================================
        
        // Update the current workflow step with optional metadata
        updateWorkflowStep: async (newStep: WorkflowStep, newMetadata?: Record<string, unknown>) => {
          try {
            // Update local state first for UI responsiveness
            set((state) => ({
              ...state,
              workflow: {
                ...state.workflow,
                currentStep: newStep,
                metadata: { ...state.workflow.metadata, ...newMetadata, currentStep: newStep }
              }
            }));
            
            // Determine which service to use based on the step domain
            if (
              newStep === 'uploading' || 
              newStep === 'extracting' || 
              newStep === 'complete'
            ) {
              // Document domain
              await documentService.updateStep(newStep, newMetadata);
            } else if (
              newStep === 'verification' || 
              newStep === 'verification_pending' || 
              newStep === 'verification_in_progress' || 
              newStep === 'verification_completed'
            ) {
              // Verification domain
              await verificationService.updateStep(newStep, newMetadata);
            } else if (
              newStep === 'report_generation' || 
              newStep === 'report_complete'
            ) {
              // Report domain
              await reportService.updateStep(newStep, newMetadata);
            } else if (newStep === 'error') {
              // Error state - update all services
              await documentService.updateStep('error', newMetadata);
              await verificationService.updateStep('error', newMetadata);
              await reportService.updateStep('error', newMetadata);
            } else if (newStep === 'idle') {
              // Idle state - reset all services
              await documentService.resetDocumentWorkflow();
              await verificationService.resetVerification();
              await reportService.resetReportWorkflow();
            } else {
              // Default to document service
              await documentService.updateStep(newStep, newMetadata);
            }
            
            // Update the workflow state in the store
            set((state) => ({
              ...state,
              workflow: deriveWorkflowState()
            }));
          } catch (error) {
            const normalizedError = normalizeError(error);
            
            // Handle the error with the error handler
            errorHandler.handleError(error, {
              step: newStep,
              details: newMetadata
            });
            
            set(state => ({
              ...state,
              error: normalizedError.message
            }));
          }
        },
        
        updateProgress: (progress, phase) => {
          // Use the store's current workflow step to determine which service to use
          const currentStep = get().workflow.currentStep;
          
          // Update progress in the appropriate service
          if (
            currentStep === 'uploading' || 
            currentStep === 'extracting' || 
            currentStep === 'complete'
          ) {
            // Document domain
            documentService.updateProgress(progress, phase).catch(console.error);
          } else if (
            currentStep === 'verification' || 
            currentStep === 'verification_pending' || 
            currentStep === 'verification_in_progress' || 
            currentStep === 'verification_completed'
          ) {
            // Verification domain
            verificationService.updateProgress(progress, phase).catch(console.error);
          } else if (
            currentStep === 'report_generation' || 
            currentStep === 'report_complete'
          ) {
            // Report domain
            reportService.updateProgress(progress, phase).catch(console.error);
          } else {
            // Default to document service
            documentService.updateProgress(progress, phase).catch(console.error);
          }
          
          // Update the progress in the store
          set((state) => ({
            ...state,
            workflow: {
              ...state.workflow,
              progress,
              phase: phase ?? state.workflow.phase,
            },
            docProgress: progress // For backward compatibility
          }));
        },
        
        /**
         * Synchronizes the local store state with the workflow state from the database
         *
         * STATE SYNCHRONIZATION RESPONSIBILITIES:
         * 1. WORKFLOW STATE SYNC: Updates core workflow properties from external source
         * 2. METADATA MERGING: Preserves existing metadata while adding new fields
         * 3. TIMESTAMP TRACKING: Maintains proper versioning with timestamps
         *
         * This function is the primary bridge between the workflow subsystem
         * and the UI state management system. It ensures that:
         * - Workflow state changes from database are properly reflected in UI
         * - Domain-specific states remain coherent
         * - State transitions are properly tracked
         *
         * @param workflowState The workflow state received from external source (typically database)
         */
        syncWorkflowState: (workflowState) => {
          // Update the workflow state in the store
          set((state) => {
            // Create updated workflow state object
            const updatedWorkflowState = {
              // CORE WORKFLOW PROPERTIES: Essential workflow state information
              currentStep: workflowState.currentStep,
              progress: workflowState.progress,
              phase: workflowState.phase || ProcessingPhase.INITIALIZATION,
              error: workflowState.error,
              
              // METADATA HANDLING: Merge existing metadata with new metadata
              // This preserves domain-specific data while adding new fields
              metadata: {
                ...(state.workflow.metadata || {}),
                ...(workflowState.metadata || {})
              },
              
              // VERSIONING: Track when this state was last updated
              timestamp: workflowState.timestamp
            };
            
            return {
              ...state,
              workflow: updatedWorkflowState
            };
          });
        },
        
        subscribeToWorkflowUpdates: () => {
          // Set up event listeners for all services
          const handleDocumentStateChange = () => {
            set(state => ({
              ...state,
              workflow: deriveWorkflowState(),
              docProgress: documentService.getState().progress || 0,
              isDocProcessing: documentService.getStatus().isProcessingDocument
            }));
          };
          
          const handleVerificationStateChange = () => {
            const verificationState = verificationService.getState();
            const verificationStatus = verificationService.getStatus();
            
            set(state => ({
              ...state,
              workflow: deriveWorkflowState(),
              verification: {
                ...state.verification,
                isInVerificationMode: verificationStatus.isVerifying,
                currentSummary: verificationService.getCurrentSummary() || null,
                verificationStatus: verificationState.metadata?.verificationStatus as VerificationStatus || state.verification.verificationStatus
              }
            }));
          };
          
          const handleReportStateChange = () => {
            const reportState = reportService.getState();
            const reportResult = reportService.getReportResult();
            
            set(state => ({
              ...state,
              workflow: deriveWorkflowState(),
              reportGeneration: {
                ...state.reportGeneration,
                isComplete: reportState.currentStep === 'report_complete',
                format: { type: reportResult.format || 'markdown' },
                reportId: reportResult.reportId
              }
            }));
          };
          
          // Subscribe to events
          documentService.on('stateChange', handleDocumentStateChange);
          verificationService.on('stateChange', handleVerificationStateChange);
          reportService.on('stateChange', handleReportStateChange);
          
          // Return unsubscribe function
          return () => {
            documentService.off('stateChange', handleDocumentStateChange);
            verificationService.off('stateChange', handleVerificationStateChange);
            reportService.off('stateChange', handleReportStateChange);
          };
        },
        
        //=============================================================================
        // VERIFICATION WORKFLOW ACTIONS
        //=============================================================================
        // These actions manage the verification-specific workflow
        // They handle the process of reviewing and correcting document extractions
        //=============================================================================
        
        // Start verification process with content and optional settings
        startVerification: async (content: string, options?: VerificationOptions) => {
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
            
            // Log verification start
            const moduleLogger = logger.withMetadata({
              module: 'ChatStore',
              method: 'startVerification',
              chatId
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
            // Handle error with error handler
            errorHandler.handleError(error, {
              domain: 'verification',
              step: 'verification_pending',
              details: { content, options }
            });
            
            set(state => ({
              ...state, 
              isLoading: false
            }));
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
              throw new ApplicationError({
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
                  // Handle error with error handler
                  errorHandler.handleError(error, {
                    domain: 'verification',
                    step: 'verification_in_progress',
                    details: { correction }
                  });
                });
            }, 0);
          } catch (error) {
            // Handle error with error handler
            errorHandler.handleError(error, {
              domain: 'verification',
              step: 'verification_in_progress',
              details: { correction }
            });
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
            
            // Call the verification service to complete verification
            const result = await verificationService.completeVerification();
            
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
            
            return result;
          } catch (error) {
            // Handle error with error handler
            errorHandler.handleError(error, {
              domain: 'verification',
              step: 'verification_completed',
              details: { isApproved }
            });
            
            // Add an error message
            get().addSystemMessage(
              `Error completing verification: ${normalizeError(error).message}`,
              ChatMessageType.ERROR
            );
            
            set(state => ({
              ...state,
              isLoading: false
            }));
            
            // Return a fallback result
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
              throw new ApplicationError({
                message: 'No summary available to correct',
                code: 'CORRECTION_ERROR'
              });
            }
            
            // Update progress
            get().updateMessageProgress(progressId, 30, 'correction');
            
            // Process the correction using the verification service
            const result = await verificationService.processCorrection(
              correction, 
              currentSummary,
              progressId
            );
            
            // Update progress
            get().updateMessageProgress(progressId, 100, 'correction_completed');
            
            // Update the UI state
            if (result.summary) {
              // Update the verification state
              set(state => ({
                ...state,
                verification: {
                  ...state.verification,
                  currentSummary: result.summary || null,
                  verificationStatus: VerificationStatus.inProgress,
                  summaryVersions: [
                    ...state.verification.summaryVersions,
                    {
                      id: result.summaryId || crypto.randomUUID(),
                      content: result.summary,
                      timestamp: new Date().toISOString()
                    }
                  ]
                }
              }));
              
              // Add the updated summary to the chat
              get().updateSummaryAfterCorrection(result.summary);
            }
            
            // Add a message asking for confirmation
            get().addSystemMessage(
              "I've updated the summary based on your correction. Please review it and type 'confirm' to approve or provide additional corrections.",
              ChatMessageType.VERIFICATION
            );
            
            return result;
          } catch (error) {
            // Handle error with error handler
            errorHandler.handleError(error, {
              domain: 'verification',
              step: 'verification_in_progress',
              details: { correction }
            });
            
            // Add an error message
            get().addSystemMessage(
              `Error processing correction: ${normalizeError(error).message}. Please try again.`,
              ChatMessageType.ERROR
            );
            
            throw error;
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
            // Handle error with error handler
            errorHandler.handleError(error, {
              domain: 'verification',
              step: 'verification_completed',
              details: { action: 'confirm' }
            });
            
            // Return a fallback result
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
              isLoading: true,
              extractedDocument
            }));
            
            // Convert extracted document to string if needed
            let documentText: string;
            if (typeof extractedDocument === 'object' && extractedDocument !== null) {
              documentText = (extractedDocument as { text?: string }).text || JSON.stringify(extractedDocument);
            } else {
              documentText = String(extractedDocument);
            }
            
            // Use the verification service to initiate verification
            const result = await verificationService.initiateVerification(
              documentText,
              messageId
            );
            
            // Update state with the results
            set(state => ({
              ...state,
              isLoading: false,
              verification: {
                ...state.verification,
                currentSummary: result.summary || null,
                verificationStatus: VerificationStatus.inProgress,
                summaryVersions: [
                  ...state.verification.summaryVersions,
                  {
                    id: result.summaryId || crypto.randomUUID(),
                    content: result.summary || '',
                    timestamp: new Date().toISOString(),
                  }
                ]
              }
            }));
            
            return result;
          } catch (error) {
            // Handle error with error handler
            errorHandler.handleError(error, {
              domain: 'verification',
              step: 'verification_pending',
              details: { extractedDocument }
            });
            
            // Update store with error state
            set(state => ({
              ...state,
              isLoading: false
            }));
            
            throw error;
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
            
            // Use the verification service to process the correction
            const result = await verificationService.processCorrection(
              correctionText,
              currentSummary,
              messageId
            );
            
            // Update local state with verification metadata
            set(state => ({
              ...state,
              isLoading: false,
              verification: {
                ...state.verification,
                currentSummary: result.summary || currentSummary,
                verificationStatus: VerificationStatus.inProgress,
                summaryVersions: [
                  ...state.verification.summaryVersions,
                  {
                    id: result.summaryId || crypto.randomUUID(),
                    content: result.summary || currentSummary,
                    timestamp: new Date().toISOString()
                  }
                ]
              }
            }));
            
            return result;
          } catch (error) {
            // Handle error with error handler
            errorHandler.handleError(error, {
              domain: 'verification',
              step: 'verification_in_progress',
              details: { correctionText, messageId }
            });
            
            set(state => ({
              ...state,
              isLoading: false
            }));
            
            throw error;
          }
        },
        
        resetVerification: async () => {
          try {
            // Use the verification service to reset verification
            const result = await verificationService.resetVerification();
            
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
            
            return result;
          } catch (error) {
            // Handle error with error handler
            errorHandler.handleError(error, {
              domain: 'verification',
              step: 'idle',
              details: { action: 'resetVerification' }
            });
            
            return { success: false, error: normalizeError(error).message };
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
            
            // Get relevant data for report generation
            const patientId = get().workflow.metadata?.patientId as string || '';
            const format = (get().reportGeneration?.format?.type as string) || 'markdown';
            
            // Use the report service to generate a report
            const result = await reportService.generateReport({
              patientId,
              format,
              progressCallback: (progress, phase) => {
                // Update progress message
                get().updateMessageProgress(
                  progressId,
                  progress,
                  phase?.toString() || ProcessingPhase.REPORT_GENERATION.toString()
                );
              }
            });
            
            // If successful, add the report to the chat
            if (result.success) {
              // Add completion message
              get().addSystemMessage('Report generation complete!', 'report_complete');
              
              // Add the report as a message
              get().addMessage({
                role: 'assistant',
                content: result.content || `**Report for Patient ${patientId}**\n\nReport generation completed.`,
                createdAt: new Date().toISOString(),
                type: ChatMessageType.REPORT,
                metadata: {
                  type: ChatMessageType.REPORT,
                  isReport: true,
                  reportId: result.reportId,
                  format
                }
              });
              
              // Update report generation state
              set(state => ({
                ...state,
                isLoading: false,
                reportGeneration: {
                  isComplete: true,
                  format: { type: format },
                  reportId: result.reportId
                }
              }));
            } else {
              throw new ApplicationError({
                message: result.error || 'Failed to generate report',
                code: 'REPORT_GENERATION_ERROR'
              });
            }
          } catch (error) {
            // Handle error with error handler
            errorHandler.handleError(error, {
              domain: 'report',
              step: 'report_generation',
              details: { action: 'generateReport' }
            });
            
            // Update state with error
            set(state => ({
              ...state,
              isLoading: false
            }));
          }
        },
        
        formatReport: async (format): Promise<void> => {
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
            
            // Format the report using the report service
            const formatType = format.type as string || 'markdown';
            const result = await reportService.formatReport(formatType, reportId);
            
            // Update progress to complete
            get().updateMessageProgress(progressId, 100, ProcessingPhase.COMPLETION.toString());
            
            // If successful, add the formatted report to the chat
            if (result.success) {
              // Add the formatted report as a message
              get().addMessage({
                role: 'assistant',
                content: result.content || 'Report formatting completed.',
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
            } else {
              throw new ApplicationError({
                message: result.error || 'Failed to format report',
                code: 'REPORT_FORMATTING_ERROR'
              });
            }
          } catch (error) {
            // Handle error with error handler
            errorHandler.handleError(error, {
              domain: 'report',
              step: 'report_generation',
              details: { action: 'formatReport', format }
            });
            
            // Update state with error
            set(state => ({
              ...state,
              isLoading: false
            }));
          }
        },
        
        beginReportGeneration: async (reportMetadata?: Record<string, unknown>): Promise<{ success: boolean }> => {
          try {
            // Get patient ID from reportMetadata or workflow metadata
            const patientId = (reportMetadata?.patientId || get().workflow.metadata?.patientId) as string;
            
            if (!patientId) {
              throw new ApplicationError({
                message: 'Patient ID is required for report generation',
                code: 'REPORT_GENERATION_ERROR'
              });
            }
            
            // Begin report generation using the report service
            const result = await reportService.beginReportGeneration(
              'comprehensive',
              {
                patientId,
                ...(reportMetadata || {})
              }
            );
            
            // If successful, update the state
            if (result.success) {
              // Add a system message
              get().addSystemMessage(
                'Report generation has started. This may take a moment...',
                ChatMessageType.SYSTEM,
                {
                  reportId: result.reportId,
                  reportStarted: true
                }
              );
              
              return { success: true };
            } else {
              throw new ApplicationError({
                message: result.error || 'Failed to begin report generation',
                code: 'REPORT_GENERATION_ERROR'
              });
            }
          } catch (error) {
            // Handle error with error handler
            errorHandler.handleError(error, {
              domain: 'report',
              step: 'report_generation',
              details: { reportMetadata }
            });
            
            return { success: false };
          }
        },
        
        // Document processing methods
        processDocument: async (
          file: File,
          patientId: string,
          documentType?: string,
          abortSignal?: AbortSignal
        ): Promise<Record<string, unknown>> => {
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
            const processMsg = store.addSystemMessage(
              `Processing document: ${file.name}`,
              ChatMessageType.SYSTEM,
              { 
                isProgress: true,
                documentName: file.name,
                fileSize: file.size,
                documentType 
              }
            );
            
            // Use the document service to process the document
            const result = await documentService.processDocument(file, {
              patientId,
              onProgress: (progress, phase) => {
                // Update progress in the message
                store.updateMessageProgress(
                  processMsg.id,
                  progress,
                  phase.toString()
                );
                
                // Update store progress
                set({
                  docProgress: progress
                });
              }
            });
            
            // Update state based on result
            if (result.success) {
              // Store extracted document
              set({ 
                extractedDocument: result.extractedData || { text: result.text },
                docProgress: 100,
                isDocProcessing: false
              });
              
              // Add completion message
              store.addSystemMessage(
                `Document processed successfully: ${file.name}`,
                ChatMessageType.SYSTEM,
                { 
                  isProgress: true,
                  isCompleted: true,
                  documentId: result.documentId,
                  documentName: file.name,
                  documentType
                }
              );
            } else {
              throw new ApplicationError({
                message: result.error || 'Document processing failed',
                code: 'DOCUMENT_PROCESSING_ERROR'
              });
            }
            
            return result;
          } catch (error) {
            // Handle error with error handler
            errorHandler.handleError(error, {
              domain: 'document',
              step: 'uploading',
              details: { fileName: file.name, fileSize: file.size, documentType, patientId }
            });
            
            // Add an error message
            store.addSystemMessage(
              `Error processing document: ${normalizeError(error).message}`,
              ChatMessageType.ERROR,
              { isError: true }
            );
            
            // Return error object
            return { 
              error: normalizeError(error).message,
              success: false
            };
          } finally {
            // Clean up
            store.setLoading(false);
            set({ isDocProcessing: false });
          }
        },
        
        uploadDocument: async (file: File, patientId: string, documentType?: string): Promise<Record<string, unknown>> => {
          const store = get();
          
          try {
            // Check for file validity
            if (!file || !(file instanceof File)) {
              throw new ApplicationError({
                message: 'Invalid file provided for upload',
                code: 'DOCUMENT_UPLOAD_ERROR'
              });
            }
            
            // Check for patient ID
            if (!patientId) {
              throw new ApplicationError({
                message: 'Patient ID is required for document upload',
                code: 'DOCUMENT_UPLOAD_ERROR'
              });
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
            
            // If processing was successful and we have extracted data, automatically start verification
            if (result && !result.error && store.extractedDocument) {
              try {
                // Start verification process
                const verificationResult = await store.initiateVerification(store.extractedDocument);
                
                // Return combined results
                return {
                  ...result,
                  verificationInitiated: true,
                  verificationResult
                };
              } catch (verificationError) {
                // Handle verification error, but continue with the successful upload result
                errorHandler.handleError(verificationError, {
                  domain: 'verification',
                  step: 'verification_pending',
                  details: { document: result }
                });
                
                return {
                  ...result,
                  verificationInitiated: false,
                  verificationError: normalizeError(verificationError).message
                };
              }
            }
            
            // Return the processing result
            return result;
          } catch (error) {
            // Handle error with error handler
            errorHandler.handleError(error, {
              domain: 'document',
              step: 'uploading',
              details: { fileName: file.name, fileSize: file.size, documentType, patientId }
            });
            
            // Return error result
            return {
              error: normalizeError(error).message,
              success: false
            };
          }
        },
        
        resetDocumentProcessing: () => {
          // Reset document processing state in store
          set({
            isDocProcessing: false,
            docProgress: 0,
            extractedDocument: null
          });
          
          // Reset document service
          documentService.resetDocumentWorkflow().catch(console.error);
        },
        
        // Message sending
        sendMessage: async (content, options = {}) => {
          const store = get();
          const { isCorrection = false, metadata = {} } = options;
          
          // Import error handling utilities
          const { handleResultFailure } = await import('@/lib/services/workflow/error/workflow-error-handler');
          const { Result } = await import('@/lib/services/workflow/error/result');
          
          try {
            // Don't allow empty messages
            if (!content || content.trim() === '') {
              return;
            }
            
            // Get current state
            const { 
              mode, 
              verification,
              messages
            } = store;
            
            // Add the user message to the chat
const userMessage = createUserMessage(content, { isCorrection, ...metadata });
            
            store.addMessage(userMessage);
            
            // Handle message differently based on mode
            switch (mode) {
              case 'verification': {
                // In verification mode, handle corrections
                if (isCorrection || !(content.toLowerCase().trim() === 'confirm' || content.toLowerCase().trim() === 'approve')) {
                  if (verification.currentSummary) {
                    // Add a system message indicating processing of correction
                    store.addSystemMessage(
                      'Processing your correction...',
                      ChatMessageType.SYSTEM,
                      { isProgress: true }
                    );
                    
                    // Process the correction using the verification service
                    await store.handleCorrectionMessage(content);
                  } else {
                    // Add a message indicating no summary to correct
                    store.addSystemMessage(
                      'No summary is available to correct. Please try again later.',
                      ChatMessageType.ERROR,
                      { isError: true }
                    );
                  }
                } else {
                  // Handle verification confirmation
                  await store.confirmVerification();
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
                // Default chat behavior - simply add an assistant response
                // In a real implementation, this would likely call an AI service
                
                // Generate an appropriate response based on the message content
                let response = `I received your message: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`;
                
                // Add document upload hint if message suggests uploading
                if (content.toLowerCase().includes('upload') || content.toLowerCase().includes('document')) {
                  response += "\n\nIf you'd like to upload a document, please use the document uploader above.";
                }
                
                // Add assistant response
                store.addMessage({
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: response,
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
            
            // Handle error with Result pattern + error handler
            const errorResult = Result.fromError(error);
            handleResultFailure(
              errorResult,
              store.workflowId,
              store.workflow.currentStep,
              {
                domain: 'chat',
                operation: 'sendMessage',
                input: { message: content, isCorrection: options.isCorrection }
              }
            ).catch(handlerError => {
              console.error('Error handler failed:', handlerError);
            });
          }
        },
        
        subscribeToEvents: () => {
          // Subscribe to document processing events
          const unsubDocumentStatus = eventService.subscribe(
            EVENT_TYPES.DOCUMENT_STATUS,
            (payload: DocumentStatusEventPayload) => {
              // Update progress state
              set({ docProgress: payload.status.progress || 0 });
              
              // Update message progress if we have a processing message
              const processingMessages = get().messages.filter(
                (m) => m.metadata?.isProgress && !m.metadata.isCompleted
              );
              
              if (processingMessages.length > 0) {
                const lastProcessingMessage = processingMessages[processingMessages.length - 1];
                get().updateMessageProgress(
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
              get().addSystemMessage(
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
            }
          );
          
          // Subscribe to workflow state changes
          const unsubWorkflowUpdates = get().subscribeToWorkflowUpdates();
          
          // Return cleanup function
          return () => {
            unsubDocumentStatus();
            unsubDocumentProcessed();
            unsubWorkflowUpdates();
          };
        },
        
        // Helper methods that use the centralized message creation utilities from lib/types/chat.ts
        addSystemMessage: (content: string, type?: ChatMessageType, metadata?: Record<string, unknown>) => {
          // Import and use the standardized message creation functions
          const { createSystemMessage } = require('@/lib/types/chat');
          const messageType = type || ChatMessageType.SYSTEM;
          const message = createSystemMessage(content, {
            ...metadata,
            type: messageType
          });
          get().addMessage(message);
          return message;
        },
        
        postSummaryMessage: (summary: string) => {
          // Import and use the standardized message creation functions
          const { createAssistantMessage } = require('@/lib/types/chat');
          const message = createAssistantMessage(summary, {
            type: ChatMessageType.SUMMARY
          });
          get().addMessage(message);
          return message;
        },
        
        updateSummaryAfterCorrection: (newSummary: string) => {
          // Import and use the standardized message creation functions
          const { createAssistantMessage } = require('@/lib/types/chat');
          const message = createAssistantMessage(newSummary, {
            type: ChatMessageType.SUMMARY
          });
          get().addMessage(message);
          return message;
        },
        
        clearMessages: () => {
          get().resetChat();
        },
        
        //=============================================================================
        // RESEARCH WORKFLOW ACTIONS
        //=============================================================================
        // These actions manage the research-specific workflow
        // They handle query processing and result presentation
        //=============================================================================
        
        // Perform research on a query with optional parameters
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
            // Handle error with error handler
            errorHandler.handleError(error, {
              domain: 'research',
              details: { query, options }
            });
            
            // Update state
            set(state => ({
              ...state,
              research: {
                ...state.research,
                isActive: false,
                progress: 0
              },
              isLoading: false
            }));
            
            throw error;
          }
        }
      };
    },
    { name: "chat-store" }
  )
);

export function ChatProvider({ children }: { readonly children: ReactNode }) {
  return children;
}

export function useChatState(): ChatStore {
  return useChatStore();
}

// Export a hook function to use the error handler
export function useErrorHandler() {
  const addSystemMessage = useChatStore(state => state.addSystemMessage);
  
  const formatErrorMessage = (error: string, context?: Record<string, unknown>) => {
    // This function formats error messages for display in the chat
    const category = context?.category || 'general';
    
    if (category === 'network') {
      return `Network error: ${error}. Please check your connection and try again.`;
    } else if (category === 'permission') {
      return `Permission error: ${error}. You may not have access to this resource.`;
    } else if (category === 'validation') {
      return `Validation error: ${error}. Please check your input and try again.`;
    } else if (category === 'processing') {
      return `Processing error: ${error}. There was a problem processing your document.`;
    } else if (category === 'verification') {
      return `Verification error: ${error}. There was a problem with the verification process.`;
    } else if (category === 'report') {
      return `Report generation error: ${error}. There was a problem generating your report.`;
    } else {
      return `Error: ${error}`;
    }
  };
  
  // Create a new error handler
  return new ChatWorkflowErrorHandler(
    formatErrorMessage,
    addSystemMessage
  );
}