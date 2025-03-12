import { useState, useCallback } from 'react'
import { ProcessingPhase, DomainOnlyWorkflowStep } from '@/lib/types/workflow'
import { useWorkflow } from '../use-workflow'
import { workflowService } from '@/lib/services/workflow/core/workflow-service'
import { useWorkflowErrorHandler } from '../workflow-error-handler'
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

/**
 * Specialized hook for report generation workflows.
 * Provides an intuitive API for generating and formatting reports.
 */
export function useReportWorkflow(options: UseReportWorkflowOptions = {}) {
  const { userId, chatId } = options
  const errorHandler = useWorkflowErrorHandler()
  const [reportData, setReportData] = useState<ReportData>({
    status: 'idle'
  })
  
  // Use base workflow hook
  const workflow = useWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })

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
      if (!workflow.workflowId) {
        throw new Error('Workflow not initialized. Make sure userId is provided.')
      }
      
      const { patientId, documentIds, generateType = 'comprehensive' } = options
      
      if (!patientId) {
        throw new Error('Patient ID is required for report generation')
      }
      
      // Update report status
      setReportData({
        patientId,
        documentIds,
        generateType,
        status: 'generating'
      })
      
      // Update workflow state
      await workflow.updateStep('report_generation', {
        patientId,
        documentIds,
        generateType,
        generationStartedAt: new Date().toISOString()
      })
      
      // Progress callback
      const progressCallback = (progress: number, phase: ProcessingPhase) => {
        workflow.updateProgress(progress, phase)
        if (options.onProgress) {
          options.onProgress(progress, phase)
        }
      }
      
      // Use report workflow processor
      const result = await workflowService.generateReport(
        workflow.workflowId,
        {
          patientId,
          documentIds,
          generateType,
          userId: userId ?? undefined,
          progressCallback
        }
      )
      
      if (result.success) {
        // Update report data
        setReportData({
          reportId: result.reportId,
          title: result.title,
          content: result.content,
          format: result.format,
          generateType,
          generatedAt: new Date().toISOString(),
          documentIds,
          patientId,
          status: 'complete'
        })
        
        // Update workflow state
        await workflow.updateStep('complete', {
          reportId: result.reportId,
          title: result.title,
          generatedAt: new Date().toISOString(),
          patientId,
          documentIds
        })
      } else {
        throw new Error(result.error || 'Failed to generate report')
      }
      
      return result
    } catch (err) {
      const error = normalizeError(err)
      
      // Update error states
      setReportData(prev => ({
        ...prev,
        error: error.message,
        status: 'error'
      }))
      
      await workflow.updateStep(DomainOnlyWorkflowStep.ERROR, {
        error: error.message,
        errorTimestamp: new Date().toISOString(),
      })
      
      await errorHandler.handleError(
        err,
        'report_generation',
        {
          previousStep: workflow.state.currentStep,
          details: {
            patientId: options.patientId,
            documentIds: options.documentIds,
            generateType: options.generateType
          },
          showToast: true,
          workflowId: workflow.workflowId ?? undefined
        }
      )
      
      throw error
    }
  }, [workflow, userId, errorHandler])
  
  /**
   * Format a report in a different output format
   */
  const formatReport = useCallback(async (
    reportId: string,
    format: string
  ) => {
    try {
      if (!workflow.workflowId) {
        throw new Error('Workflow not initialized')
      }
      
      // Update report data status
      setReportData(prev => ({
        ...prev,
        status: 'generating'
      }))
      
      // Use report workflow processor
      const result = await workflowService.formatReport(
        workflow.workflowId,
        reportId,
        { format }
      )
      
      if (result.success) {
        // Update report data
        setReportData(prev => ({
          ...prev,
          format: result.format,
          content: result.content,
          status: 'complete'
        }))
      } else {
        throw new Error(result.error || 'Failed to format report')
      }
      
      return result
    } catch (err) {
      const error = normalizeError(err)
      
      // Update error states
      setReportData(prev => ({
        ...prev,
        error: error.message,
        status: 'error'
      }))
      
      console.error('Error formatting report:', error.message)
      throw error
    }
  }, [workflow.workflowId])
  
  /**
   * Get a report by ID
   */
  const getReport = useCallback(async (reportId: string) => {
    try {
      if (!workflow.workflowId) {
        throw new Error('Workflow not initialized')
      }
      
      // Use report workflow to get report
      const result = await workflowService.getReport(
        workflow.workflowId,
        reportId
      )
      
      if (result && result.success) {
        // Update report data
        setReportData({
          reportId,
          title: result.title,
          content: result.content,
          format: result.format,
          generateType: result.generateType,
          generatedAt: result.generatedAt,
          documentIds: result.documentIds,
          patientId: result.patientId,
          status: 'complete'
        })
      }
      
      return result
    } catch (err) {
      console.error('Error getting report:', err)
      return null
    }
  }, [workflow.workflowId])
  
  /**
   * Reset the report workflow to idle state
   */
  const resetReportWorkflow = useCallback(async () => {
    // Reset report data
    setReportData({
      status: 'idle'
    })
    
    // Reset workflow state
    await workflow.updateStep('idle', {
      resetAt: new Date().toISOString()
    })
    
    return { success: true }
  }, [workflow])
  
  return {
    ...workflow,
    generateReport,
    formatReport,
    getReport,
    resetReportWorkflow,
    reportData,
    isGeneratingReport: workflow.state.currentStep === 'report_generation',
    isReportComplete: workflow.state.currentStep === 'complete' && reportData.status === 'complete',
    reportId: reportData.reportId || workflow.state.metadata?.reportId as string
  }
}