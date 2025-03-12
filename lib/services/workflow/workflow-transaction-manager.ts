/**
 * @fileoverview Workflow Transaction Manager
 *
 * Provides reliable transaction management for complex workflow operations
 * that require coordination between multiple services and atomic updates.
 *
 * Features:
 * - Atomic operation execution with proper error handling
 * - Automatic progress tracking and notifications
 * - Transaction logging for audit trails
 * - Built-in recovery mechanisms
 */

import { workflowService } from './core/workflow-service';
import { eventService } from '@/lib/services/event-service';
import { ApplicationError, normalizeError } from '@/lib/errors';
import { EVENT_TYPES } from '@/lib/types/events';
import logger from '@/lib/logger';

import type { WorkflowStep, ProcessingPhase, WorkflowState } from '@/lib/types/workflow';
import { DomainOnlyWorkflowStep } from '@/lib/types/workflow';

/**
 * Transaction options for workflow operations
 */
export interface TransactionOptions {
  /** Starting workflow step */
  step: WorkflowStep;
  
  /** Initial metadata for the transaction */
  metadata?: Record<string, unknown>;
  
  /** Progress update handler */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
  
  /** Recovery step to use if operation fails */
  recoveryStep?: WorkflowStep;
  
  /** Send chat notifications for progress updates */
  withNotifications?: boolean;
  
  /** Chat ID for notifications */
  chatId?: string;
  
  /** Unique transaction ID (generated automatically if not provided) */
  transactionId?: string;
  
  /** Conflict resolution strategy */
  conflictStrategy?: 'fail' | 'force' | 'merge';
  
  /** Whether to skip validation of workflow transitions */
  skipValidation?: boolean;
  
  /** Maximum retry count for recoverable errors */
  maxRetries?: number;
  
  /** Method to determine if error is recoverable */
  isRecoverableError?: (error: unknown) => boolean;
}

/**
 * Transaction result with execution details
 */
export interface TransactionResult<T> {
  /** Operation result data */
  data: T;
  
  /** Transaction ID */
  transactionId: string;
  
  /** Current workflow state after transaction */
  workflowState?: WorkflowState;
  
  /** Transaction execution metrics */
  metrics: {
    startTime: number;
    endTime: number;
    duration: number;
    retryCount: number;
  };
  
  /** Transaction log entries */
  logs: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    data?: Record<string, unknown>;
  }>;
}

/**
 * Class for managing workflow transactions with atomicity and recovery
 */
export class WorkflowTransactionManager {
  private readonly logger = logger.withMetadata({ module: 'WorkflowTransactionManager' });
  
  /**
   * Execute a workflow operation with proper transaction handling
   *
   * @param workflowId Workflow ID
   * @param operation Function that performs the operation
   * @param options Transaction options
   * @returns Operation result with transaction details
   */
  async executeTransaction<T>(
    workflowId: string,
    operation: (
      progressCallback: (progress: number, phase: ProcessingPhase) => void,
      transactionId: string
    ) => Promise<T>,
    options: TransactionOptions
  ): Promise<TransactionResult<T>> {
    const transactionId = options.transactionId || crypto.randomUUID();
    const startTime = Date.now();
    let retryCount = 0;
    
    // Initialize transaction log
    const transactionLogs: Array<{
      timestamp: string;
      level: 'info' | 'warn' | 'error';
      message: string;
      data?: Record<string, unknown>;
    }> = [];
    
    // Helper to add log entries
    const logTransaction = (
      level: 'info' | 'warn' | 'error',
      message: string,
      data?: Record<string, unknown>
    ) => {
      const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        data
      };
      transactionLogs.push(entry);
      
      if (level === 'info') {
        this.logger.info(message, data);
      } else if (level === 'warn') {
        this.logger.warn(message, data);
      } else {
        this.logger.error(message, data || {});
      }
    };
    
    // Create transaction metadata
    const transactionMetadata = {
      transactionId,
      startedAt: new Date().toISOString(),
      ...(options.metadata || {})
    };
    
