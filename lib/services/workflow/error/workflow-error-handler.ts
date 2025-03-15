/**
 * @fileoverview Unified Error Handler
 * 
 * PHASE 4 IMPLEMENTATION:
 * This file provides a unified error handling approach for all workflow operations.
 * It consolidates the various error handling patterns into a single, consistent
 * system that uses the Result pattern and standardized error categorization.
 * 
 * Key components:
 * - ErrorCategorizer: Determines the category of an error
 * - ErrorRecovery: Strategies for recovering from different error types
 * - ErrorNotifier: Infrastructure for notifying about errors and recovery attempts
 * - UnifiedErrorHandler: The main error handling service
 */

import { normalizeError } from '@/lib/errors';
import logger from '@/lib/logger';
import { Result, ResultError } from './result';
import { workflowRepository } from '../infrastructure/workflow-repository';
import { workflowEventSourcing } from '../infrastructure/workflow-event-source';
import { transactionManager } from '../transaction/transaction-manager';

import type { WorkflowStep, ProcessingPhase } from '@/lib/types/workflow';
import { DomainOnlyWorkflowStep } from '@/lib/types/workflow';

/**
 * Error categories for better classification and handling
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  NETWORK = 'network',
  PERMISSION = 'permission',
  TIMEOUT = 'timeout',
  WORKFLOW = 'workflow',
  CONCURRENCY = 'concurrency',
  TRANSACTION = 'transaction',
  DATA = 'data',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',         // Non-critical, can be auto-recovered
  MEDIUM = 'medium',   // Requires attention but not blocking
  HIGH = 'high',       // Critical, blocking operation
  FATAL = 'fatal'      // System-level failure
}

/**
 * Standard error context for comprehensive error handling
 */
export interface ErrorContext {
  /** 
   * Domain where the error occurred 
   */
  domain?: string;

  /** 
   * Current workflow step when error occurred 
   */
  workflowStep?: WorkflowStep;

  /** 
   * Previous workflow step 
   */
  previousStep?: WorkflowStep;

  /** 
   * Workflow ID
   */
  workflowId?: string;

  /** 
   * Transaction ID if part of a transaction
   */
  transactionId?: string;

  /** 
   * Operation being performed when error occurred
   */
  operation?: string;

  /** 
   * Input that caused the error (sanitized)
   */
  input?: Record<string, unknown>;

  /** 
   * Timestamp when the error occurred
   */
  timestamp?: string;

  /** 
   * User ID associated with the operation
   */
  userId?: string;

  /** 
   * Additional metadata
   */
  metadata?: Record<string, unknown>;

  /** 
   * Number of retry attempts so far
   */
  retryCount?: number;

  /** 
   * Maximum number of allowed retries
   */
  maxRetries?: number;
}

/**
 * Recovery strategy for handling errors
 */
export enum RecoveryStrategy {
  RETRY = 'retry',           // Retry the same operation
  FALLBACK = 'fallback',     // Use a fallback value or operation
  RESET = 'reset',           // Reset to a known good state
  IGNORE = 'ignore',         // Ignore the error and continue
  DELEGATE = 'delegate',     // Delegate to human or another system
  NONE = 'none'              // No recovery possible
}

/**
 * Result of an error recovery attempt
 */
export interface RecoveryResult {
  /** Whether recovery was successful */
  success: boolean;

  /** Strategy used for recovery */
  strategy: RecoveryStrategy;

  /** New workflow step after recovery */
  newStep?: WorkflowStep;

  /** Error if recovery failed */
  error?: ResultError;

  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Recovery options for error handling
 */
export interface RecoveryOptions {
  /** Workflow ID */
  workflowId?: string;

  /** Transaction ID */
  transactionId?: string;

  /** Preferred recovery strategy */
  strategy?: RecoveryStrategy;

  /** Fallback strategies in priority order */
  fallbackStrategies?: RecoveryStrategy[];

  /** Specific step to recover to */
  targetStep?: WorkflowStep;

  /** Show user notification after recovery attempt */
  notify?: boolean;

  /** Maximum retry count */
  maxRetries?: number;

  /** Current retry count */
  retryCount?: number;
}

/**
 * Options for unified error handling
 */
export interface ErrorHandlingOptions {
  /** Log the error */
  log?: boolean;

