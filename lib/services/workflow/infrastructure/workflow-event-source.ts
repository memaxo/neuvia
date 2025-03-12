/**
 * @fileoverview Workflow Event Sourcing Service
 *
 * Implements the event sourcing pattern for workflow state management.
 * Allows storing all workflow state changes as events and reconstructing
 * the state from the event history.
 *
 * Features:
 * - Event storage and retrieval
 * - State reconstruction from events
 * - Event replay and analysis
 * - Audit trail generation
 */

import { createBrowserClient } from '@/lib/supabase/clients'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { WorkflowStep, ProcessingPhase } from '@/lib/types/workflow'
import type { UUID, Timestamp } from '@/lib/types/base'
import { ApplicationError, normalizeError } from '@/lib/errors'
import logger from '@/lib/logger'

/**
 * Event types that can be stored in the event sourcing system
 */
export enum WorkflowEventType {
  WORKFLOW_CREATED = 'workflow_created',
  STEP_CHANGED = 'step_changed',
  METADATA_UPDATED = 'metadata_updated',
  PROGRESS_UPDATED = 'progress_updated',
  VERIFICATION_STARTED = 'verification_started',
  VERIFICATION_UPDATED = 'verification_updated',
  VERIFICATION_COMPLETED = 'verification_completed',
  REPORT_GENERATED = 'report_generated',
  TRANSACTION_STARTED = 'transaction_started',
  TRANSACTION_COMPLETED = 'transaction_completed',
  TRANSACTION_FAILED = 'transaction_failed',
  ERROR_OCCURRED = 'error_occurred',
  RECOVERY_ATTEMPTED = 'recovery_attempted',
  WORKFLOW_COMPLETED = 'workflow_completed'
}

/**
 * Base interface for all workflow events
 */
export interface WorkflowEvent {
  eventType: WorkflowEventType;
  timestamp: Timestamp;
  workflowId: UUID;
  actorId?: UUID;
  metadata?: Record<string, unknown>;
}

/**
 * Step change event for workflow transitions
 */
export interface StepChangedEvent extends WorkflowEvent {
  eventType: WorkflowEventType.STEP_CHANGED;
  fromStep: WorkflowStep;
  toStep: WorkflowStep;
  reason?: string;
}

/**
 * Progress update event for tracking workflow progress
 */
export interface ProgressUpdatedEvent extends WorkflowEvent {
  eventType: WorkflowEventType.PROGRESS_UPDATED;
  progress: number;
  phase: ProcessingPhase;
  step: WorkflowStep;
}

/**
 * Error event for tracking workflow errors
 */
export interface ErrorOccurredEvent extends WorkflowEvent {
  eventType: WorkflowEventType.ERROR_OCCURRED;
  error: string;
  errorType?: string;
  errorCode?: string;
  step: WorkflowStep;
  details?: Record<string, unknown>;
}

/**
 * Options for querying event history
 */
export interface EventQueryOptions {
  /** Maximum number of events to retrieve */
  limit?: number;
  
  /** Number of events to skip */
  offset?: number;
  
  /** Filter by event type */
  eventType?: WorkflowEventType | WorkflowEventType[];
  
  /** Include events after this timestamp */
  after?: Timestamp;
  
  /** Include events before this timestamp */
  before?: Timestamp;
  
  /** Sort order for events */
  order?: 'asc' | 'desc';
  
  /** Actor who triggered the events */
  actorId?: UUID;
}

/**
 * Service for implementing event sourcing pattern with workflows
 */
export class WorkflowEventSourcingService {
  private readonly supabase: SupabaseClient<Database>;
  private readonly logger = logger.withMetadata({ module: 'WorkflowEventSourcing' });
  
  constructor() {
    this.supabase = createBrowserClient();
  }
  
