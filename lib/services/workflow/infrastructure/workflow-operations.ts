/**
 * @fileoverview Workflow Operations Service
 * 
 * Central service for common workflow operations including:
 * - Metadata management with namespacing
 * - State transitions
 * - Progress updates
 * - Event logging
 * 
 * This service consolidates redundant code between BaseWorkflowProcessor 
 * and WorkflowService, providing a single source of truth for common
 * workflow operations. It serves as the implementation layer that both
 * the processor and service can use.
 */

import { normalizeError, ApplicationError } from '@/lib/errors';
import { workflowRepository } from './workflow-repository';
import { workflowStateManager } from './workflow-state-manager';
import { workflowEventSourcing } from './workflow-event-source';
import { 
  getDomainConcurrencyConfig, 
  getFieldConcurrencyConfig,
  shouldStoreFieldSeparately,
  getFieldStorageTable
} from '../domain/domain-concurrency-config';
import {
  NamespacedMetadata,
  updateDomainMetadata,
  getDomainMetadata as getMetadataForDomain,
  migrateToNamespacedMetadata
} from '../domain/domain-metadata-config';
import { Result } from '../error/result';
import logger from '@/lib/logger';

import type { WorkflowStep, ProcessingPhase, WorkflowState } from '@/lib/types/workflow';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

/**
 * Options for metadata updates
 */
export interface MetadataUpdateOptions {
  /** Strategy for handling conflicts */
  conflictStrategy?: 'pessimistic' | 'optimistic' | 'merge' | 'field-specific';
  
  /** Expected timestamp for optimistic concurrency control */
  expectedTimestamp?: string;
  
  /** Skip validation of transitions */
  skipValidation?: boolean;
  
  /** Force update even if validation fails */
  forceUpdate?: boolean;
  
  /** Transaction ID for tracking */
  transactionId?: string;
  
  /** Domain name for domain-specific handling */
  domain?: string;
}

/**
 * Options for step transitions
 */
export interface StepTransitionOptions {
  /** Metadata to include with the transition */
  metadata?: Record<string, unknown>;
  
  /** Transaction ID for tracking */
  transactionId?: string;
  
  /** Actor ID for event logging */
  actorId?: string;
  
  /** Skip validation of transitions */
  skipValidation?: boolean;
  
  /** Force update even if validation fails */
  forceUpdate?: boolean;
  
  /** Strategy for handling conflicts */
  conflictStrategy?: 'pessimistic' | 'optimistic' | 'merge' | 'field-specific';
  
  /** Expected timestamp for optimistic concurrency control */
  expectedTimestamp?: string;
  
  /** Whether to log the transition as an event */
  logEvent?: boolean;
  
  /** Domain name for domain-specific handling */
  domain?: string;
}

/**
 * Options for progress updates
 */
export interface ProgressUpdateOptions {
  /** Current step in the workflow */
  currentStep?: WorkflowStep;
  
  /** Whether to notify users of progress updates */
  notifyUsers?: boolean;
  
  /** Transaction ID for tracking */
  transactionId?: string;
  
  /** Domain name for domain-specific handling */
  domain?: string;
}

/**
 * Options for event logging
 */
export interface EventOptions {
  /** Actor ID for event attribution */
  actorId?: string;
  
  /** Domain name for domain-specific context */
  domain?: string;
  
  /** Transaction ID for tracking related events */
  transactionId?: string;
}

/**
 * Service for centralized workflow operations
 * Provides a single source of truth for common functionality
 */
export class WorkflowOperationsService {
  private readonly logger = logger.withMetadata({ module: 'WorkflowOperations' });
  
