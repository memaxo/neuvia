/**
 * @fileoverview Unified Workflow Transaction Manager - Phase 4
 *
 * PHASE 4 IMPLEMENTATION:
 * This file reexports the streamlined transaction manager from transaction/transaction-manager.ts
 * and provides backward compatibility with the old API.
 * 
 * The previous complex inheritance-based architecture has been replaced with:
 * - A streamlined API based on the Result pattern
 * - Composition over inheritance
 * - Standard error handling
 * - Simplified retry mechanism
 */

import { normalizeError } from '@/lib/errors';
import logger from '@/lib/logger';
import { workflowRepository } from './infrastructure/workflow-repository';
import { 
  transactionManager, 
  TransactionOptions as NewTransactionOptions,
  TransactionResult as NewTransactionResult
} from './transaction/transaction-manager';

import type { WorkflowStep, ProcessingPhase, WorkflowState } from '@/lib/types/workflow';
import { DomainOnlyWorkflowStep } from '@/lib/types/workflow';

/**
 * Legacy transaction options for backward compatibility
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
 * Legacy transaction result for backward compatibility
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
 * Legacy transaction result options
 */
interface SimpleTransactionOptions {
  step?: WorkflowStep;
  errorStep?: WorkflowStep;
  metadata?: Record<string, unknown>;
  transactionId?: string;
}

/**
 * Legacy simple transaction result
 */
interface SimpleTransactionResult<T> {
  data: T;
  transactionId: string;
  success: boolean;
  error?: string;
}

/**
 * Class for managing workflow transactions with atomicity and recovery
 * This is a backward compatibility layer on top of the new transactionManager
 */
export class WorkflowTransactionManager {
  private readonly logger = logger.withMetadata({ module: 'WorkflowTransactionManager' });
  
  /**
   * Execute a simple transaction with minimal configuration
   * now uses the unified transaction manager underneath
   */
  async executeSimpleTransaction<T>(
    workflowId: string,
    operation: () => Promise<T>,
    options: SimpleTransactionOptions = {}
  ): Promise<SimpleTransactionResult<T>> {
    const result = await transactionManager.executeTransaction(
      workflowId,
      (txId) => operation(),
      {
        step: options.step,
        errorStep: options.errorStep,
        metadata: options.metadata,
        transactionId: options.transactionId,
        retryCount: 0
      }
    );
    
    if (result.isSuccess()) {
      return {
        data: result.value.data,
        transactionId: result.value.transactionId,
        success: true
      };
    } else {
      return {
        data: null as any,
        transactionId: options.transactionId || crypto.randomUUID(),
        success: false,
        error: result.error.message
      };
    }
  }
  
  /**
   * Execute a read-only transaction (no state changes)
   */
  async executeReadTransaction<T>(
    workflowId: string,
    operation: () => Promise<T>
  ): Promise<SimpleTransactionResult<T>> {
    const result = await transactionManager.executeReadTransaction(
      workflowId,
      operation
    );
    
    if (result.isSuccess()) {
      return {
        data: result.value,
        transactionId: crypto.randomUUID(),
        success: true
      };
    } else {
      return {
        data: null as any,
        transactionId: crypto.randomUUID(),
        success: false,
        error: result.error.message
      };
    }
  }
  
  /**
   * Execute a workflow operation with proper transaction handling
   */
  async executeTransaction<T>(
    workflowId: string,
    operation: (
      progressCallback: (progress: number, phase: ProcessingPhase) => void,
      transactionId: string
    ) => Promise<T>,
    options: TransactionOptions
  ): Promise<TransactionResult<T>> {
    // Map old options to new options
    const newOptions: NewTransactionOptions = {
      step: options.step,
      errorStep: options.recoveryStep,
      metadata: options.metadata,
      transactionId: options.transactionId,
      onProgress: options.onProgress,
      retryCount: options.maxRetries,
      conflictStrategy: options.conflictStrategy,
      domainName: (options.metadata?.domain as string) || undefined,
      commitOnError: false
    };
    
    try {
      const result = await transactionManager.executeTransaction(
        workflowId,
        (txId, progressCallback) => operation(progressCallback || (() => {}), txId),
        newOptions
      );
      
      if (result.isSuccess()) {
        // Fetch final workflow state for backward compatibility
        const finalState = await workflowRepository.getWorkflowState(workflowId);
        
        return {
          data: result.value.data,
          transactionId: result.value.transactionId,
          workflowState: finalState,
          metrics: result.value.metrics || {
            startTime: Date.now() - 1000,
            endTime: Date.now(),
            duration: 1000,
            retryCount: 0
          },
          logs: [] // Empty logs for compatibility - logs are now handled differently
        };
      } else {
        throw new Error(result.error.message);
      }
    } catch (error) {
      // Standardized error handling
      const normalizedError = normalizeError(error);
      
      this.logger.error('Transaction failed with error', {
        workflowId,
        error: normalizedError.message,
        step: options.step
      });
      
      // Throw a standardized error
      const enhancedError = {
        message: normalizedError.message,
        transactionId: options.transactionId || crypto.randomUUID(),
        workflowId,
        step: options.step,
        code: normalizedError.code || 'TRANSACTION_FAILED'
      };
      
      throw new Error(JSON.stringify(enhancedError));
    }
  }
}

// Export singleton instances
export const workflowTransactionManager = new WorkflowTransactionManager();

// Prefer using these directly in new code
export {
  transactionManager,
  NewTransactionOptions as StreamlinedTransactionOptions,
  NewTransactionResult as StreamlinedTransactionResult
};