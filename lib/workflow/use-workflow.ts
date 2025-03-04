import { randomUUID } from 'crypto'
import { extractPatientSummary, processCorrection as processPatientSummaryCorrection } from '@/lib/langchain/patient-summary'
import { useCallback, useEffect, useState, useMemo } from 'react'
import type { VerificationMetadata, WorkflowOptions, WorkflowState } from '@/lib/types/workflow'
import {
  ProcessingPhase,
  VerificationStatusType,
  WorkflowStep,
} from '@/lib/types/workflow'
import { createBrowserClient } from '@/lib/supabase/clients'
import type { Database, Json } from '@/lib/types/database'
import { useWorkflowErrorHandler } from './workflow-error-handler'
import type { FileUpload } from '@/lib/types/upload'
import { normalizeError } from '@/lib/errors'

interface UseWorkflowOptions {
  userId?: string
  initialStep?: WorkflowStep
  chatId?: string | null
}

// Define proper types for database responses
interface WorkflowStateData {
  id: string
  user_id: string
  current_step: string
  chat_id?: string | null
  correction_history?: unknown[]
  current_summary_id?: string
  metadata: Record<string, unknown>
  verification_metadata?: Record<string, unknown>
  updated_at: string
  created_at: string
  last_message_id?: string | null
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
  const supabase = createBrowserClient()
  const errorHandler = useWorkflowErrorHandler()

