# Implementing a LangGraph Supervisor and Sub-agent System for Neuvia

This guide outlines a comprehensive approach to replace Neuvia's legacy chat service with a unified LangGraph-based architecture featuring a central supervisor and specialized sub-agents. This new architecture will provide better maintainability, real-time state management, and a consistent user experience.

## 1. Architectural Overview & Design

### LangGraph Supervisor and Sub-agents

The new system uses a **supervisor** to orchestrate specialized **sub-agents**, each handling distinct tasks in the medical workflow:

```
                      ┌───────────────────┐
                      │   LangGraph       │
                      │   Supervisor      │
                      └─────────┬─────────┘
                                │
        ┌─────────────┬─────────┼─────────┬─────────────┐
        │             │         │         │             │
┌───────▼─────┐ ┌─────▼───┐ ┌───▼───┐ ┌───▼────┐ ┌──────▼──────┐
│ Document    │ │ Patient  │ │ Verify │ │ Correct│ │ Report     │
│ Extraction  │ │ Summary  │ │ Summary│ │ Summary│ │ Generation │
└─────────────┘ └─────────┘ └───────┘ └────────┘ └─────────────┘
```

- **Supervisor**: Maintains the global workflow state, determines which sub-agent to invoke next, handles errors, and tracks progress.
- **Sub-agents**: Perform specialized tasks and return partial state updates to the supervisor.

### Workflow State Management

The workflow state is the central data structure shared across all components:

```typescript
export interface WorkflowState {
  // Core identifiers
  threadId: string;
  patientId: string;
  userId: string;
  
  // Document processing state
  documentId?: string;
  file?: File;
  extractedData?: {...};
  
  // Verification state
  verification: {
    status: VerificationStatus;
    corrections: Array<...>;
    ...
  };
  
  // Report generation state
  reportId?: string;
  
  // User interaction history
  interactionHistory?: Array<...>;
  
  // Error and progress tracking
  error?: {...};
  progress: {...};
}
```

This state is:
1. Updated by each sub-agent during execution
2. Persisted using a Supabase checkpointer
3. Synchronized with the React UI for real-time updates

### React Integration for Real-time Updates

The system integrates with React through:
- A Zustand store that manages local UI state
- Reactive components that subscribe to workflow state changes
- Real-time progress indicators and action buttons that respond to state transitions

## 2. Implementation Details

### Setting Up the LangGraph Supervisor

First, let's create a supervisor service that initializes and manages our workflows:

```typescript
// lib/services/langgraph/supervisor-service.ts
import { StateGraph } from '@langchain/langgraph';
import type { WorkflowState } from '@/lib/workflow/state/workflow-state';
import { SupabaseCheckpointer } from '@/lib/workflow/checkpointer/supabase-checkpointer';

export enum WorkflowType {
  PATIENT_SUMMARY = 'patient_summary',
  RAG = 'rag',
}

export class LangGraphSupervisorService {
  private readonly workflows: Map<string, any> = new Map();
  private readonly checkpointer: SupabaseCheckpointer;

  constructor() {
    this.checkpointer = new SupabaseCheckpointer();
    this.initializeWorkflows();
  }

  private initializeWorkflows() {
    // Initialize workflows with checkpointer
    const patientSummaryWorkflow = createPatientSummaryWorkflow(this.checkpointer);
    this.workflows.set(WorkflowType.PATIENT_SUMMARY, patientSummaryWorkflow);
    
    const ragWorkflow = createRAGWorkflow(this.checkpointer);
    this.workflows.set(WorkflowType.RAG, ragWorkflow);
  }

  async runWorkflow(
    workflowType: WorkflowType,
    initialState: Partial<WorkflowState>,
    options?: { startNodeId?: string }
  ): Promise<WorkflowState> {
    const workflow = this.workflows.get(workflowType);
    if (!workflow) {
      throw new Error(`Workflow ${workflowType} not found`);
    }
    
    // Run from specific node or from the beginning
    if (options?.startNodeId) {
      return await workflow.runFromNode(options.startNodeId, initialState);
    }
    
    return await workflow.run(initialState);
  }

  async getWorkflowState(threadId: string): Promise<WorkflowState | null> {
    try {
      const state = await this.checkpointer.get(threadId);
      return state;
    } catch (error) {
      console.error(`Error retrieving workflow state for thread ${threadId}:`, error);
      return null;
    }
  }
}

export const supervisorService = new LangGraphSupervisorService();
```