  /** Attempt automatic recovery */
  attemptRecovery?: boolean;

  /** Recovery options */
  recoveryOptions?: RecoveryOptions;

  /** Update workflow state */
  updateWorkflowState?: boolean;

  /** Send notification */
  notify?: boolean;

  /** Notification details */
  notificationDetails?: {
    title?: string;
    message?: string;
    type?: 'info' | 'warning' | 'error' | 'success';
    actions?: Array<{
      label: string;
      action: string;
    }>;
  };
}

/**
 * Utility for categorizing errors
 */
class ErrorCategorizer {
  private static readonly CATEGORY_PATTERNS: Record<ErrorCategory, RegExp[]> = {
    [ErrorCategory.VALIDATION]: [
      /validation/i, /invalid/i, /required/i, /missing/i, /schema/i, /constraint/i
    ],
    [ErrorCategory.NETWORK]: [
      /network/i, /connection/i, /unreachable/i, /dns/i, /offline/i
    ],
    [ErrorCategory.PERMISSION]: [
      /permission/i, /unauthorized/i, /forbidden/i, /access denied/i
    ],
    [ErrorCategory.TIMEOUT]: [
      /timeout/i, /timed out/i, /too slow/i, /deadline exceeded/i
    ],
    [ErrorCategory.WORKFLOW]: [
      /workflow/i, /transition/i, /state/i, /step/i
    ],
    [ErrorCategory.CONCURRENCY]: [
      /concurrent/i, /conflict/i, /optimistic/i, /lock/i, /race condition/i
    ],
    [ErrorCategory.TRANSACTION]: [
      /transaction/i, /rollback/i, /commit/i
    ],
    [ErrorCategory.DATA]: [
      /data/i, /database/i, /query/i, /record/i, /not found/i
    ],
    [ErrorCategory.SYSTEM]: [
      /system/i, /internal/i, /server/i, /runtime/i, /memory/i
    ],
    [ErrorCategory.UNKNOWN]: [
      /.*/
    ]
  };

  /**
   * Categorize an error based on its message and context
   */
  public static categorize(error: unknown, context?: ErrorContext): ErrorCategory {
    const normalizedError = normalizeError(error);
    const message = normalizedError.message.toLowerCase();
    const code = (normalizedError.code || '').toLowerCase();

    // First check error code if available
    if (code) {
      if (code.includes('validation') || code.includes('invalid')) {
        return ErrorCategory.VALIDATION;
      } else if (code.includes('permission') || code.includes('auth')) {
        return ErrorCategory.PERMISSION;
      } else if (code.includes('timeout')) {
        return ErrorCategory.TIMEOUT;
      } else if (code.includes('network') || code.includes('connection')) {
        return ErrorCategory.NETWORK;
      } else if (code.includes('workflow') || code.includes('transition')) {
        return ErrorCategory.WORKFLOW;
      } else if (code.includes('concurrent') || code.includes('conflict')) {
        return ErrorCategory.CONCURRENCY;
      } else if (code.includes('transaction')) {
        return ErrorCategory.TRANSACTION;
      } else if (code.includes('data') || code.includes('not_found')) {
        return ErrorCategory.DATA;
      } else if (code.includes('system') || code.includes('internal')) {
        return ErrorCategory.SYSTEM;
      }
    }

    // Check domain from context
    if (context?.domain) {
      const domainCategories: Record<string, ErrorCategory> = {
        'workflow': ErrorCategory.WORKFLOW,
        'transaction': ErrorCategory.TRANSACTION,
        'database': ErrorCategory.DATA
      };

      if (domainCategories[context.domain]) {
        return domainCategories[context.domain];
      }
    }

    // Check error message against patterns
    for (const [category, patterns] of Object.entries(ErrorCategorizer.CATEGORY_PATTERNS)) {
      // Skip the UNKNOWN category for now
      if (category === ErrorCategory.UNKNOWN) continue;

      for (const pattern of patterns) {
        if (pattern.test(message)) {
          return category as ErrorCategory;
        }
      }
    }

    // Default to UNKNOWN
    return ErrorCategory.UNKNOWN;
  }

