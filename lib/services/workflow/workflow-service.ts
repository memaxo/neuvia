import { createBrowserClient } from '@/lib/supabase/clients'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { WorkflowErrorHandler } from '@/lib/workflow/workflow-error-handler'
import {
  ALLOWED_TRANSITIONS,
  WorkflowStep,
  type WorkflowTransition,
} from '@/lib/types/workflow'
import { workflowStateFromDb, type DbWorkflowState } from '@/lib/types/db-adapters'
import { normalizeError } from '@/lib/errors'

/**
 * Transaction status type for workflow state updates
 */
export type TransactionStatus =
  | 'pending'
  | 'committed'
  | 'failed'
  | 'conflict'
  | 'not_found'

/**
 * Conflict resolution strategy for handling concurrent updates
 */
export type ConflictStrategy = 'client-wins' | 'server-wins' | 'merge' | 'manual'

/**
 * Transaction record for potential optimistic updates
 */
export interface TransactionRecord {
  id: string
  workflowId: string
  timestamp: string
  status: TransactionStatus
  conflictStrategy: ConflictStrategy
  clientId: string
  fromStep?: WorkflowStep
  toStep?: WorkflowStep
  metadata?: Record<string, unknown>
}

/**
 * WorkflowStateError class for invalid transitions
 */
export class WorkflowStateError extends Error {
  public transition: { from: WorkflowStep; to: WorkflowStep }
  public metadata?: Record<string, unknown>
  public readonly code: string

  constructor(
    message: string,
    transition: { from: WorkflowStep; to: WorkflowStep },
    metadata?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'WorkflowStateError'
    this.transition = transition
    this.metadata = metadata
    this.code = 'INVALID_WORKFLOW_TRANSITION'
  }
}

/**
 * Validate if a transition is allowed according to the state machine rules
 */
export function validateWorkflowTransition(
  fromStep: WorkflowStep,
  toStep: WorkflowStep,
  metadata?: Record<string, unknown>
): {
  isValid: boolean
  error?: string
  transition?: WorkflowTransition
  details?: Record<string, unknown>
} {
  // Special case: if we're going from the same step to the same step, allow metadata-only updates
  if (fromStep === toStep) {
    return {
      isValid: true,
      details: { sameState: true },
    }
  }

  // Attempt to find a matching transition
  const transition = ALLOWED_TRANSITIONS.find(
    (t) => t.from === fromStep && t.to === toStep
  )
  if (!transition) {
    return {
      isValid: false,
      error: `Invalid transition from '${fromStep}' to '${toStep}'`,
      details: { reason: 'transition_not_allowed' },
    }
  }

  if (transition.requireData && !metadata) {
    return {
      isValid: false,
      error: `Transition from '${fromStep}' to '${toStep}' requires metadata`,
      transition,
      details: { reason: 'metadata_required' },
    }
  }

  if (!transition.allowData && metadata) {
    return {
      isValid: false,
      error: `Transition from '${fromStep}' to '${toStep}' does not allow metadata`,
      transition,
      details: { reason: 'metadata_not_allowed' },
    }
  }

  // If transition is to ERROR, ensure there's some error info in metadata if it's required
  if (toStep === WorkflowStep.ERROR && transition.requireData) {
    const maybeHasError = metadata?.error
    if (typeof maybeHasError !== 'string') {
      return {
        isValid: false,
        error: 'Error transitions require an error message in metadata',
        transition,
        details: { reason: 'missing_error_info' },
      }
    }
  }

  return { isValid: true, transition, details: {} }
}

/**
 * Convert workflow step from our canonical enum to the DB enum
 */
function mapWorkflowStepToDbStep(
  step: WorkflowStep
): Database['public']['Enums']['workflow_step'] {
  switch (step) {
    case WorkflowStep.ERROR:
      return 'chat_error'
    case WorkflowStep.CHAT_COMPLETED:
      return 'chat_completed'
    case WorkflowStep.CHAT_IN_PROGRESS:
      return 'chat_in_progress'
    case WorkflowStep.CHAT_STARTED:
      return 'chat_started'
    case WorkflowStep.UPLOADING:
      return 'uploading'
    case WorkflowStep.EXTRACTING:
      return 'extracting'
    case WorkflowStep.VERIFICATION:
      return 'verification'
    case WorkflowStep.VERIFICATION_PENDING:
      return 'verification_pending'
    case WorkflowStep.VERIFICATION_IN_PROGRESS:
      return 'verification_in_progress'
    case WorkflowStep.VERIFICATION_COMPLETED:
      return 'verification_completed'
    case WorkflowStep.VERIFICATION_FAILED:
      return 'verification_failed'
    case WorkflowStep.REPORT_GENERATION:
      return 'report_generation'
    case WorkflowStep.REPORT_PRESENTATION:
      // We store as 'report_generation' or keep an 'appStep' in metadata
      return 'report_generation'
    case WorkflowStep.RESEARCH:
      // Also store as 'chat_in_progress' or use metadata
      return 'chat_in_progress'
    case WorkflowStep.COMPLETE:
      return 'complete'
    case WorkflowStep.IDLE:
    default:
      return 'idle'
  }
}