### Defining and Creating the State Graph

Now, let's define the main supervisor workflow graph:

```typescript
// lib/workflow/graphs/supervisor-workflow.ts
import { StateGraph } from '@langchain/langgraph';
import type { WorkflowState } from '../state/workflow-state';
import { VerificationStatus } from '@/lib/types/verification';
import { ProcessingPhase, WorkflowSteps } from '@/lib/types/workflow';

// Import all sub-agent nodes
import messageProcessingNode from '../nodes/chat/message-processing-node';
import responseGenerationNode from '../nodes/chat/response-generation-node';
import extractionNode from '../nodes/extraction-node';
import analysisNode from '../nodes/analysis-node';
import patientSummaryGenerationNode from '../nodes/patient/summary-generation-node';
import patientVerificationNode from '../nodes/patient/verification-node';
import patientCorrectionNode from '../nodes/patient/correction-node';
import reportGenerationNode from '../nodes/patient/report-generation-node';

export function createSupervisorWorkflow(checkpointer) {
  // Create workflow graph with channels for observability
  const graph = new StateGraph<WorkflowState>({
    channels: {
      chat: [],
      extraction: [],
      analysis: [],
      summarization: [],
      verification: [],
      report: [],
    },
  });
  
  // Add nodes to the graph
  graph
    .addNode('messageProcessing', messageProcessingNode)
    .addNode('responseGeneration', responseGenerationNode)
    .addNode('documentExtraction', extractionNode)
    .addNode('documentAnalysis', analysisNode)
    .addNode('patientSummaryGeneration', patientSummaryGenerationNode)
    .addNode('patientVerification', patientVerificationNode)
    .addNode('patientCorrection', patientCorrectionNode)
    .addNode('reportGeneration', reportGenerationNode);
  
  // Define conditional edges based on message intent
  graph.addConditionalEdges(
    'messageProcessing',
    (state) => {
      const intent = state.context?.lastIntent || 'general_chat';
      
      switch (intent) {
        case 'document_extraction': return 'documentExtraction';
        case 'verification': return 'patientVerification';
        case 'correction': return 'patientCorrection';
        case 'report_generation': return 'reportGeneration';
        default: return 'responseGeneration';
      }
    }
  );
  
  // Add standard processing flow edges
  graph
    .addEdge('documentExtraction', 'documentAnalysis')
    .addEdge('documentAnalysis', 'patientSummaryGeneration')
    .addEdge('patientSummaryGeneration', 'responseGeneration');
  
  // Add verification conditional edges
  graph.addConditionalEdges(
    'patientVerification',
    (state) => {
      if (state.needsCorrection) {
        return 'patientCorrection';
      }
      
      if (state.verification?.status === VerificationStatus.completed && state.readyForReport) {
        return 'reportGeneration';
      }
      
      return 'responseGeneration';
    }
  );
  
  // After correction, determine next step
  graph.addConditionalEdges(
    'patientCorrection',
    (state) => state.verification?.status === VerificationStatus.in_progress 
      ? 'patientVerification' : 'responseGeneration'
  );
  
  // Report generation leads to response
  graph.addEdge('reportGeneration', 'responseGeneration');
  
  // Define end state
  graph.setEndState((state) => ({
    threadId: state.threadId,
    status: state.error ? 'error' : 'completed',
    error: state.error?.message,
    completedAt: new Date().toISOString(),
  }));
  
  // Compile the graph with checkpointer
  return graph.compile({ checkpointer });
}
```

### Creating Message Processing and Response Generation Nodes

We need to add two new nodes to handle chat functionality:

