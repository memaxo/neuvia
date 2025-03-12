/**
 * @fileoverview Report Workflow Service
 * 
 * This service adapts the useReportWorkflow hook into a non-React service
 * that can be used by the chat store and other non-React contexts.
 * It maintains the same API as the hook, but without React dependencies.
 */

import { workflowService } from '@/lib/services/workflow/core/workflow-service'
import { reportService } from '@/lib/services/report/report-service'
import { normalizeError } from '@/lib/errors'
import { ProcessingPhase, WorkflowStep, WorkflowState, DomainOnlyWorkflowStep } from '@/lib/types/workflow'
import { EventEmitter } from 'events'

// Types
export type ProgressCallback = (progress: number, phase: ProcessingPhase) => void

export interface ReportWorkflowOptions {
  userId?: string
  chatId?: string
  initialStep?: WorkflowStep
}

export interface ReportGenerationOptions {
  patientId?: string
  documentIds?: string[]
  additionalNotes?: string
  format?: string
  progressCallback?: ProgressCallback
}

export interface ReportResult {
  success: boolean
  reportId?: string
  content?: string
  title?: string
  format?: string
  error?: string
  timestamp?: string
}

export interface ReportStatus {
  isGeneratingReport: boolean
  isReportComplete: boolean
  currentStep: WorkflowStep
  isError: boolean
  isIdle: boolean
}

/**
 * Service implementation of report workflow functionality
 */
export class ReportWorkflowService extends EventEmitter {
  private userId?: string
  private chatId?: string
  private workflowId?: string
  private state: WorkflowState
  private reportResult: ReportResult
  private subscriptions: (() => void)[] = []

  constructor(options: ReportWorkflowOptions = {}) {
    super()
    this.userId = options.userId
    this.chatId = options.chatId
    
    // Initialize with default state
    this.state = {
      currentStep: options.initialStep || 'idle',
      progress: 0,
      phase: ProcessingPhase.INITIALIZATION,
      error: null,
      metadata: {},
      timestamp: new Date().toISOString()
    }
    
    this.reportResult = {
      success: false
    }
    
    // Initialize workflow and set up subscriptions
    this.initialize()
  }
  
  /**
   * Initializes the service, loading workflow state and setting up subscriptions
   */
  private async initialize(): Promise<void> {
    if (!this.userId) return
    
    try {
      // Get or create workflow state
      const { id, data } = await workflowService.getOrCreateWorkflowForUser(
        this.userId,
        this.chatId ?? null,
        this.state.currentStep,
        { 
          progress: 0,
          currentStep: this.state.currentStep,
          createdAt: new Date().toISOString() 
        }
      )
      
      this.workflowId = id
      
      if (data) {
        const meta = (data.metadata as Record<string, unknown>) ?? {}
        this.state = {
          currentStep: (meta.currentStep as WorkflowStep) ?? (data.current_step as WorkflowStep),
          progress: typeof meta.progress === 'number' ? meta.progress : 0,
          phase: typeof meta.phase === 'string' ? (meta.phase as ProcessingPhase) : ProcessingPhase.INITIALIZATION,
          error: typeof meta.error === 'string' ? meta.error : null,
          metadata: meta,
          timestamp: data.timestamp || new Date().toISOString()
        }
        
        // Restore report state from metadata
        if (meta.reportId) {
          this.reportResult = {
            success: true,
            reportId: meta.reportId as string,
            format: meta.reportFormat as string,
            title: meta.reportTitle as string
          }
        }
      }
      
      // Set up subscription to workflow changes
      this.subscribeToChanges()
    } catch (error) {
      console.error('Error initializing report workflow service:', error)
      this.state.error = error instanceof Error ? error.message : String(error)
    }
  }
  
