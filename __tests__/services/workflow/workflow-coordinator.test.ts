/**
 * @jest-environment node
 */

import { workflowCoordinator } from '@/lib/services/workflow/coordination/workflow-coordinator';
import { WorkflowNextAction } from '@/lib/services/workflow/coordination/workflow-coordinator';
import { documentWorkflow } from '@/lib/services/workflow/domain/document-workflow';
import { verificationWorkflow } from '@/lib/services/workflow/domain/verification-workflow';
import { reportWorkflow } from '@/lib/services/workflow/domain/report-workflow';
import { workflowRepository } from '@/lib/services/workflow/infrastructure/workflow-repository';
import { workflowStateManager } from '@/lib/services/workflow/infrastructure/workflow-state-manager';
import { chatIntentParser } from '@/lib/services/workflow/coordination/chat-intent-parser';
import { ProcessingPhase } from '@/lib/types/workflow';

// Mock dependencies
jest.mock('@/lib/services/workflow/domain/document-workflow', () => ({
  documentWorkflow: {
    processUpload: jest.fn(),
    extractContent: jest.fn()
  }
}));

jest.mock('@/lib/services/workflow/domain/verification-workflow', () => ({
  verificationWorkflow: {
    initiateVerification: jest.fn(),
    completeVerification: jest.fn(),
    processCorrection: jest.fn()
  }
}));

jest.mock('@/lib/services/workflow/domain/report-workflow', () => ({
  reportWorkflow: {
    generateReport: jest.fn()
  }
}));

jest.mock('@/lib/services/workflow/infrastructure/workflow-repository', () => ({
  workflowRepository: {
    getWorkflowState: jest.fn()
  }
}));

jest.mock('@/lib/services/workflow/infrastructure/workflow-state-manager', () => ({
  workflowStateManager: {
    completeWorkflow: jest.fn(),
    handleError: jest.fn()
  }
}));

// Create mock file
const createMockFile = (name: string, type: string, size: number): File => {
  return {
    name,
    type,
    size
  } as File;
};