```typescript
// lib/workflow/nodes/chat/message-processing-node.ts
import { WorkflowState, PartialWorkflowState } from '@/workflow/state/workflow-state';
import { ProcessingPhase } from '@/lib/types/workflow';
import { ChatMessageType } from '@/lib/types/chat';
import logger from '@/lib/logger';

export async function messageProcessingNode(
  state: WorkflowState
): Promise<PartialWorkflowState> {
  const moduleLogger = logger.withMetadata({
    node: 'messageProcessingNode',
    threadId: state.threadId,
  });

  try {
    moduleLogger.info('Processing user message');
    
    if (!state.currentMessage?.content) {
      throw new Error('No message content available for processing');
    }
    
    const messageContent = state.currentMessage.content;
    
    // Determine intent from message content
    let intent = 'general_chat';
    
    // Simple rule-based intent detection
    if (messageContent.toLowerCase().includes('extract') || 
        messageContent.toLowerCase().includes('process document')) {
      intent = 'document_extraction';
    } else if (messageContent.toLowerCase().includes('verify') || 
               messageContent.toLowerCase().includes('confirm')) {
      intent = 'verification';
    } 
    // Add more intent detection logic...
    
    // Update interaction history
    const interaction = {
      timestamp: new Date().toISOString(),
      message: messageContent,
      userId: state.currentMessage.userId || state.userId,
      role: 'user',
      messageType: ChatMessageType.USER,
      contextual: {
        step: 'message_processing',
        intent,
      },
    };
    
    const interactionHistory = state.interactionHistory || [];
    
    // Return updated state
    return {
      interactionHistory: [...interactionHistory, interaction],
      context: {
        ...state.context,
        lastIntent: intent,
      },
      progress: {
        currentStep: 'message_processing',
        percentage: 10,
        phase: ProcessingPhase.PROCESSING,
        isCompleted: false,
      },
    };
  } catch (error) {
    // Error handling
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'MESSAGE_PROCESSING_ERROR',
        step: 'message_processing',
        timestamp: new Date().toISOString(),
        recoverable: true,
      },
      progress: {
        currentStep: 'error',
        percentage: state.progress?.percentage || 0,
        phase: ProcessingPhase.ERROR,
        isCompleted: false,
      },
    };
  }
}
```

```typescript
// lib/workflow/nodes/chat/response-generation-node.ts
import { WorkflowState, PartialWorkflowState } from '@/workflow/state/workflow-state';
import { ProcessingPhase } from '@/lib/types/workflow';
import { ChatMessageType } from '@/lib/types/chat';
import logger from '@/lib/logger';

export async function responseGenerationNode(
  state: WorkflowState
): Promise<PartialWorkflowState> {
  const moduleLogger = logger.withMetadata({
    node: 'responseGenerationNode',
    threadId: state.threadId,
  });

  try {
    moduleLogger.info('Generating response');
    
    let responseMessage = '';
    const lastIntent = state.context?.lastIntent || 'general_chat';
    
    // Generate response based on current state and intent
    switch (lastIntent) {
      case 'document_extraction':
        if (state.extractedData) {
          responseMessage = `Document extracted successfully. Extracted ${state.extractedData.text.length} characters with ${Math.round(state.extractedData.confidence * 100)}% confidence.`;
        } else {
          responseMessage = 'Please upload a document to extract text.';
        }
        break;
      
      case 'verification':
        if (state.verification.status === 'completed') {
          responseMessage = 'The summary has been verified successfully.';
        } else if (state.verification.status === 'in_progress') {
          responseMessage = 'Please confirm if the summary is accurate or provide corrections.';
        } else {
          responseMessage = 'No summary available for verification.';
        }
        break;
      
      // Additional cases for other intents...
      
      default:
        responseMessage = 'How can I assist you with your medical documents today?';
        break;
    }
    
    // Add response to interaction history
    const interaction = {
      timestamp: new Date().toISOString(),
      message: responseMessage,
      userId: 'system',
      role: 'assistant',
      messageType: ChatMessageType.ASSISTANT,
      contextual: {
        step: 'response_generation',
        intent: lastIntent,
      },
    };
    
    const interactionHistory = state.interactionHistory || [];
    
    // Return updated state
    return {
      interactionHistory: [...interactionHistory, interaction],
      progress: {
        currentStep: 'response_generation',
        percentage: 100,
        phase: ProcessingPhase.COMPLETION,
        isCompleted: true,
      },
    };
  } catch (error) {
    // Error handling
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'RESPONSE_GENERATION_ERROR',
        step: 'response_generation',
        timestamp: new Date().toISOString(),
        recoverable: true,
      },
      progress: {
        currentStep: 'error',
        percentage: state.progress?.percentage || 0,
        phase: ProcessingPhase.ERROR,
        isCompleted: false,
      },
    };
  }
}
```

