import { workflowRepository } from '../infrastructure/workflow-repository';
import { workflowEventSourcing } from '../infrastructure/workflow-event-source';
import { normalizeError } from '@/lib/errors';
import logger from '@/lib/logger';

import type { WorkflowStep } from '@/lib/types/workflow';
import { DomainOnlyWorkflowStep } from '@/lib/types/workflow';

/**
 * Options for simple transactions
 */
export interface SimpleTransactionOptions {
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
}

/**
 * Result of a simple transaction
 */
export interface SimpleTransactionResult<T> {
  /** Transaction data */
  data: T;
  
  /** Transaction ID */
  transactionId: string;
  
  /** Whether transaction was successful */
  success: boolean;
  
  /** Error message if transaction failed */
  error?: string;
}

/**
 * Simplified transaction manager for common workflow operations
 */
export class SimpleTransactionManager {
  private readonly logger = logger.withMetadata({ module: 'SimpleTransactionManager' });
  
  /**
   * Execute a simple transaction with minimal configuration
   */
  async executeTransaction<T>(
    workflowId: string,
    operation: () => Promise<T>,
    options: SimpleTransactionOptions = {}
  ): Promise<SimpleTransactionResult<T>> {
    const transactionId = options.transactionId || crypto.randomUUID();
    const now = new Date().toISOString();
    
    try {
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      // Update state if step is provided
      if (options.step) {
        await workflowRepository.updateWorkflowState(
          workflowId,
          options.step,
          {
            ...options.metadata,
            transactionId,
            startedAt: now
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
            metadata: options.metadata || {}
          }
        );
      }
      
      // Execute the operation
      const result = await operation();
      
      // Log transaction completion event
      await workflowEventSourcing.appendEvent(
        workflowId,
        'transaction_completed',
        {
          transactionId,
          step: options.step,
          timestamp: new Date().toISOString(),
          duration: Date.now() - new Date(now).getTime(),
          success: true
        }
      );
      
      return {
        data: result,
        transactionId,
        success: true
      };
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Transaction failed', {
        workflowId,
        transactionId,
        step: options.step,
        error: normalizedError.message
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
            duration: Date.now() - new Date(now).getTime(),
            error: normalizedError.message
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
              transactionId
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
      
      return {
        data: null as any,
        transactionId,
        success: false,
        error: normalizedError.message
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
    try {
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      // Execute the operation without state changes
      const result = await operation();
      
      return {
        data: result,
        transactionId: crypto.randomUUID(),
        success: true
      };
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Read transaction failed', {
        workflowId,
        error: normalizedError.message
      });
      
      return {
        data: null as any,
        transactionId: crypto.randomUUID(),
        success: false,
        error: normalizedError.message
      };
    }
  }
}

// Export singleton instance
export const simpleTransactionManager = new SimpleTransactionManager();