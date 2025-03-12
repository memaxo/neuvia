/**
 * @fileoverview Report Workflow Hook Adapter
 * 
 * This adapter converts the ReportWorkflowService to a React hook
 * that can be used in components.
 */

import { useState, useEffect, useCallback } from 'react'
import { ReportWorkflowService, ReportResult, ReportGenerationOptions } from '../services/report-workflow-service'
import { workflowServiceFactory } from '../services/workflow-service-factory'
import { WorkflowState, WorkflowStep, ProcessingPhase } from '@/lib/types/workflow'

export interface UseReportWorkflowOptions {
  userId?: string
  chatId?: string
  initialStep?: WorkflowStep
}

/**
 * React hook adapter for ReportWorkflowService
 */
export function useReportWorkflowAdapter(options: UseReportWorkflowOptions = {}) {
  const { userId, chatId, initialStep = 'idle' } = options
  
  // Get or create the report workflow service
  const service = workflowServiceFactory.getReportWorkflowService(userId, chatId)
  
  // State
  const [state, setState] = useState<WorkflowState>(service.getState() || {
    currentStep: initialStep,
    progress: 0,
    phase: ProcessingPhase.INITIALIZATION,
    error: null,
    metadata: {},
    timestamp: new Date().toISOString()
  })
  
  const [reportResult, setReportResult] = useState<ReportResult>(
    service.getReportResult() || { success: false }
  )
  
  const [workflowId, setWorkflowId] = useState<string | undefined>(
    service.getWorkflowId()
  )
  
  // Subscribe to state changes
  useEffect(() => {
    // Update state when service state changes
    const handleStateChange = (newState: WorkflowState) => {
      setState(newState)
    }
    
    // Update result when report result changes
    const handleResultChange = (result: ReportResult) => {
      setReportResult(result)
    }
    
    // Update workflow ID when it changes
    const handleWorkflowIdChange = (id?: string) => {
      setWorkflowId(id)
    }
    
    // Subscribe to events
    service.on('stateChange', handleStateChange)
    service.on('reportResult', handleResultChange)
    
    // Initial state sync
    setState(service.getState())
    setReportResult(service.getReportResult())
    setWorkflowId(service.getWorkflowId())
    
    // Clean up subscriptions
    return () => {
      service.off('stateChange', handleStateChange)
      service.off('reportResult', handleResultChange)
    }
  }, [service, userId, chatId])
  
  // Methods
  const updateStep = useCallback(
    async (step: WorkflowStep, metadata?: Record<string, unknown>) => {
      return service.updateStep(step, metadata)
    },
    [service]
  )
  
  const updateProgress = useCallback(
    async (progress: number, phase?: ProcessingPhase) => {
      return service.updateProgress(progress, phase)
    },
    [service]
  )
  
  const beginReportGeneration = useCallback(
    async (generationType: string, options: ReportGenerationOptions = {}) => {
      return service.beginReportGeneration(generationType, options)
    },
    [service]
  )
  
  const generateReport = useCallback(
    async (options: ReportGenerationOptions = {}) => {
      return service.generateReport(options)
    },
    [service]
  )
  
  const formatReport = useCallback(
    async (format: string, reportId?: string) => {
      return service.formatReport(format, reportId)
    },
    [service]
  )
  
  const resetReportWorkflow = useCallback(
    async () => {
      return service.resetReportWorkflow()
    },
    [service]
  )
  
  // Return hook interface
  return {
    // State
    state,
    reportResult,
    workflowId,
    
    // Computed status properties
    status: service.getStatus(),
    
    // Methods
    updateStep,
    updateProgress,
    beginReportGeneration,
    generateReport,
    formatReport,
    resetReportWorkflow
  }
}