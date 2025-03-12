/**
 * @fileoverview Verification Workflow Service
 * 
 * This service adapts the useVerificationWorkflow hook into a non-React service
 * that can be used by the chat store and other non-React contexts.
 * It maintains the same API as the hook, but without React dependencies.
 */

import { workflowService } from '@/lib/services/workflow/core/workflow-service'
import { verificationService } from '@/lib/services/verification/verification-service'
import { normalizeError } from '@/lib/errors'
import { ProcessingPhase, WorkflowStep, WorkflowState, DomainOnlyWorkflowStep } from '@/lib/types/workflow'
import { VerificationStatus, VerificationMetadata } from '@/lib/types/verification'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'

// Types
export type ProgressCallback = (progress: number, phase: ProcessingPhase) => void

export interface VerificationWorkflowOptions {
  userId?: string
  chatId?: string
  initialStep?: WorkflowStep
}

export interface VerificationResult {
  success: boolean
  summaryId?: string
  summary?: string
  structuredData?: Record<string, unknown>
  correctionCount?: number
  status?: VerificationStatus
  error?: string
  timestamp?: string
}

export interface VerificationStatus {
  isVerifying: boolean
  isVerificationComplete: boolean
  isVerificationPending: boolean
  isVerificationInProgress: boolean
  currentStep: WorkflowStep
  isError: boolean
  isIdle: boolean
}

/**
 * Correction history interface that tracks changes during verification
 */
interface CorrectionHistory {
  correction_text: string
  timestamp: string
  summary_id: string
  message_id?: string
}

/**
 * Service implementation of verification workflow functionality
 */
export class VerificationWorkflowService extends EventEmitter {
  private userId?: string
  private chatId?: string
  private workflowId?: string
  private state: WorkflowState
  private verificationResult: VerificationResult
  private currentSummary: string | null = null
  private summaryId: string | null = null
  private correctionHistory: CorrectionHistory[] = []
  private subscriptions: (() => void)[] = []

