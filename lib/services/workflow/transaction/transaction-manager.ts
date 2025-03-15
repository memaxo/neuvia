/**
 * @fileoverview Workflow Transaction Manager
 * 
 * PHASE 4 IMPLEMENTATION:
 * Streamlined transaction management with simplified API and standardized error handling.
 * This replaces the previous multi-class transaction hierarchy with a composition-based
 * approach that follows the Result pattern for error handling.
 */

import { workflowRepository } from '../infrastructure/workflow-repository';
import { workflowEventSourcing } from '../infrastructure/workflow-event-source';
import { normalizeError } from '@/lib/errors';
import logger from '@/lib/logger';
import { Result } from '../error/result';

import type { WorkflowStep, ProcessingPhase } from '@/lib/types/workflow';
import { DomainOnlyWorkflowStep } from '@/lib/types/workflow';

/**
 * Options for workflow transactions
 */
export interface TransactionOptions {
  /** Workflow step to set at the start of transaction */
  step?: WorkflowStep;
  
  /** Workflow step to set on error */
  errorStep?: WorkflowStep;
  
  /** Metadata to include in transaction */
  metadata?: Record<string, unknown>;
  
  /** Transaction ID for tracking */
  transactionId?: string;
  
  /** Whether to commit transaction on error */
  commitOnError?: boolean;
  
  /** Domain name for proper error handling */
  domainName?: string;
  
  /** Progress callback function */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
  
  /** Number of retries for transient errors */
  retryCount?: number;
  
  /** Conflict resolution strategy */
  conflictStrategy?: 'fail' | 'force' | 'merge' | 'append' | 'field-specific' | 'optimistic' | 'pessimistic';
}

/**
 * Result of a transaction with metadata
 */
export interface TransactionResult<T> {
  /** Transaction data */
  data: T;
  
  /** Transaction ID */
  transactionId: string;
  
  /** Whether transaction was successful */
  success: boolean;
  
  /** Error information if transaction failed */
  error?: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };
  
  /** Transaction metrics */
  metrics?: {
    startTime: number;
    endTime: number;
    duration: number;
    retryCount: number;
  };
}

/**
 * Streamlined transaction manager with unified API and standardized error handling
 */
export class TransactionManager {
  private readonly logger = logger.withMetadata({ module: 'TransactionManager' });
  
