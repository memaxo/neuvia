import { workflowService } from '@/lib/services/workflow/workflow-service';
import { patientSummaryService } from '@/lib/services/patient/patient-summary-service';
import { verificationService } from '@/lib/services/verification/verification-service';
import { reportService } from '@/lib/services/report/report-service';
import { documentService } from '@/lib/services/document';
import { eventService } from '@/lib/services/event-service';
import { WorkflowStep, ProcessingPhase, DomainOnlyWorkflowStep } from '@/lib/types/workflow';
import { ApplicationError, normalizeError } from '@/lib/errors';
import { EVENT_TYPES } from '@/lib/types/events';
import logger from '@/lib/logger';

import type {
  WorkflowEventPayload,
  DocumentProcessedEventPayload,
  DocumentStatusEventPayload,
  VerificationCompletedEventPayload,
  ResearchCompletedEventPayload,
  ReportGeneratedEventPayload
} from '@/lib/types/events';

/**
 * Workflow Mediator
 *
 * Orchestrates interactions between domain services following the mediator pattern.
 * Manages workflow state transitions and coordinates the diagnostic workflow:
 * Document → Extraction → Verification → Research → Report
 */
export class WorkflowMediator {
  private readonly logger = logger.withMetadata({ module: 'WorkflowMediator' });

  constructor() {
    this.logger.info('WorkflowMediator initialized');
    this.registerEventHandlers();
  }

  private registerEventHandlers(): void {
    // Listen for document processed events
    eventService.subscribe(
      EVENT_TYPES.DOCUMENT_PROCESSED,
      this.handleDocumentProcessed.bind(this)
    );
    
    // Listen for verification events
    eventService.subscribe(
      EVENT_TYPES.VERIFICATION_COMPLETED,
      this.handleVerificationCompleted.bind(this)
    );
    
    // Listen for research events
    eventService.subscribe(
      EVENT_TYPES.RESEARCH_COMPLETED,
      this.handleResearchCompleted.bind(this)
    );
  }

  /**
   * Initiate document processing workflow
   */
  async initiateDocumentProcessing(
    workflowId: string,
    file: File,
    patientId: string,
    options?: Record<string, unknown>
  ): Promise<string> {
    try {
      // Update workflow state
      await workflowService.updateWorkflowState(
        workflowId,
        'extracting' as WorkflowStep,
        {
          phase: ProcessingPhase.EXTRACTION,
          progress: 0,
          fileName: file.name,
          fileSize: file.size,
          patientId
        }
      );

      // Process document with status updates
      const result = await documentService.processDocument(file, {
        patientId,
        onStatusUpdate: (status) => {
          // Update workflow state with status
          workflowService.updateWorkflowState(
            workflowId,
            'extracting' as WorkflowStep,
            {
              phase: status.phase,
              progress: status.progress,
              currentStep: status.currentStep,
              error: status.error
            }
          );

          // Broadcast status update event
          eventService.publish(EVENT_TYPES.DOCUMENT_STATUS, {
            workflowId,
            status
          } as DocumentStatusEventPayload);
        }
      });

      // Publish document processed event
      eventService.publish(EVENT_TYPES.DOCUMENT_PROCESSED, {
        workflowId,
        documentId: result.id,
        patientId,
        document: result
      } as DocumentProcessedEventPayload);

      // Return document ID
      return result.id;
    } catch (error) {
      // Update workflow state to error
      await workflowService.setWorkflowError(
        workflowId,
        error instanceof Error ? error.message : String(error),
        { stage: 'document_processing' }
      );

      // Re-throw error
      throw error;
    }
  }

  /**
   * Initiate verification workflow for an extracted document
   */
  async initiateVerification(
    workflowId: string,
    extractedDocument: Record<string, unknown>,
    messageId?: string
  ): Promise<Record<string, unknown>> {
    try {
      // Update workflow state
      await workflowService.updateWorkflowState(
        workflowId,
        'verification_pending' as WorkflowStep,
        {
          phase: ProcessingPhase.VERIFICATION,
          progress: 0,
          documentId: extractedDocument.id,
          patientId: extractedDocument.patientId
        }
      );

      // Generate verification
      const result = await verificationService.generateVerification({
        document: extractedDocument,
        workflowId,
        messageId,
        summaryId: crypto.randomUUID()
      });

      if (!result.success) {
        throw new ApplicationError({
          message: result.error?.message ?? 'Failed to generate verification',
          code: 'VERIFICATION_GENERATION_FAILED'
        });
      }

      // Update workflow state
      await workflowService.updateWorkflowState(
        workflowId,
        'verification' as WorkflowStep,
        {
          phase: ProcessingPhase.VERIFICATION,
          progress: 50,
          summaryId: result.data.summaryId,
          summary: result.data.summary
        }
      );

      return result.data;
    } catch (error) {
      const normalizedError = normalizeError(error);
      
      // Update workflow state to error
      await workflowService.setWorkflowError(
        workflowId,
        normalizedError.message,
        {
          stage: 'verification_initiation',
          errorCode: normalizedError.code
        }
      );

      // Re-throw error
      throw error;
    }
  }

