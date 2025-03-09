import { normalizeError } from '@/lib/errors';
import type { WorkflowStep } from '@/lib/types/workflow';
import type { ApplicationError } from '@/lib/errors';

/**
 * Builds detailed context objects for workflow errors
 */
export class WorkflowErrorContextBuilder {
  /**
   * Build context for workflow state update operations
   */
  static buildUpdateErrorContext(
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
  static buildCreateErrorContext(
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
  static buildQueryErrorContext(
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