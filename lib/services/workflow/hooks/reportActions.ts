import { DomainActions } from './useGenericWorkflow';
import { ProcessingPhase, DomainOnlyWorkflowStep, WorkflowStep } from '@/lib/types/workflow';
import { Result } from '@/lib/services/workflow/error/result';
import { normalizeError } from '@/lib/errors';
import { createDomainLogger } from '@/lib/services/workflow/infrastructure/workflow-processor-helpers';

// Report-specific input, result, and state types
export interface ReportInput {
  action: 'generate' | 'format' | 'info' | 'reset';
  patientId?: string;
  documentIds?: string[];
  generateType?: string;
  reportId?: string;
  format?: string;
  additionalNotes?: string;
}

export interface ReportResult {
  success: boolean;
  reportId?: string;
  title?: string;
  content?: string;
  format?: string;
  generatedAt?: string;
  documentIds?: string[];
  patientId?: string;
  error?: string;
}

export interface ReportState {
  reportId?: string;
  title?: string;
  content?: string;
  format?: string;
  generateType?: string;
  generatedAt?: string;
  documentIds?: string[];
  patientId?: string;
  status: 'idle' | 'generating' | 'complete' | 'error';
  error?: string;
}

// Create domain-specific logger
const logger = createDomainLogger('Report');

/**
 * Report domain actions configuration
 */
