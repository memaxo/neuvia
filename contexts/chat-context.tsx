"use client";

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";

// Import types from our centralized type system
import type { 
  ChatMode, 
  Message, 
  MessageMetadata,
  ExtendedChatContextType,
  UseProcessingWorkflowResult
} from "@/lib/chat/types";

// Import the processing workflow hook
import { useProcessingWorkflow } from "@/lib/hooks/use-processing-workflow";

import type { VerificationStatus } from "@/lib/processing/types/verification";
import type { Database } from '@/lib/supabase';
import { createBrowserClient } from "@/lib/supabase/clients";

const ChatContext = createContext<ExtendedChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { readonly children: ReactNode }) {
  // Chat-specific state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>("regular");
  
  // Use the processing workflow directly
  const workflow = useProcessingWorkflow();
  const supabaseRef = useRef<SupabaseClient<Database>>();
  
  // Initialize Supabase client
  useEffect(() => {
    supabaseRef.current = createBrowserClient();
  }, []);
  
  // Helper functions for message creation
  const addAssistantMessage = useCallback((
    content: string, 
    type?: string, 
    metadata?: any
  ): Message => {
    const message: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      createdAt: new Date(),
      metadata: { 
        ...(type ? { type } : {}), 
        ...metadata 
      }
    };
    
    setMessages(prev => [...prev, message]);
    return message;
  }, []);
  
  const addSystemMessage = useCallback((
    content: string, 
    type?: string, 
    metadata?: any
  ): Message => {
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
    
    setMessages(prev => [...prev, message]);
    return message;
  }, []);
  
  // Send a message in the chat
  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!content.trim()) return;
    
    try {
      setIsLoading(true);
      
      // Add user message
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        createdAt: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      
      // Handle workflow specific interactions
      const currentWorkflowStep = workflow.workflowStep;
      
      if (currentWorkflowStep === 'verification') {
        // Handle verification message
        const verificationResponse = "Your document is being verified. Please confirm the extracted information.";
        addAssistantMessage(verificationResponse, "verification");
      } 
      else if (currentWorkflowStep === 'report_generation') {
        // Handle report generation message
        const reportResponse = "I'm generating your report based on the verified information.";
        addAssistantMessage(reportResponse, "report");
      }
      else {
        // Regular chat - here we would normally call an AI API
        // For now, just simulate a response
        const assistantResponse = `I received your message: "${content}".`;
        addAssistantMessage(assistantResponse);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "An error occurred";
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [workflow.workflowStep, addAssistantMessage]);
  
  // Clear the chat and reset workflow
  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    // Reset workflow state
    workflow.resetWorkflow();
  }, [workflow]);
  
  // Set the chat mode
  const setModeCallback = useCallback((newMode: ChatMode) => {
    setMode(newMode);
  }, []);
  
  // Context value with both chat and workflow concerns
  const value = useMemo(() => ({
    // Chat state
    messages,
    isLoading,
    error,
    mode,
    
    // Chat methods
    sendMessage,
    addSystemMessage,
    clearChat,
    setMode: setModeCallback,
    
    // Direct access to workflow
    workflow
  }), [messages, isLoading, error, mode, sendMessage, addSystemMessage, clearChat, setModeCallback, workflow]);
  
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext(): ExtendedChatContextType {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}