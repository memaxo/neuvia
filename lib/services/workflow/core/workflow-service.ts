import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { WorkflowStep, ProcessingPhase } from '@/lib/types/workflow'
import { ApplicationError, normalizeError } from '@/lib/errors'
import { workflowManager } from './workflow-manager'
import logger from '@/lib/logger'
import { Result } from '@/lib/services/workflow/error/result'
import { WorkflowStepMapper } from '../utils/workflow-utils'

/**
 * Options for document processing
 */
export interface DocumentProcessingOptions {
  userId: string;
  patientId?: string;
  documentType?: string;
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
}

/**
 * Result of document processing
 */
export interface DocumentProcessingResult {
  documentId: string;
  fileName?: string;
  fileSize?: number;
  content?: string;
  metadata?: Record<string, unknown>;
  success: boolean;
  processingTime?: number;
  error?: string;
}

/**
 * Options for report generation
 */
export interface ReportGenerationOptions {
  userId: string;
  patientId?: string;
  documentId?: string;
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
}

/**
 * Result of report generation
 */
export interface ReportGenerationResult {
  reportId?: string;
  title?: string;
  content?: string;
  documentId?: string;
  patientId?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
  error?: string;
}

/**
 * Options for verification
 */
export interface VerificationOptions {
  userId: string;
  documentId?: string;
  documentText?: string;
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
}

/**
 * Result of verification
 */
export interface VerificationResult {
  verificationId?: string;
  documentId?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
  error?: string;
}

/**
 * Correction data for verification
 */
export interface CorrectionData {
  correctionText: string;
  currentSummary: string;
  userId: string;
  messageId?: string;
}

/**
 * Simplified workflow service for common operations
 */
export class WorkflowService {
  private readonly logger = logger.withMetadata({ module: 'WorkflowService' });
  