export const reportActions: DomainActions<ReportInput, ReportResult, ReportState> = {
  domainName: 'Report',
  initialStep: 'idle' as WorkflowStep,

  /**
   * Get initial report state
   */
  getInitialState: (): ReportState => ({
    status: 'idle'
  }),

  /**
   * Process report workflow action using Result pattern
   */
  processAction: async (
    input: ReportInput,
    options: {
      workflowId: string;
      userId?: string;
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
    }
  ): Promise<Result<ReportResult>> => {
    const { action } = input;
    const { workflowId, userId, onProgress } = options;

    try {
      // Import report workflow service dynamically to avoid circular dependencies
      const { reportWorkflow } = await import('@/lib/services/workflow/domain/report-workflow');
      
      // Handle different actions
      if (action === 'generate') {
        if (!input.patientId) {
          return Result.failure(
            'Patient ID is required for report generation',
            'MISSING_PARAMETER',
            { missingParams: ['patientId'] }
          );
        }
        
        // Update progress if callback provided
        if (onProgress) {
          onProgress(10, ProcessingPhase.REPORT_GENERATION);
        }
        
        // Generate report
        const result = await reportWorkflow.generateReport(
          workflowId,
          {
            patientId: input.patientId,
            documentIds: input.documentIds,
            generateType: input.generateType || 'comprehensive',
            userId: userId || 'system',
            transactionId: options.transactionId,
            additionalNotes: input.additionalNotes,
            onProgress: progressCallback(onProgress)
          }
        );
        
        // Convert to Result pattern
        if (result.isSuccess()) {
          const data = result.value;
          return Result.success({
            success: true,
            reportId: data.reportId,
            title: data.title,
            content: data.content,
            format: 'markdown', // Default format
            generatedAt: new Date().toISOString(),
            documentIds: input.documentIds,
            patientId: input.patientId
          });
        } else {
          return Result.failure(
            result.error.message,
            result.error.code,
            {
              success: false,
              patientId: input.patientId,
              documentIds: input.documentIds
            }
          );
        }
      }
      else if (action === 'format' && input.reportId && input.format) {
        // Update progress if callback provided
        if (onProgress) {
          onProgress(20, ProcessingPhase.REPORT_FORMATTING);
        }
        
        // Format report
        const result = await reportWorkflow.formatReport(
          workflowId,
          input.reportId,
          input.format,
          {
            onProgress: progressCallback(onProgress)
          }
        );
        
        // Convert to Result pattern
        if (result.isSuccess()) {
          const data = result.value;
          return Result.success({
            success: true,
            reportId: input.reportId,
            content: data.content,
            format: input.format,
            title: data.title
          });
        } else {
          return Result.failure(
            result.error.message,
            result.error.code,
            {
              success: false,
              reportId: input.reportId,
              format: input.format
            }
          );
        }
      }
      else if (action === 'info' && input.reportId) {
        // Get report info
        const result = await reportWorkflow.getReport(
          workflowId,
          input.reportId
        );
        
        // Convert to Result pattern
        if (result.isSuccess()) {
          const data = result.value;
          return Result.success({
            success: true,
            reportId: input.reportId,
            title: data.title,
            content: data.content,
            format: data.format,
            generatedAt: data.generatedAt,
            documentIds: data.documentIds,
            patientId: data.patientId
          });
        } else {
          return Result.failure(
            result.error.message,
            result.error.code,
            {
              success: false,
              reportId: input.reportId
            }
          );
        }
      }
      else if (action === 'reset') {
        // Reset is handled by the base hook reset method
        return Result.success({
          success: true,
          status: 'idle'
        } as any);
      }
      
      // Invalid action
      return Result.failure(
        'Invalid report action',
        'INVALID_ACTION',
        { action }
      );
    } catch (error) {
      const normalizedError = normalizeError(error);
      logger.error('Error processing report action', {
        action: input.action,
        reportId: input.reportId,
        patientId: input.patientId
      }, normalizedError);
      
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'REPORT_PROCESSING_ERROR',
        {
          success: false,
          reportId: input.reportId,
          patientId: input.patientId
        }
      );
    }
  },
  
  /**
   * Create error result for failed operations
   */
  createErrorResult: (error: Error, input: ReportInput): ReportResult => {
    return {
      success: false,
      reportId: input.reportId,
      patientId: input.patientId,
      documentIds: input.documentIds,
      error: error.message
    };
  },
  
  /**
   * Process result to update state
   */
  processResult: (
    result: ReportResult,
    currentState: ReportState
  ): ReportState => {
    if (!result.success) {
      return {
        ...currentState,
        error: result.error,
        status: 'error'
      };
    }
    
    return {
      ...currentState,
      reportId: result.reportId || currentState.reportId,
      title: result.title || currentState.title,
      content: result.content || currentState.content,
      format: result.format || currentState.format,
      generatedAt: result.generatedAt || currentState.generatedAt,
      documentIds: result.documentIds || currentState.documentIds,
      patientId: result.patientId || currentState.patientId,
      status: result.reportId ? 'complete' : 'idle',
      error: undefined
    };
  },
  
  /**
   * Error categories for specialized handling
   */
  errorCategories: {
    formatError: (error) =>
      error.message.includes('format') ||
      error.code?.includes('FORMAT'),
    dataError: (error) =>
      error.message.includes('data') ||
      error.message.includes('missing') ||
      error.code?.includes('DATA'),
    templateError: (error) =>
      error.message.includes('template') ||
      error.code?.includes('TEMPLATE')
  },
  
  /**
   * Error recovery strategies keyed by category
   */
  errorRecoveryStrategies: {
    // Retry format errors with fallback format
    formatError: async (error, input, options) => {
      if (input.action !== 'format' || !input.reportId) {
        return Result.failure(
          'Cannot recover from format error for this action',
          'RECOVERY_NOT_SUPPORTED',
          { action: input.action }
        );
      }
      
      logger.info('Attempting to recover from format error with fallback format', {
        reportId: input.reportId,
        originalFormat: input.format
      });
      
      // Import report workflow to retry with fallback format
      const { reportWorkflow } = await import('@/lib/services/workflow/domain/report-workflow');
      
      // Use markdown as fallback format
      const fallbackFormat = 'markdown';
      
      return reportWorkflow.formatReport(
        options.workflowId,
        input.reportId,
        fallbackFormat,
        {
          useFallback: true
        }
      ).then(result => {
        if (result.isSuccess()) {
          const data = result.value;
          return Result.success({
            success: true,
            reportId: input.reportId,
            content: data.content,
            format: fallbackFormat,
            title: data.title
          });
        } else {
          return Result.failure(
            result.error.message,
            result.error.code,
            { success: false }
          );
        }
      });
    }
  },
  
  /**
   * Hook called before processing an action
   */
  beforeProcess: async (input: ReportInput, options) => {
    logger.info('Starting report operation', {
      action: input.action,
      reportId: input.reportId,
      patientId: input.patientId,
      workflowId: options.workflowId
    });
  },
  
  /**
   * Hook called after processing an action
   */
  afterProcess: async (result, input, options) => {
    if (result.isSuccess()) {
      logger.info('Report operation completed successfully', {
        action: input.action,
        reportId: result.value.reportId || input.reportId,
        workflowId: options.workflowId
      });
    } else {
      logger.warn('Report operation completed with errors', {
        action: input.action,
        error: result.error.message,
        reportId: input.reportId,
        workflowId: options.workflowId
      });
    }
  }
};

/**
 * Helper to create a progress callback that maps progress to handler
 */
function progressCallback(onProgress?: (progress: number, phase: ProcessingPhase) => void) {
  return onProgress
    ? (progress: number, phase: ProcessingPhase) => {
        onProgress(progress, phase);
      }
    : undefined;
}