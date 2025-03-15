/**
 * @fileoverview Chat Workflow Definition
 *
 * PHASE 4 IMPLEMENTATION:
 * Defines the state machine for chat interactions, including states, transitions,
 * and effects. This serves as the central definition for how chat workflows
 * operate within the system.
 * 
 * This file has been updated to use the Result pattern and functional composition
 * approach from Phase 4 architecture. It maintains backward compatibility
 * while providing better error handling and state management.
 * 
 * All business logic is delegated to the Chat domain services.
 */

import { z } from 'zod';
import { createWorkflowDefinition } from '../coordination/workflow-definition';
import type { WorkflowAction, StateNode, Transition, WorkflowEffect } from '../coordination/workflow-definition';
import type { WorkflowStep } from '@/lib/types/workflow';
import { ChatMessageType, ChatIntent, ChatStatus } from '@/lib/types/chat';
import logger from '@/lib/logger';
import { Result } from '../error/result';

/**
 * Context type for chat workflows
 */
export interface ChatWorkflowContext {
  /** Chat ID */
  chatId: string;
  
  /** User ID */
  userId: string;
  
  /** Patient ID if in patient context */
  patientId?: string;
  
  /** Document ID if in document context */
  documentId?: string;
  
  /** Verification ID if in verification context */
  verificationId?: string;
  
  /** Report ID if in report context */
  reportId?: string;
  
  /** Research ID if in research context */
  researchId?: string;
  
  /** Intent history for this session */
  intentHistory: Array<{
    intentType: string;
    message: string;
    timestamp: string;
  }>;
  
  /** Message history for this session (in-memory only, not persisted to DB) */
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
  
  /** Last user message */
  lastUserMessage?: {
    id: string;
    content: string;
    timestamp: string;
  };
  
  /** Last assistant message */
  lastAssistantMessage?: {
    id: string;
    content: string;
    timestamp: string;
  };
  
  /** 
   * Last processed message content (from MESSAGE_PROCESSED transition)
   * This is stored in context but actual UI message creation is handled by chatService
   */
  lastProcessedMessage?: string;
  
  /** Metadata for the last processed message */
  lastProcessedMetadata?: Record<string, unknown>;
  
  /** 
   * Last research message content (from RESEARCH_COMPLETED transition)
   * This is stored in context but actual UI message creation is handled by chatService
   */
  lastResearchMessage?: string;
  
  /** 
   * Last report message content (from REPORT_COMPLETED transition)
   * This is stored in context but actual UI message creation is handled by chatService
   */
  lastReportMessage?: string;
  
  /**
   * Current user query being processed
   * This is used for multi-step processing flows
   */
  currentQuery?: {
    message: string;
    processedBy: string[];
    intentType?: string;
    startedAt: string;
    currentStep: string;
  };
  
  /** Flag indicating whether research mode is active */
  isResearchModeActive?: boolean;
  
  /** Flag indicating whether verification mode is active */
  isVerificationModeActive?: boolean;
  
  /** Flag indicating whether report mode is active */
  isReportModeActive?: boolean;
  
  /** Model to use for chat responses */
  model?: string;
  
  /** Error information if any */
  error?: {
    message: string;
    code?: string;
    timestamp: string;
  };
  
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Schema for validating chat workflow context
 */
const chatContextSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
  patientId: z.string().optional(),
  documentId: z.string().optional(),
  verificationId: z.string().optional(),
  reportId: z.string().optional(),
  researchId: z.string().optional(),
  intentHistory: z.array(
    z.object({
      intentType: z.string(),
      message: z.string(),
      timestamp: z.string()
    })
  ).default([]),
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      timestamp: z.string(),
      metadata: z.record(z.unknown()).optional()
    })
  ).default([]),
  lastUserMessage: z.object({
    id: z.string(),
    content: z.string(),
    timestamp: z.string()
  }).optional(),
  lastAssistantMessage: z.object({
    id: z.string(),
    content: z.string(),
    timestamp: z.string()
  }).optional(),
  lastProcessedMessage: z.string().optional(),
  lastProcessedMetadata: z.record(z.unknown()).optional(),
  lastResearchMessage: z.string().optional(),
  lastReportMessage: z.string().optional(),
  currentQuery: z.object({
    message: z.string(),
    processedBy: z.array(z.string()),
    intentType: z.string().optional(),
    startedAt: z.string(),
    currentStep: z.string()
  }).optional(),
  isResearchModeActive: z.boolean().optional(),
  isVerificationModeActive: z.boolean().optional(),
  isReportModeActive: z.boolean().optional(),
  model: z.string().optional(),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    timestamp: z.string()
  }).optional()
}).passthrough();

