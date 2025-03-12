/**
 * @fileoverview Workflow Service Factory
 * 
 * This factory provides singleton instances of workflow services
 * for use throughout the application, especially in non-React contexts.
 */

import { DocumentWorkflowService } from './document-workflow-service'
import { VerificationWorkflowService } from './verification-workflow-service'
import { ReportWorkflowService } from './report-workflow-service'

/**
 * Factory for creating and accessing workflow services
 */
export class WorkflowServiceFactory {
  private static instance: WorkflowServiceFactory
  
  private documentWorkflowServices: Record<string, DocumentWorkflowService> = {}
  private verificationWorkflowServices: Record<string, VerificationWorkflowService> = {}
  private reportWorkflowServices: Record<string, ReportWorkflowService> = {}
  
  private constructor() {}
  
  /**
   * Get the singleton instance of the factory
   */
  public static getInstance(): WorkflowServiceFactory {
    if (!WorkflowServiceFactory.instance) {
      WorkflowServiceFactory.instance = new WorkflowServiceFactory()
    }
    
    return WorkflowServiceFactory.instance
  }
  
  /**
   * Create or get a document workflow service
   */
  public getDocumentWorkflowService(userId?: string, chatId?: string): DocumentWorkflowService {
    const key = this.createKey(userId, chatId)
    
    if (!this.documentWorkflowServices[key]) {
      this.documentWorkflowServices[key] = new DocumentWorkflowService({
        userId,
        chatId
      })
    }
    
    return this.documentWorkflowServices[key]
  }
  
  /**
   * Create or get a verification workflow service
   */
  public getVerificationWorkflowService(userId?: string, chatId?: string): VerificationWorkflowService {
    const key = this.createKey(userId, chatId)
    
    if (!this.verificationWorkflowServices[key]) {
      this.verificationWorkflowServices[key] = new VerificationWorkflowService({
        userId,
        chatId
      })
    }
    
    return this.verificationWorkflowServices[key]
  }
  
  /**
   * Create or get a report workflow service
   */
  public getReportWorkflowService(userId?: string, chatId?: string): ReportWorkflowService {
    const key = this.createKey(userId, chatId)
    
    if (!this.reportWorkflowServices[key]) {
      this.reportWorkflowServices[key] = new ReportWorkflowService({
        userId,
        chatId
      })
    }
    
    return this.reportWorkflowServices[key]
  }
  
  /**
   * Create a unique key for storing services
   */
  private createKey(userId?: string, chatId?: string): string {
    return `${userId || 'anonymous'}_${chatId || 'global'}`
  }
  
  /**
   * Dispose of services for a specific user/chat
   */
  public disposeServices(userId?: string, chatId?: string): void {
    const key = this.createKey(userId, chatId)
    
    if (this.documentWorkflowServices[key]) {
      this.documentWorkflowServices[key].dispose()
      delete this.documentWorkflowServices[key]
    }
    
    if (this.verificationWorkflowServices[key]) {
      this.verificationWorkflowServices[key].dispose()
      delete this.verificationWorkflowServices[key]
    }
    
    if (this.reportWorkflowServices[key]) {
      this.reportWorkflowServices[key].dispose()
      delete this.reportWorkflowServices[key]
    }
  }
  
  /**
   * Dispose of all services
   */
  public disposeAllServices(): void {
    // Dispose document workflow services
    Object.values(this.documentWorkflowServices).forEach(service => {
      service.dispose()
    })
    this.documentWorkflowServices = {}
    
    // Dispose verification workflow services
    Object.values(this.verificationWorkflowServices).forEach(service => {
      service.dispose()
    })
    this.verificationWorkflowServices = {}
    
    // Dispose report workflow services
    Object.values(this.reportWorkflowServices).forEach(service => {
      service.dispose()
    })
    this.reportWorkflowServices = {}
  }
}

// Export a singleton instance
export const workflowServiceFactory = WorkflowServiceFactory.getInstance()

// Convenience functions for getting services
export function getDocumentWorkflowService(userId?: string, chatId?: string): DocumentWorkflowService {
  return workflowServiceFactory.getDocumentWorkflowService(userId, chatId)
}

export function getVerificationWorkflowService(userId?: string, chatId?: string): VerificationWorkflowService {
  return workflowServiceFactory.getVerificationWorkflowService(userId, chatId)
}

export function getReportWorkflowService(userId?: string, chatId?: string): ReportWorkflowService {
  return workflowServiceFactory.getReportWorkflowService(userId, chatId)
}