  /**
   * Log a workflow event
   */
  async logEvent(
    workflowId: string,
    eventType: string,
    eventData: Record<string, unknown> = {},
    options: EventOptions = {}
  ): Promise<Result<string | null>> {
    try {
      if (!workflowId) {
        return Result.failure('Workflow ID is required', 'INVALID_WORKFLOW_ID');
      }
      
      const enhancedEventData = {
        ...eventData,
        timestamp: eventData.timestamp || new Date().toISOString(),
        domain: options.domain,
        transactionId: options.transactionId || eventData.transactionId
      };
      
      const eventId = await workflowEventSourcing.appendEvent(
        workflowId,
        eventType,
        enhancedEventData,
        options.actorId
      );
      
      return Result.success(eventId);
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error(`Failed to log ${eventType} event`, {
        workflowId,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to log event: ${normalizedError.message}`,
        normalizedError.code || 'EVENT_LOGGING_ERROR',
        { 
          workflowId, 
          eventType,
          domain: options.domain
        }
      );
    }
  }
  
  /**
   * Transition workflow state with validation
   * Uses domain-specific strategies for conflict resolution
   */
  async transitionState(
    workflowId: string,
    fromStep: WorkflowStep,
    toStep: WorkflowStep,
    options: StepTransitionOptions = {}
  ): Promise<Result<WorkflowState>> {
    // Extract options with defaults
    const {
      metadata = {},
      transactionId = crypto.randomUUID(),
      actorId,
      skipValidation = false,
      forceUpdate = false,
      logEvent = true,
      domain
    } = options;
    
    // Get domain-specific configuration if domain is provided
    let conflictStrategy = options.conflictStrategy;
    if (domain && !conflictStrategy) {
      const domainConfig = getDomainConcurrencyConfig(domain);
      conflictStrategy = domainConfig.defaultStrategy;
    } else if (!conflictStrategy) {
      conflictStrategy = 'pessimistic'; // Default strategy for transitions
    }
    
    this.logger.debug('Using conflict strategy for state transition', {
      domain,
      conflictStrategy,
      fromStep,
      toStep
    });
    
    // Add standard fields to metadata
    const transitionMetadata = {
      ...metadata,
      transactionId,
      transitionTimestamp: new Date().toISOString(),
      fromStep,
      toStep,
      domain // Include domain for context
    };
    
    // Log transition event if requested
    if (logEvent) {
      const eventResult = await this.logEvent(
        workflowId,
        'step_changed',
        {
          fromStep,
          toStep,
          reason: metadata.reason,
          timestamp: transitionMetadata.transitionTimestamp,
          transactionId
        },
        { 
          actorId, 
          domain 
        }
      );
      
      if (eventResult.isFailure()) {
        // Log warning but continue with state transition
        this.logger.warn('Failed to log step transition event', {
          workflowId,
          fromStep,
          toStep,
          error: eventResult.error.message
        });
      }
    }
    
    // Map from domain strategy to repository strategy
    let repoStrategy: 'fail' | 'force' | 'merge';
    if (conflictStrategy === 'field-specific' || conflictStrategy === 'append') {
      repoStrategy = 'merge'; // Both field-specific and append use merge
    } else if (conflictStrategy === 'pessimistic' || conflictStrategy === 'optimistic') {
      repoStrategy = 'fail'; // Pessimistic and optimistic use fail with timestamp
    } else {
      repoStrategy = conflictStrategy as any;
    }
    
    // Perform the transition using workflowStateManager
    try {
      const state = await workflowStateManager.transitionState(
        workflowId,
        fromStep,
        toStep,
        transitionMetadata,
        {
          skipValidation,
          forceUpdate,
          conflictStrategy: repoStrategy,
          expectedTimestamp: options.expectedTimestamp,
          logEvent: false, // We already logged the event above
          domain, // Pass domain for validation/handling
          transactionId
        }
      );
      
      return Result.success(state);
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Failed to transition state', {
        workflowId,
        fromStep,
        toStep,
        domain,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to transition from ${fromStep} to ${toStep}: ${normalizedError.message}`,
        normalizedError.code || 'WORKFLOW_TRANSITION_ERROR',
        {
          workflowId,
          fromStep,
          toStep,
          domain,
          ...normalizedError.data
        }
      );
    }
  }
  
  /**
   * Update workflow progress
   */
  async updateProgress(
    workflowId: string,
    progress: number,
    phase: ProcessingPhase,
    options: ProgressUpdateOptions = {}
  ): Promise<Result<boolean>> {
    try {
      if (!workflowId) {
        return Result.failure('Workflow ID is required', 'INVALID_WORKFLOW_ID');
      }
      
      const {
        currentStep,
        notifyUsers = true,
        transactionId = crypto.randomUUID(),
        domain
      } = options;
      
      // Update progress through state manager
      await workflowStateManager.updateProgress(
        workflowId,
        progress,
        phase,
        { 
          currentStep,
          notifyUsers,
          transactionId
        }
      );
      
      // Log progress event
      await this.logEvent(
        workflowId,
        'progress_updated',
        {
          progress,
          phase: phase.toString(),
          step: currentStep,
          timestamp: new Date().toISOString(),
          transactionId
        },
        { domain }
      );
      
      return Result.success(true);
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Failed to update progress', {
        workflowId,
        progress,
        phase: phase.toString(),
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to update progress: ${normalizedError.message}`,
        normalizedError.code || 'WORKFLOW_PROGRESS_UPDATE_ERROR',
        {
          workflowId,
          progress,
          phase: phase.toString(),
          domain: options.domain
        }
      );
    }
  }
  
  /**
   * Get domain-specific metadata from workflow state
   */
  async getDomainMetadata<T>(
    workflowId: string,
    domain: string,
    key: string,
    defaultValue?: T
  ): Promise<Result<T | undefined>> {
    try {
      if (!workflowId) {
        return Result.failure('Workflow ID is required', 'INVALID_WORKFLOW_ID');
      }
      
      if (!domain) {
        return Result.failure('Domain name is required', 'INVALID_DOMAIN_NAME');
      }
      
      // Get workflow state
      const stateResult = await Result.fromPromise(
        workflowRepository.getWorkflowState(workflowId)
      );
      
      if (stateResult.isFailure()) {
        return Result.failure(
          `Failed to retrieve workflow state: ${stateResult.error.message}`,
          stateResult.error.code,
          { 
            workflowId, 
            domain, 
            key,
            ...stateResult.error.details
          }
        );
      }
      
      const state = stateResult.value;
      if (!state || !state.metadata) {
        return Result.success(defaultValue);
      }
      
      const metadata = state.metadata;
      const namespace = domain.toLowerCase();
      
      // Check if metadata is already namespaced
      if (
        metadata[namespace] && 
        typeof metadata[namespace] === 'object'
      ) {
        // First check if the key exists directly in the domain namespace
        const domainMetadata = metadata[namespace] as Record<string, unknown>;
        if (key in domainMetadata) {
          return Result.success(domainMetadata[key] as T);
        }
        
        // Then check if it exists in the data sub-object
        if (domainMetadata.data && typeof domainMetadata.data === 'object') {
          const dataObj = domainMetadata.data as Record<string, unknown>;
          if (key in dataObj) {
            return Result.success(dataObj[key] as T);
          }
        }
      }
      
      // Fallback to legacy flat structure
      if (key in metadata) {
        return Result.success(metadata[key] as T);
      }
      
      // Try to find in workflow namespace
      if (
        metadata.workflow && 
        typeof metadata.workflow === 'object' &&
        key in (metadata.workflow as Record<string, unknown>)
      ) {
        return Result.success((metadata.workflow as Record<string, unknown>)[key] as T);
      }
      
      return Result.success(defaultValue);
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error(`Failed to get domain metadata`, {
        workflowId,
        domain,
        key,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to parse domain metadata: ${normalizedError.message}`,
        normalizedError.code || 'METADATA_PARSE_ERROR',
        {
          workflowId,
          domain,
          key,
          error: normalizedError.message
        }
      );
    }
  }
  
