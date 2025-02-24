"use client";

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useReducer, useRef, useMemo } from "react";

import type { ChatContextType, ChatState, ChatMode, Message, VerificationStatus } from "@/lib/chat/types";
import { DataExtractor } from "@/lib/processing/data-extractor";
import { DocumentExtraction } from "@/lib/processing/document-extraction";
import type { ExtractedData, ProcessingStatus, VerificationItem, DocumentType } from "@/lib/processing/types";
import type { Database } from '@/lib/supabase';
import { createBrowserClient } from "@/lib/supabase/clients";


/** Workflow steps for the entire pipeline. */
export type WorkflowStep = "idle" | "uploading" | "extracting" | "verification" | "report_generation" | "complete";

interface ExtendedChatState extends ChatState {
  workflowStep: WorkflowStep;
  extractedData?: ExtractedData;
  verifiedData?: Record<string, any>;
  processingStatus?: ProcessingStatus;
  verificationItems?: VerificationItem[];
  mode: ChatMode;
  messages: Message[];
  isLoading: boolean;
  error?: string;
}

type ExtendedChatAction =
  | { type: "SET_MODE"; payload: ChatMode }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_WORKFLOW_STEP"; payload: WorkflowStep }
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "SET_ERROR"; payload: string | undefined }
  | { type: "VERIFY_DATA"; payload: { messageId: string; status: VerificationStatus } }
  | { type: "SET_EXTRACTED_DATA"; payload: ExtractedData }
  | { type: "SET_VERIFIED_DATA"; payload: Record<string, any> }
  | { type: "SET_PROCESSING_STATUS"; payload: ProcessingStatus }
  | { type: "SET_VERIFICATION_ITEMS"; payload: VerificationItem[] }
  | { type: "CLEAR_CHAT" };

const initialState: ExtendedChatState = {
  mode: "regular",
  messages: [],
  isLoading: false,
  workflowStep: "idle" // will be rehydrated from DB if available
};

function chatReducer(state: ExtendedChatState, action: ExtendedChatAction): ExtendedChatState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.payload };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_WORKFLOW_STEP":
      return { ...state, workflowStep: action.payload };

    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "VERIFY_DATA":
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.payload.messageId
            ? { ...msg, metadata: { ...msg.metadata, verificationStatus: action.payload.status } }
            : msg
        )
      };

    case "SET_EXTRACTED_DATA":
      return { ...state, extractedData: action.payload };

    case "SET_VERIFIED_DATA":
      return { ...state, verifiedData: action.payload };

    case "SET_PROCESSING_STATUS":
      return { ...state, processingStatus: action.payload };

    case "SET_VERIFICATION_ITEMS":
      return { ...state, verificationItems: action.payload };

    case "CLEAR_CHAT":
      return { ...initialState };

    default:
      return state;
  }
}

interface ExtendedChatContextType extends ChatContextType {
  processDocument: (file: File) => Promise<void>;
  verifyExtractedData: (items: VerificationItem[]) => Promise<void>;
  /** Expose a function to set the workflow step, e.g., "uploading", "extracting", etc. */
  setWorkflowStep: (step: WorkflowStep) => void;
  /** Expose a function to store user-corrected data. */
  updateVerifiedData: (verified: Record<string, any>) => void;
  /** Expose a function to handle errors. */
  handleError: (errorMsg: string) => void;
  generateReportInChat: (params: { patientId: string; patientInfo: any }) => Promise<void>;
}

