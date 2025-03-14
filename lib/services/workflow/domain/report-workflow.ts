/**
 * @fileoverview Report Workflow Processor
 * 
 * Handles all report-related workflow operations including:
 * - Report generation
 * - Report formatting
 * - Report storage and retrieval
 */

import { ApplicationError, normalizeError } from '@/lib/errors'
import logger from '@/lib/logger'
import { workflowRepository } from '../infrastructure/workflow-repository'
import { workflowStateManager } from '../infrastructure/workflow-state-manager'
import { workflowEventSourcing } from '../infrastructure/workflow-event-source'
import { BaseWorkflowProcessor } from '../base/base-workflow-processor'
import { Result } from '../error/result'

import type { WorkflowStep, ProcessingPhase, WorkflowState } from '@/lib/types/workflow'
import type { WorkflowProcessOptions } from '../base/base-workflow-processor'

/**
 * Report generation result
 */
export interface ReportGenerationResult {
  /** Report ID */
  reportId: string;
  /** Document ID */
  documentId?: string;
  /** Patient ID */
  patientId?: string;
  /** Whether generation was successful */
  success: boolean;
  /** Report content */
  content?: string;
  /** Report metadata */
  metadata: Record<string, unknown>;
  /** Error message if generation failed */
  error?: string;
}

/**
 * Report format options
 */
export interface ReportFormatOptions {
  /** Format to generate (markdown, html, pdf, docx) */
  format: 'markdown' | 'html' | 'pdf' | 'docx';
  /** Format-specific options */
  formatOptions?: Record<string, unknown>;
  /** Whether to include citations */
  includeCitations?: boolean;
  /** Whether to include appendices */
  includeAppendices?: boolean;
  /** Whether to include references */
  includeReferences?: boolean;
}

/**
 * Report generation options
 */
export interface ReportGenerationOptions {
  /** User ID who initiated report generation */
  userId: string;
  /** Patient ID associated with report */
  patientId?: string;
  /** Document ID associated with report */
  documentId?: string;
  /** Verification ID if report is based on verified data */
  verificationId?: string;
  /** Model to use for generation */
  model?: string;
  /** Format options */
  formatOptions?: ReportFormatOptions;
  /** Whether to auto-complete workflow after generation */
  autoComplete?: boolean;
  /** Progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
  /** Transaction ID for tracking */
  transactionId?: string;
}

/**
 * Report workflow processor
 */
export class ReportWorkflow extends BaseWorkflowProcessor<ReportGenerationOptions, ReportGenerationResult> {
  constructor() {
    super('Report', 'error');
  }
  
