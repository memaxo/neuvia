/**
 * @fileoverview Canonical chat and message types for the application
 * 
 * This file serves as the single source of truth for chat and message related types.
 * It defines the core message structure, metadata, and state management interfaces
 * used throughout the chat system.
 */

import type { UUID, Timestamp } from './base';
import type { 
  WorkflowStep,
  ProcessingPhase,
  VerificationMetadata,
  VerificationItem
} from './workflow';

// ==========================================================================
// Chat Message Types
// ==========================================================================

/**
 * Chat message types for message categorization and handling
 */
export enum ChatMessageType {
  /** Regular chat message from user or assistant */
  CHAT = 'chat',

  /** System notification message */
  SYSTEM = 'system',

  /** Error message */
  ERROR = 'error',

  /** Verification request message */
  VERIFICATION = 'verification',

  /** Summary message containing extracted data */
  SUMMARY = 'summary',

  /** Progress update message */
  PROGRESS = 'progress',

  /** Research result message */
  RESEARCH = 'research',

  /** Report message */
  REPORT = 'report',

  /** Correction message */
  CORRECTION = 'correction'
}

/**
 * Basic message interface
 */
export interface Message {
  /** Unique message identifier */
  id: string;
  
  /** Message role (user, assistant, system) */
  role: 'user' | 'assistant' | 'system';
  
  /** Message content */
  content: string;
  
  /** When the message was created */
  createdAt: Timestamp;
}

/**
 * Metadata for chat messages with comprehensive typing
 * 
 * @example
 * ```ts
 * // Regular chat message metadata
 * const metadata: ChatMessageMetadata = {
 *   type: ChatMessageType.CHAT
 * };
 * 
 * // Verification message metadata
 * const verificationMetadata: ChatMessageMetadata = {
 *   type: ChatMessageType.VERIFICATION,
 *   verificationMetadata: {
 *     verificationStatus: VerificationStatusType.PENDING,
 *     originalSummaryId: '123',
 *     currentVersionId: '456',
 *     correctionCount: 0,
 *     corrections: []
 *   }
 * };
 * ```
 */
export interface ChatMessageMetadata {
  /** Message type for specialized handling */
  type: ChatMessageType;
  
  /** Associated document ID if relevant */
  documentId?: UUID;
  
  /** Associated patient ID if relevant */
  patientId?: UUID;
  
  /** IDs of source documents referenced in message */
  sourceDocuments?: UUID[];
  
  /** Verification metadata for verification messages */
  verificationMetadata?: VerificationMetadata;
  
  /** Progress indicator for long-running operations */
  progress?: {
    /** Numeric progress value (0-100) */
    value: number;
    
    /** Current processing phase */
    phase: ProcessingPhase;
    
    /** When operation started */
    startedAt?: Timestamp;
    
    /** Estimated completion time */
    estimatedCompletionAt?: Timestamp;
  };
  
  /** Verification items for verification messages */
  verificationItems?: VerificationItem[];
  
  /** Additional metadata properties */
  [key: string]: unknown;
}

/**
 * Full chat message interface with metadata
 */
export interface ChatMessage extends Message {
  /** Message type to differentiate handling */
  type: ChatMessageType;
  
  /** Additional metadata for the message */
  metadata?: ChatMessageMetadata;
}

/**
 * Serialized chat message for API operations
 */
export interface SerializedChatMessage {
  /** Unique message identifier */
  id: string;
  
  /** Message role (user, assistant, system) */
  role: 'user' | 'assistant' | 'system';
  
  /** Message content */
  content: string;
  
  /** When the message was created (ISO string) */
  createdAt: string;
  
  /** Message type */
  type: ChatMessageType;
  
  /** Additional metadata (serialized) */
  metadata?: Record<string, unknown>;
}

// ==========================================================================
// Chat State Types
// ==========================================================================

/**
 * Verification state within a chat session
 */
export interface VerificationState {
  /** Whether verification is active */
  isActive: boolean;
  
  /** Current verification status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  
  /** Items being verified */
  items: VerificationItem[];
  
  /** Verification metadata */
  metadata: VerificationMetadata;
}

/**
 * Workflow state within a chat session
 */
export interface WorkflowState {
  /** Current workflow step */
  currentStep: WorkflowStep;
  
  /** Progress indicator (0-100) */
  progress: number;
  
  /** Current processing phase */
  phase?: ProcessingPhase;
  
  /** Error message if any */
  error?: string | null;
  
  /** Whether workflow is active */
  isActive: boolean;
  
  /** Verification state if applicable */
  verification?: VerificationState;
  
  /** Additional workflow metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Chat session state for managing ongoing conversations
 */
export interface ChatSessionState {
  /** Unique chat session identifier */
  id: UUID;
  
  /** Messages in this session */
  messages: ChatMessage[];
  
  /** Current workflow state */
  workflow: WorkflowState;
  
  /** When the session was created */
  createdAt: Timestamp;
  
  /** When the session was last updated */
  updatedAt: Timestamp;
  
  /** User ID associated with this session */
  userId?: UUID;
  
  /** Organization ID associated with this session */
  organizationId?: UUID;
  
  /** Whether the session is loading/processing a request */
  isLoading: boolean;
  
  /** Additional session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Chat state management actions
 */
export type ChatAction =
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'UPDATE_WORKFLOW'; workflow: Partial<WorkflowState> }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'UPDATE_VERIFICATION'; verification: Partial<VerificationState> }
  | { type: 'RESET_STATE' };

/**
 * Chat state for global state management
 */
export interface ChatState {
  /** All chat sessions */
  sessions: Record<UUID, ChatSessionState>;
  
  /** Currently active session ID */
  activeSessionId?: UUID;
  