### Implementing the Supabase Checkpointer

We'll use Supabase to persist our workflow state:

```typescript
// lib/workflow/checkpointer/supabase-checkpointer.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { WorkflowState } from '@/lib/workflow/state/workflow-state';
import logger from '@/lib/logger';

export class SupabaseCheckpointer {
  private readonly client: SupabaseClient;
  private readonly tableName: string = 'workflow_states';
  private readonly logger = logger.withMetadata({ module: 'SupabaseCheckpointer' });

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = supabaseKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    this.client = createClient(url, key);
  }

  async get(threadId: string): Promise<WorkflowState | null> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('state')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        this.logger.error(`Error retrieving state for thread ${threadId}:`, {}, error);
        return null;
      }
      
      return data?.state as WorkflowState;
    } catch (error) {
      this.logger.error(`Failed to retrieve state for thread ${threadId}:`, {}, error);
      return null;
    }
  }

  async set(threadId: string, state: WorkflowState): Promise<boolean> {
    try {
      // Remove File object which isn't serializable
      const serializedState = { ...state };
      if (serializedState.file) {
        delete serializedState.file;
      }
      
      const { error } = await this.client
        .from(this.tableName)
        .insert({
          thread_id: threadId,
          state: serializedState,
          created_at: new Date().toISOString(),
        });
      
      if (error) {
        this.logger.error(`Error saving state for thread ${threadId}:`, {}, error);
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to save state for thread ${threadId}:`, {}, error);
      return false;
    }
  }

  // Additional methods like list(), delete() can be implemented
}
```

## 3. Integration with React

### Creating a Zustand Store for LangGraph Chat

Let's create a Zustand store to manage chat state and interact with our LangGraph supervisor:

```typescript
// lib/stores/langgraph-chat-store.tsx
"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createContext, type ReactNode } from "react";

import type { UUID } from "@/lib/types/base";
import {
  ChatMessageType,
  createUserMessage,
  createAssistantMessage,
  createSystemMessage,
  createErrorMessage,
  type ChatMessage,
} from "@/lib/types/chat";
import type { WorkflowState } from "@/lib/workflow/state/workflow-state";
import { ProcessingPhase } from "@/lib/types/workflow";
import logger from "@/lib/logger";

import { supervisorService, WorkflowType } from "@/lib/services/langgraph/supervisor-service";

export interface LangGraphChatStore {
  // UI states
  isLoading: boolean;
  error: string | null;
  threadId?: string;
  patientId?: string;
  
  // Current workflow state
  workflowState: WorkflowState | null;
  interactionHistory: ChatMessage[];
  
  // File handling
  currentFile?: File;
  fileUploadProgress: number;
  
  // Actions
  resetChat: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setThreadId: (threadId: string) => void;
  setPatientId: (patientId: string) => void;
  
  // Workflow actions
  initializeWorkflow: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  uploadDocument: (file: File) => Promise<void>;
  verifyDocument: (isApproved: boolean) => Promise<void>;
  correctDocument: (correction: string) => Promise<void>;
  generateReport: () => Promise<void>;
  
  // Sync state
  syncWorkflowState: (state: WorkflowState) => void;
}