  /**
   * Subscribe to workflow changes
   */
  private subscribeToChanges(): void {
    if (!this.userId || !this.workflowId) return
    
    const channel = workflowService.subscribeToWorkflowForUser(
      this.userId,
      this.chatId ?? null,
      (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
        const newData = payload.new as { 
          id: string; 
          metadata?: Record<string, unknown>; 
          current_step: string; 
          updated_at: string 
        }
        
        try {
          if (!newData) return
          
          const meta = (newData.metadata as Record<string, unknown>) ?? {}
          
          // Update internal state
          this.state = {
            currentStep: (meta.currentStep as WorkflowStep) ?? (newData.current_step as WorkflowStep),
            progress: typeof meta.progress === 'number' ? meta.progress : 0,
            phase: typeof meta.phase === 'string' ? (meta.phase as ProcessingPhase) : undefined,
            error: typeof meta.error === 'string' ? meta.error : null,
            metadata: meta,
            timestamp: new Date(newData.updated_at).toISOString()
          }
          
          // Update report state if report metadata changed
          if (meta.reportId) {
            this.reportResult = {
              success: true,
              reportId: meta.reportId as string,
              format: meta.reportFormat as string,
              title: meta.reportTitle as string
            }
          }
          
          // Emit state change event
          this.emit('stateChange', this.state)
        } catch (error) {
          console.error('Error in report workflow subscription:', error)
        }
      }
    )
    
    // Store the unsubscribe function
    if (channel) {
      this.subscriptions.push(() => {
        workflowService.unsubscribeFromChannel(channel)
      })
    }
  }
  
  /**
   * Get the current state
   */
  getState(): WorkflowState {
    return { ...this.state }
  }
  
  /**
   * Get the current workflow ID
   */
  getWorkflowId(): string | undefined {
    return this.workflowId
  }
  
  /**
   * Get the current report result
   */
  getReportResult(): ReportResult {
    return { ...this.reportResult }
  }
  
  /**
   * Get the report status derived from state
   */
  getStatus(): ReportStatus {
    const { currentStep } = this.state
    
    return {
      currentStep,
      isGeneratingReport: currentStep === 'report_generation',
      isReportComplete: currentStep === 'report_complete',
      isError: currentStep === DomainOnlyWorkflowStep.ERROR,
      isIdle: currentStep === 'idle'
    }
  }
  
  /**
   * Update workflow step
   */
  async updateStep(step: WorkflowStep, metadata?: Record<string, unknown>): Promise<WorkflowState> {
    try {
      // Update local state immediately for UI responsiveness
      this.state = {
        ...this.state,
        currentStep: step,
        metadata: { ...this.state.metadata, ...metadata, currentStep: step },
        timestamp: new Date().toISOString()
      }
      
      // Emit state change event
      this.emit('stateChange', this.state)
      
      // Skip DB update if no workflowId
      if (!this.workflowId) {
        return this.state
      }
      
      // Update workflow state in database
      await workflowService.updateWorkflowState(
        this.workflowId,
        step,
        { ...metadata, currentStep: step },
        { useAtomicUpdate: true }
      )
      
      // Log step change for auditing
      await workflowService.logWorkflowEvent(
        this.workflowId,
        'step_changed',
        {
          from: this.state.currentStep,
          to: step,
          timestamp: new Date().toISOString(),
          metadata: metadata || {}
        }
      )
      
      return this.state
    } catch (error) {
      console.error('Error updating report workflow step:', error)
      
      // Update error state
      this.state.error = error instanceof Error ? error.message : String(error)
      this.emit('error', this.state.error)
      
      return this.state
    }
  }
  
  /**
   * Update progress
   */
  async updateProgress(progress: number, phase?: ProcessingPhase): Promise<WorkflowState> {
    try {
      // Update local state immediately for UI responsiveness
      this.state = {
        ...this.state,
        progress,
        phase: phase ?? this.state.phase,
        metadata: {
          ...this.state.metadata,
          progress,
          phase: phase?.toString() ?? this.state.phase?.toString()
        },
        timestamp: new Date().toISOString()
      }
      
      // Emit state change event
      this.emit('stateChange', this.state)
      this.emit('progress', { progress, phase })
      
      // Skip DB update if no workflowId
      if (!this.workflowId) {
        return this.state
      }
      
      // Update progress in database
      await workflowService.updateProgress(
        this.workflowId,
        progress,
        phase ?? ProcessingPhase.INITIALIZATION,
        this.state.currentStep
      )
      
      return this.state
    } catch (error) {
      console.error('Error updating report workflow progress:', error)
      
      // Update error state
      this.state.error = error instanceof Error ? error.message : String(error)
      this.emit('error', this.state.error)
      
      return this.state
    }
  }
  
