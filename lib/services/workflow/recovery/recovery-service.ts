/**
 * @fileoverview Recovery Service
 * 
 * Centralized service for handling workflow error recovery logic.
 * This service provides a unified approach to recovering from errors
 * across different workflow states and domains.
 * 
 * Features:
 * - Progressive recovery strategies (DB, memory, UI)
 * - Domain-specific recovery handlers
 * - Error classification and handling
 * - Transaction-aware recovery
 * - Event logging for audit trails
 */

import { useChatStore } from '@/stores/chat-store';
import { toast } from '@/components/ui/use-toast';
import { createBrowserClient } from '@/lib/supabase/clients';
import logger from '@/lib/logger';
import { normalizeError } from '@/lib/errors';
import { Result } from '../error/result';
import { workflowService } from '../core/workflow-service';
import { transactionExecutor } from '../transaction/transaction-executor';

import type { WorkflowStep } from '@/lib/types/workflow';
import { DomainOnlyWorkflowStep } from '@/lib/types/workflow';
import type { WorkflowErrorMetadata } from '@/lib/workflow/workflow-error-handler';

/**
 * Recovery strategies for workflow errors
 */
export enum RecoveryStrategy {
  DATABASE = 'database',     // Recover using database state
  MEMORY = 'memory',         // Recover using in-memory state
  UI = 'ui',                 // Update UI only (for minor issues)
  TRANSACTION = 'transaction', // Use transaction logs for recovery
  DOMAIN = 'domain'          // Use domain-specific recovery logic
}

/**
 * Recovery options for workflow errors
 */
export interface RecoveryOptions {
  /**
   * Workflow ID
   */
  workflowId?: string;
  
  /**
   * Transaction ID if recovery is part of a transaction
   */
  transactionId?: string;
  
  /**
   * Error metadata
   */
  metadata: WorkflowErrorMetadata;
  
  /**
   * Primary recovery strategy to use
   */
  strategy?: RecoveryStrategy;
  
  /**
   * Fallback recovery strategies in order of preference
   */
  fallbackStrategies?: RecoveryStrategy[];
  
  /**
   * Whether to show a toast notification on recovery success/failure
   */
  showToast?: boolean;
  
  /**
   * Domain-specific recovery handler
   */
  domainHandler?: (error: unknown, metadata: WorkflowErrorMetadata) => Promise<boolean>;
  
  /**
   * Maximum retry attempts
   */
  maxRetries?: number;
  
  /**
   * Current retry count
   */
  retryCount?: number;
  
  /**
   * Recovery step to use
   */
  recoveryStep?: WorkflowStep;
}

/**
 * Result of a recovery attempt
 */
export interface RecoveryResult {
  /**
   * Whether recovery was successful
   */
  success: boolean;
  
  /**
   * Strategy that succeeded in recovery
   */
  strategy?: RecoveryStrategy;
  
  /**
   * Step recovered to
   */
  recoveredToStep?: WorkflowStep;
  
  /**
   * Error if recovery failed
   */
  error?: {
    message: string;
    code?: string;
  };
  
  /**
   * Recovery metrics
   */
  metrics: {
    startTime: number;
    endTime: number;
    duration: number;
    attempts: number;
  };
}

/**
 * Service for centralizing workflow error recovery logic
 */
export class RecoveryService {
  private readonly logger = logger.withMetadata({ module: 'RecoveryService' });
  
  /**
   * Get recovery paths for a workflow step
   */
  getRecoveryPaths(currentStep: WorkflowStep): WorkflowStep[] {
    switch (currentStep) {
      case 'uploading':
        return ['idle', 'uploading'];
      case 'extracting':
        return ['idle', 'uploading', 'extracting'];
      case 'verification':
      case 'verification_pending':
      case 'verification_in_progress':
      case 'verification_completed':
      case 'verification_failed':
        return ['verification', 'verification_in_progress'];
      case 'report_generation':
        return ['verification_completed', 'report_generation'];
      case 'chat_started':
      case 'chat_in_progress':
      case 'chat_completed':
        return ['chat_started', 'chat_in_progress'];
      case 'complete':
        return ['idle', 'complete'];
      case DomainOnlyWorkflowStep.RESEARCH:
        return [DomainOnlyWorkflowStep.RESEARCH, 'report_generation'];
      case DomainOnlyWorkflowStep.REPORT_PRESENTATION:
        return [DomainOnlyWorkflowStep.REPORT_PRESENTATION, 'complete'];
      case DomainOnlyWorkflowStep.ERROR:
      case 'chat_error':
      default:
        // The default fallback is to just reset or remain on error
        return ['idle'];
    }
  }
  