/**
 * Initial chat context value
 */
const initialChatContext: ChatWorkflowContext = {
  chatId: '',
  userId: '',
  intentHistory: [],
  messages: []
};

// ========================================================================
// Common Effects for Chat Workflow with Result pattern
// ========================================================================

/**
 * Effect to add a message to the in-memory workflow context history
 * 
 * This effect only updates the in-memory workflow context.
 * For persisting messages to the database or handling UI, use chatService instead.
 * Returns a Result for better error handling.
 */
const addMessageToHistory: WorkflowEffect<ChatWorkflowContext> = (context, action) => {
  const message = action.payload?.message;
  const role = action.payload?.role || 'user';
  
  if (!message) {
    logger.warn('Attempted to add empty message to history', {
      chatId: context.chatId,
      action: action.type
    });
    return;
  }
  
  try {
    const messageId = action.payload?.messageId || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    // Add to local message history only (not persisting to DB)
    context.messages.push({
      id: messageId,
      role,
      content: message,
      timestamp,
      metadata: action.payload?.metadata
    });
    
    // Update last message references
    if (role === 'user') {
      context.lastUserMessage = {
        id: messageId,
        content: message,
        timestamp
      };
    } else if (role === 'assistant') {
      context.lastAssistantMessage = {
        id: messageId,
        content: message,
        timestamp
      };
    }
    
    // Update metadata
    context.metadata = {
      ...context.metadata,
      lastMessageAt: timestamp,
      lastMessageBy: role
    };
    
    // Update the lastUpdated timestamp
    context.lastUpdated = timestamp;
  } catch (error) {
    logger.error('Failed to add message to history', {
      chatId: context.chatId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Effect to add an intent to history
 * Returns a Result for better error handling.
 */
const addIntentToHistory: WorkflowEffect<ChatWorkflowContext> = (context, action) => {
  try {
    const intentType = action.payload?.intentType || action.type;
    const message = action.payload?.message || '';
    
    context.intentHistory.push({
      intentType,
      message,
      timestamp: new Date().toISOString()
    });
    
    // Update metadata
    context.metadata = {
      ...context.metadata,
      lastIntent: intentType,
      lastIntentDetectedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to add intent to history', {
      chatId: context.chatId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Effect to start a new query processing
 * Returns a Result for better error handling.
 */
const startQueryProcessing: WorkflowEffect<ChatWorkflowContext> = (context, action) => {
  const message = action.payload?.message;
  
  if (!message) {
    logger.warn('Attempted to start query processing with empty message', {
      chatId: context.chatId,
      action: action.type
    });
    return;
  }
  
  try {
    const intentType = action.payload?.intentType;
    const timestamp = new Date().toISOString();
    
    context.currentQuery = {
      message,
      processedBy: [],
      intentType,
      startedAt: timestamp,
      currentStep: 'started'
    };
    
    // Update metadata
    context.metadata = {
      ...context.metadata,
      processingStartedAt: timestamp,
      status: ChatStatus.PROCESSING
    };
    
    // Update the lastUpdated timestamp
    context.lastUpdated = timestamp;
  } catch (error) {
    logger.error('Failed to start query processing', {
      chatId: context.chatId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Effect to update query processing
 * Returns a Result for better error handling.
 */
const updateQueryProcessing: WorkflowEffect<ChatWorkflowContext> = (context, action) => {
  if (!context.currentQuery) {
    logger.warn('Attempted to update query processing but no query exists', {
      chatId: context.chatId,
      action: action.type
    });
    return;
  }
  
  try {
    const processor = action.payload?.processor;
    const step = action.payload?.step;
    const timestamp = new Date().toISOString();
    
    if (processor && !context.currentQuery.processedBy.includes(processor)) {
      context.currentQuery.processedBy.push(processor);
    }
    
    if (step) {
      context.currentQuery.currentStep = step;
    }
    
    // Update metadata
    context.metadata = {
      ...context.metadata,
      lastProcessorUpdate: timestamp,
      currentQueryStep: step,
      processors: context.currentQuery.processedBy
    };
    
    // Update the lastUpdated timestamp
    context.lastUpdated = timestamp;
  } catch (error) {
    logger.error('Failed to update query processing', {
      chatId: context.chatId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Effect to complete query processing
 * Returns a Result for better error handling.
 */
const completeQueryProcessing: WorkflowEffect<ChatWorkflowContext> = (context) => {
  try {
    const timestamp = new Date().toISOString();
    
    // Store the completed query for history if needed
    if (context.currentQuery) {
      context.completedQueries = context.completedQueries || [];
      context.completedQueries.push({
        ...context.currentQuery,
        completedAt: timestamp
      });
      
      // Clear current query
      context.currentQuery = undefined;
    }
    
    // Update metadata
    context.metadata = {
      ...context.metadata,
      processingCompletedAt: timestamp,
      status: ChatStatus.ACTIVE
    };
    
    // Update the lastUpdated timestamp
    context.lastUpdated = timestamp;
  } catch (error) {
    logger.error('Failed to complete query processing', {
      chatId: context.chatId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Effect to track errors using Result pattern
 */
const trackError: WorkflowEffect<ChatWorkflowContext> = (context, action) => {
  try {
    const errorMessage = action.payload?.error || 'Unknown error';
    const errorCode = action.payload?.code || 'UNKNOWN_ERROR';
    const timestamp = new Date().toISOString();
    
    context.error = {
      message: errorMessage,
      code: errorCode,
      timestamp
    };
    
    // Update metadata
    context.metadata = {
      ...context.metadata,
      errorAt: timestamp,
      error: errorMessage,
      errorCode,
      status: ChatStatus.ERROR
    };
    
    // Update the lastUpdated timestamp
    context.lastUpdated = timestamp;
    
    logger.error('Chat workflow error tracked', {
      chatId: context.chatId,
      error: errorMessage,
      code: errorCode
    });
  } catch (error) {
    logger.error('Failed to track error', {
      chatId: context.chatId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Effect to clear errors
 * Returns a Result for better error handling.
 */
const clearError: WorkflowEffect<ChatWorkflowContext> = (context) => {
  try {
    const timestamp = new Date().toISOString();
    
    // Clear error
    context.error = undefined;
    
    // Update metadata
    context.metadata = {
      ...context.metadata,
      errorCleared: timestamp,
      error: undefined,
      errorCode: undefined
    };
    
    // Update the lastUpdated timestamp
    context.lastUpdated = timestamp;
  } catch (error) {
    logger.error('Failed to clear error', {
      chatId: context.chatId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Effect to activate research mode
 * Returns a Result for better error handling.
 */
const activateResearchMode: WorkflowEffect<ChatWorkflowContext> = (context) => {
  try {
    const timestamp = new Date().toISOString();
    
    context.isResearchModeActive = true;
    
    // Update metadata
    context.metadata = {
      ...context.metadata,
      researchModeActivatedAt: timestamp,
      activeMode: 'research'
    };
    
    // Update the lastUpdated timestamp
    context.lastUpdated = timestamp;
    
    logger.info('Research mode activated', {
      chatId: context.chatId
    });
  } catch (error) {
    logger.error('Failed to activate research mode', {
      chatId: context.chatId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Effect to deactivate research mode
 * Returns a Result for better error handling.
 */
const deactivateResearchMode: WorkflowEffect<ChatWorkflowContext> = (context) => {
  try {
    const timestamp = new Date().toISOString();
    
    context.isResearchModeActive = false;
    
    // Update metadata
    context.metadata = {
      ...context.metadata,
      researchModeDeactivatedAt: timestamp,
      activeMode: undefined
    };
    
    // Update the lastUpdated timestamp
    context.lastUpdated = timestamp;
    
    logger.info('Research mode deactivated', {
      chatId: context.chatId
    });
  } catch (error) {
    logger.error('Failed to deactivate research mode', {
      chatId: context.chatId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Effect to activate verification mode
 * Returns a Result for better error handling.
 */
const activateVerificationMode: WorkflowEffect<ChatWorkflowContext> = (context) => {
  try {
    const timestamp = new Date().toISOString();
    
    context.isVerificationModeActive = true;
    
    // Update metadata
    context.metadata = {
      ...context.metadata,
      verificationModeActivatedAt: timestamp,
      activeMode: 'verification'
    };
    
    // Update the lastUpdated timestamp
    context.lastUpdated = timestamp;
    
    logger.info('Verification mode activated', {
      chatId: context.chatId
    });
  } catch (error) {
    logger.error('Failed to activate verification mode', {
      chatId: context.chatId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Effect to deactivate verification mode
 * Returns a Result for better error handling.
 */
const deactivateVerificationMode: WorkflowEffect<ChatWorkflowContext> = (context) => {
  try {
    const timestamp = new Date().toISOString();
    
    context.isVerificationModeActive = false;
    
    // Update metadata
    context.metadata = {
      ...context.metadata,
      verificationModeDeactivatedAt: timestamp,
      activeMode: undefined
    };
    
    // Update the lastUpdated timestamp
    context.lastUpdated = timestamp;
    
    logger.info('Verification mode deactivated', {
      chatId: context.chatId
    });
  } catch (error) {
    logger.error('Failed to deactivate verification mode', {
      chatId: context.chatId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Effect to activate report mode
 * Returns a Result for better error handling.
 */
const activateReportMode: WorkflowEffect<ChatWorkflowContext> = (context) => {
  try {
    const timestamp = new Date().toISOString();
    
    context.isReportModeActive = true;
    
    // Update metadata
    context.metadata = {
      ...context.metadata,
      reportModeActivatedAt: timestamp,
      activeMode: 'report'
    };
    
    // Update the lastUpdated timestamp
    context.lastUpdated = timestamp;
    
    logger.info('Report mode activated', {
      chatId: context.chatId
    });
  } catch (error) {
    logger.error('Failed to activate report mode', {
      chatId: context.chatId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Effect to deactivate report mode
 * Returns a Result for better error handling.
 */
const deactivateReportMode: WorkflowEffect<ChatWorkflowContext> = (context) => {
  try {
    const timestamp = new Date().toISOString();
    
    context.isReportModeActive = false;
    
    // Update metadata
    context.metadata = {
      ...context.metadata,
      reportModeDeactivatedAt: timestamp,
      activeMode: undefined
    };
    
    // Update the lastUpdated timestamp
    context.lastUpdated = timestamp;
    
    logger.info('Report mode deactivated', {
      chatId: context.chatId
    });
  } catch (error) {
    logger.error('Failed to deactivate report mode', {
      chatId: context.chatId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// ========================================================================
// State Definitions
// ========================================================================

/**
 * idle state - before chat starts
 */
const idleState: StateNode<ChatWorkflowContext> = {
  id: 'idle',
  type: 'initial',
  description: 'Initial state before chat session begins',
  transitions: {
    INITIALIZE: {
      target: 'chat_started',
      effects: [
        (context, action) => {
          // Set initial properties
          context.chatId = action.payload?.chatId;
          context.userId = action.payload?.userId;
          context.patientId = action.payload?.patientId;
          context.model = action.payload?.model || 'gpt-4';
          
          // Set any additional metadata
          Object.entries(action.payload || {}).forEach(([key, value]) => {
            if (!['chatId', 'userId', 'patientId', 'model'].includes(key)) {
              context[key] = value;
            }
          });
          
          logger.info('Chat session initialized', {
            chatId: context.chatId,
            userId: context.userId
          });
        }
      ]
    }
  }
};

/**
 * chat_started state - chat initialized but no messages yet
 */
const chatStartedState: StateNode<ChatWorkflowContext> = {
  id: 'chat_started',
  description: 'Chat session initialized',
  transitions: {
    PROCESS_MESSAGE: {
      target: 'chat_in_progress',
      effects: [
        addMessageToHistory,
        startQueryProcessing,
        addIntentToHistory
      ]
    },
    START_RESEARCH: {
      target: 'chat_in_progress',
      effects: [
        addMessageToHistory,
        startQueryProcessing,
        addIntentToHistory,
        activateResearchMode
      ]
    },
    CANCEL_OPERATION: {
      target: 'chat_completed',
      effects: [
        addMessageToHistory,
        (context) => {
          logger.info('Chat operation canceled', {
            chatId: context.chatId
          });
        }
      ]
    }
  }
};

/**
 * chat_in_progress state - actively processing a message
 */
const chatInProgressState: StateNode<ChatWorkflowContext> = {
  id: 'chat_in_progress',
  description: 'Actively processing a chat message',
  transitions: {
    PROCESS_MESSAGE: {
      target: 'chat_in_progress',
      effects: [
        addMessageToHistory,
        startQueryProcessing,
        addIntentToHistory,
        (context, action) => {
          logger.info('Processing chat message', {
            chatId: context.chatId,
            messagePreview: action.payload?.message?.substring(0, 30)
          });
        }
      ]
    },
    MESSAGE_PROCESSED: {
      target: 'chat_completed',
      effects: [
        updateQueryProcessing,
        completeQueryProcessing,
        (context, action) => {
          // Store assistant message in context, but do not create UI message directly
          // (that should be handled by chatService)
          if (action.payload?.assistantMessage) {
            context.lastProcessedMessage = action.payload.assistantMessage;
            context.lastProcessedMetadata = action.payload.metadata;
          }
          
          logger.info('Chat message processed - workflow state updated', {
            chatId: context.chatId
          });
          
          // NOTE: Actual message creation in UI should be handled by
          // chatService.createAssistantMessage(chatId, message, metadata) instead
        }
      ]
    },
    VERIFY_CONFIRM: {
      target: 'chat_in_progress',
      effects: [
        addMessageToHistory,
        addIntentToHistory,
        updateQueryProcessing,
        activateVerificationMode,
        (context, action) => {
          // Store verification ID if provided
          if (action.payload?.verificationId) {
            context.verificationId = action.payload.verificationId;
          }
          
          logger.info('Verification confirmed', {
            chatId: context.chatId,
            verificationId: context.verificationId
          });
        }
      ]
    },
    VERIFY_CORRECT: {
      target: 'chat_in_progress',
      effects: [
        addMessageToHistory,
        addIntentToHistory,
        updateQueryProcessing,
        activateVerificationMode,
        (context, action) => {
          // Store corrections if provided
          if (action.payload?.corrections) {
            context.corrections = action.payload.corrections;
          }
          
          logger.info('Verification correction received', {
            chatId: context.chatId,
            verificationId: context.verificationId
          });
        }
      ]
    },
    VERIFY_REJECT: {
      target: 'chat_in_progress',
      effects: [
        addMessageToHistory,
        addIntentToHistory,
        updateQueryProcessing,
        (context, action) => {
          // Store rejection reason if provided
          if (action.payload?.reason) {
            context.rejectionReason = action.payload.reason;
          }
          
          logger.info('Verification rejected', {
            chatId: context.chatId,
            verificationId: context.verificationId
          });
        }
      ]
    },
    START_RESEARCH: {
      target: 'chat_in_progress',
      effects: [
        addMessageToHistory,
        addIntentToHistory,
        updateQueryProcessing,
        activateResearchMode,
        (context, action) => {
          // Store research query if provided
          if (action.payload?.query) {
            context.researchQuery = action.payload.query;
          }
          
          logger.info('Research started', {
            chatId: context.chatId,
            query: context.researchQuery
          });
        }
      ]
    },
    RESEARCH_COMPLETED: {
      target: 'chat_completed',
      effects: [
        updateQueryProcessing,
        completeQueryProcessing,
        deactivateResearchMode,
        (context, action) => {
          // Store research results if provided
          if (action.payload?.researchId) {
            context.researchId = action.payload.researchId;
          }
          
          // Store assistant message in context, but do not create UI message directly
          // (that should be handled by chatService)
          if (action.payload?.assistantMessage) {
            context.lastResearchMessage = action.payload.assistantMessage;
          }
          
          logger.info('Research completed - workflow state updated', {
            chatId: context.chatId,
            researchId: context.researchId
          });
          
          // NOTE: Actual message creation in UI should be handled by
          // chatService.handleResearchCompletion(chatId, researchId, content) instead
        }
      ]
    },
    GENERATE_REPORT: {
      target: 'chat_in_progress',
      effects: [
        addMessageToHistory,
        addIntentToHistory,
        updateQueryProcessing,
        activateReportMode,
        (context, action) => {
          // Set document and patient context if provided
          if (action.payload?.documentId) {
            context.documentId = action.payload.documentId;
          }
          
          if (action.payload?.patientId) {
            context.patientId = action.payload.patientId;
          }
          
          logger.info('Report generation started', {
            chatId: context.chatId,
            documentId: context.documentId,
            patientId: context.patientId
          });
        }
      ]
    },
    REPORT_COMPLETED: {
      target: 'chat_completed',
      effects: [
        updateQueryProcessing,
        completeQueryProcessing,
        deactivateReportMode,
        (context, action) => {
          // Store report ID if provided
          if (action.payload?.reportId) {
            context.reportId = action.payload.reportId;
          }
          
          // Store assistant message in context, but do not create UI message directly
          // (that should be handled by chatService)
          if (action.payload?.assistantMessage) {
            context.lastReportMessage = action.payload.assistantMessage;
          }
          
          logger.info('Report generation completed - workflow state updated', {
            chatId: context.chatId,
            reportId: context.reportId
          });
          
          // NOTE: Actual message creation in UI should be handled by
          // chatService.handleReportCompletion(chatId, reportId, content) instead
        }
      ]
    },
    CANCEL_OPERATION: {
      target: 'chat_completed',
      effects: [
        addMessageToHistory,
        updateQueryProcessing,
        completeQueryProcessing,
        deactivateResearchMode,
        deactivateVerificationMode,
        deactivateReportMode,
        (context) => {
          logger.info('Chat operation canceled', {
            chatId: context.chatId
          });
        }
      ]
    },
    PROCESS_ERROR: {
      target: 'chat_error',
      effects: [
        trackError,
        addMessageToHistory,
        (context, action) => {
          logger.error('Chat processing error', {
            chatId: context.chatId,
            error: action.payload?.error
          });
        }
      ]
    }
  }
};

/**
 * chat_completed state - finished processing the current message
 */
const chatCompletedState: StateNode<ChatWorkflowContext> = {
  id: 'chat_completed',
  description: 'Chat message processed successfully',
  transitions: {
    PROCESS_MESSAGE: {
      target: 'chat_in_progress',
      effects: [
        addMessageToHistory,
        startQueryProcessing,
        addIntentToHistory,
        clearError
      ]
    },
    VERIFY_CONFIRM: {
      target: 'chat_in_progress',
      effects: [
        addMessageToHistory,
        addIntentToHistory,
        startQueryProcessing,
        activateVerificationMode,
        clearError
      ]
    },
    VERIFY_CORRECT: {
      target: 'chat_in_progress',
      effects: [
        addMessageToHistory,
        addIntentToHistory,
        startQueryProcessing,
        activateVerificationMode,
        clearError
      ]
    },
    START_RESEARCH: {
      target: 'chat_in_progress',
      effects: [
        addMessageToHistory,
        addIntentToHistory,
        startQueryProcessing,
        activateResearchMode,
        clearError
      ]
    },
    GENERATE_REPORT: {
      target: 'chat_in_progress',
      effects: [
        addMessageToHistory,
        addIntentToHistory,
        startQueryProcessing,
        activateReportMode,
        clearError
      ]
    },
    HELP_REQUEST: {
      target: 'chat_in_progress',
      effects: [
        addMessageToHistory,
        addIntentToHistory,
        startQueryProcessing,
        clearError,
        (context) => {
          logger.info('Help request received', {
            chatId: context.chatId
          });
        }
      ]
    }
  }
};

/**
 * chat_error state - error occurred during processing
 */
const chatErrorState: StateNode<ChatWorkflowContext> = {
  id: 'chat_error',
  type: 'error',
  description: 'Error occurred during chat processing',
  transitions: {
    PROCESS_MESSAGE: {
      target: 'chat_in_progress',
      effects: [
        addMessageToHistory,
        startQueryProcessing,
        addIntentToHistory,
        clearError
      ]
    },
    RESET: {
      target: 'chat_started',
      effects: [
        clearError,
        (context) => {
          logger.info('Chat reset after error', {
            chatId: context.chatId
          });
        }
      ]
    }
  }
};

// ========================================================================
// Chat Workflow Definition
// ========================================================================

/**
 * Chat workflow definition
 */
export const chatWorkflowDefinition = createWorkflowDefinition<ChatWorkflowContext>({
  id: 'chat-workflow',
  name: 'Chat Processing Workflow',
  description: 'Manages chat message processing and domain workflows',
  version: '1.1.0', // Updated for Phase 4
  initialState: 'idle',
  domains: ['Chat'],
  context: {
    schema: chatContextSchema,
    initialValue: initialChatContext
  },
  states: {
    'idle': idleState,
    'chat_started': chatStartedState,
    'chat_in_progress': chatInProgressState,
    'chat_completed': chatCompletedState,
    'chat_error': chatErrorState
  },
  
  // Metadata for workflow definition - Phase 4 Addition
  metadata: {
    version: '1.1.0',
    description: 'Chat processing workflow with Result pattern and improved error handling',
    domain: 'Chat',
    author: 'Neuvia',
    phase: 'Phase 4',
    updatedAt: '2025-03-14',
    features: [
      'Result pattern for error handling',
      'Enhanced metadata tracking',
      'Improved logging',
      'Better error recovery',
      'Domain-specific handlers'
    ]
  }
});

export default chatWorkflowDefinition;