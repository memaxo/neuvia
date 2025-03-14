/**
 * @fileoverview Verification Workflow Processor
 * 
 * Handles all verification-related workflow operations including:
 * - Verification initialization
 * - Correction processing
 * - Verification state management
 * - Results handling
 */

import { ApplicationError, normalizeError } from '@/lib/errors'
import logger from '@/lib/logger'
import { workflowRepository } from '../infrastructure/workflow-repository'
import { workflowStateManager } from '../infrastructure/workflow-state-manager'
import { workflowEventSourcing } from '../infrastructure/workflow-event-source'
import { workflowTransactionManager } from '../workflow-transaction-manager'
import { workflowEngine } from '../coordination/workflow-engine'
import { verificationWorkflowDefinition } from '../definitions/verification-workflow-definition'
import { BaseWorkflowProcessor } from '../base/base-workflow-processor'
import { Result } from '../error/result'

import type { WorkflowStep, ProcessingPhase, WorkflowState } from '@/lib/types/workflow'
import type { WorkflowProcessOptions } from '../base/base-workflow-processor'
import type { WorkflowAction } from '../coordination/workflow-definition'

/**
 * Verification result
 */
export interface VerificationResult {
  /** Verification ID */
  verificationId: string;
  /** Document ID */
  documentId: string;
  /** Summary ID if applicable */
  summaryId?: string;
  /** Whether verification was successful */
  success: boolean;
  /** Verification data */
  data?: Record<string, unknown>;
  /** Verification metadata */
  metadata: Record<string, unknown>;
  /** Error message if verification failed */
  error?: string;
}

/**
 * Correction data
 */
export interface CorrectionData {
  /** Fields that were corrected */
  correctedFields: Record<string, unknown>;
  /** User provided comments */
  userComments?: string;
  /** User ID who made the correction */
  userId: string;
  /** Version ID if applicable */
  versionId?: string;
}

/**
 * Verification options
 */
export interface VerificationOptions {
  /** User ID who initiated verification */
  userId: string;
  /** Document ID to verify */
  documentId: string;
  /** Document data to verify */
  documentData: Record<string, unknown>;
  /** Whether to auto-proceed to report generation after verification */
  autoGenerateReport?: boolean;
  /** Progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
  /** Transaction ID for tracking */
  transactionId?: string;
}

/**
 * Verification workflow processor
 * Now leverages the declarative workflow engine
 */
export class VerificationWorkflow extends BaseWorkflowProcessor<VerificationOptions, VerificationResult> {
  constructor() {
    super('Verification', 'verification_failed');
    
    // Register the verification workflow definition with the engine
    if (!workflowEngine.hasWorkflow('verification-workflow')) {
      workflowEngine.registerWorkflow(verificationWorkflowDefinition);
      logger.info('Registered verification workflow with engine');
    }
  }
  