    try {
      // Log transaction start
      logTransaction('info', 'Starting workflow transaction', {
        workflowId,
        transactionId,
        step: options.step
      });
      
      // Start the transaction with event logging
      await workflowService.logWorkflowEvent(
        workflowId,
        'transaction_started',
        {
          transactionId,
          step: options.step,
          timestamp: new Date().toISOString(),
          metadata: options.metadata || {}
        }
      );
      
      // Update workflow step with transaction info
      await workflowService.updateWorkflowState(
        workflowId,
        options.step,
        transactionMetadata,
        {
          skipValidation: options.skipValidation,
          conflictStrategy: options.conflictStrategy as any
        }
      );
      
      // Create progress tracking function
      let lastProgress = 0;
      let lastPhase: ProcessingPhase | undefined;
      
      const progressCallback = async (progress: number, phase: ProcessingPhase) => {
        // Skip duplicate updates
        if (progress === lastProgress && phase === lastPhase) {
          return;
        }
        
        lastProgress = progress;
        lastPhase = phase;
        
        // Log significant progress changes
        if (progress % 20 === 0 || progress === 100) {
          logTransaction('info', `Transaction progress: ${progress}%`, {
            transactionId,
            progress,
            phase: phase.toString()
          });
        }
        
        // Update workflow progress
        try {
          if (options.withNotifications && options.chatId) {
            // With notification message
            await workflowService.updateWithChatMessage(
              workflowId,
              options.step,
              {
                transactionId,
                progress,
                phase: phase.toString(),
                timestamp: new Date().toISOString()
              },
              `Operation progress: ${progress}% (${phase})`,
              'system',
              {
                type: 'progress_update',
                transactionId,
                progress,
                phase: phase.toString()
              }
            );
          } else {
            // Without notification
            await workflowService.updateProgress(
              workflowId,
              progress,
              phase,
              options.step
            );
          }
        } catch (progressError) {
          logTransaction('warn', 'Failed to update progress', {
            error: progressError instanceof Error ? progressError.message : String(progressError)
          });
        }
        
        // Call external progress handler if provided
        if (options.onProgress) {
          options.onProgress(progress, phase);
        }
      };
      
      // Set initial progress
      await progressCallback(5, ProcessingPhase.INITIALIZATION);
      
      // Execute the operation
      const result = await this.executeWithRetry(
        async () => operation(progressCallback, transactionId),
        {
          maxRetries: options.maxRetries || 0,
          isRecoverable: options.isRecoverableError,
          onRetry: (error, attemptNumber) => {
            logTransaction('warn', `Retrying operation (attempt ${attemptNumber})`, {
              error: error instanceof Error ? error.message : String(error),
              attemptNumber
            });
            retryCount = attemptNumber;
          }
        }
      );
      
      // Set final progress
      await progressCallback(100, ProcessingPhase.COMPLETION);
      
      // Update workflow step to mark completion
      const finalMetadata = {
        transactionId,
        completedAt: new Date().toISOString(),
        startedAt: new Date(startTime).toISOString(),
        duration: Date.now() - startTime,
        success: true,
        ...(options.metadata || {})
      };
      
      if (options.withNotifications && options.chatId) {
        await workflowService.updateWithChatMessage(
          workflowId,
          options.step,
          finalMetadata,
          `Operation completed successfully`,
          'system',
          {
            type: 'transaction_completed',
            transactionId,
            success: true
          }
        );
      } else {
        await workflowService.updateWorkflowState(
          workflowId,
          options.step,
          finalMetadata
        );
      }
      
      // Log transaction completion
      logTransaction('info', 'Transaction completed successfully', {
        transactionId,
        duration: Date.now() - startTime
      });
      
      // Log completion event
      await workflowService.logWorkflowEvent(
        workflowId,
        'transaction_completed',
        {
          transactionId,
          step: options.step,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          success: true
        }
      );
      
      // Fetch final workflow state
      const finalState = await workflowService.getWorkflowState(workflowId);
      
      // Return operation result with transaction details
      return {
        data: result,
        transactionId,
        workflowState: finalState ? {
          currentStep: finalState.currentStep,
          progress: finalState.progress,
          phase: finalState.phase as ProcessingPhase | undefined,
          error: finalState.error || null,
          metadata: finalState.metadata || {},
          timestamp: finalState.timestamp
        } : undefined,
        metrics: {
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
          retryCount
        },
        logs: transactionLogs
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log transaction failure
      logTransaction('error', 'Transaction failed', {
        transactionId,
        error: errorMessage,
        duration: Date.now() - startTime
      });
      
      // Log failure event
      await workflowService.logWorkflowEvent(
        workflowId,
        'transaction_failed',
        {
          transactionId,
          step: options.step,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          error: errorMessage
        }
      );
      
      // Try to recover using specified recovery step
      const recoveryStep = options.recoveryStep || DomainOnlyWorkflowStep.ERROR;
      let recovered = false;
      
      try {
        recovered = await workflowService.recoverWorkflowState(
          workflowId,
          recoveryStep,
          {
            transactionId,
            error: errorMessage,
            errorTimestamp: new Date().toISOString(),
            originalStep: options.step
          }
        );
        
        if (recovered) {
          logTransaction('info', 'Successfully recovered workflow state', {
            transactionId,
            recoveryStep
          });
        }
      } catch (recoveryError) {
        logTransaction('error', 'Recovery failed', {
          transactionId,
          error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
        });
      }
      
      // If recovery failed or not requested, update to error state
      if (!recovered) {
        try {
          if (options.withNotifications && options.chatId) {
            await workflowService.updateWithChatMessage(
              workflowId,
              DomainOnlyWorkflowStep.ERROR,
              {
                transactionId,
                error: errorMessage,
                errorTimestamp: new Date().toISOString(),
                originalStep: options.step
              },
              `Operation failed: ${errorMessage}`,
              'system',
              {
                type: 'transaction_error',
                transactionId,
                error: errorMessage
              }
            );
          } else {
            await workflowService.updateWorkflowState(
              workflowId,
              DomainOnlyWorkflowStep.ERROR,
              {
                transactionId,
                error: errorMessage,
                errorTimestamp: new Date().toISOString(),
                originalStep: options.step
              },
              { forceUpdate: true }
            );
          }
        } catch (updateError) {
          logTransaction('error', 'Failed to update error state', {
            transactionId,
            error: updateError instanceof Error ? updateError.message : String(updateError)
          });
        }
      }
      
      // Rethrow with transaction details
      const enhancedError = new ApplicationError({
        message: errorMessage,
        code: 'TRANSACTION_FAILED',
        data: {
          transactionId,
          workflowId,
          step: options.step,
          logs: transactionLogs,
          metrics: {
            startTime,
            endTime: Date.now(),
            duration: Date.now() - startTime,
            retryCount
          }
        }
      });
      
      throw enhancedError;
    }
  }
  
