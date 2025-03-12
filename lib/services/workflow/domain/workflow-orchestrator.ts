/**
 * @fileoverview Workflow Orchestrator
 * 
 * Coordinates high-level workflow operations across domains:
 * - Manages end-to-end processes that span multiple domains
 * - Handles workflow transitions between domains
 * - Processes events to trigger appropriate workflows
 */

import { ApplicationError, normalizeError } from '@/lib/errors'
import logger from '@/lib/logger'
import { workflowRepository } from '../infrastructure/workflow-repository'
import { workflowStateManager } from '../infrastructure/workflow-state-manager'
import { workflowEventSourcing } from '../infrastructure/workflow-event-source'
import { workflowTransactionManager } from '../workflow-transaction-manager'

import { documentWorkflow } from './document-workflow'
import { verificationWorkflow } from './verification-workflow'
import { reportWorkflow } from './report-workflow'
import { researchWorkflow } from './research-workflow'
import { chatWorkflow } from './chat-workflow'

import type { WorkflowStep, ProcessingPhase } from '@/lib/types/workflow'
import type { DocumentProcessingResult } from './document-workflow'
import type { VerificationResult } from './verification-workflow'
import type { ReportGenerationResult } from './report-workflow'
import type { ResearchResult } from './research-workflow'
import type { ChatSessionResult } from './chat-workflow'

/**
 * End-to-end processing result
 */
export interface EndToEndResult {
  /** Workflow ID */
  workflowId: string;
  /** Document ID if document was processed */
  documentId?: string;
  /** Verification ID if verification was performed */
  verificationId?: string;
  /** Report ID if report was generated */
  reportId?: string;
  /** Whether the process was successful */
  success: boolean;
  /** Current workflow state */
  currentState?: string;
  /** Workflow metadata */
  metadata: Record<string, unknown>;
  /** Error message if process failed */
  error?: string;
}

/**
 * Event payload interfaces
 */
export interface DocumentProcessedEventPayload {
  workflowId: string;
  documentId: string;
  success: boolean;
  metadata: Record<string, unknown>;
}

export interface VerificationCompletedEventPayload {
  workflowId: string;
  documentId: string;
  verificationId: string;
  success: boolean;
  metadata: Record<string, unknown>;
}

export interface ReportGeneratedEventPayload {
  workflowId: string;
  documentId?: string;
  reportId: string;
  success: boolean;
  metadata: Record<string, unknown>;
}

/**
 * Options for end-to-end document processing
 */
export interface DocumentToReportOptions {
  /** User ID */
  userId: string;
  /** Patient ID */
  patientId?: string;
  /** Document type */
  documentType?: string;
  /** Whether to auto-verify after extraction */
  autoVerify?: boolean;
  /** Whether to auto-generate report after verification */
  autoGenerateReport?: boolean;
  /** Progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase, step: string) => void;
  /** Transaction ID for tracking */
  transactionId?: string;
}

/**
 * Workflow orchestrator for coordinating multi-domain processes
 */
export class WorkflowOrchestrator {
  private readonly logger = logger.withMetadata({ module: 'WorkflowOrchestrator' });
  