  /**
   * Initialize verification process using workflow engine
   * Returns Result<VerificationResult> for consistent error handling
   */
  async initiateVerification(
    workflowId: string,
    options: VerificationOptions
  ): Promise<Result<VerificationResult>> {
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'WORKFLOW_INVALID_ID',
        { options }
      );
    }
    
    if (!options.documentId) {
      return Result.failure(
        'Document ID is required',
        'DOCUMENT_INVALID_ID',
        { workflowId }
      );
    }
    
    if (!options.userId) {
      return Result.failure(
        'User ID is required',
        'USER_INVALID_ID',
        { workflowId, documentId: options.documentId }
      );
    }
    
    try {
      // Get or create workflow instance
      let workflowInstance = await workflowEngine.getWorkflow(workflowId).catch(() => null);
      
      if (!workflowInstance) {
        // Create a new workflow instance
        const createResult = await workflowEngine.createWorkflow(
          'verification-workflow',
          workflowId,
          {
            userId: options.userId,
            documentId: options.documentId,
            autoGenerateReport: options.autoGenerateReport
          }
        );
        
        if (createResult.isFailure()) {
          return Result.failure(
            `Failed to create verification workflow: ${createResult.error.message}`,
            createResult.error.code,
            createResult.error.details
          );
        }
        
        workflowInstance = createResult.value;
      }
      
      // Set up progress tracking
      const progressCallback = options.onProgress || (() => {});
      const transactionId = options.transactionId || crypto.randomUUID();
      
      // Create an action to initiate verification
      const action: WorkflowAction = {
        type: 'INITIATE_VERIFICATION',
        payload: {
          userId: options.userId,
          documentId: options.documentId,
          documentText: typeof options.documentData === 'string'
            ? options.documentData
            : options.documentData.content || JSON.stringify(options.documentData),
          patientId: options.documentData.patientId,
          autoGenerateReport: options.autoGenerateReport,
          documentMetadata: options.documentData
        },
        meta: {
          transactionId,
          userId: options.userId
        }
      };
      
      // First update progress to indicate start
      progressCallback(10, ProcessingPhase.VERIFICATION);
      
      // Send the action to the workflow engine
      const actionResult = await workflowEngine.sendAction(workflowId, action, {
        transactionId,
        userId: options.userId
      });
      
      if (actionResult.isFailure()) {
        return Result.failure(
          `Failed to initiate verification: ${actionResult.error.message}`,
          actionResult.error.code,
          actionResult.error.details
        );
      }
      
      // Update progress to indicate pre-processing
      progressCallback(50, ProcessingPhase.VERIFICATION);
      
      // Prepare verification requires another action
      const prepareAction: WorkflowAction = {
        type: 'PREPARE_VERIFICATION',
        payload: {
          summary: typeof options.documentData === 'string'
            ? options.documentData
            : options.documentData.content || JSON.stringify(options.documentData),
          structuredData: typeof options.documentData === 'object' ? options.documentData : undefined
        },
        meta: {
          transactionId,
          userId: options.userId
        }
      };
      
      // Send the prepare action
      const prepareResult = await workflowEngine.sendAction(workflowId, prepareAction, {
        transactionId,
        userId: options.userId
      });
      
      if (prepareResult.isFailure()) {
        return Result.failure(
          `Failed to prepare verification: ${prepareResult.error.message}`,
          prepareResult.error.code,
          prepareResult.error.details
        );
      }
      
      // Final progress update
      progressCallback(100, ProcessingPhase.VERIFICATION_PENDING);
      
      // Get updated workflow state
      const currentWorkflow = prepareResult.value;
      
      // Return verification result
      return Result.success({
        verificationId: currentWorkflow.context.verificationId,
        documentId: options.documentId,
        summaryId: currentWorkflow.context.summaryId,
        success: true,
        data: currentWorkflow.context.verificationMetadata,
        metadata: {
          status: currentWorkflow.context.status,
          createdAt: currentWorkflow.context.startedAt,
          userId: options.userId,
          currentSummary: currentWorkflow.context.currentSummary
        }
      });
    } catch (error) {
      // Handle unexpected errors
      const normalizedError = normalizeError(error);
      logger.error('Error initiating verification with workflow engine', {
        workflowId,
        documentId: options.documentId,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Verification initialization failed: ${normalizedError.message}`,
        normalizedError.code || 'VERIFICATION_INITIALIZATION_ERROR',
        {
          workflowId,
          documentId: options.documentId,
          ...normalizedError.data
        }
      );
    }
  }
  
  /**
   * Process verification correction using workflow engine
   * Returns Result<VerificationResult> for consistent error handling
   */
  async processCorrection(
    workflowId: string,
    verificationId: string,
    correction: CorrectionData
  ): Promise<Result<VerificationResult>> {
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'WORKFLOW_INVALID_ID',
        { verificationId }
      );
    }
    
    if (!verificationId) {
      return Result.failure(
        'Verification ID is required',
        'VERIFICATION_INVALID_ID',
        { workflowId }
      );
    }
    
    if (!correction || !correction.userId) {
      return Result.failure(
        'Valid correction data with user ID is required',
        'CORRECTION_DATA_INVALID',
        { workflowId, verificationId }
      );
    }
    
    try {
      // Get current workflow state
      const workflowResult = await workflowEngine.getWorkflow(workflowId);
      
      if (workflowResult.isFailure()) {
        return Result.failure(
          `Failed to get workflow state: ${workflowResult.error.message}`,
          workflowResult.error.code,
          workflowResult.error.details
        );
      }
      
      const workflow = workflowResult.value;
      
      // Verify verification ID
      if (workflow.context.verificationId !== verificationId) {
        return Result.failure(
          'Verification ID mismatch',
          'VERIFICATION_ID_MISMATCH',
          {
            workflowId,
            verificationId,
            currentVerificationId: workflow.context.verificationId
          }
        );
      }
      
      // Create an action for the correction
      const transactionId = crypto.randomUUID();
      const action: WorkflowAction = {
        type: 'SUBMIT_CORRECTION',
        payload: {
          correctionText: correction.userComments || 'User correction',
          correctionFields: correction.correctedFields,
          versionId: correction.versionId
        },
        meta: {
          transactionId,
          userId: correction.userId
        }
      };
      
      // Send the action to the workflow engine
      const actionResult = await workflowEngine.sendAction(workflowId, action, {
        transactionId,
        userId: correction.userId
      });
      
      if (actionResult.isFailure()) {
        return Result.failure(
          `Failed to process correction: ${actionResult.error.message}`,
          actionResult.error.code,
          actionResult.error.details
        );
      }
      
      // The workflow engine has updated the state, now retrieve the current summary
      const currentWorkflow = actionResult.value;
      const documentId = currentWorkflow.context.documentId;
      
      // Return verification result
      return Result.success({
        verificationId,
        documentId: documentId || '',
        summaryId: currentWorkflow.context.summaryId,
        success: true,
        data: {
          correctionCount: currentWorkflow.context.correctionCount,
          correctionHistory: currentWorkflow.context.corrections,
          currentSummary: currentWorkflow.context.currentSummary
        },
        metadata: {
          status: currentWorkflow.context.status,
          lastModifiedAt: new Date().toISOString(),
          userId: correction.userId,
          correctionFields: correction.correctedFields
        }
      });
    } catch (error) {
      // Handle unexpected errors
      const normalizedError = normalizeError(error);
      
      // Check if it's a concurrency error
      if (normalizedError.message.includes('CONCURRENT_MODIFICATION') ||
          normalizedError.code === 'CONCURRENT_MODIFICATION' ||
          normalizedError.message.includes('Version mismatch')) {
        return Result.failure(
          'Another user has modified this verification since you started editing',
          'VERIFICATION_CONCURRENT_MODIFICATION',
          {
            workflowId,
            verificationId,
            userId: correction.userId
          }
        );
      }
      
      return Result.failure(
        `Failed to process verification correction: ${normalizedError.message}`,
        normalizedError.code || 'VERIFICATION_CORRECTION_ERROR',
        {
          workflowId,
          verificationId,
          userId: correction.userId,
          error: normalizedError
        }
      );
    }
  }
  
  /**
   * Complete verification process using workflow engine
   * Returns Result<VerificationResult> for consistent error handling
   */
  async completeVerification(
    workflowId: string,
    verificationId: string,
    userId: string,
    autoGenerateReport: boolean = false
  ): Promise<Result<VerificationResult>> {
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'WORKFLOW_INVALID_ID',
        { verificationId, userId }
      );
    }
    
    if (!verificationId) {
      return Result.failure(
        'Verification ID is required',
        'VERIFICATION_INVALID_ID',
        { workflowId, userId }
      );
    }
    
    if (!userId) {
      return Result.failure(
        'User ID is required',
        'USER_INVALID_ID',
        { workflowId, verificationId }
      );
    }
    
    try {
      // Get current workflow state
      const workflowResult = await workflowEngine.getWorkflow(workflowId);
      
      if (workflowResult.isFailure()) {
        return Result.failure(
          `Failed to get workflow state: ${workflowResult.error.message}`,
          workflowResult.error.code,
          workflowResult.error.details
        );
      }
      
      const workflow = workflowResult.value;
      
      // Verify verification ID
      if (workflow.context.verificationId !== verificationId) {
        return Result.failure(
          'Verification ID mismatch',
          'VERIFICATION_ID_MISMATCH',
          {
            workflowId,
            verificationId,
            currentVerificationId: workflow.context.verificationId
          }
        );
      }
      
      // Create an action to confirm verification
      const transactionId = crypto.randomUUID();
      const action: WorkflowAction = {
        type: 'CONFIRM_VERIFICATION',
        payload: {
          autoGenerateReport
        },
        meta: {
          transactionId,
          userId
        }
      };
      
      // Send the action to the workflow engine
      const actionResult = await workflowEngine.sendAction(workflowId, action, {
        transactionId,
        userId
      });
      
      if (actionResult.isFailure()) {
        return Result.failure(
          `Failed to complete verification: ${actionResult.error.message}`,
          actionResult.error.code,
          actionResult.error.details
        );
      }
      
      // If auto-generate report is enabled, send another action
      if (autoGenerateReport) {
        const reportAction: WorkflowAction = {
          type: 'GENERATE_REPORT',
          payload: {},
          meta: {
            transactionId,
            userId
          }
        };
        
        await workflowEngine.sendAction(workflowId, reportAction, {
          transactionId,
          userId
        });
      }
      
      // The workflow engine has updated the state
      const currentWorkflow = actionResult.value;
      const documentId = currentWorkflow.context.documentId;
      
      // Return verification result
      return Result.success({
        verificationId,
        documentId: documentId || '',
        summaryId: currentWorkflow.context.summaryId,
        success: true,
        data: currentWorkflow.context.verificationMetadata,
        metadata: {
          status: 'completed',
          completedAt: currentWorkflow.context.completedAt,
          userId,
          autoGenerateReport
        }
      });
    } catch (error) {
      // Handle unexpected errors
      const normalizedError = normalizeError(error);
      
      // Check if it's a concurrency error
      if (normalizedError.message.includes('CONCURRENT_MODIFICATION') ||
          normalizedError.code === 'CONCURRENT_MODIFICATION') {
        return Result.failure(
          'This verification was modified by another user while you were completing it',
          'VERIFICATION_CONCURRENT_MODIFICATION',
          {
            workflowId,
            verificationId,
            userId
          }
        );
      }
      
      return Result.failure(
        `Failed to complete verification: ${normalizedError.message}`,
        normalizedError.code || 'VERIFICATION_COMPLETION_ERROR',
        {
          workflowId,
          verificationId,
          userId,
          autoGenerateReport,
          error: normalizedError
        }
      );
    }
  }
  
  /**
   * Reject verification (mark as failed) using workflow engine
   * Returns Result<VerificationResult> for consistent error handling
   */
  async rejectVerification(
    workflowId: string,
    verificationId: string,
    userId: string,
    reason: string
  ): Promise<Result<VerificationResult>> {
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'WORKFLOW_INVALID_ID',
        { verificationId, userId, reason }
      );
    }
    
    if (!verificationId) {
      return Result.failure(
        'Verification ID is required',
        'VERIFICATION_INVALID_ID',
        { workflowId, userId, reason }
      );
    }
    
    if (!userId) {
      return Result.failure(
        'User ID is required',
        'USER_INVALID_ID',
        { workflowId, verificationId, reason }
      );
    }
    
    if (!reason) {
      return Result.failure(
        'Rejection reason is required',
        'REJECTION_REASON_MISSING',
        { workflowId, verificationId, userId }
      );
    }
    
    try {
      // Get current workflow state
      const workflowResult = await workflowEngine.getWorkflow(workflowId);
      
      if (workflowResult.isFailure()) {
        return Result.failure(
          `Failed to get workflow state: ${workflowResult.error.message}`,
          workflowResult.error.code,
          workflowResult.error.details
        );
      }
      
      const workflow = workflowResult.value;
      
      // Verify verification ID
      if (workflow.context.verificationId !== verificationId) {
        return Result.failure(
          'Verification ID mismatch',
          'VERIFICATION_ID_MISMATCH',
          {
            workflowId,
            verificationId,
            currentVerificationId: workflow.context.verificationId
          }
        );
      }
      
      // Create an action to reject verification
      const transactionId = crypto.randomUUID();
      const action: WorkflowAction = {
        type: 'REJECT_VERIFICATION',
        payload: {
          reason
        },
        meta: {
          transactionId,
          userId
        }
      };
      
      // Send the action to the workflow engine
      const actionResult = await workflowEngine.sendAction(workflowId, action, {
        transactionId,
        userId
      });
      
      if (actionResult.isFailure()) {
        return Result.failure(
          `Failed to reject verification: ${actionResult.error.message}`,
          actionResult.error.code,
          actionResult.error.details
        );
      }
      
      // The workflow engine has updated the state
      const currentWorkflow = actionResult.value;
      const documentId = currentWorkflow.context.documentId;
      
      // Return verification result
      return Result.success({
        verificationId,
        documentId: documentId || '',
        success: false,
        data: {
          rejectionReason: reason
        },
        metadata: {
          status: 'rejected',
          rejectedAt: currentWorkflow.context.completedAt,
          userId,
          reason
        }
      });
    } catch (error) {
      // Handle unexpected errors
      const normalizedError = normalizeError(error);
      
      // Check if it's a concurrency error
      if (normalizedError.message.includes('CONCURRENT_MODIFICATION') ||
          normalizedError.code === 'CONCURRENT_MODIFICATION') {
        return Result.failure(
          'This verification was modified by another user while you were rejecting it',
          'VERIFICATION_CONCURRENT_MODIFICATION',
          {
            workflowId,
            verificationId,
            userId
          }
        );
      }
      
      return Result.failure(
        `Failed to reject verification: ${normalizedError.message}`,
        normalizedError.code || 'VERIFICATION_REJECTION_ERROR',
        {
          workflowId,
          verificationId,
          userId,
          reason,
          error: normalizedError
        }
      );
    }
  }
  
  /**
   * Get verification status using workflow engine
   * Returns Result<VerificationResult | null> for consistent error handling
   */
  async getVerificationStatus(
    workflowId: string,
    verificationId: string
  ): Promise<Result<VerificationResult | null>> {
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'WORKFLOW_INVALID_ID',
        { verificationId }
      );
    }
    
    if (!verificationId) {
      return Result.failure(
        'Verification ID is required',
        'VERIFICATION_INVALID_ID',
        { workflowId }
      );
    }
    
    try {
      // Get workflow state using workflow engine
      const workflowResult = await workflowEngine.getWorkflow(workflowId);
      
      if (workflowResult.isFailure()) {
        // If workflow not found, it's not an error for this method
        if (workflowResult.error.code === 'WORKFLOW_NOT_FOUND') {
          return Result.success(null);
        }
        
        return Result.failure(
          `Failed to retrieve workflow state: ${workflowResult.error.message}`,
          workflowResult.error.code,
          { workflowId, verificationId }
        );
      }
      
      const workflow = workflowResult.value;
      
      // Check if verification ID matches
      if (workflow.context.verificationId !== verificationId) {
        // Try to find in event history
        try {
          const events = await workflowEventSourcing.getEventHistory(workflowId, {
            eventType: [
              'verification_started',
              'verification_updated',
              'verification_completed',
              'verification_failed'
            ]
          });
          
          // Find event with this verification ID
          for (const event of events) {
            if (event.event_data?.verificationId === verificationId) {
              // Return basic info from event
              return Result.success({
                verificationId,
                documentId: event.event_data.documentId || '',
                success: event.event_type === 'verification_completed',
                metadata: {
                  status: this.mapEventTypeToStatus(event.event_type),
                  timestamp: event.occurred_at,
                  eventType: event.event_type,
                  ...event.event_data
                }
              });
            }
          }
        } catch (error) {
          // We can ignore errors in history lookup
          logger.warn('Failed to lookup verification in event history', {
            workflowId,
            verificationId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        
        // Not an error, just no data found with this ID
        return Result.success(null);
      }
      
      // Determine status based on workflow state
      const success = workflow.currentState === 'verification_completed';
      const documentId = workflow.context.documentId;
      
      if (!documentId) {
        // This is unexpected but not an error - just incomplete data
        return Result.success(null);
      }
      
      // Return verification status wrapped in a success Result
      return Result.success({
        verificationId,
        documentId,
        summaryId: workflow.context.summaryId,
        success,
        data: workflow.context.verificationMetadata,
        metadata: {
          status: workflow.context.status,
          currentState: workflow.currentState,
          ...workflow.context
        }
      });
    } catch (error) {
      // Convert unexpected errors to Result failures
      const normalizedError = normalizeError(error);
      logger.error('Failed to get verification status', {
        workflowId,
        verificationId,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to get verification status: ${normalizedError.message}`,
        normalizedError.code || 'VERIFICATION_STATUS_ERROR',
        {
          workflowId,
          verificationId,
          error: normalizedError
        }
      );
    }
  }
  
  /**
   * Reset verification to idle state using workflow engine
   */
  async resetVerification(
    workflowId: string
  ): Promise<Result<boolean>> {
    try {
      // Get workflow state
      const workflowResult = await workflowEngine.getWorkflow(workflowId);
      
      if (workflowResult.isFailure()) {
        // If workflow not found, there's nothing to reset
        if (workflowResult.error.code === 'WORKFLOW_NOT_FOUND') {
          return Result.success(true);
        }
        
        return Result.failure(
          `Failed to retrieve workflow state: ${workflowResult.error.message}`,
          workflowResult.error.code,
          { workflowId }
        );
      }
      
      // Create an action to reset verification
      const action: WorkflowAction = {
        type: 'RESET_VERIFICATION',
        payload: {}
      };
      
      // Send the action to the workflow engine
      const actionResult = await workflowEngine.sendAction(workflowId, action);
      
      if (actionResult.isFailure()) {
        return Result.failure(
          `Failed to reset verification: ${actionResult.error.message}`,
          actionResult.error.code,
          actionResult.error.details
        );
      }
      
      return Result.success(true);
    } catch (error) {
      // Convert unexpected errors to Result failures
      const normalizedError = normalizeError(error);
      logger.error('Failed to reset verification', {
        workflowId,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to reset verification: ${normalizedError.message}`,
        normalizedError.code || 'VERIFICATION_RESET_ERROR',
        {
          workflowId,
          error: normalizedError
        }
      );
    }
  }
  
  /**
   * Implement required abstract method for domain-specific processing
   * Now delegates to workflow engine
   */
  protected async doProcess(
    workflowId: string,
    input: VerificationOptions,
    currentState: WorkflowState,
    options: WorkflowProcessOptions & {
      progressCallback?: (progress: number, phase: ProcessingPhase) => void;
    }
  ): Promise<VerificationResult> {
    const { userId, documentId, documentData, autoGenerateReport } = input;
    const progressCallback = options.progressCallback || (() => {});
    
    try {
      // Get or create workflow instance
      let workflowInstance = await workflowEngine.getWorkflow(workflowId)
        .then(result => result.isSuccess() ? result.value : null)
        .catch(() => null);
      
      if (!workflowInstance) {
        // Create a new workflow instance
        const createResult = await workflowEngine.createWorkflow(
          'verification-workflow',
          workflowId,
          {
            userId,
            documentId,
            autoGenerateReport
          }
        );
        
        if (createResult.isFailure()) {
          throw new Error(`Failed to create workflow: ${createResult.error.message}`);
        }
        
        workflowInstance = createResult.value;
      }
      
      // Create appropriate action based on current state
      const transactionId = options.transactionId || crypto.randomUUID();
      let action: WorkflowAction;
      
      // Determine the appropriate action based on the current step
      if (currentState.currentStep === 'idle' ||
          currentState.currentStep === 'verification_pending' ||
          currentState.currentStep === 'extracting') {
        // For verification initialization
        action
===
    </search>
    <content>
===
  /**
   * Implement required abstract method for domain-specific processing
   * Now delegates to workflow engine
   */
  protected async doProcess(
    workflowId: string,
    input: VerificationOptions,
    currentState: WorkflowState,
    options: WorkflowProcessOptions & {
      progressCallback?: (progress: number, phase: ProcessingPhase) => void;
    }
  ): Promise<VerificationResult> {
    const { userId, documentId, documentData, autoGenerateReport } = input;
    const progressCallback = options.progressCallback || (() => {});
    
    try {
      // Get or create workflow instance
      let workflowInstance = await workflowEngine.getWorkflow(workflowId)
        .then(result => result.isSuccess() ? result.value : null)
        .catch(() => null);
      
      if (!workflowInstance) {
        // Create a new workflow instance
        const createResult = await workflowEngine.createWorkflow(
          'verification-workflow',
          workflowId,
          {
            userId,
            documentId,
            autoGenerateReport
          }
        );
        
        if (createResult.isFailure()) {
          throw new Error(`Failed to create workflow: ${createResult.error.message}`);
        }
        
        workflowInstance = createResult.value;
      }
      
      // Create appropriate action based on current state
      const transactionId = options.transactionId || crypto.randomUUID();
      let action: WorkflowAction;
      
      // Determine the appropriate action based on the current step
      if (currentState.currentStep === 'idle' ||
          currentState.currentStep === 'verification_pending' ||
          currentState.currentStep === 'extracting') {
        // For verification initialization
        action = {
          type: 'INITIATE_VERIFICATION',
          payload: {
            userId,
            documentId,
            documentText: typeof documentData === 'string'
              ? documentData
              : documentData.content || JSON.stringify(documentData),
            patientId: documentData.patientId,
            autoGenerateReport,
            documentMetadata: documentData
          },
          meta: {
            transactionId,
            userId
          }
        };
        
        // Update progress
        progressCallback(20, ProcessingPhase.VERIFICATION);
      }
      else if (currentState.currentStep === 'verification_in_progress' &&
               documentData.correctionData) {
        // For correction processing
        const correction = documentData.correctionData as CorrectionData;
        
        action = {
          type: 'SUBMIT_CORRECTION',
          payload: {
            correctionText: correction.userComments || 'User correction',
            correctionFields: correction.correctedFields,
            versionId: correction.versionId
          },
          meta: {
            transactionId,
            userId: correction.userId || userId
          }
        };
        
        // Update progress
        progressCallback(20, ProcessingPhase.VERIFICATION_PROCESSING);
      }
      else if (currentState.currentStep === 'verification_in_progress' &&
               documentData.status === 'completed') {
        // For verification completion
        action = {
          type: 'CONFIRM_VERIFICATION',
          payload: {
            autoGenerateReport
          },
          meta: {
            transactionId,
            userId
          }
        };
        
        // Update progress
        progressCallback(30, ProcessingPhase.VERIFICATION_COMPLETION);
      }
      else if ((currentState.currentStep === 'verification_in_progress' ||
                currentState.currentStep === 'verification_pending') &&
               documentData.status === 'rejected') {
        // For verification rejection
        const reason = documentData.rejectionReason as string;
        
        action = {
          type: 'REJECT_VERIFICATION',
          payload: {
            reason: reason || 'Verification rejected by user'
          },
          meta: {
            transactionId,
            userId
          }
        };
        
        // Update progress
        progressCallback(40, ProcessingPhase.VERIFICATION_REJECTION);
      }
      else {
        // Unsupported operation
        throw new ApplicationError({
          message: 'Unsupported verification operation',
          code: 'UNSUPPORTED_VERIFICATION_OPERATION',
          data: {
            currentStep: currentState.currentStep,
            documentData
          }
        });
      }
      
      // Send the action to the workflow engine
      const actionResult = await workflowEngine.sendAction(workflowId, action, {
        transactionId,
        userId
      });
      
      if (actionResult.isFailure()) {
        throw new Error(`Failed to process verification action: ${actionResult.error.message}`);
      }
      
      // Update progress halfway
      progressCallback(70, ProcessingPhase.VERIFICATION);
      
      // For verification initialization, we need to prepare it too
      if (action.type === 'INITIATE_VERIFICATION') {
        // Prepare verification with another action
        const prepareAction: WorkflowAction = {
          type: 'PREPARE_VERIFICATION',
          payload: {
            summary: typeof documentData === 'string'
              ? documentData
              : documentData.content || JSON.stringify(documentData),
            structuredData: typeof documentData === 'object' ? documentData : undefined
          },
          meta: {
            transactionId,
            userId
          }
        };
        
        // Send the prepare action
        const prepareResult = await workflowEngine.sendAction(workflowId, prepareAction, {
          transactionId,
          userId
        });
        
        if (prepareResult.isFailure()) {
          throw new Error(`Failed to prepare verification: ${prepareResult.error.message}`);
        }
        
        // Use the updated instance after prepare
        workflowInstance = prepareResult.value;
      } else {
        // For other actions, use the result from the first action
        workflowInstance = actionResult.value;
      }
      
      // Final progress update
      progressCallback(100, ProcessingPhase.VERIFICATION);
      
      // Extract data from workflow state
      const verificationId = workflowInstance.context.verificationId;
      const summaryId = workflowInstance.context.summaryId;
      const currentSummary = workflowInstance.context.currentSummary;
      const status = workflowInstance.context.status;
      const verificationMetadata = workflowInstance.context.verificationMetadata;
      
      // Create appropriate result based on action type
      if (action.type === 'INITIATE_VERIFICATION') {
        return {
          verificationId,
          documentId,
          summaryId,
          success: true,
          data: verificationMetadata || {},
          metadata: {
            status,
            createdAt: workflowInstance.context.startedAt,
            userId,
            currentSummary
          }
        };
      }
      else if (action.type === 'SUBMIT_CORRECTION') {
        return {
          verificationId,
          documentId,
          summaryId,
          success: true,
          data: {
            correctionCount: workflowInstance.context.correctionCount,
            correctionHistory: workflowInstance.context.corrections,
            currentSummary
          },
          metadata: {
            status,
            lastModifiedAt: new Date().toISOString(),
            userId,
            verificationMetadata
          }
        };
      }
      else if (action.type === 'CONFIRM_VERIFICATION') {
        return {
          verificationId,
          documentId,
          summaryId,
          success: true,
          data: verificationMetadata || {},
          metadata: {
            status,
            completedAt: workflowInstance.context.completedAt,
            userId,
            autoGenerateReport
          }
        };
      }
      else if (action.type === 'REJECT_VERIFICATION') {
        return {
          verificationId,
          documentId,
          summaryId,
          success: false,
          data: {
            rejectionReason: action.payload.reason
          },
          metadata: {
            status,
            rejectedAt: workflowInstance.context.completedAt,
            userId,
            reason: action.payload.reason
          }
        };
      }
      
      // Default response if none of the specific cases apply
      return {
        verificationId: verificationId || '',
        documentId,
        summaryId,
        success: true,
        data: workflowInstance.context,
        metadata: {
          status,
          workflowState: workflowInstance.currentState,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      // Handle unexpected errors
      const normalizedError = normalizeError(error);
      logger.error('Error in verification workflow processing', {
        workflowId,
        documentId,
        error: normalizedError.message
      });
      
      // Create error result (backward compatibility)
      return {
        verificationId: '',
        documentId,
        success: false,
        metadata: {
          error: normalizedError.message,
          code: normalizedError.code || 'VERIFICATION_ERROR',
          userId
        },
        error: normalizedError.message
      };
    }
  }