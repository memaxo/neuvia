import { normalizeError } from '@/lib/errors';
import { workflowRepository } from './workflow-repository';
import { workflowStateManager } from './workflow-state-manager';
import { workflowEventSourcing } from './workflow-event-source';
import { 
  getDomainConcurrencyConfig, 
  getFieldConcurrencyConfig,
  shouldStoreFieldSeparately,
  getFieldStorageTable
} from './domain-concurrency-config';
import {
  NamespacedMetadata,
  updateDomainMetadata,
  getDomainMetadata as getMetadataForDomain,
  migrateToNamespacedMetadata
} from './domain-metadata-helpers';
import { Result } from '../error/result';
import logger from '@/lib/logger';

import type { WorkflowStep, ProcessingPhase, WorkflowState } from '@/lib/types/workflow';
import { DomainOnlyWorkflowStep } from '@/lib/types/workflow';

/**
 * Options for conflict resolution during metadata updates
 */
export interface MetadataUpdateOptions {
  /** Strategy for handling conflicts */
  conflictStrategy?: 'pessimistic' | 'optimistic' | 'merge';
  
  /** Expected timestamp for optimistic concurrency control */
  expectedTimestamp?: string;
  
  /** Skip validation of transitions */
  skipValidation?: boolean;
  
  /** Force update even if validation fails */
  forceUpdate?: boolean;
  
  /** Transaction ID for tracking */
  transactionId?: string;
}

/**
 * Options for workflow processing operations
 */
export interface WorkflowProcessOptions {
  /** Transaction ID for tracking */
  transactionId?: string;
  
  /** Workflow step to transition to */
  targetStep?: WorkflowStep;
  
  /** Progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
  
  /** Metadata for the operation */
  metadata?: Record<string, unknown>;
  
  /** Whether to auto-proceed to next step */
  autoProceed?: boolean;
  
  /** Recovery step if operation fails */
  recoveryStep?: WorkflowStep;
  
  /** Strategy for handling conflicts */
  conflictStrategy?: 'pessimistic' | 'optimistic' | 'merge';
}

/**
 * Options for step transition with event logging
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
  conflictStrategy?: 'pessimistic' | 'optimistic' | 'merge';
  
  /** Expected timestamp for optimistic concurrency control */
  expectedTimestamp?: string;
  
  /** Whether to log the transition as an event */
  logEvent?: boolean;
}

/**
 * Creates a domain-specific logger instance
 */
export function createDomainLogger(domainName: string) {
  return logger.withMetadata({ module: domainName + 'Workflow' });
}

/**
 * Clean sensitive or large data for error logging
 */
