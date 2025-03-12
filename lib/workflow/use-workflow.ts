import { useCallback, useEffect, useState, useMemo } from 'react'
import { randomUUID } from 'crypto'
import type {
  WorkflowState,
  WorkflowStep
} from '@/lib/types/workflow'
import type { VerificationMetadata } from '@/lib/types/verification'
import {
  ProcessingPhase,
  DomainOnlyWorkflowStep
} from '@/lib/types/workflow'
import { workflowService } from '@/lib/services/workflow/core/workflow-service'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useWorkflowErrorHandler } from './workflow-error-handler'
import { normalizeError } from '@/lib/errors'
import { workflowTransactionManager } from '@/lib/services/workflow/workflow-transaction-manager'

/**
 * Options for the useWorkflow hook
 */
interface UseWorkflowOptions {
  userId?: string
  initialStep?: WorkflowStep
  chatId?: string | null
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
 * Hook that provides access to the workflow management system.
 * This is a thin wrapper around the WorkflowService facade.
 */
export function useWorkflow(options: UseWorkflowOptions = {}) {
  const { userId, initialStep = "idle", chatId } = options
  const [state, setState] = useState<WorkflowState>({
    currentStep: initialStep,
    progress: 0,
    timestamp: new Date().toISOString(),
    metadata: {}
  })
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const errorHandler = useWorkflowErrorHandler()
  const [subscriptionChannel, setSubscriptionChannel] = useState<RealtimeChannel | null>(null)

  /**
   * Load or create workflow state from DB using the workflowService
   */
  const loadOrCreateWorkflowState = useCallback(async () => {
    if (userId === null || userId === undefined || userId.trim() === "") return null
    try {
      // Get or create workflow state
      const { id, data } = await workflowService.getOrCreateWorkflowForUser(
        userId,
        chatId ?? null,
        initialStep,
        { progress: 0, currentStep: initialStep, createdAt: new Date().toISOString() }
      )
      setWorkflowId(id)

      if (data !== null && data !== undefined) {
        const meta = (data.metadata as Record<string, unknown>) ?? {}
        setState((prevState) => ({
          ...prevState,
          currentStep: (meta.currentStep as WorkflowStep) !== undefined ? (meta.currentStep as WorkflowStep) : (data.current_step as WorkflowStep),
          progress: typeof meta.progress === 'number' ? meta.progress : 0,
          phase: typeof meta.phase === 'string' ? (meta.phase as ProcessingPhase) : undefined,
          error: typeof meta.error === 'string' ? meta.error : null,
          metadata: meta,
          timestamp: data.timestamp || new Date().toISOString(),
        }))
      }
      return id
    } catch (error) {
      await errorHandler.handleError(error, initialStep, {
        details: { userId, chatId },
        showToast: true,
      })
      return null
    }
  }, [userId, chatId, initialStep, errorHandler])

  /**
   * Subscribe to workflow state changes for user+chat via the workflowService
   */
  const subscribeToChanges = useCallback(() => {
    if (userId === null || userId === undefined) return
    
    // Use the workflowService to subscribe to changes
    const channel = workflowService.subscribeToWorkflowForUser(
      userId,
      chatId ?? null,
      (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
        const newData = payload.new as { id: string; metadata?: Record<string, unknown>; current_step: string; updated_at: string };
        try {
          if (newData === null || newData === undefined) return
          
          const meta = (newData.metadata as Record<string, unknown>) ?? {}
          setWorkflowId(newData.id)
          
          setState((prevState) => ({
            ...prevState,
            currentStep: (meta.currentStep as WorkflowStep) ?? (newData.current_step as WorkflowStep),
            progress: typeof meta.progress === 'number' ? meta.progress : 0,
            phase: typeof meta.phase === 'string' ? (meta.phase as ProcessingPhase) : undefined,
            error: typeof meta.error === 'string' ? meta.error : null,
            metadata: meta,
            timestamp: new Date(newData.updated_at).toISOString(),
          }))
        } catch (err) {
          void errorHandler.handleError(
            err,
            state.currentStep,
            { details: { userId, chatId, payload }, showToast: true }
          )
        }
      }
    )
    
    setSubscriptionChannel(channel)
  }, [userId, chatId, errorHandler, state.currentStep])

  // Effect to load or create workflow state and subscribe to changes
  useEffect(() => {
    if (userId === null || userId === undefined) return
    
    // Load or create the workflow row
    void loadOrCreateWorkflowState()
    
    // Then subscribe to changes
    subscribeToChanges()
    
    // Cleanup subscription on unmount
    return () => {
      if (subscriptionChannel !== null && subscriptionChannel !== undefined) {
        workflowService.unsubscribeFromChannel(subscriptionChannel)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, chatId])

  /**
   * Update workflow step (and metadata) in DB, and also update local state
   * Enhanced with atomic updates and conflict resolution
   */
  const updateStep = useCallback(
    async (step: WorkflowStep, metadata?: Record<string, unknown>, options?: {
      conflictStrategy?: 'fail' | 'force' | 'merge',
      skipValidation?: boolean,
      withChatMessage?: { content: string, role?: string, metadata?: Record<string, unknown> }
    }) => {
      try {
        // Update local state immediately for UI responsiveness
        const newState: WorkflowState = {
          ...state,
          currentStep: step,
          metadata: { ...(state.metadata ?? {}), ...metadata, currentStep: step },
          timestamp: new Date().toISOString(),
        }
        setState(newState)
        
        // Skip DB update if no workflowId
        if (workflowId === null || workflowId === undefined) {
          return newState;
        }
        
        // Special case: if we have a chat message, use the combined function
        if (options?.withChatMessage && chatId) {
          const { content, role = 'system', metadata: messageMetadata } = options.withChatMessage;
          
          await workflowService.updateWithChatMessage(
            workflowId,
            step,
            { ...(metadata || {}), currentStep: step },
            content,
            role,
            messageMetadata || null
          );
          
          return newState;
        }
        
        // Use conflict resolution if strategy specified
        if (options?.conflictStrategy) {
          await workflowService.updateWithConflictResolution(
            workflowId,
            step,
            { ...(metadata || {}), currentStep: step },
            {
              expectedTimestamp: state.timestamp,
              strategy: options.conflictStrategy
            }
          );
          
          return newState;
        }
        
        // Otherwise use standard update with appropriate options
        await workflowService.updateWorkflowState(
          workflowId,
          step,
          { ...(metadata || {}), currentStep: step },
          {
            skipValidation: options?.skipValidation,
            useAtomicUpdate: true // Use atomic updates by default
          }
        );
        
        // Log step change for auditing
        await workflowService.logWorkflowEvent(
          workflowId,
          'step_changed',
          {
            from: state.currentStep,
            to: step,
            timestamp: new Date().toISOString(),
            metadata: metadata || {}
          }
        );
        
        return newState;
      } catch (error) {
        await errorHandler.handleError(
          error,
          state.currentStep,
          {
            details: { step, metadata, options },
            showToast: true,
            workflowId: workflowId ?? undefined
          }
        );
        return state;
      }
    },
    [state, workflowId, chatId, errorHandler]
  );

  /**
   * Update progress (plus optional phase) using the specialized progress update method
   */
  const updateProgress = useCallback(
    async (progress: number, phase?: ProcessingPhase, notifyUsers?: boolean) => {
      try {
        // Update local state immediately for UI responsiveness
        const newMeta = {
          ...state.metadata,
          progress,
        } as Record<string, unknown>
        
        if (phase !== undefined) {
          newMeta.phase = phase
        }
        
        const newState: WorkflowState = {
          ...state,
          progress,
          phase,
          metadata: newMeta,
          timestamp: new Date().toISOString(),
        }
        setState(newState)
        
        // Use workflowService's updateProgress method
        if (workflowId !== null && workflowId !== undefined) {
          await workflowService.updateProgress(
            workflowId,
            progress,
            phase ?? ProcessingPhase.INITIALIZATION,
            state.currentStep,
            notifyUsers ?? true
          )
        }
        
        return newState
      } catch (error) {
        await errorHandler.handleError(
          error,
          state.currentStep,
          {
            details: { progress, phase, notifyUsers },
            showToast: true,
            workflowId: workflowId ?? undefined
          }
        )
        return state
      }
    },
    [state, workflowId, errorHandler]
  )
  
  /**
   * Update progress with chat notification message
   */
  const updateProgressWithNotification = useCallback(
    async (progress: number, phase: ProcessingPhase, messageContent: string) => {
      try {
        // Update local state immediately for UI responsiveness
        const newMeta = {
          ...state.metadata,
          progress,
          phase
        } as Record<string, unknown>
        
        const newState: WorkflowState = {
          ...state,
          progress,
          phase,
          metadata: newMeta,
          timestamp: new Date().toISOString(),
        }
        setState(newState)
        
        // Use the combined update method for atomic operation
        if (workflowId !== null && workflowId !== undefined && chatId !== null && chatId !== undefined) {
          await workflowService.updateWithChatMessage(
            workflowId,
            state.currentStep, // Keep current step
            {
              progress,
              phase: phase.toString(),
              timestamp: new Date().toISOString()
            },
            messageContent,
            'system',
            {
              type: 'progress_update',
              progress,
              phase: phase.toString()
            }
          )
        }
        
        return newState
      } catch (error) {
        await errorHandler.handleError(
          error,
          state.currentStep,
          {
            details: { progress, phase, messageContent },
            showToast: true,
            workflowId: workflowId ?? undefined
          }
        )
        return state
      }
    },
    [state, workflowId, chatId, errorHandler]
  )

  /**
   * Generic helper: run an operation with set step/progress using transaction manager
   * Enhanced with transaction management and recovery mechanisms
   */
  const runOperation = useCallback(
    async <T>(
      step: WorkflowStep,
      operation: () => Promise<T>,
      options?: {
        onSuccess?: (result: T) => void,
        onError?: (error: string) => void,
        withNotifications?: boolean,
        recoveryPath?: WorkflowStep,
        metadata?: Record<string, unknown>,
        progressReporter?: (progress: number, phase: ProcessingPhase) => void
      }
    ): Promise<T> => {
      // Skip if no workflowId is available
      if (!workflowId) {
        try {
          return await operation();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (options?.onError) {
            options.onError(errorMessage);
          }
          throw error;
        }
      }
      
      try {
        // Use the transaction manager for reliable operation execution
        const transactionResult = await workflowTransactionManager.executeTransaction(
          workflowId,
          async (progress, transactionId) => {
            // Call custom progress reporter if provided
            if (options?.progressReporter) {
              options.progressReporter(progress, 
                progress < 30 ? ProcessingPhase.INITIALIZATION :
                progress < 60 ? ProcessingPhase.PROCESSING : 
                progress < 90 ? ProcessingPhase.FINALIZATION :
                ProcessingPhase.COMPLETION
              );
            }
            
            // Execute the actual operation
            return await operation();
          },
          {
            step,
            metadata: options?.metadata,
            recoveryStep: options?.recoveryPath,
            withNotifications: options?.withNotifications,
            chatId: chatId ?? undefined,
            skipValidation: false,
            maxRetries: 1,
            isRecoverableError: (error) => {
              // Default recovery logic for network errors
              const message = error instanceof Error ? error.message : String(error);
              return message.toLowerCase().includes('network') || 
                     message.toLowerCase().includes('timeout') ||
                     message.toLowerCase().includes('connection');
            }
          }
        );
        
        // Update local state with the final workflow state
        if (transactionResult.workflowState) {
          setState(transactionResult.workflowState);
        }
        
        // Call success callback if provided
        if (options?.onSuccess) {
          options.onSuccess(transactionResult.data);
        }
        
        return transactionResult.data;
      } catch (error) {
        // Enhanced error handling with error context
        const normalizedError = normalizeError(error);
        
        // Call error callback if provided
        if (options?.onError) {
          options.onError(normalizedError.message);
        }
        
        // Pass to error handler for UI updates and logging
        await errorHandler.handleError(
          error,
          step,
          {
            previousStep: state.currentStep,
            details: {
              step,
              metadata: options?.metadata
            },
            showToast: true,
            workflowId,
            attemptRecovery: true
          }
        );
        
        throw error;
      }
    },
    [workflowId, chatId, errorHandler, state.currentStep]
  );

  /**
   * Initiate verification process using the verification workflow processor
   */
  const initiateVerification = useCallback(
    async (extractedDocument: unknown, messageId?: string) => {
      if (userId === null || userId === undefined || userId.trim() === "" ||
          chatId === null || chatId === undefined || (typeof chatId === 'string' && chatId.trim() === "")) {
        throw new Error('User ID and Chat ID are required for verification')
      }
      
      // Generate a summary ID
      const summaryId = randomUUID()
      
      try {
        // Prepare the document text for processing
        let documentText = String(extractedDocument)
        if (typeof extractedDocument === 'object' && extractedDocument !== null) {
          documentText =
            (extractedDocument as { text?: string }).text ??
            JSON.stringify(extractedDocument)
        }

        // Update local step for immediate UI feedback
        await updateStep("verification_pending", {
          verificationMetadata: {
            verification_status: 'pending',
            originalSummaryId: summaryId,
            currentVersionId: summaryId,
            correctionCount: 0,
            corrections: [],
            extractedData: extractedDocument,
          } as unknown as VerificationMetadata,
          currentSummaryId: summaryId,
          correctionHistory: [],
        })
        
        // Use the workflow service's verification processor
        const result = await workflowService.initiateVerification(
          workflowId ?? '',
          {
            documentText,
            summaryId,
            chatId: chatId ?? '',
            messageId,
            useGemini: true,
            progressCallback: (progress, phase) => {
              void updateProgress(progress, phase as ProcessingPhase)
            }
          }
        )
        
        // Update local state to reflect successful extraction
        setState((prevState) => ({
          ...prevState,
          progress: 100,
          phase: ProcessingPhase.VERIFICATION,
          timestamp: new Date().toISOString(),
        }))
        
        return {
          summaryId,
          summary: result.summary,
          structuredData: result.structuredData
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        
        await updateStep(DomainOnlyWorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
        })
        
        await errorHandler.handleError(
          err,
          "verification_pending",
          { 
            previousStep: state.currentStep, 
            details: { extractedDocument, messageId }, 
            showToast: true,
            workflowId: workflowId ?? undefined
          }
        )
        
        throw err
      }
    },
    [userId, chatId, workflowId, state.currentStep, updateStep, updateProgress, errorHandler]
  )

  /**
   * Process a correction for verification using the verification workflow processor
   */
  const processCorrection = useCallback(
    async (correctionText: string, currentSummary: string, messageId?: string) => {
      if (userId === null || userId === undefined ||
          chatId === null || chatId === undefined ||
          state.metadata === undefined || state.metadata.currentSummaryId === undefined) {
        throw new Error('Missing required IDs for correction processing')
      }
      
      try {
        const newSummaryId = randomUUID()
        const currentSummaryId = state.metadata.currentSummaryId as string
        
        // Update local state for immediate UI feedback
        const updatedHistory: CorrectionHistory[] = [
          ...(state.metadata?.correctionHistory as CorrectionHistory[] || []),
          {
            correction_text: correctionText,
            timestamp: new Date().toISOString(),
            summary_id: newSummaryId,
            message_id: messageId,
          },
        ]

        await updateStep("verification_in_progress", {
          correctionHistory: updatedHistory,
          currentSummaryId: newSummaryId,
        })
        
        // Use the verification workflow processor
        const result = await workflowService.processVerificationCorrection(
          workflowId ?? '',
          currentSummaryId,
          {
            correctionText,
            currentSummary,
            newSummaryId,
            messageId,
            progressCallback: (progress, phase) => {
              void updateProgress(progress, phase as ProcessingPhase)
            }
          }
        )
        
        // Update local state with verification metadata
        const currentVerificationMetadata = (state.metadata?.verificationMetadata as VerificationMetadata) || {}
        const updatedVerificationMetadata = {
          ...currentVerificationMetadata,
          verification_status: 'inProgress',
          currentVersionId: newSummaryId,
          correctionCount: updatedHistory.length,
          lastUpdated: new Date().toISOString(),
        } as unknown as VerificationMetadata

        setState((prevState) => ({
          ...prevState,
          currentStep: "verification_in_progress",
          metadata: {
            ...prevState.metadata,
            verificationMetadata: updatedVerificationMetadata,
            correctionHistory: updatedHistory,
            currentSummaryId: newSummaryId
          },
          timestamp: new Date().toISOString()
        }))

        return {
          summaryId: newSummaryId,
          summary: result.summary,
          structuredData: result.structuredData,
          correctionCount: updatedHistory.length,
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        
        await updateStep(DomainOnlyWorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
        })
        
        await errorHandler.handleError(
          err,
          "verification_in_progress",
          { 
            previousStep: state.currentStep, 
            details: { correctionText, messageId }, 
            showToast: true,
            workflowId: workflowId ?? undefined
          }
        )
        
        throw err
      }
    },
    [userId, chatId, workflowId, state, updateStep, updateProgress, errorHandler]
  )

  /**
   * Complete verification process using the verification workflow processor
   */
  const completeVerification = useCallback(
    async (finalSummaryId?: string) => {
      if (userId === null || userId === undefined) {
        throw new Error('User ID required for verification completion')
      }
      
      try {
        const summaryIdToUse = finalSummaryId ?? (state.metadata?.currentSummaryId as string)
        
        if (summaryIdToUse === undefined) {
          throw new Error('No summary ID available for verification completion')
        }
        
        // Use the verification workflow processor
        const result = await workflowService.completeVerification(
          workflowId ?? '',
          summaryIdToUse,
          userId,
          false // don't auto-generate report
        )
        
        // Update local state with completion metadata
        const currentVerificationMetadata = (state.metadata?.verificationMetadata as VerificationMetadata) ?? {}
        const updatedVerificationMetadata = {
          ...currentVerificationMetadata,
          verification_status: 'completed',
          verifiedAt: new Date().toISOString(),
          verifiedBy: userId,
        } as unknown as VerificationMetadata

        // Update local step
        await updateStep("verification_completed", {
          verificationMetadata: updatedVerificationMetadata,
        })
        
        return {
          success: true,
          summaryId: summaryIdToUse,
          correctionCount: (state.metadata?.correctionHistory as CorrectionHistory[] | undefined)?.length ?? 0,
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        
        await updateStep(DomainOnlyWorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
        })
        
        await errorHandler.handleError(
          err,
          "verification_completed",
          { 
            previousStep: state.currentStep, 
            details: { finalSummaryId }, 
            showToast: true,
            workflowId: workflowId ?? undefined
          }
        )
        
        throw err
      }
    },
    [userId, workflowId, state, updateStep, errorHandler, state.currentStep]
  )

  /**
   * Reset verification back to idle state
   */
  const resetVerification = useCallback(async () => {
    if (userId === null || userId === undefined) {
      throw new Error('User ID required for verification reset')
    }
    
    try {
      // Reset local state
      setState((prevState) => ({
        ...prevState,
        currentStep: "idle",
        progress: 0,
        error: null,
        timestamp: new Date().toISOString(),
        metadata: {
          ...(prevState.metadata ?? {}),
          verificationMetadata: null,
          currentSummaryId: null,
          correctionHistory: []
        }
      }))
      
      // Reset in database if workflowId exists
      if (workflowId !== null && workflowId !== undefined) {
        await workflowService.updateWorkflowState(
          workflowId,
          "idle",
          {
            verificationMetadata: null,
            currentSummaryId: null,
            correctionHistory: [],
          },
          { forceUpdate: true }
        )
      }
      
      return { success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('Error resetting verification:', errorMessage)
      
      await errorHandler.handleError(
        err,
        "idle", 
        { 
          previousStep: state.currentStep, 
          details: { action: 'resetVerification' }, 
          showToast: true,
          workflowId: workflowId ?? undefined
        }
      )
      
      throw err
    }
  }, [userId, workflowId, state.currentStep, errorHandler])

  /**
   * Begin report generation using the report workflow processor
   */
  const beginReportGeneration = useCallback(
    async (generationType: string, options: { patientId?: string, documentIds?: string[] } = {}) => {
      try {
        // Update local state for immediate UI feedback
        await updateStep("report_generation", {
          generationType,
          generationStartedAt: new Date().toISOString(),
          ...(options.patientId ? { patientId: options.patientId } : {}),
          ...(options.documentIds ? { documentIds: options.documentIds } : {})
        })
        
        // Use the report workflow processor when appropriate
        if (workflowId && options.patientId) {
          // Begin actual report generation process if we have required IDs
          await workflowService.generateReport(
            workflowId,
            {
              patientId: options.patientId,
              documentIds: options.documentIds,
              generateType: generationType,
              userId: userId ?? undefined,
              progressCallback: (progress, phase) => {
                void updateProgress(progress, phase as ProcessingPhase)
              }
            }
          )
        }
        
        return true
      } catch (err) {
        await errorHandler.handleError(
          err,
          "report_generation",
          { 
            previousStep: state.currentStep, 
            details: { generationType, ...options }, 
            showToast: true,
            workflowId: workflowId ?? undefined
          }
        )
        return false
      }
    },
    [updateStep, updateProgress, errorHandler, state.currentStep, workflowId, userId]
  )

  /**
   * Process document upload and extraction using the document workflow processor
   */
  const processDocument = useCallback(async (file: File, options: { patientId?: string } = {}) => {
    try {
      if (!workflowId) {
        throw new Error('Workflow ID is required for document processing');
      }
      
      // Update local state for immediate UI feedback
      await updateStep("uploading", { fileName: file.name, fileSize: file.size })
      await updateProgress(0, ProcessingPhase.UPLOADING)
      
      // Use transaction manager for reliable processing
      return await runOperation(
        "uploading",
        async () => {
          // Use the document workflow processor
          const result = await workflowService.processDocumentUpload(
            workflowId,
            file,
            {
              userId: userId ?? undefined,
              patientId: options.patientId,
              progressCallback: (progress, phase) => {
                void updateProgress(progress, phase as ProcessingPhase)
              }
            }
          )
          
          // Update step based on result
          if (result.success) {
            await updateStep("complete", {
              documentId: result.documentId,
              storedFileName: result.fileName,
              completedAt: new Date().toISOString()
            })
          }
          
          return result
        },
        {
          withNotifications: true,
          recoveryPath: "idle",
          progressReporter: (progress, phase) => {
            void updateProgress(progress, phase)
          }
        }
      )
    } catch (err) {
      const errorMessage = normalizeError(err).message
      
      await updateStep(DomainOnlyWorkflowStep.ERROR, {
        error: errorMessage,
        errorTimestamp: new Date().toISOString(),
      })
      
      return { success: false, error: errorMessage }
    }
  }, [workflowId, userId, updateStep, updateProgress, runOperation])

  /**
   * Computed convenience status object
   */
  const status = useMemo(() => {
    return {
      currentStep: state.currentStep,
      progress: state.progress,
      phase: state.phase,
      isError: state.currentStep === DomainOnlyWorkflowStep.ERROR,
      isComplete: state.currentStep === "complete",
      isIdle: state.currentStep === "idle",
      isUploading: state.currentStep === "uploading",
      isExtracting: state.currentStep === "extracting",
      isVerifying: state.currentStep === "verification" || 
                   state.currentStep === "verification_pending" || 
                   state.currentStep === "verification_in_progress",
      isVerificationComplete: state.currentStep === "verification_completed",
      isGeneratingReport: state.currentStep === "report_generation"
    }
  }, [state.currentStep, state.progress, state.phase])

  return {
    state,
    workflowId,
    updateStep,
    updateProgress,
    runOperation,
    initiateVerification,
    processCorrection,
    completeVerification,
    resetVerification,
    beginReportGeneration,
    processDocument,
    status,
  }
}