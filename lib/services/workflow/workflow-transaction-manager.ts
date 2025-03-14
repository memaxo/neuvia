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
 * 
 * This is a simplified version that delegates responsibilities to specialized components:
 * - TransactionExecutor: Handles core transaction execution and retry logic
 * - ProgressTracker: Manages progress updates and notifications
 * - ConcurrencyStrategy: Handles concurrency control and conflict resolution
 */

import { ApplicationError, normalizeError } from '@/lib/errors';
import logger from '@/lib/logger';
import { workflowService } from './core/workflow-service';
import { simpleTransactionManager, SimpleTransactionOptions, SimpleTransactionResult } from './transaction/simple-transaction-manager';
import { transactionExecutor } from './transaction/transaction-executor';
import { createProgressTracker } from './transaction/progress-tracker';
import { concurrencyStrategy } from './transaction/concurrency-strategy';

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
 * Delegates to specialized components for specific responsibilities
 */
export class WorkflowTransactionManager {
  private readonly logger = logger.withMetadata({ module: 'WorkflowTransactionManager' });
  
  /**
   * Execute a simple transaction with minimal configuration
   * Delegates to SimpleTransactionManager for streamlined processing
   */
  async executeSimpleTransaction<T>(
    workflowId: string,
    operation: () => Promise<T>,
    options: SimpleTransactionOptions = {}
  ): Promise<SimpleTransactionResult<T>> {
    return simpleTransactionManager.executeTransaction(
      workflowId,
      operation,
      options
    );
  }
  
  /**
   * Execute a read-only transaction (no state changes)
   */
  async executeReadTransaction<T>(
    workflowId: string,
    operation: () => Promise<T>
  ): Promise<SimpleTransactionResult<T>> {
    return simpleTransactionManager.executeReadTransaction(
      workflowId,
      operation
    );
  }
  
  /**
   * Check if a transaction can be simplified
   */
  private isSimpleTransaction(options: TransactionOptions): boolean {
    // Simple transactions don't need complex features
    return !options.maxRetries &&
           !options.isRecoverableError &&
           !options.withNotifications &&
           options.onProgress === undefined;
  }
  
  /**
   * Execute a workflow operation with proper transaction handling
   * This simplified implementation delegates to specialized components
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
    // Auto-detect and delegate simple transactions
    if (this.isSimpleTransaction(options)) {
      return this.handleSimpleTransaction(workflowId, operation, options);
    }
    
    // For complex transactions, delegate to specialized components
    const transactionId = options.transactionId || crypto.randomUUID();
    const startTime = Date.now();
    let retryCount = 0;
    
    // Initialize transaction logger
    const { log: logTransaction, getLogs } = transactionExecutor.createTransactionLogger(transactionId);
    
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
      await concurrencyStrategy.updateStateWithConcurrencyControl(
        workflowId,
        options.step,
        transactionMetadata,
        {
          skipValidation: options.skipValidation,
          strategy: options.conflictStrategy
        }
      );
      
      // Create progress tracker
      const progressTracker = createProgressTracker({
        workflowId,
        transactionId,
        step: options.step,
        withNotifications: options.withNotifications,
        chatId: options.chatId,
        onProgress: options.onProgress,
        logger: logTransaction
      });
      
      // Set initial progress
      await progressTracker.updateProgress(5, ProcessingPhase.INITIALIZATION);
      
      // Execute the operation with retry
      const result = await transactionExecutor.executeWithRetry(
        async () => operation(
          progressTracker.createProgressCallback(), 
          transactionId
        ),
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
      await progressTracker.updateProgress(100, ProcessingPhase.COMPLETION);
      
      // Update workflow state for completion
      await progressTracker.updateCompletion(true);
      
      // Fetch final workflow state
      const finalState = await workflowService.getWorkflowState(workflowId);
      
      // Return operation result with transaction details
      return {
        data: result,
        transactionId,
        workflowState: finalState,
        metrics: {
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
          retryCount
        },
        logs: getLogs()
      };
      
    } catch (error) {
      // Handle transaction failure
      await transactionExecutor.handleTransactionFailure(
        workflowId,
        transactionId,
        error,
        {
          step: options.step,
          recoveryStep: options.recoveryStep,
          startTime,
          withNotifications: options.withNotifications,
          chatId: options.chatId,
          logger: { log: logTransaction, getLogs }
        }
      );
      
      // Create enhanced error with transaction details
      const enhancedError = transactionExecutor.createEnhancedError(
        error,
        {
          transactionId,
          workflowId,
          step: options.step,
          logs: getLogs(),
          metrics: {
            startTime,
            endTime: Date.now(),
            duration: Date.now() - startTime,
            retryCount
          }
        }
      );
      
      throw enhancedError;
    }
  }
  
  /**
   * Handle simple transaction (delegated to SimpleTransactionManager)
   */
  private async handleSimpleTransaction<T>(
    workflowId: string,
    operation: (
      progressCallback: (progress: number, phase: ProcessingPhase) => void,
      transactionId: string
    ) => Promise<T>,
    options: TransactionOptions
  ): Promise<TransactionResult<T>> {
    const simpleResult = await this.executeSimpleTransaction(
      workflowId,
      async () => {
        // Simple progress callback
        const progressCallback = (progress: number, phase: ProcessingPhase) => {
          if (options.onProgress) {
            options.onProgress(progress, phase);
          }
        };
        
        // Execute operation with simplified interface
        return operation(progressCallback, options.transactionId || crypto.randomUUID());
      },
      {
        step: options.step,
        errorStep: options.recoveryStep || DomainOnlyWorkflowStep.ERROR,
        metadata: options.metadata,
        transactionId: options.transactionId
      }
    );
    
    // Convert to full transaction result format
    if (simpleResult.success) {
      return {
        data: simpleResult.data,
        transactionId: simpleResult.transactionId,
        workflowState: await workflowService.getWorkflowState(workflowId),
        metrics: {
          startTime: Date.now() - 1000, // Approximate
          endTime: Date.now(),
          duration: 1000, // Approximate
          retryCount: 0
        },
        logs: []
      };
    } else {
      throw new Error(simpleResult.error);
    }
  }
}

// Export singleton instance
export const workflowTransactionManager = new WorkflowTransactionManager();