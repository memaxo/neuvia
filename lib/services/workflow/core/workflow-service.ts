import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import {
  type WorkflowStep,
  type ProcessingPhase
} from '@/lib/types/workflow'
import { ApplicationError, normalizeError } from '@/lib/errors'
import { workflowManager } from './workflow-manager'
import logger from '@/lib/logger'
import { Result } from '@/lib/services/workflow/error/result'

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
  ): Promise<boolean> {
    try {
      if (!workflowId) {
        throw new Error('workflowId is required');
      }
      
      return await workflowManager.updateProgress(
        workflowId,
        progress,
        phase,
        { 
          currentStep,
          notifyUsers 
        }
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to update progress', {
        workflowId,
        progress,
        phase: phase.toString(),
        error: normalizedError.message
      });
      return false;
    }
  }
  
  /**
   * Document processing methods
   */
  
  /**
   * Process document upload
   * @returns Result containing document processing result
   */
  async processDocumentUpload(
    workflowId: string,
    file: File,
    options: DocumentProcessingOptions
  ): Promise<Result<DocumentProcessingResult>> {
    try {
      // Update state to uploading
      const updateResult = await workflowManager.updateState(
        workflowId,
        'uploading',
        {
          fileName: file.name,
          fileSize: file.size,
          uploadStartedAt: new Date().toISOString(),
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
      
      // Update state after upload
      const extractingResult = await workflowManager.updateState(
        workflowId,
        'extracting',
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
      
      // Update to error state
      await workflowManager.handleError(
      // Return error result using Result pattern
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'DOCUMENT_UPLOAD_FAILED',
        { documentId: '', fileName: file.name, fileSize: file.size }
      );
          userId: options.userId
        }
      /**
   * Extract document content
   * @returns Result containing document processing result
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
      // Update state to extracting
      const updateResult = await workflowManager.updateState(
        workflowId,
        'extracting',
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
        
        // Update to error state
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
      
      // Update to complete state
      const completeResult = await workflowManager.updateState(
        workflowId,
        'complete',
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
      
      // Return successful result
      return Result.success({
        documentId,
        content: result.text,
        metadata: result.data,
        success: true,
        processingTime
      });
    } catch (err) {
      const normalizedError = normalizeError(err);
      
      // Update to error state
      await workflowManager.handleError(
        workflowId,
        normalizedError,
        'error',
        {
          documentId,
          phase: ProcessingPhase.EXTRACTION
        }
      );
      
      // Return error result using Result pattern
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'DOCUMENT_EXTRACTION_FAILED',
        { documentId, success: false }
      );
    }
  }
        }
      );
      
      // Return error result
      return {
        documentId,
        success: false,
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Verification methods
   */
  
  /**
   * Initialize verification process
   */
  async initiateVerification(
    workflowId: string,
    options: VerificationOptions
  ): Promise<VerificationResult> {
    try {
      // Update to verification_pending
      await workflowManager.updateState(
        workflowId,
        'verification_pending',
        {
          documentId: options.documentId,
          userId: options.userId,
          verificationStartedAt: new Date().toISOString()
        }
      );
      
      // Track progress
      const onProgress = options.onProgress || (() => {});
      onProgress(10, ProcessingPhase.VERIFICATION_PENDING);
      
      // If we have document text, generate summary
      if (options.documentText) {
        // Prepare request
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
        
        // Update to verification_in_progress
        await workflowManager.updateState(
          workflowId,
          'verification_in_progress',
          {
            verificationId,
            documentId: options.documentId,
            summary: result.summary,
            summaryGenerated: true,
            verificationMetadata: result.metadata
          }
        );
        
        onProgress(100, ProcessingPhase.VERIFICATION_PENDING);
        
        // Return successful result
        return {
          verificationId,
          documentId: options.documentId,
          success: true,
          metadata: {
            summary: result.summary
          }
        };
      } else if (options.documentId) {
        // Just update the state if document ID provided but no text
        await workflowManager.updateState(
          workflowId,
          'verification_pending',
          {
            documentId: options.documentId,
            awaitingDocument: true
          }
        );
        
        // Return pending result
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
      
      // Update to error state
      await workflowManager.handleError(
        workflowId,
        normalizedError,
        'error',
        {
          documentId: options.documentId,
          phase: ProcessingPhase.VERIFICATION
        }
      );
      
      // Return error result
      return {
        documentId: options.documentId,
        success: false,
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Process verification correction
   */
  async processVerificationCorrection(
    workflowId: string,
    correction: CorrectionData
  ): Promise<VerificationResult> {
    try {
      // Validate input
      if (!correction.correctionText || !correction.currentSummary) {
        throw new Error('Correction text and current summary are required');
      }
      
      // Get current state
      const state = await workflowManager.getState(workflowId);
      if (!state) {
        throw new Error('Workflow state not found');
      }
      
      const verificationId = state.metadata?.verificationId as string;
      const documentId = state.metadata?.documentId as string;
      
      // Call correction API
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
      
      // Get current correction count
      const correctionCount = (state.metadata?.correctionCount as number) || 0;
      
      // Update workflow state
      await workflowManager.updateState(
        workflowId,
        'verification_in_progress',
        {
          verificationId,
          documentId,
          summary: result.summary,
          correctionCount: correctionCount + 1,
          correctionTimestamp: new Date().toISOString()
        }
      );
      
      // Return successful result
      return {
        verificationId,
        documentId,
        success: true,
        metadata: {
          summary: result.summary,
          correctionCount: correctionCount + 1
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Verification correction failed', {
        workflowId,
        error: normalizedError.message
      });
      
      // Return error result
      return {
        success: false,
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Complete verification
   */
  async completeVerification(
    workflowId: string,
    verifiedBy: string
  ): Promise<VerificationResult> {
    try {
      // Get current state
      const state = await workflowManager.getState(workflowId);
      if (!state) {
        throw new Error('Workflow state not found');
      }
      
      const verificationId = state.metadata?.verificationId as string;
      const documentId = state.metadata?.documentId as string;
      
      if (!verificationId) {
        throw new Error('Verification ID not found in workflow state');
      }
      
      // Update to completed
      await workflowManager.updateState(
        workflowId,
        'verification_completed',
        {
          verificationId,
          documentId,
          verifiedBy,
          verifiedAt: new Date().toISOString()
        }
      );
      
      // Return successful result
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
      
      // Update to error state
      await workflowManager.handleError(
        workflowId,
        normalizedError,
        'error',
        {
          phase: ProcessingPhase.VERIFICATION_COMPLETION
        }
      );
      
      // Return error result
      return {
        success: false,
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Report generation methods
   */
  
  /**
   * Generate report
   */
  async generateReport(
    workflowId: string,
    options: ReportGenerationOptions
  ): Promise<ReportGenerationResult> {
    try {
      // Update to report_generation
      await workflowManager.updateState(
        workflowId,
        'report_generation',
        {
          documentId: options.documentId,
          patientId: options.patientId,
          userId: options.userId,
          reportGenerationStartedAt: new Date().toISOString()
        }
      );
      
      // Track progress
      const onProgress = options.onProgress || (() => {});
      onProgress(10, ProcessingPhase.REPORT_GENERATION);
      
      // Call report generation API
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
      
      // Update to complete
      await workflowManager.updateState(
        workflowId,
        'complete',
        {
          reportId,
          documentId: options.documentId,
          patientId: options.patientId,
          reportGenerationCompletedAt: new Date().toISOString()
        }
      );
      
      onProgress(100, ProcessingPhase.COMPLETION);
      
      // Return successful result
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
      
      // Update to error state
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
      
      // Return error result
      return {
        documentId: options.documentId,
        patientId: options.patientId,
        success: false,
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Format report
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
      
      // Call format API
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
      
      // Update format in workflow state
      await workflowManager.updateState(
        workflowId,
        'complete',
        {
          reportId,
          format,
          formattedAt: new Date().toISOString()
        }
      );
      
      // Return successful result
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
      
      // Return error result
      return {
        reportId,
        success: false,
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Workflow state management methods
   */
  
  /**
   * Get workflow state
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
   * Get or create workflow for user
   */
  async getOrCreateWorkflowForUser(
    userId: string,
    chatId: string | null,
    initialStep?: WorkflowStep,
    initialMetadata?: Record<string, unknown>
  ): Promise<{ id: string; data: Record<string, unknown> }> {
    try {
      if (!userId) {
        throw new Error('userId is required');
      }
      
      const { id, state } = await
===
    </search>
    <content>
===
  /**
   * Get or create workflow for user
   * @returns Result containing workflow data
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
      
      // Convert to expected format
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
   * Load workflow state for user
   * @returns Result containing workflow state or null if not found
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
      return result; // Already returns a Result
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
   * Subscribe to workflow for user
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
   * Subscribe to workflow changes
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
   * Unsubscribe from channel
   */
  unsubscribeFromChannel(channel: RealtimeChannel): void {
    workflowManager.unsubscribeFromChannel(channel);
  }

  /**
   * Get client ID
   */
  getClientId(): string {
    return workflowManager.getClientId();
  }

  /**
   * Update workflow state
   * @returns Result containing transaction ID
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
      
      // Add transaction ID to metadata
      const enhancedMetadata = {
        ...metadata,
        transactionId
      };
      
      // Use WorkflowManager for state update
      const updateResult = await workflowManager.updateState(
        workflowId,
        step,
        enhancedMetadata,
        {
          skipValidation
        }
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
      
      // Enhanced error logging
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
        {
          workflowId,
          step,
          transactionId,
          originalError: normalizedError
        }
      );
    }
  }

  /**
   * Set workflow error state
   * @returns Result indicating success or failure
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
   * Reset workflow to initial state
   * @returns Result indicating success or failure
   */
  async resetWorkflow(
    workflowId: string,
    initialStep: WorkflowStep = 'idle',
    metadata: Record<string, unknown> = {}
  ): Promise<Result<boolean>> {
    if (!workflowId) {
      return Result.failure(
        'workflowId is required',
        'WORKFLOW_INVALID_PARAMS',
        { initialStep }
      );
    }
    
    try {
      const resetResult = await workflowManager.reset(
        workflowId,
        initialStep,
        metadata
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
        normalizedError.message,
        normalizedError.code || 'WORKFLOW_RESET_FAILED',
        { workflowId, initialStep }
      );
    }
  }

  /**
   * Complete workflow
   * @returns Result indicating success or failure
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