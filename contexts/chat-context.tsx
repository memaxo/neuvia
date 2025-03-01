"use client";

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useReducer, useMemo } from "react";

// Import types from our centralized type system
import type { 
  ChatMode, 
  Message, 
  MessageMetadata,
  ExtendedChatContextType,
  UseProcessingWorkflowResult,
  ChatState,
  ChatAction
} from "@/lib/chat/types";

// Import the reducer and action creators
import { chatReducer } from "@/contexts/reducers/chat-reducer";
import { chatActions } from "@/lib/actions/chat-actions";
import { initialChatState } from "@/lib/chat/types";
import { processMessage } from "@/lib/actions/message-processor";

// Import the processing workflow hook
import { useProcessingWorkflow } from "@/lib/hooks/use-processing-workflow";

import type { VerificationItem, VerificationResult, VerificationOptions } from "@/lib/processing/types/verification";
import type { VerificationStatusType } from "@/lib/workflow/types";
import type { Database } from '@/lib/supabase';
import { createBrowserClient } from "@/lib/supabase/clients";

// Create separate contexts for state and dispatch
const ChatStateContext = createContext<ChatState | undefined>(undefined);
const ChatDispatchContext = createContext<React.Dispatch<ChatAction> | undefined>(undefined);

export function ChatProvider({ children }: { readonly children: ReactNode }) {
  // Use the reducer for state management
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  
  // Use the processing workflow directly
  const workflow = useProcessingWorkflow() as UseProcessingWorkflowResult;
  
  // Store the Supabase client in a ref
  const supabaseRef = useRef<SupabaseClient<Database>>();
  
  // Initialize Supabase client
  useEffect(() => {
    supabaseRef.current = createBrowserClient();
  }, []);
  
  // Sync with workflow changes
  useEffect(() => {
    // Update chat state based on workflow step changes
    dispatch(chatActions.updateWorkflowStep(workflow.workflowStep));
    
    // Handle workflow errors
    if (workflow.error) {
      dispatch(chatActions.setError(workflow.error));
    }
  }, [workflow.workflowStep, workflow.error]);
  
  return (
    <ChatStateContext.Provider value={state}>
      <ChatDispatchContext.Provider value={dispatch}>
        {children}
      </ChatDispatchContext.Provider>
    </ChatStateContext.Provider>
  );
}

// Access state
export function useChatState(): ChatState {
  const context = useContext(ChatStateContext);
  if (context === undefined) {
    throw new Error('useChatState must be used within a ChatProvider');
  }
  return context;
}

// Access dispatch
export function useChatDispatch(): React.Dispatch<ChatAction> {
  const context = useContext(ChatDispatchContext);
  if (context === undefined) {
    throw new Error('useChatDispatch must be used within a ChatProvider');
  }
  return context;
}