  /**
   * Begin report generation process
   */
  async beginReportGeneration(generationType: string, options: ReportGenerationOptions = {}): Promise<ReportResult> {
    if (!this.workflowId) {
      await this.initialize()
      
      if (!this.workflowId) {
        throw new Error('Workflow not initialized. Make sure userId is provided.')
      }
    }
    
    try {
      // Update workflow state to report_generation
      await this.updateStep("report_generation", {
        generationType,
        generationStartedAt: new Date().toISOString(),
        ...(options.patientId ? { patientId: options.patientId } : {}),
        ...(options.documentIds ? { documentIds: options.documentIds } : {})
      })
      
      // Reset progress
      await this.updateProgress(0, ProcessingPhase.REPORT_GENERATION)
      
      // If we have the necessary data, start the report generation
      if (options.patientId) {
        // Use the report workflow to generate the report
        const result = await workflowService.generateReport(
          this.workflowId,
          {
            patientId: options.patientId,
            documentIds: options.documentIds,
            generateType: generationType,
            userId: this.userId,
            progressCallback: (progress, phase) => {
              this.updateProgress(progress, phase as ProcessingPhase)
              
              if (options.progressCallback) {
                options.progressCallback(progress, phase as ProcessingPhase)
              }
            }
          }
        )
        
        if (result.success) {
          // Update the report result
          this.reportResult = {
            success: true,
            reportId: result.reportId,
            content: result.content,
            title: result.title,
            format: options.format || 'markdown',
            timestamp: new Date().toISOString()
          }
          
          // Update workflow state with report info
          await this.updateStep("report_complete", {
            reportId: result.reportId,
            reportTitle: result.title,
            reportFormat: options.format || 'markdown',
            completedAt: new Date().toISOString()
          })
          
          return this.reportResult
        } else {
          throw new Error(result.error || 'Failed to generate report')
        }
      }
      
      // Return a placeholder result if we don't have enough data yet
      return {
        success: true,
        format: options.format || 'markdown'
      }
    } catch (error) {
      // Normalize the error
      const normalizedError = normalizeError(error)
      const errorMessage = normalizedError.message
      
      // Update error states
      this.reportResult = {
        success: false,
        error: errorMessage
      }
      
      // Update workflow to error state
      await this.updateStep(DomainOnlyWorkflowStep.ERROR, {
        error: errorMessage,
        errorTimestamp: new Date().toISOString(),
        errorContext: 'report_generation'
      })
      
      // Emit error event
      this.emit('error', {
        message: errorMessage,
        context: 'beginReportGeneration',
        details: { generationType, ...options }
      })
      
      return this.reportResult
    }
  }
  
  /**
   * Generate a report with detailed content
   */
  async generateReport(options: ReportGenerationOptions = {}): Promise<ReportResult> {
    if (!this.workflowId) {
      await this.initialize()
      
      if (!this.workflowId) {
        throw new Error('Workflow not initialized. Make sure userId is provided.')
      }
    }
    
    if (!this.state.metadata.patientId && !options.patientId) {
      throw new Error('Patient ID is required for report generation')
    }
    
    try {
      // Start with report_generation step if not already there
      if (this.state.currentStep !== 'report_generation') {
        await this.updateStep('report_generation', {
          patientId: options.patientId || this.state.metadata.patientId,
          startedAt: new Date().toISOString(),
          additionalNotes: options.additionalNotes
        })
      }
      
      // Reset progress
      await this.updateProgress(0, ProcessingPhase.REPORT_GENERATION)
      
      // Create progress callback
      const progressCallback = (progress: number, phase: ProcessingPhase) => {
        this.updateProgress(progress, phase)
        
        if (options.progressCallback) {
          options.progressCallback(progress, phase)
        }
      }
      
      // Generate report
      const patientId = options.patientId || this.state.metadata.patientId as string
      const result = await reportService.generatePatientReport(
        patientId,
        {
          format: options.format || 'markdown',
          notes: options.additionalNotes,
          onProgress: progressCallback
        }
      )
      
      if (result.success) {
        // Update the report result
        this.reportResult = {
          success: true,
          reportId: result.reportId,
          content: result.content,
          title: result.title || `Report for Patient ${patientId}`,
          format: options.format || 'markdown',
          timestamp: new Date().toISOString()
        }
        
        // Update workflow state with report info
        await this.updateStep("report_complete", {
          reportId: result.reportId,
          reportTitle: result.title,
          reportContent: result.content,
          reportFormat: options.format || 'markdown',
          completedAt: new Date().toISOString()
        })
        
        // Set progress to complete
        await this.updateProgress(100, ProcessingPhase.COMPLETION)
        
        return this.reportResult
      } else {
        throw new Error(result.error || 'Failed to generate report')
      }
    } catch (error) {
      // Normalize the error
      const normalizedError = normalizeError(error)
      const errorMessage = normalizedError.message
      
      // Update error states
      this.reportResult = {
        success: false,
        error: errorMessage
      }
      
      // Update workflow to error state
      await this.updateStep(DomainOnlyWorkflowStep.ERROR, {
        error: errorMessage,
        errorTimestamp: new Date().toISOString(),
        errorContext: 'report_generation'
      })
      
      // Emit error event
      this.emit('error', {
        message: errorMessage,
        context: 'generateReport',
        details: options
      })
      
      return this.reportResult
    }
  }
  
