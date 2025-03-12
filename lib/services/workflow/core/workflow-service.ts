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

// Import domain-specific workflow processors
import { documentWorkflow } from '../domain/document-workflow'
import { verificationWorkflow } from '../domain/verification-workflow'
import { reportWorkflow } from '../domain/report-workflow'
import { researchWorkflow } from '../domain/research-workflow'
import { chatWorkflow } from '../domain/chat-workflow'
import { workflowOrchestrator } from '../domain/workflow-orchestrator'

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
 * Validate if a transition is allowed according to the state machine rules
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
  // Special case: if we're going from the same step to the same step, allow metadata-only updates
  if (fromStep === toStep) {
    return {
      isValid: true,
      details: { sameState: true },
    }
  }

  // Attempt to find a matching transition
  const transition = ALLOWED_TRANSITIONS.find(
    (t) => t.from === fromStep && t.to === toStep
  )
  if (!transition) {
    return {
      isValid: false,
      error: `Invalid transition from '${fromStep}' to '${toStep}'`,
      details: { reason: 'transition_not_allowed' },
    }
  }

  if (transition.requireData === true && (metadata === undefined || metadata === null)) {
    return {
      isValid: false,
      error: `Transition from '${fromStep}' to '${toStep}' requires metadata`,
      transition,
      details: { reason: 'metadata_required' },
    }
  }

  if (transition.allowData !== true && metadata !== undefined && metadata !== null) {
    return {
      isValid: false,
      error: `Transition from '${fromStep}' to '${toStep}' does not allow metadata`,
      transition,
      details: { reason: 'metadata_not_allowed' },
    }
  }

  // If transition is to ERROR, ensure there's some error info in metadata if required
  if (toStep === 'error' && transition.requireData === true) {
    const maybeHasError = metadata?.error
    if (typeof maybeHasError !== 'string') {
      return {
        isValid: false,
        error: 'Error transitions require an error message in metadata',
        transition,
        details: { reason: 'missing_error_info' },
      }
    }
  }

  return { isValid: true, transition, details: {} }
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
   */
  async processDocumentUpload(
    workflowId: string,
    file: File,
    options: DocumentUploadOptions
  ): Promise<DocumentProcessingResult> {
    return documentWorkflow.processUpload(workflowId, file, options);
  }
  
  /**
   * Extract content from document
   */
  async extractDocumentContent(
    workflowId: string,
    documentId: string,
    options?: DocumentExtractionOptions
  ): Promise<DocumentProcessingResult> {
    return documentWorkflow.extractContent(workflowId, documentId, options);
  }
  
  /**
   * Get document info
   */
  async getDocumentInfo(
    workflowId: string,
    documentId: string
  ): Promise<Record<string, unknown> | null> {
    return documentWorkflow.getDocumentInfo(workflowId, documentId);
  }
  
  /**
   * Verification workflow methods
   */
  
  /**
   * Initialize verification process
   */
  async initiateVerification(
    workflowId: string,
    options: VerificationOptions
  ): Promise<VerificationResult> {
    return verificationWorkflow.initiateVerification(workflowId, options);
  }
  
  /**
   * Process verification correction
   */
  async processVerificationCorrection(
    workflowId: string,
    verificationId: string,
    correction: CorrectionData
  ): Promise<VerificationResult> {
    return verificationWorkflow.processCorrection(workflowId, verificationId, correction);
  }
  
  /**
   * Complete verification process
   */
  async completeVerification(
    workflowId: string,
    verificationId: string,
    userId: string,
    autoGenerateReport: boolean = false
  ): Promise<VerificationResult> {
    return verificationWorkflow.completeVerification(workflowId, verificationId, userId, autoGenerateReport);
  }
  
  /**
   * Reject verification (mark as failed)
   */
  async rejectVerification(
    workflowId: string,
    verificationId: string,
    userId: string,
    reason: string
  ): Promise<VerificationResult> {
    return verificationWorkflow.rejectVerification(workflowId, verificationId, userId, reason);
  }
  
  /**
   * Get verification status
   */
  async getVerificationStatus(
    workflowId: string,
    verificationId: string
  ): Promise<VerificationResult | null> {
    return verificationWorkflow.getVerificationStatus(workflowId, verificationId);
  }
  
  /**
   * Report workflow methods
   */
  
  /**
   * Generate report
   */
  async generateReport(
    workflowId: string,
    options: ReportGenerationOptions
  ): Promise<ReportGenerationResult> {
    return reportWorkflow.generateReport(workflowId, options);
  }
  
  /**
   * Format report in different output formats
   */
  async formatReport(
    workflowId: string,
    reportId: string,
    formatOptions: ReportFormatOptions
  ): Promise<ReportGenerationResult> {
    return reportWorkflow.formatReport(workflowId, reportId, formatOptions);
  }
  
  /**
   * Get report by ID
   */
  async getReport(
    workflowId: string,
    reportId: string
  ): Promise<ReportGenerationResult | null> {
    return reportWorkflow.getReport(workflowId, reportId);
  }
  
  /**
   * Research workflow methods
   */
  
  /**
   * Execute research query
   */
  async executeResearch(
    workflowId: string,
    options: ResearchOptions
  ): Promise<ResearchResult> {
    return researchWorkflow.executeResearch(workflowId, options);
  }
  
  /**
   * Get research results
   */
  async getResearchResults(
    workflowId: string,
    researchId: string
  ): Promise<ResearchResult | null> {
    return researchWorkflow.getResearchResults(workflowId, researchId);
  }
  
  /**
   * Chat workflow methods
   */
  
  /**
   * Start chat session
   */
  async startChatSession(
    workflowId: string,
    chatId: string,
    userId: string,
    initialMetadata: Record<string, unknown> = {}
  ): Promise<ChatSessionResult> {
    return chatWorkflow.startChatSession(workflowId, chatId, userId, initialMetadata);
  }
  
  /**
   * Process user message
   */
  async processMessage(
    workflowId: string,
    chatId: string,
    message: string,
    options: MessageProcessingOptions
  ): Promise<ChatSessionResult> {
    return chatWorkflow.processMessage(workflowId, chatId, message, options);
  }
  
  /**
   * Complete chat session
   */
  async completeChatSession(
    workflowId: string,
    chatId: string,
    userId: string,
    summary?: string
  ): Promise<ChatSessionResult> {
    return chatWorkflow.completeChatSession(workflowId, chatId, userId, summary);
  }
  
  /**
   * Handle chat error
   */
  async handleChatError(
    workflowId: string,
    chatId: string,
    error: Error | string,
    context?: Record<string, unknown>
  ): Promise<ChatSessionResult> {
    return chatWorkflow.handleChatError(workflowId, chatId, error, context);
  }
  
  /**
   * Get chat session
   */
  async getChatSession(
    workflowId: string,
    chatId: string
  ): Promise<ChatSessionResult | null> {
    return chatWorkflow.getChatSession(workflowId, chatId);
  }
  
  /**
   * Orchestration methods
   */
  
  /**
   * Process document to completion (upload → extract → verify → report)
   */
  async processDocumentToCompletion(
    workflowId: string,
    file: File,
    options: DocumentToReportOptions
  ): Promise<EndToEndResult> {
    return workflowOrchestrator.processDocumentToCompletion(workflowId, file, options);
  }
  
  /**
   * Process patient interactions through chat and research
   */
  async processChatAndResearch(
    workflowId: string,
    chatId: string,
    userId: string,
    patientId: string,
    initialMessage?: string
  ): Promise<EndToEndResult> {
    return workflowOrchestrator.processChatAndResearch(workflowId, chatId, userId, patientId, initialMessage);
  }
  
  /**
   * Handle research request from chat
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
    return workflowOrchestrator.handleResearchRequest(workflowId, query, chatId, userId, options);
  }

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
      
      // Delegate to repository
      return await workflowRepository.recoverState(
        workflowId,
        targetStep,
        recoveryMetadata
      );
    } catch (err) {
      this.logger.error('Failed to recover workflow state', {
        workflowId,
        targetStep,
        error: err instanceof Error ? err.message : String(err)
      });
      return false;
    }
  }
  
  /**
   * Reconstruct workflow state from event history
   */
  async reconstructWorkflowState(workflowId: string): Promise<Record<string, unknown> | null> {
    try {
      if (!workflowId) {
        return null;
      }
      
      // Delegate to repository
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
}

export const workflowService = new WorkflowService()