  /**
   * Determine the severity of an error based on category and context
   */
  public static determineSeverity(
    category: ErrorCategory,
    context?: ErrorContext
  ): ErrorSeverity {
    switch (category) {
      case ErrorCategory.NETWORK:
      case ErrorCategory.TIMEOUT:
        return ErrorSeverity.MEDIUM;

      case ErrorCategory.VALIDATION:
        return ErrorSeverity.LOW;

      case ErrorCategory.PERMISSION:
        return ErrorSeverity.HIGH;

      case ErrorCategory.WORKFLOW:
        return ErrorSeverity.MEDIUM;

      case ErrorCategory.CONCURRENCY:
        return ErrorSeverity.MEDIUM;

      case ErrorCategory.TRANSACTION:
        return ErrorSeverity.HIGH;

      case ErrorCategory.DATA:
        return ErrorSeverity.HIGH;

      case ErrorCategory.SYSTEM:
        return ErrorSeverity.FATAL;

      case ErrorCategory.UNKNOWN:
      default:
        return ErrorSeverity.HIGH;
    }
  }

  /**
   * Check if an error is retryable
   */
  public static isRetryable(
    category: ErrorCategory,
    error: unknown,
    context?: ErrorContext
  ): boolean {
    const message = normalizeError(error).message.toLowerCase();

    // Some categories are always (or almost always) retryable
    if (
      category === ErrorCategory.NETWORK ||
      category === ErrorCategory.TIMEOUT ||
      category === ErrorCategory.CONCURRENCY
    ) {
      return true;
    }

    // Some categories are never (or almost never) retryable
    if (
      category === ErrorCategory.PERMISSION ||
      category === ErrorCategory.VALIDATION
    ) {
      return false;
    }

    // Check retry count
    if (
      context?.retryCount !== undefined &&
      context.maxRetries !== undefined &&
      context.retryCount >= context.maxRetries
    ) {
      return false;
    }

    // Check non-retryable patterns in message
    const nonRetryablePatterns = [
      /not found/i,
      /invalid token/i,
      /unauthorized/i,
      /permission denied/i,
      /unsupported/i,
      /malformed/i,
      /invalid format/i,
      /corrupted/i
    ];

    for (const pattern of nonRetryablePatterns) {
      if (pattern.test(message)) {
        return false;
      }
    }

    // Default based on category
    return category !== ErrorCategory.UNKNOWN;
  }
}

/**
 * Error recovery strategies
 */
class ErrorRecovery {
  private readonly logger = logger.withMetadata({ module: 'ErrorRecovery' });

  /**
   * Get recommended recovery strategies for error category
   */
  public getRecommendedStrategies(
    category: ErrorCategory,
    error: unknown,
    context?: ErrorContext
  ): {
    primary: RecoveryStrategy;
    fallbacks: RecoveryStrategy[];
  } {
    // Check if error is retryable
    const retryable = ErrorCategorizer.isRetryable(category, error, context);

    // Define strategy based on category
    switch (category) {
      case ErrorCategory.NETWORK:
      case ErrorCategory.TIMEOUT:
        return {
          primary: RecoveryStrategy.RETRY,
          fallbacks: [RecoveryStrategy.RESET, RecoveryStrategy.DELEGATE]
        };

      case ErrorCategory.VALIDATION:
        return {
          primary: RecoveryStrategy.FALLBACK,
          fallbacks: [RecoveryStrategy.RESET, RecoveryStrategy.DELEGATE]
        };

      case ErrorCategory.CONCURRENCY:
        return {
          primary: RecoveryStrategy.RETRY,
          fallbacks: [RecoveryStrategy.FALLBACK, RecoveryStrategy.DELEGATE]
        };

      case ErrorCategory.WORKFLOW:
        return {
          primary: retryable ? RecoveryStrategy.RETRY : RecoveryStrategy.RESET,
          fallbacks: [RecoveryStrategy.DELEGATE]
        };

      case ErrorCategory.TRANSACTION:
        return {
          primary: retryable ? RecoveryStrategy.RETRY : RecoveryStrategy.RESET,
          fallbacks: [RecoveryStrategy.DELEGATE]
        };

      case ErrorCategory.DATA:
        return {
          primary: RecoveryStrategy.FALLBACK,
          fallbacks: [RecoveryStrategy.DELEGATE]
        };

      case ErrorCategory.PERMISSION:
        return {
          primary: RecoveryStrategy.DELEGATE,
          fallbacks: [RecoveryStrategy.NONE]
        };

      case ErrorCategory.SYSTEM:
      case ErrorCategory.UNKNOWN:
      default:
        return {
          primary: RecoveryStrategy.DELEGATE,
          fallbacks: [RecoveryStrategy.RESET, RecoveryStrategy.NONE]
        };
    }
  }

