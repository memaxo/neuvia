import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import {
  type WorkflowTransition,
  type WorkflowStep,
  DomainOnlyWorkflowStep,
  type ProcessingPhase
} from '@/lib/types/workflow'
import { ApplicationError, normalizeError } from '@/lib/errors'
import { WorkflowErrorContextBuilder } from '../error-context'
import { workflowRepository } from '../infrastructure/workflow-repository'
import { workflowStateManager } from '../infrastructure/workflow-state-manager'
import { workflowEventSourcing } from '../infrastructure/workflow-event-source'
import { workflowTransactionManager } from '../workflow-transaction-manager'
import { workflowCoordinator } from '../coordination/workflow-coordinator'
import { 
  recoveryService, 
  RecoveryStrategy, 
  type RecoveryOptions 
} from '../recovery/recovery-service'
import type { WorkflowErrorMetadata } from '@/lib/workflow/workflow-error-handler'
import { Result } from '../error/result'

// Import domain-specific workflow processors
import { documentWorkflow } from '../domain/document-workflow'
import { verificationWorkflow } from '../domain/verification-workflow'
import { reportWorkflow } from '../domain/report-workflow'
import { researchWorkflow } from '../domain/research-workflow'
import { chatWorkflow } from '../domain/chat-workflow'

// Import domain-specific types
import type { 
  DocumentProcessingResult, 
  DocumentUploadOptions,
  DocumentExtractionOptions
} from '../domain/document-workflow'
import type { 
  VerificationResult,
  VerificationOptions,
  CorrectionData
} from '../domain/verification-workflow'
import type { 
  ReportGenerationResult,
  ReportGenerationOptions,
  ReportFormatOptions
} from '../domain/report-workflow'
import type { 
  ResearchResult,
  ResearchOptions
} from '../domain/research-workflow'
import type { 
  ChatSessionResult,
  MessageProcessingOptions
} from '../domain/chat-workflow'
import type {
  EndToEndResult,
  DocumentToReportOptions
} from '../domain/workflow-orchestrator'

import logger from '@/lib/logger'

/**
 * WORKFLOW CONFLICT RESOLUTION STRATEGY
 * 
 * This service implements a simplified conflict resolution approach with two strategies:
 * 
 * 1. Pessimistic (default): Prevents conflicts by checking if the record has been modified
 *    since it was last read. Uses timestamp-based detection without requiring extra DB columns.
 *    Steps:
 *    - Read current state including updated_at timestamp
 *    - Before update, fetch the latest updated_at timestamp
 *    - If timestamps don't match, reject the update with a conflict error
 *    - If timestamps match, proceed with update
 * 
 * 2. Optimistic: Applies changes without checking for conflicts, assuming they will rarely happen.
 *    - Suitable for non-critical updates or when UI handles conflict resolution
 *    - Simply updates the record without checking timestamps
 *    - May silently overwrite concurrent changes
 * 
 * Usage:
 * ```
 * // Default pessimistic approach
 * await workflowService.updateWorkflowState(id, step, metadata);
 * 
 * // Explicit pessimistic approach
 * await workflowService.updateWorkflowState(id, step, metadata, { conflictStrategy: 'pessimistic' });
 * 
 * // Optimistic approach
 * await workflowService.updateWorkflowState(id, step, metadata, { conflictStrategy: 'optimistic' });
 * ```
 */

/**
 * Minimal error handler to avoid circular dependencies
 */
class LocalWorkflowErrorHandler {
  async handleError(
    error: unknown,
    step: WorkflowStep,
    options?: { details?: Record<string, unknown>; showToast?: boolean }
  ): Promise<void> {
    // Using a more generic logging approach instead of console.error
    // This can be replaced with a proper logger implementation
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorDetails = { step, errorMsg, ...(options?.details || {}) };
    
    // Log in a way that doesn't trigger the no-console rule
    // In a real implementation, this would use a logger service
    this.logError('Workflow error:', errorDetails);
  }

  private logError(message: string, details: Record<string, unknown>): void {
    // This is a placeholder for a proper logging implementation
    // In production, this would use a logger service instead of console
    // eslint-disable-next-line no-console
    console.error(message, details);
  }
}

/**
 * Transaction status type for workflow state updates
 */
export type TransactionStatus =
  | 'pending'
  | 'committed'
  | 'failed'
  | 'conflict'
  | 'not_found'

/**
 * Simplified conflict resolution strategy for handling concurrent updates
 */
export type ConflictStrategy = 'optimistic' | 'pessimistic'

/**
 * Transaction record for tracking updates
 */
export interface TransactionRecord {
  id: string
  workflowId: string
  timestamp: string
  status: TransactionStatus
  conflictStrategy: ConflictStrategy
  clientId: string
  fromStep?: WorkflowStep
  toStep?: WorkflowStep
  metadata?: Record<string, unknown>
}

/**
 * Metadata interface for custom fields and state in the workflow.
 * This can include progress, errors, or specialized verification data.
 */
export interface WorkflowMetadata {
  progress?: number
  phase?: string
  error?: string | null
  errorDetails?: Record<string, unknown>
  verificationMetadata?: Record<string, unknown>
  [key: string]: unknown
}

// WorkflowStepEnum enum for use in the service
export enum WorkflowStepEnum {
  IDLE = 'idle',
  UPLOADING = 'uploading',
  EXTRACTING = 'extracting',
  VERIFICATION = 'verification',
  VERIFICATION_PENDING = 'verification_pending',
  VERIFICATION_IN_PROGRESS = 'verification_in_progress',
  VERIFICATION_COMPLETED = 'verification_completed',
  VERIFICATION_FAILED = 'verification_failed',
  REPORT_GENERATION = 'report_generation',
  COMPLETE = 'complete',
  CHAT_STARTED = 'chat_started',
  CHAT_IN_PROGRESS = 'chat_in_progress',
  CHAT_COMPLETED = 'chat_completed',
  CHAT_ERROR = 'chat_error',
  ERROR = 'error',
  RESEARCH = 'research',
  REPORT_PRESENTATION = 'report_presentation'
}

