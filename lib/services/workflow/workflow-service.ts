import type { SupabaseClient, RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { createBrowserClient } from '@/lib/supabase/clients'
import type { ProcessingPhase, WorkflowStep } from '@/lib/workflow/types'
import { WorkflowStateError, SystemError } from '@/lib/errors'

/**
 * Service for managing workflow state persistence and retrieval
 */
/**
 * Transaction record for optimistic updates and conflict resolution
 */
interface TransactionRecord {
  /**
   * Transaction ID
   */
  id: string;
  
  /**
   * Workflow ID this transaction is for
   */
  workflowId: string;
  
  /**
   * Timestamp when this transaction was created
   */
  timestamp: string;
  
  /**
   * Original state before the transaction
   */
  originalState?: {
    step: WorkflowStep;
    metadata: Record<string, any>;
  };
  
  /**
   * Target state after the transaction
   */
  targetState: {
    step: WorkflowStep;
    metadata: Record<string, any>;
  };
  
  /**
   * Status of this transaction
   */
  status: 'pending' | 'committed' | 'failed' | 'conflict';
  
  /**
   * Client ID that initiated this transaction
   */
  clientId: string;
  
  /**
   * Resolution strategy if conflict occurs
   */
  conflictStrategy: 'client-wins' | 'server-wins' | 'merge' | 'manual';
}

export class WorkflowService {
  private supabase: SupabaseClient<Database>
  private pendingTransactions: Map<string, TransactionRecord> = new Map();
  private clientId: string;
  
  /**
   * In-memory cache of workflow states
   * Used for optimistic updates and conflict resolution
   */
  private stateCache: Map<string, {
    step: WorkflowStep;
    metadata: Record<string, any>;
    lastUpdated: string;
    version: number;
  }> = new Map();

  constructor(supabaseClient?: SupabaseClient<Database>) {
    this.supabase = supabaseClient || createBrowserClient()
    this.clientId = this.generateClientId();
  }
  
  /**
   * Subscribe to workflow state changes
   * @param workflowId The workflow ID to subscribe to
   * @param onUpdate Callback for update events
   * @param onStatusChange Callback for subscription status changes
   * @returns The RealtimeChannel for cleanup
   */
  subscribeToWorkflowChanges(
    workflowId: string,
    onUpdate: (payload: RealtimePostgresChangesPayload<any>) => void,
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
          filter: `id=eq.${workflowId}`
        },
        onUpdate
      )
      .subscribe(status => {
        if (onStatusChange) {
          onStatusChange(status)
        }
      })
      
    return channel
  }
  
  /**
   * Unsubscribe from a realtime channel
   * @param channel The channel to unsubscribe from
   */
  unsubscribeFromChannel(channel: RealtimeChannel): void {
    this.supabase.removeChannel(channel)
  }

  /**
   * Create a unique client ID for tracking local changes
   * This helps prevent echo updates in multi-instance scenarios
   */
  private generateClientId(): string {
    // Check localStorage first for a persistent ID
    const storedId = typeof localStorage !== 'undefined'
      ? localStorage.getItem('neuvia_client_id')
      : null

    if (storedId) {
      return storedId
    }

    // Generate a new ID if not found
    const clientId = crypto.randomUUID()

    // Store in localStorage for persistence across page loads
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('neuvia_client_id', clientId)
    }

    return clientId
  }
  
  /**
   * Get the client ID for this instance
   * Useful for cross-referencing updates in diagnostic scenarios
   */
  getClientId(): string {
    return this.clientId
  }
  
  /**
   * Generate a unique transaction ID
   */
  private generateTransactionId(): string {
    return `tx-${this.clientId.substring(0, 8)}-${Date.now()}-${Math.floor(Math.random() * 10000)}`
  }
  
  /**
   * Creates a new transaction record for optimistic updates
   */
  private createTransaction(
    workflowId: string,
    targetStep: WorkflowStep,
    metadata: Record<string, any>,
    originalState?: { step: WorkflowStep; metadata: Record<string, any> },
    conflictStrategy: 'client-wins' | 'server-wins' | 'merge' | 'manual' = 'merge'
  ): TransactionRecord {
    const transactionId = this.generateTransactionId()
    const timestamp = new Date().toISOString()
    
    const transaction: TransactionRecord = {
      id: transactionId,
      workflowId,
      timestamp,
      originalState,
      targetState: {
        step: targetStep,
        metadata: {
          ...metadata,
          _transactionId: transactionId,
          _timestamp: timestamp
        }
      },
      status: 'pending',
      clientId: this.clientId,
      conflictStrategy
    }
    
    // Store the transaction in our pending transactions map
    this.pendingTransactions.set(transactionId, transaction)
    
    return transaction
  }
  
  /**
   * Update transaction status
   */
  private updateTransactionStatus(
    transactionId: string,
    status: 'pending' | 'committed' | 'failed' | 'conflict',
    error?: Error
  ): void {
    const transaction = this.pendingTransactions.get(transactionId)
    if (!transaction) return
    
    transaction.status = status
    
    if (error) {
      transaction.targetState.metadata._error = {
        message: error.message,
        name: error.name,
        timestamp: new Date().toISOString()
      }
    }
    
    // For committed or failed transactions, we can clean them up after a delay
    if (status === 'committed' || status === 'failed') {
      setTimeout(() => {
        this.pendingTransactions.delete(transactionId)
      }, 60000) // Keep for 1 minute for debugging
    }
  }
  
  /**
   * Resolve conflicts between local and remote state changes
   */
  private resolveConflict(
    transaction: TransactionRecord,
    remoteState: { step: WorkflowStep; metadata: Record<string, any> }
  ): { step: WorkflowStep; metadata: Record<string, any> } {
    const { targetState, conflictStrategy } = transaction
    
    // If remote state already contains our transaction ID, it means our change was accepted
    if (remoteState.metadata?._transactionId === transaction.id) {
      transaction.status = 'committed'
      return remoteState
    }
    
    // Determine which update happened later
    const localTimestamp = new Date(targetState.metadata._timestamp || 0).getTime()
    const remoteTimestamp = new Date(remoteState.metadata?.updatedAt || 0).getTime()
    const isLocalNewer = localTimestamp > remoteTimestamp
    
    switch (conflictStrategy) {
      case 'client-wins':
        // Always use our local change
        return targetState
        
      case 'server-wins':
        // Always use the server state
        transaction.status = 'conflict'
        return remoteState
        
      case 'merge':
        // Attempt to merge the changes intelligently
        const mergedMetadata = this.mergeMetadata(
          targetState.metadata,
          remoteState.metadata || {},
          isLocalNewer
        )
        
        // For step conflicts, prefer the "newer" step if timestamps differ significantly
        // Otherwise use a priority-based approach for common sequences
        let resolvedStep: WorkflowStep
        
        if (Math.abs(localTimestamp - remoteTimestamp) > 5000) {
          // If timestamps differ by more than 5 seconds, use the newer one
          resolvedStep = isLocalNewer ? targetState.step : remoteState.step
        } else {
          // For near-simultaneous updates, use priority rules
          resolvedStep = this.resolveStepConflict(targetState.step, remoteState.step)
        }
        
        return {
          step: resolvedStep,
          metadata: {
            ...mergedMetadata,
            _conflictResolved: true,
            _originalLocalStep: targetState.step,
            _originalRemoteStep: remoteState.step,
            _resolutionStrategy: 'merge',
            _resolvedAt: new Date().toISOString()
          }
        }
        
      case 'manual':
        // Mark as conflict and let the application handle it
        transaction.status = 'conflict'
        return {
          ...remoteState,
          metadata: {
            ...remoteState.metadata,
            _conflict: {
              localState: targetState,
              remoteState,
              transactionId: transaction.id,
              detectedAt: new Date().toISOString()
            }
          }
        }
        
      default:
        // Default to server-wins as the safest option
        transaction.status = 'conflict'
        return remoteState
    }
  }
  
  /**
   * Intelligently merge metadata objects from local and remote
   */
  private mergeMetadata(
    localMetadata: Record<string, any>,
    remoteMetadata: Record<string, any>,
    preferLocal: boolean = true
  ): Record<string, any> {
    const result = { ...remoteMetadata }
    
    // Merge properties from local metadata
    for (const [key, value] of Object.entries(localMetadata)) {
      // Skip internal properties that start with underscore
      if (key.startsWith('_') && key !== '_clientId') {
        continue
      }
      
      // If property exists in both, use conflict resolution logic
      if (key in result) {
        // For objects, recursively merge
        if (typeof value === 'object' && value !== null && 
            typeof result[key] === 'object' && result[key] !== null) {
          result[key] = this.mergeMetadata(value, result[key], preferLocal)
        } 
        // For primitive values, prefer local or remote based on preferLocal flag
        else {
          result[key] = preferLocal ? value : result[key]
        }
      } 
      // If property only in local, add it
      else {
        result[key] = value
      }
    }
    
    // Add metadata about the merge
    result._merged = true
    result._mergedAt = new Date().toISOString()
    
    return result
  }
  
  /**
   * Resolve conflicts between different workflow steps
   * using a priority-based approach for common sequences
   */
  private resolveStepConflict(
    localStep: WorkflowStep,
    remoteStep: WorkflowStep
  ): WorkflowStep {
    // If steps are the same, no conflict
    if (localStep === remoteStep) {
      return localStep
    }
    
    // Define step priorities for common sequences
    // Higher number = higher priority
    const stepPriorities: Record<WorkflowStep, number> = {
      'idle': 0,
      'chat_started': 10,
      'chat_in_progress': 20,
      'chat_completed': 30,
      'uploading': 100,
      'extracting': 200,
      'verification': 300,
      'verification_pending': 310,
      'verification_in_progress': 320,
      'verification_completed': 330,
      'verification_failed': 340,
      'report_generation': 400,
      'report_presentation': 450,
      'complete': 500,
      'research': 600,
      'error': 900 // Error takes precedence
    }
    
    // Choose the step with higher priority
    const localPriority = stepPriorities[localStep] || 0
    const remotePriority = stepPriorities[remoteStep] || 0
    
    return localPriority >= remotePriority ? localStep : remoteStep
  }

  /**
   * Helper method to determine if a step is directly storable in the database
   */
  private isDbWorkflowStep(step: WorkflowStep): step is Database['public']['Enums']['workflow_step'] {
    const dbSteps: Database['public']['Enums']['workflow_step'][] = [
      'idle',
      'uploading',
      'extracting',
      'verification',
      'report_generation',
      'complete',
      'chat_started',
      'chat_in_progress',
      'chat_completed',
      'chat_error',
    ]
    return dbSteps.includes(step as Database['public']['Enums']['workflow_step'])
  }

  /**
   * Update workflow state in database with optimistic updates and conflict resolution
   * 
   * @param workflowId The workflow ID to update
   * @param step The new workflow step
   * @param metadata Optional metadata to include
   * @param options Additional options for the update
   * @returns Promise resolving to transaction ID that can be used to track the update
   */
  async updateWorkflowState(
    workflowId: string,
    step: WorkflowStep,
    metadata: Record<string, any> = {},
    options: {
      optimistic?: boolean;
      conflictStrategy?: 'client-wins' | 'server-wins' | 'merge' | 'manual';
      forceUpdate?: boolean;
    } = {}
  ): Promise<string> {
    try {
      if (!workflowId) {
        throw new Error('Workflow ID is required')
      }

      // Set defaults for options
      const { 
        optimistic = true,
        conflictStrategy = 'merge',
        forceUpdate = false
      } = options
      
      // First, try to fetch the current state for conflict detection
      // Skip if we're doing a force update
      let originalState: { step: WorkflowStep; metadata: Record<string, any> } | undefined
      
      if (!forceUpdate) {
        try {
          // Check our local cache first
          const cachedState = this.stateCache.get(workflowId)
          
          if (cachedState) {
            originalState = {
              step: cachedState.step,
              metadata: cachedState.metadata
            }
          } else {
            // Otherwise fetch from the database
            const state = await this.getWorkflowState(workflowId)
            if (state) {
              originalState = state
              
              // Update our cache
              this.stateCache.set(workflowId, {
                ...state,
                lastUpdated: new Date().toISOString(),
                version: 1
              })
            }
          }
        } catch (err) {
          console.warn('Could not fetch original state for conflict detection:', err)
        }
      }
      
      // Create a transaction record for this update
      const transaction = this.createTransaction(
        workflowId,
        step,
        metadata,
        originalState,
        conflictStrategy
      )
      
      // Convert application workflow step to database workflow step if needed
      let dbStep: Database['public']['Enums']['workflow_step'] = 'idle'

      // Map application-specific steps to database enum values
      if (step === 'error') {
        dbStep = 'chat_error'
      } else if (step === 'research' || step === 'report_presentation') {
        // Map research to chat_in_progress for database compatibility
        dbStep = 'chat_in_progress'
      } else if (
        step === 'idle' ||
        step === 'uploading' ||
        step === 'extracting' ||
        step === 'verification' ||
        step === 'report_generation' ||
        step === 'complete' ||
        step === 'chat_started' ||
        step === 'chat_in_progress' ||
        step === 'chat_completed' ||
        step === 'verification_pending' ||
        step === 'verification_in_progress' ||
        step === 'verification_completed' ||
        step === 'verification_failed'
      ) {
        // These steps exist in both types, so use directly
        dbStep = step
      }

      // Enrich metadata with transaction info
      const enrichedMetadata = {
        ...(metadata || {}),
        updatedAt: new Date().toISOString(),
        originalStep: step, // Store the original step for reference
        _localUpdate: true, // Flag to prevent echo updates in real-time sync
        _clientId: this.clientId, // Add unique client ID to track the source
        _transactionId: transaction.id, // Add transaction ID for tracking
        _timestamp: transaction.timestamp,
        _originalState: originalState ? {
          step: originalState.step,
          updatedAt: originalState.metadata?.updatedAt
        } : undefined
      }
      
      // If optimistic updates are enabled, update our local cache immediately
      if (optimistic) {
        // Update local cache
        const existingCache = this.stateCache.get(workflowId)
        
        this.stateCache.set(workflowId, {
          step,
          metadata: enrichedMetadata,
          lastUpdated: transaction.timestamp,
          version: (existingCache?.version || 0) + 1
        })
      }
      
      // Define a function to process the database update
      const performDatabaseUpdate = async () => {
        // Prepare conditions for conditional update to help prevent conflicts
        const conditions: Record<string, any> = { id: workflowId }
        
        // If we have the original state and aren't forcing, add conditions
        // to ensure we're updating from the expected state
        if (originalState && !forceUpdate) {
          conditions.current_step = this.convertToDbStep(originalState.step)
        }
        
        try {
          // Use conditional update to detect conflicts
          const { data, error, count } = await this.supabase
            .from('workflow_states')
            .update({
              current_step: dbStep,
              metadata: enrichedMetadata,
            })
            .match(conditions) // Use match instead of eq for multiple conditions
            .select()
          
          // If no rows were updated, we might have a conflict
          if (count === 0 && !forceUpdate) {
            // Fetch the current state to resolve the conflict
            const currentState = await this.getWorkflowState(workflowId)
            
            if (!currentState) {
              throw new Error('Workflow state not found, it may have been deleted')
            }
            
            // Mark transaction as conflicted
            this.updateTransactionStatus(transaction.id, 'conflict')
            
            // Resolve the conflict based on strategy
            const resolvedState = this.resolveConflict(transaction, currentState)
            
            // Try to update with the resolved state
            await this.supabase
              .from('workflow_states')
              .update({
                current_step: this.convertToDbStep(resolvedState.step),
                metadata: {
                  ...resolvedState.metadata,
                  _conflictResolution: {
                    strategy: conflictStrategy,
                    resolvedAt: new Date().toISOString(),
                    transactionId: transaction.id
                  }
                },
              })
              .eq('id', workflowId)
            
            // Update our cache with the resolved state
            this.stateCache.set(workflowId, {
              step: resolvedState.step,
              metadata: resolvedState.metadata,
              lastUpdated: new Date().toISOString(),
              version: (this.stateCache.get(workflowId)?.version || 0) + 1
            })
            
            // Return transaction ID - application can check status if needed
            return transaction.id
          }
          
          if (error) {
            throw error
          }
          
          // Update transaction status to committed
          this.updateTransactionStatus(transaction.id, 'committed')
          
          return transaction.id
        } catch (error) {
          // Update transaction status to failed
          this.updateTransactionStatus(transaction.id, 'failed', error instanceof Error ? error : new Error(String(error)))
          
          // Clean up the optimistic update from cache if it failed
          if (optimistic && originalState) {
            this.stateCache.set(workflowId, {
              step: originalState.step,
              metadata: originalState.metadata,
              lastUpdated: new Date().toISOString(),
              version: (this.stateCache.get(workflowId)?.version || 0) + 1
            })
          }
          
          throw error
        }
      }
      
      // Execute the database update - if optimistic is false, await the result
      if (!optimistic) {
        await performDatabaseUpdate()
      } else {
        // Fire and forget for optimistic updates
        performDatabaseUpdate().catch(err => {
          console.error('Async database update failed:', err)
        })
      }
      
      // Return the transaction ID so the caller can track it if needed
      return transaction.id
    } catch (error) {
      console.error('Failed to update workflow state in database:', error)
      throw new SystemError({
        message: `Failed to update workflow state: ${error instanceof Error ? error.message : String(error)}`,
        code: 'WORKFLOW_UPDATE_FAILED',
        cause: error,
        data: { workflowId, step }
      })
    }
  }
  
  /**
   * Convert a workflow step to its database representation
   */
  private convertToDbStep(step: WorkflowStep): Database['public']['Enums']['workflow_step'] {
    // Map application-specific steps to database enum values
    if (step === 'error') {
      return 'chat_error'
    } else if (step === 'research' || step === 'report_presentation') {
      // Map research to chat_in_progress for database compatibility
      return 'chat_in_progress'
    } else if (
      step === 'idle' ||
      step === 'uploading' ||
      step === 'extracting' ||
      step === 'verification' ||
      step === 'report_generation' ||
      step === 'complete' ||
      step === 'chat_started' ||
      step === 'chat_in_progress' ||
      step === 'chat_completed' ||
      step === 'verification_pending' ||
      step === 'verification_in_progress' ||
      step === 'verification_completed' ||
      step === 'verification_failed'
    ) {
      // These steps exist in both types, so use directly
      return step as Database['public']['Enums']['workflow_step']
    }
    
    // Default to idle for any unknown steps
    return 'idle'
  }

  /**
   * Get current workflow state by ID
   * 
   * @param workflowId Workflow ID to fetch
   * @param options Additional options for the request
   * @returns Promise resolving to workflow state or null if not found
   */
  async getWorkflowState(
    workflowId: string, 
    options: {
      bypassCache?: boolean;
      includeTransactions?: boolean;
    } = {}
  ): Promise<{
    step: WorkflowStep
    metadata: Record<string, any>
    version?: number
  } | null> {
    try {
      if (!workflowId) return null
      
      const { bypassCache = false, includeTransactions = false } = options
      
      // Check cache first if not bypassing
      if (!bypassCache) {
        const cachedState = this.stateCache.get(workflowId)
        if (cachedState) {
          // Return cached state, including pending transaction info if requested
          if (includeTransactions) {
            // Find any pending transactions for this workflow
            const pendingTransactions = Array.from(this.pendingTransactions.values())
              .filter(tx => tx.workflowId === workflowId && tx.status === 'pending')
            
            if (pendingTransactions.length > 0) {
              return {
                ...cachedState,
                metadata: {
                  ...cachedState.metadata,
                  _pendingTransactions: pendingTransactions.map(tx => ({
                    id: tx.id,
                    timestamp: tx.timestamp,
                    targetState: tx.targetState.step
                  }))
                }
              }
            }
          }
          
          return {
            step: cachedState.step,
            metadata: cachedState.metadata,
            version: cachedState.version
          }
        }
      }

      // Fetch from database
      const { data, error } = await this.supabase
        .from('workflow_states')
        .select('current_step, metadata, updated_at')
        .eq('id', workflowId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Resource not found
          return null
        }
        
        throw new SystemError({
          message: `Error fetching workflow state: ${error.message}`,
          code: 'WORKFLOW_FETCH_ERROR',
          statusCode: 500,
          cause: error,
          data: { workflowId }
        })
      }

      if (!data) {
        return null
      }

      // Convert database step to app step if needed
      const step = data.metadata?.appStep || data.current_step
      const timestamp = data.updated_at || new Date().toISOString()
      
      const result = {
        step: step as WorkflowStep,
        metadata: data.metadata || {},
        version: 1
      }
      
      // Update cache with the fetched state
      this.stateCache.set(workflowId, {
        step: result.step,
        metadata: result.metadata,
        lastUpdated: timestamp,
        version: 1
      })
      
      // Include pending transactions if requested
      if (includeTransactions) {
        const pendingTransactions = Array.from(this.pendingTransactions.values())
          .filter(tx => tx.workflowId === workflowId && tx.status === 'pending')
        
        if (pendingTransactions.length > 0) {
          result.metadata = {
            ...result.metadata,
            _pendingTransactions: pendingTransactions.map(tx => ({
              id: tx.id,
              timestamp: tx.timestamp,
              targetState: tx.targetState.step
            }))
          }
        }
      }

      return result
    } catch (error) {
      console.error('Failed to get workflow state:', error)
      
      // Convert to SystemError for consistent error handling
      if (!(error instanceof SystemError)) {
        throw new SystemError({
          message: `Failed to get workflow state: ${error instanceof Error ? error.message : String(error)}`,
          code: 'WORKFLOW_FETCH_FAILED',
          cause: error,
          data: { workflowId }
        })
      }
      
      throw error
    }
  }
  
  /**
   * Check if a transaction has been committed
   * 
   * @param transactionId Transaction ID to check
   * @returns Promise resolving to transaction status info
   */
  async getTransactionStatus(transactionId: string): Promise<{
    status: 'pending' | 'committed' | 'failed' | 'conflict' | 'not_found';
    metadata?: Record<string, any>;
    workflowId?: string;
    error?: string;
  }> {
    // Check our internal transaction map first
    const transaction = this.pendingTransactions.get(transactionId)
    
    if (transaction) {
      return {
        status: transaction.status,
        metadata: transaction.targetState.metadata,
        workflowId: transaction.workflowId,
        error: transaction.targetState.metadata?._error?.message
      }
    }
    
    // Not found in memory, check if it was committed to the database
    try {
      // Try to find this transaction ID in database records
      const { data, error } = await this.supabase
        .from('workflow_states')
        .select('id, metadata')
        .filter('metadata->_transactionId', 'eq', transactionId)
        .maybeSingle()
      
      if (error) {
        throw error
      }
      
      if (data) {
        // Transaction was found in database, so it was committed
        return {
          status: 'committed',
          metadata: data.metadata,
          workflowId: data.id
        }
      }
      
      // Check for conflict resolution records
      const { data: conflictData, error: conflictError } = await this.supabase
        .from('workflow_states')
        .select('id, metadata')
        .filter('metadata->_conflictResolution->transactionId', 'eq', transactionId)
        .maybeSingle()
      
      if (conflictError) {
        throw conflictError
      }
      
      if (conflictData) {
        // Transaction was found in conflict resolution records
        return {
          status: 'conflict',
          metadata: conflictData.metadata,
          workflowId: conflictData.id
        }
      }
      
      // Transaction not found
      return {
        status: 'not_found'
      }
    } catch (error) {
      console.error('Error checking transaction status:', error)
      return {
        status: 'not_found',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Create a new workflow state
   */
  async createWorkflowState(
    userId: string,
    initialStep: WorkflowStep = 'idle',
    metadata: Record<string, any> = {}
  ): Promise<string | null> {
    try {
      // Determine if the step is valid for the database
      const step = this.isDbWorkflowStep(initialStep)
        ? initialStep
        : 'idle' as Database['public']['Enums']['workflow_step']

      const timestamp = new Date().toISOString()
      
      // Insert the workflow
      const { data, error } = await this.supabase
        .from('workflow_states')
        .insert({
          user_id: userId,
          current_step: step,
          metadata: {
            ...metadata,
            ...(initialStep !== step ? { appStep: initialStep } : {}),
            createdAt: timestamp,
            updatedAt: timestamp,
          }
        })
        .select('id')
        .single()

      if (error || !data) {
        console.error('Error creating workflow state:', error)
        return null
      }

      return data.id
    } catch (error) {
      console.error('Failed to create workflow state:', error)
      throw error
    }
  }

  /**
   * Set workflow status to error
   */
  async setWorkflowError(
    workflowId: string,
    errorMessage: string,
    errorDetails: Record<string, any> = {}
  ): Promise<void> {
    try {
      if (!workflowId) return

      const timestamp = new Date().toISOString()
      
      await this.supabase
        .from('workflow_states')
        .update({
          current_step: 'chat_error',
          metadata: {
            error: errorMessage,
            errorDetails,
            errorAt: timestamp,
            updatedAt: timestamp,
          }
        })
        .eq('id', workflowId)
    } catch (error) {
      console.error('Failed to set workflow error:', error)
      throw error
    }
  }

  /**
   * Update workflow processing status
   */
  async updateProcessingStatus(
    workflowId: string,
    progress: number,
    phase: ProcessingPhase
  ): Promise<void> {
    try {
      if (!workflowId) return

      const { data: currentState, error: fetchError } = await this.supabase
        .from('workflow_states')
        .select('metadata')
        .eq('id', workflowId)
        .single()

      if (fetchError) {
        console.error('Error fetching current workflow state:', fetchError)
        return
      }

      const currentMetadata = currentState?.metadata || {}
      
      await this.supabase
        .from('workflow_states')
        .update({
          metadata: {
            ...currentMetadata,
            processingStatus: {
              progress,
              phase,
              updatedAt: new Date().toISOString()
            }
          }
        })
        .eq('id', workflowId)
    } catch (error) {
      console.error('Failed to update processing status:', error)
      throw error
    }
  }

  /**
   * Reset workflow state
   */
  async resetWorkflow(workflowId: string): Promise<void> {
    try {
      if (!workflowId) return

      await this.supabase
        .from('workflow_states')
        .update({
          current_step: 'idle',
          metadata: {
            reset: true,
            resetAt: new Date().toISOString()
          }
        })
        .eq('id', workflowId)
    } catch (error) {
      console.error('Failed to reset workflow:', error)
      throw error
    }
  }

  /**
   * Complete workflow
   */
  async completeWorkflow(
    workflowId: string,
    completionMetadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      if (!workflowId) return

      const timestamp = new Date().toISOString()
      
      await this.supabase
        .from('workflow_states')
        .update({
          current_step: 'complete',
          metadata: {
            ...completionMetadata,
            completedAt: timestamp,
            updatedAt: timestamp,
          }
        })
        .eq('id', workflowId)
    } catch (error) {
      console.error('Failed to complete workflow:', error)
      throw error
    }
  }
}

// Export singleton instance
export const workflowService = new WorkflowService()