export function sanitizeForLogging<TInput>(input: TInput): Record<string, unknown> {
  // Default implementation - override for domain-specific sanitization
  if (typeof input === 'object' && input !== null) {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      // Skip file objects and large data
      if (value instanceof File) {
        sanitized[key] = `File: ${value.name} (${value.size} bytes)`;
      } else if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = `${value.substring(0, 100)}... (truncated)`;
      } else if (key.toLowerCase().includes('password') || key.toLowerCase().includes('token')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  return { input: String(input) };
}

/**
 * Process a workflow operation with common error handling using Result pattern
 */
export async function processWorkflow<TInput, TResult>(
  workflowId: string,
  input: TInput,
  options: WorkflowProcessOptions = {},
  domainName: string,
  defaultErrorStep: WorkflowStep = DomainOnlyWorkflowStep.ERROR,
  processFunction: (
    workflowId: string,
    input: TInput,
    currentState: WorkflowState,
    options: WorkflowProcessOptions & {
      progressCallback?: (progress: number, phase: ProcessingPhase) => void
    }
  ) => Promise<TResult>
): Promise<Result<TResult>> {
  const domainLogger = createDomainLogger(domainName);
  
  // Validate workflowId
  if (!workflowId) {
    return Result.failure(
      'Workflow ID is required',
      'WORKFLOW_INVALID_ID',
      { input: sanitizeForLogging(input) }
    );
  }
  
  // Get current state for transition validation
  const stateResult = await Result.fromPromise(
    workflowRepository.getWorkflowState(workflowId)
  );
  
  if (stateResult.isFailure()) {
    return Result.failure(
      `Failed to retrieve workflow state: ${stateResult.error.message}`,
      stateResult.error.code,
      { ...stateResult.error.details, workflowId, domain: domainName }
    );
  }
  
  const currentState = stateResult.value;
  if (!currentState) {
    return Result.failure(
      'Workflow state not found',
      'WORKFLOW_STATE_NOT_FOUND',
      { workflowId, domain: domainName }
    );
  }
  
  // If target step is provided, update workflow state
  if (options.targetStep) {
    const transitionResult = await Result.fromPromise(
      logStepTransition(
        workflowId,
        currentState.currentStep,
        options.targetStep,
        {
          metadata: {
            ...options.metadata,
            startedAt: new Date().toISOString()
          },
          transactionId: options.transactionId || crypto.randomUUID(),
          conflictStrategy: options.conflictStrategy
        },
        domainName
      )
    );
    
    if (transitionResult.isFailure()) {
      return Result.failure(
        `Failed to transition workflow state: ${transitionResult.error.message}`,
        transitionResult.error.code || 'WORKFLOW_TRANSITION_FAILED',
        { ...transitionResult.error.details, workflowId, domain: domainName }
      );
    }
  }
  
  // Create progress callback if needed
  const progressCallback = options.onProgress
    ? (progress: number, phase: ProcessingPhase) => {
        // Update progress in workflow state - don't await to avoid blocking
        void updateProgress(
          workflowId,
          progress,
          phase,
          options.targetStep || currentState.currentStep,
          true,
          domainName
        );
        
        // Call external progress handler
        options.onProgress(progress, phase);
      }
    : undefined;
  
  // Run domain-specific processing with try/catch for explicit error handling
  const processResult = await Result.tryAsync(async () => {
    return await processFunction(
      workflowId,
      input,
      currentState,
      {
        ...options,
        progressCallback
      }
    );
  });
  
  // Log and handle results
  if (processResult.isSuccess()) {
    // Log successful completion
    domainLogger.info(`${domainName} workflow operation completed successfully`, {
      workflowId,
      transactionId: options.transactionId
    });
    
    // Return success result
    return Result.success(processResult.value);
  } else {
    // Handle failure with consistent error reporting
    const normalizedError = normalizeError(processResult.error);
    domainLogger.error(`Error processing ${domainName} workflow`, {
      workflowId,
      error: normalizedError.message,
      stack: normalizedError.stack
    });
    
    try {
      // Update workflow state to error, now using domain-specific error steps
      await workflowStateManager.handleError(
        workflowId,
        normalizedError,
        defaultErrorStep,
        {
          domain: domainName,
          operationInput: sanitizeForLogging(input),
          transactionId: options.transactionId
        }
      );
    } catch (stateError) {
      // Just log if state update fails
      domainLogger.error('Failed to update error state after workflow error', {
        workflowId,
        originalError: normalizedError.message,
        stateError: stateError instanceof Error ? stateError.message : String(stateError)
      });
    }
    
    // Return failure result using standard Result pattern
    return Result.failure(
      normalizedError.message,
      normalizedError.code || 'WORKFLOW_PROCESSING_ERROR',
      {
        domain: domainName,
        workflowId,
        ...normalizedError.data
      }
    );
  }
}

/**
 * Log workflow event with standard formatting
 */
export async function logWorkflowEvent(
  workflowId: string,
  eventType: string,
  eventData: Record<string, unknown> = {},
  actorId?: string,
  domainName: string
): Promise<string | null> {
  const domainLogger = createDomainLogger(domainName);
  
  try {
    return await workflowEventSourcing.appendEvent(
      workflowId,
      eventType,
      {
        domain: domainName,
        timestamp: new Date().toISOString(),
        ...eventData
      },
      actorId
    );
  } catch (error) {
    domainLogger.error(`Failed to log ${eventType} event`, {
      workflowId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Log step transition with event logging
 * Provides a consistent way to handle step transitions
 * Uses domain-specific concurrency strategies and Result pattern
 */
export async function logStepTransition(
  workflowId: string,
  fromStep: WorkflowStep,
  toStep: WorkflowStep,
  options: StepTransitionOptions = {},
  domainName: string
): Promise<Result<boolean>> {
  const domainLogger = createDomainLogger(domainName);
  
  // Get domain-specific concurrency config
  const domainConfig = getDomainConcurrencyConfig(domainName);
  
  const {
    metadata = {},
    transactionId = crypto.randomUUID(),
    actorId,
    skipValidation = false,
    forceUpdate = false,
    // Use domain default for conflict strategy if not specified
    conflictStrategy = domainConfig.defaultStrategy,
    expectedTimestamp,
    logEvent = true
  } = options;
  
  // Add standard fields to metadata
  const transitionMetadata = {
    ...metadata,
    transactionId,
    transitionTimestamp: new Date().toISOString(),
    fromStep,
    toStep
  };
  
  // Separate large fields for storage
  const separatedFields: Record<string, unknown> = {};
  const inlineMetadata: Record<string, unknown> = { ...transitionMetadata };
  
  // Process fields for separate storage
  for (const [key, value] of Object.entries(inlineMetadata)) {
    if (shouldStoreFieldSeparately(domainName, key)) {
      // Move to separated storage
      separatedFields[key] = value;
      delete inlineMetadata[key]; // Remove from inline metadata
      
      // Generate and store reference ID
      if (value !== null && typeof value === 'object') {
        const refId = `${key}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        inlineMetadata[`${key}RefId`] = refId;
      }
    }
  }
  
  // Store large fields separately
  for (const [key, value] of Object.entries(separatedFields)) {
    const tableName = getFieldStorageTable(domainName, key);
    if (tableName) {
      const refId = inlineMetadata[`${key}RefId`] as string;
      
      // Store field separately
      const storageResult = await Result.fromPromise(
        storeFieldSeparately(workflowId, key, value, refId, tableName, domainName)
      );
      
      if (storageResult.isFailure()) {
        return Result.failure(
          `Failed to store field separately: ${storageResult.error.message}`,
          'WORKFLOW_FIELD_STORAGE_ERROR',
          { 
            field: key, 
            workflowId, 
            tableName 
          }
        );
      }
    }
  }
  
  // Log transition event if requested
  if (logEvent) {
    const eventResult = await Result.fromPromise(
      logWorkflowEvent(
        workflowId,
        'step_changed',
        {
          fromStep,
          toStep,
          reason: metadata.reason,
          transactionId,
          domain: domainName
        },
        actorId,
        domainName
      )
    );
    
    if (eventResult.isFailure()) {
      // Log but continue - event logging is not critical
      domainLogger.warn('Failed to log step transition event', {
        workflowId,
        fromStep,
        toStep,
        error: eventResult.error.message
      });
    }
  }
  
  // Map from domain strategy to repository strategy
  const repoStrategy = conflictStrategy === 'field-specific' ? 'merge' : 
                     (conflictStrategy === 'append' ? 'merge' : 
                     (conflictStrategy as any));
  
  // Perform the transition using workflowStateManager
  try {
    await workflowStateManager.transitionState(
      workflowId,
      fromStep,
      toStep,
      inlineMetadata,
      {
        skipValidation,
        forceUpdate,
        conflictStrategy: repoStrategy,
        expectedTimestamp,
        logEvent: false, // We already logged the event above
        domain: domainName // Pass domain for validation/handling
      }
    );
    
    return Result.success(true);
  } catch (error) {
    const normalizedError = normalizeError(error);
    domainLogger.error('Failed to log step transition', {
      workflowId,
      fromStep,
      toStep,
      domain: domainName,
      error: normalizedError.message
    });
    
    return Result.failure(
      `Failed to transition from ${fromStep} to ${toStep}: ${normalizedError.message}`,
      normalizedError.code || 'WORKFLOW_TRANSITION_ERROR',
      {
        workflowId,
        fromStep,
        toStep,
        domain: domainName,
        ...normalizedError.data
      }
    );
  }
}

/**
 * Update workflow progress
 * Provides a consistent way to update progress
 * Returns a Result object
 */
export async function updateProgress(
  workflowId: string,
  progress: number,
  phase: ProcessingPhase,
  currentStep?: WorkflowStep,
  notifyUsers: boolean = true,
  domainName: string
): Promise<Result<boolean>> {
  const domainLogger = createDomainLogger(domainName);
  
  return await Result.tryAsync(async () => {
    await workflowStateManager.updateProgress(
      workflowId,
      progress,
      phase,
      { 
        currentStep,
        notifyUsers 
      }
    );
    
    return true;
  }).catch(error => {
    const normalizedError = normalizeError(error);
    domainLogger.error('Failed to update progress', {
      workflowId,
      progress,
      phase: phase.toString(),
      error: normalizedError.message
    });
    
    return Result.failure<boolean>(
      `Failed to update progress: ${normalizedError.message}`,
      normalizedError.code || 'WORKFLOW_PROGRESS_UPDATE_ERROR',
      {
        workflowId,
        progress,
        phase: phase.toString(),
        domain: domainName
      }
    );
  });
}

/**
 * Update metadata safely, handling conflicts using domain-specific strategies
 * Uses namespaced metadata structure and returns Result
 */
export async function updateMetadataSafely(
  workflowId: string,
  newMetadata: Record<string, unknown>,
  options: MetadataUpdateOptions = {},
  domainName: string
): Promise<Result<boolean>> {
  const domainLogger = createDomainLogger(domainName);
  
  // Get the domain-specific concurrency configuration
  const domainConfig = getDomainConcurrencyConfig(domainName);
  
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
      { ...stateResult.error.details, workflowId, domain: domainName }
    );
  }
  
  const currentState = stateResult.value;
  if (!currentState) {
    return Result.failure(
      'Workflow state not found',
      'WORKFLOW_STATE_NOT_FOUND',
      { workflowId, domain: domainName }
    );
  }
  
  // Extract large fields that should be stored separately
  const separatedFields: Record<string, unknown> = {};
  const inlineFields: Record<string, unknown> = {};
  
  // Process fields according to their storage strategy
  for (const [key, value] of Object.entries(newMetadata)) {
    if (shouldStoreFieldSeparately(domainName, key)) {
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
  let finalMetadata: NamespacedMetadata;
  
  // Create or update the domain-specific section
  finalMetadata = updateDomainMetadata(
    currentMetadata,
    domainName as any,
    {
      ...commonFields,
      data: inlineFields
    }
  );
  
  // Store large fields separately if needed
  for (const [key, value] of Object.entries(separatedFields)) {
    const tableName = getFieldStorageTable(domainName, key);
    if (tableName) {
      // Generate reference ID if not already done
      const refIdKey = `${key}RefId`;
      const refId = inlineFields[refIdKey] as string || 
                   `${key}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Update reference ID in the domain metadata
      const domainNamespace = domainName.toLowerCase();
      if (!finalMetadata[domainNamespace]) {
        (finalMetadata as any)[domainNamespace] = { version: 1 };
      }
      (finalMetadata as any)[domainNamespace][refIdKey] = refId;
      
      // Store field separately
      const storageResult = await Result.fromPromise(
        storeFieldSeparately(workflowId, key, value, refId, tableName, domainName)
      );
      
      if (storageResult.isFailure()) {
        return Result.failure(
          `Failed to store field separately: ${storageResult.error.message}`,
          'WORKFLOW_FIELD_STORAGE_ERROR',
          { field: key, workflowId, tableName }
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
    
    return Result.success(true);
  } catch (error) {
    const normalizedError = normalizeError(error);
    domainLogger.error('Failed to update metadata using namespaced structure', {
      workflowId,
      domain: domainName,
      error: normalizedError.message
    });
    
    return Result.failure(
      `Failed to update metadata: ${normalizedError.message}`,
      normalizedError.code || 'WORKFLOW_METADATA_UPDATE_ERROR',
      {
        workflowId,
        domain: domainName,
        ...normalizedError.data
      }
    );
  }
}

/**
 * Store a large field in a separate table
 * Provides a base implementation for all domain processors
 * Returns a Result
 */
export async function storeFieldSeparately(
  workflowId: string,
  fieldName: string,
  fieldValue: unknown,
  referenceId: string,
  tableName: string,
  domainName: string
): Promise<Result<boolean>> {
  const domainLogger = createDomainLogger(domainName);
  
  return await Result.tryAsync(async () => {
    // Import supabase client here to avoid circular dependencies
    const { supabaseServiceRole } = await import('@/lib/supabase/clients');
    
    // Determine related entity ID based on domain and context
    let domainEntityId: string | null = null;
    
    // Each domain might need to associate the field with a specific entity
    const metadataResult = await getDomainMetadata<string>(workflowId, 'documentId', undefined, domainName);
    
    // Get specific entity ID based on domain
    switch (domainName) {
      case 'Document':
        domainEntityId = metadataResult.getValueOrDefault(workflowId);
        break;
      case 'Chat':
        domainEntityId = (await getDomainMetadata<string>(workflowId, 'chatId', undefined, domainName))
          .getValueOrDefault(workflowId);
        break;
      case 'Report':
        domainEntityId = (await getDomainMetadata<string>(workflowId, 'reportId', undefined, domainName))
          .getValueOrDefault(workflowId);
        break;
      case 'Research':
        domainEntityId = (await getDomainMetadata<string>(workflowId, 'researchId', undefined, domainName))
          .getValueOrDefault(workflowId);
        break;
      case 'Verification':
      default:
        domainEntityId = workflowId;
    }
    
    // Prepare metadata to store with the content
    const metadata = {
      referenceId,
      storedAt: new Date().toISOString(),
      domain: domainName
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
          fieldName, 
          tableName,
          details: error.details
        }
      );
    }
    
    // Log success
    domainLogger.info(`Stored ${fieldName} separately in ${tableName}`, {
      workflowId,
      domain: domainName,
      refId: referenceId
    });
    
    return true;
  });
}

/**
 * Gets domain-specific metadata from workflow state
 * Handles namespaced metadata and returns Result
 */
export async function getDomainMetadata<T>(
  workflowId: string,
  key: string,
  defaultValue?: T,
  domainName: string
): Promise<Result<T | undefined>> {
  const domainLogger = createDomainLogger(domainName);
  
  // Get workflow state using Result pattern
  const stateResult = await Result.fromPromise(
    workflowRepository.getWorkflowState(workflowId)
  );
  
  if (stateResult.isFailure()) {
    return Result.failure(
      `Failed to retrieve workflow state: ${stateResult.error.message}`,
      stateResult.error.code,
      { 
        workflowId, 
        domain: domainName, 
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
  const namespace = domainName.toLowerCase();
  
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
}

/**
 * Gets all domain-specific metadata from workflow state
 * Returns Result for consistent error handling
 */
export async function getAllDomainMetadata<T extends Record<string, unknown>>(
  workflowId: string,
  domainName: string
): Promise<Result<T | undefined>> {
  const domainLogger = createDomainLogger(domainName);
  
  // Get workflow state using Result pattern
  const stateResult = await Result.fromPromise(
    workflowRepository.getWorkflowState(workflowId)
  );
  
  if (stateResult.isFailure()) {
    return Result.failure(
      `Failed to retrieve workflow state: ${stateResult.error.message}`,
      stateResult.error.code,
      { 
        workflowId, 
        domain: domainName,
        ...stateResult.error.details
      }
    );
  }
  
  const state = stateResult.value;
  if (!state || !state.metadata) {
    return Result.success(undefined);
  }
  
  try {
    // Get domain-specific metadata using the imported helper
    const domainMetadata = getMetadataForDomain(state.metadata, domainName as any);
    if (!domainMetadata) {
      // If no domain-specific metadata exists, try to migrate it
      const migrated = migrateToNamespacedMetadata(state.metadata, domainName);
      return Result.success((migrated[domainName.toLowerCase()] as T) || undefined);
    }
    
    return Result.success(domainMetadata as unknown as T);
  } catch (error) {
    const normalizedError = normalizeError(error);
    domainLogger.error(`Failed to get domain metadata`, {
      workflowId,
      domain: domainName,
      error: normalizedError.message
    });
    
    return Result.failure(
      `Failed to parse domain metadata: ${normalizedError.message}`,
      normalizedError.code || 'METADATA_PARSE_ERROR',
      {
        workflowId,
        domain: domainName,
        error: normalizedError.message
      }
    );
  }
}