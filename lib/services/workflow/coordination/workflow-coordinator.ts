import { normalizeError, ApplicationError } from '@/lib/errors';
import { workflowRepository } from '../infrastructure/workflow-repository';
import { workflowStateManager } from '../infrastructure/workflow-state-manager';
import { eventService } from '@/lib/services/event-service';
import { EVENT_TYPES } from '@/lib/types/events';
import { Result } from '../error/result';
import logger from '@/lib/logger';

import { documentService } from '@/lib/services/document/document-service';
import { verificationService } from '@/lib/services/verification/verification-service';
import { reportService } from '@/lib/services/report/report-service';
import { researchService } from '@/lib/services/research/research-service';
import { chatService } from '@/lib/services/chat/chat-service';
import { chatIntentParser, ChatIntentType } from '@/lib/services/chat/chat-intent-parser';
import { workflowEngine } from './workflow-engine';
import { WorkflowAction } from './workflow-definition';

import type { WorkflowStep, ProcessingPhase } from '@/lib/types/workflow';
import { DomainOnlyWorkflowStep } from '@/lib/types/workflow';

import type {
  DocumentProcessedEventPayload,
  VerificationCompletedEventPayload,
  ResearchCompletedEventPayload,
  ReportGeneratedEventPayload
} from '@/lib/types/events';

/**
 * Processing outcome with next suggested action
 */
export interface ProcessingOutcome<TData = Record<string, unknown>> {
  /** Whether the process was successful */
  success: boolean;
  /** Any error message if process failed */
  error?: string;
  /** The data resulting from the process */
  data: TData;
  /** The suggested next action to take */
  nextAction?: WorkflowNextAction;
  /** Additional context for the next action */
  nextActionContext?: Record<string, unknown>;
}

/**
 * Possible next actions in a workflow sequence
 */
export enum WorkflowNextAction {
  NONE = 'none',
  EXTRACT_DOCUMENT = 'extract_document',
  VERIFY_DOCUMENT = 'verify_document',
  GENERATE_REPORT = 'generate_report',
  COMPLETE_WORKFLOW = 'complete_workflow',
  REQUEST_USER_INPUT = 'request_user_input',
  START_RESEARCH = 'start_research',
  PROCESS_CHAT_MESSAGE = 'process_chat_message'
}

/**
 * End-to-end process result
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
  /** Next action recommendation */
  nextAction?: WorkflowNextAction;
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
  /**
   * @deprecated Use flow-based coordination instead
   * Whether to auto-verify after extraction
   */
  autoVerify?: boolean;
  /**
   * @deprecated Use flow-based coordination instead
   * Whether to auto-generate report after verification
   */
  autoGenerateReport?: boolean;
  /** Progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase, step: string) => void;
  /** Transaction ID for tracking */
  transactionId?: string;
  /** Whether to use the new flow-based coordination */
  useFlowCoordination?: boolean;
}

/**
 * Workflow coordinator for orchestrating cross-domain workflows
 * 
 * This coordinator is responsible for:
 * 1. Registering and managing workflow definitions
 * 2. Coordinating state transitions between domain services
 * 3. Managing event subscriptions for cross-domain coordination
 * 4. Orchestrating the flow of data between domain services
 * 
 * IMPORTANT: This coordinator should NOT implement domain-specific business logic.
 * All business logic should be delegated to specialized domain services.
 * 
 * PHASE 1 ANALYSIS NOTES:
 * - This file contains significant domain logic that should be moved to appropriate service files
 * - Methods like processDocumentFlow, processChatIntent, uploadDocument, etc. contain business logic
 *   that would be better placed in domain-specific services
 * - The file should focus only on coordination and state transitions, not business operations
 * - Event handlers like handleDocumentProcessed and handleVerificationCompleted contain
 *   business decisions that should be delegated to services
 */
export class WorkflowCoordinator {
  private readonly logger = logger.withMetadata({ module: 'WorkflowCoordinator' });
  
  constructor() {
    this.registerEventHandlers();
    this.initializeWorkflowEngine();
  }
  
  /**
   * Register event handlers for cross-domain coordination
   */
  private registerEventHandlers(): void {
    // Document processing events
    eventService.subscribe(
      EVENT_TYPES.DOCUMENT_PROCESSED,
      this.handleDocumentProcessed.bind(this)
    );
    
    // Verification events
    eventService.subscribe(
      EVENT_TYPES.VERIFICATION_COMPLETED,
      this.handleVerificationCompleted.bind(this)
    );
    
    // Research events
    eventService.subscribe(
      EVENT_TYPES.RESEARCH_COMPLETED,
      this.handleResearchCompleted.bind(this)
    );
    
    // Report events
    eventService.subscribe(
      EVENT_TYPES.REPORT_GENERATED,
      this.handleReportGenerated.bind(this)
    );
  }
  
  /**
   * Initialize the workflow engine with workflow definitions
   */
  private initializeWorkflowEngine(): void {
    // Register workflow definitions with the engine
    this.registerWorkflowDefinitions();
    
    this.logger.info('Initialized workflow engine with all definitions');
  }
  
