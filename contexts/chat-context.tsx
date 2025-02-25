"use client";

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useReducer, useRef, useMemo } from "react";

// Import types from our centralized type system
import type { 
  ChatContextType, 
  ChatState, 
  ChatMode, 
  Message, 
  VerificationStatus,
  IntegratedMessage,
  WorkflowStep as ChatWorkflowStep,
  MessageMetadata
} from "@/lib/chat/types";

// Import the processing workflow hook
import type { WorkflowStep as ProcessingWorkflowStep } from "@/lib/hooks/use-processing-workflow";
import { useProcessingWorkflow } from "@/lib/hooks/use-processing-workflow";

// Import all necessary types from our processing types
import type { 
  ProcessingStatus, 
  ExtractedDocument,
  VerificationItem,
  VerifiedDocument,
  ResearchResult,
  ResearchSource,
  ResearchDocument,
  ReportData,
  ReportOptions,
  ReportFormat,
  ReportDocument,
  DocumentType
} from "@/lib/processing/types/index";

import { DataExtractor } from "@/lib/processing/data-extractor";
import type { Database } from '@/lib/supabase';
import { createBrowserClient } from "@/lib/supabase/clients";

// Define our own Message type that's separate from the base Message type
// This helps avoid the type compatibility issues
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  metadata?: {
    type?: 'verification' | 'research' | 'report' | 'follow_up';
    confidence?: number;
    verificationStatus?: VerificationStatus;
    researchSources?: ResearchSource[];
    reportData?: ReportData;
    sources?: ResearchSource[];
  };
}

// Define our own independent state type
interface ExtendedChatState {
  workflowStep: ChatWorkflowStep;
  extractedData?: ExtractedDocument;
  verifiedData?: Record<string, any>;
  processingStatus: ProcessingStatus;
  verificationItems?: VerificationItem[];
  // Base properties from ChatState
  mode: ChatMode;
  messages: ChatMessage[];
  isLoading: boolean;
  error?: string;
  // New fields for deep research
  researchResults?: ResearchResult[];
  reportData?: ReportData;
  reportFormat?: ReportFormat;
  researchProgress?: {
    phase: 'research' | 'generation' | 'formatting';
    percent: number;
  };
}

/**
 * Define a complete ExtendedChatContextType with all the methods
 * needed for deep research and report generation.
 */
interface ExtendedChatContextType {
  state: ExtendedChatState;
  sendMessage: (content: string) => Promise<void>;
  setMode: (mode: ChatMode) => void;
  verifyData: (messageId: string, status: VerificationStatus) => void;
  clearChat: () => void;
  processDocument: (file: File) => Promise<void>;
  performDeepResearch: (query: string, options?: {
    depth?: 'basic' | 'standard' | 'comprehensive';
    patientId?: string;
    sourcesLimit?: number;
    includeSourceContent?: boolean;
  }) => Promise<ResearchResult | null>;
  generateReport: (options?: Omit<ReportOptions, 'onProgress'>) => Promise<ReportData | null>;
  formatReport: (format: ReportFormat) => Promise<string | null>;
  setWorkflowStep: (step: ChatWorkflowStep) => void;
  setReportFormat: (format: ReportFormat) => void;
  generateReportInChat: (params: { patientId: string; patientInfo: any }) => Promise<void>;
  processingWorkflow: ReturnType<typeof useProcessingWorkflow>;
}

// Define a custom ExtendedChatAction with all possible actions
type ExtendedChatAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_MODE"; payload: ChatMode }
  | { type: "SET_WORKFLOW_STEP"; payload: ChatWorkflowStep }
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | { type: "SET_ERROR"; payload: string | undefined }
  | { type: "VERIFY_DATA"; payload: { messageId: string; status: VerificationStatus } }
  | { type: "SET_EXTRACTED_DATA"; payload: ExtractedDocument }
  | { type: "SET_VERIFIED_DATA"; payload: Record<string, any> }
  | { type: "SET_PROCESSING_STATUS"; payload: ProcessingStatus }
  | { type: "SET_VERIFICATION_ITEMS"; payload: VerificationItem[] }
  | { type: "CLEAR_CHAT" }
  | { type: "SET_RESEARCH_RESULTS"; payload: ResearchResult[] }
  | { type: "SET_REPORT_DATA"; payload: ReportData }
  | { type: "SET_REPORT_FORMAT"; payload: 'markdown' | 'html' | 'pdf' }
  | { type: "SET_RESEARCH_PROGRESS"; payload: { phase: 'research' | 'generation' | 'formatting', percent: number } };