  /**
   * Format a report into a specific output format
   */
  async formatReport(format: string, reportId?: string): Promise<ReportResult> {
    if (!this.workflowId) {
      throw new Error('Workflow not initialized')
    }
    
    // Get the report ID - either from parameters or stored result
    const reportIdToUse = reportId || this.reportResult.reportId
    
    if (!reportIdToUse) {
      throw new Error('No report ID available - generate a report first')
    }
    
    try {
      // Update state to show formatting in progress
      await this.updateProgress(0, ProcessingPhase.REPORT_FORMATTING)
      
      // Format the report
      const result = await reportService.formatReport(
        reportIdToUse,
        format,
        {
          onProgress: (progress) => {
            this.updateProgress(progress, ProcessingPhase.REPORT_FORMATTING)
          }
        }
      )
      
      if (result.success) {
        // Update the report result
        this.reportResult = {
          success: true,
          reportId: reportIdToUse,
          content: result.content,
          title: result.title || this.reportResult.title,
          format: format,
          timestamp: new Date().toISOString()
        }
        
        // Update workflow state with formatted report info
        await this.updateStep("report_complete", {
          reportId: reportIdToUse,
          reportFormat: format,
          formattedAt: new Date().toISOString()
        })
        
        // Set progress to complete
        await this.updateProgress(100, ProcessingPhase.COMPLETION)
        
        return this.reportResult
      } else {
        throw new Error(result.error || 'Failed to format report')
      }
    } catch (error) {
      // Normalize the error
      const normalizedError = normalizeError(error)
      const errorMessage = normalizedError.message
      
      // Update error states
      this.reportResult = {
        success: false,
        error: errorMessage
      }
      
      // Update workflow to error state
      await this.updateStep(DomainOnlyWorkflowStep.ERROR, {
        error: errorMessage,
        errorTimestamp: new Date().toISOString(),
        errorContext: 'report_formatting'
      })
      
      // Emit error event
      this.emit('error', {
        message: errorMessage,
        context: 'formatReport',
        details: { format, reportId }
      })
      
      return this.reportResult
    }
  }
  
  /**
   * Reset report workflow to idle state
   */
  async resetReportWorkflow(): Promise<void> {
    // Reset report result
    this.reportResult = {
      success: false
    }
    
    // Reset workflow state
    await this.updateStep('idle', {
      resetAt: new Date().toISOString(),
      reportId: null,
      reportTitle: null,
      reportFormat: null,
      reportContent: null
    })
    
    this.emit('reset')
  }
  
  /**
   * Clean up event listeners and subscriptions
   */
  dispose(): void {
    // Clean up event emitter
    this.removeAllListeners()
    
    // Clean up subscriptions
    this.subscriptions.forEach(unsubscribe => unsubscribe())
    this.subscriptions = []
  }
}