const ChatContext = createContext<ExtendedChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { readonly children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const supabaseRef = useRef<SupabaseClient<Database>>();

  // Initialize Supabase client synchronously
  useEffect(() => {
    supabaseRef.current = createBrowserClient();
  }, []);

  // Example function to finalize the report
  async function finalizeReportInChat(reportId: string) {
    if (!supabaseRef.current) {
      console.error("Supabase client not initialized");
      return;
    }

    try {
      const { data: reportData, error } = await supabaseRef.current
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) throw error;

      const finalMessageContent = `**Report Generated**\n\n**Title**: ${reportData.title}\n\n**Summary**:\n${reportData.summary || "No summary"}\n\n**Type**: ${reportData.type}\n\n**Status**: ${reportData.status}\n\n*You can view more details in the Reports section.*`;

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: finalMessageContent,
        createdAt: new Date(),
        metadata: {
          type: "verification",
          confidence: 1,
        },
      };
      dispatch({ type: "ADD_MESSAGE", payload: assistantMessage });

    } catch (err) {
      console.error("Failed to finalize report in chat:", err);
    }
  }

  // On mount, rehydrate workflow step from DB
  useEffect(() => {
    loadWorkflowStepFromDB().catch(console.error);
  }, []);

  async function loadWorkflowStepFromDB() {
    try {
      // Use localStorage instead of DB since workflow_state table doesn't exist
      const savedStep = localStorage.getItem('workflow_step');
      if (savedStep) {
        dispatch({ type: "SET_WORKFLOW_STEP", payload: savedStep as WorkflowStep });
      }
    } catch (error) {
      console.error("Failed to load workflow step:", error);
    }
  }

  async function saveWorkflowStepToDB(step: WorkflowStep) {
    try {
      // Use localStorage instead of DB since workflow_state table doesn't exist
      localStorage.setItem('workflow_step', step);
    } catch (error) {
      console.error("Failed to save workflow step:", error);
    }
  }

  const processDocument = async (file: File) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_WORKFLOW_STEP", payload: "extracting" });
      dispatch({ type: "SET_MODE", payload: "verification" });

      // Extract text from document
      const { streamData } = await new DataExtractor().streamExtraction(file);
      const text = await streamData.text;

      // Process with DocumentExtraction
      const documentType: DocumentType = {
        category: 'clinical',
        type: 'chat_upload'
      };

      const extraction = new DocumentExtraction();
      const result = await extraction.extractData(text, documentType);
      const summary = await extraction.summarizeDocument(text, documentType);

      dispatch({ type: "SET_EXTRACTED_DATA", payload: result });

      // Add system message with summary
      const summaryMessage: Message = {
        id: crypto.randomUUID(),
        role: "system",
        content: summary,
        createdAt: new Date(),
        metadata: {
          type: "verification",
          confidence: 0.8 // Default confidence since summarizeDocument doesn't return it
        }
      };
      dispatch({ type: "ADD_MESSAGE", payload: summaryMessage });

    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Failed to process document" });
      dispatch({ type: "SET_WORKFLOW_STEP", payload: "idle" });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  async function handleGenerateReport({ patientId, patientInfo }: { patientId: string; patientInfo: any }) {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      
      const verifiedData = state.verifiedData ?? patientInfo;
      
      const response = await fetch("/api/generateReport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          title: "Auto-Generated AI Report",
          type: "diagnostic",
          departmentId: "your-dept-id-here",
          patientInfo,
          verifiedData
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate report: ${response.statusText}`);
      }

      const { reportId } = await response.json();
      await finalizeReportInChat(reportId);
      setWorkflowStep("complete");
    } catch (err: any) {
      dispatch({ type: "SET_ERROR", payload: err.message });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }

  const sendMessage = async (content: string) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        createdAt: new Date()
      };
      dispatch({ type: "ADD_MESSAGE", payload: userMessage });

      // TODO: Implement real LLM or API call to get an assistant response
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "This is a mock response. API integration pending.",
        createdAt: new Date()
      };
      dispatch({ type: "ADD_MESSAGE", payload: assistantMessage });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Failed to send message" });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  /** Called when user finalizes verification. */
  const verifyExtractedData = async (items: VerificationItem[]) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_VERIFICATION_ITEMS", payload: items });

      // Possibly combine all user corrections into final data
      // This is a simplified example
      const finalData = assembleVerifiedData(items);
      dispatch({ type: "SET_VERIFIED_DATA", payload: finalData });

      // Optionally add a verification confirmation message
      const verificationMessage: Message = {
        id: crypto.randomUUID(),
        role: "system",
        content: "Document information has been verified.",
        createdAt: new Date(),
        metadata: {
          type: "verification",
          verificationStatus: {
            isVerified: true,
            verifiedAt: new Date()
          }
        }
      };
      dispatch({ type: "ADD_MESSAGE", payload: verificationMessage });

      // Move to next step (e.g., "report_generation") or go back to "regular" chat mode
      dispatch({ type: "SET_WORKFLOW_STEP", payload: "report_generation" });
      dispatch({ type: "SET_MODE", payload: "regular" });

    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Failed to verify data" });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  function setMode(mode: ChatMode) {
    dispatch({ type: "SET_MODE", payload: mode });
  }

  function verifyData(messageId: string, status: VerificationStatus) {
    dispatch({ type: "VERIFY_DATA", payload: { messageId, status } });
  }

  function clearChat() {
    dispatch({ type: "CLEAR_CHAT" });
  }

  function setWorkflowStep(step: WorkflowStep) {
    dispatch({ type: "SET_WORKFLOW_STEP", payload: step });
    // Persist step in DB
    saveWorkflowStepToDB(step).catch(err => {
      console.error("Could not persist workflow step:", err);
    });
  
    // Simple redirect logic: if user tries going to "report_generation" without verifying, revert:
    if (step === "report_generation" && state.workflowStep !== "verification") {
      console.warn("User attempted to skip verification. Reverting to 'verification' step");
      dispatch({ type: "SET_WORKFLOW_STEP", payload: "verification" });
    }
  }

  function updateVerifiedData(verified: Record<string, any>) {
    dispatch({ type: "SET_VERIFIED_DATA", payload: verified });
  }

  function handleError(errorMsg: string) {
    dispatch({ type: "SET_ERROR", payload: errorMsg });
  }

  // Wrap the contextValue in a useMemo to avoid unnecessary re-renders
  const contextValue = useMemo(() => ({
    state,
    sendMessage,
    setMode,
    verifyData,
    clearChat,
    processDocument,
    verifyExtractedData,
    setWorkflowStep,
    updateVerifiedData,
    handleError,
    generateReportInChat: handleGenerateReport
  }), [state, sendMessage, setMode, verifyData, clearChat, processDocument, verifyExtractedData, setWorkflowStep, updateVerifiedData, handleError, handleGenerateReport]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

/** Helper for final data assembly from verification items */
function assembleVerifiedData(items: VerificationItem[]) {
  const grouped: Record<string, any[]> = {};
  for (const item of items) {
    // Ensure value and correction are objects before spreading
    const itemValue = typeof item.value === 'object' ? item.value : { value: item.value };
    const itemCorrection = item.correction && typeof item.correction === 'object' ? item.correction : {};
    
    const correctedValue = item.correction 
      ? { ...itemValue, ...itemCorrection }
      : itemValue;
      
    if (!grouped[item.section]) {
      grouped[item.section] = [];
    }
    grouped[item.section].push(correctedValue);
  }
  return grouped;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}