  /**
   * Generate report
   * Returns Result<ReportGenerationResult> for consistent error handling
   */
  async generateReport(
    workflowId: string,
    options: ReportGenerationOptions
  ): Promise<Result<ReportGenerationResult>> {
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'WORKFLOW_INVALID_ID',
        { options }
      );
    }
    
    if (!options.userId) {
      return Result.failure(
        'User ID is required',
        'USER_INVALID_ID',
        { workflowId }
      );
    }
    
    // Validate that at least one ID is provided 
    if (!options.documentId && !options.patientId && !options.verificationId) {
      return Result.failure(
        'At least one of documentId, patientId, or verificationId is required',
        'INVALID_REPORT_SOURCE',
        { workflowId, userId: options.userId }
      );
    }
    
    // Use the base process method with domain-specific input
    return this.process(
      workflowId,
      options,
      {
        targetStep: 'report_generation',
        metadata: {
          documentId: options.documentId,
          patientId: options.patientId,
          verificationId: options.verificationId,
          userId: options.userId,
          model: options.model,
          formatOptions: options.formatOptions
        },
        onProgress: options.onProgress,
        transactionId: options.transactionId,
        recoveryStep: currentState => {
          // Determine appropriate recovery step based on source
          if (currentState.currentStep === 'verification_completed') {
            return 'verification_completed';
          }
          return 'idle';
        }
      }
    );
  }
  
  /**
   * Format report in different output formats
   * Returns Result<ReportGenerationResult> for consistent error handling
   */
  async formatReport(
    workflowId: string,
    reportId: string,
    formatOptions: ReportFormatOptions
  ): Promise<Result<ReportGenerationResult>> {
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'WORKFLOW_INVALID_ID',
        { reportId, formatOptions }
      );
    }
    
    if (!reportId) {
      return Result.failure(
        'Report ID is required',
        'REPORT_INVALID_ID',
        { workflowId, formatOptions }
      );
    }
    
    if (!formatOptions || !formatOptions.format) {
      return Result.failure(
        'Valid format options are required',
        'FORMAT_OPTIONS_INVALID',
        { workflowId, reportId }
      );
    }
    
    try {
      // Get current state to verify the report ID using Result pattern
      const stateResult = await Result.fromPromise(
        workflowRepository.getWorkflowState(workflowId)
      );
      
      if (stateResult.isFailure()) {
        return Result.failure(
          `Failed to retrieve workflow state: ${stateResult.error.message}`,
          stateResult.error.code,
          { workflowId, reportId, formatOptions }
        );
      }
      
      const currentState = stateResult.value;
      if (!currentState) {
        return Result.failure(
          'Workflow state not found',
          'WORKFLOW_STATE_NOT_FOUND',
          { workflowId, reportId }
        );
      }
      
      // Ensure we're in a valid state for formatting
      if (currentState.currentStep !== 'report_presentation' &&
          currentState.currentStep !== 'complete') {
        return Result.failure(
          'Cannot format report in current workflow state',
          'INVALID_WORKFLOW_STATE',
          {
            currentStep: currentState.currentStep,
            expectedSteps: ['report_presentation', 'complete'],
            workflowId,
            reportId
          }
        );
      }
      
      // Ensure this workflow has the correct report ID
      if (currentState.metadata?.reportId !== reportId) {
        return Result.failure(
          'Report ID mismatch',
          'REPORT_ID_MISMATCH',
          {
            workflowId,
            reportId,
            currentReportId: currentState.metadata?.reportId
          }
        );
      }
      
      // Extract user ID from state
      const userId = currentState.metadata?.userId as string;
      if (!userId) {
        return Result.failure(
          'User ID not found in workflow state',
          'USER_ID_NOT_FOUND',
          { workflowId, reportId }
        );
      }
      
      // Use the base process method with domain-specific input
      return this.process(
        workflowId,
        {
          userId,
          documentId: currentState.metadata?.documentId as string,
          patientId: currentState.metadata?.patientId as string,
          formatOptions
        },
        {
          targetStep: currentState.currentStep,
          metadata: {
            reportId,
            format: formatOptions.format
          },
          onProgress: progress => {
            // Simple progress callback for report formatting
            logger.info(`Report formatting progress: ${progress}%`);
          },
          recoveryStep: currentState.currentStep
        }
      );
    } catch (error) {
      // Convert unexpected errors to Result failures
      const normalizedError = normalizeError(error);
      return Result.failure(
        `Failed to format report: ${normalizedError.message}`,
        normalizedError.code || 'REPORT_FORMATTING_ERROR',
        {
          workflowId,
          reportId,
          format: formatOptions.format,
          error: normalizedError
        }
      );
    }
  }
  
  /**
   * Get report by ID - read-only operation
   * Returns Result<ReportGenerationResult | null> for consistent error handling
   */
  async getReport(
    workflowId: string,
    reportId: string
  ): Promise<Result<ReportGenerationResult | null>> {
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'WORKFLOW_INVALID_ID',
        { reportId }
      );
    }
    
    if (!reportId) {
      return Result.failure(
        'Report ID is required',
        'REPORT_INVALID_ID',
        { workflowId }
      );
    }
    
    try {
      // Get workflow state using Result pattern
      const stateResult = await Result.fromPromise(
        workflowRepository.getWorkflowState(workflowId)
      );
      
      if (stateResult.isFailure()) {
        return Result.failure(
          `Failed to retrieve workflow state: ${stateResult.error.message}`,
          stateResult.error.code,
          { workflowId, reportId }
        );
      }
      
      const state = stateResult.value;
      if (!state) {
        // Not an error, just no state found
        return Result.success(null);
      }
      
      // Check if report ID matches
      if (state.metadata?.reportId !== reportId) {
        // Try to find in event history using Result pattern
        const eventsResult = await Result.fromPromise(
          workflowEventSourcing.getEventHistory(workflowId, {
            eventType: ['report_generated', 'report_formatted']
          })
        );
        
        if (eventsResult.isFailure()) {
          return Result.failure(
            `Failed to retrieve event history: ${eventsResult.error.message}`,
            eventsResult.error.code,
            { workflowId, reportId }
          );
        }
        
        const events = eventsResult.value;
        
        // Find event with this report ID
        for (const event of events) {
          if (event.event_data?.reportId === reportId) {
            // Return basic info from event
            return Result.success({
              reportId,
              documentId: event.event_data.documentId,
              patientId: event.event_data.patientId,
              success: true,
              metadata: {
                timestamp: event.occurred_at,
                eventType: event.event_type,
                ...event.event_data
              }
            });
          }
        }
        
        // Not an error, just no report found with this ID
        return Result.success(null);
      }
      
      // Get report content
      const reportContent = state.metadata?.reportContent;
      const documentId = state.metadata?.documentId;
      const patientId = state.metadata?.patientId;
      
      // Return report data wrapped in a success Result
      return Result.success({
        reportId,
        documentId: documentId as string,
        patientId: patientId as string,
        success: true,
        content: reportContent as string,
        metadata: {
          generatedAt: state.metadata?.reportGeneratedAt,
          formats: state.metadata?.reportFormats,
          ...state.metadata
        }
      });
    } catch (error) {
      // Convert unexpected errors to Result failures
      const normalizedError = normalizeError(error);
      logger.error('Failed to get report', {
        workflowId,
        reportId,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to get report: ${normalizedError.message}`,
        normalizedError.code || 'REPORT_RETRIEVAL_ERROR',
        {
          workflowId,
          reportId,
          error: normalizedError
        }
      );
    }
  }
  
  /**
   * Implementation of required abstract method for domain-specific processing
   */
  protected async doProcess(
    workflowId: string,
    input: ReportGenerationOptions,
    currentState: WorkflowState,
    options: WorkflowProcessOptions & {
      progressCallback?: (progress: number, phase: ProcessingPhase) => void;
    }
  ): Promise<ReportGenerationResult> {
    const progressCallback = options.progressCallback || (() => {});
    const { userId, documentId, patientId, verificationId, model, formatOptions, autoComplete } = input;
    
    // Handle different operations based on current state and metadata
    
    // Case 1: Report generation flow
    if (currentState.currentStep === 'report_generation' ||
        currentState.currentStep === 'verification_completed') {
      
      // Initial progress
      progressCallback(10, ProcessingPhase.REPORT_GENERATION);
      
      // Generate report ID
      const reportId = `report-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      
      // Update progress during "processing"
      progressCallback(30, ProcessingPhase.REPORT_GENERATION);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      progressCallback(50, ProcessingPhase.REPORT_GENERATION);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      progressCallback(70, ProcessingPhase.REPORT_GENERATION);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Simulate report content generation
      const reportContent = `
# Medical Report
## Patient Information
PatientID: ${patientId || 'Unknown'}

## Document Analysis
DocumentID: ${documentId || 'Unknown'}

## Report Summary
This is a sample generated report for demonstration purposes.

## Findings
- Finding 1: Sample finding
- Finding 2: Another sample finding

## Recommendations
1. First recommendation
2. Second recommendation

## Generated on: ${new Date().toISOString()}
Report ID: ${reportId}
`;

      // Log report generation event
      await this.logEvent(
        workflowId,
        'report_generated',
        {
          reportId,
          documentId,
          patientId,
          verificationId,
          userId,
          contentLength: reportContent.length,
          model,
          transactionId: options.transactionId
        }
      );
      
      // Transition to report presentation
      await workflowStateManager.transitionState(
        workflowId,
        'report_generation',
        'report_presentation',
        {
          reportId,
          documentId,
          patientId,
          reportContent,
          reportGeneratedAt: new Date().toISOString(),
          reportMetadata: {
            contentLength: reportContent.length,
            format: formatOptions?.format || 'markdown',
            model
          },
          transactionId: options.transactionId
        }
      );
      
      // Auto-complete workflow if requested
      if (autoComplete) {
        await workflowStateManager.completeWorkflow(
          workflowId,
          {
            reportId,
            documentId,
            patientId,
            completedAt: new Date().toISOString(),
            completedBy: userId,
            transactionId: options.transactionId
          }
        );
      }
      
      // Final progress update
      progressCallback(100, ProcessingPhase.REPORT_GENERATION);
      
      // Return result
      return {
        reportId,
        documentId,
        patientId,
        success: true,
        content: reportContent,
        metadata: {
          generatedAt: new Date().toISOString(),
          userId,
          model,
          format: formatOptions?.format || 'markdown',
          contentLength: reportContent.length
        }
      };
    }
    // Case 2: Report formatting flow
    else if ((currentState.currentStep === 'report_presentation' ||
              currentState.currentStep === 'complete') &&
              formatOptions) {
      
      const reportId = currentState.metadata?.reportId as string;
      const reportContent = currentState.metadata?.reportContent as string;
      
      if (!reportId || !reportContent) {
        throw new ApplicationError({
          message: 'Report content or ID not found in workflow state',
          code: 'REPORT_CONTENT_MISSING',
          data: {
            workflowId,
            currentStep: currentState.currentStep
          }
        });
      }
      
      // Update progress
      progressCallback(30, ProcessingPhase.REPORT_FORMATTING);
      
      // Simulate report formatting
      const formattedContent = this.formatReportContent(
        reportContent,
        formatOptions
      );
      
      // Update progress
      progressCallback(70, ProcessingPhase.REPORT_FORMATTING);
      
      // Log report formatting event
      await this.logEvent(
        workflowId,
        'report_formatted',
        {
          reportId,
          documentId,
          patientId,
          format: formatOptions.format,
          contentLength: formattedContent.length,
          transactionId: options.transactionId
        }
      );
      
      // Transition to report_presentation with the updated format
      await workflowStateManager.transitionState(
        workflowId,
        currentState.currentStep,
        'report_presentation',
        {
          reportId,
          reportFormattedAt: new Date().toISOString(),
          reportFormats: [...(currentState.metadata?.reportFormats || []), formatOptions.format],
          [`report_${formatOptions.format}`]: {
            contentLength: formattedContent.length,
            generatedAt: new Date().toISOString(),
            formatOptions
          },
          formattedContent: formattedContent,
          currentFormat: formatOptions.format,
          transactionId: options.transactionId
        }
      );
      
      // Final progress update
      progressCallback(100, ProcessingPhase.REPORT_FORMATTING);
      
      // Return result
      return {
        reportId,
        documentId,
        patientId,
        success: true,
        content: formattedContent,
        metadata: {
          format: formatOptions.format,
          formattedAt: new Date().toISOString(),
          contentLength: formattedContent.length,
          formatOptions
        }
      };
    }
    else {
      throw new ApplicationError({
        message: 'Unsupported report operation',
        code: 'UNSUPPORTED_REPORT_OPERATION',
        data: {
          currentStep: currentState.currentStep,
          input
        }
      });
    }
  }
  
  /**
   * Format report content in different output formats
   * Uses integration with report formatters when possible
   */
  private formatReportContent(content: string, options: ReportFormatOptions): string {
    const { format } = options;
    
    // In a production implementation, this would use the report formatter service
    // For now, we'll use a simple simulation
    
    switch (format) {
      case 'html':
        return `
<!DOCTYPE html>
<html>
<head>
  <title>Medical Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #2c3e50; }
    h2 { color: #3498db; }
  </style>
</head>
<body>
  ${content.replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
            .split('\n\n').join('<p>')}
</body>
</html>`;
      
      case 'pdf':
        // In a real implementation, this would convert to PDF
        return `[PDF CONTENT SIMULATION] ${content}`;
      
      case 'docx':
        // In a real implementation, this would convert to DOCX
        return `[DOCX CONTENT SIMULATION] ${content}`;
      
      case 'markdown':
      default:
        return content;
    }
  }
  
  /**
   * Process verification completion and trigger report generation
   * This is a cross-domain workflow transition handler
   */
  async processVerificationCompletion(
    workflowId: string,
    verificationId: string,
    options: {
      userId: string;
      patientId?: string;
      documentId?: string;
      autoGenerateReport?: boolean;
      transactionId?: string;
    }
  ): Promise<Result<ReportGenerationResult>> {
    try {
      const { userId, patientId, documentId, autoGenerateReport = true, transactionId } = options;
      
      // Log transition event
      await this.logEvent(
        workflowId,
        'verification_completion_processed',
        {
          verificationId,
          documentId,
          patientId,
          userId,
          transactionId,
          timestamp: new Date().toISOString()
        }
      );
      
      // If auto-generate report is enabled, start report generation
      if (autoGenerateReport) {
        return await this.generateReport(workflowId, {
          userId,
          patientId,
          documentId,
          verificationId,
          autoComplete: true,
          transactionId
        });
      }
      
      // Otherwise, return a placeholder result
      return Result.success({
        reportId: '',
        documentId,
        patientId,
        success: true,
        metadata: {
          verificationId,
          userId,
          message: 'Verification completed, ready for report generation',
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Failed to process verification completion', {
        workflowId,
        verificationId,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to process verification completion: ${normalizedError.message}`,
        normalizedError.code || 'VERIFICATION_PROCESSING_ERROR',
        {
          workflowId,
          verificationId,
          ...options
        }
      );
    }
  }
  
  /**
   * Process research completion and generate report
   * This is a cross-domain workflow transition handler
   */
  async processResearchCompletion(
    workflowId: string,
    researchId: string,
    researchData: Record<string, unknown>,
    options: {
      userId: string;
      patientId?: string;
      autoGenerateReport?: boolean;
      transactionId?: string;
    }
  ): Promise<Result<ReportGenerationResult>> {
    try {
      const { userId, patientId, autoGenerateReport = true, transactionId } = options;
      
      // Log transition event
      await this.logEvent(
        workflowId,
        'research_completion_processed',
        {
          researchId,
          patientId,
          userId,
          transactionId,
          timestamp: new Date().toISOString()
        }
      );
      
      // If auto-generate report is enabled, start report generation
      if (autoGenerateReport) {
        return await this.generateReport(workflowId, {
          userId,
          patientId,
          autoComplete: true,
          transactionId,
          // Include research data in metadata
          formatOptions: {
            format: 'markdown',
            includeCitations: true,
            includeReferences: true
          }
        });
      }
      
      // Otherwise, return a placeholder result
      return Result.success({
        reportId: '',
        patientId,
        success: true,
        metadata: {
          researchId,
          userId,
          message: 'Research completed, ready for report generation',
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Failed to process research completion', {
        workflowId,
        researchId,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to process research completion: ${normalizedError.message}`,
        normalizedError.code || 'RESEARCH_PROCESSING_ERROR',
        {
          workflowId,
          researchId,
          ...options
        }
      );
    }
  }
}

// Export singleton instance
export const reportWorkflow = new ReportWorkflow();