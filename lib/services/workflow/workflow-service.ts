import { createBrowserClient } from '@/lib/supabase/clients'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { WorkflowErrorHandler } from '@/lib/workflow/workflow-error-handler'
import {
  ALLOWED_TRANSITIONS,
  type WorkflowTransition,
  type WorkflowStep,
  DomainOnlyWorkflowStep
} from '@/lib/types/workflow'
import { WorkflowStateError } from '@/lib/errors/verification-errors'
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
 * Metadata interface for custom fields and state in the workflow.
 * This can include progress, errors, or specialized verification data.
 */
export interface WorkflowMetadata {
  progress?: number
  phase?: string
  error?: string | null
  errorDetails?: Record<string, unknown>
  verificationMetadata?: Record<string, unknown>
  [key: string]: unknown
}

// WorkflowStepEnum enum for use in the service
export enum WorkflowStepEnum {
  IDLE = 'idle',
  UPLOADING = 'uploading',
  EXTRACTING = 'extracting',
  VERIFICATION = 'verification',
  VERIFICATION_PENDING = 'verification_pending',
  VERIFICATION_IN_PROGRESS = 'verification_in_progress',
  VERIFICATION_COMPLETED = 'verification_completed',
  VERIFICATION_FAILED = 'verification_failed',
  REPORT_GENERATION = 'report_generation',
  COMPLETE = 'complete',
  CHAT_STARTED = 'chat_started',
  CHAT_IN_PROGRESS = 'chat_in_progress',
  CHAT_COMPLETED = 'chat_completed',
  CHAT_ERROR = 'chat_error',
  ERROR = 'error',
  RESEARCH = 'research',
  REPORT_PRESENTATION = 'report_presentation'
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

  if (transition.requireData === true && (metadata === undefined || metadata === null)) {
    return {
      isValid: false,
      error: `Transition from '${fromStep}' to '${toStep}' requires metadata`,
      transition,
      details: { reason: 'metadata_required' },
    }
  }

  if (transition.allowData !== true && metadata !== undefined && metadata !== null) {
    return {
      isValid: false,
      error: `Transition from '${fromStep}' to '${toStep}' does not allow metadata`,
      transition,
      details: { reason: 'metadata_not_allowed' },
    }
  }