/**
 * Single source-of-truth WorkflowService
 *
 * Provides real-time subscriptions, conflict checks, etc.
 */
export class WorkflowService {
  private readonly supabase: SupabaseClient<Database>
  private readonly clientId: string
  private readonly errorHandler: WorkflowErrorHandler

  // We keep these to illustrate future expansions (optimistic updates, caching), but not used now
  // private readonly pendingTransactions: Map<string, TransactionRecord> = new Map()
  // private readonly stateCache: Map<string, WorkflowState> = new Map()

  constructor() {
    this.supabase = createBrowserClient()
    this.clientId = this.generateClientId()
    this.errorHandler = new WorkflowErrorHandler()
  }

  private generateClientId(): string {
    if (typeof localStorage !== 'undefined') {
      const storedId = localStorage.getItem('neuvia_client_id')
      if (storedId) return storedId
      const newId = crypto.randomUUID()
      localStorage.setItem('neuvia_client_id', newId)
      return newId
    }
    // fallback if localStorage not available
    return `client-${Date.now()}`
  }

  getClientId(): string {
    return this.clientId
  }

  /**
   * Subscribe to workflow changes
   */
  subscribeToWorkflowChanges(
    workflowId: string,
    onUpdate: (payload: {
      new: { current_step: string; metadata: unknown }
      old: unknown
    }) => void,
    onStatusChange?: (status: string) => void
  ): RealtimeChannel {
    const channel = this.supabase
      .channel(`workflow-${workflowId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workflow_states',
          filter: `id=eq.${workflowId}`,
        },
        onUpdate
      )
      .subscribe((status) => {
        if (onStatusChange) {
          onStatusChange(status)
        }
      })
    return channel
  }

  unsubscribeFromChannel(channel: RealtimeChannel): void {
    this.supabase.removeChannel(channel)
  }

  /**
   * Create a new workflow state in DB
   */
  async createWorkflowState(
    userId: string,
    initialStep: WorkflowStep = WorkflowStep.IDLE,
    metadata: Record<string, unknown> = {}
  ): Promise<string | null> {
    try {
      if (!userId) throw new Error('User ID is required')
      const dbStep = mapWorkflowStepToDbStep(initialStep)
      const now = new Date().toISOString()

      const { data, error } = await this.supabase
        .from('workflow_states')
        .insert({
          user_id: userId,
          current_step: dbStep,
          metadata: {
            ...metadata,
            appStep: initialStep !== WorkflowStep.IDLE ? initialStep : undefined,
            createdAt: now,
            updatedAt: now,
          },
        })
        .select('id')
        .single()

      if (error) {
        throw new Error(error.message)
      }
      if (!data) {
        throw new Error('Failed to create workflow state')
      }
      return data.id
    } catch (err) {
      const e = normalizeError(err)
      await this.errorHandler.handleError(e, WorkflowStep.IDLE, {
        details: { userId, initialStep, metadata },
        showToast: true,
      })
      return null
    }
  }

  /**
   * Get the current workflow state from DB
   */
  async getWorkflowState(
    workflowId: string,
    options: { bypassCache?: boolean } = {}
  ): Promise<{
    currentStep: WorkflowStep
    progress: number
    error?: string | null
    phase?: string
    metadata?: Record<string, unknown>
    timestamp: string
  } | null> {
    try {
      if (!workflowId) return null

      // ignoring bypassCache for now - direct fetch
      const { data, error } = await this.supabase
        .from('workflow_states')
        .select('*')
        .eq('id', workflowId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // no row returned
          return null
        }
        throw error
      }
      if (!data) return null

      // We do a safe parse of metadata
      const meta = data.metadata as Record<string, unknown> | null
      const progressVal =
        typeof meta?.progress === 'number' ? (meta.progress as number) : 0
      const phaseVal =
        typeof meta?.phase === 'string' ? (meta.phase as string) : undefined
      const errorVal =
        typeof meta?.error === 'string' ? (meta.error as string) : null
      const updatedAt =
        typeof data.updated_at === 'string' ? data.updated_at : new Date().toISOString()

      return {
        currentStep: workflowStateFromDb({
          id: data.id,
          step: data.current_step,
          progress: progressVal,
          phase: phaseVal,
          error: errorVal,
          metadata: meta ?? {},
          timestamp: updatedAt,
        } as DbWorkflowState).currentStep,
        progress: progressVal,
        error: errorVal,
        phase: phaseVal,
        metadata: meta ?? {},
        timestamp: updatedAt,
      }
    } catch (err) {
      const e = normalizeError(err)
      await this.errorHandler.handleError(e, WorkflowStep.IDLE, {
        details: { workflowId },
        showToast: true,
      })
      return null
    }
  }

  /**
   * Update workflow state in DB
   */
  async updateWorkflowState(
    workflowId: string,
    step: WorkflowStep,
    metadata: Record<string, unknown> = {},
    options?: {
      skipValidation?: boolean
      forceUpdate?: boolean
    }
  ): Promise<string> {
    const txId = this.generateTransactionId()
    try {
      if (!workflowId) throw new Error('workflowId is required')

      const { skipValidation = false, forceUpdate = false } = options ?? {}

      // Optionally fetch current state for validation
      let oldState: { currentStep: WorkflowStep } | null = null
      if (!skipValidation && !forceUpdate) {
        oldState = await this.getWorkflowState(workflowId, { bypassCache: false })
      }

      if (oldState && !skipValidation && !forceUpdate) {
        // Validate transition
        const check = validateWorkflowTransition(oldState.currentStep, step, metadata)
        if (!check.isValid) {
          throw new WorkflowStateError(
            check.error || 'Invalid transition',
            { from: oldState.currentStep, to: step },
            { details: check.details }
          )
        }
      }

      const dbStep = mapWorkflowStepToDbStep(step)
      const now = new Date().toISOString()
      const enrichedMetadata = {
        ...metadata,
        _transactionId: txId,
        updatedAt: now,
        _clientId: this.clientId,
        appStep: step !== WorkflowStep.IDLE ? step : undefined,
      }

      const { data, error } = await this.supabase
        .from('workflow_states')
        .update({
          current_step: dbStep,
          metadata: enrichedMetadata,
          updated_at: now,
        })
        .eq('id', workflowId)
        .select()
        .single()

      if (error) {
        throw error
      }
      if (!data) {
        throw new Error('No data returned from update')
      }

      return txId
    } catch (err) {
      const e = normalizeError(err)
      await this.errorHandler.handleError(e, step, {
        details: { workflowId, step, metadata, txId },
        showToast: true,
      })
      return txId
    }
  }

  /**
   * Sets workflow to error step with given message
   */
  async setWorkflowError(
    workflowId: string,
    errorMessage: string,
    errorDetails: Record<string, unknown> = {}
  ): Promise<void> {
    const txId = this.generateTransactionId()
    try {
      if (!workflowId) return
      const metadata = {
        error: errorMessage,
        errorDetails,
        errorAt: new Date().toISOString(),
      }
      // Validate transition from whatever state is to WorkflowStep.ERROR
      await this.updateWorkflowState(workflowId, WorkflowStep.ERROR, metadata)
    } catch (err) {
      const e = normalizeError(err)
      await this.errorHandler.handleError(e, WorkflowStep.ERROR, {
        details: { workflowId, errorMessage, errorDetails, txId },
        showToast: true,
      })
    }
  }

  /**
   * Mark a workflow as complete
   */
  async completeWorkflow(
    workflowId: string,
    completionMetadata: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      if (!workflowId) return
      await this.updateWorkflowState(workflowId, WorkflowStep.COMPLETE, {
        ...completionMetadata,
        completedAt: new Date().toISOString(),
      })
    } catch (err) {
      const e = normalizeError(err)
      await this.errorHandler.handleError(e, WorkflowStep.COMPLETE, {
        details: { workflowId, completionMetadata },
        showToast: true,
      })
    }
  }

  private generateTransactionId(): string {
    return `tx-${this.clientId.substring(0, 8)}-${Date.now()}-${Math.floor(Math.random() * 10000)}`
  }
}

export const workflowService = new WorkflowService()