/**
 * @fileoverview Chat Intent Parser
 * 
 * RESPONSIBILITY:
 * This module is ONLY responsible for intent classification and mapping to workflow actions.
 * It should NOT handle chat UI concerns, message creation, or progress updates.
 * 
 * Parses chat messages to determine user intent with confidence scores.
 * Maps those intents to workflow actions that can be dispatched to the workflow engine.
 * 
 * Chat-specific logic like creating/updating messages, storing corrections,
 * or handling progress notifications should be handled by the ChatService.
 * 
 * PHASE 2 IMPLEMENTATION:
 * This file was moved from workflow/coordination to the chat service directory
 * as intent parsing is a chat domain concern, not a workflow concern.
 */

import logger from '@/lib/logger';
import type { WorkflowAction } from '@/lib/services/workflow/coordination/workflow-definition';

/** Chat intent types */
export enum ChatIntentType {
  // Verification-related intents
  VERIFY_CONFIRM = 'verify_confirm',
  VERIFY_CORRECT = 'verify_correct',
  VERIFY_REJECT = 'verify_reject',
  
  // Report-related intents
  GENERATE_REPORT = 'generate_report',
  VIEW_REPORT = 'view_report',
  
  // Research-related intents
  RESEARCH_REQUEST = 'research_request',
  
  // General chat intents
  REGULAR_MESSAGE = 'regular_message',
  HELP_REQUEST = 'help_request',
  CANCEL_OPERATION = 'cancel_operation'
}

/** Correction data extracted from chat message */
export interface ChatCorrection {
  /** The field to correct */
  field: string;
  /** The new value */
  value: string;
}

/** Parsed chat intent result */
export interface ParsedChatIntent {
  /** The detected intent type */
  intentType: ChatIntentType;
  /** The original message */
  originalMessage: string;
  /** Confidence level (0.0-1.0) */
  confidence: number;
  /** Extracted data */
  data?: {
    /** Research query if applicable */
    query?: string;
    /** Extracted corrections if applicable */
    corrections?: ChatCorrection[];
    /** Target field/entities */
    targetEntity?: string;
    /** Additional context */
    context?: Record<string, unknown>;
  };
}

/**
 * Workflow action mapping options for intent-to-action conversion
 */
export interface ActionMappingOptions {
  /** Chat ID */
  chatId: string;
  /** User ID */
  userId: string;
  /** Patient ID if applicable */
  patientId?: string;
  /** Document ID if applicable */
  documentId?: string;
  /** Verification ID if applicable */
  verificationId?: string;
  /** Report ID if applicable */
  reportId?: string;
  /** Transaction ID for tracking */
  transactionId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Chat intent parser for extracting structured intent from natural language
 * and mapping it to workflow actions.
 * 
 * IMPORTANT: This class has a SINGLE RESPONSIBILITY - to classify intents and map them 
 * to workflow actions. It should NOT:
 * - Create or modify chat messages directly (this belongs in ChatService)
 * - Handle progress notifications or UI updates (use ChatService)
 * - Process business logic related to the intents (use domain services)
 * 
 * The workflow coordinator should use this parser to determine what actions to take,
 * then delegate business logic and UI concerns to the appropriate services.
 */
export class ChatIntentParser {
  private readonly logger = logger.withMetadata({ module: 'ChatIntentParser' });
  
  /**
   * Parse a message to determine user intent with confidence score
   * 
   * This method ONLY classifies the intent - it does not take any action
   * based on that intent or update any UI. It returns a data structure
   * containing the classification result.
   * 
   * @param message The message text to classify
   * @param currentStep Optional current workflow step for context-aware classification
   * @returns A ParsedChatIntent containing the classification result and confidence
   */
  parseIntent(message: string, currentStep?: string): ParsedChatIntent {
    const lowerMessage = message.toLowerCase().trim();
    
    // Verification confirmation
    if (this.isVerificationConfirmation(lowerMessage)) {
      return {
        intentType: ChatIntentType.VERIFY_CONFIRM,
        originalMessage: message,
        confidence: 0.9
      };
    }
    
    // Verification correction
    if (this.isVerificationCorrection(message)) {
      return {
        intentType: ChatIntentType.VERIFY_CORRECT,
        originalMessage: message,
        confidence: 0.8,
        data: {
          corrections: this.extractCorrections(message)
        }
      };
    }
    
    // Verification rejection
    if (this.isVerificationRejection(lowerMessage)) {
      return {
        intentType: ChatIntentType.VERIFY_REJECT,
        originalMessage: message,
        confidence: 0.9
      };
    }
    
    // Research request
    if (this.isResearchRequest(message)) {
      return {
        intentType: ChatIntentType.RESEARCH_REQUEST,
        originalMessage: message,
        confidence: 0.7,
        data: {
          query: this.extractResearchQuery(message)
        }
      };
    }
    
    // Report generation request
    if (this.isReportGenerationRequest(message)) {
      return {
        intentType: ChatIntentType.GENERATE_REPORT,
        originalMessage: message,
        confidence: 0.7
      };
    }
    
    // Help request
    if (this.isHelpRequest(lowerMessage)) {
      return {
        intentType: ChatIntentType.HELP_REQUEST,
        originalMessage: message,
        confidence: 0.8
      };
    }
    
    // Cancel operation
    if (this.isCancelRequest(lowerMessage)) {
      return {
        intentType: ChatIntentType.CANCEL_OPERATION,
        originalMessage: message,
        confidence: 0.9
      };
    }
    
    // Default - regular message
    return {
      intentType: ChatIntentType.REGULAR_MESSAGE,
      originalMessage: message,
      confidence: 0.5
    };
  }
  