  // If transition is to ERROR, ensure there's some error info in metadata if required
  if (toStep === 'error' && transition.requireData === true) {
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
 *
 * Database workflow_step enum:
 *   'idle',
 *   'uploading',
 *   'extracting',
 *   'verification',
 *   'report_generation',
 *   'complete',
 *   'chat_started',
 *   'chat_in_progress',
 *   'chat_completed',
 *   'chat_error',
 *   'verification_pending',
 *   'verification_in_progress',
 *   'verification_completed',
 *   'verification_failed'
 */
function mapWorkflowStepToDbStep(
  step: WorkflowStep
): Database['public']['Enums']['workflow_step'] {
  // If the step is already one of the DB enum values, use it directly
  if (typeof step === 'string') {
    // Check if it's a valid DB enum value
    const validDbSteps: Database['public']['Enums']['workflow_step'][] = [
      'idle', 'uploading', 'extracting', 'verification', 'verification_pending',
      'verification_in_progress', 'verification_completed', 'verification_failed',
      'report_generation', 'complete', 'chat_started', 'chat_in_progress',
      'chat_completed', 'chat_error'
    ];
    
    if (validDbSteps.includes(step as Database['public']['Enums']['workflow_step'])) {
      return step as Database['public']['Enums']['workflow_step'];
    }
    
    // Handle domain-only steps that aren't in the DB enum
    switch (step) {
      case 'error':
        return 'chat_error';
      case 'research':
        return 'chat_in_progress';
      case 'report_presentation':
        return 'report_generation';
      default:
        return 'idle';
    }
  }
  
  // Handle legacy enum values if needed
  switch (step) {
    case WorkflowStepEnum.IDLE:
      return 'idle'
    case WorkflowStepEnum.UPLOADING:
      return 'uploading'
    case WorkflowStepEnum.EXTRACTING:
      return 'extracting'

    // Verification states
    case WorkflowStepEnum.VERIFICATION:
      return 'verification'
    case WorkflowStepEnum.VERIFICATION_PENDING:
      return 'verification_pending'
    case WorkflowStepEnum.VERIFICATION_IN_PROGRESS:
      return 'verification_in_progress'
    case WorkflowStepEnum.VERIFICATION_COMPLETED:
      return 'verification_completed'
    case WorkflowStepEnum.VERIFICATION_FAILED:
      return 'verification_failed'

    // Report generation flow
    case WorkflowStepEnum.REPORT_GENERATION:
      return 'report_generation'
    // We'll map "report_presentation" to "report_generation"
    case WorkflowStepEnum.REPORT_PRESENTATION:
      return 'report_generation'

    // Chat states
    case WorkflowStepEnum.CHAT_STARTED:
      return 'chat_started'
    case WorkflowStepEnum.CHAT_IN_PROGRESS:
      return 'chat_in_progress'
    case WorkflowStepEnum.CHAT_COMPLETED:
      return 'chat_completed'

    // "research" maps to chat_in_progress
    case WorkflowStepEnum.RESEARCH:
      return 'chat_in_progress'

    case WorkflowStepEnum.ERROR:
      return 'chat_error'

    case WorkflowStepEnum.COMPLETE:
      return 'complete'

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

  constructor() {
    this.supabase = createBrowserClient()
    this.clientId = this.generateClientId()
    this.errorHandler = new WorkflowErrorHandler()
  }

  /**
   * Load workflow state DB record by userId + chatId.
   * If no row found, returns null.
   */
  async loadWorkflowStateForUser(userId: string, chatId?: string | null) {
    try {
      let query = this.supabase
        .from('workflow_states')
        .select('*')
        .eq('user_id', userId)

      if (chatId !== undefined && chatId !== null) {
        query = query.eq('chat_id', chatId)
      } else {
        query = query.is('chat_id', null)
      }

      const { data, error } = await query.maybeSingle()
      if (error) throw error
      return data || null
    } catch (err) {
      const e = normalizeError(err)
      throw e
    }
  }

  /**
   * Tries to load an existing workflow_states row by user+chat. If none found, creates one.
   */
  async getOrCreateWorkflowForUser(
    userId: string,
    chatId: string | null,
    initialStep: WorkflowStep = 'idle',
    initialMetadata: Record<string, unknown> = {}
  ): Promise<{ id: string; data: Record<string, unknown> }> {
    // Try to load existing
    const existing = await this.loadWorkflowStateForUser(userId, chatId)
    if (existing !== null) {
      return { id: existing.id, data: existing }
    }
    // Otherwise create
    const dbStep = mapWorkflowStepToDbStep(initialStep)
    const now = new Date().toISOString()
    const { data, error } = await this.supabase
      .from('workflow_states')
      .insert({
        user_id: userId,
        current_step: dbStep,
        chat_id: chatId,
        metadata: {
          ...initialMetadata,
          appStep: initialStep !== 'idle' ? initialStep : undefined,
          createdAt: now,
          updatedAt: now,
        },
      })
      .select()
      .single()

    if (error) throw error
    return { id: data.id, data }
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
    // Keep original method for workflowId usage
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
        if (onStatusChange !== undefined && onStatusChange !== null) {
          void onStatusChange(status)
        }
      })
    return channel
  }

  /**
   * Subscribe to workflow_states changes by userId, plus optional chatId
   */
  subscribeToWorkflowForUser(
    userId: string,
    chatId: string | null,
    onUpdate: (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => void,
    onStatusChange?: (status: string) => void
  ): RealtimeChannel {
    const channelName = `workflow-${userId}-${chatId !== null ? chatId : 'null'}`
    const channel = this.supabase.channel(channelName)

    // Build filter
    let filter = `user_id=eq.${userId}`
    if (chatId) {
      filter += ` AND chat_id=eq.${chatId}`
    } else {
      filter += ' AND chat_id IS NULL'
    }

    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workflow_states',
          filter,
        },
        onUpdate
      )
      .subscribe((status) => {
        if (onStatusChange !== undefined && onStatusChange !== null) {
          void onStatusChange(status)
        }
      })

    return channel
  }

