import { workflowService } from './workflow-service'
import type { WorkflowStep } from '@/lib/workflow/types'

/**
 * Service for managing workflow state in local and remote storage
 * 
 * This service acts as a bridge between local storage (for client-side persistence)
 * and remote database state (for synchronization across clients and sessions).
 * It centralizes all access to workflow IDs and provides convenience methods
 * for common operations.
 */
export class WorkflowStateManager {
  /**
   * Storage keys used by the application
   */
  private readonly STORAGE_KEYS = {
    WORKFLOW_ID: 'current_workflow_id',
    CHAT_ID: 'current_chat_id',
    CLIENT_ID: 'neuvia_client_id'
  }

  /**
   * Get current workflow ID from localStorage
   */
  getCurrentWorkflowId(): string | null {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(this.STORAGE_KEYS.WORKFLOW_ID)
  }
  
  /**
   * Set current workflow ID in localStorage
   */
  setCurrentWorkflowId(id: string): void {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(this.STORAGE_KEYS.WORKFLOW_ID, id)
  }
  
  /**
   * Clear current workflow ID from localStorage
   */
  clearCurrentWorkflowId(): void {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(this.STORAGE_KEYS.WORKFLOW_ID)
  }

  /**
   * Get current chat ID from localStorage
   */
  getCurrentChatId(): string | null {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(this.STORAGE_KEYS.CHAT_ID)
  }
  
  /**
   * Set current chat ID in localStorage
   */
  setCurrentChatId(id: string): void {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(this.STORAGE_KEYS.CHAT_ID, id)
  }
  
  /**
   * Clear current chat ID from localStorage
   */
  clearCurrentChatId(): void {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(this.STORAGE_KEYS.CHAT_ID)
  }
  
  /**
   * Get current workflow state through service 
   */
  async getWorkflowState(): Promise<{
    step: WorkflowStep
    metadata: Record<string, any>
  } | null> {
    const id = this.getCurrentWorkflowId()
    if (!id) return null
    return await workflowService.getWorkflowState(id)
  }
  
  /**
   * Update workflow state through service
   */
  async updateWorkflowState(step: WorkflowStep, metadata?: Record<string, any>): Promise<void> {
    const id = this.getCurrentWorkflowId()
    if (!id) return
    await workflowService.updateWorkflowState(id, step, metadata)
  }

  /**
   * Set workflow to error state
   */
  async setWorkflowError(errorMessage: string, errorDetails: Record<string, any> = {}): Promise<void> {
    const id = this.getCurrentWorkflowId()
    if (!id) return
    await workflowService.setWorkflowError(id, errorMessage, errorDetails)
  }

  /**
   * Reset workflow state
   */
  async resetWorkflow(): Promise<void> {
    const id = this.getCurrentWorkflowId()
    if (!id) return
    await workflowService.resetWorkflow(id)
  }

  /**
   * Complete workflow
   */
  async completeWorkflow(completionMetadata: Record<string, any> = {}): Promise<void> {
    const id = this.getCurrentWorkflowId()
    if (!id) return
    await workflowService.completeWorkflow(id, completionMetadata)
  }

  /**
   * Create a new workflow and set it as current
   */
  async createAndSetWorkflow(
    userId: string, 
    initialStep: WorkflowStep = 'idle',
    metadata: Record<string, any> = {}
  ): Promise<string | null> {
    const workflowId = await workflowService.createWorkflowState(userId, initialStep, metadata)
    
    if (workflowId) {
      this.setCurrentWorkflowId(workflowId)
    }
    
    return workflowId
  }

  /**
   * Clear all workflow state
   */
  clearAll(): void {
    this.clearCurrentWorkflowId()
    this.clearCurrentChatId()
  }
}

// Export singleton instance
export const workflowStateManager = new WorkflowStateManager()