  /**
   * Get recovery paths for a workflow step
   */
  public getRecoveryPaths(
    currentStep: WorkflowStep,
    category: ErrorCategory
  ): WorkflowStep[] {
    // Default recovery paths for all steps
    const defaultPaths: WorkflowStep[] = ['idle'];

    // Step-specific recovery paths
    const stepRecoveryMap: Record<string, WorkflowStep[]> = {
      'uploading': ['idle'],
      'extracting': ['uploading', 'idle'],
      'verification': ['extracting', 'idle'],
      'verification_in_progress': ['verification', 'idle'],
      'report_generation': ['verification_complete', 'idle'],
      'chat_thinking': ['chat_waiting', 'idle'],
      'chat_error': ['chat_waiting', 'idle'],
      'error': ['idle']
    };

    // Category-specific recovery paths
    const categoryRecoveryMap: Record<ErrorCategory, WorkflowStep[]> = {
      [ErrorCategory.NETWORK]: ['idle'],
      [ErrorCategory.TIMEOUT]: ['idle'],
      [ErrorCategory.VALIDATION]: ['idle'],
      [ErrorCategory.WORKFLOW]: ['idle'],
      [ErrorCategory.CONCURRENCY]: ['idle'],
      [ErrorCategory.TRANSACTION]: ['idle'],
      [ErrorCategory.DATA]: ['idle'],
      [ErrorCategory.PERMISSION]: ['idle'],
      [ErrorCategory.SYSTEM]: ['idle'],
      [ErrorCategory.UNKNOWN]: ['idle']
    };

    // Combine paths
    const combinedPaths = [
      ...defaultPaths,
      ...(stepRecoveryMap[currentStep] || []),
      ...(categoryRecoveryMap[category] || [])
    ];

    // Remove duplicates and ensure 'idle' is always an option
    return Array.from(new Set(['idle', ...combinedPaths])) as WorkflowStep[];
  }

  /**
   * Attempt recovery from error
   */
  public async attemptRecovery(
    error: unknown,
    context: ErrorContext,
    options: RecoveryOptions = {}
  ): Promise<Result<RecoveryResult>> {
    try {
      const normalizedError = normalizeError(error);
      const category = ErrorCategorizer.categorize(error, context);
      const { workflowId, transactionId } = context;
      
      // Log recovery attempt
      this.logger.info('Attempting recovery from error', {
        errorMessage: normalizedError.message,
        errorCode: normalizedError.code,
        category,
        workflowId,
        transactionId,
        strategy: options.strategy
      });

      // Get recommended strategies if not specified
      const recommendedStrategies = this.getRecommendedStrategies(category, error, context);
      const strategy = options.strategy || recommendedStrategies.primary;
      const fallbacks = options.fallbackStrategies || recommendedStrategies.fallbacks;

      // Try primary strategy first
      const primaryResult = await this.executeRecoveryStrategy(
        strategy,
        error,
        context,
        options
      );

      // If primary succeeds, return success
      if (primaryResult.isSuccess() && primaryResult.value.success) {
        return primaryResult;
      }

      // Try fallback strategies if primary fails
      for (const fallbackStrategy of fallbacks) {
        // Skip if same as primary
        if (fallbackStrategy === strategy) continue;

        // Log fallback attempt
        this.logger.info('Trying fallback recovery strategy', {
          primaryStrategy: strategy,
          fallbackStrategy,
          workflowId,
          transactionId
        });

        // Execute fallback
        const fallbackResult = await this.executeRecoveryStrategy(
          fallbackStrategy,
          error,
          context,
          options
        );

        // If fallback succeeds, return success
        if (fallbackResult.isSuccess() && fallbackResult.value.success) {
          return fallbackResult;
        }
      }

      // If all strategies fail, return failure
      return Result.failure(
        'All recovery strategies failed',
        'RECOVERY_FAILED',
        {
          originalError: normalizedError,
          triedStrategies: [strategy, ...fallbacks],
          workflowId,
          transactionId
        }
      );
    } catch (recoveryError) {
      // Meta-error: recovery process itself failed
      const normalizedError = normalizeError(recoveryError);
      
      this.logger.error('Recovery process failed with error', {
        errorMessage: normalizedError.message,
        errorCode: normalizedError.code,
        workflowId: context.workflowId,
        transactionId: context.transactionId
      });

      return Result.failure(
        `Recovery process failed: ${normalizedError.message}`,
        'RECOVERY_PROCESS_ERROR',
        {
          originalError: error,
          recoveryError: normalizedError,
          workflowId: context.workflowId,
          transactionId: context.transactionId
        }
      );
    }
  }

