/**
 * @fileoverview Transaction Executor
 * 
 * Core component for executing workflow transactions. This handles the
 * fundamental transaction operations including retry logic, error handling,
 * and transaction lifecycle.
 */

import { ApplicationError, normalizeError } from '@/lib/errors';
import logger from '@/lib/logger';
import { workflowService } from '../core/workflow-service';
import { recoveryService, RecoveryStrategy } from '../recovery/recovery-service';

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  
  /** Function to determine if an error is recoverable */
  isRecoverable?: (error: unknown) => boolean;
  
  /** Function called when a retry is attempted */
  onRetry?: (error: unknown, attemptNumber: number) => void;
  
  /** Factor by which to increase delay between retries */
  backoffFactor?: number;
  
  /** Initial delay in milliseconds before first retry */
  initialDelay?: number;
}

/**
 * Transaction log entry
 */
export interface TransactionLogEntry {
  /** Timestamp when the log was created */
  timestamp: string;
  
  /** Log level */
  level: 'info' | 'warn' | 'error';
  
  /** Log message */
  message: string;
  
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Service for executing transactions with retry and error handling capabilities
 */
export class TransactionExecutor {
  private readonly logger = logger.withMetadata({ module: 'TransactionExecutor' });
  
  /**
   * Create transaction log
   */
  createTransactionLogger(transactionId: string): {
    log: (level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) => void;
    getLogs: () => TransactionLogEntry[];
  } {
    const logs: TransactionLogEntry[] = [];
    
    const logTransaction = (
      level: 'info' | 'warn' | 'error',
      message: string,
      data?: Record<string, unknown>
    ) => {
      const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        data: { ...data, transactionId }
      };
      logs.push(entry);
      
      if (level === 'info') {
        this.logger.info(message, entry.data);
      } else if (level === 'warn') {
        this.logger.warn(message, entry.data);
      } else {
        this.logger.error(message, entry.data);
      }
    };
    
    return {
      log: logTransaction,
      getLogs: () => logs
    };
  }
  
  /**
   * Execute operation with retries
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    const {
      maxRetries,
      isRecoverable = this.defaultIsRecoverable,
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
  
  /**
   * Default function to determine if an error is recoverable
   */
  private defaultIsRecoverable(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    // Default recoverable errors are network or timeout errors
    return message.toLowerCase().includes('network') ||
           message.toLowerCase().includes('timeout') ||
           message.toLowerCase().includes('connection');
  }
  
  /**
   * Log transaction failure and attempt recovery using the centralized recovery service
   */
  async handleTransactionFailure(
    workflowId: string,
    transactionId: string,
    error: unknown,
    options: {
      step: string;
      recoveryStep?: string;
      startTime: number;
      withNotifications?: boolean;
      chatId?: string;
      logger: ReturnType<TransactionExecutor['createTransactionLogger']>;
    }
  ): Promise<boolean> {
    const { step, recoveryStep, startTime, withNotifications, chatId, logger } = options;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Log transaction failure
    logger.log('error', 'Transaction failed', {
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
        step,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        error: errorMessage
      }
    );
    
    // Try to recover if recovery step is specified
    if (recoveryStep) {
      try {
        // Create error metadata for recovery
        const errorTimestamp = new Date().toISOString();
        const errorMetadata = {
          errorMessage,
          errorType: error instanceof Error && (error as any).code === 'TIMEOUT' ? 'timeout' : 'system',
          workflowStep: step as any,
          previousStep: undefined,
          recoveryPaths: [recoveryStep as any],
          timestamp: errorTimestamp,
          details: {
            transactionId,
            duration: Date.now() - startTime,
            originalError: error
          }
        };
        
        // Use the centralized recovery service with transaction strategy
        const recoveryResult = await recoveryService.recoverFromError({
          workflowId,
          transactionId,
          metadata: errorMetadata,
          strategy: RecoveryStrategy.TRANSACTION,
          fallbackStrategies: [RecoveryStrategy.DATABASE, RecoveryStrategy.MEMORY],
          recoveryStep: recoveryStep as any
        });
        
        if (recoveryResult.isSuccess() && recoveryResult.value.success) {
          logger.log('info', 'Successfully recovered workflow state', {
            transactionId,
            recoveryStep,
            strategy: recoveryResult.value.strategy
          });
          return true;
        } else if (recoveryResult.isSuccess()) {
          // Recovery was attempted but unsuccessful
          logger.log('warn', 'Recovery was attempted but unsuccessful', {
            transactionId,
            error: recoveryResult.value.error?.message
          });
        } else {
          // Recovery failed with error
          logger.log('error', 'Recovery failed with error', {
            transactionId,
            error: recoveryResult.error.message
          });
        }
      } catch (recoveryError) {
        logger.log('error', 'Recovery attempt threw an exception', {
          transactionId,
          error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
        });
      }
    }
    
    // If recovery failed or not requested, update to error state
    try {
      if (withNotifications && chatId) {
        await workflowService.updateWithChatMessage(
          workflowId,
          'error',
          {
            transactionId,
            error: errorMessage,
            errorTimestamp: new Date().toISOString(),
            originalStep: step
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
          'error',
          {
            transactionId,
            error: errorMessage,
            errorTimestamp: new Date().toISOString(),
            originalStep: step
          },
          { forceUpdate: true }
        );
      }
    } catch (updateError) {
      logger.log('error', 'Failed to update error state', {
        transactionId,
        error: updateError instanceof Error ? updateError.message : String(updateError)
      });
    }
    
    return false;
  }
  
  /**
   * Create enhanced error with transaction details
   */
  createEnhancedError(
    error: unknown,
    transactionDetails: {
      transactionId: string;
      workflowId: string;
      step: string;
      logs: TransactionLogEntry[];
      metrics: {
        startTime: number;
        endTime: number;
        duration: number;
        retryCount: number;
      };
    }
  ): ApplicationError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new ApplicationError({
      message: errorMessage,
      code: 'TRANSACTION_FAILED',
      data: {
        transactionId: transactionDetails.transactionId,
        workflowId: transactionDetails.workflowId,
        step: transactionDetails.step,
        logs: transactionDetails.logs,
        metrics: transactionDetails.metrics
      }
    });
  }
}

// Export singleton instance
export const transactionExecutor = new TransactionExecutor();