  constructor(options: VerificationWorkflowOptions = {}) {
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
    
    this.verificationResult = {
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
        
        // Restore verification state from metadata
        if (meta.verificationMetadata) {
          const verificationMetadata = meta.verificationMetadata as VerificationMetadata
          this.verificationResult = {
            success: true,
            status: verificationMetadata.verification_status as VerificationStatus,
            summaryId: verificationMetadata.currentVersionId,
            correctionCount: verificationMetadata.correctionCount
          }
        }
        
        // Restore current summary and summary ID
        if (meta.currentSummaryId) {
          this.summaryId = meta.currentSummaryId as string
        }
        
        // Restore correction history
        if (meta.correctionHistory) {
          this.correctionHistory = meta.correctionHistory as CorrectionHistory[]
        }
      }
      
      // Set up subscription to workflow changes
      this.subscribeToChanges()
    } catch (error) {
      console.error('Error initializing verification workflow service:', error)
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
          
          // Update verification state if metadata changed
          if (meta.verificationMetadata) {
            const verificationMetadata = meta.verificationMetadata as VerificationMetadata
            this.verificationResult = {
              success: true,
              status: verificationMetadata.verification_status as VerificationStatus,
              summaryId: verificationMetadata.currentVersionId,
              correctionCount: verificationMetadata.correctionCount
            }
          }
          
          // Update current summary ID if changed
          if (meta.currentSummaryId !== undefined) {
            this.summaryId = meta.currentSummaryId as string || null
          }
          
          // Update correction history if changed
          if (meta.correctionHistory) {
            this.correctionHistory = meta.correctionHistory as CorrectionHistory[]
          }
          
          // Emit state change event
          this.emit('stateChange', this.state)
        } catch (error) {
          console.error('Error in verification workflow subscription:', error)
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
   * Get the current verification result
   */
  getVerificationResult(): VerificationResult {
    return { ...this.verificationResult }
  }
  
  /**
   * Get the current summary
   */
  getCurrentSummary(): string | null {
    return this.currentSummary
  }
  
  /**
   * Get the verification status derived from state
   */
  getStatus(): VerificationStatus {
    const { currentStep } = this.state
    
    return {
      currentStep,
      isVerifying: 
        currentStep === 'verification' || 
        currentStep === 'verification_pending' || 
        currentStep === 'verification_in_progress',
      isVerificationComplete: currentStep === 'verification_completed',
      isVerificationPending: currentStep === 'verification_pending',
      isVerificationInProgress: currentStep === 'verification_in_progress',
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
      console.error('Error updating verification workflow step:', error)
      
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
      console.error('Error updating verification workflow progress:', error)
      
      // Update error state
      this.state.error = error instanceof Error ? error.message : String(error)
      this.emit('error', this.state.error)
      
      return this.state
    }
  }
  
  /**
   * Initiate verification process with extracted document text
   */
  async initiateVerification(extractedDocument: string | Record<string, unknown>, messageId?: string): Promise<VerificationResult> {
    if (!this.userId || !this.chatId) {
      throw new Error('User ID and Chat ID are required for verification')
    }
    
    if (!this.workflowId) {
      await this.initialize()
      
      if (!this.workflowId) {
        throw new Error('Workflow not initialized. Make sure userId is provided.')
      }
    }
    
    try {
      // Generate a summary ID
      const summaryId = randomUUID()
      this.summaryId = summaryId
      
      // Prepare the document text for processing
      let documentText = String(extractedDocument)
      if (typeof extractedDocument === 'object' && extractedDocument !== null) {
        documentText = (extractedDocument as { text?: string }).text ?? JSON.stringify(extractedDocument)
      }
      
      // Store the current summary
      this.currentSummary = documentText
      
      // Update workflow state to verification_pending
      await this.updateStep("verification_pending", {
        verificationMetadata: {
          verification_status: VerificationStatus.pending,
          originalSummaryId: summaryId,
          currentVersionId: summaryId,
          correctionCount: 0,
          corrections: [],
          extractedData: extractedDocument,
        },
        currentSummaryId: summaryId,
        correctionHistory: [],
      })
      
      // Use the verification service to initiate verification
      const result = await workflowService.initiateVerification(
        this.workflowId,
        {
          documentText,
          summaryId,
          chatId: this.chatId,
          messageId,
          useGemini: true,
          progressCallback: (progress, phase) => {
            this.updateProgress(progress, phase as ProcessingPhase)
          }
        }
      )
      
      // Update local state with the verification result
      this.verificationResult = {
        success: true,
        summaryId,
        summary: result.summary,
        structuredData: result.structuredData,
        status: VerificationStatus.inProgress,
        timestamp: new Date().toISOString()
      }
      
      // Update progress to 100%
      await this.updateProgress(100, ProcessingPhase.VERIFICATION)
      
      // Return the verification result
      return this.verificationResult
    } catch (error) {
      // Normalize the error
      const normalizedError = normalizeError(error)
      const errorMessage = normalizedError.message
      
      // Update error states
      this.verificationResult = {
        success: false,
        error: errorMessage
      }
      
      // Update workflow to error state
      await this.updateStep(DomainOnlyWorkflowStep.ERROR, {
        error: errorMessage,
        errorTimestamp: new Date().toISOString(),
      })
      
      // Emit error event
      this.emit('error', {
        message: errorMessage,
        context: 'initiateVerification',
        details: { extractedDocument, messageId }
      })
      
      throw normalizedError
    }
  }
  
  /**
   * Process a correction to the current verification
   */
  async processCorrection(correctionText: string, currentSummary?: string, messageId?: string): Promise<VerificationResult> {
    if (!this.userId || !this.chatId) {
      throw new Error('User ID and Chat ID are required for verification')
    }
    
    if (!this.summaryId) {
      throw new Error('No summary ID available - verification must be initiated first')
    }
    
    try {
      // Create a new summary ID for this correction
      const newSummaryId = randomUUID()
      const currentSummaryId = this.summaryId
      
      // Use the summary provided or fall back to the stored one
      const summaryToCorrect = currentSummary || this.currentSummary
      
      if (!summaryToCorrect) {
        throw new Error('No summary available to correct')
      }
      
      // Update the correction history
      const updatedHistory: CorrectionHistory[] = [
        ...this.correctionHistory,
        {
          correction_text: correctionText,
          timestamp: new Date().toISOString(),
          summary_id: newSummaryId,
          message_id: messageId,
        },
      ]
      
      // Update workflow state to verification_in_progress
      await this.updateStep("verification_in_progress", {
        correctionHistory: updatedHistory,
        currentSummaryId: newSummaryId,
      })
      
      // Use the verification service to process the correction
      const result = await workflowService.processVerificationCorrection(
        this.workflowId,
        currentSummaryId,
        {
          correctionText,
          currentSummary: summaryToCorrect,
          newSummaryId,
          messageId,
          progressCallback: (progress, phase) => {
            this.updateProgress(progress, phase as ProcessingPhase)
          }
        }
      )
      
      // Update the current summary and summary ID
      this.currentSummary = result.summary || null
      this.summaryId = newSummaryId
      this.correctionHistory = updatedHistory
      
      // Update the verification result
      this.verificationResult = {
        success: true,
        summaryId: newSummaryId,
        summary: result.summary,
        structuredData: result.structuredData,
        correctionCount: updatedHistory.length,
        status: VerificationStatus.inProgress,
        timestamp: new Date().toISOString()
      }
      
      // Update metadata in the state
      const verificationMetadata = {
        verification_status: VerificationStatus.inProgress,
        currentVersionId: newSummaryId,
        correctionCount: updatedHistory.length,
        lastUpdated: new Date().toISOString(),
      } as VerificationMetadata
      
      await this.updateStep("verification_in_progress", {
        verificationMetadata,
        currentSummaryId: newSummaryId,
        correctionHistory: updatedHistory
      })
      
      return this.verificationResult
    } catch (error) {
      // Normalize the error
      const normalizedError = normalizeError(error)
      const errorMessage = normalizedError.message
      
      // Update error states
      this.verificationResult = {
        success: false,
        error: errorMessage
      }
      
      // Update workflow to error state
      await this.updateStep(DomainOnlyWorkflowStep.ERROR, {
        error: errorMessage,
        errorTimestamp: new Date().toISOString(),
      })
      
      // Emit error event
      this.emit('error', {
        message: errorMessage,
        context: 'processCorrection',
        details: { correctionText, messageId }
      })
      
      throw normalizedError
    }
  }
  
  /**
   * Complete the verification process
   */
  async completeVerification(finalSummaryId?: string): Promise<VerificationResult> {
    if (!this.userId) {
      throw new Error('User ID required for verification completion')
    }
    
    if (!this.workflowId) {
      throw new Error('Workflow ID required for verification completion')
    }
    
    try {
      // Use the provided summary ID or the current one
      const summaryIdToUse = finalSummaryId || this.summaryId
      
      if (!summaryIdToUse) {
        throw new Error('No summary ID available for verification completion')
      }
      
      // Use the verification service to complete the verification
      const result = await workflowService.completeVerification(
        this.workflowId,
        summaryIdToUse,
        this.userId,
        false // don't auto-generate report
      )
      
      // Update the verification metadata
      const verificationMetadata = {
        verification_status: VerificationStatus.completed,
        verifiedAt: new Date().toISOString(),
        verifiedBy: this.userId,
      } as VerificationMetadata
      
      // Update the workflow state
      await this.updateStep("verification_completed", {
        verificationMetadata,
      })
      
      // Update the verification result
      this.verificationResult = {
        success: true,
        summaryId: summaryIdToUse,
        status: VerificationStatus.completed,
        correctionCount: this.correctionHistory.length,
        timestamp: new Date().toISOString()
      }
      
      return this.verificationResult
    } catch (error) {
      // Normalize the error
      const normalizedError = normalizeError(error)
      const errorMessage = normalizedError.message
      
      // Update error states
      this.verificationResult = {
        success: false,
        error: errorMessage
      }
      
      // Update workflow to error state
      await this.updateStep(DomainOnlyWorkflowStep.ERROR, {
        error: errorMessage,
        errorTimestamp: new Date().toISOString(),
      })
      
      // Emit error event
      this.emit('error', {
        message: errorMessage,
        context: 'completeVerification',
        details: { finalSummaryId }
      })
      
      throw normalizedError
    }
  }
  
  /**
   * Reset verification back to idle state
   */
  async resetVerification(): Promise<{ success: boolean }> {
    if (!this.userId) {
      throw new Error('User ID required for verification reset')
    }
    
    try {
      // Reset internal state
      this.currentSummary = null
      this.summaryId = null
      this.correctionHistory = []
      this.verificationResult = {
        success: false
      }
      
      // Reset the workflow state
      await this.updateStep("idle", {
        verificationMetadata: null,
        currentSummaryId: null,
        correctionHistory: [],
      })
      
      return { success: true }
    } catch (error) {
      console.error('Error resetting verification:', error)
      
      // Emit error event
      this.emit('error', {
        message: error instanceof Error ? error.message : String(error),
        context: 'resetVerification'
      })
      
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
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