  /**
   * Execute a specific recovery strategy
   */
  private async executeRecoveryStrategy(
    strategy: RecoveryStrategy,
    error: unknown,
    context: ErrorContext,
    options: RecoveryOptions = {}
  ): Promise<Result<RecoveryResult>> {
    const { workflowId, transactionId, workflowStep } = context;
    
    // Determine target step for recovery
    const targetStep = options.targetStep || this.determineTargetStep(strategy, context);
    
    try {
      switch (strategy) {
        case RecoveryStrategy.RETRY:
          return await this.retryOperation(error, context, options);
          
        case RecoveryStrategy.FALLBACK:
          return await this.useFallback(error, context, targetStep, options);
          
        case RecoveryStrategy.RESET:
          return await this.resetToKnownGoodState(context, targetStep, options);
          
        case RecoveryStrategy.IGNORE:
          return Result.success({
            success: true,
            strategy: RecoveryStrategy.IGNORE,
            details: {
              message: 'Error ignored',
              workflowId,
              transactionId,
              error: normalizeError(error).message
            }
          });
          
        case RecoveryStrategy.DELEGATE:
          // Delegate to human or other system
          return await this.delegateRecovery(error, context, options);
          
        case RecoveryStrategy.NONE:
        default:
          return Result.failure(
            'No viable recovery strategy',
            'NO_RECOVERY_STRATEGY',
            { workflowId, transactionId }
          );
      }
    } catch (strategyError) {
      return Result.failure(
        `Recovery strategy ${strategy} failed: ${normalizeError(strategyError).message}`,
        'RECOVERY_STRATEGY_FAILED',
        {
          strategy,
          workflowId,
          transactionId,
          originalError: error,
          strategyError
        }
      );
    }
  }

  /**
   * Retry the operation that failed
   */
  private async retryOperation(
    error: unknown,
    context: ErrorContext,
    options: RecoveryOptions = {}
  ): Promise<Result<RecoveryResult>> {
    const { workflowId, transactionId, operation, workflowStep } = context;
    
    // Check if retry count exceeded
    const retryCount = (context.retryCount || 0) + 1;
    const maxRetries = options.maxRetries || context.maxRetries || 3;
    
    if (retryCount > maxRetries) {
      return Result.failure(
        `Retry count exceeded (${retryCount}/${maxRetries})`,
        'RETRY_COUNT_EXCEEDED',
        { workflowId, transactionId, retryCount, maxRetries }
      );
    }
    
    try {
      // If there's no operation to retry, just update state
      if (!operation) {
        // Update workflow state back to the original step
        if (workflowId && workflowStep) {
          await workflowRepository.updateWorkflowState(
            workflowId,
            workflowStep,
            {
              retryAttempt: retryCount,
              lastError: normalizeError(error).message,
              retryTimestamp: new Date().toISOString(),
              transactionId
            }
          );
          
          // Log retry event
          await workflowEventSourcing.appendEvent(
            workflowId,
            'recovery_retry',
            {
              strategy: RecoveryStrategy.RETRY,
              step: workflowStep,
              retryCount,
              maxRetries,
              timestamp: new Date().toISOString(),
              transactionId
            }
          );
        }
        
        return Result.success({
          success: true,
          strategy: RecoveryStrategy.RETRY,
          newStep: workflowStep,
          details: {
            retryCount,
            maxRetries,
            message: 'State reset for retry'
          }
        });
      }
      
      // If using transaction manager, no need to implement retry here
      // as it has its own retry mechanism
      this.logger.warn('Operation retry requested but no retry implementation available', {
        workflowId,
        transactionId,
        operation
      });
      
      return Result.success({
        success: true,
        strategy: RecoveryStrategy.RETRY,
        newStep: workflowStep,
        details: {
          retryCount,
          maxRetries,
          message: 'Operation retry requested'
        }
      });
    } catch (retryError) {
      return Result.failure(
        `Retry failed: ${normalizeError(retryError).message}`,
        'RETRY_FAILED',
        {
          workflowId,
          transactionId,
          operation,
          originalError: error,
          retryError
        }
      );
    }
  }

