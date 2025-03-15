/**
 * @fileoverview Workflow Event Sourcing Service
 *
 * PHASE 3 IMPLEMENTATION:
 * Centralized event handling for all workflow domains.
 * 
 * Implements the event sourcing pattern for workflow state management.
 * Allows storing all workflow state changes as events and reconstructing
 * the state from the event history.
 *
 * This file has been updated to be the central point for all event-related
 * operations across all workflow domains, unifying the event handling approach.
 *
 * Features:
 * - Event storage and retrieval
 * - State reconstruction from events
 * - Event replay and analysis
 * - Audit trail generation
 * - Cross-domain event coordination
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
 * PHASE 3 IMPLEMENTATION: Centralized event types for all domains
 */
export enum WorkflowEventType {
  // Common workflow events
  WORKFLOW_CREATED = 'workflow_created',
  STEP_CHANGED = 'step_changed',
  METADATA_UPDATED = 'metadata_updated',
  PROGRESS_UPDATED = 'progress_updated',
  ERROR_OCCURRED = 'error_occurred',
  RECOVERY_ATTEMPTED = 'recovery_attempted',
  WORKFLOW_COMPLETED = 'workflow_completed',
  
  // Transaction tracking events
  TRANSACTION_STARTED = 'transaction_started',
  TRANSACTION_COMPLETED = 'transaction_completed',
  TRANSACTION_FAILED = 'transaction_failed',
  
  // Document domain events
  DOCUMENT_UPLOADED = 'document_uploaded',
  DOCUMENT_EXTRACTION_STARTED = 'document_extraction_started',
  DOCUMENT_EXTRACTION_COMPLETED = 'document_extraction_completed',
  DOCUMENT_PROCESSING_FAILED = 'document_processing_failed',
  
  // Verification domain events
  VERIFICATION_STARTED = 'verification_started',
  VERIFICATION_UPDATED = 'verification_updated',
  VERIFICATION_COMPLETED = 'verification_completed',
  VERIFICATION_FAILED = 'verification_failed',
  CORRECTION_SUBMITTED = 'correction_submitted',
  CORRECTION_APPLIED = 'correction_applied',
  
  // Report domain events
  REPORT_GENERATION_STARTED = 'report_generation_started',
  REPORT_GENERATED = 'report_generated',
  REPORT_FAILED = 'report_failed',
  
  // Research domain events
  RESEARCH_STARTED = 'research_started',
  RESEARCH_COMPLETED = 'research_completed',
  RESEARCH_FAILED = 'research_failed',
  
  // Chat domain events
  CHAT_MESSAGE_PROCESSED = 'chat_message_processed',
  CHAT_INTENT_DETECTED = 'chat_intent_detected',
  CHAT_RESPONSE_GENERATED = 'chat_response_generated',
  CHAT_ERROR = 'chat_error'
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
/**
 * Cross-domain event handler mapping
 * Maps event types to list of handlers from other domains
 */
type CrossDomainEventHandlers = Record<string, Array<(event: any) => Promise<void>>>;

export class WorkflowEventSourcingService {
  private readonly supabase: SupabaseClient<Database>;
  private readonly logger = logger.withMetadata({ module: 'WorkflowEventSourcing' });
  private crossDomainHandlers: CrossDomainEventHandlers = {};
  
  constructor() {
    this.supabase = createBrowserClient();
    this.initializeCrossDomainHandlers();
  }
  
