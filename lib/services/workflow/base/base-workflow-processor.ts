import { normalizeError, ApplicationError } from '@/lib/errors';
import { workflowRepository } from '../infrastructure/workflow-repository';
import { workflowStateManager } from '../infrastructure/workflow-state-manager';
import { workflowEventSourcing } from '../infrastructure/workflow-event-source';
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
import { Result, ResultError } from '../error/result';
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
 * Abstract base class for domain-specific workflow processors
 * Reduces code duplication by handling common patterns
 */
export abstract class BaseWorkflowProcessor<TInput, TResult> {
  protected readonly logger: ReturnType<typeof logger.withMetadata>;
  
  constructor(
    protected readonly domainName: string,
    protected readonly defaultErrorStep: WorkflowStep = DomainOnlyWorkflowStep.ERROR
  ) {
    this.logger = logger.withMetadata({ module: domainName + 'Workflow' });
  }
  
  /**
   * Process a workflow operation with common error handling using Result pattern
   * Returns a Result object that contains either the successful result or error details
   */
  async process(
    workflowId: string,
    input: TInput,
    options: WorkflowProcessOptions = {}
  ): Promise<Result<TResult>> {
    // Validate workflowId
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'WORKFLOW_INVALID_ID',
        { input: this.sanitizeForLogging(input) }
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
        { ...stateResult.error.details, workflowId, domain: this.domainName }
      );
    }
    
    const currentState = stateResult.value;
    if (!currentState) {
      return Result.failure(
        'Workflow state not found',
        'WORKFLOW_STATE_NOT_FOUND',
        { workflowId, domain: this.domainName }
      );
    }
    
    // If target step is provided, update workflow state
    if (options.targetStep) {
      const transitionResult = await Result.fromPromise(
        this.logStepTransition(
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
          }
        )
      );
      
      if (transitionResult.isFailure()) {
        return Result.failure(
          `Failed to transition workflow state: ${transitionResult.error.message}`,
          transitionResult.error.code || 'WORKFLOW_TRANSITION_FAILED',
          { ...transitionResult.error.details, workflowId, domain: this.domainName }
        );
      }
    }
    
    // Create progress callback if needed
    const progressCallback = options.onProgress
      ? (progress: number, phase: ProcessingPhase) => {
          // Update progress in workflow state - don't await to avoid blocking
          void this.updateProgress(
            workflowId,
            progress,
            phase,
            options.targetStep || currentState.currentStep
          );
          
          // Call external progress handler
          options.onProgress(progress, phase);
        }
      : undefined;
    
    // Run domain-specific processing with try/catch for explicit error handling
    const processResult = await Result.tryAsync(async () => {
      return await this.doProcess(
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
      this.logger.info(`${this.domainName} workflow operation completed successfully`, {
        workflowId,
        transactionId: options.transactionId
      });
      
      // Return success result
      return Result.success(processResult.value);
    } else {
      // Handle failure with consistent error reporting
      const normalizedError = normalizeError(processResult.error);
      this.logger.error(`Error processing ${this.domainName} workflow`, {
        workflowId,
        error: normalizedError.message,
        stack: normalizedError.stack
      });
      
      try {
        // Update workflow state to error, now using domain-specific error steps
        await workflowStateManager.handleError(
          workflowId,
          normalizedError,
          this.defaultErrorStep,
          {
            domain: this.domainName,
            operationInput: this.sanitizeForLogging(input),
            transactionId: options.transactionId
          }
        );
      } catch (stateError) {
        // Just log if state update fails
        this.logger.error('Failed to update error state after workflow error', {
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
          domain: this.domainName,
          workflowId,
          ...normalizedError.data
        }
      );
    }
  }
  
  /**
   * Domain-specific processing implementation
   * Returns the result directly - should not throw exceptions
   */
  protected abstract doProcess(
    workflowId: string,
    input: TInput,
    currentState: WorkflowState,
    options: WorkflowProcessOptions & {
      progressCallback?: (progress: number, phase: ProcessingPhase) => void
    }
  ): Promise<TResult>;
  
  /**
   * Clean sensitive or large data for error logging
   */
  protected sanitizeForLogging(input: TInput): Record<string, unknown> {
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
   * Log workflow event with standard formatting
   */
  protected async logEvent(
    workflowId: string,
    eventType: string,
    eventData: Record<string, unknown> = {},
    actorId?: string
  ): Promise<string | null> {
    try {
      return await workflowEventSourcing.appendEvent(
        workflowId,
        eventType,
        {
          domain: this.domainName,
          timestamp: new Date().toISOString(),
          ...eventData
        },
        actorId
      );
    } catch (error) {
      this.logger.error(`Failed to log ${eventType} event`, {
        workflowId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
  
  /**
   * Log step transition with event logging
   * Provides a consistent way to handle step transitions across all domain processors
   * Now uses domain-specific concurrency strategies and Result pattern
   */
  protected async logStepTransition(
    workflowId: string,
    fromStep: WorkflowStep,
    toStep: WorkflowStep,
    options: StepTransitionOptions = {}
  ): Promise<Result<boolean>> {
    // Get domain-specific concurrency config
    const domainConfig = getDomainConcurrencyConfig(this.domainName);
    
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
      if (shouldStoreFieldSeparately(this.domainName, key)) {
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
      const tableName = getFieldStorageTable(this.domainName, key);
      if (tableName) {
        const refId = inlineMetadata[`${key}RefId`] as string;
        
        // Override point for domain-specific separate storage
        const storageResult = await Result.fromPromise(
          this.storeFieldSeparately(workflowId, key, value, refId, tableName)
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
        this.logEvent(
          workflowId,
          'step_changed',
          {
            fromStep,
            toStep,
            reason: metadata.reason,
            transactionId,
            domain: this.domainName
          },
          actorId
        )
      );
      
      if (eventResult.isFailure()) {
        // Log but continue - event logging is not critical
        this.logger.warn('Failed to log step transition event', {
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
          domain: this.domainName // Pass domain for validation/handling
        }
      );
      
      return Result.success(true);
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Failed to log step transition', {
        workflowId,
        fromStep,
        toStep,
        domain: this.domainName,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to transition from ${fromStep} to ${toStep}: ${normalizedError.message}`,
        normalizedError.code || 'WORKFLOW_TRANSITION_ERROR',
        {
          workflowId,
          fromStep,
          toStep,
          domain: this.domainName,
          ...normalizedError.data
        }
      );
    }
  }
  
  /**
   * Update workflow progress
   * Provides a consistent way to update progress across all domain processors
   * Now returns a Result object
   */
  protected async updateProgress(
    workflowId: string,
    progress: number,
    phase: ProcessingPhase,
    currentStep?: WorkflowStep,
    notifyUsers: boolean = true
  ): Promise<Result<boolean>> {
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
      this.logger.error('Failed to update progress', {
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
          domain: this.domainName
        }
      );
    });
  }
  
  /**
   * Update metadata safely, handling conflicts using domain-specific strategies
   * Now uses namespaced metadata structure and returns Result
   */
  protected async updateMetadataSafely(
    workflowId: string,
    newMetadata: Record<string, unknown>,
    options: MetadataUpdateOptions = {}
  ): Promise<Result<boolean>> {
    // Get the domain-specific concurrency configuration
    const domainConfig = getDomainConcurrencyConfig(this.domainName);
    
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
        { ...stateResult.error.details, workflowId, domain: this.domainName }
      );
    }
    
    const currentState = stateResult.value;
    if (!currentState) {
      return Result.failure(
        'Workflow state not found',
        'WORKFLOW_STATE_NOT_FOUND',
        { workflowId, domain: this.domainName }
      );
    }
    
    // Extract large fields that should be stored separately
    const separatedFields: Record<string, unknown> = {};
    const inlineFields: Record<string, unknown> = {};
    
    // Process fields according to their storage strategy
    for (const [key, value] of Object.entries(newMetadata)) {
      if (shouldStoreFieldSeparately(this.domainName, key)) {
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
      this.domainName as any,
      {
        ...commonFields,
        data: inlineFields
      }
    );
    
    // Store large fields separately if needed
    for (const [key, value] of Object.entries(separatedFields)) {
      const tableName = getFieldStorageTable(this.domainName, key);
      if (tableName) {
        // Generate reference ID if not already done
        const refIdKey = `${key}RefId`;
        const refId = inlineFields[refIdKey] as string || 
                     `${key}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // Update reference ID in the domain metadata
        const domainNamespace = this.domainName.toLowerCase();
        if (!finalMetadata[domainNamespace]) {
          (finalMetadata as any)[domainNamespace] = { version: 1 };
        }
        (finalMetadata as any)[domainNamespace][refIdKey] = refId;
        
        // Store field separately
        const storageResult = await Result.fromPromise(
          this.storeFieldSeparately(workflowId, key, value, refId, tableName)
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
      this.logger.error('Failed to update metadata using namespaced structure', {
        workflowId,
        domain: this.domainName,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to update metadata: ${normalizedError.message}`,
        normalizedError.code || 'WORKFLOW_METADATA_UPDATE_ERROR',
        {
          workflowId,
          domain: this.domainName,
          ...normalizedError.data
        }
      );
    }
  }
  
  /**
   * Domain-aware deep merge of metadata
   * Uses field-specific concurrency configurations for each field
   */
  private domainAwareDeepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    const merged = { ...target };
    
    for (const [key, value] of Object.entries(source)) {
      // Get field-specific configuration
      const fieldConfig = getFieldConcurrencyConfig(this.domainName, key);
      
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
                return this.domainAwareDeepMerge(targetItem, sourceItem);
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
        merged[key] = this.domainAwareDeepMerge(
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
            domain: this.domainName,
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
  
  /**
   * Store a large field in a separate table
   * Provides a base implementation for all domain processors
   * Now returns a Result
   */
  protected async storeFieldSeparately(
    workflowId: string,
    fieldName: string,
    fieldValue: unknown,
    referenceId: string,
    tableName: string
  ): Promise<Result<boolean>> {
    return await Result.tryAsync(async () => {
      // Import supabase client here to avoid circular dependencies
      const { supabaseServiceRole } = await import('@/lib/supabase/clients');
      
      // Determine related entity ID based on domain and context
      let domainEntityId: string | null = null;
      
      // Each domain might need to associate the field with a specific entity
      const metadataResult = await this.getDomainMetadata<string>(workflowId, 'documentId');
      
      // Get specific entity ID based on domain
      switch (this.domainName) {
        case 'Document':
          domainEntityId = metadataResult.getValueOrDefault(workflowId);
          break;
        case 'Chat':
          domainEntityId = (await this.getDomainMetadata<string>(workflowId, 'chatId'))
            .getValueOrDefault(workflowId);
          break;
        case 'Report':
          domainEntityId = (await this.getDomainMetadata<string>(workflowId, 'reportId'))
            .getValueOrDefault(workflowId);
          break;
        case 'Research':
          domainEntityId = (await this.getDomainMetadata<string>(workflowId, 'researchId'))
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
        domain: this.domainName
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
      this.logger.info(`Stored ${fieldName} separately in ${tableName}`, {
        workflowId,
        domain: this.domainName,
        refId: referenceId
      });
      
      return true;
    });
  }
  
  /**
   * Gets domain-specific metadata from workflow state
   * Updated to handle namespaced metadata and return Result
   */
  protected async getDomainMetadata<T>(
    workflowId: string,
    key: string,
    defaultValue?: T
  ): Promise<Result<T | undefined>> {
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
          domain: this.domainName, 
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
    const namespace = this.domainName.toLowerCase();
    
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
   * Now returns Result for consistent error handling
   */
  protected async getAllDomainMetadata<T extends Record<string, unknown>>(
    workflowId: string
  ): Promise<Result<T | undefined>> {
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
          domain: this.domainName,
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
      const domainMetadata = getMetadataForDomain(state.metadata, this.domainName as any);
      if (!domainMetadata) {
        // If no domain-specific metadata exists, try to migrate it
        const migrated = migrateToNamespacedMetadata(state.metadata, this.domainName);
        return Result.success((migrated[this.domainName.toLowerCase()] as T) || undefined);
      }
      
      return Result.success(domainMetadata as unknown as T);
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error(`Failed to get domain metadata`, {
        workflowId,
        domain: this.domainName,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to parse domain metadata: ${normalizedError.message}`,
        normalizedError.code || 'METADATA_PARSE_ERROR',
        {
          workflowId,
          domain: this.domainName,
          error: normalizedError.message
        }
      );
    }
  }
}