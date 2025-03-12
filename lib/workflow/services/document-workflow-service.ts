/**
 * @fileoverview Document Workflow Service
 * 
 * This service adapts the useDocumentWorkflow hook into a non-React service
 * that can be used by the chat store and other non-React contexts.
 * It maintains the same API as the hook, but without React dependencies.
 */

import { workflowService } from '@/lib/services/workflow/core/workflow-service'
import { workflowTransactionManager } from '@/lib/services/workflow/workflow-transaction-manager'
import { ApplicationError, normalizeError } from '@/lib/errors'
import { ProcessingPhase, WorkflowStep, WorkflowState, DomainOnlyWorkflowStep } from '@/lib/types/workflow'
import { EventEmitter } from 'events'

export type ProgressCallback = (progress: number, phase: ProcessingPhase) => void

export interface DocumentWorkflowOptions {
  userId?: string
  chatId?: string
  initialStep?: WorkflowStep
}

export interface ProcessDocumentOptions {
  patientId?: string
  skipExtraction?: boolean
  onProgress?: ProgressCallback
}

export interface DocumentResult {
  success: boolean
  documentId?: string
  fileName?: string
  fileSize?: number
  text?: string
  extractedText?: string
  extractedData?: Record<string, unknown>
  error?: string
}

export interface DocumentStatus {
  isProcessingDocument: boolean
  isDocumentComplete: boolean
  currentStep: WorkflowStep
  isError: boolean
  isIdle: boolean
  isUploading: boolean
  isExtracting: boolean
  documentId?: string
}

/**
 * Service implementation of document workflow functionality
 */
export class DocumentWorkflowService extends EventEmitter {
  private userId?: string
  private chatId?: string
  private workflowId?: string
  private state: WorkflowState
  private documentResult: DocumentResult
  private subscriptions: (() => void)[] = []

  constructor(options: DocumentWorkflowOptions = {}) {
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
    
    this.documentResult = {
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
        
        // If we have document result data in metadata, restore it
        if (meta.documentId) {
          this.documentResult = {
            success: true,
            documentId: meta.documentId as string,
            fileName: meta.fileName as string,
            fileSize: meta.fileSize as number,
            extractedData: meta.extractedData as Record<string, unknown>
          }
        }
      }
      
      // Set up subscription to workflow changes
      this.subscribeToChanges()
    } catch (error) {
      console.error('Error initializing document workflow service:', error)
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
          
          // Emit state change event
          this.emit('stateChange', this.state)
        } catch (error) {
          console.error('Error in document workflow subscription:', error)
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
   * Get the document result
   */
  getDocumentResult(): DocumentResult {
    return { ...this.documentResult }
  }
  
  /**
   * Get the document status derived from state
   */
  getStatus(): DocumentStatus {
    const { currentStep } = this.state
    
    return {
      currentStep,
      isProcessingDocument: currentStep === 'uploading' || currentStep === 'extracting',
      isDocumentComplete: currentStep === 'complete',
      isError: currentStep === DomainOnlyWorkflowStep.ERROR,
      isIdle: currentStep === 'idle',
      isUploading: currentStep === 'uploading',
      isExtracting: currentStep === 'extracting',
      documentId: this.documentResult.documentId
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
      console.error('Error updating document workflow step:', error)
      
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
      console.error('Error updating document workflow progress:', error)
      
      // Update error state
      this.state.error = error instanceof Error ? error.message : String(error)
      this.emit('error', this.state.error)
      
      return this.state
    }
  }
  
  /**
   * Process a document through the entire pipeline: upload, extract, analyze
   */
  async processDocument(file: File, options: ProcessDocumentOptions = {}): Promise<DocumentResult> {
    try {
      if (!this.workflowId) {
        await this.initialize()
        
        if (!this.workflowId) {
          throw new Error('Workflow not initialized. Make sure userId is provided.')
        }
      }
      
      // Start by updating to uploading state
      await this.updateStep('uploading', {
        fileName: file.name,
        fileSize: file.size,
        startedAt: new Date().toISOString(),
        patientId: options.patientId
      })
      
      // Callback for progress updates
      const progressCallback = (progress: number, phase: ProcessingPhase) => {
        this.updateProgress(progress, phase)
        if (options.onProgress) {
          options.onProgress(progress, phase)
        }
      }
      
      // Use workflowService to process the document
      const result = await workflowService.processDocumentUpload(
        this.workflowId,
        file,
        {
          userId: this.userId,
          patientId: options.patientId,
          progressCallback,
          skipExtraction: options.skipExtraction
        }
      )
      
      // Update local state with result
      if (result.success) {
        this.documentResult = {
          success: true,
          documentId: result.documentId,
          fileName: result.fileName,
          fileSize: file.size,
          text: result.text,
          extractedText: result.text,
          extractedData: result.data
        }
        
        // Update to complete state
        await this.updateStep('complete', {
          documentId: result.documentId,
          fileName: result.fileName,
          completedAt: new Date().toISOString(),
          extractedData: result.data
        })
      } else {
        this.documentResult = {
          success: false,
          error: result.error
        }
        
        throw new Error(result.error || 'Failed to process document')
      }
      
      return this.documentResult
    } catch (error) {
      // Normalize the error
      const normalizedError = normalizeError(error)
      const errorMessage = normalizedError.message
      
      // Update error states
      this.documentResult = {
        success: false,
        error: errorMessage
      }
      
      // Update workflow to error state
      await this.updateStep(DomainOnlyWorkflowStep.ERROR, {
        error: errorMessage,
        errorTimestamp: new Date().toISOString(),
        errorDetails: {
          fileName: file.name,
          fileSize: file.size,
          errorMessage
        }
      })
      
      // Emit error event
      this.emit('error', {
        message: errorMessage,
        context: 'processDocument',
        details: { fileName: file.name, fileSize: file.size }
      })
      
      return this.documentResult
    }
  }
  
  /**
   * Reset document workflow to idle state
   */
  async resetDocumentWorkflow(): Promise<void> {
    // Reset document result
    this.documentResult = {
      success: false
    }
    
    // Reset workflow state
    await this.updateStep('idle', {
      resetAt: new Date().toISOString()
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