  /**
   * PHASE 3 IMPLEMENTATION:
   * Initialize cross-domain event handlers
   * Centralized cross-domain event coordination
   */
  private initializeCrossDomainHandlers() {
    // Document → Verification domain coordination
    this.registerCrossDomainHandler(
      WorkflowEventType.DOCUMENT_EXTRACTION_COMPLETED,
      async (event) => {
        // When document extraction completes, notify verification domain
        if (event.workflowId && event.documentId && event.autoVerify) {
          await this.appendEvent(
            event.workflowId,
            WorkflowEventType.VERIFICATION_STARTED,
            {
              documentId: event.documentId,
              userId: event.userId || event.actorId,
              timestamp: new Date().toISOString(),
              source: 'document_domain',
              autoTriggered: true
            }
          );
          this.logger.info('Cross-domain event: Document extraction triggered verification', {
            workflowId: event.workflowId,
            documentId: event.documentId
          });
        }
      }
    );
    
    // Verification → Report domain coordination
    this.registerCrossDomainHandler(
      WorkflowEventType.VERIFICATION_COMPLETED,
      async (event) => {
        // When verification completes, notify report domain if auto-generate is enabled
        if (event.workflowId && event.documentId && event.autoGenerateReport) {
          await this.appendEvent(
            event.workflowId,
            WorkflowEventType.REPORT_GENERATION_STARTED,
            {
              documentId: event.documentId,
              verificationId: event.verificationId,
              userId: event.userId || event.actorId,
              timestamp: new Date().toISOString(),
              source: 'verification_domain',
              autoTriggered: true
            }
          );
          this.logger.info('Cross-domain event: Verification completion triggered report generation', {
            workflowId: event.workflowId,
            documentId: event.documentId,
            verificationId: event.verificationId
          });
        }
      }
    );
    
    // Research → Chat domain coordination
    this.registerCrossDomainHandler(
      WorkflowEventType.RESEARCH_COMPLETED,
      async (event) => {
        // When research completes, notify chat domain
        if (event.workflowId && event.chatId) {
          await this.appendEvent(
            event.workflowId,
            WorkflowEventType.CHAT_RESPONSE_GENERATED,
            {
              chatId: event.chatId,
              researchId: event.researchId,
              findings: event.findings,
              timestamp: new Date().toISOString(),
              source: 'research_domain'
            }
          );
          this.logger.info('Cross-domain event: Research completion triggered chat response', {
            workflowId: event.workflowId,
            chatId: event.chatId,
            researchId: event.researchId
          });
        }
      }
    );
    
    // Report → Chat domain coordination
    this.registerCrossDomainHandler(
      WorkflowEventType.REPORT_GENERATED,
      async (event) => {
        // When report is generated, notify chat domain if chat context exists
        if (event.workflowId && event.chatId) {
          await this.appendEvent(
            event.workflowId,
            WorkflowEventType.CHAT_RESPONSE_GENERATED,
            {
              chatId: event.chatId,
              reportId: event.reportId,
              summary: event.summary,
              timestamp: new Date().toISOString(),
              source: 'report_domain'
            }
          );
          this.logger.info('Cross-domain event: Report generation triggered chat response', {
            workflowId: event.workflowId,
            chatId: event.chatId,
            reportId: event.reportId
          });
        }
      }
    );
  }
  
  /**
   * Register a cross-domain event handler
   */
  registerCrossDomainHandler(
    eventType: WorkflowEventType | string,
    handler: (event: any) => Promise<void>
  ): void {
    if (!this.crossDomainHandlers[eventType]) {
      this.crossDomainHandlers[eventType] = [];
    }
    this.crossDomainHandlers[eventType].push(handler);
  }
  
  /**
   * Store a new event in the event log and trigger cross-domain handlers
   *
   * PHASE 3 IMPLEMENTATION: 
   * Enhanced with cross-domain event coordination
   *
   * @param workflowId Workflow ID
   * @param eventType Type of event
   * @param eventData Event data
   * @param actorId User who triggered the event (optional)
   * @param skipCrossDomainHandlers Whether to skip cross-domain handlers (internal use)
   * @returns Event ID if successful
   */
  async appendEvent(
    workflowId: string,
    eventType: string,
    eventData: Record<string, unknown>,
    actorId?: string,
    skipCrossDomainHandlers: boolean = false
  ): Promise<string | null> {
    try {
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      // Add timestamp if not present
      const enhancedEventData = {
        ...eventData,
        timestamp: eventData.timestamp || new Date().toISOString(),
        workflowId // Include workflowId in event data for cross-domain handlers
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
      
      const eventId = data?.event_id || null;
      
      // Process cross-domain handlers if enabled and handlers exist
      if (!skipCrossDomainHandlers && this.crossDomainHandlers[eventType]?.length > 0) {
        // Process handlers asynchronously but don't wait for them
        void this.processCrossDomainEvent(
          eventType, 
          { 
            ...enhancedEventData, 
            workflowId, 
            actorId, 
            eventId 
          }
        );
      }
      
      return eventId;
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
   * Process cross-domain event handlers
   * 
   * PHASE 3 IMPLEMENTATION:
   * Centralized cross-domain event coordination
   * 
   * @param eventType Type of event
   * @param eventData Event data
   */
  private async processCrossDomainEvent(
    eventType: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    const handlers = this.crossDomainHandlers[eventType] || [];
    
    if (handlers.length === 0) return;
    
    this.logger.debug('Processing cross-domain event handlers', {
      eventType,
      handlerCount: handlers.length
    });
    
    // Execute all handlers in parallel
    try {
      await Promise.all(
        handlers.map(async (handler) => {
          try {
            await handler(eventData);
          } catch (handlerError) {
            // Log handler error but don't fail the whole process
            this.logger.error('Cross-domain event handler failed', {
              eventType,
              workflowId: eventData.workflowId,
              error: handlerError instanceof Error ? handlerError.message : String(handlerError)
            });
          }
        })
      );
    } catch (error) {
      this.logger.error('Error processing cross-domain event handlers', {
        eventType,
        workflowId: eventData.workflowId,
        error: error instanceof Error ? error.message : String(error)
      });
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