export const useLangGraphChatStore = create<LangGraphChatStore>()(
  devtools((set, get) => {
    const storeLogger = logger.withMetadata({ module: 'LangGraphChatStore' });
    
    return {
      // Initial state
      isLoading: false,
      error: null,
      workflowState: null,
      interactionHistory: [],
      fileUploadProgress: 0,
      
      // Basic actions
      resetChat: () => {
        set({
          isLoading: false,
          error: null,
          workflowState: null,
          interactionHistory: [],
          currentFile: undefined,
          fileUploadProgress: 0,
          threadId: undefined,
        });
      },
      
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setThreadId: (threadId) => set({ threadId }),
      setPatientId: (patientId) => set({ patientId }),
      
      // Initialize workflow
      initializeWorkflow: async () => {
        try {
          const { threadId, patientId } = get();
          
          set({ isLoading: true, error: null });
          
          // Generate a new thread ID if none exists
          const newThreadId = threadId || crypto.randomUUID();
          
          // Create initial state
          const initialState: Partial<WorkflowState> = {
            threadId: newThreadId,
            patientId: patientId || '',
            userId: 'user',
            workflowStartedAt: new Date().toISOString(),
            workflowUpdatedAt: new Date().toISOString(),
            verification: {
              status: 'pending',
              corrections: [],
            },
            progress: {
              currentStep: 'idle',
              percentage: 0,
              phase: ProcessingPhase.INITIALIZATION,
              isCompleted: false,
            },
            interactionHistory: [],
          };
          
          // Run the workflow
          const updatedState = await supervisorService.runWorkflow(
            WorkflowType.PATIENT_SUMMARY,
            initialState
          );
          
          // Update local state
          set({
            threadId: newThreadId,
            workflowState: updatedState,
            interactionHistory: (updatedState.interactionHistory || []).map((interaction) => ({
              id: crypto.randomUUID(),
              role: interaction.role,
              content: interaction.message,
              createdAt: new Date(interaction.timestamp),
              type: interaction.messageType || ChatMessageType.CHAT,
            })),
            isLoading: false,
          });
          
          storeLogger.info('Workflow initialized', { threadId: newThreadId });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to initialize workflow',
          });
          
          storeLogger.error('Failed to initialize workflow', {}, error);
        }
      },
      
      // Send a message to the workflow
      sendMessage: async (content) => {
        try {
          const { threadId, workflowState } = get();
          
          if (!threadId || !workflowState) {
            throw new Error('Workflow not initialized');
          }
          
          set({ isLoading: true, error: null });
          
          // Add user message to interaction history
          const userMessage = createUserMessage(content);
          get().addMessage(userMessage);
          
          // Prepare state update
          const stateUpdate: Partial<WorkflowState> = {
            currentMessage: {
              content,
              userId: 'user',
            },
            threadId,
            workflowUpdatedAt: new Date().toISOString(),
          };
          
          // Run the workflow
          const updatedState = await supervisorService.runWorkflow(
            WorkflowType.PATIENT_SUMMARY,
            {
              ...workflowState,
              ...stateUpdate,
            },
            { startNodeId: 'messageProcessing' }
          );
          
          // Sync workflow state
          get().syncWorkflowState(updatedState);
          
          set({ isLoading: false });
          
          storeLogger.info('Message sent', { threadId, content });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to send message',
          });
          
          storeLogger.error('Failed to send message', {}, error);
        }
      },
      
      // Additional actions (uploadDocument, verifyDocument, etc.)
      // ...similar pattern to sendMessage
      
      // Sync workflow state with local state
      syncWorkflowState: (state) => {
        if (!state) return;
        
        set({
          workflowState: state,
          
          // Convert interaction history to chat messages
          interactionHistory: (state.interactionHistory || []).map((interaction) => ({
            id: crypto.randomUUID(),
            role: interaction.role,
            content: interaction.message,
            createdAt: new Date(interaction.timestamp),
            type: interaction.messageType || ChatMessageType.CHAT,
          })),
        });
      },
      
      // Add message helper
      addMessage: (message) => {
        set((state) => ({
          interactionHistory: [...state.interactionHistory, message],
        }));
      },
    };
  })
);

// Context provider
export const LangGraphChatContext = createContext<LangGraphChatStore | null>(null);