  /**
   * Recover from an error using a multi-strategy approach
   */
  async recoverFromError(options: RecoveryOptions): Promise<Result<RecoveryResult>> {
    const startTime = Date.now();
    const retryCount = options.retryCount || 0;
    
    // Default strategies if none provided
    const strategy = options.strategy || RecoveryStrategy.DATABASE;
    const fallbackStrategies = options.fallbackStrategies || [
      RecoveryStrategy.TRANSACTION,
      RecoveryStrategy.MEMORY,
      RecoveryStrategy.UI
    ];
    
    // Determine recovery step
    const recoveryStep = options.recoveryStep || 
      (options.metadata.recoveryPaths && options.metadata.recoveryPaths.length > 0 
        ? options.metadata.recoveryPaths[0] 
        : options.metadata.previousStep || 'idle');
    
    try {
      // Log recovery attempt
      this.logger.info('Attempting recovery', {
        strategy,
        fallbackStrategies,
        workflowId: options.workflowId,
        transactionId: options.transactionId,
        step: options.metadata.workflowStep,
        recoveryStep,
        errorType: options.metadata.errorType,
        retryCount
      });
      
      // Try primary strategy
      const primaryResult = await this.executeRecoveryStrategy(
        strategy,
        {
          ...options,
          recoveryStep
        }
      );
      
      if (primaryResult) {
        // Primary strategy succeeded
        return this.createSuccessResult(
          strategy,
          recoveryStep,
          startTime,
          retryCount
        );
      }
      
      // Try fallback strategies in order
      for (const fallbackStrategy of fallbackStrategies) {
        this.logger.info(`Primary recovery failed, trying fallback: ${fallbackStrategy}`, {
          workflowId: options.workflowId,
          transactionId: options.transactionId
        });
        
        const fallbackResult = await this.executeRecoveryStrategy(
          fallbackStrategy,
          {
            ...options,
            recoveryStep
          }
        );
        
        if (fallbackResult) {
          // Fallback strategy succeeded
          return this.createSuccessResult(
            fallbackStrategy,
            recoveryStep,
            startTime,
            retryCount
          );
        }
      }
      
      // All strategies failed
      return Result.failure(
        'All recovery strategies failed',
        'RECOVERY_FAILED',
        {
          workflowId: options.workflowId,
          transactionId: options.transactionId,
          step: options.metadata.workflowStep,
          recoveryStep,
          errorType: options.metadata.errorType,
          errorMessage: options.metadata.errorMessage,
          retryCount
        }
      );
    } catch (error) {
      // Error during recovery process
      const normalizedError = normalizeError(error);
      
      this.logger.error('Recovery process failed', {
        error: normalizedError.message,
        workflowId: options.workflowId,
        transactionId: options.transactionId,
        step: options.metadata.workflowStep,
        recoveryStep
      });
      
      return Result.failure(
        `Recovery process failed: ${normalizedError.message}`,
        'RECOVERY_ERROR',
        {
          originalError: error,
          workflowId: options.workflowId,
          transactionId: options.transactionId,
          step: options.metadata.workflowStep,
          recoveryStep,
          errorType: options.metadata.errorType,
          errorMessage: options.metadata.errorMessage,
          retryCount
        }
      );
    }
  }
  
  /**
   * Execute a specific recovery strategy
   */
  private async executeRecoveryStrategy(
    strategy: RecoveryStrategy,
    options: RecoveryOptions & { recoveryStep: WorkflowStep }
  ): Promise<boolean> {
    const { workflowId, transactionId, metadata, recoveryStep } = options;
    
    switch (strategy) {
      case RecoveryStrategy.DATABASE:
        return this.executeDatabaseRecovery(workflowId, recoveryStep, metadata);
        
      case RecoveryStrategy.TRANSACTION:
        return this.executeTransactionRecovery(workflowId, transactionId, recoveryStep, metadata);
        
      case RecoveryStrategy.MEMORY:
        return this.executeMemoryRecovery(recoveryStep, metadata);
        
      case RecoveryStrategy.UI:
        return this.executeUIRecovery(recoveryStep, metadata);
        
      case RecoveryStrategy.DOMAIN:
        if (options.domainHandler) {
          return options.domainHandler(metadata.originalError, metadata);
        }
        return false;
        
      default:
        this.logger.warn(`Unknown recovery strategy: ${strategy}`, {
          workflowId,
          transactionId
        });
        return false;
    }
  }
  
