/**
 * @fileoverview Chat Intent Parser
 * 
 * Parses chat messages to determine user intent for workflow coordination.
 * This helps domain modules focus on single-step logic while the coordinator
 * handles cross-domain transitions.
 */

import logger from '@/lib/logger';

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
 * Chat intent parser for extracting structured intent from natural language
 */
export class ChatIntentParser {
  private readonly logger = logger.withMetadata({ module: 'ChatIntentParser' });
  
  /**
   * Parse a message to determine user intent
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