export function LangGraphChatProvider({ children }: { children: ReactNode }) {
  return (
    <LangGraphChatContext.Provider value={useLangGraphChatStore()}>
      {children}
    </LangGraphChatContext.Provider>
  );
}
```

### Creating the Chat Interface Component

Now, let's create a React component that uses our LangGraph chat store:

```tsx
// components/chat/langgraph/LangGraphChatInterface.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useLangGraphChatStore } from "@/lib/stores/langgraph-chat-store";
import { ChatMessageType } from "@/lib/types/chat";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Send, Upload, Check, X, FileText, Loader } from "lucide-react";

interface LangGraphChatInterfaceProps {
  patientId?: string;
}

export default function LangGraphChatInterface({
  patientId,
}: LangGraphChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    isLoading,
    error,
    interactionHistory,
    workflowState,
    fileUploadProgress,
    setPatientId,
    initializeWorkflow,
    sendMessage,
    uploadDocument,
    verifyDocument,
    correctDocument,
    generateReport,
    resetChat,
  } = useLangGraphChatStore();
  
  // Initialize workflow when component mounts
  useEffect(() => {
    if (patientId) {
      setPatientId(patientId);
    }
    initializeWorkflow();
  }, [patientId, setPatientId, initializeWorkflow]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [interactionHistory]);
  
  // Handle send message
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    await sendMessage(inputValue);
    setInputValue("");
  };
  
  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    await uploadDocument(file);
  };
  
  // Show verification options if needed
  const showVerificationOptions = 
    workflowState?.verification?.status === 'pending' || 
    workflowState?.verification?.status === 'in_progress';
  
  // Show report generation button if verification is completed
  const showReportButton = workflowState?.verification?.status === 'completed';
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-xl font-semibold">Patient Chat</h2>
        <Button variant="outline" size="sm" onClick={resetChat}>
          New Chat
        </Button>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {interactionHistory.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <Card
              className={`max-w-[80%] ${
                message.role === "user" ? "bg-primary text-primary-foreground" : ""
              }`}
            >
              <div className="p-3 whitespace-pre-wrap">{message.content}</div>
              {message.type === ChatMessageType.PROGRESS && (
                <Progress value={fileUploadProgress} className="mt-2" />
              )}
            </Card>
          </div>
        ))}
        
        {/* Error message */}
        {error && (
          <div className="flex justify-center">
            <Card className="bg-destructive text-destructive-foreground p-3">
              {error}
            </Card>
          </div>
        )}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-center">
            <Loader className="h-6 w-6 animate-spin" />
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Verification options */}
      {showVerificationOptions && (
        <div className="p-4 border-t">
          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => verifyDocument(false)}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              variant="default"
              onClick={() => verifyDocument(true)}
              className="flex-1"
            >
              <Check className="h-4 w-4 mr-2" />
              Confirm
            </Button>
          </div>
        </div>
      )}
      
      {/* Report generation button */}
      {showReportButton && (
        <div className="p-4 border-t">
          <Button
            variant="default"
            onClick={generateReport}
            className="w-full"
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      )}
      
      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type a message..."
            disabled={isLoading}
            className="flex-1"
          />
          
          {/* File upload button */}
          <label htmlFor="file-upload" className="cursor-pointer">
            <Button variant="outline" size="icon" type="button" disabled={isLoading}>
              <Upload className="h-4 w-4" />
            </Button>
            <input
              id="file-upload"
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isLoading}
            />
          </label>
          
          {/* Send button */}
          <Button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            onClick={handleSendMessage}
          >
            <Send className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### Creating a Chat Page Component

Finally, let's create a page that uses our LangGraph chat interface:

```tsx
// app/dashboard/chat/page.tsx
"use client";

import { useParams } from "next/navigation";
import { LangGraphChatProvider } from "@/lib/stores/langgraph-chat-store";
import LangGraphChatInterface from "@/components/chat/langgraph/LangGraphChatInterface";

export default function ChatPage() {
  const params = useParams();
  const patientId = params?.patientId as string;
  
  return (
    <div className="h-full flex flex-col">
      <div className="h-16 border-b flex items-center px-4">
        <h1 className="text-2xl font-bold">Neuvia Chat</h1>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <LangGraphChatProvider>
          <LangGraphChatInterface patientId={patientId} />
        </LangGraphChatProvider>
      </div>
    </div>
  );
}
```