  /**
   * Execute database-level recovery
   */
  private async executeDatabaseRecovery(
    workflowId: string | undefined,
    recoveryStep: WorkflowStep,
    metadata: WorkflowErrorMetadata
  ): Promise<boolean> {
    if (!workflowId) {
      this.logger.warn('Database recovery failed: No workflowId provided');
      return false;
    }
    
    try {
      const result = await workflowService.recoverWorkflowState(
        workflowId,
        recoveryStep,
        {
          error: metadata.errorMessage,
          errorType: metadata.errorType,
          errorCode: metadata.errorCode,
          errorTimestamp: metadata.timestamp,
          originalStep: metadata.workflowStep,
          recoveryDetails: metadata.details || {}
        }
      );
      
      if (result) {
        // Update UI state to match
        const store = useChatStore.getState();
        store.resetError();
        store.updateWorkflowStep(recoveryStep, {
          recoveredAt: new Date().toISOString(),
          recoveredFrom: metadata.workflowStep,
          isRecovery: true
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Database recovery failed', {
        error: error instanceof Error ? error.message : String(error),
        workflowId,
        step: metadata.workflowStep,
        recoveryStep
      });
      
      return false;
    }
  }
  
  /**
   * Execute transaction-based recovery
   */
  private async executeTransactionRecovery(
    workflowId: string | undefined,
    transactionId: string | undefined,
    recoveryStep: WorkflowStep,
    metadata: WorkflowErrorMetadata
  ): Promise<boolean> {
    if (!workflowId || !transactionId) {
      this.logger.warn('Transaction recovery failed: Missing workflowId or transactionId');
      return false;
    }
    
    try {
      // Create transaction logger for recovery process
      const { log } = transactionExecutor.createTransactionLogger(transactionId);
      
      log('info', 'Attempting transaction-based recovery', {
        workflowId,
        recoveryStep,
        originalStep: metadata.workflowStep
      });
      
      // Handle transaction failure which includes recovery logic
      const recovered = await transactionExecutor.handleTransactionFailure(
        workflowId,
        transactionId,
        metadata.originalError || metadata.errorMessage,
        {
          step: metadata.workflowStep,
          recoveryStep,
          startTime: Date.now() - 1000, // Approximate
          logger: { log, getLogs: () => [] }
        }
      );
      
      return recovered;
    } catch (error) {
      this.logger.error('Transaction recovery failed', {
        error: error instanceof Error ? error.message : String(error),
        workflowId,
        transactionId,
        step: metadata.workflowStep,
        recoveryStep
      });
      
      return false;
    }
  }
  
  /**
   * Execute in-memory state recovery
   */
  private async executeMemoryRecovery(
    recoveryStep: WorkflowStep,
    metadata: WorkflowErrorMetadata
  ): Promise<boolean> {
    const store = useChatStore.getState();
    
    try {
      // Reset error state
      store.setError(null);
      
      // Dynamic recovery based on step
      switch (recoveryStep) {
        case 'idle':
          store.resetChat();
          store.updateWorkflowStep('idle', {});
          return true;
          
        case 'uploading': {
          const currentUpload = metadata.details?.file;
          if (!currentUpload) {
            return false;
          }
          
          const retryCount = typeof metadata.details?.retryCount === 'number' 
            ? metadata.details.retryCount 
            : 0;
            
          store.updateWorkflowStep('uploading', {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: retryCount + 1,
          });
          return true;
        }
          
        case 'extracting': {
          const documentId = metadata.details?.documentId;
          if (!documentId) {
            return false;
          }
          
          const retryCount = typeof metadata.details?.retryCount === 'number' 
            ? metadata.details.retryCount 
            : 0;
            
          store.updateWorkflowStep('extracting', {
            isRetry: true,
            documentId,
            previousError: metadata.errorMessage,
            retryCount: retryCount + 1,
          });
          return true;
        }
          
        // Verification steps
        case 'verification':
        case 'verification_pending':
        case 'verification_in_progress':
        case 'verification_completed':
        case 'verification_failed': {
          const retryCount = typeof metadata.details?.retryCount === 'number' 
            ? metadata.details.retryCount 
            : 0;
            
          store.updateWorkflowStep(recoveryStep, {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: retryCount + 1,
          });
          return true;
        }
          
        case 'report_generation': {
          const retryCount = typeof metadata.details?.retryCount === 'number' 
            ? metadata.details.retryCount 
            : 0;
            
          store.updateWorkflowStep('report_generation', {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: retryCount + 1,
          });
          return true;
        }
          
        case 'complete':
          store.updateWorkflowStep('complete', {});
          return true;
          
        // Chat steps
        case 'chat_started':
        case 'chat_in_progress':
        case 'chat_completed': {
          const retryCount = typeof metadata.details?.retryCount === 'number' 
            ? metadata.details.retryCount 
            : 0;
            
          store.updateWorkflowStep(recoveryStep, {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: retryCount + 1,
          });
          return true;
        }
          
        // Domain-only steps
        case DomainOnlyWorkflowStep.RESEARCH:
        case DomainOnlyWorkflowStep.REPORT_PRESENTATION: {
          const retryCount = typeof metadata.details?.retryCount === 'number' 
            ? metadata.details.retryCount 
            : 0;
            
          store.updateWorkflowStep(recoveryStep, {
            isRetry: true,
            previousError: metadata.errorMessage,
            retryCount: retryCount + 1,
          });
          return true;
        }
          
        default:
          // Fallback to reset
          store.resetChat();
          store.updateWorkflowStep('idle', {});
          return true;
      }
    } catch (error) {
      this.logger.error('Memory recovery failed', {
        error: error instanceof Error ? error.message : String(error),
        step: metadata.workflowStep,
        recoveryStep
      });
      
      return false;
    }
  }
  
  /**
   * Execute UI-only recovery (minimal state changes)
   */
  private async executeUIRecovery(
    recoveryStep: WorkflowStep,
    metadata: WorkflowErrorMetadata
  ): Promise<boolean> {
    try {
      const store = useChatStore.getState();
      
      // Clear error state
      store.setError(null);
      
      // Update UI with minimal state changes
      store.updateWorkflowStep(recoveryStep, {
        recoveredAt: new Date().toISOString(),
        recoveredFrom: metadata.workflowStep,
        isRecovery: true,
        isUiOnly: true
      });
      
      if (metadata.errorType === 'network') {
        // Show reconnected toast for network errors
        toast({
          title: 'Reconnected',
          description: 'Network connection restored',
          variant: 'default',
        });
      }
      
      return true;
    } catch (error) {
      this.logger.error('UI recovery failed', {
        error: error instanceof Error ? error.message : String(error),
        step: metadata.workflowStep,
        recoveryStep
      });
      
      return false;
    }
  }
  
  /**
   * Create success result
   */
  private createSuccessResult(
    strategy: RecoveryStrategy,
    recoveryStep: WorkflowStep,
    startTime: number,
    attempts: number
  ): Result<RecoveryResult> {
    this.logger.info('Recovery successful', {
      strategy,
      recoveryStep,
      attempts,
      duration: Date.now() - startTime
    });
    
    return Result.success({
      success: true,
      strategy,
      recoveredToStep: recoveryStep,
      metrics: {
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        attempts
      }
    });
  }
  
  /**
   * Get recommended recovery strategy based on error type and metadata
   */
  getRecommendedStrategy(metadata: WorkflowErrorMetadata): {
    primary: RecoveryStrategy;
    fallbacks: RecoveryStrategy[];
  } {
    // Determine primary strategy based on error type
    switch (metadata.errorType) {
      case 'network':
        // Network errors typically require UI recovery first
        return {
          primary: RecoveryStrategy.UI,
          fallbacks: [RecoveryStrategy.MEMORY, RecoveryStrategy.DATABASE]
        };
        
      case 'timeout':
        // Timeout errors might need transaction-based recovery
        return {
          primary: RecoveryStrategy.TRANSACTION,
          fallbacks: [RecoveryStrategy.DATABASE, RecoveryStrategy.MEMORY]
        };
        
      case 'permission':
        // Permission errors typically require database recovery
        return {
          primary: RecoveryStrategy.DATABASE,
          fallbacks: [RecoveryStrategy.MEMORY, RecoveryStrategy.UI]
        };
        
      case 'validation':
        // Validation errors are best handled with memory recovery
        return {
          primary: RecoveryStrategy.MEMORY,
          fallbacks: [RecoveryStrategy.UI, RecoveryStrategy.DATABASE]
        };
        
      case 'system':
        // System errors typically require database recovery
        return {
          primary: RecoveryStrategy.DATABASE,
          fallbacks: [RecoveryStrategy.TRANSACTION, RecoveryStrategy.MEMORY]
        };
        
      case 'unknown':
      default:
        // Default to most comprehensive approach
        return {
          primary: RecoveryStrategy.DATABASE,
          fallbacks: [RecoveryStrategy.TRANSACTION, RecoveryStrategy.MEMORY, RecoveryStrategy.UI]
        };
    }
  }
  
  /**
   * Initialize recovery logger for audit trail
   */
  createRecoveryLogger() {
    return {
      logRecoveryStart: (
        workflowId: string | undefined,
        metadata: WorkflowErrorMetadata,
        options: { transactionId?: string, strategy: RecoveryStrategy }
      ) => {
        // Log to application logs
        this.logger.info('Recovery process started', {
          workflowId,
          transactionId: options.transactionId,
          step: metadata.workflowStep,
          errorType: metadata.errorType,
          strategy: options.strategy
        });
        
        // Log to database if workflowId is available
        if (workflowId) {
          void workflowService.logWorkflowEvent(
            workflowId,
            'recovery_started',
            {
              errorType: metadata.errorType,
              errorMessage: metadata.errorMessage,
              originalStep: metadata.workflowStep,
              strategy: options.strategy,
              timestamp: new Date().toISOString(),
              transactionId: options.transactionId
            }
          );
        }
      },
      
      logRecoveryComplete: (
        workflowId: string | undefined,
        result: RecoveryResult,
        metadata: WorkflowErrorMetadata
      ) => {
        // Log to application logs
        this.logger.info('Recovery process completed', {
          workflowId,
          success: result.success,
          strategy: result.strategy,
          recoveredToStep: result.recoveredToStep,
          duration: result.metrics.duration,
          attempts: result.metrics.attempts
        });
        
        // Log to database if workflowId is available
        if (workflowId) {
          void workflowService.logWorkflowEvent(
            workflowId,
            result.success ? 'recovery_completed' : 'recovery_failed',
            {
              errorType: metadata.errorType,
              errorMessage: metadata.errorMessage,
              originalStep: metadata.workflowStep,
              recoveredToStep: result.recoveredToStep,
              strategy: result.strategy,
              success: result.success,
              timestamp: new Date().toISOString(),
              duration: result.metrics.duration,
              attempts: result.metrics.attempts,
              error: result.error
            }
          );
        }
      }
    };
  }
  
  /**
   * Update audit log for recovery process
   */
  async updateAuditLog(
    workflowId: string | undefined,
    event: 'recovery_attempt' | 'recovery_success' | 'recovery_failure',
    details: Record<string, unknown>
  ): Promise<void> {
    if (!workflowId) {
      return;
    }
    
    try {
      // Try to use workflow service first
      await workflowService.logWorkflowEvent(
        workflowId,
        event,
        {
          timestamp: new Date().toISOString(),
          ...details
        }
      );
    } catch (error) {
      // Fallback to direct database access
      try {
        const supabase = createBrowserClient();
        await supabase.from('audit_logs').insert({
          action: event.toUpperCase(),
          entity_id: workflowId,
          entity_type: 'workflow',
          changes: details as any,
          created_at: new Date().toISOString(),
          user_id: null,
        });
      } catch (dbError) {
        this.logger.error('Failed to update audit log', {
          error: dbError instanceof Error ? dbError.message : String(dbError),
          workflowId,
          event
        });
      }
    }
  }
}

// Export singleton instance
export const recoveryService = new RecoveryService();