  /**
   * Use a fallback value or operation
   */
  private async useFallback(
    error: unknown,
    context: ErrorContext,
    targetStep?: WorkflowStep,
    options: RecoveryOptions = {}
  ): Promise<Result<RecoveryResult>> {
    const { workflowId, transactionId, workflowStep } = context;
    
    // Determine best fallback step
    const fallbackStep = targetStep || workflowStep || 'idle';
    
    try {
      // Update workflow state to fallback step
      if (workflowId) {
        await workflowRepository.updateWorkflowState(
          workflowId,
          fallbackStep,
          {
            recoveryStrategy: RecoveryStrategy.FALLBACK,
            recoveryTimestamp: new Date().toISOString(),
            previousStep: workflowStep,
            previousError: normalizeError(error).message,
            transactionId
          }
        );
        
        // Log fallback event
        await workflowEventSourcing.appendEvent(
          workflowId,
          'recovery_fallback',
          {
            strategy: RecoveryStrategy.FALLBACK,
            fromStep: workflowStep,
            toStep: fallbackStep,
            timestamp: new Date().toISOString(),
            transactionId
          }
        );
      }
      
      return Result.success({
        success: true,
        strategy: RecoveryStrategy.FALLBACK,
        newStep: fallbackStep,
        details: {
          message: 'Fallback successfully applied',
          workflowId,
          fromStep: workflowStep,
          toStep: fallbackStep
        }
      });
    } catch (fallbackError) {
      return Result.failure(
        `Fallback failed: ${normalizeError(fallbackError).message}`,
        'FALLBACK_FAILED',
        {
          workflowId,
          transactionId,
          originalError: error,
          fallbackError
        }
      );
    }
  }

  /**
   * Reset to a known good state
   */
  private async resetToKnownGoodState(
    context: ErrorContext,
    targetStep?: WorkflowStep,
    options: RecoveryOptions = {}
  ): Promise<Result<RecoveryResult>> {
    const { workflowId, transactionId, workflowStep } = context;
    
    // Determine reset step - default to 'idle' as the safest option
    const resetStep = targetStep || 'idle';
    
    try {
      // Update workflow state to reset step
      if (workflowId) {
        await workflowRepository.updateWorkflowState(
          workflowId,
          resetStep,
          {
            recoveryStrategy: RecoveryStrategy.RESET,
            recoveryTimestamp: new Date().toISOString(),
            previousStep: workflowStep,
            reset: true,
            transactionId
          },
          { forceUpdate: true } // Force update to bypass normal validation
        );
        
        // Log reset event
        await workflowEventSourcing.appendEvent(
          workflowId,
          'recovery_reset',
          {
            strategy: RecoveryStrategy.RESET,
            fromStep: workflowStep,
            toStep: resetStep,
            timestamp: new Date().toISOString(),
            transactionId
          }
        );
      }
      
      return Result.success({
        success: true,
        strategy: RecoveryStrategy.RESET,
        newStep: resetStep,
        details: {
          message: 'Successfully reset to known good state',
          workflowId,
          fromStep: workflowStep,
          toStep: resetStep
        }
      });
    } catch (resetError) {
      return Result.failure(
        `Reset failed: ${normalizeError(resetError).message}`,
        'RESET_FAILED',
        {
          workflowId,
          transactionId,
          resetStep,
          resetError
        }
      );
    }
  }