  /**
   * Process a verification correction
   */
  async processCorrection(
    workflowId: string,
    correctionText: string,
    currentSummary: string,
    messageId?: string
  ): Promise<Record<string, unknown>> {
    try {
      // Update workflow state
      await workflowService.updateWorkflowState(
        workflowId,
        'verification_in_progress' as WorkflowStep,
        {
          phase: ProcessingPhase.CORRECTION,
          progress: 0
        }
      );

      // Process correction
      const result = await verificationService.processCorrection({
        correction: correctionText,
        currentSummary,
        workflowId,
        messageId
      });

      if (!result.success) {
        throw new ApplicationError({
          message: result.error?.message ?? 'Failed to process correction',
          code: 'CORRECTION_PROCESSING_FAILED'
        });
      }

      // Update workflow state
      await workflowService.updateWorkflowState(
        workflowId,
        'verification_in_progress' as WorkflowStep,
        {
          phase: ProcessingPhase.CORRECTION,
          progress: 100,
          summaryId: result.data.summaryId,
          summary: result.data.summary
        }
      );

      return result.data;
    } catch (error) {
      const normalizedError = normalizeError(error);
      
      // Update workflow state to error
      await workflowService.setWorkflowError(
        workflowId,
        normalizedError.message,
        {
          stage: 'correction_processing',
          errorCode: normalizedError.code
        }
      );

      // Re-throw error
      throw error;
    }
  }

  /**
   * Complete verification workflow
   */
  async completeVerification(
    workflowId: string,
    isApproved: boolean,
    options?: { items?: any[]; comments?: string }
  ): Promise<Record<string, unknown>> {
    try {
      // Update workflow state
      await workflowService.updateWorkflowState(
        workflowId,
        'verification_completed' as WorkflowStep,
        {
          phase: ProcessingPhase.VERIFICATION,
          progress: 100,
          isApproved
        }
      );

      // Complete verification
      const result = await verificationService.completeVerification(
        workflowId,
        isApproved,
        options
      );

      if (!result.success) {
        throw new ApplicationError({
          message: result.error?.message ?? 'Failed to complete verification',
          code: 'VERIFICATION_COMPLETION_FAILED'
        });
      }

      // Update workflow state based on verification result
      await workflowService.updateWorkflowState(
        workflowId,
        isApproved ? 'report_generation' as WorkflowStep : 'verification_failed' as WorkflowStep,
        {
          phase: isApproved ? ProcessingPhase.REPORT_GENERATION : ProcessingPhase.VERIFICATION,
          progress: isApproved ? 0 : 100,
          verificationResult: result.data
        }
      );
      
      // Publish verification completed event
      eventService.publish(EVENT_TYPES.VERIFICATION_COMPLETED, {
        workflowId,
        verificationResult: result.data,
        isApproved
      } as VerificationCompletedEventPayload);

      return result.data;
    } catch (error) {
      const normalizedError = normalizeError(error);
      
      // Update workflow state to error
      await workflowService.setWorkflowError(
        workflowId,
        normalizedError.message,
        {
          stage: 'verification_completion',
          errorCode: normalizedError.code
        }
      );

      // Re-throw error
      throw error;
    }
  }

  /**
   * Generate deep research based on verified summary
   */
  async generateResearch(
    workflowId: string,
    patientId: string,
    userId: string
  ): Promise<Record<string, unknown>> {
    try {
      // Update workflow state
      await workflowService.updateWorkflowState(
        workflowId,
        'research' as WorkflowStep,
        {
          phase: ProcessingPhase.RESEARCH,
          progress: 0,
          patientId
        }
      );

      // Get verified summary
      const verifiedSummary = await patientSummaryService.getVerifiedSummary(patientId);
      if (!verifiedSummary) {
        throw new ApplicationError({
          message: 'No verified summary found for patient',
          code: 'VERIFIED_SUMMARY_NOT_FOUND'
        });
      }

      // Generate research
      const researchResult = await patientSummaryService.generateDeepResearchReport(
        patientId,
        userId
      );

      if (!researchResult) {
        throw new ApplicationError({
          message: 'Failed to generate research report',
          code: 'RESEARCH_GENERATION_FAILED'
        });
      }

      // Update workflow state
      await workflowService.updateWorkflowState(
        workflowId,
        'report_generation' as WorkflowStep,
        {
          phase: ProcessingPhase.REPORT_GENERATION,
          progress: 0,
          researchCompleted: true,
          researchTimestamp: new Date().toISOString()
        }
      );

      // Publish research completed event
      eventService.publish(EVENT_TYPES.RESEARCH_COMPLETED, {
        workflowId,
        patientId,
        researchResult
      } as ResearchCompletedEventPayload);

      return researchResult;
    } catch (error) {
      const normalizedError = normalizeError(error);
      
      // Update workflow state to error
      await workflowService.setWorkflowError(
        workflowId,
        normalizedError.message,
        {
          stage: 'research_generation',
          errorCode: normalizedError.code
        }
      );

      // Re-throw error
      throw error;
    }
  }