  /**
   * Creates a new workflow state record in the DB if none exists.
   */
  const createNewWorkflowState = useCallback(async () => {
    if (!userId) return null

    try {
      const metadata = {
        progress: 0,
        currentStep: state.currentStep,
        createdAt: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('workflow_states')
        .insert({
          user_id: userId,
          current_step: state.currentStep as Database['public']['Enums']['workflow_step'],
          chat_id: chatId,
          metadata,
          correction_history: [],
        })
        .select()
        .single()

      if (data && !error) {
        setWorkflowId(data.id)
        return data.id
      }

      if (error) throw error
      return null
    } catch (error) {
      void errorHandler.handleError(
        error,
        state.currentStep,
        { details: { userId, chatId }, showToast: true }
      )
      return null
    }
  }, [userId, chatId, state.currentStep, supabase, errorHandler])

  /**
   * Load or create workflow state on mount. Subscribe to real-time changes.
   */
  useEffect(() => {
    if (!userId) return

    const loadWorkflowState = async (): Promise<void> => {
      try {
        const { data } = await supabase
          .from('workflow_states')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()

        // If no state, create one
        if (!data) {
          void createNewWorkflowState()
          return
        }

        const newData = data as WorkflowStateData
        const metadata: Record<string, unknown> = {}

        if (newData.metadata) {
          Object.assign(metadata, newData.metadata)
        }

        if (newData.current_step) {
          metadata.currentStep = newData.current_step
        }

        if (newData.verification_metadata) {
          metadata.verificationMetadata = newData.verification_metadata
        }

        if (newData.correction_history) {
          metadata.correctionHistory = newData.correction_history
        }

        if (newData.current_summary_id) {
          metadata.currentSummaryId = newData.current_summary_id
        }

        setState({
          currentStep: (metadata.currentStep as WorkflowStep) || (newData.current_step as WorkflowStep),
          progress: (metadata.progress as number) ?? 0,
          phase: metadata.phase as ProcessingPhase | undefined,
          error: metadata.error as string | undefined,
          metadata,
          timestamp: new Date(newData.updated_at).toISOString(),
        })
        setWorkflowId(newData.id)
      } catch (error) {
        void errorHandler.handleError(
          error,
          state.currentStep,
          { details: { userId, chatId }, showToast: true }
        )
      }
    }

    void (async () => {
      await loadWorkflowState()
    })()

    const channelName = `workflow-${userId}-${chatId ?? 'null'}`
    const channel = supabase.channel(channelName)

    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workflow_states',
          filter: chatId
            ? `user_id=eq.${userId} AND chat_id=eq.${chatId}`
            : `user_id=eq.${userId} AND chat_id IS NULL`,
        },
        (payload) => {
          try {
            const newData = payload.new as WorkflowStateData
            const metadata = (newData.metadata as Record<string, unknown>) ?? {}

            if (newData.verification_metadata) {
              metadata.verificationMetadata = newData.verification_metadata
            }

            if (newData.correction_history) {
              metadata.correctionHistory = newData.correction_history
            }

            if (newData.current_summary_id) {
              metadata.currentSummaryId = newData.current_summary_id
            }

            setState({
              currentStep: (metadata.currentStep as WorkflowStep) || (newData.current_step as WorkflowStep),
              progress: (metadata.progress as number) || 0,
              phase: metadata.phase as ProcessingPhase | undefined,
              error: metadata.error as string | undefined,
              metadata,
              timestamp: new Date(newData.updated_at).toISOString(),
            })
            setWorkflowId(newData.id)
          } catch (error) {
            void errorHandler.handleError(
              error,
              state.currentStep,
              { details: { userId, chatId, payload }, showToast: true }
            )
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, chatId, supabase, errorHandler, state.currentStep, createNewWorkflowState])

  /**
   * Helper to update database with new step/progress/etc.
   */
  const updateDatabase = useCallback(
    async (
      newStep?: WorkflowStep,
      newProgress?: number,
      newPhase?: ProcessingPhase,
      newError?: string | null,
      newMetadata?: Record<string, unknown>
    ) => {
      if (!userId) return

      try {
        if (!workflowId) {
          await createNewWorkflowState()
          return
        }

        const updates: Record<string, unknown> = {}

        if (newStep !== null && newStep !== undefined) {
          updates.current_step = newStep as Database['public']['Enums']['workflow_step']
        }

        const updatedMetadata = {
          ...(state.metadata ?? {}),
          ...(newMetadata ?? {}),
        }

        if (newProgress !== undefined) {
          updatedMetadata.progress = newProgress
        }
        if (newPhase !== undefined) {
          updatedMetadata.phase = newPhase
        }
        if (newError !== undefined) {
          updatedMetadata.error = newError
        }
        if (newStep !== null && newStep !== undefined) {
          updatedMetadata.currentStep = newStep
        }

        updatedMetadata.updatedAt = new Date().toISOString()
        updates.metadata = updatedMetadata

        const { error } = await supabase
          .from('workflow_states')
          .update(updates)
          .eq('id', workflowId)

        if (error) {
          throw error
        }
      } catch (error) {
        void errorHandler.handleError(
          error,
          state.currentStep,
          { details: { userId, workflowId, newStep, newProgress, newPhase }, showToast: true }
        )
      }
    },
    [userId, workflowId, state.metadata, createNewWorkflowState, supabase, errorHandler, state.currentStep]
  )

  /**
   * Update only the step (plus optional metadata).
   */
  const updateStep = useCallback(
    (step: WorkflowStep, metadata?: Record<string, unknown>) => {
      try {
        const newState: WorkflowState = {
          ...state,
          currentStep: step,
          metadata: { ...(state.metadata ?? {}), ...metadata, currentStep: step },
          timestamp: new Date().toISOString(),
        }
        setState(newState)
        void updateDatabase(step, undefined, undefined, undefined, metadata)
        return newState
      } catch (error) {
        void errorHandler.handleError(
          error,
          state.currentStep,
          { details: { step, metadata }, showToast: true }
        )
        return state
      }
    },
    [state, updateDatabase, errorHandler]
  )

  /**
   * Update only the progress (and optional phase).
   */
  const updateProgress = useCallback(
    (progress: number, phase?: ProcessingPhase) => {
      try {
        const newState: WorkflowState = {
          ...state,
          progress,
          phase,
          timestamp: new Date().toISOString(),
        }
        setState(newState)
        void updateDatabase(undefined, progress, phase)
        return newState
      } catch (error) {
        void errorHandler.handleError(
          error,
          state.currentStep,
          { details: { progress, phase }, showToast: true }
        )
        return state
      }
    },
    [state, updateDatabase, errorHandler]
  )

  /**
   * Generic helper to run an operation while setting step, progress, error, etc.
   */
  const runOperation = useCallback(
    async <T>(
      step: WorkflowStep,
      operation: () => Promise<T>,
      options?: WorkflowOptions<T>
    ): Promise<T> => {
      try {
        updateStep(step, { startedAt: new Date().toISOString() })
        updateProgress(0, ProcessingPhase.INITIALIZATION)

        const handleProgress = (progress: number, phase?: string) => {
          updateProgress(progress, phase as ProcessingPhase)
          options?.onProgress?.(progress, phase)
        }

        handleProgress(5, ProcessingPhase.INITIALIZATION)

        const result = await operation()

        handleProgress(100, ProcessingPhase.COMPLETION)
        options?.onSuccess?.(result)
        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        updateStep(WorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
        })
        options?.onError?.(errorMessage)

        void errorHandler.handleError(
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
   * Initiate a verification step with extracted doc data.
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
        const newVerificationMetadata: VerificationMetadata = {
          verificationStatus: VerificationStatusType.PENDING,
          originalSummaryId: summaryId,
          currentVersionId: summaryId,
          correctionCount: 0,
          corrections: [],
          extractedData: extractedDocument,
        }
        const verificationDbMetadata = {
          extracted_data: extractedDocument,
          verification_started_at: new Date().toISOString(),
          status: 'pending',
        } as unknown as Json
        const { data: _existingState } = await supabase
          .from('workflow_states')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()
        const { data, error } = await supabase
          .from('workflow_states')
          .upsert(
            {
              id: _existingState?.id,
              user_id: userId,
              current_step: WorkflowStep.VERIFICATION_PENDING as Database['public']['Enums']['workflow_step'],
              metadata: _existingState?.metadata || {},
              verification_metadata: verificationDbMetadata,
              chat_id: chatId,
              correction_history: [],
              current_summary_id: summaryId,
              last_message_id: messageId,
              updated_at: new Date().toISOString(),
              created_at: _existingState?.created_at ?? new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          )
          .select()
          .single()
        if (error) {
          throw new Error(`Database error: ${error.message}`)
        }
        updateStep(WorkflowStep.VERIFICATION_PENDING, {
          verificationMetadata: newVerificationMetadata,
          currentSummaryId: summaryId,
          correctionHistory: [],
        })
        const result = await extractPatientSummary(
          documentText,
          workflowId || data.id,
          { useGemini: true },
          (progress, phase) => {
            updateProgress(progress, phase as ProcessingPhase)
          }
        )
        if (result.success !== true) {
          throw new Error(result.error ?? 'Failed to extract patient summary')
        }
        setState({
          ...state,
          currentStep: WorkflowStep.VERIFICATION_PENDING,
          progress: 100,
          phase: ProcessingPhase.VERIFICATION,
          timestamp: new Date().toISOString(),
          metadata: {
            ...(state.metadata ?? {}),
            verificationMetadata: newVerificationMetadata,
            currentSummaryId: summaryId,
            correctionHistory: [],
          },
        })
        return {
          summaryId,
          summary: result.summary,
          structuredData: result.structuredData,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        updateStep(WorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
        })

        void errorHandler.handleError(
          error,
          WorkflowStep.VERIFICATION_PENDING,
          { previousStep: state.currentStep, details: { extractedDocument, messageId }, showToast: true }
        )
        throw error
      }
    },
    [userId, chatId, workflowId, state, supabase, updateProgress, updateStep, errorHandler]
  )

  /**
   * Process a correction for verification.
   */
  const processCorrection = useCallback(
    async (correctionText: string, currentSummary: string, messageId?: string) => {
      if (!userId || !chatId || !state.metadata?.currentSummaryId) {
        throw new Error('Missing required IDs for correction processing')
      }
      try {
        const newSummaryId = randomUUID()
        const { data: currentState, error: fetchError } = await supabase
          .from('workflow_states')
          .select('*')
          .eq('user_id', userId)
          .single()
        if (fetchError || !currentState) {
          throw new Error('No workflow state found for user')
        }
        const workflowState = currentState as any
        const currentStep = workflowState.current_step
        if (
          currentStep !== WorkflowStep.VERIFICATION_PENDING &&
          currentStep !== WorkflowStep.VERIFICATION_IN_PROGRESS &&
          currentStep !== WorkflowStep.VERIFICATION
        ) {
          throw new Error(`Invalid workflow step for correction: ${currentStep}`)
        }
        const correctionHistoryData = workflowState.correction_history || []
        const updatedHistory = [
          ...correctionHistoryData,
          {
            correction_text: correctionText,
            timestamp: new Date().toISOString(),
            summary_id: newSummaryId,
            message_id: messageId,
          },
        ]
        updateStep(WorkflowStep.VERIFICATION_IN_PROGRESS, {
          correctionHistory: updatedHistory,
          currentSummaryId: newSummaryId,
        })
        const result = await processPatientSummaryCorrection(
          currentSummary,
          correctionText,
          workflowId || '',
          { useGemini: false },
          (progress, phase) => {
            updateProgress(progress, phase as ProcessingPhase)
          }
        )
        if (!result.success) {
          throw new Error(result.error ?? 'Failed to process correction')
        }
        const currentVerificationMetadata = workflowState.verification_metadata || {}
        const updatedVerificationMetadata = {
          ...currentVerificationMetadata,
          verificationStatus: VerificationStatusType.IN_PROGRESS,
          currentVersionId: newSummaryId,
          correctionCount: updatedHistory.length,
          lastUpdated: new Date().toISOString(),
        }
        const { error: updateError } = await supabase
          .from('workflow_states')
          .update({
            current_step: WorkflowStep.VERIFICATION_IN_PROGRESS as Database['public']['Enums']['workflow_step'],
            verification_metadata: {
              ...currentVerificationMetadata,
              status: 'in_progress',
            },
            current_summary_id: newSummaryId,
            last_message_id: messageId,
            correction_history: updatedHistory,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
        if (updateError) {
          throw new Error(`Database error: ${updateError.message}`)
        }
        updateStep(WorkflowStep.VERIFICATION_IN_PROGRESS, {
          verificationMetadata: updatedVerificationMetadata,
          correctionHistory: updatedHistory,
          currentSummaryId: newSummaryId,
        })
        return {
          summaryId: newSummaryId,
          summary: result.summary,
          structuredData: result.structuredData,
          correctionCount: updatedHistory.length,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        updateStep(WorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
        })
        throw error
      }
    },
    [userId, chatId, workflowId, state, supabase, updateProgress, updateStep]
  )

  /**
   * Complete verification step, optionally with final summaryId.
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
        const { data: currentState, error: fetchError } = await supabase
          .from('workflow_states')
          .select('*')
          .eq('user_id', userId)
          .single()
        if (fetchError || !currentState) {
          throw new Error('No workflow state found for user')
        }
        const workflowState = currentState as any
        const currentVerificationMetadata = workflowState.verification_metadata || {}
        const updatedVerificationMetadata = {
          ...currentVerificationMetadata,
          verificationStatus: VerificationStatusType.COMPLETED,
          verifiedAt: new Date().toISOString(),
          verifiedBy: userId,
        }
        const { error: updateError } = await supabase
          .from('workflow_states')
          .update({
            current_step: WorkflowStep.VERIFICATION_COMPLETED as Database['public']['Enums']['workflow_step'],
            verification_metadata: {
              ...currentVerificationMetadata,
              status: 'completed',
            },
            current_summary_id: summaryIdToUse,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
        if (updateError) {
          throw new Error(`Database error: ${updateError.message}`)
        }
        updateStep(WorkflowStep.VERIFICATION_COMPLETED, {
          verificationMetadata: updatedVerificationMetadata,
        })
        return {
          success: true,
          summaryId: summaryIdToUse,
          correctionCount: (workflowState.correction_history || []).length,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        updateStep(WorkflowStep.ERROR, {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
        })
        throw error
      }
    },
    [userId, state, supabase, updateStep]
  )

  /**
   * Reset the verification-related state back to IDLE.
   */
  const resetVerification = useCallback(async () => {
    if (!userId) {
      throw new Error('User ID required for verification reset')
    }
    try {
      const { data: existingState, error: fetchError } = await supabase
        .from('workflow_states')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (fetchError) {
        throw new Error(`Error fetching existing data: ${fetchError.message}`)
      }
      const { error: updateError } = await supabase
        .from('workflow_states')
        .update({
          current_step: WorkflowStep.IDLE as Database['public']['Enums']['workflow_step'],
          verification_metadata: null,
          current_summary_id: null,
          correction_history: [],
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
      if (updateError) {
        throw new Error(`Database error: ${updateError.message}`)
      }
      setState({
        ...state,
        currentStep: WorkflowStep.IDLE,
        progress: 0,
        error: null,
        timestamp: new Date().toISOString(),
        metadata: {
          ...(state.metadata ?? {}),
          verificationMetadata: null,
          currentSummaryId: null,
          correctionHistory: []
        }
      })
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      // eslint-disable-next-line no-console
      console.error('Error resetting verification:', errorMessage)
      throw error
    }
  }, [userId, state, supabase])

  /**
   * Example function to begin a "report generation" step.
   */
  const beginReportGeneration = useCallback(
    async (generationType: string) => {
      try {
        updateStep(WorkflowStep.REPORT_GENERATION, {
          generationType,
          generationStartedAt: new Date().toISOString(),
        })
        return true
      } catch (error) {
        void errorHandler.handleError(
          error,
          WorkflowStep.REPORT_GENERATION,
          { previousStep: state.currentStep, details: { generationType }, showToast: true }
        )
        return false
      }
    },
    [updateStep, errorHandler, state.currentStep]
  )

  /**
   * Merged logic from use-processing-workflow.ts: processes a file, updating steps accordingly.
   * This shows a simplified example for "uploading", then marking "complete" or "error".
   */
  const processDocument = useCallback(async (file: File) => {
    try {
      // Start by setting step to UPLOADING
      updateStep(WorkflowStep.UPLOADING, { fileName: file.name, fileSize: file.size })
      updateProgress(0, ProcessingPhase.UPLOADING)

      // (Example logic) Check user
      const user = await supabase.auth.getUser()
      const authedUserId = user.data.user?.id
      if (!authedUserId) {
        throw new Error('User not authenticated')
      }

      // Create or update workflow state for demonstration
      // In a real scenario, we might store more data, do actual file uploads, etc.
      let currentWorkflowId = workflowId
      if (!currentWorkflowId) {
        currentWorkflowId = await createNewWorkflowState() // might set step or something
      }

      // Simulate some asynchronous processing, e.g. real upload
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // If everything is successful, mark step COMPLETE
      updateStep(WorkflowStep.COMPLETE, {
        storedFileName: file.name,
        completedAt: new Date().toISOString(),
      })
      updateProgress(100, ProcessingPhase.COMPLETION)

      return { success: true, uploadedFileName: file.name } as const
    } catch (err) {
      // On error, set step to ERROR with error message
      const e = normalizeError(err)
      updateStep(WorkflowStep.ERROR, {
        error: e.message,
        errorTimestamp: new Date().toISOString(),
      })
      return { success: false, error: e.message } as const
    }
  }, [
    updateStep,
    updateProgress,
    supabase,
    workflowId,
    createNewWorkflowState
  ])

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
    /**
     * This is the new merged function from use-processing-workflow.
     * It sets the step to UPLOADING, simulates an upload, then sets COMPLETE or ERROR.
     */
    processDocument,
    status,
  }
}