  /**
   * Store a new event in the event log
   *
   * @param workflowId Workflow ID
   * @param eventType Type of event
   * @param eventData Event data
   * @param actorId User who triggered the event (optional)
   * @returns Event ID if successful
   */
  async appendEvent(
    workflowId: string,
    eventType: string,
    eventData: Record<string, unknown>,
    actorId?: string
  ): Promise<string | null> {
    try {
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      // Add timestamp if not present
      const enhancedEventData = {
        ...eventData,
        timestamp: eventData.timestamp || new Date().toISOString()
      };
      
      // Use the database function for event logging
      const { data, error } = await this.supabase.rpc(
        'log_workflow_event',
        {
          p_workflow_id: workflowId,
          p_event_type: eventType,
          p_event_data: enhancedEventData,
          p_actor_id: actorId
        }
      );
      
      if (error) throw error;
      return data?.event_id || null;
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to append event', {
        workflowId,
        eventType,
        error: normalizedError.message
      });
      
      // Non-critical error, don't throw
      return null;
    }
  }
  
  /**
   * Reconstruct workflow state from event history
   *
   * @param workflowId Workflow ID
   * @returns Reconstructed workflow state
   */
  async reconstructState(workflowId: string): Promise<Record<string, unknown> | null> {
    try {
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      // Use database function for reconstruction
      const { data, error } = await this.supabase.rpc(
        'reconstruct_workflow_state',
        { p_workflow_id: workflowId }
      );
      
      if (error) throw error;
      return data || null;
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to reconstruct state', {
        workflowId,
        error: normalizedError.message
      });
      throw new ApplicationError({
        message: `Failed to reconstruct workflow state: ${normalizedError.message}`,
        code: 'STATE_RECONSTRUCTION_FAILED',
        data: {
          workflowId,
          originalError: normalizedError
        }
      });
    }
  }
  
  /**
   * Get workflow event history
   *
   * @param workflowId Workflow ID
   * @param options Query options
   * @returns Array of workflow events
   */
  async getEventHistory(
    workflowId: string,
    options: EventQueryOptions = {}
  ): Promise<any[]> {
    try {
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      // Build query
      let query = this.supabase
        .from('workflow_events')
        .select('*')
        .eq('workflow_id', workflowId);
      
      // Apply filters
      if (options.eventType) {
        if (Array.isArray(options.eventType)) {
          query = query.in('event_type', options.eventType);
        } else {
          query = query.eq('event_type', options.eventType);
        }
      }
      
      if (options.after) {
        query = query.gte('occurred_at', options.after);
      }
      
      if (options.before) {
        query = query.lte('occurred_at', options.before);
      }
      
      if (options.actorId) {
        query = query.eq('actor_id', options.actorId);
      }
      
      // Apply ordering
      query = query.order('occurred_at', {
        ascending: options.order === 'asc'
      });
      
      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      if (options.offset) {
        query = query.range(
          options.offset,
          options.offset + (options.limit || 10) - 1
        );
      }
      
      // Execute query
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to get event history', {
        workflowId,
        options,
        error: normalizedError.message
      });
      throw new ApplicationError({
        message: `Failed to get event history: ${normalizedError.message}`,
        code: 'EVENT_HISTORY_FAILED',
        data: {
          workflowId,
          options,
          originalError: normalizedError
        }
      });
    }
  }
  
  /**
   * Get workflow transitions history
   *
   * @param workflowId Workflow ID
   * @param options Query options
   * @returns Array of workflow transitions
   */
  async getTransitionHistory(
    workflowId: string,
    options: {
      limit?: number;
      offset?: number;
      order?: 'asc' | 'desc';
    } = {}
  ): Promise<any[]> {
    try {
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      // Build query
      let query = this.supabase
        .from('workflow_transitions')
        .select('*')
        .eq('workflow_id', workflowId);
      
      // Apply ordering
      query = query.order('transitioned_at', {
        ascending: options.order === 'asc'
      });
      
      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      if (options.offset) {
        query = query.range(
          options.offset,
          options.offset + (options.limit || 10) - 1
        );
      }
      
      // Execute query
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to get transition history', {
        workflowId,
        options,
        error: normalizedError.message
      });
      throw new ApplicationError({
        message: `Failed to get transition history: ${normalizedError.message}`,
        code: 'TRANSITION_HISTORY_FAILED',
        data: {
          workflowId,
          options,
          originalError: normalizedError
        }
      });
    }
  }
  
  /**
   * Generate workflow audit trail from events
   *
   * @param workflowId Workflow ID
   * @returns Formatted audit trail with key events
   */
  async generateAuditTrail(workflowId: string): Promise<any> {
    try {
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      // Get all events for the workflow
      const events = await this.getEventHistory(workflowId, {
        order: 'asc'
      });
      
      // Get transitions for the workflow
      const transitions = await this.getTransitionHistory(workflowId, {
        order: 'asc'
      });
      
      // Process events into an audit trail
      const auditTrail = {
        workflowId,
        created: null as string | null,
        completed: null as string | null,
        duration: null as number | null,
        steps: [] as any[],
        errors: [] as any[],
        verifications: [] as any[],
        reports: [] as any[]
      };
      
      // Find creation and completion times
      const creationEvent = events.find(e => e.event_type === WorkflowEventType.WORKFLOW_CREATED);
      const completionEvent = events.find(e => e.event_type === WorkflowEventType.WORKFLOW_COMPLETED);
      
      if (creationEvent) {
        auditTrail.created = creationEvent.occurred_at;
      }
      
      if (completionEvent) {
        auditTrail.completed = completionEvent.occurred_at;
      }
      
      if (auditTrail.created && auditTrail.completed) {
        const startTime = new Date(auditTrail.created).getTime();
        const endTime = new Date(auditTrail.completed).getTime();
        auditTrail.duration = endTime - startTime;
      }
      
      // Process step transitions
      auditTrail.steps = transitions.map(t => ({
        from: t.from_step,
        to: t.to_step,
        timestamp: t.transitioned_at,
        metadata: t.metadata
      }));
      
      // Process errors
      auditTrail.errors = events
        .filter(e => e.event_type === WorkflowEventType.ERROR_OCCURRED)
        .map(e => ({
          timestamp: e.occurred_at,
          error: e.event_data.error,
          step: e.event_data.step,
          details: e.event_data.details
        }));
      
      // Process verifications
      const verificationEvents = events.filter(e =>
        e.event_type === WorkflowEventType.VERIFICATION_STARTED ||
        e.event_type === WorkflowEventType.VERIFICATION_UPDATED ||
        e.event_type === WorkflowEventType.VERIFICATION_COMPLETED
      );
      
      // Group verification events by version/summary ID if available
      const verificationsByVersion = new Map();
      
      for (const event of verificationEvents) {
        const versionId = event.event_data.summaryId || event.event_data.currentVersionId || 'unknown';
        
        if (!verificationsByVersion.has(versionId)) {
          verificationsByVersion.set(versionId, []);
        }
        
        verificationsByVersion.get(versionId).push({
          type: event.event_type,
          timestamp: event.occurred_at,
          data: event.event_data
        });
      }
      
      // Convert map to array of verification histories
      auditTrail.verifications = Array.from(verificationsByVersion.entries())
        .map(([versionId, events]) => ({
          versionId,
          events: events.sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          )
        }));
      
      // Process reports
      auditTrail.reports = events
        .filter(e => e.event_type === WorkflowEventType.REPORT_GENERATED)
        .map(e => ({
          timestamp: e.occurred_at,
          reportId: e.event_data.reportId,
          metadata: e.event_data
        }));
      
      return auditTrail;
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to generate audit trail', {
        workflowId,
        error: normalizedError.message
      });
      throw new ApplicationError({
        message: `Failed to generate audit trail: ${normalizedError.message}`,
        code: 'AUDIT_TRAIL_FAILED',
        data: {
          workflowId,
          originalError: normalizedError
        }
      });
    }
  }
}

// Export singleton instance
export const workflowEventSourcing = new WorkflowEventSourcingService();