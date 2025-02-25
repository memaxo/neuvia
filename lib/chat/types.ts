import type { Message as AIMessage } from 'ai';

export type ChatMode = 'regular' | 'verification';

// Research and report related types
export interface ResearchSource {
  title: string;
  url: string;
  description: string;
  content?: string;
  relevance: number;
  citationIndex?: number;
}

export interface ResearchResult {
  query: string;
  sources: ResearchSource[];
  summary: string;
  timestamp: Date;
}

export interface ReportData {
  content: string;
  sources: ResearchSource[];
  patientId: string;
  generatedAt: Date;
  metadata: {
    modelName: string;
    confidence: number;
    generationTime: number;
  };
  sections?: {
    findings?: string;
    diagnoses?: string;
    recommendations?: string;
    references?: string;
  };
}

export interface VerificationStatus {
  isVerified: boolean;
  verifiedAt: Date;
  corrections?: Record<string, string>;
}

// Enhanced metadata that extends what's in the current Message type
export interface MessageMetadata {
  type?: 'verification' | 'research' | 'report' | 'follow_up';
  confidence?: number;
  verificationStatus?: VerificationStatus;
  researchSources?: ResearchSource[];
  reportData?: ReportData;
  sources?: ResearchSource[];
}

// Original Message interface with expanded metadata
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  metadata?: MessageMetadata;
}

// The integrated message type that combines AI SDK Message and our custom Message
export interface IntegratedMessage extends Omit<AIMessage, 'id' | 'role' | 'content'> {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  metadata?: MessageMetadata;
}

export interface ChatState {
  mode: ChatMode;
  messages: Message[];
  isLoading: boolean;
  error?: string;
}

// Extended chat state with workflow support
export interface ExtendedChatState extends ChatState {
  workflowStep: WorkflowStep;
  researchResults?: ResearchResult[];
  reportData?: ReportData;
  reportFormat?: 'markdown' | 'html' | 'pdf';
  researchProgress?: {
    phase: 'research' | 'generation' | 'formatting';
    percent: number;
  };
}

export interface ChatContextType {
  state: ChatState;
  sendMessage: (content: string) => Promise<void>;
  setMode: (mode: ChatMode) => void;
  verifyData: (messageId: string, status: VerificationStatus) => void;
  clearChat: () => void;
}

// Extended context type with research methods
export interface ExtendedChatContextType extends ChatContextType {
  state: ExtendedChatState;
  processDocument: (file: File) => Promise<void>;
  performDeepResearch: (query: string, options?: {
    depth?: 'basic' | 'standard' | 'comprehensive';
    patientId?: string;
    sourcesLimit?: number;
  }) => Promise<ResearchResult | null>;
  generateReport: (options?: {
    includeSourceContent?: boolean;
    format?: 'markdown' | 'html' | 'pdf';
    depth?: 'basic' | 'standard' | 'comprehensive';
    onProgress?: (phase: 'research' | 'generation' | 'formatting', percent: number) => void;
  }) => Promise<ReportData | null>;
  formatReport: (format: 'markdown' | 'html' | 'pdf') => Promise<string | null>;
  setWorkflowStep: (step: WorkflowStep) => void;
}

export interface ChatProps {
  patientId: string;
  initialMode?: ChatMode;
  isReadOnly?: boolean;
}

// Workflow step type
export type WorkflowStep = 
  | "idle" 
  | "uploading" 
  | "extracting" 
  | "verification" 
  | "report_confirmation"
  | "report_generation" 
  | "report_formatting"
  | "report_presentation"
  | "follow_up"
  | "complete";

// Conversion utilities

/**
 * Convert from an AI SDK Message to our custom Message type
 */
export function fromAIMessage(message: AIMessage): Message {
  return {
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system',
    content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
    createdAt: new Date(),
    // Any additional metadata conversion would happen here
  };
}

/**
 * Convert from our custom Message type to an AI SDK Message
 */
export function toAIMessage(message: Message): AIMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    // The AI SDK might have additional properties that we're not setting here
  };
}

/**
 * Converts an array of AI SDK Messages to our custom Message type
 */
export function fromAIMessages(messages: AIMessage[]): Message[] {
  return messages.map(fromAIMessage);
}

/**
 * Converts an array of our custom Messages to AI SDK Message type
 */
export function toAIMessages(messages: Message[]): AIMessage[] {
  return messages.map(toAIMessage);
}

// Type guards

/**
 * Check if a message has research metadata
 */
export function hasResearchMetadata(message: Message): boolean {
  return !!message.metadata?.researchSources;
}

/**
 * Check if a message has report metadata
 */
export function hasReportMetadata(message: Message): boolean {
  return !!message.metadata?.reportData;
}

/**
 * Check if a message has verification metadata
 */
export function hasVerificationMetadata(message: Message): boolean {
  return !!message.metadata?.verificationStatus;
} 