  /**
   * Get all metadata for a specific domain
   */
  async getAllDomainMetadata<T extends Record<string, unknown>>(
    workflowId: string,
    domain: string
  ): Promise<Result<T | undefined>> {
    try {
      if (!workflowId) {
        return Result.failure('Workflow ID is required', 'INVALID_WORKFLOW_ID');
      }
      
      if (!domain) {
        return Result.failure('Domain name is required', 'INVALID_DOMAIN_NAME');
      }
      
      // Get workflow state
      const stateResult = await Result.fromPromise(
        workflowRepository.getWorkflowState(workflowId)
      );
      
      if (stateResult.isFailure()) {
        return Result.failure(
          `Failed to retrieve workflow state: ${stateResult.error.message}`,
          stateResult.error.code,
          { 
            workflowId, 
            domain,
            ...stateResult.error.details
          }
        );
      }
      
      const state = stateResult.value;
      if (!state || !state.metadata) {
        return Result.success(undefined);
      }
      
      // Get domain-specific metadata using the imported helper
      const domainMetadata = getMetadataForDomain(state.metadata, domain as any);
      if (!domainMetadata) {
        // If no domain-specific metadata exists, try to migrate it
        const migrated = migrateToNamespacedMetadata(state.metadata, domain);
        return Result.success((migrated[domain.toLowerCase()] as T) || undefined);
      }
      
      return Result.success(domainMetadata as unknown as T);
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error(`Failed to get all domain metadata`, {
        workflowId,
        domain,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to parse domain metadata: ${normalizedError.message}`,
        normalizedError.code || 'METADATA_PARSE_ERROR',
        {
          workflowId,
          domain,
          error: normalizedError.message
        }
      );
    }
  }
  
  /**
   * Update metadata with domain namespacing and conflict resolution
   * Handles separate storage of large fields
   */
  async updateMetadata(
    workflowId: string,
    domain: string,
    newMetadata: Record<string, unknown>,
    options: MetadataUpdateOptions = {}
  ): Promise<Result<boolean>> {
    try {
      if (!workflowId) {
        return Result.failure('Workflow ID is required', 'INVALID_WORKFLOW_ID');
      }
      
      if (!domain) {
        return Result.failure('Domain name is required', 'INVALID_DOMAIN_NAME');
      }
      
      // Get the domain-specific concurrency configuration
      const domainConfig = getDomainConcurrencyConfig(domain);
      
      const {
        // Use domain default strategy if not specified
        conflictStrategy = domainConfig.defaultStrategy,
        expectedTimestamp,
        skipValidation = false,
        forceUpdate = false,
        transactionId = crypto.randomUUID()
      } = options;
      
      // Add transaction ID and timestamp to common fields
      const commonFields = {
        transactionId,
        updatedAt: new Date().toISOString()
      };
      
      // Get current state
      const stateResult = await Result.fromPromise(
        workflowRepository.getWorkflowState(workflowId)
      );
      
      if (stateResult.isFailure()) {
        return Result.failure(
          `Failed to retrieve workflow state: ${stateResult.error.message}`,
          stateResult.error.code,
          { ...stateResult.error.details, workflowId, domain }
        );
      }
      
      const currentState = stateResult.value;
      if (!currentState) {
        return Result.failure(
          'Workflow state not found',
          'WORKFLOW_STATE_NOT_FOUND',
          { workflowId, domain }
        );
      }
      
      // Extract large fields that should be stored separately
      const separatedFields: Record<string, unknown> = {};
      const inlineFields: Record<string, unknown> = {};
      
      // Process fields according to their storage strategy
      for (const [key, value] of Object.entries(newMetadata)) {
        if (shouldStoreFieldSeparately(domain, key)) {
          // Move to separated storage
          separatedFields[key] = value;
          
          // Store reference ID in metadata
          if (value !== null && typeof value === 'object') {
            // Generate a reference ID
            const refId = `${key}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            inlineFields[`${key}RefId`] = refId;
          }
        } else {
          // Keep in main metadata
          inlineFields[key] = value;
        }
      }
      
      // Convert the current metadata to namespaced format if needed
      const currentMetadata = currentState.metadata || {};
      
      // Create or update the domain-specific section
      const finalMetadata = updateDomainMetadata(
        currentMetadata,
        domain as any,
        {
          ...commonFields,
          data: inlineFields
        }
      );
      
      // Store large fields separately if needed
      for (const [key, value] of Object.entries(separatedFields)) {
        const tableName = getFieldStorageTable(domain, key);
        if (tableName) {
          // Generate reference ID if not already done
          const refIdKey = `${key}RefId`;
          const refId = inlineFields[refIdKey] as string || 
                       `${key}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          
          // Update reference ID in the domain metadata
          const domainNamespace = domain.toLowerCase();
          if (!finalMetadata[domainNamespace]) {
            (finalMetadata as any)[domainNamespace] = { version: 1 };
          }
          (finalMetadata as any)[domainNamespace][refIdKey] = refId;
          
          // Store field separately
          const storageResult = await this.storeFieldSeparately(
            workflowId,
            domain,
            key, 
            value, 
            refId, 
            tableName
          );
          
          if (storageResult.isFailure()) {
            return Result.failure(
              `Failed to store field separately: ${storageResult.error.message}`,
              'WORKFLOW_FIELD_STORAGE_ERROR',
              { field: key, workflowId, tableName, domain }
            );
          }
        }
      }
      
      try {
        // Determine the appropriate merge strategy
        if (conflictStrategy === 'merge' || conflictStrategy === 'field-specific') {
          // For merge strategies, use the result of updateDomainMetadata which already handles merging
          await workflowRepository.updateWorkflowState(
            workflowId,
            currentState.currentStep,
            finalMetadata as Record<string, unknown>,
            {
              skipValidation,
              forceUpdate,
              conflictStrategy: 'merge'
            }
          );
        } else {
          // For other strategies (fail, force, etc.), use the provided metadata directly
          await workflowRepository.updateWorkflowState(
            workflowId,
            currentState.currentStep,
            finalMetadata as Record<string, unknown>,
            {
              skipValidation,
              forceUpdate,
              expectedTimestamp,
              conflictStrategy: conflictStrategy as any
            }
          );
        }
        
        // Log metadata update event
        await this.logEvent(
          workflowId,
          'metadata_updated',
          {
            keys: Object.keys(newMetadata),
            hasLargeFields: Object.keys(separatedFields).length > 0,
            timestamp: commonFields.updatedAt,
            transactionId
          },
          { domain }
        );
        
        return Result.success(true);
      } catch (error) {
        const normalizedError = normalizeError(error);
        this.logger.error('Failed to update metadata', {
          workflowId,
          domain,
          error: normalizedError.message
        });
        
        return Result.failure(
          `Failed to update metadata: ${normalizedError.message}`,
          normalizedError.code || 'WORKFLOW_METADATA_UPDATE_ERROR',
          {
            workflowId,
            domain,
            ...normalizedError.data
          }
        );
      }
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Unexpected error in updateMetadata', {
        workflowId,
        domain,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to update metadata: ${normalizedError.message}`,
        normalizedError.code || 'METADATA_UPDATE_ERROR',
        {
          workflowId,
          domain
        }
      );
    }
  }
  