  /**
   * Map parsed intent to workflow action
   * 
   * This method transforms a classified intent into a workflow action that
   * can be dispatched to the workflow engine. It does NOT execute any business
   * logic or update the UI directly.
   * 
   * Business logic and UI updates should be handled by the appropriate services
   * when the action is processed by the workflow engine.
   * 
   * @param intent The classified intent from parseIntent
   * @param options Additional context data needed for the action
   * @returns A WorkflowAction that can be dispatched to the workflow engine
   */
  mapIntentToAction(
    intent: ParsedChatIntent,
    options: ActionMappingOptions
  ): WorkflowAction {
    // Different action mappings based on intent type
    switch (intent.intentType) {
      case ChatIntentType.VERIFY_CONFIRM:
        return {
          type: 'VERIFY_CONFIRM',
          payload: {
            message: intent.originalMessage,
            chatId: options.chatId,
            verificationId: options.verificationId,
            metadata: {
              intentType: intent.intentType,
              confidence: intent.confidence,
              ...options.metadata
            }
          },
          meta: {
            userId: options.userId,
            transactionId: options.transactionId
          }
        };
        
      case ChatIntentType.VERIFY_CORRECT:
        return {
          type: 'VERIFY_CORRECT',
          payload: {
            message: intent.originalMessage,
            chatId: options.chatId,
            verificationId: options.verificationId,
            corrections: intent.data?.corrections?.reduce((obj, item) => {
              obj[item.field] = item.value;
              return obj;
            }, {} as Record<string, string>) || {},
            metadata: {
              intentType: intent.intentType,
              confidence: intent.confidence,
              ...options.metadata
            }
          },
          meta: {
            userId: options.userId,
            transactionId: options.transactionId
          }
        };
        
      case ChatIntentType.VERIFY_REJECT:
        return {
          type: 'VERIFY_REJECT',
          payload: {
            message: intent.originalMessage,
            chatId: options.chatId,
            verificationId: options.verificationId,
            reason: intent.originalMessage,
            metadata: {
              intentType: intent.intentType,
              confidence: intent.confidence,
              ...options.metadata
            }
          },
          meta: {
            userId: options.userId,
            transactionId: options.transactionId
          }
        };
        
      case ChatIntentType.RESEARCH_REQUEST:
        return {
          type: 'START_RESEARCH',
          payload: {
            message: intent.originalMessage,
            chatId: options.chatId,
            query: intent.data?.query || intent.originalMessage,
            patientId: options.patientId,
            metadata: {
              intentType: intent.intentType,
              confidence: intent.confidence,
              ...options.metadata
            }
          },
          meta: {
            userId: options.userId,
            transactionId: options.transactionId
          }
        };
        
      case ChatIntentType.GENERATE_REPORT:
        return {
          type: 'GENERATE_REPORT',
          payload: {
            message: intent.originalMessage,
            chatId: options.chatId,
            documentId: options.documentId,
            patientId: options.patientId,
            metadata: {
              intentType: intent.intentType,
              confidence: intent.confidence,
              ...options.metadata
            }
          },
          meta: {
            userId: options.userId,
            transactionId: options.transactionId
          }
        };
        
      case ChatIntentType.VIEW_REPORT:
        return {
          type: 'VIEW_REPORT',
          payload: {
            message: intent.originalMessage,
            chatId: options.chatId,
            reportId: options.reportId,
            metadata: {
              intentType: intent.intentType,
              confidence: intent.confidence,
              ...options.metadata
            }
          },
          meta: {
            userId: options.userId,
            transactionId: options.transactionId
          }
        };
        
      case ChatIntentType.HELP_REQUEST:
        return {
          type: 'HELP_REQUEST',
          payload: {
            message: intent.originalMessage,
            chatId: options.chatId,
            metadata: {
              intentType: intent.intentType,
              confidence: intent.confidence,
              ...options.metadata
            }
          },
          meta: {
            userId: options.userId,
            transactionId: options.transactionId
          }
        };
        
      case ChatIntentType.CANCEL_OPERATION:
        return {
          type: 'CANCEL_OPERATION',
          payload: {
            message: intent.originalMessage,
            chatId: options.chatId,
            metadata: {
              intentType: intent.intentType,
              confidence: intent.confidence,
              ...options.metadata
            }
          },
          meta: {
            userId: options.userId,
            transactionId: options.transactionId
          }
        };
        
      case ChatIntentType.REGULAR_MESSAGE:
      default:
        return {
          type: 'PROCESS_MESSAGE',
          payload: {
            message: intent.originalMessage,
            chatId: options.chatId,
            patientId: options.patientId,
            documentId: options.documentId,
            metadata: {
              intentType: intent.intentType,
              confidence: intent.confidence,
              ...options.metadata
            }
          },
          meta: {
            userId: options.userId,
            transactionId: options.transactionId
          }
        };
    }
  }
  
