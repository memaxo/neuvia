import { useCallback } from 'react'
import { ProcessingPhase } from '@/lib/types/workflow'
import { reportActions, ReportInput, ReportResult, ReportState } from './reportActions'
import { useGenericWorkflow, UseGenericWorkflowOptions } from './useGenericWorkflow'

/**
 * Options for generating a report
 */
export interface ReportGenerationOptions {
  patientId: string;
  documentIds?: string[];
  generateType?: string;
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
}

/**
 * Specialized hook for report generation workflows.
 * Uses the generic workflow hook with report-specific actions.
 */
export function useReportWorkflow(options: UseGenericWorkflowOptions = {}) {
  // Use the generic workflow hook with report actions
  const genericWorkflow = useGenericWorkflow<ReportInput, ReportResult, ReportState>(
    reportActions,
    {
      userId: options.userId,
      chatId: options.chatId,
      initialStep: options.initialStep,
      autoLoad: options.autoLoad ?? true
    }
  );
  
  /**
   * Generate a new report
   */
  const generateReport = useCallback(async (
    options: ReportGenerationOptions
  ): Promise<ReportResult> => {
    return genericWorkflow.process(
      {
        action: 'generate',
        patientId: options.patientId,
        documentIds: options.documentIds,
        generateType: options.generateType || 'comprehensive'
      },
      {
        step: 'report_generation',
        successStep: 'complete',
        onProgress: options.onProgress,
        metadata: {
          patientId: options.patientId,
          documentIds: options.documentIds,
          generateType: options.generateType,
          generationStartedAt: new Date().toISOString()
        },
        transactionOptions: {
          isolationLevel: 'read_committed',
          retryCount: 1
        }
      }
    );
  }, [genericWorkflow]);
  
  /**
   * Format a report in a different output format
   */
  const formatReport = useCallback(async (
    reportId: string,
    format: string
  ): Promise<ReportResult> => {
    return genericWorkflow.process(
      {
        action: 'format',
        reportId,
        format
      },
      {
        step: 'report_formatting',
        metadata: {
          reportId,
          format,
          formattingStartedAt: new Date().toISOString()
        }
      }
    );
  }, [genericWorkflow]);
  
  /**
   * Get a report by ID
   */
  const getReport = useCallback(async (reportId: string): Promise<ReportResult | null> => {
    try {
      return await genericWorkflow.process(
        {
          action: 'info',
          reportId
        },
        {
          metadata: {
            reportId,
            infoRequestedAt: new Date().toISOString()
          }
        }
      );
    } catch (error) {
      console.error('Error getting report:', error);
      return null;
    }
  }, [genericWorkflow]);
  
  /**
   * Reset the report workflow to idle state
   */
  const resetReportWorkflow = useCallback(async (): Promise<void> => {
    await genericWorkflow.reset();
  }, [genericWorkflow]);
  
  // Compute derived states for backward compatibility
  const isGeneratingReport = genericWorkflow.state.currentStep === 'report_generation';
  const isReportComplete = genericWorkflow.state.currentStep === 'complete';
  
  // Return the same API as before with the new implementation
  return {
    ...genericWorkflow,
    generateReport,
    formatReport,
    getReport,
    resetReportWorkflow,
    reportData: genericWorkflow,
    isGeneratingReport,
    isReportComplete,
    reportId: genericWorkflow.reportId
  };
}

// Export for convenience
export default useReportWorkflow;