  /**
   * Delegate recovery to human or another system
   */
  private async delegateRecovery(
    error: unknown,
    context: ErrorContext,
    options: RecoveryOptions = {}
  ): Promise<Result<RecoveryResult>> {
    const { workflowId, transactionId, workflowStep } = context;
    
    try {
      // Set workflow to error state to signal human intervention needed
      if (workflowId) {
        const errorStep = DomainOnlyWorkflowStep.ERROR;
        
        await workflowRepository.updateWorkflowState(
          workflowId,
          errorStep,
          {
            error: normalizeError(error).message,
            errorTimestamp: new Date().toISOString(),
            needsHumanIntervention: true,
            recoveryOptions: this.getRecoveryPaths(workflowStep || 'idle', ErrorCategorizer.categorize(error, context)),
            originalStep: workflowStep,
            transactionId
          }
        );
        
        // Log delegation event
        await workflowEventSourcing.appendEvent(
          workflowId,
          'recovery_delegate',
          {
            strategy: RecoveryStrategy.DELEGATE,
            fromStep: workflowStep,
            toStep: errorStep,
            timestamp: new Date().toISOString(),
            transactionId
          }
        );
      }
      
      return Result.success({
        success: true,
        strategy: RecoveryStrategy.DELEGATE,
        newStep: DomainOnlyWorkflowStep.ERROR,
        details: {
          message: 'Recovery delegated to user',
          requiresUserAction: true,
          workflowId,
          transactionId
        }
      });
    } catch (delegateError) {
      return Result.failure(
        `Delegation failed: ${normalizeError(delegateError).message}`,
        'DELEGATION_FAILED',
        {
          workflowId,
          transactionId,
          originalError: error,
          delegateError
        }
      );
    }
  }

  /**
   * Determine the target step for recovery
   */
  private determineTargetStep(
    strategy: RecoveryStrategy,
    context: ErrorContext
  ): WorkflowStep {
    const { workflowStep, previousStep } = context;
    
    switch (strategy) {
      case RecoveryStrategy.RETRY:
        // For retry, use the current step
        return workflowStep || 'idle';
        
      case RecoveryStrategy.FALLBACK:
        // For fallback, use the previous step if available
        return previousStep || 'idle';
        
      case RecoveryStrategy.RESET:
        // For reset, use a known good state
        return 'idle';
        
      case RecoveryStrategy.DELEGATE:
        // For delegation, use error step
        return DomainOnlyWorkflowStep.ERROR;
        
      default:
        return 'idle';
    }
  }
}

/**
 * The unified error handler service
 */
export class UnifiedErrorHandler {
  private readonly logger = logger.withMetadata({ module: 'UnifiedErrorHandler' });
  private readonly recovery: ErrorRecovery;
  private notifier: ((error: unknown, context: ErrorContext) => Promise<void>) | null = null;

  constructor() {
    this.recovery = new ErrorRecovery();
  }

  /**
   * Set a notifier function for errors
   */
  public setNotifier(notifier: (error: unknown, context: ErrorContext) => Promise<void>): void {
    this.notifier = notifier;
  }

