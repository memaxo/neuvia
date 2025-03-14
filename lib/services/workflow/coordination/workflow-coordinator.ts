import { normalizeError, ApplicationError } from '@/lib/errors';
import { workflowRepository } from '../infrastructure/workflow-repository';
import { workflowStateManager } from '../infrastructure/workflow-state-manager';
import { eventService } from '@/lib/services/event-service';
import { EVENT_TYPES } from '@/lib/types/events';
import { Result } from '../error/result';
import logger from '@/lib/logger';

import { documentWorkflow } from '../domain/document-workflow';
import { verificationWorkflow } from '../domain/verification-workflow';
import { reportWorkflow } from '../domain/report-workflow';
import { researchWorkflow } from '../domain/research-workflow';
import { chatWorkflow } from '../domain/chat-workflow';
import { chatIntentParser, ChatIntentType } from './chat-intent-parser';
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
 * Combines functionality from mediator and orchestrator patterns
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
   */
  async processDocumentFlow(
    workflowId: string,
    file: File,
    options: Omit<DocumentToReportOptions, 'autoVerify' | 'autoGenerateReport'>
  ): Promise<EndToEndResult> {
    const transactionId = options.transactionId || crypto.randomUUID();
    const progressCallback = options.onProgress || (() => {});
    
    try {
      // Step 1: Create or get workflow instance
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
      
      // Step 2: Upload document
      progressCallback(10, ProcessingPhase.UPLOAD, 'Uploading document');
      
      const uploadAction: WorkflowAction = {
        type: 'UPLOAD_DOCUMENT',
        payload: {
          file,
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
      
      const uploadResult = await workflowEngine.sendAction(workflowId, uploadAction, {
        transactionId,
        userId: options.userId
      });
      
      if (uploadResult.isFailure()) {
        throw new Error(`Document upload failed: ${uploadResult.error.message}`);
      }
      
      // The actual file upload still needs to be handled
      // As the engine only handles state transitions, not actual business logic
      const uploadBusinessResult = await documentWorkflow.processUpload(
        workflowId,
        file,
        {
          userId: options.userId,
          patientId: options.patientId,
          documentType: options.documentType,
          autoExtract: false,
          onProgress: (progress) => progressCallback(progress, ProcessingPhase.UPLOAD, 'Uploading document'),
          transactionId
        }
      );
      
      if (!uploadBusinessResult.success) {
        // Handle upload failure
        await workflowEngine.sendAction(workflowId, {
          type: 'UPLOAD_FAILED',
          payload: {
            error: uploadBusinessResult.error
          },
          meta: { transactionId, userId: options.userId }
        });
        throw new Error(`Document upload failed: ${uploadBusinessResult.error}`);
      }
      
      // Notify engine that upload was successful
      const documentId = uploadBusinessResult.documentId;
      await workflowEngine.sendAction(workflowId, {
        type: 'UPLOAD_COMPLETED',
        payload: {
          documentId
        },
        meta: { transactionId, userId: options.userId }
      });
      
      // Step 3: Extract document content
      progressCallback(20, ProcessingPhase.EXTRACTION, 'Extracting document content');
      
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
      
      // Perform the actual extraction
      const extractBusinessResult = await documentWorkflow.extractContent(
        workflowId,
        documentId,
        {
          autoVerify: false,
          onProgress: (progress) => progressCallback(20 + progress * 0.2, ProcessingPhase.EXTRACTION, 'Extracting document content'),
          transactionId
        }
      );
      
      if (!extractBusinessResult.success) {
        // Handle extraction failure
        await workflowEngine.sendAction(workflowId, {
          type: 'EXTRACTION_FAILED',
          payload: {
            error: extractBusinessResult.error
          },
          meta: { transactionId, userId: options.userId }
        });
        throw new Error(`Document extraction failed: ${extractBusinessResult.error}`);
      }
      
      // Notify engine that extraction was successful
      await workflowEngine.sendAction(workflowId, {
        type: 'EXTRACTION_COMPLETED',
        payload: {
          content: extractBusinessResult.content,
          extractedData: extractBusinessResult.metadata
        },
        meta: { transactionId, userId: options.userId }
      });
      
      // Step 4: Initiate verification
      progressCallback(35, ProcessingPhase.VERIFICATION_PENDING, 'Initiating verification');
      
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
      
      // Get document data from workflow state for verification
      const state = await workflowRepository.getWorkflowState(workflowId);
      
      // Perform the actual verification
      const verifyBusinessResult = await verificationWorkflow.initiateVerification(
        workflowId,
        {
          userId: options.userId,
          documentId,
          documentData: state?.metadata || {},
          autoGenerateReport: false,
          onProgress: (progress) => progressCallback(35 + progress * 0.3, ProcessingPhase.VERIFICATION_PENDING, 'Initiating verification'),
          transactionId
        }
      );
      
      if (!verifyBusinessResult.success) {
        // Handle verification failure
        await workflowEngine.sendAction(workflowId, {
          type: 'VERIFICATION_FAILED',
          payload: {
            error: verifyBusinessResult.error
          },
          meta: { transactionId, userId: options.userId }
        });
        throw new Error(`Document verification failed: ${verifyBusinessResult.error}`);
      }
      
      const verificationId = verifyBusinessResult.verificationId;
      
      // Verification is now pending user confirmation
      // In real implementation, we would wait for user input here
      // This is just simulating completion for flow demonstration
      
      progressCallback(60, ProcessingPhase.VERIFICATION_COMPLETION, 'Completing verification');
      
      // User confirms verification (simulated)
      await workflowEngine.sendAction(workflowId, {
        type: 'VERIFY_CONFIRM',
        payload: {
          verificationId
        },
        meta: { transactionId, userId: options.userId }
      });
      
      // Complete the verification in the actual backend
      const completeVerificationResult = await verificationWorkflow.completeVerification(
        workflowId,
        verificationId,
        options.userId,
        false
      );
      
      // Step 5: Generate report
      progressCallback(70, ProcessingPhase.REPORT_GENERATION, 'Generating report');
      
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
      
      // Generate the actual report
      const reportBusinessResult = await reportWorkflow.generateReport(
        workflowId,
        {
          userId: options.userId,
          documentId,
          patientId: options.patientId,
          verificationId,
          autoComplete: false,
          onProgress: (progress) => progressCallback(70 + progress * 0.25, ProcessingPhase.REPORT_GENERATION, 'Generating report'),
          transactionId
        }
      );
      
      if (!reportBusinessResult.success) {
        // Handle report generation failure
        await workflowEngine.sendAction(workflowId, {
          type: 'REPORT_FAILED',
          payload: {
            error: reportBusinessResult.error
          },
          meta: { transactionId, userId: options.userId }
        });
        throw new Error(`Report generation failed: ${reportBusinessResult.error}`);
      }
      
      const reportId = reportBusinessResult.reportId;
      
      // Notify engine that report generation was successful
      await workflowEngine.sendAction(workflowId, {
        type: 'REPORT_COMPLETED',
        payload: {
          reportId
        },
        meta: { transactionId, userId: options.userId }
      });
      
      // Step 6: Complete workflow
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
      
      // Update the actual workflow completion state
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
          'chat-workflow', // This would be defined in a separate file
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
      
      // Step 2: Parse intent from message
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
      
      // Step 3: Create action based on intent
      const action: WorkflowAction = this.createActionFromIntent(
        parsedIntent,
        {
          chatId,
          message,
          userId: options.userId,
          patientId: options.patientId,
          documentId: options.documentId
        }
      );
      
      // Step 4: Send action to workflow engine
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
      
      // Step 5: Execute business logic based on intent type
      await this.executeIntentBusinessLogic(
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
      
      // Step 6: Map current state to next action
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
   * Execute business logic based on intent type
   */
  private async executeIntentBusinessLogic(
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
    // Based on the intent type, execute the appropriate business logic
    switch (intentType) {
      case ChatIntentType.VERIFY_CONFIRM:
        if (workflow.context.verificationId) {
          await verificationWorkflow.completeVerification(
            context.workflowId,
            workflow.context.verificationId,
            context.userId,
            false
          );
        }
        break;
        
      case ChatIntentType.VERIFY_CORRECT:
        if (workflow.context.verificationId && workflow.context.corrections) {
          await verificationWorkflow.processCorrection(
            context.workflowId,
            workflow.context.verificationId,
            {
              userId: context.userId,
              correctedFields: workflow.context.corrections,
              userComments: context.message
            }
          );
        }
        break;
        
      case ChatIntentType.RESEARCH_REQUEST:
        await researchWorkflow.executeResearch(
          context.workflowId,
          {
            userId: context.userId,
            query: workflow.context.query || context.message,
            patientId: context.patientId,
            includeCitations: true
          }
        );
        break;
        
      case ChatIntentType.REGULAR_MESSAGE:
      default:
        await chatWorkflow.processMessage(
          context.workflowId,
          context.chatId,
          context.message,
          {
            userId: context.userId,
            patientId: context.patientId
          }
        );
        break;
    }
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
      // Process upload but without auto-extract
      const result = await documentWorkflow.processUpload(
        workflowId,
        file,
        {
          userId: options.userId,
          patientId: options.patientId,
          documentType: options.documentType,
          autoExtract: false, // Explicitly disable auto-extract
          onProgress: options.onProgress,
          transactionId: options.transactionId
        }
      );
      
      if (!result.success) {
        return {
          success: false,
          error: result.error,
          data: { documentId: '' }
        };
      }
      
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
      // Extract content without auto-verify
      const result = await documentWorkflow.extractContent(
        workflowId,
        documentId,
        {
          autoVerify: false, // Explicitly disable auto-verify
          onProgress: options.onProgress,
          transactionId: options.transactionId
        }
      );
      
      if (!result.success) {
        return {
          success: false,
          error: result.error,
          data: {}
        };
      }
      
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
      // Get document data from workflow state
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state || !state.metadata) {
        throw new Error('Document metadata not found in workflow state');
      }
      
      // Initiate verification without auto-generate report
      const result = await verificationWorkflow.initiateVerification(
        workflowId,
        {
          userId: options.userId,
          documentId,
          documentData: state.metadata,
          autoGenerateReport: false, // Explicitly disable auto-generate report
          onProgress: options.onProgress,
          transactionId: options.transactionId
        }
      );
      
      if (!result.success) {
        return {
          success: false,
          error: result.error,
          data: { verificationId: '' }
        };
      }
      
      return {
        success: true,
        data: { verificationId: result.verificationId },
        nextAction: WorkflowNextAction.REQUEST_USER_INPUT, // Need user to confirm verification
        nextActionContext: {
          documentId,
          verificationId: result.verificationId,
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
   */
  async completeVerification(
    workflowId: string,
    verificationId: string,
    options: {
      userId: string;
    }
  ): Promise<ProcessingOutcome> {
    try {
      // Complete verification without auto-generate report
      const result = await verificationWorkflow.completeVerification(
        workflowId,
        verificationId,
        options.userId,
        false // Explicitly disable auto-generate report
      );
      
      if (!result.success) {
        return {
          success: false,
          error: result.error,
          data: {}
        };
      }
      
      return {
        success: true,
        data: {
          verificationId,
          documentId: result.documentId,
          metadata: result.metadata
        },
        nextAction: WorkflowNextAction.GENERATE_REPORT,
        nextActionContext: {
          documentId: result.documentId,
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
      // Apply corrections
      const result = await verificationWorkflow.processCorrection(
        workflowId,
        verificationId,
        {
          userId: options.userId,
          correctedFields: corrections,
          userComments: options.userComments
        }
      );
      
      if (!result.success) {
        return {
          success: false,
          error: result.error,
          data: {}
        };
      }
      
      return {
        success: true,
        data: {
          verificationId,
          documentId: result.documentId,
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
      // Generate report
      const result = await reportWorkflow.generateReport(
        workflowId,
        {
          userId: options.userId,
          documentId: options.documentId,
          patientId: options.patientId,
          verificationId: options.verificationId,
          autoComplete: false, // Explicitly disable auto-complete
          onProgress: options.onProgress,
          transactionId: options.transactionId
        }
      );
      
      if (!result.success) {
        return {
          success: false,
          error: result.error,
          data: { reportId: '' }
        };
      }
      
      return {
        success: true,
        data: { reportId: result.reportId },
        nextAction: WorkflowNextAction.COMPLETE_WORKFLOW,
        nextActionContext: {
          reportId: result.reportId,
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
      // Complete workflow
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
   * Process document to completion (upload → extract → verify → report)
   * Combines functionality from mediator and orchestrator
   * @deprecated Use processDocumentFlow instead which is based on step-by-step outcomes rather than boolean flags
   */
  async processDocumentToCompletion(
    workflowId: string,
    file: File,
    options: DocumentToReportOptions
  ): Promise<EndToEndResult> {
    // Use new flow-based coordination if explicitly requested
    if (options.useFlowCoordination) {
      return this.processDocumentFlow(
        workflowId,
        file,
        {
          userId: options.userId,
          patientId: options.patientId,
          documentType: options.documentType,
          onProgress: options.onProgress,
          transactionId: options.transactionId
        }
      );
    }
    
    // Legacy approach with boolean flags
    try {
      const transactionId = options.transactionId || crypto.randomUUID();
      
      // Progress tracking
      const progressCallback = options.onProgress || (() => {});
      
      // Initialize result tracking
      let documentId: string | undefined;
      let verificationId: string | undefined;
      let reportId: string | undefined;
      
      // Step 1: Process document upload and extraction
      progressCallback(10, ProcessingPhase.UPLOAD, 'Uploading document');
      
      const documentResult = await documentWorkflow.processUpload(
        workflowId,
        file,
        {
          userId: options.userId,
          patientId: options.patientId,
          documentType: options.documentType,
          autoExtract: true,
          onProgress: (progress, phase) => {
            // Map progress to overall progress (upload+extract = 0-30%)
            const overallProgress = Math.floor(progress * 0.3);
            progressCallback(overallProgress, phase, 'Processing document');
          },
          transactionId
        }
      );
      
      if (!documentResult.success) {
        throw new Error(`Document processing failed: ${documentResult.error}`);
      }
      
      documentId = documentResult.documentId;
      
      // Step 2: Verification (if automatic verification is enabled)
      if (options.autoVerify) {
        progressCallback(35, ProcessingPhase.VERIFICATION_PENDING, 'Initiating verification');
        
        const verificationResult = await verificationWorkflow.initiateVerification(
          workflowId,
          {
            userId: options.userId,
            documentId: documentResult.documentId,
            documentData: documentResult.metadata,
            autoGenerateReport: options.autoGenerateReport,
            onProgress: (progress, phase) => {
              // Map progress to overall progress (verification = 30-60%)
              const overallProgress = 30 + Math.floor(progress * 0.3);
              progressCallback(overallProgress, phase, 'Verifying document');
            },
            transactionId
          }
        );
        
        if (!verificationResult.success) {
          throw new Error(`Verification failed: ${verificationResult.error}`);
        }
        
        verificationId = verificationResult.verificationId;
        
        // After verification is initiated, complete it (simulating user verification)
        progressCallback(50, ProcessingPhase.VERIFICATION_COMPLETION, 'Completing verification');
        
        const completionResult = await verificationWorkflow.completeVerification(
          workflowId,
          verificationResult.verificationId,
          options.userId,
          options.autoGenerateReport
        );
        
        if (!completionResult.success) {
          throw new Error(`Verification completion failed: ${completionResult.error}`);
        }
      }
      
      // Step 3: Report generation (if automatic report generation is enabled)
      if (options.autoGenerateReport) {
        progressCallback(70, ProcessingPhase.REPORT_GENERATION, 'Generating report');
        
        const reportResult = await reportWorkflow.generateReport(
          workflowId,
          {
            userId: options.userId,
            documentId: documentResult.documentId,
            patientId: options.patientId,
            verificationId,
            autoComplete: true,
            onProgress: (progress, phase) => {
              // Map progress to overall progress (report = 60-100%)
              const overallProgress = 60 + Math.floor(progress * 0.4);
              progressCallback(overallProgress, phase, 'Generating report');
            },
            transactionId
          }
        );
        
        if (!reportResult.success) {
          throw new Error(`Report generation failed: ${reportResult.error}`);
        }
        
        reportId = reportResult.reportId;
      }
      
      // Final progress update
      progressCallback(100, ProcessingPhase.COMPLETION, 'Process completed');
      
      // Get final workflow state
      const finalState = await workflowRepository.getWorkflowState(workflowId);
      
      // Return end-to-end result
      return {
        workflowId,
        documentId,
        verificationId,
        reportId,
        success: true,
        currentState: finalState?.currentStep,
        metadata: {
          documentMetadata: documentResult.metadata,
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
        DomainOnlyWorkflowStep.ERROR,
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
  ): Promise<any> {
    try {
      // Get current workflow state using Result.fromPromise
      const stateResult = await Result.fromPromise(
        workflowRepository.getWorkflowState(workflowId)
      );
      
      if (stateResult.isFailure()) {
        this.logger.error('Failed to retrieve workflow state for research', {
          workflowId,
          error: stateResult.error.message
        });
        throw new Error(`Workflow state retrieval failed: ${stateResult.error.message}`);
      }
      
      const state = stateResult.value;
      if (!state) {
        throw new Error('Workflow state not found');
      }
      
      // Execute research query with Result pattern
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
      
      // Handle failure case for Result pattern
      if (researchResult.isFailure()) {
        const errorMessage = researchResult.error.message;
        this.logger.error('Research execution failed', {
          workflowId,
          query,
          errorCode: researchResult.error.code,
          error: errorMessage
        });
        
        // Handle research error in chat
        await chatWorkflow.processMessage(
          workflowId,
          chatId,
          `I couldn't complete the research you requested: ${errorMessage}`,
          {
            userId,
            role: 'system',
            model: 'gpt-4'
          }
        );
        
        throw new Error(`Research failed: ${errorMessage}`);
      }
      
      // Unwrap the successful result
      const research = researchResult.value;
      
      // Process research result in chat
      await chatWorkflow.processMessage(
        workflowId,
        chatId,
        `Here are my research findings for "${query}":\n\n${research.content}`,
        {
          userId,
          role: 'assistant',
          model: 'gpt-4'
        }
      );
      
      return research;
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

  /**
   * Handle document processed event
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
   * Handle research completed event
   */
  private async handleResearchCompleted(payload: ResearchCompletedEventPayload): Promise<void> {
    try {
      const { workflowId, patientId, researchResult } = payload;
      
      this.logger.info('Research completed, auto-initiating report generation', {
        workflowId,
        patientId
      });
      
      // Get workflow state to extract context
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }
      
      // Extract userId from state
      const userId = state.metadata?.userId as string;
      if (!userId) {
        throw new Error('No user ID found in workflow state');
      }

      try {
        // Auto-initiate report generation
        await reportWorkflow.generateReport(
          workflowId,
          {
            userId,
            patientId,
            researchResult: researchResult as unknown as Record<string, unknown>
          }
        );
      } catch (reportError) {
        this.logger.error('Error automatically initiating report generation after research', {
          workflowId,
          patientId,
          error: reportError instanceof Error ? reportError.message : String(reportError)
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
}

// Export singleton instance
export const workflowCoordinator = new WorkflowCoordinator();