  /**
   * Store a large field in a separate table
   */
  private async storeFieldSeparately(
    workflowId: string,
    domain: string,
    fieldName: string,
    fieldValue: unknown,
    referenceId: string,
    tableName: string
  ): Promise<Result<boolean>> {
    try {
      // Import supabase client here to avoid circular dependencies
      const { supabaseServiceRole } = await import('@/lib/supabase/clients');
      
      // Determine related entity ID based on domain and context
      let domainEntityId: string | null = null;
      
      // Get the entity ID for this domain
      const metadataResult = await this.getDomainMetadata<string>(
        workflowId, 
        domain, 
        domain.toLowerCase() + 'Id'
      );
      
      if (metadataResult.isSuccess() && metadataResult.value) {
        domainEntityId = metadataResult.value;
      } else {
        // Fallback to workflowId
        domainEntityId = workflowId;
      }
      
      // Prepare metadata to store with the content
      const metadata = {
        referenceId,
        storedAt: new Date().toISOString(),
        domain
      };
      
      // Convert value to string if needed
      const contentValue = typeof fieldValue === 'string' 
        ? fieldValue 
        : JSON.stringify(fieldValue);
        
      // Build the record to insert
      const record: Record<string, unknown> = {
        workflow_id: workflowId,
        field_name: fieldName,
        content: contentValue,
        metadata
      };
      
      // Add domain-specific fields
      switch (tableName) {
        case 'document_extractions':
          record.document_id = domainEntityId;
          break;
        case 'chat_extractions':
          record.chat_id = domainEntityId;
          break;
        case 'report_contents':
          record.report_id = domainEntityId;
          record.version = (metadata as any).version || 1;
          break;
        case 'research_results':
          record.research_id = domainEntityId;
          
          // For research, also store query info if available
          if (typeof fieldValue === 'object' && fieldValue !== null && (fieldValue as any).query) {
            record.query = (fieldValue as any).query;
          }
          
          // For research, also store sources if available
          if (typeof fieldValue === 'object' && fieldValue !== null && (fieldValue as any).sources) {
            record.sources = (fieldValue as any).sources;
          }
          break;
      }
      
      // Insert or update the record in the appropriate table
      const { data, error } = await supabaseServiceRole
        .from(tableName)
        .upsert(record, { 
          onConflict: 'workflow_id,field_name' + (tableName === 'report_contents' ? ',version' : '') 
        });
      
      if (error) {
        return Result.failure(
          `Database error storing field: ${error.message}`,
          error.code || 'SUPABASE_ERROR',
          { 
            workflowId, 
            domain,
            fieldName, 
            tableName,
            details: error.details
          }
        );
      }
      
      // Log success
      this.logger.info(`Stored ${fieldName} separately in ${tableName}`, {
        workflowId,
        domain,
        refId: referenceId
      });
      
      return Result.success(true);
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Failed to store field separately', {
        workflowId,
        domain,
        fieldName,
        tableName,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to store field separately: ${normalizedError.message}`,
        normalizedError.code || 'FIELD_STORAGE_ERROR',
        {
          workflowId,
          domain,
          fieldName,
          tableName
        }
      );
    }
  }
  
  /**
   * Domain-aware deep merge of metadata
   * Uses field-specific concurrency configurations for each field
   */
  mergeMetadata(
    domain: string,
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    const merged = { ...target };
    
    for (const [key, value] of Object.entries(source)) {
      // Get field-specific configuration
      const fieldConfig = getFieldConcurrencyConfig(domain, key);
      
      // Skip null or undefined values
      if (value === null || value === undefined) {
        continue;
      }
      
      // Handle arrays based on field-specific array merge strategy
      if (Array.isArray(value) && Array.isArray(merged[key])) {
        const arrayStrategy = fieldConfig?.arrayMergeStrategy || 'replace';
        
        switch (arrayStrategy) {
          case 'append':
            // Append source array to target array
            merged[key] = [...(merged[key] as unknown[]), ...value];
            break;
            
          case 'merge-by-id':
            // Merge arrays by ID field
            const targetArray = merged[key] as Record<string, unknown>[];
            const sourceArray = value as Record<string, unknown>[];
            const idField = 'id'; // Default ID field name
            
            // Get existing IDs
            const existingIds = new Set(
              targetArray
                .filter(item => item[idField] !== undefined)
                .map(item => item[idField])
            );
            
            // Add items that don't exist in target
            const newItems = sourceArray.filter(item => 
              item[idField] === undefined || !existingIds.has(item[idField])
            );
            
            // Update existing items
            const updatedTargetArray = targetArray.map(targetItem => {
              const sourceItem = sourceArray.find(item => 
                item[idField] !== undefined && 
                item[idField] === targetItem[idField]
              );
              
              if (sourceItem) {
                // Recursive merge for matching items
                return this.mergeMetadata(domain, targetItem, sourceItem);
              }
              return targetItem;
            });
            
            // Combine updated existing items with new items
            merged[key] = [...updatedTargetArray, ...newItems];
            break;
            
          case 'replace':
          default:
            // Default to replacing the array (same as regular assignment)
            merged[key] = value;
            break;
        }
      }
      // Recursively merge nested objects
      else if (
        merged[key] !== null &&
        typeof merged[key] === 'object' &&
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !Array.isArray(merged[key])
      ) {
        merged[key] = this.mergeMetadata(
          domain,
          merged[key] as Record<string, unknown>,
          value as Record<string, unknown>
        );
      } 
      // Handle conflict based on field-specific strategy
      else {
        // Check if we need to use a special field-specific strategy
        const fieldStrategy = fieldConfig?.conflictStrategy;
        
        if (!fieldStrategy || fieldStrategy === 'force') {
          // Default to overwriting
          merged[key] = value;
        } else if (fieldStrategy === 'fail') {
          // For fail strategy, log warning but don't change (assuming caller will handle this)
          this.logger.warn(`Field '${key}' has a fail conflict strategy but is being merged`, {
            domain,
            field: key
          });
          // Keep original value
        } else {
          // For all other strategies, take the new value
          merged[key] = value;
        }
      }
    }
    
    return merged;
  }
}

// Export singleton instance
export const workflowOperations = new WorkflowOperationsService();