  /**
   * Handle an error with comprehensive error processing
   */
  public async handleError(
    error: unknown,
    context: ErrorContext,
    options: ErrorHandlingOptions = {}
  ): Promise<Result<{
    category: ErrorCategory;
    severity: ErrorSeverity;
    recoveryResult?: RecoveryResult;
  }>> {
    try {
      // Ensure context has a timestamp
      if (!context.timestamp) {
        context.timestamp = new Date().toISOString();
      }

      // Normalize the error
      const normalizedError = normalizeError(error);

      // Categorize the error
      const category = ErrorCategorizer.categorize(normalizedError, context);
      const severity = ErrorCategorizer.determineSeverity(category, context);

      // Log the error if requested
      if (options.log !== false) {
        this.logError(normalizedError, category, severity, context);
      }

      // Record error in workflow state if requested and we have a workflowId
      if (options.updateWorkflowState !== false && context.workflowId) {
        await this.updateWorkflowErrorState(normalizedError, category, context);
      }

      // Send notification if requested
      if (options.notify !== false && this.notifier) {
        // Use try/catch to prevent notification failures from stopping error handling
        try {
          await this.notifier(error, context);
        } catch (notifyError) {
          this.logger.warn('Error notification failed', {
            error: normalizedError.message,
            notifyError: notifyError instanceof Error ? notifyError.message : String(notifyError)
          });
        }
      }

      // Attempt recovery if requested
      let recoveryResult: RecoveryResult | undefined;
      if (options.attemptRecovery !== false) {
        const recoveryResultObject = await this.recovery.attemptRecovery(
          error,
          context,
          options.recoveryOptions
        );

        if (recoveryResultObject.isSuccess()) {
          recoveryResult = recoveryResultObject.value;
        } else {
          // Log recovery failure but continue
          this.logger.warn('Recovery attempt failed', {
            error: normalizedError.message,
            recoveryError: recoveryResultObject.error.message,
            workflowId: context.workflowId
          });
        }
      }

      // Return categorized error information along with recovery result if available
      return Result.success({
        category,
        severity,
        recoveryResult
      });
    } catch (handlerError) {
      // Meta-error: the error handler itself failed
      const normalizedMeta = normalizeError(handlerError);
      
      this.logger.error('Error handler failed', {
        originalError: error instanceof Error ? error.message : String(error),
        handlerError: normalizedMeta.message,
        workflowId: context.workflowId
      });

      return Result.failure(
        `Error handling failed: ${normalizedMeta.message}`,
        'ERROR_HANDLER_FAILED',
        {
          originalError: error,
          handlerError,
          workflowId: context.workflowId,
          context
        }
      );
    }
  }

  /**
   * Log an error with all relevant context
   */
  private logError(
    error: ResultError,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: ErrorContext
  ): void {
    // Log based on severity
    const logData = {
      errorMessage: error.message,
      errorCode: error.code,
      category,
      severity,
      workflowId: context.workflowId,
      workflowStep: context.workflowStep,
      transactionId: context.transactionId,
      timestamp: context.timestamp,
      details: context.metadata
    };

    switch (severity) {
      case ErrorSeverity.LOW:
        this.logger.info('Workflow error (LOW)', logData);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn('Workflow error (MEDIUM)', logData);
        break;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.FATAL:
        this.logger.error('Workflow error (HIGH/FATAL)', logData);
        break;
    }

    // Log to workflow events if we have a workflowId
    if (context.workflowId) {
      workflowEventSourcing.appendEvent(
        context.workflowId,
        'error_occurred',
        {
          error: error.message,
          errorCode: error.code,
          category,
          severity,
          workflowStep: context.workflowStep,
          previousStep: context.previousStep,
          timestamp: context.timestamp,
          transactionId: context.transactionId,
          context: context.metadata
        }
      ).catch(eventError => {
        this.logger.warn('Failed to log error event', {
          workflowId: context.workflowId,
          eventError: eventError instanceof Error ? eventError.message : String(eventError)
        });
      });
    }
  }

  /**
   * Update workflow state to reflect the error
   */
  private async updateWorkflowErrorState(
    error: ResultError,
    category: ErrorCategory,
    context: ErrorContext
  ): Promise<void> {
    const { workflowId, workflowStep, transactionId } = context;
    
    if (!workflowId) return;

    try {
      // Determine appropriate error step based on domain
      let errorStep = DomainOnlyWorkflowStep.ERROR;
      
      if (context.domain) {
        // Domain-specific error steps
        const domainErrorSteps: Record<string, WorkflowStep> = {
          'document': 'document_error',
          'verification': 'verification_failed',
          'chat': 'chat_error',
          'report': 'report_generation_error'
        };
        
        if (domainErrorSteps[context.domain]) {
          errorStep = domainErrorSteps[context.domain];
        }
      }
      
      // Update workflow state to error
      await workflowRepository.updateWorkflowState(
        workflowId,
        errorStep,
        {
          error: error.message,
          errorCode: error.code,
          errorCategory: category,
          errorTimestamp: context.timestamp,
          originalStep: workflowStep,
          transactionId,
          recoveryPaths: this.recovery.getRecoveryPaths(workflowStep || 'idle', category),
          domain: context.domain,
          ...context.metadata
        }
      );
    } catch (updateError) {
      this.logger.warn('Failed to update workflow error state', {
        workflowId,
        updateError: updateError instanceof Error ? updateError.message : String(updateError)
      });
    }
  }
}

// Export singleton instance
export const unifiedErrorHandler = new UnifiedErrorHandler();