  /**
   * Register all workflow definitions with the engine
   */
  private registerWorkflowDefinitions(): void {
    // These will be imported from separate definition files 
    // in a complete implementation
    const documentWorkflowDefinition = this.createDocumentWorkflowDefinition();
    workflowEngine.registerWorkflow(documentWorkflowDefinition);
    
    // Import and register verification workflow
    const { verificationWorkflowDefinition } = require('../definitions/verification-workflow-definition');
    workflowEngine.registerWorkflow(verificationWorkflowDefinition);
    
    // Additional workflow definitions will be registered here
    // workflowEngine.registerWorkflow(reportWorkflowDefinition);
    // workflowEngine.registerWorkflow(researchWorkflowDefinition);
    // workflowEngine.registerWorkflow(chatWorkflowDefinition);
  }
  
  /**
   * Create document workflow definition
   * In a complete implementation, this would be in a separate file
   */
  private createDocumentWorkflowDefinition() {
    // This is a simplified version of the document workflow definition
    // A full implementation would include all possible states and transitions
    return {
      id: 'document-workflow',
      name: 'Document Processing Workflow',
      description: 'Handles document upload, extraction, and processing',
      version: '1.0.0',
      initialState: 'idle' as WorkflowStep,
      domains: ['Document'],
      context: {
        schema: {} as any, // Would use Zod schema in full implementation
        initialValue: {
          userId: '',
          progress: 0
        }
      },
      states: {
        'idle': {
          id: 'idle' as WorkflowStep,
          type: 'initial',
          description: 'Initial state before processing starts',
          transitions: {
            'UPLOAD_DOCUMENT': {
              target: 'uploading' as WorkflowStep,
              effects: [
                async (context, event) => {
                  // Record upload start
                  context.fileName = event.payload?.fileName;
                  context.fileSize = event.payload?.fileSize;
                  context.startedAt = new Date().toISOString();
                }
              ]
            }
          }
        },
        'uploading': {
          id: 'uploading' as WorkflowStep,
          description: 'Document is being uploaded',
          transitions: {
            'UPLOAD_COMPLETED': {
              target: 'extracting' as WorkflowStep,
              effects: [
                async (context, event) => {
                  // Store document ID
                  context.documentId = event.payload.documentId;
                  context.uploadedAt = new Date().toISOString();
                }
              ]
            },
            'UPLOAD_FAILED': {
              target: 'error' as WorkflowStep,
              effects: [
                async (context, event) => {
                  context.error = event.payload.error;
                  context.errorType = 'upload_failed';
                }
              ]
            }
          }
        },
        // Additional states would be defined here in a complete implementation
      }
    };
  }
  
