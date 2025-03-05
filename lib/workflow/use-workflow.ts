import { useCallback, useEffect, useState, useMemo } from 'react'
import { randomUUID } from 'crypto'
import type {
  WorkflowState
,
  WorkflowStep
} from '@/lib/types/workflow'
import type { VerificationMetadata } from '@/lib/types/verification'
import {
  ProcessingPhase,
  DomainOnlyWorkflowStep
} from '@/lib/types/workflow'
import { WorkflowService } from '@/lib/services/workflow/workflow-service'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { extractPatientSummary, processCorrection as processPatientSummaryCorrection } from '@/lib/langchain/patient-summary'
import { useWorkflowErrorHandler } from './workflow-error-handler'
import { normalizeError } from '@/lib/errors'

interface UseWorkflowOptions {
  userId?: string
  initialStep?: WorkflowStep
  chatId?: string | null
}

interface CorrectionHistory {
  correction_text: string
  timestamp: string
  summary_id: string
  message_id?: string
}

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
  // Use useMemo to stabilize workflowService reference
  const workflowService = useMemo(() => new WorkflowService(), [])

  /**
   * Load or create workflow state from DB using the workflowService
   */
  const loadOrCreateWorkflowState = useCallback(async () => {
    if (userId === null || userId === undefined || userId.trim() === "") return null
    try {
      // This returns { id, data } where data is the row
      const { id, data } = await workflowService.getOrCreateWorkflowForUser(
        userId,
        chatId ?? null,
        initialStep,
        { progress: 0, currentStep: initialStep, createdAt: new Date().toISOString() }
      )
      setWorkflowId(id)

      if (data !== null && data !== undefined && data.metadata !== undefined) {
        const meta = data.metadata as Record<string, unknown>
        setState((prevState) => ({
          ...prevState,
          currentStep: (meta.currentStep as WorkflowStep) !== undefined ? (meta.currentStep as WorkflowStep) : (data.current_step as WorkflowStep),
          progress: typeof meta.progress === 'number' ? meta.progress : 0,
          phase: typeof meta.phase === 'string' ? (meta.phase as ProcessingPhase) : undefined,
          error: typeof meta.error === 'string' ? meta.error : null,
          metadata: meta,
          timestamp: new Date(String(data.updated_at)).toISOString(),
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
  }, [userId, chatId, initialStep, errorHandler, workflowService])

  /**
   * Subscribe to workflow state changes for user+chat via the workflowService
   */
  const subscribeToChanges = useCallback(() => {
    if (userId === null || userId === undefined) return
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
  }, [userId, chatId, errorHandler, state.currentStep, workflowService])

  useEffect(() => {
    if (userId === null || userId === undefined) return
    // Load or create the workflow row
    void loadOrCreateWorkflowState()
    // Then subscribe
    subscribeToChanges()
    return () => {
      if (subscriptionChannel !== null && subscriptionChannel !== undefined) {
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
        if (workflowId !== null && workflowId !== undefined) {
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
    [state, workflowId, errorHandler, workflowService]
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
        if (workflowId !== null && workflowId !== undefined) {
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
    [state, workflowId, errorHandler, workflowService]
  )

  /**
   * Generic helper: run an operation with set step/progress, catch errors
   */
  const runOperation = useCallback(
    async <T>(
      step: WorkflowStep,
      operation: () => Promise<T>,
      options?: {
        onSuccess?: (result: T) => void,
        onError?: (error: string) => void
      }
    ): Promise<T> => {
      try {
        await updateStep(step, { startedAt: new Date().toISOString() })
        await updateProgress(5, ProcessingPhase.INITIALIZATION)

        const result = await operation()
        await updateProgress(100, ProcessingPhase.COMPLETION)
        if (options?.onSuccess !== undefined) {
          options.onSuccess(result)
        }
        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        await updateStep(DomainOnlyWorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
        })
        if (options?.onError !== undefined) {
          options.onError(errorMessage)
        }

        await errorHandler.handleError(
          error,
          step,
          { previousStep: state.currentStep, details: { step }, showToast: true }
        )
        throw error
      }
    }, [updateStep, updateProgress, errorHandler, state.currentStep]
  )

  /**
   * Initiate verification (ex: extracted doc data).
   * Moved direct DB logic to workflow service; we'll do minimal local updates here.
   */
  const initiateVerification = useCallback(
    async (extractedDocument: unknown, messageId?: string) => {
      if (userId === null || userId === undefined || userId.trim() === "" ||
          chatId === null || chatId === undefined || (typeof chatId === 'string' && chatId.trim() === "")) {
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
        await updateStep("verification_pending", {
          verificationMetadata: {
            verification_status: 'pending',
            originalSummaryId: summaryId,
            currentVersionId: summaryId,
            correctionCount: 0,
            corrections: [],
            extractedData: extractedDocument,
          } as unknown as VerificationMetadata, // Cast to bypass type check issues
          currentSummaryId: summaryId,
          correctionHistory: [],
        })

        // Then do the actual summarization
        const result = await extractPatientSummary(
          documentText,
          workflowId ?? '',
          { useGemini: true },
          (progress, phase) => {
            // We'll call updateProgress here
            void updateProgress(progress, phase as ProcessingPhase)
          }
        )

        if (!result.success) {
          throw new Error(result.error ?? 'Failed to extract patient summary')
        }

        // local state updated to reflect successful extraction
        setState((prevState) => ({
          ...prevState,
          progress: 100,
          phase: ProcessingPhase.VERIFICATION,
          timestamp: new Date().toISOString(),
        }))

        return {
          summaryId,
          summary: result.summary,
          ...(result !== null && result !== undefined && result.structuredData !== undefined && result.summary !== undefined 
            ? { structuredData: result.structuredData }
            : {})
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
      if (userId === null || userId === undefined ||
          chatId === null || chatId === undefined ||
          state.metadata === undefined || state.metadata.currentSummaryId === undefined) {
        throw new Error('Missing required IDs for correction processing')
      }
      try {
        const newSummaryId = randomUUID()
        // We'll store correction in local state.
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

        // Actually process the correction
        const result = await processPatientSummaryCorrection(
          currentSummary,
          correctionText,
          workflowId ?? '',
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
      if (userId === null || userId === undefined) {
        throw new Error('User ID required for verification completion')
      }
      try {
        const summaryIdToUse = finalSummaryId ?? (state.metadata?.currentSummaryId as string)
        if (summaryIdToUse === undefined) {
          throw new Error('No summary ID available for verification completion')
        }
        const currentVerificationMetadata = (state.metadata?.verificationMetadata as VerificationMetadata) ?? {}
        const updatedVerificationMetadata = {
          ...currentVerificationMetadata,
          verification_status: 'completed',
          verifiedAt: new Date().toISOString(),
          verifiedBy: userId,
        } as unknown as VerificationMetadata

        // Just do a local step update
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
    if (userId === null || userId === undefined) {
      throw new Error('User ID required for verification reset')
    }
    try {
      // We'll just set step to IDLE and clear out verification-related fields
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
      if (workflowId !== null && workflowId !== undefined) {
        // We'll do a forced update
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
      // eslint-disable-next-line no-console
      console.error('Error resetting verification:', errorMessage)
      throw err
    }
  }, [userId, workflowId, workflowService])

  /**
   * Example function to begin a "report generation" step.
   */
  const beginReportGeneration = useCallback(
    async (generationType: string) => {
      try {
        await updateStep("report_generation", {
          generationType,
          generationStartedAt: new Date().toISOString(),
        })
        return true
      } catch (err) {
        await errorHandler.handleError(
          err,
          "report_generation",
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
        await updateStep("uploading", { fileName: file.name, fileSize: file.size })
      await updateProgress(0, ProcessingPhase.UPLOADING)

      // Example check
      // (In a real app we might call an upload service, etc.)
      if (userId === null || userId === undefined) {
        throw new Error('User not authenticated')
      }

      // Fake "upload"
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Mark complete
      await updateStep("complete", {
        storedFileName: file.name,
        completedAt: new Date().toISOString()
      })
      await updateProgress(100, ProcessingPhase.COMPLETION)

      return { success: true, uploadedFileName: file.name } as const
    } catch (err) {
      const e = normalizeError(err)
      await updateStep(DomainOnlyWorkflowStep.ERROR, {
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
      isError: state.currentStep === DomainOnlyWorkflowStep.ERROR,
      isComplete: state.currentStep === "complete"
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