  /**
   * Execute an operation with automatic retries for recoverable errors
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries: number;
      isRecoverable?: (error: unknown) => boolean;
      onRetry?: (error: unknown, attemptNumber: number) => void;
      backoffFactor?: number;
      initialDelay?: number;
    }
  ): Promise<T> {
    const {
      maxRetries,
      isRecoverable = (error) => {
        const message = error instanceof Error ? error.message : String(error);
        // Default recoverable errors are network or timeout errors
        return message.toLowerCase().includes('network') ||
               message.toLowerCase().includes('timeout') ||
               message.toLowerCase().includes('connection');
      },
      onRetry,
      backoffFactor = 2,
      initialDelay = 1000
    } = options;
    
    let attemptNumber = 0;
    let lastError: unknown;
    
    while (attemptNumber <= maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Check if we should retry
        if (attemptNumber < maxRetries && isRecoverable(error)) {
          attemptNumber++;
          
          // Notify about retry
          if (onRetry) {
            onRetry(error, attemptNumber);
          }
          
          // Calculate backoff delay
          const delay = initialDelay * Math.pow(backoffFactor, attemptNumber - 1);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Don't retry, just throw
          throw error;
        }
      }
    }
    
    // Should never reach here, but TypeScript requires a return
    throw lastError;
  }
}

// Export singleton instance
export const workflowTransactionManager = new WorkflowTransactionManager();