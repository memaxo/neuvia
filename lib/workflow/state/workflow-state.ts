import type { UUID } from '@/lib/types/base';
import type { DocumentChunk, DocumentSource } from '@/lib/types/rag';
import type { StateDefinition } from '@langchain/langgraph';
import type { Database } from '@/lib/types/database';

// Define a type alias for the workflow_states row from the database
type DBWorkflowState = Database["public"]["Tables"]["workflow_states"]["Row"];

/**
 * Progress tracking for LangGraph workflows
 */
export interface WorkflowProgress {
  // Current step in the workflow
  currentStep: string;
  
  // Progress percentage (0-100)
  percentage: number;
  
  // Phase of processing (e.g., 'extraction', 'analysis')
  phase: string;
  
  // Indicates if the workflow is completed
  isCompleted: boolean;
}

/**
 * Error information for LangGraph workflows
 */
export interface WorkflowError {
  // Error message
  message: string;
  
  // Timestamp of when the error occurred
  timestamp: string;
  
  // Domain where the error occurred (e.g., 'document', 'patient')
  domain: string;
  
  // Step where the error occurred
  step: string;
  
  // If the error is recoverable
  recoverable: boolean;
  
  // Any additional context for the error
  context?: Record<string, unknown>;
}

/**
 * Individual message within the conversation history
 */
export interface WorkflowInteraction {
  // Unique identifier for the interaction
  id: string;
  
  // Timestamp of the interaction
  timestamp: string;
  
  // The actual message content
  message: string;
  
  // The user who sent the message
  userId?: string;
  
  // Role of the sender (user, assistant, system)
  role: 'user' | 'assistant' | 'system' | 'function';
  
  // Message type (e.g., 'chat', 'progress', 'error')
  messageType?: string;
  
  // Sources used in the response
  sources?: DocumentSource[];
  
  // Contextual information for this message
  contextual?: {
    // Step of the workflow when this message was sent
    step?: string;
    
    // Intent of the message
    intent?: string;
    
    // Entities identified in the message
    entities?: Record<string, unknown>[];
  };
}

/**
 * Current message being processed
 */
export interface CurrentMessage {
  // Message content
  content: string;
  
  // Message role (usually 'user')
  role: 'user' | 'assistant' | 'system' | 'function';
  
  // When the message was created
  createdAt: string;
}

/**
 * Current action being performed
 */
export interface CurrentAction {
  // Action type
  type: string;
  
  // Action parameters
  parameters?: Record<string, unknown>;
  
  // When the action was created
  createdAt: string;
}

/**
 * RAG context for the workflow
 */
export interface WorkflowRagContext {
  // Retrieved chunks from documents
  retrievedChunks: DocumentChunk[];
  
  // Sources of information
  sources: DocumentSource[];
  
  // Query that led to this context
  query?: string;
  
  // When the context was updated
  updatedAt?: string;
}

/**
 * Extracted data from documents
 */
export interface ExtractedData {
  // Raw text extracted from the document
  text: string;
  
  // Structured data parsed from the document
  structuredData: Record<string, unknown>;
  
  // When the data was extracted
  extractedAt: string;
}

/**
 * Patient verification status
 */
export interface VerificationData {
  // Current status of verification
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  
  // Items being verified
  items?: Array<{
    field: string;
    value: string;
    verified: boolean;
    correction?: string;
  }>;
  
  // List of corrections
  corrections?: Array<{
    original: string;
    corrected: string;
    timestamp: string;
    userId: string;
  }>;
  
  // Who verified the data
  verifiedBy?: string;
  
  // When verification was completed
  verifiedAt?: string;
}

/**
 * Report generation data
 */
export interface ReportData {
  // Report identifier
  reportId: string;
  
  // Type of report
  reportType: string;
  
  // Report content
  content: Record<string, unknown>;
  
  // When the report was generated
  generatedAt: string;
  
  // Who generated the report
  generatedBy: string;
}

/**
 * Document processing status
 */
export interface DocumentProcessingStatus {
  // Current status (e.g., 'pending', 'processing', 'completed', 'failed')
  status: string;
  
  // Progress percentage
  progress: number;
  
  // Processing phase
  phase: string;
  
  // When status was updated
  updatedAt: string;
}

/**
 * Research results
 */
export interface ResearchData {
  // Query that led to this research
  query: string;
  
  // Research result
  result: Record<string, unknown>;
  
  // When research was completed
  completedAt: string;
}

/**
 * Complete state of a LangGraph workflow
 * Designed to be consistent with the workflow_states database table structure.
 * Also provides an optional 'db' property holding the original workflow_states database record.
 */
export interface WorkflowState extends StateDefinition {
  // Core identifiers (camelCase versions for internal usage)
  threadId: string;
  patientId?: string;
  userId?: string;
  
  // Document information
  documentId?: string;
  documentType?: {
    category: string;
    type: string;
  };
  documentContent?: string;
  
  // Workflow timing
  workflowStartedAt?: string;
  workflowUpdatedAt?: string;
  
  // Current state
  currentMessage?: CurrentMessage;
  currentAction?: string;
  
  // Interaction history
  interactionHistory?: WorkflowInteraction[];
  
  // Progress tracking
  progress?: WorkflowProgress;
  
  // RAG context
  ragContext?: WorkflowRagContext;
  
  // Extracted data
  extractedData?: ExtractedData;
  
  // Verification data
  verification?: VerificationData;
  
  // Newly added properties for LangGraph compatibility
  needsCorrection?: boolean;
  readyForReport?: boolean;
  
  // Report data
  report?: ReportData;
  
  // Research data
  researchResults?: ResearchData;
  
  // Document processing status
  documentProcessingStatus?: DocumentProcessingStatus;
  
  // Error information
  error?: WorkflowError;
  
  // Additional context data
  context?: Record<string, unknown>;
  
  // Optional property holding the original workflow_states DB record
  db?: DBWorkflowState;
  
  // Add index signature for StateDefinition compatibility
  [key: string]: any;
}

/**
 * Creates an initial workflow state with minimal required fields
 */
export function createInitialWorkflowState(
  patientId: string,
  userId: string,
  threadId: string
): WorkflowState {
  const timestamp = new Date().toISOString();
  
  return {
    threadId,
    patientId,
    userId,
    workflowStartedAt: timestamp,
    workflowUpdatedAt: timestamp,
    interactionHistory: [],
    progress: {
      currentStep: 'initial',
      percentage: 0,
      phase: 'initialization',
      isCompleted: false,
    },
    context: {},
    // Note: Other properties can be added/initialized as needed
  };
}

/**
 * Updates workflow state by merging updates into existing state
 */
export function updateWorkflowState(
  currentState: WorkflowState,
  updates: Partial<WorkflowState>
): WorkflowState {
  return {
    ...currentState,
    ...updates,
    workflowUpdatedAt: new Date().toISOString(),
    // Deep merge of nested objects
    progress: updates.progress
      ? { ...currentState.progress, ...updates.progress }
      : currentState.progress,
    context: updates.context
      ? { ...currentState.context, ...updates.context }
      : currentState.context,
    verification: updates.verification
      ? { ...currentState.verification, ...updates.verification }
      : currentState.verification,
    extractedData: updates.extractedData
      ? { ...currentState.extractedData, ...updates.extractedData }
      : currentState.extractedData,
    ragContext: updates.ragContext
      ? { ...currentState.ragContext, ...updates.ragContext }
      : currentState.ragContext,
  };
}