  /**
   * Process document to completion (upload → extract → verify → report)
   */
  async processDocumentToCompletion(
    workflowId: string,
    file: File,
    options: DocumentToReportOptions
  ): Promise<EndToEndResult> {
    try {
      const transactionId = options.transactionId || crypto.randomUUID();
      
      // Initialize result tracking
      let documentResult: DocumentProcessingResult | null = null;
      let verificationResult: VerificationResult | null = null;
      let reportResult: ReportGenerationResult | null = null;
      
      // Set up progress tracking
      const progressCallback = options.onProgress || (() => {});
      
      // Step 1: Process document upload and extraction
      progressCallback(10, ProcessingPhase.UPLOAD, 'Uploading document');
      
      documentResult = await documentWorkflow.processUpload(
        workflowId,
        file,
        {
          userId: options.userId,
          patientId: options.patientId,
          documentType: options.documentType,
          autoExtract: true,
          onProgress: (progress, phase) => {
            // Map progress to overall progress (upload+extract = 0-30%)
            const overallProgress = progress * 0.3;
            progressCallback(overallProgress, phase, 'Processing document');
          },
          transactionId
        }
      );
      
      if (!documentResult.success) {
        throw new Error(`Document processing failed: ${documentResult.error}`);
      }
      
      // Step 2: Verification (if automatic verification is enabled)
      if (options.autoVerify) {
        progressCallback(35, ProcessingPhase.VERIFICATION_PENDING, 'Initiating verification');
        
        verificationResult = await verificationWorkflow.initiateVerification(
          workflowId,
          {
            userId: options.userId,
            documentId: documentResult.documentId,
            documentData: documentResult.metadata,
            autoGenerateReport: options.autoGenerateReport,
            onProgress: (progress, phase) => {
              // Map progress to overall progress (verification = 30-60%)
              const overallProgress = 30 + (progress * 0.3);
              progressCallback(overallProgress, phase, 'Verifying document');
            },
            transactionId
          }
        );
        
        if (!verificationResult.success) {
          throw new Error(`Verification failed: ${verificationResult.error}`);
        }
        
        // After verification is initiated, complete it (simulating user verification)
        progressCallback(50, ProcessingPhase.VERIFICATION_COMPLETION, 'Completing verification');
        
        verificationResult = await verificationWorkflow.completeVerification(
          workflowId,
          verificationResult.verificationId,
          options.userId,
          options.autoGenerateReport
        );
        
        if (!verificationResult.success) {
          throw new Error(`Verification completion failed: ${verificationResult.error}`);
        }
      }
      
      // Step 3: Report generation (if automatic report generation is enabled)
      if (options.autoGenerateReport) {
        progressCallback(70, ProcessingPhase.REPORT_GENERATION, 'Generating report');
        
        reportResult = await reportWorkflow.generateReport(
          workflowId,
          {
            userId: options.userId,
            documentId: documentResult.documentId,
            patientId: options.patientId,
            verificationId: verificationResult?.verificationId,
            autoComplete: true,
            onProgress: (progress, phase) => {
              // Map progress to overall progress (report = 60-100%)
              const overallProgress = 60 + (progress * 0.4);
              progressCallback(overallProgress, phase, 'Generating report');
            },
            transactionId
          }
        );
        
        if (!reportResult.success) {
          throw new Error(`Report generation failed: ${reportResult.error}`);
        }
      }
      
      // Final progress update
      progressCallback(100, ProcessingPhase.COMPLETION, 'Process completed');
      
      // Get final workflow state
      const finalState = await workflowRepository.getWorkflowState(workflowId);
      
      // Return end-to-end result
      return {
        workflowId,
        documentId: documentResult.documentId,
        verificationId: verificationResult?.verificationId,
        reportId: reportResult?.reportId,
        success: true,
        currentState: finalState?.currentStep,
        metadata: {
          documentMetadata: documentResult.metadata,
          verificationMetadata: verificationResult?.metadata,
          reportMetadata: reportResult?.metadata,
          completedAt: new Date().toISOString(),
          userId: options.userId,
          patientId: options.patientId
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('End-to-end document processing failed', {
        workflowId,
        fileName: file.name,
        error: normalizedError.message
      });
      
      // Handle error by setting workflow to error state
      await workflowStateManager.handleError(
        workflowId,
        normalizedError,
        'error',
        {
          fileName: file.name,
          userId: options.userId,
          patientId: options.patientId
        }
      );
      
      // Return error result
      return {
        workflowId,
        success: false,
        metadata: {},
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Process patient interactions through chat and research
   */
  async processChatAndResearch(
    workflowId: string,
    chatId: string,
    userId: string,
    patientId: string,
    initialMessage?: string
  ): Promise<EndToEndResult> {
    try {
      // Step 1: Initialize chat session
      let chatResult = await chatWorkflow.startChatSession(
        workflowId,
        chatId,
        userId,
        {
          patientId,
          startedAt: new Date().toISOString()
        }
      );
      
      if (!chatResult.success) {
        throw new Error(`Failed to start chat session: ${chatResult.error}`);
      }
      
      // Step 2: Process initial message if provided
      if (initialMessage) {
        chatResult = await chatWorkflow.processMessage(
          workflowId,
          chatId,
          initialMessage,
          {
            userId,
            patientId,
            model: 'gpt-4'
          }
        );
        
        if (!chatResult.success) {
          throw new Error(`Failed to process initial message: ${chatResult.error}`);
        }
      }
      
      // Get final workflow state
      const finalState = await workflowRepository.getWorkflowState(workflowId);
      
      // Return result
      return {
        workflowId,
        success: true,
        currentState: finalState?.currentStep,
        metadata: {
          chatId,
          userId,
          patientId,
          messageCount: chatResult.messages?.length || 0,
          startedAt: new Date().toISOString()
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Chat and research processing failed', {
        workflowId,
        chatId,
        userId,
        patientId,
        error: normalizedError.message
      });
      
      // Handle error in chat session
      await chatWorkflow.handleChatError(
        workflowId,
        chatId,
        normalizedError,
        {
          userId,
          patientId
        }
      );
      
      // Return error result
      return {
        workflowId,
        success: false,
        metadata: {
          chatId,
          userId,
          patientId
        },
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Handle document processed event
   */
  async handleDocumentProcessed(payload: DocumentProcessedEventPayload): Promise<void> {
    try {
      const { workflowId, documentId, success, metadata } = payload;
      
      if (!success) {
        this.logger.warn('Document processing failed - skipping next steps', {
          workflowId,
          documentId
        });
        return;
      }
      
      // Get current workflow state
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state) {
        this.logger.warn('Workflow state not found - skipping event handling', {
          workflowId,
          documentId
        });
        return;
      }
      
      // Check if auto-verification is enabled in metadata
      const autoVerify = metadata.autoVerify === true || state.metadata?.autoVerify === true;
      
      if (autoVerify) {
        // Get user ID from metadata or state
        const userId = metadata.userId || state.metadata?.userId;
        
        if (!userId) {
          this.logger.warn('User ID not found - skipping auto-verification', {
            workflowId,
            documentId
          });
          return;
        }
        
        // Initiate verification
        await verificationWorkflow.initiateVerification(
          workflowId,
          {
            userId: userId as string,
            documentId,
            documentData: metadata
          }
        );
        
        this.logger.info('Auto-verification initiated', {
          workflowId,
          documentId
        });
      }
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to handle document processed event', {
        payload,
        error: normalizedError.message
      });
    }
  }
  
  /**
   * Handle verification completed event
   */
  async handleVerificationCompleted(payload: VerificationCompletedEventPayload): Promise<void> {
    try {
      const { workflowId, documentId, verificationId, success, metadata } = payload;
      
      if (!success) {
        this.logger.warn('Verification failed - skipping next steps', {
          workflowId,
          documentId,
          verificationId
        });
        return;
      }
      
      // Get current workflow state
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state) {
        this.logger.warn('Workflow state not found - skipping event handling', {
          workflowId,
          documentId,
          verificationId
        });
        return;
      }
      
      // Check if auto-report generation is enabled in metadata
      const autoGenerateReport = metadata.autoGenerateReport === true || 
                               state.metadata?.autoGenerateReport === true;
      
      if (autoGenerateReport) {
        // Get user ID and patient ID from metadata or state
        const userId = metadata.userId || state.metadata?.userId;
        const patientId = metadata.patientId || state.metadata?.patientId;
        
        if (!userId) {
          this.logger.warn('User ID not found - skipping auto-report generation', {
            workflowId,
            documentId,
            verificationId
          });
          return;
        }
        
        // Generate report
        await reportWorkflow.generateReport(
          workflowId,
          {
            userId: userId as string,
            documentId,
            patientId: patientId as string,
            verificationId,
            autoComplete: true
          }
        );
        
        this.logger.info('Auto-report generation initiated', {
          workflowId,
          documentId,
          verificationId
        });
      }
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to handle verification completed event', {
        payload,
        error: normalizedError.message
      });
    }
  }
  
  /**
   * Handle report generated event
   */
  async handleReportGenerated(payload: ReportGeneratedEventPayload): Promise<void> {
    try {
      const { workflowId, documentId, reportId, success, metadata } = payload;
      
      if (!success) {
        this.logger.warn('Report generation failed - skipping next steps', {
          workflowId,
          documentId,
          reportId
        });
        return;
      }
      
      // Get current workflow state
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state) {
        this.logger.warn('Workflow state not found - skipping event handling', {
          workflowId,
          documentId,
          reportId
        });
        return;
      }
      
      // Check if auto-complete is enabled in metadata
      const autoComplete = metadata.autoComplete === true || 
                         state.metadata?.autoComplete === true;
      
      if (autoComplete) {
        // Complete workflow
        await workflowStateManager.completeWorkflow(
          workflowId,
          {
            reportId,
            documentId,
            completedAt: new Date().toISOString(),
            completedBy: metadata.userId || state.metadata?.userId
          }
        );
        
        this.logger.info('Workflow auto-completed after report generation', {
          workflowId,
          documentId,
          reportId
        });
      }
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to handle report generated event', {
        payload,
        error: normalizedError.message
      });
    }
  }
  
  /**
   * Handle research request from chat
   */
  async handleResearchRequest(
    workflowId: string,
    query: string,
    chatId: string,
    userId: string,
    options: {
      patientId?: string;
      documentId?: string;
      includeCitations?: boolean;
      autoGenerateReport?: boolean;
    } = {}
  ): Promise<ResearchResult> {
    try {
      // Get current workflow state
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state) {
        throw new Error('Workflow state not found');
      }
      
      // Execute research query
      const researchResult = await researchWorkflow.executeResearch(
        workflowId,
        {
          userId,
          query,
          patientId: options.patientId,
          documentId: options.documentId,
          includeCitations: options.includeCitations,
          autoGenerateReport: options.autoGenerateReport
        }
      );
      
      if (!researchResult.success) {
        // Handle research error in chat
        await chatWorkflow.processMessage(
          workflowId,
          chatId,
          `I couldn't complete the research you requested: ${researchResult.error}`,
          {
            userId,
            role: 'system',
            model: 'gpt-4'
          }
        );
        
        throw new Error(`Research failed: ${researchResult.error}`);
      }
      
      // Process research result in chat
      await chatWorkflow.processMessage(
        workflowId,
        chatId,
        `Here are my research findings for "${query}":\n\n${researchResult.content}`,
        {
          userId,
          role: 'assistant',
          model: 'gpt-4'
        }
      );
      
      return researchResult;
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Research request handling failed', {
        workflowId,
        chatId,
        query,
        error: normalizedError.message
      });
      
      // Return error result
      return {
        researchId: '',
        query,
        success: false,
        metadata: {},
        error: normalizedError.message
      };
    }
  }
}

// Export singleton instance
export const workflowOrchestrator = new WorkflowOrchestrator();