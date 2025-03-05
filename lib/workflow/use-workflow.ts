import { useCallback, useEffect, useState, useMemo } from 'react'
import { randomUUID } from 'crypto'
import {
  WorkflowStep,
  ProcessingPhase,
  type WorkflowOptions,
  type WorkflowState,
  type VerificationMetadata,
} from '@/lib/types/workflow'
import { workflowService } from '@/lib/services/workflow/workflow-service'
import { extractPatientSummary, processCorrection as processPatientSummaryCorrection } from '@/lib/langchain/patient-summary'
import { useWorkflowErrorHandler } from './workflow-error-handler'
import { normalizeError } from '@/lib/errors'

interface UseWorkflowOptions {
  userId?: string
  initialStep?: WorkflowStep
  chatId?: string | null
}

export function useWorkflow(options: UseWorkflowOptions = {}) {
  const { userId, initialStep = WorkflowStep.IDLE, chatId } = options
  const [state, setState] = useState<WorkflowState>({
    currentStep: initialStep,
    progress: 0,
    timestamp: new Date().toISOString(),
    metadata: {}
  })
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const errorHandler = useWorkflowErrorHandler()
  const [subscriptionChannel, setSubscriptionChannel] = useState<any>(null)

  /**
   * Load or create workflow state from DB using the workflowService
   */
  const loadOrCreateWorkflowState = useCallback(async () => {
    if (!userId) return null
    try {
      // This returns { id, data } where data is the row
      const { id, data } = await workflowService.getOrCreateWorkflowForUser(
        userId,
        chatId ?? null,
        initialStep,
        { progress: 0, currentStep: initialStep, createdAt: new Date().toISOString() }
      )
      setWorkflowId(id)

      if (data && data.metadata) {
        const meta = data.metadata as Record<string, unknown>
        setState((old) => ({
          ...old,
          currentStep: (meta.currentStep as WorkflowStep) || data.current_step,
          progress: typeof meta.progress === 'number' ? meta.progress : 0,
          phase: typeof meta.phase === 'string' ? (meta.phase as ProcessingPhase) : undefined,
          error: typeof meta.error === 'string' ? meta.error : null,
          metadata: meta,
          timestamp: new Date(data.updated_at).toISOString(),
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
    if (!userId) return
    const channel = workflowService.subscribeToWorkflowForUser(
      userId,
      chatId ?? null,
      (payload) => {
        try {
          const newData = payload.new
          if (!newData) return
          const meta = (newData.metadata as Record<string, unknown>) ?? {}
          setWorkflowId(newData.id)
          setState((old) => ({
            currentStep: (meta.currentStep as WorkflowStep) || (newData.current_step as WorkflowStep),
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

  useEffect(() => {
    if (!userId) return
    // Load or create the workflow row
    void loadOrCreateWorkflowState()
    // Then subscribe
    subscribeToChanges()
    return () => {
      if (subscriptionChannel) {
        workflowService.unsubscribeFromChannel(subscriptionChannel)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, chatId])

  /**
   * Update workflow step (and metadata) in DB, and also update local state
   */
  const updateStep = useCallback(
    async (step: WorkflowStep, metadata?: Record<string, unknown>) => {
      try {
        const newState: WorkflowState = {
          ...state,
          currentStep: step,
          metadata: { ...(state.metadata ?? {}), ...metadata, currentStep: step },
          timestamp: new Date().toISOString(),
        }
        setState(newState)
        if (workflowId) {
          await workflowService.updateWorkflowState(
            workflowId,
            step,
            metadata
          )
        }
        return newState
      } catch (error) {
        await errorHandler.handleError(
          error,
          state.currentStep,
          { details: { step, metadata }, showToast: true }
        )
        return state
      }
    },
    [state, workflowId, errorHandler]
  )

  /**
   * Update progress (plus optional phase) in DB
   */
  const updateProgress = useCallback(
    async (progress: number, phase?: ProcessingPhase) => {
      try {
        const newMeta = {
          ...state.metadata,
          progress,
        } as Record<string, unknown>
        if (phase) {
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
        if (workflowId) {
          await workflowService.updateWorkflowState(workflowId, state.currentStep, newMeta, { skipValidation: true })
        }
        return newState
      } catch (error) {
        await errorHandler.handleError(
          error,
          state.currentStep,
          { details: { progress, phase }, showToast: true }
        )
        return state
      }
    },
    [state, workflowId, errorHandler]
  )

  /**
   * Generic helper: run an operation with set step/progress, catch errors
   */
  const runOperation = useCallback(
    async <T>(
      step: WorkflowStep,
      operation: () => Promise<T>,
      options?: WorkflowOptions<T>
    ): Promise<T> => {
      try {
        await updateStep(step, { startedAt: new Date().toISOString() })
        await updateProgress(5, ProcessingPhase.INITIALIZATION)

        const result = await operation()
        await updateProgress(100, ProcessingPhase.COMPLETION)
        options?.onSuccess?.(result)
        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        await updateStep(WorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
        })
        options?.onError?.(errorMessage)

        await errorHandler.handleError(
          error,
          step,
          { previousStep: state.currentStep, details: { step }, showToast: true }
        )
        throw error
      }
    },
    [updateStep, updateProgress, errorHandler, state.currentStep]
  )

  /**
   * Initiate verification (ex: extracted doc data).
   * Moved direct DB logic to workflow service; we'll do minimal local updates here.
   */
  const initiateVerification = useCallback(
    async (extractedDocument: unknown, messageId?: string) => {
      if (!userId || !chatId) {
        throw new Error('User ID and Chat ID are required for verification')
      }
      try {
        const summaryId = randomUUID()
        let documentText = String(extractedDocument)
        if (typeof extractedDocument === 'object' && extractedDocument !== null) {
          documentText =
            (extractedDocument as { text?: string }).text ??
            JSON.stringify(extractedDocument)
        }

        // We'll rely on server update for verification; just update local step
        await updateStep(WorkflowStep.VERIFICATION_PENDING, {
          verificationMetadata: {
            verificationStatus: 'pending',
            originalSummaryId: summaryId,
            currentVersionId: summaryId,
            correctionCount: 0,
            corrections: [],
            extractedData: extractedDocument,
          } as VerificationMetadata,
          currentSummaryId: summaryId,
          correctionHistory: [],
        })

        // Then do the actual summarization
        const result = await extractPatientSummary(
          documentText,
          workflowId || '',
          { useGemini: true },
          (progress, phase) => {
            // We'll call updateProgress here
            void updateProgress(progress, phase as ProcessingPhase)
          }
        )

        if (result.success !== true) {
          throw new Error(result.error ?? 'Failed to extract patient summary')
        }

        // local state updated to reflect successful extraction
        setState((old) => ({
          ...old,
          progress: 100,
          phase: ProcessingPhase.VERIFICATION,
          timestamp: new Date().toISOString(),
        }))

        return {
          summaryId,
          summary: result.summary,
          structuredData: result.structuredData,
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        await updateStep(WorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
        })
        await errorHandler.handleError(
          err,
          WorkflowStep.VERIFICATION_PENDING,
          { previousStep: state.currentStep, details: { extractedDocument, messageId }, showToast: true }
        )
        throw err
      }
    },
    [userId, chatId, workflowId, state, updateStep, updateProgress, errorHandler]
  )

  /**
   * Process a correction for verification.
   * We'll keep local state updates, but the direct DB calls happen in workflowService if needed.
   */
  const processCorrection = useCallback(
    async (correctionText: string, currentSummary: string, messageId?: string) => {
      if (!userId || !chatId || !state.metadata?.currentSummaryId) {
        throw new Error('Missing required IDs for correction processing')
      }
      try {
        const newSummaryId = randomUUID()
        // We'll store correction in local state.
        const updatedHistory = [
          ...(state.metadata?.correctionHistory as any[] || []),
          {
            correction_text: correctionText,
            timestamp: new Date().toISOString(),
            summary_id: newSummaryId,
            message_id: messageId,
          },
        ]

        await updateStep(WorkflowStep.VERIFICATION_IN_PROGRESS, {
          correctionHistory: updatedHistory,
          currentSummaryId: newSummaryId,
        })

        // Actually process the correction
        const result = await processPatientSummaryCorrection(
          currentSummary,
          correctionText,
          workflowId || '',
          { useGemini: false },
          (progress, phase) => {
            void updateProgress(progress, phase as ProcessingPhase)
          }
        )

        if (!result.success) {
          throw new Error(result.error ?? 'Failed to process correction')
        }

        // Also reflect updated verification metadata in local state
        const currentVerificationMetadata = (state.metadata?.verificationMetadata as VerificationMetadata) || {}
        const updatedVerificationMetadata = {
          ...currentVerificationMetadata,
          verificationStatus: 'inProgress',
          currentVersionId: newSummaryId,
          correctionCount: updatedHistory.length,
          lastUpdated: new Date().toISOString(),
        } as VerificationMetadata

        setState((old) => ({
          ...old,
          currentStep: WorkflowStep.VERIFICATION_IN_PROGRESS,
          metadata: {
            ...old.metadata,
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
        await updateStep(WorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
        })
        throw err
      }
    },
    [userId, chatId, workflowId, state, updateStep, updateProgress]
  )

  /**
   * Complete verification - local state updates only here,
   * real DB logic can be in the workflowService if needed.
   */
  const completeVerification = useCallback(
    async (finalSummaryId?: string) => {
      if (!userId) {
        throw new Error('User ID required for verification completion')
      }
      try {
        const summaryIdToUse = finalSummaryId || (state.metadata?.currentSummaryId as string)
        if (!summaryIdToUse) {
          throw new Error('No summary ID available for verification completion')
        }
        const currentVerificationMetadata = (state.metadata?.verificationMetadata as VerificationMetadata) || {}
        const updatedVerificationMetadata = {
          ...currentVerificationMetadata,
          verificationStatus: 'completed',
          verifiedAt: new Date().toISOString(),
          verifiedBy: userId,
        } as VerificationMetadata

        // Just do a local step update
        await updateStep(WorkflowStep.VERIFICATION_COMPLETED, {
          verificationMetadata: updatedVerificationMetadata,
        })
        return {
          success: true,
          summaryId: summaryIdToUse,
          correctionCount: (state.metadata?.correctionHistory as any[])?.length || 0,
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        await updateStep(WorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
        })
        throw err
      }
    },
    [userId, state, updateStep]
  )

  /**
   * Reset verification back to idle in local state.
   * The DB call can be done in the workflowService if we wish to remove it from the record.
   */
  const resetVerification = useCallback(async () => {
    if (!userId) {
      throw new Error('User ID required for verification reset')
    }
    try {
      // We'll just set step to IDLE and clear out verification-related fields
      setState((old) => ({
        ...old,
        currentStep: WorkflowStep.IDLE,
        progress: 0,
        error: null,
        timestamp: new Date().toISOString(),
        metadata: {
          ...(old.metadata ?? {}),
          verificationMetadata: null,
          currentSummaryId: null,
          correctionHistory: []
        }
      }))
      if (workflowId) {
        // We'll do a forced update
        await workflowService.updateWorkflowState(
          workflowId,
          WorkflowStep.IDLE,
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
      // eslint-disable-next-line no-console
      console.error('Error resetting verification:', errorMessage)
      throw err
    }
  }, [userId, state, workflowId])

  /**
   * Example function to begin a "report generation" step.
   */
  const beginReportGeneration = useCallback(
    async (generationType: string) => {
      try {
        await updateStep(WorkflowStep.REPORT_GENERATION, {
          generationType,
          generationStartedAt: new Date().toISOString(),
        })
        return true
      } catch (err) {
        await errorHandler.handleError(
          err,
          WorkflowStep.REPORT_GENERATION,
          { previousStep: state.currentStep, details: { generationType }, showToast: true }
        )
        return false
      }
    },
    [updateStep, errorHandler, state.currentStep]
  )

  /**
   * A sample to process a doc from "uploading" to "complete" or "error".
   * Now we rely on workflowService to do the final update too, if needed.
   */
  const processDocument = useCallback(async (file: File) => {
    try {
      await updateStep(WorkflowStep.UPLOADING, { fileName: file.name, fileSize: file.size })
      await updateProgress(0, ProcessingPhase.UPLOADING)

      // Example check
      // (In a real app we might call an upload service, etc.)
      if (!userId) {
        throw new Error('User not authenticated')
      }

      // Fake "upload"
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Mark complete
      await updateStep(WorkflowStep.COMPLETE, {
        storedFileName: file.name,
        completedAt: new Date().toISOString()
      })
      await updateProgress(100, ProcessingPhase.COMPLETION)

      return { success: true, uploadedFileName: file.name } as const
    } catch (err) {
      const e = normalizeError(err)
      await updateStep(WorkflowStep.ERROR, {
        error: e.message,
        errorTimestamp: new Date().toISOString(),
      })
      return { success: false, error: e.message } as const
    }
  }, [updateStep, updateProgress, userId])

  /**
   * Computed convenience status object
   */
  const status = useMemo(() => {
    return {
      currentStep: state.currentStep,
      progress: state.progress,
      phase: state.phase,
      isError: state.currentStep === WorkflowStep.ERROR,
      isComplete: state.currentStep === WorkflowStep.COMPLETE
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