// Create a combined hook with actions for backwards compatibility
export function useChatContext(): ExtendedChatContextType {
  const state = useChatState();
  const dispatch = useChatDispatch();
  const workflow = useProcessingWorkflow() as UseProcessingWorkflowResult;

  // Create action methods that use dispatch for backwards compatibility
  const actions = useMemo(() => ({
    // Send a user message and process it
    sendMessage: async (content: string, options?: { isCorrection?: boolean, metadata?: MessageMetadata }): Promise<void> => {
      if (!content.trim()) return;
      
      try {
        dispatch(chatActions.setLoading(true));
        
        // Add user message
        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: "user",
          content,
          createdAt: new Date(),
          metadata: options?.metadata
        };
        
        dispatch(chatActions.addMessage(userMessage));
        
        // Process the message based on current mode
        await processMessage(content, state.mode, dispatch, workflow);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "An error occurred";
        dispatch(chatActions.setError(errorMsg));
      } finally {
        dispatch(chatActions.setLoading(false));
      }
    },
    
    // Add a system message
    addSystemMessage: (content: string, type?: string, metadata?: any): Message => {
      const message: Message = {
        id: crypto.randomUUID(),
        role: "system",
        content,
        createdAt: new Date(),
        metadata: { 
          ...(type ? { type } : {}), 
          ...metadata 
        }
      };
      
      dispatch(chatActions.addMessage(message));
      return message;
    },
    
    // Add a message (any type)
    addMessage: (message: Message | Omit<Message, 'id'>): void => {
      dispatch(chatActions.addMessage(message));
    },
    
    // Clear all messages
    clearMessages: (): void => {
      dispatch(chatActions.updateMessages([]));
    },
    
    // Reset the chat to initial state
    resetChat: (): void => {
      dispatch(chatActions.resetChat());
      workflow.resetWorkflow();
    },
    
    // Set the chat mode
    setChatMode: (mode: ChatMode): void => {
      dispatch(chatActions.setMode(mode));
    },
    
    // Start verification process
    startVerification: async (content: string, options?: VerificationOptions): Promise<void> => {
      // Set mode to verification
      dispatch(chatActions.setMode('verification'));
      
      // Start verification in state
      dispatch(chatActions.startVerification(content, options));
      
      // Post the summary for verification
      const summaryId = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      
      // Add the summary message
      const message: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        createdAt: new Date(),
        metadata: {
          isSummary: true,
          summaryVersionId: summaryId,
          verificationMetadata: {
            verificationStatus: 'pending',
            originalSummaryId: summaryId,
            currentVersionId: summaryId,
            correctionCount: 0,
            startedAt: timestamp,
            lastUpdated: timestamp,
            corrections: []
          }
        }
      };
      
      dispatch(chatActions.addMessage(message));
    },
    
    // Submit a correction
    submitCorrection: async (correction: string): Promise<void> => {
      try {
        dispatch(chatActions.setLoading(true));
        dispatch(chatActions.submitCorrection(correction));
        
        // Add user correction message
        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: "user",
          content: correction,
          createdAt: new Date(),
          metadata: {
            isCorrection: true,
            summaryVersionId: state.verification.summaryVersions[state.verification.summaryVersions.length - 1]?.id
          }
        };
        
        dispatch(chatActions.addMessage(userMessage));
        
        // Add a processing message
        const processingMessage: Message = {
          id: crypto.randomUUID(),
          role: "system",
          content: "Processing your correction...",
          createdAt: new Date(),
          metadata: {
            type: "progress",
            isProgress: true,
            progressValue: 0,
            progressPhase: "correction"
          }
        };
        
        dispatch(chatActions.addMessage(processingMessage));
        
        // Use the workflow to process the correction
        if (workflow && 'processCorrection' in workflow && typeof workflow.processCorrection === 'function') {
          const result = await workflow.processCorrection(
            state.verification.currentSummary || '',
            correction,
            userMessage.id
          );
          
          if (result) {
            // Add the corrected summary
            const newSummaryMessage: Message = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: result.summary,
              createdAt: new Date(),
              metadata: {
                isSummary: true,
                summaryVersionId: result.summaryId,
                verificationMetadata: {
                  verificationStatus: 'in_progress',
                  originalSummaryId: state.verification.summaryVersions[0]?.id || result.summaryId,
                  currentVersionId: result.summaryId,
                  correctionCount: result.correctionCount,
                  startedAt: state.verification.summaryVersions[0]?.timestamp || new Date().toISOString(),
                  lastUpdated: new Date().toISOString()
                }
              }
            };
            
            dispatch(chatActions.addMessage(newSummaryMessage));
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Error processing correction";
        dispatch(chatActions.setError(errorMsg));
        
        // Add error message
        dispatch(chatActions.addMessage({
          role: "system",
          content: `Error processing correction: ${errorMsg}. Please try again or simplify your correction.`,
          createdAt: new Date(),
          metadata: {
            type: "error",
            isError: true
          }
        }));
      } finally {
        dispatch(chatActions.setLoading(false));
      }
    },
    
    // Complete verification
    completeVerification: async (isApproved: boolean): Promise<VerificationResult> => {
      try {
        if (!state.verification.currentSummary) {
          throw new Error("No summary to verify");
        }
        
        // Add confirmation message
        dispatch(chatActions.addMessage({
          role: "system",
          content: "Verification completed successfully. The summary has been approved.",
          createdAt: new Date(),
          metadata: {
            type: "verification_complete",
            isVerificationComplete: true
          }
        }));
        
        // Update state
        dispatch(chatActions.completeVerification(isApproved));
        
        // Build the verification result
        const result: VerificationResult = {
          isCompleted: true,
          isApproved,
          items: state.verification.verificationItems,
          completedAt: new Date().toISOString(),
          verificationMetadata: {
            verificationStatus: 'completed',
            originalSummaryId: state.verification.summaryVersions[0]?.id || '',
            currentVersionId: state.verification.summaryVersions[state.verification.summaryVersions.length - 1]?.id || '',
            correctionCount: state.verification.summaryVersions.length - 1,
            corrections: state.verification.summaryVersions.map(v => ({
              id: v.id,
              text: v.content,
              timestamp: v.timestamp
            })),
            startedAt: state.verification.summaryVersions[0]?.timestamp,
            lastUpdated: new Date().toISOString(),
            verifiedAt: new Date().toISOString()
          }
        };
        
        // Complete in workflow if available
        if (workflow && 'completeVerification' in workflow && typeof workflow.completeVerification === 'function') {
          await workflow.completeVerification(isApproved);
        }
        
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Error completing verification";
        dispatch(chatActions.setError(errorMsg));
        throw error;
      }
    },
    
    // Update extraction progress
    updateExtractionProgress: (messageId: string, progress: number, phase: string, replace: boolean = false): void => {
      dispatch(chatActions.updateProgress(messageId, progress, phase));
      
      // If replace is true, we might also want to update the content
      if (replace) {
        // We would need to implement a specific action for this if needed
      }
    },
    
    // Post a summary message
    postSummaryMessage: (summary: string): Message => {
      const summaryId = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      
      // Create message
      const message: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: summary,
        createdAt: new Date(),
        metadata: {
          isSummary: true,
          summaryVersionId: summaryId,
          verificationMetadata: {
            verificationStatus: 'pending',
            originalSummaryId: summaryId,
            currentVersionId: summaryId,
            correctionCount: 0,
            startedAt: timestamp,
            lastUpdated: timestamp,
            corrections: []
          }
        }
      };
      
      // Dispatch action to start verification
      dispatch(chatActions.startVerification(summary));
      
      // Add the message
      dispatch(chatActions.addMessage(message));
      
      return message;
    },
    
    // Handle correction message - this is mostly covered by submitCorrection
    handleCorrectionMessage: async (correctionText: string): Promise<void> => {
      await actions.submitCorrection(correctionText);
    },
    
    // Update summary after correction - rarely called directly
    updateSummaryAfterCorrection: (newSummary: string): Message => {
      const newVersionId = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      
      // Create metadata
      const metadata: MessageMetadata = {
        isSummary: true,
        summaryVersionId: newVersionId,
        verificationMetadata: {
          verificationStatus: 'in_progress',
          originalSummaryId: state.verification.summaryVersions[0]?.id || newVersionId,
          currentVersionId: newVersionId,
          correctionCount: state.verification.summaryVersions.length,
          corrections: [...(state.verification.summaryVersions.map(v => ({
            id: v.id,
            text: v.content,
            timestamp: v.timestamp
          }))), {
            id: newVersionId,
            text: newSummary,
            timestamp
          }],
          startedAt: state.verification.summaryVersions[0]?.timestamp || timestamp,
          lastUpdated: timestamp
        }
      };
      
      // Create message
      const message: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: newSummary,
        createdAt: new Date(),
        metadata
      };
      
      // Add the message
      dispatch(chatActions.addMessage(message));
      
      return message;
    },
    
    // Aliases for backward compatibility
    setMode: (newMode: ChatMode): void => {
      dispatch(chatActions.setMode(newMode));
    },
    clearChat: (): void => {
      dispatch(chatActions.resetChat());
      workflow.resetWorkflow();
    },
    
    // For backward compatibility with older code that uses confirmVerification
    confirmVerification: async (): Promise<VerificationResult> => {
      return actions.completeVerification(true);
    }
  }), [state, dispatch, workflow]);

  // Return a compatibility object that matches the old context structure
  return {
    // State from reducer
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    mode: state.mode,
    chatId: state.chatId,
    
    // Verification state
    verification: {
      isInVerificationMode: state.verification.isInVerificationMode,
      currentSummary: state.verification.currentSummary,
      summaryVersions: state.verification.summaryVersions,
      verificationStatus: state.verification.verificationStatus === 'failed' 
        ? 'in_progress' // Map 'failed' to 'in_progress' for compatibility
        : state.verification.verificationStatus as 'pending' | 'in_progress' | 'completed',
      verificationItems: state.verification.verificationItems
    },
    
    // Pass workflow through
    workflow,
    workflowStep: workflow.workflowStep,
    
    // Include all the action methods
    ...actions
  };
}