  /**
   * Process document through the complete flow using the declarative workflow engine
   * This method orchestrates the workflow state transitions between domain services
   * but delegates all business logic to the appropriate domain services.
   */
  async processDocumentFlow(
    workflowId: string,
    file: File,
    options: Omit<DocumentToReportOptions, 'autoVerify' | 'autoGenerateReport'>
  ): Promise<EndToEndResult> {
    const transactionId = options.transactionId || crypto.randomUUID();
    const progressCallback = options.onProgress || (() => {});
    
    try {
      // Step 1: Create or get workflow instance - this is coordination logic
      let workflowResult = await workflowEngine.getWorkflow(workflowId);
      
      if (workflowResult.isFailure() && workflowResult.error.code === 'WORKFLOW_NOT_FOUND') {
        // Create new workflow
        workflowResult = await workflowEngine.createWorkflow(
          'document-workflow',
          workflowId,
          {
            userId: options.userId,
            patientId: options.patientId,
            documentType: options.documentType
          }
        );
      }
      
      if (workflowResult.isFailure()) {
        throw new Error(`Failed to initialize workflow: ${workflowResult.error.message}`);
      }
      
      // Step 2: Upload document - Coordinate state transitions
      progressCallback(10, ProcessingPhase.UPLOAD, 'Uploading document');
      
      // Update workflow state to uploading
      const uploadAction: WorkflowAction = {
        type: 'UPLOAD_DOCUMENT',
        payload: {
          file: { name: file.name, size: file.size, type: file.type },
          fileName: file.name,
          fileSize: file.size,
          userId: options.userId,
          patientId: options.patientId,
          documentType: options.documentType
        },
        meta: {
          transactionId,
          userId: options.userId
        }
      };
      
      await workflowEngine.sendAction(workflowId, uploadAction, {
        transactionId,
        userId: options.userId
      });
      
      // Delegate document upload to document service
      const uploadResult = await documentService.uploadDocument(file, {
        userId: options.userId,
        patientId: options.patientId,
        documentType: options.documentType,
        workflowId,
        onProgress: (progress) => progressCallback(progress, ProcessingPhase.UPLOAD, 'Uploading document'),
        transactionId
      });
      
      if (!uploadResult.success) {
        // Handle upload failure
        await workflowEngine.sendAction(workflowId, {
          type: 'UPLOAD_FAILED',
          payload: {
            error: uploadResult.error
          },
          meta: { transactionId, userId: options.userId }
        });
        throw new Error(`Document upload failed: ${uploadResult.error}`);
      }
      
      // Notify engine that upload was successful
      const documentId = uploadResult.documentId;
      await workflowEngine.sendAction(workflowId, {
        type: 'UPLOAD_COMPLETED',
        payload: {
          documentId
        },
        meta: { transactionId, userId: options.userId }
      });
      
      // Step 3: Extract document content - Coordinate state transitions
      progressCallback(30, ProcessingPhase.EXTRACTION, 'Extracting document content');
      
      // Update workflow state to extracting
      const extractAction: WorkflowAction = {
        type: 'EXTRACT_DOCUMENT',
        payload: {
          documentId
        },
        meta: {
          transactionId,
          userId: options.userId
        }
      };
      
      await workflowEngine.sendAction(workflowId, extractAction, {
        transactionId,
        userId: options.userId
      });
      
      // Delegate extraction to document service
      const extractResult = await documentService.extractContent(documentId, {
        userId: options.userId,
        workflowId,
        onProgress: (progress) => progressCallback(30 + progress * 0.15, ProcessingPhase.EXTRACTION, 'Extracting document content'),
        transactionId
      });
      
      if (!extractResult.success) {
        // Handle extraction failure
        await workflowEngine.sendAction(workflowId, {
          type: 'EXTRACTION_FAILED',
          payload: {
            error: extractResult.error
          },
          meta: { transactionId, userId: options.userId }
        });
        throw new Error(`Document extraction failed: ${extractResult.error}`);
      }
      
      // Notify engine that extraction was successful
      await workflowEngine.sendAction(workflowId, {
        type: 'EXTRACTION_COMPLETED',
        payload: {
          extractedMetadata: extractResult.metadata
        },
        meta: { transactionId, userId: options.userId }
      });
      
      // Step 4: Initiate verification - Coordinate state transitions
      progressCallback(45, ProcessingPhase.VERIFICATION_PENDING, 'Initiating verification');
      
      // Update workflow state to verification_pending
      const verifyAction: WorkflowAction = {
        type: 'START_VERIFICATION',
        payload: {
          documentId,
          userId: options.userId,
          patientId: options.patientId
        },
        meta: {
          transactionId,
          userId: options.userId
        }
      };
      
      await workflowEngine.sendAction(workflowId, verifyAction, {
        transactionId,
        userId: options.userId
      });
      
      // Delegate verification to verification service
      const verifyResult = await verificationService.initiateVerification({
        userId: options.userId,
        documentId,
        workflowId,
        metadata: extractResult.metadata,
        onProgress: (progress) => progressCallback(45 + progress * 0.15, ProcessingPhase.VERIFICATION_PENDING, 'Initiating verification'),
        transactionId
      });
      
      if (!verifyResult.success) {
        // Handle verification failure
        await workflowEngine.sendAction(workflowId, {
          type: 'VERIFICATION_FAILED',
          payload: {
            error: verifyResult.error?.message
          },
          meta: { transactionId, userId: options.userId }
        });
        throw new Error(`Document verification failed: ${verifyResult.error?.message}`);
      }
      
      const verificationId = verifyResult.data?.verificationId;
      
      // Step 5: Complete verification - Coordinate state transitions
      progressCallback(60, ProcessingPhase.VERIFICATION_COMPLETION, 'Completing verification');
      
      // For flow demonstration, we'll simulate user confirmation
      await workflowEngine.sendAction(workflowId, {
        type: 'VERIFY_CONFIRM',
        payload: {
          verificationId
        },
        meta: { transactionId, userId: options.userId }
      });
      
      // Delegate completion to verification service
      const completeVerificationResult = await verificationService.completeVerification(
        workflowId,
        true, // isApproved
        {
          userId: options.userId,
          verificationId
        }
      );
      
      if (!completeVerificationResult.success) {
        throw new Error(`Verification completion failed: ${completeVerificationResult.error?.message}`);
      }
      
      // Step 6: Generate report - Coordinate state transitions
      progressCallback(75, ProcessingPhase.REPORT_GENERATION, 'Generating report');
      
      // Update workflow state to report_generation
      const reportAction: WorkflowAction = {
        type: 'GENERATE_REPORT',
        payload: {
          documentId,
          verificationId,
          userId: options.userId,
          patientId: options.patientId
        },
        meta: {
          transactionId,
          userId: options.userId
        }
      };
      
      await workflowEngine.sendAction(workflowId, reportAction, {
        transactionId,
        userId: options.userId
      });
      
      // Delegate report generation to report service
      const reportResult = await reportService.generateReport({
        userId: options.userId,
        documentId,
        patientId: options.patientId,
        verificationId,
        workflowId,
        onProgress: (progress) => progressCallback(75 + progress * 0.20, ProcessingPhase.REPORT_GENERATION, 'Generating report'),
        transactionId
      });
      
      if (!reportResult.success) {
        // Handle report generation failure
        await workflowEngine.sendAction(workflowId, {
          type: 'REPORT_FAILED',
          payload: {
            error: reportResult.error?.message
          },
          meta: { transactionId, userId: options.userId }
        });
        throw new Error(`Report generation failed: ${reportResult.error?.message}`);
      }
      
      const reportId = reportResult.data?.reportId;
      
      // Notify engine that report generation was successful
      await workflowEngine.sendAction(workflowId, {
        type: 'REPORT_COMPLETED',
        payload: {
          reportId
        },
        meta: { transactionId, userId: options.userId }
      });
      
      // Step 7: Complete workflow - Coordinate state transitions
      progressCallback(95, ProcessingPhase.COMPLETION, 'Completing workflow');
      
      await workflowEngine.sendAction(workflowId, {
        type: 'COMPLETE',
        payload: {
          reportId,
          documentId,
          verificationId
        },
        meta: { transactionId, userId: options.userId }
      });
      
      // Update workflow completion state
      await workflowStateManager.completeWorkflow(
        workflowId,
        {
          documentId,
          verificationId,
          reportId,
          completedAt: new Date().toISOString(),
          completedBy: options.userId,
          transactionId
        }
      );
      
      // Final progress update
      progressCallback(100, ProcessingPhase.COMPLETION, 'Process completed');
      
      // Get current workflow state
      const currentWorkflow = await workflowEngine.getWorkflow(workflowId);
      if (currentWorkflow.isFailure()) {
        throw new Error(`Failed to get workflow state: ${currentWorkflow.error.message}`);
      }
      
      // Return result
      return {
        workflowId,
        documentId,
        verificationId,
        reportId,
        success: true,
        currentState: currentWorkflow.value.currentState,
        metadata: {
          ...currentWorkflow.value.context,
          completedAt: new Date().toISOString()
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Document flow processing failed', {
        workflowId,
        fileName: file.name,
        error: normalizedError.message
      });
      
      // Handle error using engine
      try {
        await workflowEngine.sendAction(workflowId, {
          type: 'PROCESS_ERROR',
          payload: {
            error: normalizedError.message,
            fileName: file.name,
            userId: options.userId,
            patientId: options.patientId
          },
          meta: {
            transactionId,
            userId: options.userId
          }
        });
      } catch (actionError) {
        // Just log if this fails
        this.logger.error('Failed to send error action', {
          workflowId,
          error: actionError instanceof Error ? actionError.message : String(actionError)
        });
      }
      
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
   * Process chat intent using the declarative workflow engine
   * 
   * This method orchestrates the intent detection and workflow state transitions,
   * delegating all chat UI/message generation to the chatService.
   * It focuses on:
   * 1. Determining the user intent
   * 2. Creating the appropriate workflow action
   * 3. Updating workflow state
   * 4. Delegating business logic to domain services
   */
  async processChatIntent(
    workflowId: string,
    chatId: string,
    message: string,
    options: {
      userId: string;
      patientId?: string;
      documentId?: string;
    }
  ): Promise<ProcessingOutcome> {
    try {
      // Step 1: Get or create workflow instance
      let workflowResult = await workflowEngine.getWorkflow(workflowId);
      
      if (workflowResult.isFailure() && workflowResult.error.code === 'WORKFLOW_NOT_FOUND') {
        // Create new chat workflow
        workflowResult = await workflowEngine.createWorkflow(
          'chat-workflow',
          workflowId,
          {
            userId: options.userId,
            patientId: options.patientId,
            chatId
          }
        );
      }
      
      if (workflowResult.isFailure()) {
        return {
          success: false,
          error: `Failed to get workflow state: ${workflowResult.error.message}`,
          data: {},
          nextAction: WorkflowNextAction.NONE
        };
      }
      
      const currentState = workflowResult.value.currentState;
      
      // Step 2: Parse intent from message - delegate to chat intent parser service
      const parsedIntent = chatIntentParser.parseIntent(message, currentState);
      
      // Log the detected intent
      this.logger.info('Parsed chat intent', {
        workflowId,
        chatId,
        message: message.substring(0, 100),
        intentType: parsedIntent.intentType,
        confidence: parsedIntent.confidence,
        currentStep: currentState
      });
      
      // Step 3: Create action based on intent - this is coordinator's job
      const action = this.createActionFromIntent(
        parsedIntent,
        {
          chatId,
          message,
          userId: options.userId,
          patientId: options.patientId,
          documentId: options.documentId
        }
      );
      
      // Step 4: Send action to workflow engine - for state transitions only
      const actionResult = await workflowEngine.sendAction(workflowId, action, {
        userId: options.userId
      });
      
      if (actionResult.isFailure()) {
        return {
          success: false,
          error: actionResult.error.message,
          data: {},
          nextAction: WorkflowNextAction.NONE
        };
      }
      
      // Step 5: Execute business logic based on intent type - delegate to appropriate service
      await this.delegateIntentProcessing(
        parsedIntent.intentType,
        actionResult.value,
        {
          workflowId,
          chatId,
          message,
          userId: options.userId,
          patientId: options.patientId,
          documentId: options.documentId
        }
      );
      
      // Step 6: Map current state to next action - coordination function
      const nextAction = this.mapStateToNextAction(
        actionResult.value.currentState,
        actionResult.value.context
      );
      
      // Return outcome
      return {
        success: true,
        data: {
          actionType: action.type,
          chatId,
          state: actionResult.value.currentState,
          ...parsedIntent.data
        },
        nextAction,
        nextActionContext: {
          ...actionResult.value.context,
          userMessage: message,
          chatId
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to process chat intent', {
        workflowId,
        chatId,
        error: normalizedError.message
      });
      
      return {
        success: false,
        error: normalizedError.message,
        data: {},
        nextAction: WorkflowNextAction.NONE
      };
    }
  }
  
  /**
   * Create action from intent
   * 
   * This method translates chat intents into workflow actions.
   * It only concerns itself with the workflow state transitions,
   * not with message generation or UI aspects.
   */
  private createActionFromIntent(
    parsedIntent: ReturnType<typeof chatIntentParser.parseIntent>,
    context: {
      chatId: string;
      message: string;
      userId: string;
      patientId?: string;
      documentId?: string;
    }
  ): WorkflowAction {
    switch (parsedIntent.intentType) {
      case ChatIntentType.VERIFY_CONFIRM:
        return {
          type: 'VERIFY_CONFIRM',
          payload: {
            verificationId: parsedIntent.data?.verificationId,
            chatId: context.chatId,
            message: context.message
          },
          meta: { userId: context.userId }
        };
        
      case ChatIntentType.VERIFY_CORRECT:
        // Get correction data from the parsed intent
        const correctionData = parsedIntent.data?.corrections?.reduce((acc, { field, value }) => {
          acc[field] = value;
          return acc;
        }, {} as Record<string, string>) || {};
        
        return {
          type: 'VERIFY_CORRECT',
          payload: {
            corrections: correctionData,
            chatId: context.chatId,
            message: context.message
          },
          meta: { userId: context.userId }
        };
        
      case ChatIntentType.VERIFY_REJECT:
        return {
          type: 'VERIFY_REJECT',
          payload: {
            reason: 'User rejected verification',
            chatId: context.chatId,
            message: context.message
          },
          meta: { userId: context.userId }
        };
        
      case ChatIntentType.RESEARCH_REQUEST:
        return {
          type: 'START_RESEARCH',
          payload: {
            query: parsedIntent.data?.query || context.message,
            chatId: context.chatId,
            message: context.message
          },
          meta: { userId: context.userId }
        };
        
      case ChatIntentType.GENERATE_REPORT:
        return {
          type: 'GENERATE_REPORT',
          payload: {
            documentId: context.documentId,
            chatId: context.chatId,
            message: context.message
          },
          meta: { userId: context.userId }
        };
        
      case ChatIntentType.CANCEL_OPERATION:
        return {
          type: 'CANCEL_OPERATION',
          payload: {
            chatId: context.chatId,
            message: context.message
          },
          meta: { userId: context.userId }
        };
        
      case ChatIntentType.HELP_REQUEST:
        return {
          type: 'HELP_REQUEST',
          payload: {
            chatId: context.chatId,
            message: context.message
          },
          meta: { userId: context.userId }
        };
        
      case ChatIntentType.REGULAR_MESSAGE:
      default:
        return {
          type: 'PROCESS_MESSAGE',
          payload: {
            chatId: context.chatId,
            message: context.message
          },
          meta: { userId: context.userId }
        };
    }
  }
  
  /**
   * Delegate business logic based on intent type
   * 
   * PHASE 3 IMPLEMENTATION:
   * This method has been refactored to delegate all business logic to the chat service,
   * making the coordinator focus solely on workflow coordination.
   */
  private async delegateIntentProcessing(
    intentType: ChatIntentType,
    workflow: any,
    context: {
      workflowId: string;
      chatId: string;
      message: string;
      userId: string;
      patientId?: string;
      documentId?: string;
    }
  ): Promise<void> {
    // PHASE 3 IMPLEMENTATION: Delegate all processing to chat service
    // instead of handling each intent type directly
    await chatService.processIntent(
      intentType,
      workflow.context,
      context
    );
    
    // No additional processing needed here - all business logic
    // is now encapsulated in the appropriate domain service
  }
  
  /**
   * Map workflow state to next action
   */
  private mapStateToNextAction(
    state: string,
    context: Record<string, any>
  ): WorkflowNextAction {
    switch (state) {
      case 'extracting':
        return WorkflowNextAction.EXTRACT_DOCUMENT;
      case 'verification_pending':
      case 'verification_in_progress':
        return WorkflowNextAction.VERIFY_DOCUMENT;
      case 'verification_completed':
        return WorkflowNextAction.GENERATE_REPORT;
      case 'report_generation':
        return WorkflowNextAction.GENERATE_REPORT;
      case 'complete':
        return WorkflowNextAction.COMPLETE_WORKFLOW;
      case 'research_in_progress':
        return WorkflowNextAction.START_RESEARCH;
      case 'chat_in_progress':
        return WorkflowNextAction.PROCESS_CHAT_MESSAGE;
      case 'error':
        return WorkflowNextAction.NONE;
      default:
        return WorkflowNextAction.NONE;
    }
  }
  
  /**
   * Upload document and return next suggested action
   * This method coordinates document upload workflow and delegates business logic
   * to the document service.
   */
  async uploadDocument(
    workflowId: string,
    file: File,
    options: {
      userId: string;
      patientId?: string;
      documentType?: string;
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
      transactionId?: string;
    }
  ): Promise<ProcessingOutcome<{documentId: string}>> {
    try {
      // Coordinate workflow state transition to uploading
      const uploadAction: WorkflowAction = {
        type: 'UPLOAD_DOCUMENT',
        payload: {
          file: { name: file.name, size: file.size, type: file.type },
          fileName: file.name,
          fileSize: file.size,
          userId: options.userId,
          patientId: options.patientId,
          documentType: options.documentType
        },
        meta: {
          transactionId: options.transactionId,
          userId: options.userId
        }
      };
      
      await workflowEngine.sendAction(workflowId, uploadAction, {
        transactionId: options.transactionId,
        userId: options.userId
      });
      
      // Delegate upload to document service
      const result = await documentService.uploadDocument(file, {
        userId: options.userId,
        patientId: options.patientId,
        documentType: options.documentType,
        workflowId,
        onProgress: options.onProgress,
        transactionId: options.transactionId
      });
      
      if (!result.success) {
        // Update workflow state to error
        await workflowEngine.sendAction(workflowId, {
          type: 'UPLOAD_FAILED',
          payload: {
            error: result.error
          },
          meta: { 
            transactionId: options.transactionId, 
            userId: options.userId 
          }
        });
        
        return {
          success: false,
          error: result.error,
          data: { documentId: '' }
        };
      }
      
      // Update workflow state to upload completed
      await workflowEngine.sendAction(workflowId, {
        type: 'UPLOAD_COMPLETED',
        payload: {
          documentId: result.documentId
        },
        meta: { 
          transactionId: options.transactionId, 
          userId: options.userId 
        }
      });
      
      return {
        success: true,
        data: { documentId: result.documentId },
        nextAction: WorkflowNextAction.EXTRACT_DOCUMENT,
        nextActionContext: {
          documentId: result.documentId,
          userId: options.userId
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Document upload failed', {
        workflowId,
        fileName: file.name,
        error: normalizedError.message
      });
      
      return {
        success: false,
        error: normalizedError.message,
        data: { documentId: '' }
      };
    }
  }
  
  /**
   * Extract document content and return next suggested action
   * This method coordinates document extraction workflow and delegates business logic
   * to the document service.
   */
  async extractDocument(
    workflowId: string,
    documentId: string,
    options: {
      userId: string;
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
      transactionId?: string;
    }
  ): Promise<ProcessingOutcome> {
    try {
      // Coordinate workflow state transition to extracting
      const extractAction: WorkflowAction = {
        type: 'EXTRACT_DOCUMENT',
        payload: {
          documentId
        },
        meta: {
          transactionId: options.transactionId,
          userId: options.userId
        }
      };
      
      await workflowEngine.sendAction(workflowId, extractAction, {
        transactionId: options.transactionId,
        userId: options.userId
      });
      
      // Delegate extraction to document service
      const result = await documentService.extractContent(documentId, {
        userId: options.userId,
        workflowId,
        onProgress: options.onProgress,
        transactionId: options.transactionId
      });
      
      if (!result.success) {
        // Update workflow state to error
        await workflowEngine.sendAction(workflowId, {
          type: 'EXTRACTION_FAILED',
          payload: {
            error: result.error
          },
          meta: { 
            transactionId: options.transactionId, 
            userId: options.userId 
          }
        });
        
        return {
          success: false,
          error: result.error,
          data: {}
        };
      }
      
      // Update workflow state to extraction completed
      await workflowEngine.sendAction(workflowId, {
        type: 'EXTRACTION_COMPLETED',
        payload: {
          content: result.content,
          extractedMetadata: result.metadata
        },
        meta: { 
          transactionId: options.transactionId, 
          userId: options.userId 
        }
      });
      
      return {
        success: true,
        data: {
          documentId,
          content: result.content,
          metadata: result.metadata
        },
        nextAction: WorkflowNextAction.VERIFY_DOCUMENT,
        nextActionContext: {
          documentId,
          userId: options.userId
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Document extraction failed', {
        workflowId,
        documentId,
        error: normalizedError.message
      });
      
      return {
        success: false,
        error: normalizedError.message,
        data: {}
      };
    }
  }
  
  /**
   * Verify document and return next suggested action
   * This method coordinates document verification workflow and delegates business logic
   * to the verification service.
   */
  async verifyDocument(
    workflowId: string,
    documentId: string,
    options: {
      userId: string;
      patientId?: string;
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
      transactionId?: string;
    }
  ): Promise<ProcessingOutcome<{verificationId: string}>> {
    try {
      // Coordinate workflow state transition to verification_pending
      const verifyAction: WorkflowAction = {
        type: 'START_VERIFICATION',
        payload: {
          documentId,
          userId: options.userId,
          patientId: options.patientId
        },
        meta: {
          transactionId: options.transactionId,
          userId: options.userId
        }
      };
      
      await workflowEngine.sendAction(workflowId, verifyAction, {
        transactionId: options.transactionId,
        userId: options.userId
      });
      
      // Delegate verification to verification service
      const result = await verificationService.initiateVerification({
        userId: options.userId,
        documentId,
        workflowId,
        onProgress: options.onProgress,
        transactionId: options.transactionId
      });
      
      if (!result.success) {
        // Update workflow state to error
        await workflowEngine.sendAction(workflowId, {
          type: 'VERIFICATION_FAILED',
          payload: {
            error: result.error?.message
          },
          meta: { 
            transactionId: options.transactionId, 
            userId: options.userId 
          }
        });
        
        return {
          success: false,
          error: result.error?.message,
          data: { verificationId: '' }
        };
      }
      
      return {
        success: true,
        data: { verificationId: result.data?.verificationId || '' },
        nextAction: WorkflowNextAction.REQUEST_USER_INPUT, // Need user to confirm verification
        nextActionContext: {
          documentId,
          verificationId: result.data?.verificationId,
          userId: options.userId,
          prompt: "Please review the extracted document data and confirm it's correct."
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Document verification initiation failed', {
        workflowId,
        documentId,
        error: normalizedError.message
      });
      
      return {
        success: false,
        error: normalizedError.message,
        data: { verificationId: '' }
      };
    }
  }
  
  /**
   * Complete verification after user confirms
   * This method coordinates verification completion workflow and delegates business logic
   * to the verification service.
   */
  async completeVerification(
    workflowId: string,
    verificationId: string,
    options: {
      userId: string;
    }
  ): Promise<ProcessingOutcome> {
    try {
      // Coordinate workflow state transition to verification_completed
      const confirmAction: WorkflowAction = {
        type: 'VERIFY_CONFIRM',
        payload: {
          verificationId
        },
        meta: {
          userId: options.userId
        }
      };
      
      await workflowEngine.sendAction(workflowId, confirmAction, {
        userId: options.userId
      });
      
      // Delegate to verification service
      const result = await verificationService.completeVerification(
        workflowId,
        true, // isApproved
        {
          userId: options.userId,
          verificationId
        }
      );
      
      if (!result.success) {
        return {
          success: false,
          error: result.error?.message,
          data: {}
        };
      }
      
      return {
        success: true,
        data: {
          verificationId,
          documentId: result.data?.documentId,
          metadata: result.data
        },
        nextAction: WorkflowNextAction.GENERATE_REPORT,
        nextActionContext: {
          documentId: result.data?.documentId,
          verificationId,
          userId: options.userId
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Verification completion failed', {
        workflowId,
        verificationId,
        error: normalizedError.message
      });
      
      return {
        success: false,
        error: normalizedError.message,
        data: {}
      };
    }
  }
  
  /**
   * Process verification correction from user
   * This method coordinates correction workflow and delegates business logic
   * to the verification service.
   */
  async processVerificationCorrection(
    workflowId: string,
    verificationId: string,
    corrections: Record<string, unknown>,
    options: {
      userId: string;
      userComments?: string;
    }
  ): Promise<ProcessingOutcome> {
    try {
      // Coordinate workflow state transition for corrections
      const correctionAction: WorkflowAction = {
        type: 'VERIFY_CORRECT',
        payload: {
          corrections,
          verificationId,
          comments: options.userComments
        },
        meta: {
          userId: options.userId
        }
      };
      
      await workflowEngine.sendAction(workflowId, correctionAction, {
        userId: options.userId
      });
      
      // Delegate to verification service
      const result = await verificationService.processCorrection({
        workflowId,
        verificationId,
        userId: options.userId,
        corrections,
        correctionText: options.userComments
      });
      
      if (!result.success) {
        return {
          success: false,
          error: result.error?.message,
          data: {}
        };
      }
      
      return {
        success: true,
        data: {
          verificationId,
          documentId: result.data?.documentId,
          corrections
        },
        nextAction: WorkflowNextAction.REQUEST_USER_INPUT, // Still need confirmation
        nextActionContext: {
          verificationId,
          userId: options.userId,
          prompt: "Corrections applied. Please confirm the data is now correct."
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Verification correction failed', {
        workflowId,
        verificationId,
        error: normalizedError.message
      });
      
      return {
        success: false,
        error: normalizedError.message,
        data: {}
      };
    }
  }
  
  /**
   * Generate report and return next suggested action
   * This method coordinates report generation workflow and delegates business logic
   * to the report service.
   */
  async generateReport(
    workflowId: string,
    options: {
      userId: string;
      documentId?: string;
      patientId?: string;
      verificationId?: string;
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
      transactionId?: string;
    }
  ): Promise<ProcessingOutcome<{reportId: string}>> {
    try {
      // Coordinate workflow state transition to report_generation
      const reportAction: WorkflowAction = {
        type: 'GENERATE_REPORT',
        payload: {
          documentId: options.documentId,
          verificationId: options.verificationId,
          userId: options.userId,
          patientId: options.patientId
        },
        meta: {
          transactionId: options.transactionId,
          userId: options.userId
        }
      };
      
      await workflowEngine.sendAction(workflowId, reportAction, {
        transactionId: options.transactionId,
        userId: options.userId
      });
      
      // Delegate to report service
      const result = await reportService.generateReport({
        userId: options.userId,
        documentId: options.documentId,
        patientId: options.patientId,
        verificationId: options.verificationId,
        workflowId,
        onProgress: options.onProgress,
        transactionId: options.transactionId
      });
      
      if (!result.success) {
        // Update workflow state to error
        await workflowEngine.sendAction(workflowId, {
          type: 'REPORT_FAILED',
          payload: {
            error: result.error?.message
          },
          meta: { 
            transactionId: options.transactionId, 
            userId: options.userId 
          }
        });
        
        return {
          success: false,
          error: result.error?.message,
          data: { reportId: '' }
        };
      }
      
      // Update workflow state to report completed
      await workflowEngine.sendAction(workflowId, {
        type: 'REPORT_COMPLETED',
        payload: {
          reportId: result.data?.reportId
        },
        meta: { 
          transactionId: options.transactionId, 
          userId: options.userId 
        }
      });
      
      return {
        success: true,
        data: { reportId: result.data?.reportId || '' },
        nextAction: WorkflowNextAction.COMPLETE_WORKFLOW,
        nextActionContext: {
          reportId: result.data?.reportId,
          userId: options.userId
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Report generation failed', {
        workflowId,
        documentId: options.documentId,
        verificationId: options.verificationId,
        error: normalizedError.message
      });
      
      return {
        success: false,
        error: normalizedError.message,
        data: { reportId: '' }
      };
    }
  }
  
  /**
   * Complete workflow and mark as finished
   * This method coordinates workflow completion and delegates workflow state management
   * to the workflow state manager.
   */
  async completeWorkflow(
    workflowId: string,
    options: {
      userId: string;
      documentId?: string;
      verificationId?: string;
      reportId?: string;
      transactionId?: string;
    }
  ): Promise<ProcessingOutcome> {
    try {
      // Coordinate workflow state transition to complete
      const completeAction: WorkflowAction = {
        type: 'COMPLETE',
        payload: {
          reportId: options.reportId,
          documentId: options.documentId,
          verificationId: options.verificationId
        },
        meta: { 
          transactionId: options.transactionId, 
          userId: options.userId 
        }
      };
      
      await workflowEngine.sendAction(workflowId, completeAction, {
        transactionId: options.transactionId,
        userId: options.userId
      });
      
      // Delegate to workflow state manager
      await workflowStateManager.completeWorkflow(
        workflowId,
        {
          documentId: options.documentId,
          verificationId: options.verificationId,
          reportId: options.reportId,
          completedAt: new Date().toISOString(),
          completedBy: options.userId,
          transactionId: options.transactionId
        }
      );
      
      return {
        success: true,
        data: {
          completedAt: new Date().toISOString(),
          completedBy: options.userId
        },
        nextAction: WorkflowNextAction.NONE
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Workflow completion failed', {
        workflowId,
        error: normalizedError.message
      });
      
      return {
        success: false,
        error: normalizedError.message,
        data: {}
      };
    }
  }
  
  /**
   * Handle document processed event
   * This method orchestrates cross-domain coordination between document processing
   * and verification based on event triggers.
   */
  private async handleDocumentProcessed(payload: DocumentProcessedEventPayload): Promise<void> {
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
        
        // Delegate to verification service
        await verificationService.initiateVerification({
          userId: userId as string,
          documentId,
          workflowId
        });
        
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
   * This method orchestrates cross-domain coordination between verification
   * and report generation based on event triggers.
   */
  private async handleVerificationCompleted(payload: VerificationCompletedEventPayload): Promise<void> {
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
        
        // Delegate to report service
        await reportService.generateReport({
          userId: userId as string,
          documentId,
          patientId: patientId as string,
          verificationId,
          workflowId
        });
        
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
   * Handle research completed event
   * This method orchestrates cross-domain coordination between research
   * and report generation based on event triggers.
   */
  private async handleResearchCompleted(payload: ResearchCompletedEventPayload): Promise<void> {
    try {
      const { workflowId, patientId, researchResult } = payload;
      
      this.logger.info('Research completed', {
        workflowId,
        patientId
      });
      
      // Get workflow state to extract context
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state) {
        this.logger.warn('Workflow state not found - skipping event handling', {
          workflowId,
          patientId
        });
        return;
      }
      
      // Extract userId from state
      const userId = state.metadata?.userId as string;
      if (!userId) {
        this.logger.warn('User ID not found - skipping report generation', {
          workflowId,
          patientId
        });
        return;
      }
      
      // Check if auto-report generation is enabled
      const autoGenerateReport = state.metadata?.autoGenerateReport === true || 
                                researchResult?.autoGenerateReport === true;
      
      if (autoGenerateReport) {
        // Delegate to report service
        await reportService.generateReport({
          userId,
          patientId,
          workflowId,
          researchData: researchResult
        });
        
        this.logger.info('Auto-report generation initiated after research', {
          workflowId,
          patientId
        });
      }
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to handle research completed event', {
        payload,
        error: normalizedError.message
      });
    }
  }
  
  /**
   * Handle report generated event
   * This method orchestrates workflow completion after report generation
   * based on event triggers.
   */
  private async handleReportGenerated(payload: ReportGeneratedEventPayload): Promise<void> {
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
        // Coordinate workflow completion
        await workflowEngine.sendAction(workflowId, {
          type: 'COMPLETE',
          payload: {
            reportId,
            documentId
          },
          meta: {
            userId: metadata.userId || state.metadata?.userId
          }
        });
        
        // Delegate to workflow state manager
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
}

// Export singleton instance
export const workflowCoordinator = new WorkflowCoordinator();