const initialState: ExtendedChatState = {
  workflowStep: "idle",
  mode: "regular",
  messages: [],
  isLoading: false,
  processingStatus: {
    status: 'idle',
    progress: 0
  }
};

// Update the reducer to handle all action types
function reducer(state: ExtendedChatState, action: ExtendedChatAction): ExtendedChatState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_MODE":
      return { ...state, mode: action.payload };
    case "SET_WORKFLOW_STEP":
      return { ...state, workflowStep: action.payload };
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "VERIFY_DATA":
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.messageId
            ? {
                ...msg,
                metadata: {
                  ...msg.metadata,
                  verificationStatus: action.payload.status
                }
              }
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
    case "SET_RESEARCH_RESULTS":
      return { ...state, researchResults: action.payload };
    case "SET_REPORT_DATA":
      return { ...state, reportData: action.payload };
    case "SET_REPORT_FORMAT":
      return { ...state, reportFormat: action.payload };
    case "SET_RESEARCH_PROGRESS":
      return { ...state, researchProgress: action.payload };
    default:
      return state;
  }
}

const ChatContext = createContext<ExtendedChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { readonly children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const supabaseRef = useRef<SupabaseClient<Database>>();
  
  // Add the processing workflow hook
  const processingWorkflow = useProcessingWorkflow();

  // Initialize Supabase client
  useEffect(() => {
    supabaseRef.current = createBrowserClient();
  }, []);
  
  // Sync workflow state to chat context
  useEffect(() => {
    // Update processing status
    if (processingWorkflow.status) {
      dispatch({ 
        type: "SET_PROCESSING_STATUS", 
        payload: processingWorkflow.status 
      });
    }
    
    // Update workflow step
    if (processingWorkflow.workflowStep) {
      const chatStep = mapToWorkflowStep(processingWorkflow.workflowStep);
      dispatch({ 
        type: "SET_WORKFLOW_STEP", 
        payload: chatStep 
      });
    }
    
    // Update extracted document
    if (processingWorkflow.extractedDocument) {
      dispatch({ 
        type: "SET_EXTRACTED_DATA", 
        payload: processingWorkflow.extractedDocument 
      });
    }
    
    // Update verification items
    if (processingWorkflow.verificationItems) {
      dispatch({ 
        type: "SET_VERIFICATION_ITEMS", 
        payload: processingWorkflow.verificationItems 
      });
    }
    
    // Update research results
    if (processingWorkflow.researchResults?.length) {
      dispatch({ 
        type: "SET_RESEARCH_RESULTS", 
        payload: processingWorkflow.researchResults 
      });
    }
    
    // Update report data
    if (processingWorkflow.reportData) {
      dispatch({ 
        type: "SET_REPORT_DATA", 
        payload: processingWorkflow.reportData 
      });
    }
    
    // Update error state
    if (processingWorkflow.error) {
      dispatch({ 
        type: "SET_ERROR", 
        payload: processingWorkflow.error 
      });
    }
  }, [processingWorkflow]);
  
  // Helper function to map between workflow steps
  const mapToWorkflowStep = (processingStep: ProcessingWorkflowStep): ChatWorkflowStep => {
    switch (processingStep) {
      case 'document_processing': return "extracting";
      case 'verification': return "verification";
      case 'research': return "report_confirmation";
      case 'report_generation': return "report_generation";
      case 'report_formatting': return "report_formatting";
      case 'complete': return "complete";
      default: return "idle";
    }
  };
  
  const mapFromWorkflowStep = (chatStep: ChatWorkflowStep): ProcessingWorkflowStep => {
    switch (chatStep) {
      case "extracting": return "document_processing";
      case "verification": return "verification";
      case "report_confirmation": return "research";
      case "report_generation": return "report_generation";
      case "report_formatting": return "report_formatting";
      case "report_presentation": return "report_formatting";
      case "complete": return "complete";
      default: return "idle";
    }
  };
  
  // Helper functions for message creation
  const addAssistantMessage = (
    content: string, 
    type?: string, 
    metadata?: any
  ): ChatMessage => {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      createdAt: new Date(),
      metadata: { 
        ...(type ? { type } : {}), 
        ...metadata 
      }
    };
    
    dispatch({ type: "ADD_MESSAGE", payload: message });
    return message;
  };
  
  const addSystemMessage = (
    content: string, 
    type?: string, 
    metadata?: any
  ): ChatMessage => {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: "system",
      content,
      createdAt: new Date(),
      metadata: { 
        ...(type ? { type } : {}), 
        ...metadata 
      }
    };
    
    dispatch({ type: "ADD_MESSAGE", payload: message });
    return message;
  };
  
  const handleProcessingError = (errorMessage: string) => {
    dispatch({ type: "SET_ERROR", payload: errorMessage });
    dispatch({ type: "SET_LOADING", payload: false });
    dispatch({ type: "SET_WORKFLOW_STEP", payload: "idle" });
  };
  
  const processDocument = async (file: File): Promise<void> => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_WORKFLOW_STEP", payload: "extracting" });
      dispatch({ type: "SET_MODE", payload: "verification" });

      // Use the workflow's document processing functionality
      const result = await processingWorkflow.processDocument(file, 'chat-patient');
      
      if (result) {
        // Get summary from the extracted data
        const summary = result.extractedData.metadata.docType || "Document processed successfully";

        // Add system message with summary
        addSystemMessage(summary, "verification", {
          confidence: 0.8 // Default confidence
        });
      }
    } catch (error) {
      handleProcessingError("Failed to process document");
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  // Method to generate a report directly in the chat flow
  const generateReportInChat = async (params: { patientId: string; patientInfo: any }) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_WORKFLOW_STEP", payload: "report_generation" });

      // Use the workflow's report generation functionality
      const result = await processingWorkflow.generateReport();
      
      if (result) {
        // Format the message to show in chat
        const finalMessageContent = `**Report Generated**\n\n**Title**: Medical Report for ${params.patientInfo.name || 'Unknown'}\n\n**Summary**:\n${result.sections?.summary || "Report generated successfully"}\n\n**Type**: Clinical Summary\n\n**Status**: Completed\n\n*You can view more details in the Reports section.*`;

        addAssistantMessage(finalMessageContent, "report", { reportData: result });
        dispatch({ type: "SET_WORKFLOW_STEP", payload: "complete" });
      }
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Failed to generate report" });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  // Perform deep research - using the workflow
  const performDeepResearch = async (
    query: string,
    options?: {
      depth?: 'basic' | 'standard' | 'comprehensive';
      patientId?: string;
      sourcesLimit?: number;
      includeSourceContent?: boolean;
    }
  ): Promise<ResearchResult | null> => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      
      // Use the workflow's research functionality
      const result = await processingWorkflow.performResearch(query, options);
      
      if (result) {
        // Add research message
        addAssistantMessage(result.summary, "research", {
          confidence: 0.85,
          researchSources: result.sources
        });
        
        return result;
      }
      return null;
    } catch (error) {
      handleProcessingError("Failed to perform deep research");
      return null;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  // Generate report - using the workflow
  const generateReport = async (
    options?: Omit<ReportOptions, 'onProgress'>
  ): Promise<ReportData | null> => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_WORKFLOW_STEP", payload: "report_generation" });

      // Use the workflow's report generation functionality
      const result = await processingWorkflow.generateReport(options);
      
      if (result) {
        // Add report message
        addAssistantMessage(
          "I've generated a detailed medical report based on our analysis. Would you like to review it?", 
          "report", 
          { reportData: result }
        );
        
        dispatch({ type: "SET_WORKFLOW_STEP", payload: "report_presentation" });
        return result;
      }
      return null;
    } catch (error) {
      handleProcessingError("Failed to generate report");
      return null;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  // Format report - using the workflow
  const formatReport = async (format: ReportFormat): Promise<string | null> => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      
      // Use the workflow's report formatting functionality
      const result = await processingWorkflow.formatReport(format);
      
      if (result) {
        // Add formatted message
        addAssistantMessage(
          `Your report has been formatted in ${format} format. You can now download it or ask follow-up questions.`,
          "follow_up"
        );
        
        return result;
      }
      return null;
    } catch (error) {
      handleProcessingError(`Failed to format report to ${format}`);
      return null;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const sendMessage = async (content: string): Promise<void> => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        createdAt: new Date()
      };

      dispatch({ type: "ADD_MESSAGE", payload: userMessage });

      // Check if we're in verification mode
      if (state.mode === "verification") {
        // Complete verification and proceed with the workflow
        if (content.toLowerCase().includes("verify") || content.toLowerCase().includes("confirm")) {
          const result = await processingWorkflow.completeVerification();
          if (result) {
            addSystemMessage("Data verification completed. You can now proceed with your report.", "verification");
          }
        }
      } else {
        // Regular chat mode - call API or process directly
        const useChatAPI = true; // Set based on config or env
        
        if (useChatAPI) {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              message: content,
              history: state.messages 
            })
          });
          
          if (!response.ok) {
            throw new Error(`Chat request failed with status ${response.status}`);
          }
          
          const responseData = await response.json();
          
          addAssistantMessage(responseData.text);
        } else {
          // Local processing without API
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing
          
          addAssistantMessage(`I received: "${content}". This is a mock response.`);
        }
      }
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Failed to send message" });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const verifyData = (messageId: string, status: VerificationStatus): void => {
    dispatch({
      type: "VERIFY_DATA",
      payload: { messageId, status }
    });

    // If status is verified, complete verification in the workflow
    if (status.isVerified) {
      processingWorkflow.completeVerification()
        .then(result => {
          if (result) {
            // Add verification confirmation
            addSystemMessage("Data verification completed. You can now proceed with your report.");
            dispatch({ type: "SET_WORKFLOW_STEP", payload: "report_confirmation" });
          }
          return result;
        })
        .catch(error => {
          console.error("Error completing verification:", error);
        });
    }
  };

  const setMode = (mode: ChatMode): void => {
    dispatch({ type: "SET_MODE", payload: mode });
  };

  const clearChat = (): void => {
    dispatch({ type: "CLEAR_CHAT" });
    processingWorkflow.resetWorkflow();
  };

  const setWorkflowStep = (step: ChatWorkflowStep): void => {
    dispatch({ type: "SET_WORKFLOW_STEP", payload: step });
    
    // Sync with processing workflow
    const processingStep = mapFromWorkflowStep(step);
    if (processingStep) {
      // Most workflow steps need to be triggered by actual actions
      // This is mainly used for UI state synchronization
      if (processingWorkflow.workflowStep !== processingStep) {
        console.log(`Syncing workflow step to: ${processingStep}`);
        // No direct API to set the workflow step in the processing workflow
      }
    }
  };

  const setReportFormat = (format: ReportFormat): void => {
    dispatch({ type: "SET_REPORT_FORMAT", payload: format });
  };

  // Define the context value with all the functions and state
  const value = useMemo(
    () => ({
      state,
      sendMessage,
      setMode,
      verifyData,
      clearChat,
      processDocument,
      performDeepResearch,
      generateReport,
      formatReport,
      setWorkflowStep,
      setReportFormat,
      generateReportInChat,
      // Optionally expose the processing workflow
      processingWorkflow
    }),
    [state, processingWorkflow]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext(): ExtendedChatContextType {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}