describe('WorkflowCoordinator Flow-Based Coordination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('processDocumentFlow', () => {
    it('should coordinate end-to-end document flow using outcome-based progression', async () => {
      // Mock document upload
      (documentWorkflow.processUpload as jest.Mock).mockResolvedValue({
        documentId: 'doc-123',
        metadata: { fileName: 'test.pdf' },
        success: true
      });
      
      // Mock document extraction
      (documentWorkflow.extractContent as jest.Mock).mockResolvedValue({
        documentId: 'doc-123',
        content: 'Extracted content',
        metadata: { contentExtracted: true },
        success: true
      });
      
      // Mock verification initiation
      (verificationWorkflow.initiateVerification as jest.Mock).mockResolvedValue({
        verificationId: 'verify-123',
        documentId: 'doc-123',
        success: true,
        metadata: { verificationInitiated: true }
      });
      
      // Mock verification completion
      (verificationWorkflow.completeVerification as jest.Mock).mockResolvedValue({
        verificationId: 'verify-123',
        documentId: 'doc-123',
        success: true,
        metadata: { verificationCompleted: true }
      });
      
      // Mock report generation
      (reportWorkflow.generateReport as jest.Mock).mockResolvedValue({
        reportId: 'report-123',
        documentId: 'doc-123',
        success: true,
        metadata: { reportGenerated: true }
      });
      
      // Mock workflow state
      (workflowRepository.getWorkflowState as jest.Mock).mockResolvedValue({
        currentStep: 'completed',
        metadata: {
          documentId: 'doc-123',
          verificationId: 'verify-123',
          reportId: 'report-123'
        }
      });
      
      // Mock workflow completion
      (workflowStateManager.completeWorkflow as jest.Mock).mockResolvedValue(true);
      
      // Prepare test file and options
      const workflowId = 'workflow-123';
      const file = createMockFile('test.pdf', 'application/pdf', 1024);
      const options = {
        userId: 'user-123',
        patientId: 'patient-123',
        onProgress: jest.fn()
      };
      
      // Execute the flow coordination
      const result = await workflowCoordinator.processDocumentFlow(workflowId, file, options);
      
      // Verify the result
      expect(result).toEqual(expect.objectContaining({
        workflowId,
        documentId: 'doc-123',
        verificationId: 'verify-123',
        reportId: 'report-123',
        success: true,
        currentState: 'completed'
      }));
      
      // Verify all domain methods were called without auto flags
      expect(documentWorkflow.processUpload).toHaveBeenCalledWith(
        workflowId,
        file,
        expect.objectContaining({
          userId: 'user-123',
          patientId: 'patient-123',
          autoExtract: false // No auto-chaining
        })
      );
      
      expect(documentWorkflow.extractContent).toHaveBeenCalledWith(
        workflowId,
        'doc-123',
        expect.objectContaining({
          autoVerify: false // No auto-chaining
        })
      );
      
      expect(verificationWorkflow.initiateVerification).toHaveBeenCalledWith(
        workflowId,
        expect.objectContaining({
          userId: 'user-123',
          documentId: 'doc-123',
          autoGenerateReport: false // No auto-chaining
        })
      );
      
      expect(reportWorkflow.generateReport).toHaveBeenCalledWith(
        workflowId,
        expect.objectContaining({
          userId: 'user-123',
          documentId: 'doc-123',
          verificationId: 'verify-123',
          autoComplete: false // No auto-chaining
        })
      );
      
      expect(workflowStateManager.completeWorkflow).toHaveBeenCalledWith(
        workflowId,
        expect.objectContaining({
          documentId: 'doc-123',
          verificationId: 'verify-123',
          reportId: 'report-123'
        })
      );
      
      // Verify progress callbacks
      expect(options.onProgress).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(String),
        expect.any(String)
      );
    });
    
    it('should handle errors and stop the flow at the failure point', async () => {
      // Mock successful document upload
      (documentWorkflow.processUpload as jest.Mock).mockResolvedValue({
        documentId: 'doc-123',
        metadata: { fileName: 'test.pdf' },
        success: true
      });
      
      // Mock failed document extraction
      (documentWorkflow.extractContent as jest.Mock).mockResolvedValue({
        documentId: 'doc-123',
        success: false,
        error: 'Extraction failed'
      });
      
      // Mock error handling
      (workflowStateManager.handleError as jest.Mock).mockResolvedValue(true);
      
      // Prepare test file and options
      const workflowId = 'workflow-123';
      const file = createMockFile('test.pdf', 'application/pdf', 1024);
      const options = {
        userId: 'user-123',
        patientId: 'patient-123',
        onProgress: jest.fn()
      };
      
      // Execute the flow coordination
      const result = await workflowCoordinator.processDocumentFlow(workflowId, file, options);
      
      // Verify the result contains the error
      expect(result).toEqual(expect.objectContaining({
        workflowId,
        success: false,
        error: expect.stringContaining('Extraction failed')
      }));
      
      // Verify error handling
      expect(workflowStateManager.handleError).toHaveBeenCalledWith(
        workflowId,
        expect.any(Error),
        expect.any(String),
        expect.any(Object)
      );
      
      // Verify verification was not attempted after extraction failure
      expect(verificationWorkflow.initiateVerification).not.toHaveBeenCalled();
    });
  });
  
  describe('Individual domain steps', () => {
    it('should upload document and suggest extraction as next step', async () => {
      (documentWorkflow.processUpload as jest.Mock).mockResolvedValue({
        documentId: 'doc-123',
        metadata: { fileName: 'test.pdf' },
        success: true
      });
      
      const workflowId = 'workflow-123';
      const file = createMockFile('test.pdf', 'application/pdf', 1024);
      
      const result = await workflowCoordinator.uploadDocument(workflowId, file, {
        userId: 'user-123'
      });
      
      expect(result).toEqual(expect.objectContaining({
        success: true,
        data: { documentId: 'doc-123' },
        nextAction: WorkflowNextAction.EXTRACT_DOCUMENT
      }));
      
      expect(documentWorkflow.processUpload).toHaveBeenCalledWith(
        workflowId,
        file,
        expect.objectContaining({
          autoExtract: false // Explicit disable of auto-extract
        })
      );
    });
    
    it('should extract document content and suggest verification as next step', async () => {
      (documentWorkflow.extractContent as jest.Mock).mockResolvedValue({
        documentId: 'doc-123',
        content: 'Extracted content',
        metadata: {},
        success: true
      });
      
      const result = await workflowCoordinator.extractDocument('workflow-123', 'doc-123', {
        userId: 'user-123'
      });
      
      expect(result).toEqual(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          documentId: 'doc-123',
          content: 'Extracted content'
        }),
        nextAction: WorkflowNextAction.VERIFY_DOCUMENT
      }));
      
      expect(documentWorkflow.extractContent).toHaveBeenCalledWith(
        'workflow-123',
        'doc-123',
        expect.objectContaining({
          autoVerify: false // Explicit disable of auto-verify
        })
      );
    });
    
    it('should verify document and suggest user input as next step', async () => {
      (workflowRepository.getWorkflowState as jest.Mock).mockResolvedValue({
        currentStep: 'extracting',
        metadata: { documentId: 'doc-123' }
      });
      
      (verificationWorkflow.initiateVerification as jest.Mock).mockResolvedValue({
        verificationId: 'verify-123',
        documentId: 'doc-123',
        success: true,
        metadata: {}
      });
      
      const result = await workflowCoordinator.verifyDocument('workflow-123', 'doc-123', {
        userId: 'user-123'
      });
      
      expect(result).toEqual(expect.objectContaining({
        success: true,
        data: { verificationId: 'verify-123' },
        nextAction: WorkflowNextAction.REQUEST_USER_INPUT
      }));
      
      expect(verificationWorkflow.initiateVerification).toHaveBeenCalledWith(
        'workflow-123',
        expect.objectContaining({
          documentId: 'doc-123',
          autoGenerateReport: false // Explicit disable of auto-generate report
        })
      );
    });
  });
  
  describe('Chat intent processing', () => {
    it('should process verification confirmation intent', async () => {
      // Mock current workflow state
      (workflowRepository.getWorkflowState as jest.Mock).mockResolvedValue({
        currentStep: 'verification_in_progress',
        metadata: {
          verificationId: 'verify-123'
        }
      });
      
      // Execute chat intent processing
      const result = await workflowCoordinator.processChatIntent(
        'workflow-123',
        'chat-123',
        'confirm',
        { userId: 'user-123' }
      );
      
      // Verify the result suggests report generation
      expect(result).toEqual(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          action: 'verify_confirm',
          verificationId: 'verify-123'
        }),
        nextAction: WorkflowNextAction.GENERATE_REPORT
      }));
    });
    
    it('should process correction intent and extract corrections', async () => {
      // Mock current workflow state
      (workflowRepository.getWorkflowState as jest.Mock).mockResolvedValue({
        currentStep: 'verification_in_progress',
        metadata: {
          verificationId: 'verify-123'
        }
      });
      
      // Execute chat intent processing for a correction
      const result = await workflowCoordinator.processChatIntent(
        'workflow-123',
        'chat-123',
        'The patient name should be John Doe and date of birth is 1980-01-01',
        { userId: 'user-123' }
      );
      
      // Verify corrections were extracted
      expect(result).toEqual(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          action: 'verify_correct',
          verificationId: 'verify-123',
          corrections: expect.any(Object)
        }),
        nextAction: WorkflowNextAction.NONE // Stays in verification
      }));
    });
    
    it('should process research request intent', async () => {
      // Mock current workflow state
      (workflowRepository.getWorkflowState as jest.Mock).mockResolvedValue({
        currentStep: 'chat_active',
        metadata: {}
      });
      
      // Execute chat intent processing for research
      const result = await workflowCoordinator.processChatIntent(
        'workflow-123',
        'chat-123',
        'Research diabetes treatment options',
        { userId: 'user-123' }
      );
      
      // Verify research intent was detected
      expect(result).toEqual(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          action: 'research',
          query: expect.stringContaining('diabetes treatment options')
        }),
        nextAction: WorkflowNextAction.START_RESEARCH
      }));
    });
  });
});