  /**
   * Update workflow progress
   */
  async updateProgress(
    workflowId: string,
    progress: number,
    phase: ProcessingPhase,
    currentStep?: WorkflowStep,
    notifyUsers: boolean = false
  ): Promise<Result<boolean>> {
    if (!workflowId) {
      return Result.failure(
        'workflowId is required',
        'WORKFLOW_PROGRESS_UPDATE_FAILED',
        { workflowId, progress, phase: phase.toString() }
      );
    }
    
    try {
      const updateResult = await workflowManager.updateProgress(
        workflowId,
        progress,
        phase,
        { 
          currentStep,
          notifyUsers 
        }
      );
      
      if (updateResult.isFailure()) {
        return updateResult;
      }
      
      return Result.success(true);
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to update progress', {
        workflowId,
        progress,
        phase: phase.toString(),
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to update progress: ${normalizedError.message}`,
        normalizedError.code || 'WORKFLOW_PROGRESS_UPDATE_FAILED',
        { workflowId, progress, phase: phase.toString() }
      );
    }
  }
  
  /**
   * Process document upload.
   * Standardizes state updates using local constants for domain steps.
   * Uses the Result pattern consistently.
   * @returns Result containing document processing result.
   */
  async processDocumentUpload(
    workflowId: string,
    file: File,
    options: DocumentProcessingOptions
  ): Promise<Result<DocumentProcessingResult>> {
    try {
      // Standardize state update: define domain step constant
      const uploadingStep: WorkflowStep = 'uploading';
      const now = new Date().toISOString();
      const updateResult = await workflowManager.updateState(
        workflowId,
        uploadingStep,
        {
          fileName: file.name,
          fileSize: file.size,
          uploadStartedAt: now,
          userId: options.userId,
          patientId: options.patientId
        }
      );
      
      if (updateResult.isFailure()) {
        return Result.failure(
          updateResult.error.message,
          updateResult.error.code,
          { ...updateResult.error.details, fileName: file.name, fileSize: file.size }
        );
      }
      
      // Track progress
      const onProgress = options.onProgress || (() => {});
      onProgress(10, ProcessingPhase.UPLOAD);
      
      // Perform upload using FormData
      const formData = new FormData();
      formData.append('file', file);
      if (options.patientId) {
        formData.append('patientId', options.patientId);
      }
      if (options.documentType) {
        formData.append('documentType', options.documentType);
      }
      
      const startTime = Date.now();
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        // Update to error state
        await workflowManager.handleError(
          workflowId,
          new Error(`Upload failed: ${errorText}`),
          'error',
          {
            fileName: file.name,
            fileSize: file.size,
            userId: options.userId
          }
        );
        
        return Result.failure(
          `Upload failed: ${errorText}`,
          'DOCUMENT_UPLOAD_FAILED',
          { fileName: file.name, fileSize: file.size }
        );
      }
      
      const result = await response.json();
      const documentId = result.documentId;
      const processingTime = Date.now() - startTime;
      
      // Standardize state update: define extracting step constant
      const extractingStep: WorkflowStep = 'extracting';
      const extractingResult = await workflowManager.updateState(
        workflowId,
        extractingStep,
        {
          documentId,
          uploadTime: processingTime,
          uploadCompletedAt: new Date().toISOString()
        }
      );
      
      if (extractingResult.isFailure()) {
        return Result.failure(
          extractingResult.error.message,
          extractingResult.error.code,
          { ...extractingResult.error.details, documentId, fileName: file.name }
        );
      }
      
      // Successful upload
      return Result.success({
        documentId,
        fileName: file.name,
        fileSize: file.size,
        success: true,
        processingTime
      });
    } catch (err) {
      const normalizedError = normalizeError(err);
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'DOCUMENT_UPLOAD_FAILED',
        { documentId: '', fileName: file.name, fileSize: file.size }
      );
    }
  }
  
  /**
   * Extract document content.
   * Uses standardized state updates for 'extracting' and 'complete' steps.
   */
  async extractDocumentContent(
    workflowId: string,
    documentId: string,
    options?: {
      userId?: string;
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
    }
  ): Promise<Result<DocumentProcessingResult>> {
    try {
      // Standardize state update: define extracting step constant
      const extractingStep: WorkflowStep = 'extracting';
      const updateResult = await workflowManager.updateState(
        workflowId,
        extractingStep,
        {
          documentId,
          extractionStartedAt: new Date().toISOString(),
          userId: options?.userId
        }
      );
      
      if (updateResult.isFailure()) {
        return Result.failure(
          updateResult.error.message,
          updateResult.error.code,
          { ...updateResult.error.details, documentId }
        );
      }
      
      // Track progress
      const onProgress = options?.onProgress || (() => {});
      onProgress(30, ProcessingPhase.EXTRACTION);
      
      // Call extraction API
      const startTime = Date.now();
      
      const response = await fetch(`/api/documents/${documentId}/extract`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        await workflowManager.handleError(
          workflowId,
          new Error(`Extraction failed: ${errorText}`),
          'error',
          {
            documentId,
            phase: ProcessingPhase.EXTRACTION
          }
        );
        return Result.failure(
          `Extraction failed: ${errorText}`,
          'DOCUMENT_EXTRACTION_FAILED',
          { documentId }
        );
      }
      
      const result = await response.json();
      const processingTime = Date.now() - startTime;
      
      // Standardize state update: define complete step constant
      const completeStep: WorkflowStep = 'complete';
      const completeResult = await workflowManager.updateState(
        workflowId,
        completeStep,
        {
          documentId,
          extractionTime: processingTime,
          extractionCompletedAt: new Date().toISOString()
        }
      );
      
      if (completeResult.isFailure()) {
        return Result.failure(
          completeResult.error.message,
          completeResult.error.code,
          { ...completeResult.error.details, documentId }
        );
      }
      
      onProgress(100, ProcessingPhase.COMPLETION);
      
      return Result.success({
        documentId,
        content: result.text,
        metadata: result.data,
        success: true,
        processingTime
      });
    } catch (err) {
      const normalizedError = normalizeError(err);
      await workflowManager.handleError(
        workflowId,
        normalizedError,
        'error',
        {
          documentId,
          phase: ProcessingPhase.EXTRACTION
        }
      );
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'DOCUMENT_EXTRACTION_FAILED',
        { documentId, success: false }
      );
    }
  }
  
  /**
   * Initialize verification process.
   * Uses standardized state updates with 'verification_pending' and 'verification_in_progress' steps.
   */
  async initiateVerification(
    workflowId: string,
    options: VerificationOptions
  ): Promise<VerificationResult> {
    try {
      // Standardize state update: define verification_pending step constant
      const verificationPendingStep: WorkflowStep = 'verification_pending';
      await workflowManager.updateState(
        workflowId,
        verificationPendingStep,
        {
          documentId: options.documentId,
          userId: options.userId,
          verificationStartedAt: new Date().toISOString()
        }
      );
      
      // Track progress
      const onProgress = options.onProgress || (() => {});
      onProgress(10, ProcessingPhase.VERIFICATION_PENDING);
      
      if (options.documentText) {
        const response = await fetch('/api/verification/initiate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: options.documentText,
            documentId: options.documentId
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Verification initialization failed: ${errorText}`);
        }
        
