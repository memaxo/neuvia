import { normalizeError } from '@/lib/errors';
import type { WorkflowStep } from '@/lib/types/workflow';
import type { ApplicationError } from '@/lib/errors';
import { WorkflowStepMapper } from './utils/step-mapper';

export interface ErrorContextOptions {
  error: string;
  errorType?: string;
  errorCode?: string;
  currentStep: WorkflowStep;
  previousStep?: WorkflowStep;
  recoveryPaths?: WorkflowStep[];
  details?: Record<string, unknown>;
}

import { ErrorCategory } from '@/lib/errors';

export interface WorkflowErrorContext {
  errorMessage: string;
  originalError?: unknown;
  errorCode?: string;
  errorType: ErrorCategory;
  workflowStep: WorkflowStep;
  previousStep?: WorkflowStep;
  recoveryPaths?: WorkflowStep[];
  timestamp: string;
  userAgent?: string;
  clientId?: string;
  details?: Record<string, unknown>;
}

/**
 * Builds detailed context objects for workflow errors
 */
export class WorkflowErrorContextBuilder {
  /**
   * Build a complete error context object with environment information
   */
  buildErrorContext(options: ErrorContextOptions): WorkflowErrorContext {
    const {
      error,
      errorType = 'system',
      errorCode = 'UNKNOWN_ERROR',
      currentStep,
      previousStep,
      recoveryPaths,
      details = {}
    } = options;
    
    // Normalize the error type to a known value
    const normalizedType = this.normalizeErrorType(errorType);
    
    // Determine domain from current step if available
    const domain = WorkflowStepMapper.getDomainFromStep(currentStep);
    
    // Enhance details with domain-specific information
    const enhancedDetails = {
      ...details,
      domain,
      domainErrorStep: domain ? WorkflowStepMapper.getDomainErrorStep(domain) : undefined,
      isStepInDomain: domain ? true : false
    };
    
    return {
      errorMessage: error,
      errorCode,
      errorType: normalizedType,
      workflowStep: currentStep,
      previousStep,
      recoveryPaths,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      clientId: typeof localStorage !== 'undefined'
        ? localStorage.getItem('neuvia_client_id') ?? undefined
        : undefined,
      details: enhancedDetails
    };
  }
  
  /**
   * Map string error types to ErrorCategory enum values
   */
  private normalizeErrorType(
    errorType?: string
  ): ErrorCategory {
    if (!errorType) return ErrorCategory.UNKNOWN;
    
    switch (errorType.toLowerCase()) {
      case 'validation':
      case 'invalid':
        return ErrorCategory.VALIDATION;
      case 'network':
      case 'connection':
      case 'fetch':
        return ErrorCategory.NETWORK;
      case 'permission':
      case 'unauthorized':
      case 'forbidden':
        return ErrorCategory.PERMISSION;
      case 'timeout':
        return ErrorCategory.TIMEOUT;
      case 'system':
        return ErrorCategory.SYSTEM;
      case 'workflow':
        return ErrorCategory.WORKFLOW;
      case 'transaction':
        return ErrorCategory.TRANSACTION;
      case 'data':
      case 'database':
        return ErrorCategory.DATA;
      case 'concurrency':
        return ErrorCategory.CONCURRENCY;
      default:
        return ErrorCategory.UNKNOWN;
    }
  }
  
  /**
   * Build context for workflow state update operations
   */
  buildUpdateErrorContext(
    error: unknown,
    workflowId: string,
    fromStep?: WorkflowStep,
    toStep?: WorkflowStep,
    metadata?: Record<string, unknown>
  ): Record<string, unknown> {
    const normalizedError = normalizeError(error);
    
    return {
      workflowId,
      operation: 'update',
      fromStep: fromStep || 'unknown',
      toStep: toStep || 'unknown',
      errorCode: normalizedError.code || 'UNKNOWN_ERROR',
      errorMessage: normalizedError.message,
      timestamp: new Date().toISOString(),
      metadata: metadata ? JSON.stringify(metadata).substring(0, 200) : undefined,
      // Include original error for detailed logging
      originalError: normalizedError
    };
  }
  
  /**
   * Build context for workflow creation operations
   */
  buildCreateErrorContext(
    error: unknown,
    userId: string,
    initialStep: WorkflowStep,
    metadata?: Record<string, unknown>
  ): Record<string, unknown> {
    const normalizedError = normalizeError(error);
    
    return {
      userId,
      operation: 'create',
      initialStep,
      errorCode: normalizedError.code || 'UNKNOWN_ERROR',
      errorMessage: normalizedError.message,
      timestamp: new Date().toISOString(),
      metadata: metadata ? JSON.stringify(metadata).substring(0, 200) : undefined,
      originalError: normalizedError
    };
  }

  /**
   * Build context for workflow query operations
   */
  buildQueryErrorContext(
    error: unknown,
    workflowId: string,
    operation: string
  ): Record<string, unknown> {
    const normalizedError = normalizeError(error);
    
    return {
      workflowId,
      operation,
      errorCode: normalizedError.code || 'UNKNOWN_ERROR',
      errorMessage: normalizedError.message,
      timestamp: new Date().toISOString(),
      originalError: normalizedError
    };
  }
}