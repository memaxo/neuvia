import { useState, useCallback } from 'react'
import { ProcessingPhase, DomainOnlyWorkflowStep } from '@/lib/types/workflow'
import { createWorkflowHook } from './create-workflow-hook'
import { workflowService } from '@/lib/services/workflow/core/workflow-service'
import { normalizeError } from '@/lib/errors'

export interface UseReportWorkflowOptions {
  userId?: string
  chatId?: string | null
}

export interface ReportData {
  reportId?: string
  title?: string
  content?: string
  format?: string
  generateType?: string
  generatedAt?: string
  documentIds?: string[]
  patientId?: string
  status: 'idle' | 'generating' | 'complete' | 'error'
  error?: string
}

// Input type for report workflow actions
interface ReportInput {
  action: 'generate' | 'format' | 'info' | 'reset'
  patientId?: string
  documentIds?: string[]
  generateType?: string
  reportId?: string
  format?: string
  additionalNotes?: string
}

// Result type for report workflow actions
interface ReportResult {
  success: boolean
  reportId?: string
  title?: string
  content?: string
  format?: string
  generatedAt?: string
  documentIds?: string[]
  patientId?: string
  error?: string
}

// State type for report workflow
interface ReportState extends ReportData {}

/**
 * Domain actions for report workflow
 */
const reportWorkflowActions = {
  domainName: 'Report',
  initialStep: 'idle' as const,
  
  /**
   * Get initial report state
   */
  getInitialState: (): ReportState => ({
    status: 'idle'
  }),
  
  /**
   * Process report workflow action
   */
  processAction: async (
    input: ReportInput,
    options: {
      workflowId: string
      userId?: string
      onProgress?: (progress: number, phase: ProcessingPhase) => void
    }
  ): Promise<ReportResult> => {
    const { action } = input
    const { workflowId, userId, onProgress } = options
    
    if (!workflowId) {
      throw new Error('Workflow not initialized. Make sure userId is provided.')
    }
    
    if (action === 'generate') {
      if (!input.patientId) {
        throw new Error('Patient ID is required for report generation')
      }
      
      // Use the report workflow to generate the report
      const result = await workflowService.generateReport(
        workflowId,
        {
          patientId: input.patientId,
          documentIds: input.documentIds,
          generateType: input.generateType,
          userId: userId,
          progressCallback: onProgress
        }
      )
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate report')
      }
      
      return {
        success: true,
        reportId: result.reportId,
        content: result.content,
        title: result.title,
        format: input.format || 'markdown',
        generatedAt: new Date().toISOString(),
        documentIds: input.documentIds,
        patientId: input.patientId
      }
    }
    else if (action === 'format' && input.reportId && input.format) {
      // Format the report
      const result = await workflowService.formatReport(
        workflowId,
        input.reportId,
        { format: input.format }
      )
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to format report')
      }
      
      return {
        success: true,
        reportId: input.reportId,
        format: input.format,
        content: result.content,
        title: result.title
      }
    }
    else if (action === 'info' && input.reportId) {
      // Get the report
      const result = await workflowService.getReport(
        workflowId,
        input.reportId
      )
      
      if (!result || !result.success) {
        throw new Error('Failed to get report')
      }
      
      return {
        success: true,
        reportId: input.reportId,
        title: result.title,
        content: result.content,
        format: result.format,
        generatedAt: result.generatedAt,
        documentIds: result.documentIds,
        patientId: result.patientId
      }
    }
    else if (action === 'reset') {
      return {
        success: true,
        status: 'idle'
      } as any
    }
    
    throw new Error('Invalid report action')
  },
  
  /**
   * Create error result for failed operations
   */
  createErrorResult: (error: Error, input: ReportInput): ReportResult => {
    return {
      success: false,
      patientId: input.patientId,
      documentIds: input.documentIds,
      error: error.message
    }
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
      }
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
    }
  }
}

// Create the report domain workflow hook
const useReportDomainWorkflow = createWorkflowHook<ReportInput, ReportResult, ReportState>(
  reportWorkflowActions
)

/**
 * Specialized hook for report generation workflows.
 * Provides an intuitive API for generating and formatting reports.
 */
export function useReportWorkflow(options: UseReportWorkflowOptions = {}) {
  const { userId, chatId } = options
  
  // Use the domain workflow hook
  const domainWorkflow = useReportDomainWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  // Maintain backward compatibility with existing API
  
  /**
   * Generate a new report
   */
  const generateReport = useCallback(async (
    options: {
      patientId: string,
      documentIds?: string[],
      generateType?: string,
      onProgress?: (progress: number, phase: ProcessingPhase) => void
    }
  ) => {
    try {
      const { patientId, documentIds, generateType = 'comprehensive', onProgress } = options
      
      if (!patientId) {
        throw new Error('Patient ID is required for report generation')
      }
      
      return domainWorkflow.process(
        {
          action: 'generate',
          patientId,
          documentIds,
          generateType
        },
        {
          step: 'report_generation',
          successStep: 'complete',
          onProgress,
          metadata: {
            patientId,
            documentIds,
            generateType,
            generationStartedAt: new Date().toISOString()
          }
        }
      )
    } catch (error) {
      const normalizedError = normalizeError(error)
      
      throw normalizedError
    }
  }, [domainWorkflow])
  
  /**
   * Format a report in a different output format
   */
  const formatReport = useCallback(async (
    reportId: string,
    format: string
  ) => {
    try {
      return domainWorkflow.process(
        {
          action: 'format',
          reportId,
          format
        },
        {
          metadata: {
            reportId,
            format
          }
        }
      )
    } catch (error) {
      const normalizedError = normalizeError(error)
      console.error('Error formatting report:', normalizedError.message)
      throw normalizedError
    }
  }, [domainWorkflow])
  
  /**
   * Get a report by ID
   */
  const getReport = useCallback(async (reportId: string) => {
    try {
      return domainWorkflow.process(
        {
          action: 'info',
          reportId
        },
        {
          metadata: {
            reportId
          }
        }
      )
    } catch (error) {
      console.error('Error getting report:', error)
      return null
    }
  }, [domainWorkflow])
  
  /**
   * Reset the report workflow to idle state
   */
  const resetReportWorkflow = useCallback(async () => {
    return domainWorkflow.reset()
  }, [domainWorkflow])
  
  // Compute derived states for backward compatibility
  const isGeneratingReport = domainWorkflow.state.currentStep === 'report_generation'
  const isReportComplete = domainWorkflow.state.currentStep === 'complete' && domainWorkflow.status === 'complete'
  const reportId = domainWorkflow.reportId || domainWorkflow.state.metadata?.reportId as string
  
  // Return the same API shape as before
  return {
    ...domainWorkflow,
    generateReport,
    formatReport,
    getReport,
    resetReportWorkflow,
    reportData: domainWorkflow,
    isGeneratingReport,
    isReportComplete,
    reportId
  }
}