        const result = await response.json();
        const verificationId = result.summaryId;
        
        // Standardize state update: define verification_in_progress step constant
        const verificationInProgressStep: WorkflowStep = 'verification_in_progress';
        await workflowManager.updateState(
          workflowId,
          verificationInProgressStep,
          {
            verificationId,
            documentId: options.documentId,
            summary: result.summary,
            summaryGenerated: true,
            verificationMetadata: result.metadata
          }
        );
        
        onProgress(100, ProcessingPhase.VERIFICATION_PENDING);
        
        return {
          verificationId,
          documentId: options.documentId,
          success: true,
          metadata: {
            summary: result.summary
          }
        };
      } else if (options.documentId) {
        await workflowManager.updateState(
          workflowId,
          verificationPendingStep,
          {
            documentId: options.documentId,
            awaitingDocument: true
          }
        );
        
        return {
          documentId: options.documentId,
          success: true,
          metadata: {
            status: 'pending'
          }
        };
      } else {
        throw new Error('Either documentText or documentId must be provided');
      }
    } catch (err) {
      const normalizedError = normalizeError(err);
      await workflowManager.handleError(
        workflowId,
        normalizedError,
        'error',
        {
          documentId: options.documentId,
          phase: ProcessingPhase.VERIFICATION
        }
      );
      return {
        documentId: options.documentId,
        success: false,
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Process verification correction.
   * Uses standardized state update with 'verification_in_progress' step.
   */
  async processVerificationCorrection(
    workflowId: string,
    correction: CorrectionData
  ): Promise<VerificationResult> {
    try {
      if (!correction.correctionText || !correction.currentSummary) {
        throw new Error('Correction text and current summary are required');
      }
      
      const stateResult = await workflowManager.getState(workflowId);
      if (stateResult.isFailure() || !stateResult.value) {
        throw new Error('Workflow state not found');
      }
      
      const verificationId = stateResult.value.metadata?.verificationId as string;
      const documentId = stateResult.value.metadata?.documentId as string;
      
      const response = await fetch('/api/verification/correct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          correctionText: correction.correctionText,
          currentSummary: correction.currentSummary,
          verificationId,
          messageId: correction.messageId
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Correction processing failed: ${errorText}`);
      }
      
      const result = await response.json();
      const currentCorrectionCount = (stateResult.value.metadata?.correctionCount as number) || 0;
      
      const verificationInProgressStep: WorkflowStep = 'verification_in_progress';
      await workflowManager.updateState(
        workflowId,
        verificationInProgressStep,
        {
          verificationId,
          documentId,
          summary: result.summary,
          correctionCount: currentCorrectionCount + 1,
          correctionTimestamp: new Date().toISOString()
        }
      );
      
      return {
        verificationId,
        documentId,
        success: true,
        metadata: {
          summary: result.summary,
          correctionCount: currentCorrectionCount + 1
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Verification correction failed', {
        workflowId,
        error: normalizedError.message
      });
      return {
        success: false,
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Complete verification.
   * Uses standardized state update with 'verification_completed' step.
   */
  async completeVerification(
    workflowId: string,
    verifiedBy: string
  ): Promise<VerificationResult> {
    try {
      const stateResult = await workflowManager.getState(workflowId);
      if (stateResult.isFailure() || !stateResult.value) {
        throw new Error('Workflow state not found');
      }
      
      const verificationId = stateResult.value.metadata?.verificationId as string;
      const documentId = stateResult.value.metadata?.documentId as string;
      
      if (!verificationId) {
        throw new Error('Verification ID not found in workflow state');
      }
      
      const verificationCompletedStep: WorkflowStep = 'verification_completed';
      await workflowManager.updateState(
        workflowId,
        verificationCompletedStep,
        {
          verificationId,
          documentId,
          verifiedBy,
          verifiedAt: new Date().toISOString()
        }
      );
      
      return {
        verificationId,
        documentId,
        success: true,
        metadata: {
          verifiedBy,
          verifiedAt: new Date().toISOString(),
          status: 'completed'
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      await workflowManager.handleError(
        workflowId,
        normalizedError,
        'error',
        {
          phase: ProcessingPhase.VERIFICATION_COMPLETION
        }
      );
      return {
        success: false,
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Generate report.
   * Uses standardized state update with 'report_generation' and 'complete' steps.
   */
  async generateReport(
    workflowId: string,
    options: ReportGenerationOptions
  ): Promise<ReportGenerationResult> {
    try {
      const reportGenerationStep: WorkflowStep = 'report_generation';
      await workflowManager.updateState(
        workflowId,
        reportGenerationStep,
        {
          documentId: options.documentId,
          patientId: options.patientId,
          userId: options.userId,
          reportGenerationStartedAt: new Date().toISOString()
        }
      );
      
      const onProgress = options.onProgress || (() => {});
      onProgress(10, ProcessingPhase.REPORT_GENERATION);
      
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patientId: options.patientId,
          documentId: options.documentId,
          format: 'markdown'
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Report generation failed: ${errorText}`);
      }
      
      const result = await response.json();
      const reportId = result.reportId;
      
      const completeStep: WorkflowStep = 'complete';
      await workflowManager.updateState(
        workflowId,
        completeStep,
        {
          reportId,
          documentId: options.documentId,
          patientId: options.patientId,
          reportGenerationCompletedAt: new Date().toISOString()
        }
      );
      
      onProgress(100, ProcessingPhase.COMPLETION);
      
      return {
        reportId,
        title: result.title,
        content: result.content,
        documentId: options.documentId,
        patientId: options.patientId,
        success: true
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      await workflowManager.handleError(
        workflowId,
        normalizedError,
        'error',
        {
          documentId: options.documentId,
          patientId: options.patientId,
          phase: ProcessingPhase.REPORT_GENERATION
        }
      );
      return {
        documentId: options.documentId,
        patientId: options.patientId,
        success: false,
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Format report.
   * Uses standardized state update with 'complete' step.
   */
  async formatReport(
    workflowId: string,
    reportId: string,
    format: string
  ): Promise<ReportGenerationResult> {
    try {
      if (!reportId) {
        throw new Error('Report ID is required');
      }
      
      const response = await fetch(`/api/reports/${reportId}/format`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ format })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Report formatting failed: ${errorText}`);
      }
      
      const result = await response.json();
      
      const completeStep: WorkflowStep = 'complete';
      await workflowManager.updateState(
        workflowId,
        completeStep,
        {
          reportId,
          format,
          formattedAt: new Date().toISOString()
        }
      );
      
      return {
        reportId,
        title: result.title,
        content: result.content,
        success: true
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Report formatting failed', {
        workflowId,
        reportId,
        format,
        error: normalizedError.message
      });
      return {
        reportId,
        success: false,
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Get workflow state.
   */
  async getWorkflowState(
    workflowId: string
  ): Promise<{
    currentStep: WorkflowStep
    progress: number
    error?: string | null
    phase?: string
    metadata?: Record<string, unknown>
    timestamp: string
  } | null> {
    try {
      if (!workflowId) return null;
      return await workflowManager.getState(workflowId);
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to get workflow state', {
        workflowId,
        error: normalizedError.message
      });
      return null;
    }
  }
  
  /**
   * Get or create workflow for user.
   */
  async getOrCreateWorkflowForUser(
    userId: string,
    chatId: string | null,
    initialStep?: WorkflowStep,
    initialMetadata?: Record<string, unknown>
  ): Promise<Result<{ id: string; data: Record<string, unknown> }>> {
    if (!userId) {
      return Result.failure(
        'userId is required',
        'WORKFLOW_INVALID_PARAMS',
        { userId, chatId }
      );
    }
    
    try {
      const result = await workflowManager.getOrCreateForUser(
        userId,
        chatId,
        initialStep,
        initialMetadata
      );
      
      if (result.isFailure()) {
        return Result.failure(
          result.error.message,
          result.error.code,
          result.error.details
        );
      }
      
      const { id, state } = result.value;
      
      return Result.success({
        id,
        data: {
          id,
          current_step: state.currentStep,
          progress: state.progress,
          error: state.error,
          phase: state.phase,
          metadata: state.metadata,
          timestamp: state.timestamp
        }
      });
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to get or create workflow for user', {
        userId,
        chatId,
        error: normalizedError.message
      });
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'WORKFLOW_GET_OR_CREATE_FAILED',
        { userId, chatId }
      );
    }
  }
  
  /**
   * Load workflow state for user.
   */
  async loadWorkflowStateForUser(userId: string, chatId?: string | null) {
    if (!userId) {
      return Result.failure(
        'userId is required',
        'WORKFLOW_INVALID_PARAMS',
        { userId, chatId }
      );
    }
    
    try {
      const result = await workflowManager.loadStateForUser(userId, chatId);
      return result;
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to load workflow state for user', {
        userId,
        chatId,
        error: normalizedError.message
      });
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'WORKFLOW_LOAD_FAILED',
        { userId, chatId }
      );
    }
  }
  
  /**
   * Subscribe to workflow for user.
   */
  subscribeToWorkflowForUser(
    userId: string,
    chatId: string | null,
    onUpdate: (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => void,
    onStatusChange?: (status: string) => void
  ): RealtimeChannel {
    return workflowManager.subscribeToWorkflowForUser(
      userId,
      chatId,
      onUpdate,
      { onStatusChange }
    );
  }
  
  /**
   * Subscribe to workflow changes.
   */
  subscribeToWorkflowChanges(
    workflowId: string,
    onUpdate: (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => void,
    onStatusChange?: (status: string) => void
  ): RealtimeChannel {
    return workflowManager.subscribeToWorkflowChanges(
      workflowId,
      onUpdate,
      { onStatusChange }
    );
  }
  
  /**
   * Unsubscribe from channel.
   */
  unsubscribeFromChannel(channel: RealtimeChannel): void {
    workflowManager.unsubscribeFromChannel(channel);
  }
  
  /**
   * Get client ID.
   */
  getClientId(): string {
    return workflowManager.getClientId();
  }
  
  /**
   * Update workflow state.
   * Uses the Result pattern and ensures transaction ID is returned.
   */
  async updateWorkflowState(
    workflowId: string,
    step: WorkflowStep,
    metadata: Record<string, unknown> = {},
    options?: {
      skipValidation?: boolean
    }
  ): Promise<Result<string>> {
    const transactionId = crypto.randomUUID();
    
    if (!workflowId) {
      return Result.failure(
        'workflowId is required',
        'WORKFLOW_INVALID_PARAMS',
        { step, transactionId }
      );
    }
    
    try {
      const { skipValidation = false } = options ?? {};
      const enhancedMetadata = {
        ...metadata,
        transactionId
      };
      
      const updateResult = await workflowManager.updateState(
        workflowId,
        step,
        enhancedMetadata,
        { skipValidation }
      );
      
      if (updateResult.isFailure()) {
        return Result.failure(
          updateResult.error.message,
          updateResult.error.code,
          { ...updateResult.error.details, transactionId }
        );
      }
      
      return Result.success(transactionId);
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to update workflow state', {
        workflowId,
        step,
        transactionId,
        error: normalizedError.message,
        stack: normalizedError.stack,
        data: normalizedError.data
      });
      return Result.failure(
        `Failed to update workflow state: ${normalizedError.message}`,
        normalizedError.code || 'WORKFLOW_UPDATE_FAILED',
        { workflowId, step, transactionId, originalError: normalizedError }
      );
    }
  }
  
  /**
   * Set workflow error state.
   */
  async setWorkflowError(
    workflowId: string,
    errorMessage: string,
    errorDetails: Record<string, unknown> = {}
  ): Promise<Result<void>> {
    if (!workflowId) {
      return Result.failure(
        'workflowId is required',
        'WORKFLOW_INVALID_PARAMS',
        { errorMessage }
      );
    }
    
    try {
      const result = await workflowManager.handleError(
        workflowId,
        new Error(errorMessage),
        'error',
        errorDetails
      );
      
      if (result.isFailure()) {
        return Result.failure(
          result.error.message,
          result.error.code,
          result.error.details
        );
      }
      
      return Result.success(undefined);
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to set workflow error', {
        workflowId,
        errorMessage,
        handlerError: normalizedError.message
      });
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'WORKFLOW_ERROR_SET_FAILED',
        { workflowId, errorMessage }
      );
    }
  }
  
  /**
   * Reset workflow to initial state.
   */
  async resetWorkflow(
    workflowId: string,
    initialStep: WorkflowStep = 'idle',
    metadata: Record<string, unknown> = {}
  ): Promise<Result<boolean>> {
    try {
      const resetMetadata = {
        ...metadata,
        resetAt: new Date().toISOString(),
        resetBy: metadata.userId || 'system',
        progress: 0,
        error: null
      };
      
      const resetResult = await workflowManager.reset(
        workflowId,
        initialStep,
        resetMetadata
      );
      
      if (resetResult.isFailure()) {
        return Result.failure(
          resetResult.error.message,
          resetResult.error.code,
          resetResult.error.details
        );
      }
      
      return Result.success(true);
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to reset workflow', {
        workflowId,
        initialStep,
        error: normalizedError.message
      });
      return Result.failure(
        `Failed to reset workflow: ${normalizedError.message}`,
        normalizedError.code || 'WORKFLOW_RESET_FAILED',
        { workflowId, initialStep }
      );
    }
  }
  
  /**
   * Complete workflow.
   */
  async completeWorkflow(
    workflowId: string,
    completionMetadata: Record<string, unknown> = {}
  ): Promise<Result<void>> {
    if (!workflowId) {
      return Result.failure(
        'workflowId is required',
        'WORKFLOW_INVALID_PARAMS',
        {}
      );
    }
    
    try {
      const completeResult = await workflowManager.completeWorkflow(
        workflowId,
        completionMetadata
      );
      
      if (completeResult.isFailure()) {
        return Result.failure(
          completeResult.error.message,
          completeResult.error.code,
          completeResult.error.details
        );
      }
      
      return Result.success(undefined);
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to complete workflow', {
        workflowId,
        error: normalizedError.message
      });
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'WORKFLOW_COMPLETION_FAILED',
        { workflowId }
      );
    }
  }
}

// Export singleton instance
export const workflowService = new WorkflowService();