  /**
   * Process a message and directly map it to a workflow action
   * 
   * This is a convenience method that combines parsing and action mapping.
   * It returns both the classified intent and the corresponding workflow action.
   * This method does NOT execute any business logic or update any UI elements.
   * 
   * @param message The message to process
   * @param options Context options for action creation
   * @param currentStep Optional current workflow step
   * @returns Object containing both the intent classification and workflow action
   */
  processMessage(
    message: string,
    options: ActionMappingOptions,
    currentStep?: string
  ): {
    intent: ParsedChatIntent;
    action: WorkflowAction;
  } {
    const intent = this.parseIntent(message, currentStep);
    const action = this.mapIntentToAction(intent, options);
    
    // Log minimally, with no direct chat updates
    this.logger.debug('Intent classified', { 
      intentType: intent.intentType, 
      confidence: intent.confidence 
    });
    
    return { intent, action };
  }
  
  /**
   * Check if message is a verification confirmation
   */
  private isVerificationConfirmation(message: string): boolean {
    return /^(confirm|verify|approve|accept|looks good|correct|yes)$/i.test(message) ||
           /^(the (data|information) (is|looks) correct)$/i.test(message);
  }
  
  /**
   * Check if message is a verification rejection
   */
  private isVerificationRejection(message: string): boolean {
    return /^(reject|decline|no|wrong|incorrect)$/i.test(message) ||
           /^(the (data|information) (is|looks) (incorrect|wrong))$/i.test(message);
  }
  
  /**
   * Check if message contains a correction
   */
  private isVerificationCorrection(message: string): boolean {
    return /\b(correct|update|change|fix|modify)\b.*\b(field|value|data|information|record)\b/i.test(message) ||
           /\b(should be|needs to be|incorrect|wrong|error)\b/i.test(message) ||
           /\b(\w+)\s+(?:should be|needs to be|must be|is actually|is)\s+/i.test(message) ||
           /\b(?:change|update|correct|fix)\s+(\w+)\s+(?:to|as)\s+/i.test(message);
  }
  
  /**
   * Check if message is a research request
   */
  private isResearchRequest(message: string): boolean {
    return /\b(research|search|look up|find|information about|tell me about|what is|how does)\b/i.test(message);
  }
  
  /**
   * Check if message is a report generation request
   */
  private isReportGenerationRequest(message: string): boolean {
    return /\b(generate|create|produce|make|prepare)\s+(a\s+)?(report|summary)\b/i.test(message);
  }
  
  /**
   * Check if message is a help request
   */
  private isHelpRequest(message: string): boolean {
    return /^(help|assist|guide|support|how do i|what can you do|what can i do)$/i.test(message) ||
           /\b(help me|assist me|guide me)\b/i.test(message) ||
           /\b(how (do|can) i|what (can|should) i do)\b/i.test(message);
  }
  
  /**
   * Check if message is a cancel request
   */
  private isCancelRequest(message: string): boolean {
    return /^(cancel|stop|abort|halt|end|terminate|quit|exit)$/i.test(message) ||
           /\b(cancel|stop|abort|halt) (this|the|current) (process|operation|workflow|verification)\b/i.test(message);
  }
  
  /**
   * Extract research query from message
   */
  private extractResearchQuery(message: string): string {
    // Strip research-related prefixes
    return message.replace(
      /^(research|search|look up|find|information about|tell me about|what is|how does)\s+/i,
      ''
    ).trim();
  }
  
  /**
   * Extract correction data from message
   */
  private extractCorrections(message: string): ChatCorrection[] {
    const corrections: ChatCorrection[] = [];
    
    // Look for patterns like "field should be value" or "change field to value"
    const patterns = [
      /\b(\w+)\s+(?:should be|needs to be|must be|is actually|is)\s+(?:"([^"]+)"|'([^']+)'|([^\s,;.]+))/gi,
      /\b(?:change|update|correct|fix)\s+(\w+)\s+(?:to|as)\s+(?:"([^"]+)"|'([^']+)'|([^\s,;.]+))/gi
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        const field = match[1].toLowerCase();
        const value = match[2] || match[3] || match[4];
        if (field && value) {
          corrections.push({ field, value });
        }
      }
    }
    
    return corrections;
  }
}

// Export singleton instance
export const chatIntentParser = new ChatIntentParser();