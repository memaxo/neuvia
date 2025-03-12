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
import { workflowTransactionManager } from '../workflow-transaction-manager'

import type { WorkflowStep, ProcessingPhase } from '@/lib/types/workflow'

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
  /** Format to generate (markdown, html, pdf, etc.) */
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
export class ReportWorkflow {
  private readonly logger = logger.withMetadata({ module: 'ReportWorkflow' });
  
  /**
   * Generate report
   */
  async generateReport(
    workflowId: string,
    options: ReportGenerationOptions
  ): Promise<ReportGenerationResult> {
    try {
      // Start transaction for report generation
      return await workflowTransactionManager.executeTransaction(
        workflowId,
        async (progressCallback, transactionId) => {
          // Get current state
          const currentState = await workflowRepository.getWorkflowState(workflowId);
          if (!currentState) {
            throw new Error('Workflow state not found');
          }
          
          // Determine appropriate source step - report generation can come from multiple steps
          const fromStep: WorkflowStep = currentState.currentStep;
          
          // Get data from state if not provided in options
          const documentId = options.documentId || currentState.metadata?.documentId;
          const patientId = options.patientId || currentState.metadata?.patientId;
          const verificationId = options.verificationId || currentState.metadata?.verificationId;
          
          // Initial progress update
          progressCallback(10, ProcessingPhase.REPORT_GENERATION);
          
          // Update workflow state to report_generation
          await workflowStateManager.transitionState(
            workflowId,
            fromStep,
            'report_generation',
            {
              documentId,
              patientId,
              verificationId,
              reportGenerationStartedAt: new Date().toISOString(),
              userId: options.userId,
              model: options.model,
              formatOptions: options.formatOptions,
              transactionId
            }
          );
          
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

          // Update progress
          progressCallback(90, ProcessingPhase.REPORT_GENERATION);
          
          // Log report generation event
          await workflowEventSourcing.appendEvent(
            workflowId,
            'report_generated',
            {
              reportId,
              documentId,
              patientId,
              verificationId,
              timestamp: new Date().toISOString(),
              userId: options.userId,
              contentLength: reportContent.length,
              model: options.model,
              transactionId
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
              reportGeneratedAt: new Date().toISOString(),
              reportMetadata: {
                contentLength: reportContent.length,
                format: options.formatOptions?.format || 'markdown',
                model: options.model
              },
              transactionId
            }
          );
          
          // Auto-complete workflow if requested
          if (options.autoComplete) {
            await workflowStateManager.completeWorkflow(
              workflowId,
              {
                reportId,
                documentId,
                patientId,
                completedAt: new Date().toISOString(),
                completedBy: options.userId,
                transactionId
              }
            );
          }
          
          // Final progress update
          progressCallback(100, ProcessingPhase.REPORT_GENERATION);
          
          // Return result
          return {
            reportId,
            documentId: documentId as string,
            patientId: patientId as string,
            success: true,
            content: reportContent,
            metadata: {
              generatedAt: new Date().toISOString(),
              userId: options.userId,
              model: options.model,
              format: options.formatOptions?.format || 'markdown',
              contentLength: reportContent.length
            }
          };
        },
        {
          step: 'report_generation',
          metadata: {
            documentId: options.documentId,
            patientId: options.patientId,
            verificationId: options.verificationId,
            userId: options.userId
          },
          onProgress: options.onProgress,
          transactionId: options.transactionId,
          recoveryStep: fromStep => {
            // Determine appropriate recovery step based on source
            if (fromStep === 'verification_completed') {
              return 'verification_completed';
            }
            return 'idle';
          }
        }
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Report generation failed', {
        workflowId,
        options,
        error: normalizedError.message
      });
      
      // Return error result
      return {
        reportId: '',
        documentId: options.documentId,
        patientId: options.patientId,
        success: false,
        metadata: {},
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Format report in different output formats
   */
  async formatReport(
    workflowId: string,
    reportId: string,
    formatOptions: ReportFormatOptions
  ): Promise<ReportGenerationResult> {
    try {
      // Start transaction for report formatting
      return await workflowTransactionManager.executeTransaction(
        workflowId,
        async (progressCallback, transactionId) => {
          // Get current state
          const currentState = await workflowRepository.getWorkflowState(workflowId);
          if (!currentState) {
            throw new Error('Workflow state not found');
          }
          
          // Ensure we're in a valid state for formatting
          if (currentState.currentStep !== 'report_presentation' && 
              currentState.currentStep !== 'complete') {
            throw new ApplicationError({
              message: 'Cannot format report in current workflow state',
              code: 'INVALID_WORKFLOW_STATE',
              data: {
                currentStep: currentState.currentStep,
                expectedSteps: ['report_presentation', 'complete'],
                workflowId,
                reportId
              }
            });
          }
          
          // Ensure this workflow has the correct report ID
          if (currentState.metadata?.reportId !== reportId) {
            throw new ApplicationError({
              message: 'Report ID mismatch',
              code: 'REPORT_ID_MISMATCH',
              data: {
                workflowId,
                reportId,
                currentReportId: currentState.metadata?.reportId
              }
            });
          }
          
          // Get document and patient IDs
          const documentId = currentState.metadata?.documentId;
          const patientId = currentState.metadata?.patientId;
          
          // Update progress
          progressCallback(30, ProcessingPhase.REPORT_FORMATTING);
          
          // Simulate report formatting
          const formattedContent = this.simulateFormatting(
            currentState.metadata?.reportContent || 'No content available',
            formatOptions
          );
          
          // Update progress
          progressCallback(70, ProcessingPhase.REPORT_FORMATTING);
          
          // Log report formatting event
          await workflowEventSourcing.appendEvent(
            workflowId,
            'report_formatted',
            {
              reportId,
              documentId,
              patientId,
              timestamp: new Date().toISOString(),
              format: formatOptions.format,
              contentLength: formattedContent.length,
              transactionId
            }
          );
          
          // Update state with formatting info
          await workflowStateManager.transitionState(
            workflowId,
            currentState.currentStep,
            currentState.currentStep, // Same state but updated metadata
            {
              reportId,
              reportFormattedAt: new Date().toISOString(),
              reportFormats: [...(currentState.metadata?.reportFormats || []), formatOptions.format],
              [`report_${formatOptions.format}`]: {
                contentLength: formattedContent.length,
                generatedAt: new Date().toISOString(),
                formatOptions
              },
              transactionId
            }
          );
          
          // Final progress update
          progressCallback(100, ProcessingPhase.REPORT_FORMATTING);
          
          // Return result
          return {
            reportId,
            documentId: documentId as string,
            patientId: patientId as string,
            success: true,
            content: formattedContent,
            metadata: {
              format: formatOptions.format,
              formattedAt: new Date().toISOString(),
              contentLength: formattedContent.length,
              formatOptions
            }
          };
        },
        {
          step: currentState => currentState.currentStep,
          metadata: {
            reportId,
            format: formatOptions.format
          },
          onProgress: progress => {
            // Simple progress callback
            this.logger.info(`Report formatting progress: ${progress}%`);
          },
          recoveryStep: fromStep => fromStep // Stay in the same state on failure
        }
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Report formatting failed', {
        workflowId,
        reportId,
        formatOptions,
        error: normalizedError.message
      });
      
      // Return error result
      return {
        reportId,
        success: false,
        metadata: {},
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Get report by ID
   */
  async getReport(
    workflowId: string,
    reportId: string
  ): Promise<ReportGenerationResult | null> {
    try {
      // Get workflow state
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state) {
        return null;
      }
      
      // Check if report ID matches
      if (state.metadata?.reportId !== reportId) {
        // Try to find in event history
        const events = await workflowEventSourcing.getEventHistory(workflowId, {
          eventType: ['report_generated', 'report_formatted']
        });
        
        // Find event with this report ID
        for (const event of events) {
          if (event.event_data?.reportId === reportId) {
            // Return basic info from event
            return {
              reportId,
              documentId: event.event_data.documentId,
              patientId: event.event_data.patientId,
              success: true,
              metadata: {
                timestamp: event.occurred_at,
                eventType: event.event_type,
                ...event.event_data
              }
            };
          }
        }
        
        return null;
      }
      
      // Get report content
      const reportContent = state.metadata?.reportContent;
      const documentId = state.metadata?.documentId;
      const patientId = state.metadata?.patientId;
      
      // Return report data
      return {
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
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to get report', {
        workflowId,
        reportId,
        error: normalizedError.message
      });
      return null;
    }
  }
  
  /**
   * Simulate formatting report in different output formats
   */
  private simulateFormatting(content: string, options: ReportFormatOptions): string {
    const { format } = options;
    
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
}

// Export singleton instance
export const reportWorkflow = new ReportWorkflow();