  /** Global loading state */
  isLoading: boolean;
  
  /** Global error state */
  error?: string;
}

// ==========================================================================
// Chat Context Types
// ==========================================================================

/**
 * Chat context methods for React context
 */
export interface ChatContextMethods {
  /** Add a message to the current chat */
  addMessage: (message: ChatMessage) => void;
  
  /** Clear all messages from the current chat */
  clearMessages: () => void;
  
  /** Update the workflow state */
  updateWorkflow: (workflow: Partial<WorkflowState>) => void;
  
  /** Set the loading state */
  setLoading: (isLoading: boolean) => void;
  
  /** Update verification state */
  updateVerification: (verification: Partial<VerificationState>) => void;
  
  /** Reset the chat state */
  resetState: () => void;
}

/**
 * Chat context value for React context
 */
export interface ChatContextValue {
  /** Current chat state */
  state: ChatState;
  
  /** Chat manipulation methods */
  actions: ChatContextMethods;
}

// ==========================================================================
// Utility Functions
// ==========================================================================

/**
 * Type guard to check if a message is a chat message
 */
export function isChatMessage(message: unknown): message is ChatMessage {
  if (!message || typeof message !== 'object') return false;
  
  const msg = message as Record<string, unknown>;
  return (
    typeof msg.id === 'string' &&
    typeof msg.content === 'string' &&
    (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') &&
    (typeof msg.createdAt === 'string' || msg.createdAt instanceof Date)
  );
}

/**
 * Type guard for verifying a specific message type
 */
export function isMessageOfType<T extends ChatMessageType>(
  message: ChatMessage,
  type: T
): message is ChatMessage & { type: T } {
  return message.type === type;
}

/**
 * Check if a message has verification metadata
 */
export function hasVerificationMetadata(
  message: ChatMessage
): message is ChatMessage & { metadata: { verificationMetadata: VerificationMetadata } } {
  return Boolean(
    message.metadata && 
    message.type === ChatMessageType.VERIFICATION && 
    message.metadata.verificationMetadata
  );
}

/**
 * Create a user message
 */
export function createUserMessage(
  content: string,
  metadata?: Partial<ChatMessageMetadata>
): ChatMessage {
  return {
    id: `user-${Date.now()}`,
    role: 'user',
    content,
    type: ChatMessageType.CHAT,
    createdAt: new Date().toISOString(),
    ...(metadata ? { metadata: { ...metadata, type: ChatMessageType.CHAT } } : {})
  };
}

/**
 * Create an assistant message
 */
export function createAssistantMessage(
  content: string,
  metadata?: Partial<ChatMessageMetadata>
): ChatMessage {
  return {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content,
    type: ChatMessageType.CHAT,
    createdAt: new Date().toISOString(),
    ...(metadata ? { metadata: { ...metadata, type: ChatMessageType.CHAT } } : {})
  };
}

/**
 * Create a system message
 */
export function createSystemMessage(
  content: string,
  metadata?: Partial<ChatMessageMetadata>
): ChatMessage {
  return {
    id: `system-${Date.now()}`,
    role: 'system',
    content,
    type: ChatMessageType.SYSTEM,
    createdAt: new Date().toISOString(),
    ...(metadata ? { metadata: { ...metadata, type: ChatMessageType.SYSTEM } } : {})
  };
}

/**
 * Create a verification message
 */
export function createVerificationMessage(
  content: string,
  verificationMetadata: VerificationMetadata,
  items?: VerificationItem[]
): ChatMessage {
  return {
    id: `verification-${Date.now()}`,
    role: 'assistant',
    content,
    type: ChatMessageType.VERIFICATION,
    createdAt: new Date().toISOString(),
    metadata: {
      type: ChatMessageType.VERIFICATION,
      verificationMetadata,
      ...(items ? { verificationItems: items } : {})
    }
  };
}

/**
 * Create an error message
 */
export function createErrorMessage(
  content: string,
  error?: Error | string
): ChatMessage {
  return {
    id: `error-${Date.now()}`,
    role: 'system',
    content,
    type: ChatMessageType.ERROR,
    createdAt: new Date().toISOString(),
    metadata: {
      type: ChatMessageType.ERROR,
      error: error instanceof Error ? error.message : error
    }
  };
}

/**
 * Create a progress message
 */
export function createProgressMessage(
  content: string,
  progress: number,
  phase: ProcessingPhase
): ChatMessage {
  return {
    id: `progress-${Date.now()}`,
    role: 'system',
    content,
    type: ChatMessageType.PROGRESS,
    createdAt: new Date().toISOString(),
    metadata: {
      type: ChatMessageType.PROGRESS,
      progress: {
        value: progress,
        phase,
        startedAt: new Date().toISOString()
      }
    }
  };
}

/**
 * Factory function to create a type guard for specific message types
 */
export function createMessageTypeGuard<T extends ChatMessageType>(type: T) {
  return (message: ChatMessage): message is ChatMessage & { type: T } => {
    return message.type === type;
  };
}

// Predefined type guards using the factory
export const isVerificationMessage = createMessageTypeGuard(ChatMessageType.VERIFICATION);
export const isSummaryMessage = createMessageTypeGuard(ChatMessageType.SUMMARY);
export const isProgressMessage = createMessageTypeGuard(ChatMessageType.PROGRESS);
export const isResearchMessage = createMessageTypeGuard(ChatMessageType.RESEARCH);
export const isReportMessage = createMessageTypeGuard(ChatMessageType.REPORT);
export const isErrorMessage = createMessageTypeGuard(ChatMessageType.ERROR);
export const isCorrectionMessage = createMessageTypeGuard(ChatMessageType.CORRECTION);