  /**
   * Execute a transaction with proper error handling and event logging
   */
  async executeTransaction<T>(
    workflowId: string,
    operation: (transactionId: string, progressCallback?: (progress: number, phase: ProcessingPhase) => void) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<Result<TransactionResult<T>>> {
    const transactionId = options.transactionId || crypto.randomUUID();
    const startTime = Date.now();
    const now = new Date().toISOString();
    let retryCount = 0;
    
    // Create progress callback if needed
    const progressCallback = options.onProgress 
      ? (progress: number, phase: ProcessingPhase) => {
          // Avoid awaiting to prevent blocking
          this.updateProgress(workflowId, progress, phase, options.step)
            .catch(err => this.logger.warn('Failed to update progress', { 
              error: err instanceof Error ? err.message : String(err)
            }));
          
          // Call the provided callback
          options.onProgress(progress, phase);
        }
      : undefined;
    
    try {
      if (!workflowId) {
        return Result.failure(
          'Workflow ID is required', 
          'INVALID_WORKFLOW_ID'
        );
      }
      
      // Update state if step is provided
      if (options.step) {
        try {
          await workflowRepository.updateWorkflowState(
            workflowId,
            options.step,
            {
              ...options.metadata,
              transactionId,
              startedAt: now,
              domain: options.domainName
            },
            {
              conflictStrategy: options.conflictStrategy || 'merge'
            }
          );
          
          // Log transaction start event
          await workflowEventSourcing.appendEvent(
            workflowId,
            'transaction_started',
            {
              transactionId,
              step: options.step,
              timestamp: now,
              metadata: options.metadata || {},
              domain: options.domainName
            }
          );
        } catch (stateError) {
          return Result.failure(
            `Failed to initialize transaction state: ${normalizeError(stateError).message}`,
            'TRANSACTION_INITIALIZATION_FAILED',
            { workflowId, transactionId, originalError: stateError }
          );
        }
      }
      
      // Set initial progress
      if (progressCallback) {
        progressCallback(5, ProcessingPhase.INITIALIZATION);
      }
      
      // Execute the operation with retry if configured
      let result: T;
      
      if (options.retryCount && options.retryCount > 0) {
        result = await this.executeWithRetry(
          () => operation(transactionId, progressCallback),
          {
            retryCount: options.retryCount,
            onRetry: (attemptNumber) => { retryCount = attemptNumber; }
          }
        );
      } else {
        result = await operation(transactionId, progressCallback);
      }
      
      // Set final progress
      if (progressCallback) {
        progressCallback(100, ProcessingPhase.COMPLETION);
      }
      
      // Log transaction completion event
      await workflowEventSourcing.appendEvent(
        workflowId,
        'transaction_completed',
        {
          transactionId,
          step: options.step,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          success: true,
          domain: options.domainName
        }
      );
      
      return Result.success({
        data: result,
        transactionId,
        success: true,
        metrics: {
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
          retryCount
        }
      });
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Transaction failed', {
        workflowId,
        transactionId,
        step: options.step,
        error: normalizedError.message,
        domain: options.domainName
      });
      
      try {
        // Log transaction failure event
        await workflowEventSourcing.appendEvent(
          workflowId,
          'transaction_failed',
          {
            transactionId,
            step: options.step,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            error: normalizedError.message,
            domain: options.domainName
          }
        );
        
        // Update workflow state to error if requested
        if (options.errorStep) {
          await workflowRepository.updateWorkflowState(
            workflowId,
            options.errorStep,
            {
              error: normalizedError.message,
              errorTimestamp: new Date().toISOString(),
              originalStep: options.step,
              transactionId,
              domain: options.domainName
            },
            { forceUpdate: true }
          );
        }
      } catch (loggingError) {
        // Just log if event logging fails
        this.logger.error('Failed to log transaction failure', {
          workflowId,
          transactionId,
          originalError: normalizedError.message,
          loggingError: loggingError instanceof Error ? loggingError.message : String(loggingError)
        });
      }
      
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'TRANSACTION_FAILED',
        {
          workflowId,
          transactionId,
          step: options.step,
          metrics: {
            startTime,
            endTime: Date.now(),
            duration: Date.now() - startTime,
            retryCount
          },
          ...normalizedError.data
        }
      );
    }
  }
  
  /**
   * Execute a read-only transaction (no state changes)
   */
  async executeReadTransaction<T>(
    workflowId: string,
    operation: () => Promise<T>
  ): Promise<Result<T>> {
    try {
      if (!workflowId) {
        return Result.failure('Workflow ID is required', 'INVALID_WORKFLOW_ID');
      }
      
      // Execute the operation without state changes
      const result = await operation();
      return Result.success(result);
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Read transaction failed', {
        workflowId,
        error: normalizedError.message
      });
      
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'READ_TRANSACTION_FAILED',
        {
          workflowId,
          ...normalizedError.data
        }
      );
    }
  }
  
  /**
   * Execute an operation with retries for transient errors
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      retryCount: number;
      onRetry?: (attemptNumber: number) => void;
      initialDelay?: number;
      backoffFactor?: number;
    }
  ): Promise<T> {
    const {
      retryCount,
      onRetry,
      initialDelay = 500,
      backoffFactor = 1.5
    } = options;
    
    let attemptNumber = 0;
    let lastError: unknown;
    
    while (attemptNumber <= retryCount) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Check if we should retry
        if (attemptNumber < retryCount && this.isRetryableError(error)) {
          attemptNumber++;
          
          // Notify about retry
          if (onRetry) {
            onRetry(attemptNumber);
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
  
  /**
   * Check if an error is retryable (typically network or timeout issues)
   */
  private isRetryableError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    
    // Retry on common transient errors
    return message.toLowerCase().includes('network') ||
           message.toLowerCase().includes('timeout') ||
           message.toLowerCase().includes('connection') ||
           message.toLowerCase().includes('throttle') ||
           message.toLowerCase().includes('rate limit') ||
           message.toLowerCase().includes('try again');
  }
  
  /**
   * Update workflow progress
   */
  private async updateProgress(
    workflowId: string,
    progress: number,
    phase: ProcessingPhase,
    currentStep?: WorkflowStep
  ): Promise<void> {
    try {
      await workflowRepository.updateProgress(
        workflowId,
        progress,
        phase,
        currentStep
      );
    } catch (error) {
      this.logger.warn('Failed to update progress', {
        workflowId,
        progress,
        phase,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

// Export singleton instance
export const transactionManager = new TransactionManager();