/**
 * Custom workflow state error class
 */
class WorkflowStateError extends ApplicationError {
  constructor(options: { message: string; data?: Record<string, unknown> }) {
    super({
      message: options.message,
      code: 'WORKFLOW_STATE_ERROR',
      data: options.data
    });
  }
}

/**
 * Deprecated: This function has been moved to workflowStateManager.validateTransition
 * Use workflowStateManager.validateTransition instead as the canonical validation method.
 * 
 * @deprecated Use workflowStateManager.validateTransition for all workflow transition validation
 */
export function validateWorkflowTransition(
  fromStep: WorkflowStep,
  toStep: WorkflowStep,
  metadata?: Record<string, unknown>
): {
  isValid: boolean
  error?: string
  transition?: WorkflowTransition
  details?: Record<string, unknown>
} {
  // Forward to the canonical implementation in workflowStateManager
  return workflowStateManager.validateTransition(fromStep, toStep, metadata);
}

// The WorkflowStepMapper.toDatabaseStep() function is now used directly

/**
 * Facade service that provides a single entry point for all workflow operations.
 * Delegates implementation details to specialized components.
 */
export class WorkflowService {
  private readonly logger = logger.withMetadata({ module: 'WorkflowService' });
  
  /**
   * Update workflow progress with optional notification
   */
  async updateProgress(
    workflowId: string,
    progress: number,
    phase: ProcessingPhase,
    currentStep?: WorkflowStep,
    notifyUsers: boolean = true
  ): Promise<boolean> {
    try {
      if (!workflowId) {
        throw new Error('workflowId is required');
      }
      
      // Use state manager to update progress
      await workflowStateManager.updateProgress(
        workflowId,
        progress,
        phase,
        { 
          currentStep,
          notifyUsers 
        }
      );
      
      return true;
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to update progress', {
        workflowId,
        progress,
        phase: phase.toString(),
        error: normalizedError.message
      });
      return false;
    }
  }
  
  /**
   * DOMAIN-SPECIFIC METHODS
   * The following methods delegate to domain-specific workflow processors
   */
  
  /**
   * Document workflow methods
   */
  
  /**
   * Process document upload
   * Handles Result pattern from domain workflow processor
   */
  async processDocumentUpload(
    workflowId: string,
    file: File,
    options: DocumentUploadOptions
  ): Promise<DocumentProcessingResult> {
    const result = await documentWorkflow.processUpload(workflowId, file, options);
    
    // Handle Result pattern
    if (result.isSuccess()) {
      return result.value;
    } else {
      // Log error with enhanced context
      this.logger.error('Document upload failed', {
        workflowId,
        fileName: file.name,
        error: result.error.message,
        code: result.error.code,
        details: result.error.details
      });
      
      // Convert to legacy error format
      return {
        documentId: '',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          error: result.error.message,
          errorCode: result.error.code
        },
        success: false,
        processingTime: 0,
        error: result.error.message
      };
    }
  }
  
  /**
   * Extract content from document
   * Handles Result pattern from domain workflow processor
   */
  async extractDocumentContent(
    workflowId: string,
    documentId: string,
    options?: DocumentExtractionOptions
  ): Promise<DocumentProcessingResult> {
    const result = await documentWorkflow.extractContent(workflowId, documentId, options);
    
    // Handle Result pattern
    if (result.isSuccess()) {
      return result.value;
    } else {
      // Log error with enhanced context
      this.logger.error('Document extraction failed', {
        workflowId,
        documentId,
        error: result.error.message,
        code: result.error.code,
        details: result.error.details
      });
      
      // Convert to legacy error format
      return {
        documentId,
        metadata: {
          error: result.error.message,
          errorCode: result.error.code
        },
        success: false,
        processingTime: 0,
        error: result.error.message
      };
    }
  }
  
  /**
   * Get document info
   * Handles Result pattern from domain workflow processor
   */
  async getDocumentInfo(
    workflowId: string,
    documentId: string
  ): Promise<Record<string, unknown> | null> {
    const result = await documentWorkflow.getDocumentInfo(workflowId, documentId);
    
    // Handle Result pattern
    if (result.isSuccess()) {
      return result.value;
    } else {
      // Log error with enhanced context
      this.logger.error('Failed to get document info', {
        workflowId,
        documentId,
        error: result.error.message,
        code: result.error.code,
        details: result.error.details
      });
      
      // Return null for backward compatibility
      return null;
    }
  }
  
  /**
   * Verification workflow methods
   */
  
  /**
   * Initialize verification process
   * Handles Result pattern from domain workflow processor
   */
  async initiateVerification(
    workflowId: string,
    options: VerificationOptions
  ): Promise<VerificationResult> {
    const result = await verificationWorkflow.initiateVerification(workflowId, options);
    
    // Handle Result pattern
    if (result.isSuccess()) {
      return result.value;
    } else {
      // Log error with enhanced context
      this.logger.error('Verification initialization failed', {
        workflowId,
        documentId: options?.documentId,
        userId: options?.userId,
        error: result.error.message,
        code: result.error.code,
        details: result.error.details
      });
      
      // Convert to legacy error format
      return {
        verificationId: '',
        documentId: options.documentId,
        success: false,
        metadata: {
          error: result.error.message,
          errorCode: result.error.code,
          userId: options.userId
        },
        error: result.error.message
      };
    }
  }
  
  /**
   * Process verification correction
   * Handles Result pattern from domain workflow processor
   */
  async processVerificationCorrection(
    workflowId: string,
    verificationId: string,
    correction: CorrectionData
  ): Promise<VerificationResult> {
    const result = await verificationWorkflow.processCorrection(workflowId, verificationId, correction);
    
    // Handle Result pattern
    if (result.isSuccess()) {
      return result.value;
    } else {
      // Log error with enhanced context
      this.logger.error('Verification correction failed', {
        workflowId,
        verificationId,
        userId: correction?.userId,
        error: result.error.message,
        code: result.error.code,
        details: result.error.details
      });
      
      // Convert to legacy error format
      return {
        verificationId,
        documentId: '', // Unknown at this point
        success: false,
        metadata: {
          error: result.error.message,
          errorCode: result.error.code,
          userId: correction.userId
        },
        error: result.error.message
      };
    }
  }
  
  /**
   * Complete verification process
   * Handles Result pattern from domain workflow processor
   */
  async completeVerification(
    workflowId: string,
    verificationId: string,
    userId: string,
    autoGenerateReport: boolean = false
  ): Promise<VerificationResult> {
    const result = await verificationWorkflow.completeVerification(
      workflowId, 
      verificationId, 
      userId, 
      autoGenerateReport
    );
    
    // Handle Result pattern
    if (result.isSuccess()) {
      return result.value;
    } else {
      // Log error with enhanced context
      this.logger.error('Verification completion failed', {
        workflowId,
        verificationId,
        userId,
        autoGenerateReport,
        error: result.error.message,
        code: result.error.code,
        details: result.error.details
      });
      
      // Convert to legacy error format
      return {
        verificationId,
        documentId: '', // Unknown at this point
        success: false,
        metadata: {
          error: result.error.message,
          errorCode: result.error.code,
          userId,
          autoGenerateReport
        },
        error: result.error.message
      };
    }
  }
  
  /**
   * Reject verification (mark as failed)
   * Handles Result pattern from domain workflow processor
   */
  async rejectVerification(
    workflowId: string,
    verificationId: string,
    userId: string,
    reason: string
  ): Promise<VerificationResult> {
    const result = await verificationWorkflow.rejectVerification(
      workflowId, 
      verificationId, 
      userId, 
      reason
    );
    
    // Handle Result pattern
    if (result.isSuccess()) {
      return result.value;
    } else {
      // Log error with enhanced context
      this.logger.error('Verification rejection failed', {
        workflowId,
        verificationId,
        userId,
        reason,
        error: result.error.message,
        code: result.error.code,
        details: result.error.details
      });
      
      // Convert to legacy error format
      return {
        verificationId,
        documentId: '', // Unknown at this point
        success: false,
        metadata: {
          error: result.error.message,
          errorCode: result.error.code,
          userId,
          reason
        },
        error: result.error.message
      };
    }
  }
  
  /**
   * Get verification status
   * Handles Result pattern from domain workflow processor
   */
  async getVerificationStatus(
    workflowId: string,
    verificationId: string
  ): Promise<VerificationResult | null> {
    const result = await verificationWorkflow.getVerificationStatus(workflowId, verificationId);
    
    // Handle Result pattern
    if (result.isSuccess()) {
      return result.value;
    } else {
      // Log error with enhanced context
      this.logger.error('Failed to get verification status', {
        workflowId,
        verificationId,
        error: result.error.message,
        code: result.error.code,
        details: result.error.details
      });
      
      // Return null for backward compatibility
      return null;
    }
  }
  
  /**
   * Report workflow methods
   */
  
  /**
   * Generate report
   * Handles Result pattern from domain workflow processor
   */
  async generateReport(
    workflowId: string,
    options: ReportGenerationOptions
  ): Promise<ReportGenerationResult> {
    const result = await reportWorkflow.generateReport(workflowId, options);
    
    // Handle Result pattern
    if (result.isSuccess()) {
      return result.value;
    } else {
      // Log error with enhanced context
      this.logger.error('Report generation failed', {
        workflowId,
        documentId: options?.documentId,
        patientId: options?.patientId,
        userId: options?.userId,
        error: result.error.message,
        code: result.error.code,
        details: result.error.details
      });
      
      // Convert to legacy error format
      return {
        reportId: '',
        documentId: options.documentId,
        patientId: options.patientId,
        success: false,
        metadata: {
          error: result.error.message,
          errorCode: result.error.code,
          userId: options.userId
        },
        error: result.error.message
      };
    }
  }
  
  /**
   * Format report in different output formats
   * Handles Result pattern from domain workflow processor
   */
  async formatReport(
    workflowId: string,
    reportId: string,
    formatOptions: ReportFormatOptions
  ): Promise<ReportGenerationResult> {
    const result = await reportWorkflow.formatReport(workflowId, reportId, formatOptions);
    
    // Handle Result pattern
    if (result.isSuccess()) {
      return result.value;
    } else {
      // Log error with enhanced context
      this.logger.error('Report formatting failed', {
        workflowId,
        reportId,
        format: formatOptions?.format,
        error: result.error.message,
        code: result.error.code,
        details: result.error.details
      });
      
      // Convert to legacy error format
      return {
        reportId,
        documentId: '', // Unknown at this point
        success: false,
        metadata: {
          error: result.error.message,
          errorCode: result.error.code,
          format: formatOptions?.format
        },
        error: result.error.message
      };
    }
  }
  
  /**
   * Get report by ID
   * Handles Result pattern from domain workflow processor
   */
  async getReport(
    workflowId: string,
    reportId: string
  ): Promise<ReportGenerationResult | null> {
    const result = await reportWorkflow.getReport(workflowId, reportId);
    
    // Handle Result pattern
    if (result.isSuccess()) {
      return result.value;
    } else {
      // Log error with enhanced context
      this.logger.error('Failed to get report', {
        workflowId,
        reportId,
        error: result.error.message,
        code: result.error.code,
        details: result.error.details
      });
      
      // Return null for backward compatibility
      return null;
    }
  }
  
  /**
   * Research workflow methods
   */
  
  /**
   * Execute research query
   * Adapter method to handle new Result pattern from research workflow
   */
  async executeResearch(
    workflowId: string,
    options: ResearchOptions
  ): Promise<ResearchResult> {
    try {
      // Call domain method which now returns Result<ResearchResult>
      const result = await researchWorkflow.executeResearch(workflowId, options);
      
      // Handle Result pattern
      if (result.isSuccess()) {
        // Return the unwrapped value
        return result.value;
      } else {
        // Log the error
        this.logger.error('Failed to execute research', {
          workflowId,
          query: options.query,
          userId: options.userId,
          error: result.error.message,
          code: result.error.code,
          details: result.error.details
        });
        
        // Throw error with preserved message for backward compatibility
        throw new ApplicationError(
          result.error.message,
          result.error.code,
          result.error.details
        );
      }
    } catch (error) {
      // If it's already an ApplicationError (from above), just rethrow
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      // Otherwise, this is an unexpected error
      const normalizedError = normalizeError(error);
      this.logger.error('Unexpected error in executeResearch adapter', {
        workflowId,
        query: options.query,
        error: normalizedError.message
      });
      
      throw normalizedError;
    }
  }
  
  /**
   * Get research results
   * Adapter method to handle new Result pattern from research workflow
   */
  async getResearchResults(
    workflowId: string,
    researchId: string
  ): Promise<ResearchResult | null> {
    try {
      // Call domain method which now returns Result<ResearchResult | null>
      const result = await researchWorkflow.getResearchResults(workflowId, researchId);
      
      // Handle Result pattern
      if (result.isSuccess()) {
        // Return the unwrapped value (which might be null)
        return result.value;
      } else {
        // Log the error
        this.logger.error('Failed to get research results', {
          workflowId,
          researchId,
          error: result.error.message,
          code: result.error.code,
          details: result.error.details
        });
        
        // Return null to maintain the original interface
        return null;
      }
    } catch (error) {
      // This should only happen if there's an unexpected error
      this.logger.error('Unexpected error in getResearchResults adapter', {
        workflowId,
        researchId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
  
  /**
   * Chat workflow methods
   */
  
  /**
   * Start chat session
   * Adapter method to handle new Result pattern from chat workflow
   */
  async startChatSession(
    workflowId: string,
    chatId: string,
    userId: string,
    initialMetadata: Record<string, unknown> = {}
  ): Promise<ChatSessionResult> {
    try {
      // Call domain method which now returns Result<ChatSessionResult>
      const result = await chatWorkflow.startChatSession(workflowId, chatId, userId, initialMetadata);
      
      // Handle Result pattern
      if (result.isSuccess()) {
        // Return the unwrapped value
        return result.value;
      } else {
        // Log the error
        this.logger.error('Failed to start chat session', {
          workflowId,
          chatId,
          userId,
          error: result.error.message,
          code: result.error.code,
          details: result.error.details
        });
        
        // Throw error with preserved message for backward compatibility
        throw new ApplicationError(
          result.error.message,
          result.error.code,
          result.error.details
        );
      }
    } catch (error) {
      // If it's already an ApplicationError (from above), just rethrow
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      // Otherwise, this is an unexpected error
      const normalizedError = normalizeError(error);
      this.logger.error('Unexpected error in startChatSession adapter', {
        workflowId,
        chatId,
        userId,
        error: normalizedError.message
      });
      
      throw normalizedError;
    }
  }
  
  /**
   * Process user message
   * Adapter method to handle new Result pattern from chat workflow
   */
  async processMessage(
    workflowId: string,
    chatId: string,
    message: string,
    options: MessageProcessingOptions
  ): Promise<ChatSessionResult> {
    try {
      // Call domain method which now returns Result<ChatSessionResult>
      const result = await chatWorkflow.processMessage(workflowId, chatId, message, options);
      
      // Handle Result pattern
      if (result.isSuccess()) {
        // Return the unwrapped value
        return result.value;
      } else {
        // Log the error
        this.logger.error('Failed to process chat message', {
          workflowId,
          chatId,
          userId: options.userId,
          error: result.error.message,
          code: result.error.code,
          details: result.error.details
        });
        
        // Throw error with preserved message for backward compatibility
        throw new ApplicationError(
          result.error.message,
          result.error.code,
          result.error.details
        );
      }
    } catch (error) {
      // If it's already an ApplicationError (from above), just rethrow
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      // Otherwise, this is an unexpected error
      const normalizedError = normalizeError(error);
      this.logger.error('Unexpected error in processMessage adapter', {
        workflowId,
        chatId,
        userId: options.userId,
        error: normalizedError.message
      });
      
      throw normalizedError;
    }
  }
  
  /**
   * Complete chat session
   * Adapter method to handle new Result pattern from chat workflow
   */
  async completeChatSession(
    workflowId: string,
    chatId: string,
    userId: string,
    summary?: string
  ): Promise<ChatSessionResult> {
    try {
      // Call domain method which now returns Result<ChatSessionResult>
      const result = await chatWorkflow.completeChatSession(workflowId, chatId, userId, summary);
      
      // Handle Result pattern
      if (result.isSuccess()) {
        // Return the unwrapped value
        return result.value;
      } else {
        // Log the error
        this.logger.error('Failed to complete chat session', {
          workflowId,
          chatId,
          userId,
          error: result.error.message,
          code: result.error.code,
          details: result.error.details
        });
        
        // Throw error with preserved message for backward compatibility
        throw new ApplicationError(
          result.error.message,
          result.error.code,
          result.error.details
        );
      }
    } catch (error) {
      // If it's already an ApplicationError (from above), just rethrow
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      // Otherwise, this is an unexpected error
      const normalizedError = normalizeError(error);
      this.logger.error('Unexpected error in completeChatSession adapter', {
        workflowId,
        chatId,
        userId,
        error: normalizedError.message
      });
      
      throw normalizedError;
    }
  }
  
  /**
   * Handle chat error
   * Adapter method to handle new Result pattern from chat workflow
   */
  async handleChatError(
    workflowId: string,
    chatId: string,
    error: Error | string,
    context?: Record<string, unknown>
  ): Promise<ChatSessionResult> {
    try {
      // Call domain method which now returns Result<ChatSessionResult>
      const result = await chatWorkflow.handleChatError(workflowId, chatId, error, context);
      
      // Handle Result pattern
      if (result.isSuccess()) {
        // Return the unwrapped value
        return result.value;
      } else {
        // Log the error
        this.logger.error('Failed to handle chat error', {
          workflowId,
          chatId,
          originalError: error instanceof Error ? error.message : error,
          resultError: result.error.message,
          code: result.error.code,
          details: result.error.details
        });
        
        // In this case, we'll create a minimalistic error result since we're already in an error state
        return {
          chatId,
          userId: (context?.userId as string) || '',
          success: false,
          metadata: {
            error: result.error.message,
            originalError: error instanceof Error ? error.message : error,
            code: result.error.code || 'CHAT_ERROR_HANDLING_FAILED',
            timestamp: new Date().toISOString()
          },
          error: result.error.message
        };
      }
    } catch (unexpectedError) {
      // This is a meta-error (error in error handling)
      const normalizedError = normalizeError(unexpectedError);
      this.logger.error('Unexpected error in handleChatError adapter', {
        workflowId,
        chatId,
        originalError: error instanceof Error ? error.message : error,
        handlerError: normalizedError.message
      });
      
      // Return minimal error response since we're already in error state
      return {
        chatId,
        userId: (context?.userId as string) || '',
        success: false,
        metadata: {
          error: 'Error handler failed',
          originalError: error instanceof Error ? error.message : error,
          handlerError: normalizedError.message,
          code: 'CHAT_ERROR_HANDLER_FAILED',
          timestamp: new Date().toISOString()
        },
        error: 'Error handler failed: ' + normalizedError.message
      };
    }
  }
  
  /**
   * Get chat session
   * Adapter method to handle new Result pattern from chat workflow
   */
  async getChatSession(
    workflowId: string,
    chatId: string
  ): Promise<ChatSessionResult | null> {
    try {
      // Call domain method which now returns Result<ChatSessionResult | null>
      const result = await chatWorkflow.getChatSession(workflowId, chatId);
      
      // Handle Result pattern
      if (result.isSuccess()) {
        // Return the unwrapped value (which might be null)
        return result.value;
      } else {
        // Log the error
        this.logger.error('Failed to get chat session', {
          workflowId,
          chatId,
          error: result.error.message,
          code: result.error.code,
          details: result.error.details
        });
        
        // Return null to maintain the original interface
        return null;
      }
    } catch (error) {
      // This should only happen if there's an unexpected error
      this.logger.error('Unexpected error in getChatSession adapter', {
        workflowId,
        chatId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
  
  /**
   * Orchestration methods
   */
  
  // This method has been replaced by the enhanced version above with improved error handling
  
  // This method has been replaced by the enhanced version above with improved error handling
  
  // This method has been replaced by the enhanced version above with improved error handling

  /**
   * Update workflow with chat message in a single atomic operation
   */
  async updateWithChatMessage(
    workflowId: string,
    step: WorkflowStep,
    metadata: Record<string, unknown>,
    messageContent: string,
    messageRole: string = 'system',
    messageMetadata: Record<string, unknown> | null = null
  ): Promise<{ success: boolean; workflowId?: string; messageId?: string }> {
    try {
      if (!workflowId) {
        throw new Error('workflowId is required');
      }
      
      // Delegate to repository
      return await workflowRepository.updateWithChatMessage(
        workflowId,
        step,
        metadata,
        messageContent,
        messageRole,
        messageMetadata
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to update with chat message', {
        workflowId,
        step,
        error: normalizedError.message
      });
      return { success: false };
    }
  }
  
  /**
   * Log a workflow event for audit and event sourcing
   */
  async logWorkflowEvent(
    workflowId: string,
    eventType: string,
    eventData: Record<string, unknown>,
    actorId?: string
  ): Promise<string | null> {
    try {
      if (!workflowId) {
        return null;
      }
      
      // Delegate to event sourcing service
      return await workflowEventSourcing.appendEvent(
        workflowId,
        eventType,
        eventData,
        actorId
      );
    } catch (err) {
      // Just log error but don't throw since event logging is non-critical
      this.logger.error('Failed to log workflow event', {
        workflowId,
        eventType,
        error: err instanceof Error ? err.message : String(err)
      });
      return null;
    }
  }
  
  /**
   * Update workflow with conflict resolution
   */
  async updateWithConflictResolution(
    workflowId: string,
    step: WorkflowStep,
    metadata: Record<string, unknown> = {},
    options: {
      expectedTimestamp?: string;
      strategy?: 'fail' | 'force' | 'merge';
    } = {}
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!workflowId) {
        throw new Error('workflowId is required');
      }
      
      // Delegate to repository
      return await workflowRepository.updateWithConflictResolution(
        workflowId,
        step,
        metadata,
        options
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to update with conflict resolution', {
        workflowId,
        step,
        strategy: options.strategy,
        error: normalizedError.message
      });
      return {
        success: false,
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Recover workflow state after error
   * @deprecated Use recoverFromError for comprehensive recovery
   */
  async recoverWorkflowState(
    workflowId: string,
    targetStep: WorkflowStep,
    recoveryMetadata?: Record<string, unknown>
  ): Promise<boolean> {
    try {
      if (!workflowId) {
        return false;
      }
      
      // Create proper error metadata for recovery service
      const errorMetadata: WorkflowErrorMetadata = {
        errorMessage: recoveryMetadata?.error as string || 'Unknown error',
        errorType: (recoveryMetadata?.errorType as string || 'unknown') as any,
        workflowStep: recoveryMetadata?.originalStep as WorkflowStep || 'error',
        previousStep: recoveryMetadata?.previousStep as WorkflowStep,
        recoveryPaths: [targetStep],
        timestamp: recoveryMetadata?.errorTimestamp as string || new Date().toISOString(),
        details: {
          ...recoveryMetadata,
          workflowId
        }
      };

      // Use recovery service with DATABASE strategy
      const result = await recoveryService.recoverFromError({
        workflowId,
        strategy: RecoveryStrategy.DATABASE,
        metadata: errorMetadata,
        recoveryStep: targetStep
      });

      return result.isSuccess() && result.value.success;
    } catch (err) {
      this.logger.error('Failed to recover workflow state', {
        workflowId,
        targetStep,
        error: err instanceof Error ? err.message : String(err)
      });
      
      // Fall back to the direct repository call if recovery service fails
      try {
        return await workflowRepository.recoverState(
          workflowId,
          targetStep,
          recoveryMetadata
        );
      } catch (repositoryError) {
        this.logger.error('Repository recovery also failed', {
          workflowId,
          targetStep,
          error: repositoryError instanceof Error ? repositoryError.message : String(repositoryError)
        });
        return false;
      }
    }
  }
  
  /**
   * Reconstruct workflow state from event history
   * @deprecated Use recoverFromError with TRANSACTION strategy for better reconstruction
   */
  async reconstructWorkflowState(workflowId: string): Promise<Record<string, unknown> | null> {
    try {
      if (!workflowId) {
        return null;
      }
      
      // Get current state to create error metadata
      const currentState = await this.getWorkflowState(workflowId);
      
      if (!currentState) {
        // If no state exists, just use the repository directly
        return await workflowRepository.reconstructState(workflowId);
      }
      
      // Create error metadata for recovery
      const errorMetadata: WorkflowErrorMetadata = {
        errorMessage: 'Manual state reconstruction requested',
        errorType: 'state_reconstruction',
        workflowStep: currentState.currentStep,
        previousStep: currentState.currentStep,
        timestamp: new Date().toISOString(),
        details: {
          isManualReconstruction: true,
          workflowId,
          currentState
        }
      };
      
      // Use recovery service with TRANSACTION strategy which includes event sourcing
      const result = await recoveryService.recoverFromError({
        workflowId,
        strategy: RecoveryStrategy.TRANSACTION,
        fallbackStrategies: [RecoveryStrategy.DATABASE],
        metadata: errorMetadata
      });
      
      if (result.isSuccess() && result.value.success) {
        // Get the reconstructed state
        const reconstructedState = await this.getWorkflowState(workflowId);
        return reconstructedState ? {
          currentStep: reconstructedState.currentStep,
          metadata: reconstructedState.metadata,
          reconstructionResult: result.value
        } : null;
      }
      
      // Fall back to direct repository call if recovery service fails
      this.logger.warn('Recovery service failed to reconstruct state, falling back to repository', {
        workflowId,
        result: result.isSuccess() ? result.value : result.error
      });
      return await workflowRepository.reconstructState(workflowId);
    } catch (err) {
      this.logger.error('Failed to reconstruct workflow state', {
        workflowId,
        error: err instanceof Error ? err.message : String(err)
      });
      return null;
    }
  }

  /**
   * Recover from workflow error using multi-strategy approach
   * This method provides access to the comprehensive recovery capabilities
   */
  async recoverFromError(
    workflowId: string,
    options: {
      errorType?: string;
      errorMessage?: string;
      currentStep?: WorkflowStep;
      targetStep?: WorkflowStep;
      strategy?: RecoveryStrategy;
      metadata?: Record<string, unknown>;
      showToast?: boolean;
    }
  ): Promise<boolean> {
    try {
      // Get current state if not specified
      const currentStep = options.currentStep || 
        (await this.getWorkflowState(workflowId))?.currentStep || 
        'error';
      
      // Build error metadata
      const errorMetadata: WorkflowErrorMetadata = {
        errorMessage: options.errorMessage || 'Unspecified error',
        errorType: options.errorType || 'unknown' as any,
        workflowStep: currentStep,
        previousStep: currentStep,
        timestamp: new Date().toISOString(),
        details: {
          ...options.metadata,
          workflowId,
          isExplicitRecovery: true
        }
      };
      
      // If target step is specified, add it to recovery paths
      if (options.targetStep) {
        errorMetadata.recoveryPaths = [options.targetStep];
      }
      
      // Get recommended recovery strategy if none specified
      const recommendedStrategy = options.strategy 
        ? { primary: options.strategy, fallbacks: [] }
        : recoveryService.getRecommendedStrategy(errorMetadata);
      
      // Use recovery service with specified or recommended strategy
      const result = await recoveryService.recoverFromError({
        workflowId,
        strategy: recommendedStrategy.primary,
        fallbackStrategies: recommendedStrategy.fallbacks,
        metadata: errorMetadata,
        recoveryStep: options.targetStep,
        showToast: options.showToast
      });
      
      return result.isSuccess() && result.value.success;
    } catch (err) {
      this.logger.error('Failed to recover from error', {
        workflowId,
        error: err instanceof Error ? err.message : String(err),
        options
      });
      return false;
    }
  }

  /**
   * Load workflow state DB record by userId + chatId.
   */
  async loadWorkflowStateForUser(userId: string, chatId?: string | null) {
    try {
      if (!userId) {
        throw new Error('userId is required');
      }
      
      // Delegate to repository
      return await workflowRepository.loadStateForUser(userId, chatId);
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to load workflow state for user', {
        userId,
        chatId,
        error: normalizedError.message
      });
      throw normalizedError;
    }
  }

  /**
   * Get or create workflow state for user+chat
   */
  async getOrCreateWorkflowForUser(
    userId: string,
    chatId: string | null,
    initialStep: WorkflowStep = 'idle',
    initialMetadata: Record<string, unknown> = {}
  ): Promise<{ id: string; data: Record<string, unknown> }> {
    try {
      if (!userId) {
        throw new Error('userId is required');
      }
      
      // Delegate to repository
      const result = await workflowRepository.getOrCreateForUser(
        userId,
        chatId,
        initialStep,
        initialMetadata
      );
      
      // Convert to expected format
      return {
        id: result.id,
        data: {
          id: result.id,
          current_step: result.state.currentStep,
          progress: result.state.progress,
          error: result.state.error,
          phase: result.state.phase,
          metadata: result.state.metadata,
          timestamp: result.state.timestamp
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to get or create workflow for user', {
        userId,
        chatId,
        error: normalizedError.message
      });
      throw normalizedError;
    }
  }

  /**
   * Get client ID
   */
  getClientId(): string {
    return workflowRepository.getClientId();
  }

  /**
   * Subscribe to workflow changes
   */
  subscribeToWorkflowChanges(
    workflowId: string,
    onUpdate: (payload: {
      new: { current_step: string; metadata: unknown }
      old: unknown
    }) => void,
    onStatusChange?: (status: string) => void
  ): RealtimeChannel {
    // Delegate to repository
    return workflowRepository.subscribeToWorkflowChanges(
      workflowId,
      onUpdate,
      { onStatusChange }
    );
  }

  /**
   * Subscribe to workflow_states changes by userId
   */
  subscribeToWorkflowForUser(
    userId: string,
    chatId: string | null,
    onUpdate: (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => void,
    onStatusChange?: (status: string) => void
  ): RealtimeChannel {
    // Delegate to repository
    return workflowRepository.subscribeToWorkflowForUser(
      userId,
      chatId,
      onUpdate,
      { onStatusChange }
    );
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribeFromChannel(channel: RealtimeChannel): void {
    workflowRepository.unsubscribeFromChannel(channel);
  }

  /**
   * Create new workflow state
   */
  async createWorkflowState(
    userId: string,
    initialStep: WorkflowStep = 'idle',
    metadata: Record<string, unknown> = {}
  ): Promise<string | null> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Delegate to repository
      return await workflowRepository.createWorkflowState(
        userId,
        initialStep,
        null, // chatId
        metadata
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to create workflow state', {
        userId,
        initialStep,
        error: normalizedError.message
      });
      return null;
    }
  }

  /**
   * Get workflow state
   */
  async getWorkflowState(
    workflowId: string,
    _options: { bypassCache?: boolean } = {}
  ): Promise<{
    currentStep: WorkflowStep
    progress: number
    error?: string | null
    phase?: string
    metadata?: WorkflowMetadata
    timestamp: string
    updatedAt: string
  } | null> {
    try {
      if (!workflowId) return null;
      
      // Delegate to repository
      const state = await workflowRepository.getWorkflowState(workflowId);
      
      if (!state) return null;
      
      // Convert to expected format for backward compatibility
      return {
        currentStep: state.currentStep,
        progress: state.progress || 0,
        error: state.error,
        phase: state.phase,
        metadata: state.metadata as WorkflowMetadata,
        timestamp: state.timestamp,
        updatedAt: state.timestamp,
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to get workflow state', {
        workflowId,
        error: normalizedError.message
      });
      return null;
    }
  }

  /**
   * Update workflow state
   */
  async updateWorkflowState(
    workflowId: string,
    step: WorkflowStep,
    metadata: Record<string, unknown> = {},
    options?: {
      skipValidation?: boolean
      forceUpdate?: boolean
      conflictStrategy?: ConflictStrategy
      useAtomicUpdate?: boolean
    }
  ): Promise<string> {
    const transactionId = crypto.randomUUID();
    
    try {
      if (!workflowId) {
        throw new Error('workflowId is required');
      }
      
      const { 
        skipValidation = false, 
        forceUpdate = false,
        conflictStrategy = 'pessimistic',
        useAtomicUpdate = true
      } = options ?? {};
      
      // Get current state for transition validation
      let fromStep: WorkflowStep = 'idle';
      let expectedTimestamp: string | undefined;
      
      if (!skipValidation || conflictStrategy === 'pessimistic') {
        const currentState = await this.getWorkflowState(workflowId);
        if (currentState) {
          fromStep = currentState.currentStep;
          expectedTimestamp = currentState.timestamp;
        }
      }
      
      // Use state manager for transition with proper validation
      if (useAtomicUpdate && conflictStrategy === 'pessimistic') {
        await workflowStateManager.transitionState(
          workflowId,
          fromStep,
          step,
          {
            ...metadata,
            transactionId
          },
          {
            skipValidation,
            forceUpdate,
            expectedTimestamp,
            logEvent: true,
            transactionId
          }
        );
        
        return transactionId;
      }
      
      // Handle conflict resolution for optimistic approach
      if (useAtomicUpdate && conflictStrategy === 'optimistic') {
        const result = await this.updateWithConflictResolution(
          workflowId,
          step,
          {
            ...metadata,
            transactionId
          },
          {
            expectedTimestamp,
            strategy: forceUpdate ? 'force' : 'merge'
          }
        );
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to update workflow state');
        }
        
        return transactionId;
      }
      
      // Fall back to direct update
      await workflowRepository.updateWorkflowState(
        workflowId,
        step,
        {
          ...metadata,
          transactionId
        },
        {
          skipValidation,
          forceUpdate,
          conflictStrategy: conflictStrategy as any
        }
      );
      
      return transactionId;
    } catch (err) {
      const normalizedError = normalizeError(err);
      
      // Enhanced error logging
      this.logger.error('Failed to update workflow state', {
        workflowId,
        step,
        transactionId,
        error: normalizedError.message,
        stack: normalizedError.stack,
        data: normalizedError.data
      });
      
      throw new ApplicationError({
        message: `Failed to update workflow state: ${normalizedError.message}`,
        code: normalizedError.code || 'WORKFLOW_UPDATE_FAILED',
        data: {
          workflowId,
          step,
          transactionId,
          originalError: normalizedError
        }
      });
    }
  }

  /**
   * Sets workflow to error step with given message
   */
  async setWorkflowError(
    workflowId: string,
    errorMessage: string,
    errorDetails: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      if (!workflowId) return;
      
      // Get current state before setting error
      const currentState = await this.getWorkflowState(workflowId);
      const currentStep = currentState?.currentStep || 'idle';
      
      // Use state manager to handle error with proper recording
      await workflowStateManager.handleError(
        workflowId,
        new Error(errorMessage),
        currentStep,
        errorDetails
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to set workflow error', {
        workflowId,
        errorMessage,
        handlerError: normalizedError.message
      });
      
      // Don't throw to avoid cascading errors
    }
  }

  /**
   * Mark a workflow as complete
   */
  async completeWorkflow(
    workflowId: string,
    completionMetadata: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      if (!workflowId) return;
      
      // Use state manager to complete workflow
      await workflowStateManager.completeWorkflow(
        workflowId,
        completionMetadata
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to complete workflow', {
        workflowId,
        error: normalizedError.message
      });
      throw normalizedError;
    }
  }

  /**
   * Process document from upload through completion (upload → extract → verify → report)
   * End-to-end workflow orchestration using the workflowCoordinator
   */
  async processDocumentToCompletion(
    workflowId: string,
    file: File,
    options: {
      userId: string;
      patientId?: string;
      documentType?: string;
      autoVerify?: boolean;
      autoGenerateReport?: boolean;
      onProgress?: (progress: number, phase: ProcessingPhase, step: string) => void;
      transactionId?: string;
    }
  ): Promise<EndToEndResult> {
    try {
      if (!workflowId) {
        throw new Error('workflowId is required');
      }
      
      return await workflowCoordinator.processDocumentToCompletion(
        workflowId,
        file,
        options
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to process document to completion', {
        workflowId,
        fileName: file.name,
        userId: options.userId,
        error: normalizedError.message,
        stack: normalizedError.stack
      });
      
      // Set workflow to error state
      await workflowStateManager.handleError(
        workflowId,
        normalizedError,
        'error',
        {
          fileName: file.name,
          userId: options.userId,
          patientId: options.patientId,
          phase: ProcessingPhase.ERROR
        }
      );
      
      return {
        workflowId,
        success: false,
        metadata: {
          error: normalizedError.message,
          code: normalizedError.code || 'DOCUMENT_PROCESSING_FAILED',
          fileName: file.name
        },
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Process patient interactions through chat and research
   * Handles the orchestration between chat and research workflows
   */
  async processChatAndResearch(
    workflowId: string,
    chatId: string,
    userId: string,
    patientId: string,
    initialMessage?: string
  ): Promise<EndToEndResult> {
    try {
      if (!workflowId || !chatId || !userId) {
        throw new Error('Required parameters missing');
      }
      
      return await workflowCoordinator.processChatAndResearch(
        workflowId,
        chatId,
        userId,
        patientId,
        initialMessage
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to process chat and research', {
        workflowId,
        chatId,
        userId,
        patientId,
        error: normalizedError.message,
        stack: normalizedError.stack
      });
      
      // Set workflow to error state
      await workflowStateManager.handleError(
        workflowId,
        normalizedError,
        'chat_error',
        {
          chatId,
          userId,
          patientId,
          phase: ProcessingPhase.ERROR
        }
      );
      
      return {
        workflowId,
        success: false,
        metadata: {
          chatId,
          userId,
          patientId,
          error: normalizedError.message,
          code: normalizedError.code || 'CHAT_RESEARCH_FAILED'
        },
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Handle research request from chat
   * Delegates to workflowCoordinator for research handling
   */
  async handleResearchRequest(
    workflowId: string,
    query: string,
    chatId: string,
    userId: string,
    options: {
      patientId?: string;
      documentId?: string;
      includeCitations?: boolean;
      autoGenerateReport?: boolean;
    } = {}
  ): Promise<ResearchResult> {
    try {
      if (!workflowId || !query || !chatId || !userId) {
        throw new Error('Required parameters missing');
      }
      
      return await workflowCoordinator.handleResearchRequest(
        workflowId,
        query,
        chatId,
        userId,
        options
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to handle research request', {
        workflowId,
        query,
        chatId,
        userId,
        error: normalizedError.message,
        stack: normalizedError.stack
      });
      
      // Set workflow to error state
      await workflowStateManager.handleError(
        workflowId,
        normalizedError,
        DomainOnlyWorkflowStep.ERROR,
        {
          query,
          chatId,
          userId,
          phase: ProcessingPhase.RESEARCH
        }
      );
      
      return {
        researchId: '',
        query,
        success: false,
        metadata: {
          error: normalizedError.message,
          code: normalizedError.code || 'RESEARCH_REQUEST_FAILED'
        },
        error: normalizedError.message
      };
    }
  }
}

export const workflowService = new WorkflowService()