  unsubscribeFromChannel(channel: RealtimeChannel): void {
    void this.supabase.removeChannel(channel)
  }

  /**
   * Create a new workflow state in DB
   */
  async createWorkflowState(
    userId: string,
    initialStep: WorkflowStep = 'idle',
    metadata: Record<string, unknown> = {}
  ): Promise<string | null> {
    try {
      if (userId === undefined || userId === null || userId === '') throw new Error('User ID is required')
      const dbStep = mapWorkflowStepToDbStep(initialStep)
      const now = new Date().toISOString()

      const { data, error } = await this.supabase
        .from('workflow_states')
        .insert({
          user_id: userId,
          current_step: dbStep,
          metadata: {
            ...metadata,
            appStep: initialStep !== 'idle' ? initialStep : undefined,
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
      await this.errorHandler.handleError(e, 'idle', {
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
    _options: { bypassCache?: boolean } = {}
  ): Promise<{
    currentStep: WorkflowStep
    progress: number
    error?: string | null
    phase?: string
    metadata?: WorkflowMetadata
    timestamp: string
  } | null> {
    try {
      if (workflowId === undefined || workflowId === null || workflowId === '') return null

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
      const meta = data.metadata as WorkflowMetadata | null
      const progressVal = typeof meta?.progress === 'number' ? meta.progress : 0
      const phaseVal = typeof meta?.phase === 'string' ? meta.phase : undefined
      const errorVal = typeof meta?.error === 'string' ? meta.error : null
      const updatedAt =
        typeof data.updated_at === 'string' ? data.updated_at : new Date().toISOString()

      const stateObj = workflowStateFromDb({
        id: data.id,
        step: data.current_step,
        progress: progressVal,
        phase: phaseVal,
        error: errorVal,
        metadata: meta ?? {},
        timestamp: updatedAt,
      } as DbWorkflowState)

      return {
        currentStep: stateObj.currentStep,
        progress: progressVal,
        error: errorVal,
        phase: phaseVal,
        metadata: meta ?? {},
        timestamp: updatedAt,
      }
    } catch (err) {
      const e = normalizeError(err)
      await this.errorHandler.handleError(e, 'idle', {
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
      if (workflowId === undefined || workflowId === null || workflowId === '') throw new Error('workflowId is required')

      const { skipValidation = false, forceUpdate = false } = options ?? {}

      // Optionally fetch current state for validation
      let oldState: { currentStep: WorkflowStep } | null = null
      if (!skipValidation && !forceUpdate) {
        oldState = await this.getWorkflowState(workflowId, { bypassCache: false })
      }

      if (oldState !== null && skipValidation !== true && forceUpdate !== true) {
        // Validate transition
        const check = validateWorkflowTransition(oldState.currentStep, step, metadata)
        if (!check.isValid) {
          throw new WorkflowStateError({
            message: check.error ?? 'Invalid transition',
            data: {
              transition: { from: oldState.currentStep, to: step },
              details: check.details
            }
          })
        }
      }

      const dbStep = mapWorkflowStepToDbStep(step)
      const now = new Date().toISOString()
      const enrichedMetadata = {
        ...metadata,
        _transactionId: txId,
        updatedAt: now,
        _clientId: this.clientId,
        appStep: step !== 'idle' ? step : undefined,
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
      if (workflowId === undefined || workflowId === null || workflowId === '') return
      const meta = {
        error: errorMessage,
        errorDetails,
        errorAt: new Date().toISOString(),
      }
      // Validate transition from whatever state is to error
      await this.updateWorkflowState(workflowId, DomainOnlyWorkflowStep.ERROR, meta)
    } catch (err) {
      const e = normalizeError(err)
      await this.errorHandler.handleError(e, DomainOnlyWorkflowStep.ERROR, {
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
      if (workflowId === undefined || workflowId === null || workflowId === '') return
      await this.updateWorkflowState(workflowId, 'complete', {
        ...completionMetadata,
        completedAt: new Date().toISOString(),
      })
    } catch (err) {
      const e = normalizeError(err)
      await this.errorHandler.handleError(e, 'complete', {
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