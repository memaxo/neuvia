/**
 * @fileoverview Concurrency Strategy
 * 
 * Manages concurrency control strategies for workflow transactions,
 * including conflict resolution, optimistic locking, and version control.
 */

import { normalizeError } from '@/lib/errors';
import logger from '@/lib/logger';
import { workflowService } from '../core/workflow-service';
import { workflowRepository } from '../infrastructure/workflow-repository';

/**
 * Concurrency control options
 */
export interface ConcurrencyOptions {
  /** Strategy for handling conflicts */
  strategy?: 'fail' | 'force' | 'merge' | 'field-specific';
  
  /** Expected timestamp for optimistic concurrency control */
  expectedTimestamp?: string;
  
  /** Skip validation of transitions */
  skipValidation?: boolean;
  
  /** Force update even if validation fails */
  forceUpdate?: boolean;
  
  /** Domain for domain-specific strategies */
  domain?: string;
}

/**
 * Service for managing concurrency control strategies
 */
export class ConcurrencyStrategy {
  private readonly logger = logger.withMetadata({ module: 'ConcurrencyStrategy' });
  
  /**
   * Update workflow state with concurrency control
   */
  async updateStateWithConcurrencyControl(
    workflowId: string,
    step: string,
    metadata: Record<string, unknown>,
    options: ConcurrencyOptions = {}
  ): Promise<boolean> {
    const {
      strategy = 'fail',
      expectedTimestamp,
      skipValidation = false,
      forceUpdate = false,
      domain
    } = options;
    
    try {
      // Apply domain-specific transformation if needed
      const transformedMetadata = domain 
        ? this.applyDomainSpecificTransformation(metadata, domain)
        : metadata;
      
      // If expected timestamp is provided, use optimistic concurrency control
      if (expectedTimestamp) {
        return this.updateWithOptimisticLock(
          workflowId,
          step,
          transformedMetadata,
          expectedTimestamp
        );
      }
      
      // Use appropriate strategy based on configuration
      if (strategy === 'merge' || strategy === 'field-specific') {
        // For merge strategies, use the conflict resolution function
        const result = await workflowRepository.updateWithConflictResolution(
          workflowId,
          step as any,
          transformedMetadata,
          { strategy: 'merge' }
        );
        
        return result.success;
      } else {
        // Direct update with specified strategy
        await workflowRepository.updateWorkflowState(
          workflowId,
          step as any,
          transformedMetadata,
          {
            skipValidation,
            forceUpdate,
            conflictStrategy: strategy
          }
        );
        
        return true;
      }
    } catch (error) {
      const normalizedError = normalizeError(error);
      
      // Handle specific error cases
      if (normalizedError.message && normalizedError.message.includes('CONCURRENT_MODIFICATION')) {
        this.logger.warn('Concurrent modification detected', {
          workflowId,
          step,
          strategy
        });
        
        // If merge strategy and conflict, try to get current state and merge
        if (strategy === 'merge' || strategy === 'field-specific') {
          try {
            return await this.handleConcurrencyConflict(
              workflowId,
              step,
              metadata
            );
          } catch (mergeError) {
            this.logger.error('Failed to merge during conflict resolution', {
              workflowId,
              error: normalizedError.message
            });
            throw mergeError;
          }
        }
      }
      
      // If it's not a concurrency error or conflict resolution failed, rethrow
      this.logger.error('Concurrency control failed', {
        workflowId,
        step,
        strategy,
        error: normalizedError.message
      });
      
      throw error;
    }
  }
  
  /**
   * Update state with optimistic locking
   */
  private async updateWithOptimisticLock(
    workflowId: string,
    step: string,
    metadata: Record<string, unknown>,
    expectedTimestamp: string
  ): Promise<boolean> {
    // Use atomic update function with expected timestamp
    const { data, error } = await workflowRepository.updateWithConflictResolution(
      workflowId,
      step as any,
      metadata,
      {
        expectedTimestamp,
        strategy: 'fail'
      }
    );
    
    if (error) {
      this.logger.error('Optimistic locking failed', {
        workflowId,
        step,
        error
      });
      throw new Error(`Optimistic locking failed: ${error}`);
    }
    
    return data?.success || false;
  }
  
  /**
   * Handle concurrency conflict with merge strategy
   */
  private async handleConcurrencyConflict(
    workflowId: string,
    step: string,
    metadata: Record<string, unknown>
  ): Promise<boolean> {
    // Get current state
    const currentState = await workflowService.getWorkflowState(workflowId);
    if (!currentState) {
      throw new Error('Workflow state not found during conflict resolution');
    }
    
    // Merge metadata
    const mergedMetadata = {
      ...currentState.metadata,
      ...metadata,
      _mergedAt: new Date().toISOString(),
      _hadConflict: true
    };
    
    // Retry with merged metadata and force update
    await workflowRepository.updateWorkflowState(
      workflowId,
      step as any,
      mergedMetadata,
      { forceUpdate: true }
    );
    
    return true;
  }
  
  /**
   * Apply domain-specific transformations to metadata
   */
  private applyDomainSpecificTransformation(
    metadata: Record<string, unknown>,
    domain: string
  ): Record<string, unknown> {
    // For now, just add domain information to metadata
    // This can be expanded in the future for more complex transformations
    return {
      ...metadata,
      _domain: domain,
      _transformedAt: new Date().toISOString()
    };
  }
  
  /**
   * Generate a version identifier for optimistic concurrency control
   */
  generateVersionId(prefix: string = 'v'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }
}

// Export singleton instance
export const concurrencyStrategy = new ConcurrencyStrategy();