import { useCallback, useState } from 'react'
import { useBaseWorkflow, UseBaseWorkflowOptions } from './useBaseWorkflow'
import { normalizeError } from '@/lib/errors'
import { ProcessingPhase } from '@/lib/types/workflow'

/**
 * Options for report workflow
 */
export interface UseReportWorkflowOptions extends UseBaseWorkflowOptions {
  autoGenerate?: boolean;
}

/**
 * Report generation options
 */
export interface ReportGenerationOptions {
  patientId: string;
  documentIds?: string[];
  generateType?: string;
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
}

/**
 * Report result
 */
export interface ReportResult {
  reportId?: string;
  title?: string;
  content?: string;
  format?: string;
  generatedAt?: string;
  documentIds?: string[];
  patientId?: string;
  success: boolean;
  error?: string;
}

/**
 * Simplified hook for report generation workflows.
 */
export function useReportWorkflow(options: UseReportWorkflowOptions = {}) {
  const baseWorkflow = useBaseWorkflow({
    userId: options.userId,
    chatId: options.chatId,
    initialStep: options.initialStep,
    autoLoad: options.autoLoad ?? true,
    onError: options.onError,
    onStateChange: options.onStateChange
  })
  
  // Additional report state
  const [reportId, setReportId] = useState<string | undefined>(
    baseWorkflow.state.metadata?.reportId as string
  )
  
  // Get current format from metadata
  const [format, setFormat] = useState<string>(
    (baseWorkflow.state.metadata?.format as string) || 'markdown'
  )
  
  /**
   * Generate a new report
   */
  const generateReport = useCallback(async (
    options: ReportGenerationOptions
  ): Promise<ReportResult> => {
    try {
      // Update step to report_generation
      await baseWorkflow.updateStep(
        'report_generation',
        {
          patientId: options.patientId,
          documentIds: options.documentIds,
          generateType: options.generateType || 'comprehensive',
          generationStartedAt: new Date().toISOString()
        }
      )
      
      // Track progress
      const onProgress = options.onProgress || (() => {});
      onProgress(10, ProcessingPhase.REPORT_GENERATION)
      
      // Call API to generate report
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patientId: options.patientId,
          documentIds: options.documentIds,
          generateType: options.generateType || 'comprehensive'
        })
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Report generation failed: ${error}`)
      }
      
      const generateResult = await response.json()
      
      // Save report ID
      setReportId(generateResult.reportId)
      
      // Update workflow to complete
      await baseWorkflow.updateStep(
        'complete',
        {
          reportId: generateResult.reportId,
          patientId: options.patientId,
          documentIds: options.documentIds,
          format: 'markdown',
          completedAt: new Date().toISOString()
        }
      )
      
      onProgress(100, ProcessingPhase.COMPLETION)
      
      // Return result
      return {
        reportId: generateResult.reportId,
        title: generateResult.title,
        content: generateResult.content,
        format: 'markdown',
        patientId: options.patientId,
        documentIds: options.documentIds,
        generatedAt: new Date().toISOString(),
        success: true
      }
    } catch (error) {
      const normalizedError = normalizeError(error)
      
      // Set workflow to error state
      await baseWorkflow.updateStep(
        'error',
        {
          patientId: options.patientId,
          error: normalizedError.message,
          errorTimestamp: new Date().toISOString()
        }
      )
      
      // Return error result
      return {
        patientId: options.patientId,
        documentIds: options.documentIds,
        error: normalizedError.message,
        success: false
      }
    }
  }, [baseWorkflow])
  
  /**
   * Format a report in a different output format
   */
  const formatReport = useCallback(async (
    formatType: string,
    reportId: string,
    options?: {
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
    }
  ): Promise<ReportResult> => {
    try {
      if (!reportId) {
        throw new Error('Report ID is required')
      }
      
      // Track progress
      const onProgress = options?.onProgress || (() => {});
      onProgress(20, ProcessingPhase.REPORT_FORMATTING)
      
      // Call API to format report
      const response = await fetch(`/api/reports/${reportId}/format`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ format: formatType })
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Report formatting failed: ${error}`)
      }
      
      const formatResult = await response.json()
      
      // Save new format
      setFormat(formatType)
      
      // Update workflow with format
      await baseWorkflow.updateStep(
        baseWorkflow.state.currentStep,
        {
          format: formatType,
          formattedAt: new Date().toISOString()
        }
      )
      
      onProgress(100, ProcessingPhase.COMPLETION)
      
      // Return result
      return {
        reportId,
        title: formatResult.title,
        content: formatResult.content,
        format: formatType,
        success: true
      }
    } catch (error) {
      const normalizedError = normalizeError(error)
      
      // Return error result (don't change workflow state for format errors)
      return {
        reportId,
        error: normalizedError.message,
        success: false
      }
    }
  }, [baseWorkflow])
  
  /**
   * Get report by ID
   */
  const getReport = useCallback(async (reportId: string): Promise<ReportResult | null> => {
    try {
      const response = await fetch(`/api/reports/${reportId}`)
      
      if (!response.ok) {
        return null
      }
      
      const reportData = await response.json()
      
      return {
        reportId,
        title: reportData.title,
        content: reportData.content,
        format: reportData.format,
        patientId: reportData.patientId,
        documentIds: reportData.documentIds,
        generatedAt: reportData.generatedAt,
        success: true
      }
    } catch (error) {
      console.error('Error getting report:', error)
      return null
    }
  }, [])
  
  /**
   * Reset the report workflow to idle state
   */
  const resetReportWorkflow = useCallback(async (): Promise<void> => {
    setReportId(undefined)
    await baseWorkflow.resetWorkflow()
  }, [baseWorkflow])
  
  // Compute derived states for backward compatibility
  const isGeneratingReport = baseWorkflow.state.currentStep === 'report_generation'
  const isReportComplete = baseWorkflow.state.currentStep === 'complete'
  
  // Return the current report result
  const getReportResult = useCallback(() => {
    return {
      reportId,
      format,
      patientId: baseWorkflow.state.metadata?.patientId as string,
      documentIds: baseWorkflow.state.metadata?.documentIds as string[]
    }
  }, [baseWorkflow.state.metadata, reportId, format])
  
  // Return combined API
  return {
    ...baseWorkflow,
    generateReport,
    formatReport,
    getReport,
    resetReportWorkflow,
    isGeneratingReport,
    isReportComplete,
    reportId,
    format,
    getReportResult
  }
}

// Export for convenience
export default useReportWorkflow