## 4. Error Handling and Debugging

### Implementing Robust Error Handling

Each node should implement proper error handling:

```typescript
try {
  // Node logic here
} catch (error) {
  logger.error('Operation failed', { nodeName: 'nodeX' }, error);
  
  return {
    error: {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'ERROR_CODE',
      step: 'current_step',
      timestamp: new Date().toISOString(),
      recoverable: true, // or false
      details: { /* additional context */ },
    },
    progress: {
      currentStep: 'error',
      percentage: state.progress?.percentage || 0,
      phase: ProcessingPhase.ERROR,
      isCompleted: false,
    },
  };
}
```

### Creating a Debug Mode Component

For easier debugging, we can create a component to visualize workflow state:

```tsx
// components/chat/langgraph/LangGraphDebugger.tsx
"use client";

import { useState } from "react";
import { useLangGraphChatStore } from "@/lib/stores/langgraph-chat-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";

export function LangGraphDebugger() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { workflowState } = useLangGraphChatStore();
  
  if (!workflowState) return null;
  
  return (
    <div className="fixed bottom-0 right-0 m-4 bg-background border rounded-lg shadow-lg z-50">
      <div className="p-2 flex justify-between items-center">
        <h3 className="font-semibold">Workflow Debug</h3>
        <button onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? '↓' : '↑'}
        </button>
      </div>
      
      {isExpanded && (
        <div className="p-4" style={{ maxHeight: '500px', overflow: 'auto' }}>
          <Tabs defaultValue="state">
            <TabsList>
              <TabsTrigger value="state">State</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="state">
              <Card className="p-2">
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(workflowState, null, 2)}
                </pre>
              </Card>
            </TabsContent>
            
            <TabsContent value="history">
              <Card className="p-2">
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(workflowState.interactionHistory, null, 2)}
                </pre>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
```

## 5. Best Practices and Optimization

### Optimizing Workflow Performance

1. **Parallel Processing**: For independent tasks, use parallel execution:

```typescript
// Example of parallel processing in a node
async function parallelProcessingNode(state: WorkflowState): Promise<PartialWorkflowState> {
  const [extractionResult, analysisResult] = await Promise.all([
    extractData(state.file),
    analyzeExistingData(state.patientId)
  ]);
  
  return {
    extractedData: extractionResult,
    analysisResult,
    // other state updates
  };
}
```

2. **Selective Checkpointing**: Only checkpoint at critical points to reduce database writes.

3. **Optimistic UI Updates**: Update the UI immediately while processing happens in the background.

### Maintaining Code Structure

1. **Folder Organization**:
   ```
   lib/
     workflow/
       nodes/           # All sub-agent nodes
       graphs/          # Workflow graph definitions
       state/           # State type definitions
       checkpointer/    # Persistence mechanisms
     services/
       langgraph/       # LangGraph supervisor service
     stores/            # Zustand stores for UI state
   components/
     chat/
       langgraph/       # React components for LangGraph chat
   ```

2. **Code Consistency**: Follow TypeScript best practices, use consistent error handling and logging, and document edge cases.

## 6. Migration Plan

1. **Create New Services**: Implement the LangGraph supervisor service and related components.
2. **Add New Routes**: Create new routes that use the LangGraph chat interface.
3. **Remove Legacy Code**: Once the new system is tested, remove the old chat service.
4. **Update Documentation**: Document the new architecture for the team.

## Conclusion

This implementation leverages the existing workflow nodes and state model in Neuvia to create a unified LangGraph-based architecture with a supervisor and specialized sub-agents. The new system provides:

1. **Better Maintainability**: Each sub-agent handles a specific task, making the code more modular and easier to maintain.
2. **Real-time State Management**: The workflow state is managed centrally and synchronized with the UI for real-time updates.
3. **Improved Error Handling**: Errors are captured and handled consistently across the system.
4. **Extensibility**: New sub-agents can be added easily to extend the system's capabilities.

With this architecture, Neuvia now has a modern, maintainable, and reactive chat interface that leverages the power of LangGraph for complex workflow orchestration.