  /**
   * Generate medical report
   */
  async generateReport(
    workflowId: string,
    patientId: string,
    researchResult: Record<string, unknown>,
    options?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      // Update workflow state
      await workflowService.updateWorkflowState(
        workflowId,
        'report_generation' as WorkflowStep,
        {
          phase: ProcessingPhase.REPORT_GENERATION,
          progress: 50,
          patientId
        }
      );

      // Generate report
      const reportData = await reportService.generateMedicalDiagnosisReport(
        researchResult as any,
        patientId,
        {
          contextData: options,
          onProgress: (phase, progress) => {
            // Update workflow with progress
            workflowService.updateWorkflowState(
              workflowId,
              'report_generation' as WorkflowStep,
              {
                phase,
                progress: 50 + (progress / 2), // Scale to 50-100%
              }
            );
          }
        }
      );

      // Update workflow state
      await workflowService.updateWorkflowState(
        workflowId,
        'report_presentation' as WorkflowStep,
        {
          phase: ProcessingPhase.COMPLETION,
          progress: 100,
          reportId: reportData.report.id,
          reportTitle: reportData.report.title,
          reportGeneratedAt: reportData.report.metadata.generatedAt
        }
      );

      // Publish report generated event
      eventService.publish(EVENT_TYPES.REPORT_GENERATED, {
        workflowId,
        patientId,
        reportId: reportData.report.id,
        reportData
      } as ReportGeneratedEventPayload);

      return reportData;
    } catch (error) {
      const normalizedError = normalizeError(error);
      
      // Update workflow state to error
      await workflowService.setWorkflowError(
        workflowId,
        normalizedError.message,
        {
          stage: 'report_generation',
          errorCode: normalizedError.code
        }
      );

      // Re-throw error
      throw error;
    }
  }

  /**
   * Format report in specific format
   */
  async formatReport(
    workflowId: string,
    reportData: Record<string, unknown>,
    format: string
  ): Promise<string> {
    try {
      // Format the report
      const formattedReport = await reportService.formatReportOutput(
        reportData as any,
        format
      );

      // Update workflow state
      await workflowService.updateWorkflowState(
        workflowId,
        'complete' as WorkflowStep,
        {
          phase: ProcessingPhase.COMPLETION,
          progress: 100,
          reportFormatted: true,
          reportFormat: format,
          formattedAt: new Date().toISOString()
        }
      );

      return formattedReport;
    } catch (error) {
      const normalizedError = normalizeError(error);
      
      // Update workflow state to error
      await workflowService.setWorkflowError(
        workflowId,
        normalizedError.message,
        {
          stage: 'report_formatting',
          errorCode: normalizedError.code
        }
      );

      // Re-throw error
      throw error;
    }
  }

  /**
   * Event handler for document processed events
   */
  private async handleDocumentProcessed(payload: DocumentProcessedEventPayload): Promise<void> {
    const { workflowId, documentId, patientId, document } = payload;
    this.logger.info('Document processed, initiating verification', {
      workflowId, documentId, patientId
    });

    try {
      // Auto-initiate verification for the document
      await this.initiateVerification(workflowId, document);
    } catch (error) {
      this.logger.error('Error automatically initiating verification after document processing', {
        workflowId, documentId, patientId
      }, error);
    }
  }

  /**
   * Event handler for verification completed events
   */
  private async handleVerificationCompleted(payload: VerificationCompletedEventPayload): Promise<void> {
    const { workflowId, verificationResult, isApproved } = payload;
    
    // Only proceed with research for approved verifications
    if (!isApproved) {
      this.logger.info('Verification not approved, stopping workflow', { workflowId });
      return;
    }

    const patientId = verificationResult.patientId || payload.patientId;
    if (!patientId) {
      this.logger.error('No patient ID found in verification result', { workflowId });
      return;
    }

    this.logger.info('Verification approved, auto-initiating research', {
      workflowId, patientId
    });

    try {
      // Auto-initiate research
      await this.generateResearch(workflowId, patientId, 'system');
    } catch (error) {
      this.logger.error('Error automatically initiating research after verification', {
        workflowId, patientId
      }, error);
    }
  }

  /**
   * Event handler for research completed events
   */
  private async handleResearchCompleted(payload: ResearchCompletedEventPayload): Promise<void> {
    const { workflowId, patientId, researchResult } = payload;
    
    this.logger.info('Research completed, auto-initiating report generation', {
      workflowId, patientId
    });

    try {
      // Auto-initiate report generation
      await this.generateReport(workflowId, patientId, researchResult);
    } catch (error) {
      this.logger.error('Error automatically initiating report generation after research', {
        workflowId, patientId
      }, error);
    }
  }
}

// Singleton instance
export const workflowMediator = new WorkflowMediator();