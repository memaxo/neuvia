import { useState, useCallback, useMemo } from 'react';
import { useDocumentProcessing } from './use-document-processing';
import { useVerification } from './use-verification';
import { useResearch } from './use-research';
import { useReport } from './use-report';

// Import types from specific modules
import type { ProcessingStatus } from '@/lib/processing/types/base';
import type { ExtractedDocument } from '@/lib/processing/types/extraction';
import type { VerificationItem, VerifiedDocument } from '@/lib/processing/types/verification';
import type { ResearchOptions, ResearchDocument } from '@/lib/processing/types/research';
import type { ReportOptions, ReportDocument, ReportFormat } from '@/lib/processing/types/report';
import type { WorkflowStep } from '@/lib/processing/types/workflow';

/**
 * Integrated hook for the complete document processing workflow
 */
export function useProcessingWorkflow() {
  // Current workflow step
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('idle');
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Use all specialized hooks
  const documentProcessing = useDocumentProcessing();
  const verification = useVerification(documentProcessing.extractedDocument);
  const research = useResearch(verification.verifiedDocument);
  const report = useReport(research.researchDocument);
  
  // Overall status from the currently active step
  const getActiveStatus = useMemo(() => {
    switch (workflowStep) {
      case 'extracting':
        return documentProcessing.status;
      case 'verification':
        return { 
          status: verification.verificationStatus.isVerified ? 'success' : 'processing',
          progress: verification.verificationItems.filter((item: VerificationItem) => item.isVerified).length / 
                   (verification.verificationItems.length || 1) * 100,
          phase: 'verification'
        } as ProcessingStatus;
      case 'report_generation':
        return research.status;
      case 'complete':
        return report.status;
      default:
        return { 
          status: 'pending' as const, 
          progress: 0,
          phase: 'initialization'
        };
    }
  }, [
    workflowStep, 
    documentProcessing.status, 
    verification.verificationItems, 
    verification.verificationStatus, 
    research.status, 
    report.status
  ]);
  
  /**
   * Process a document file
   */
  const processDocument = useCallback(async (
    file: File,
    patientId: string,
    documentType?: string
  ) => {
    setError(null);
    setWorkflowStep('extracting');
    
    try {
      const result = await documentProcessing.processDocument(file, patientId, documentType);
      
      if (result) {
        setWorkflowStep('verification');
        return result;
      } else {
        throw new Error('Document processing failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setWorkflowStep('idle');
      return null;
    }
  }, [documentProcessing]);
  
  /**
   * Complete verification and proceed to research
   */
  const completeVerification = useCallback(async () => {
    setError(null);
    
    try {
      const result = await verification.completeVerification();
      
      if (result) {
        setWorkflowStep('report_generation');
        return result;
      } else {
        throw new Error('Verification failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      return null;
    }
  }, [verification]);
  
  /**
   * Complete verification and proceed directly to report generation
   * (skipping the research step)
   */
  const completeVerificationToReport = useCallback(async () => {
    setError(null);
    
    try {
      const result = await verification.completeVerification();
      
      if (result) {
        // Skip research and go directly to report generation
        setWorkflowStep('report_generation');
        return result;
      } else {
        throw new Error('Verification failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      return null;
    }
  }, [verification]);
  
  /**
   * Perform research based on verified data
   */
  const performResearch = useCallback(async (
    query: string,
    options?: Omit<ResearchOptions, 'onProgress'>
  ) => {
    setError(null);
    
    try {
      const result = await research.performResearch(query, options);
      
      if (result) {
        setWorkflowStep('report_generation');
        return result;
      } else {
        throw new Error('Research failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      return null;
    }
  }, [research]);
  
  /**
   * Generate a report
   */
  const generateReport = useCallback(async (
    options?: Omit<ReportOptions, 'onProgress'>
  ) => {
    setError(null);
    
    try {
      const result = await report.generateReport(options);
      
      if (result) {
        setWorkflowStep('report_generation');
        return result;
      } else {
        throw new Error('Report generation failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      return null;
    }
  }, [report]);
  
  /**
   * Format the report
   */
  const formatReport = useCallback(async (format: ReportFormat) => {
    setError(null);
    
    try {
      const result = await report.formatReport(format);
      
      if (result) {
        setWorkflowStep('complete');
        return result;
      } else {
        throw new Error('Report formatting failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      return null;
    }
  }, [report]);
  
  /**
   * Reset the entire workflow
   */
  const resetWorkflow = useCallback(() => {
    documentProcessing.reset();
    verification.reset();
    research.clearResults();
    report.reset();
    setWorkflowStep('idle');
    setError(null);
  }, [documentProcessing, verification, research, report]);
  
  /**
   * Go back to the previous step
   */
  const goToPreviousStep = useCallback(() => {
    switch (workflowStep) {
      case 'verification':
        setWorkflowStep('extracting');
        break;
      case 'report_generation':
        setWorkflowStep('verification');
        break;
      case 'complete':
        setWorkflowStep('report_generation');
        break;
      default:
        break;
    }
  }, [workflowStep]);
  
  return {
    // Workflow state
    workflowStep,
    error,
    status: getActiveStatus,
    
    // Document data from each step
    extractedDocument: documentProcessing.extractedDocument,
    verificationItems: verification.verificationItems,
    verifiedDocument: verification.verifiedDocument,
    researchResults: research.researchResults,
    researchDocument: research.researchDocument,
    reportData: report.reportData,
    formattedReport: report.formattedReport,
    reportDocument: report.reportDocument,
    
    // Workflow actions
    processDocument,
    completeVerification,
    completeVerificationToReport,
    performResearch,
    generateReport,
    formatReport,
    resetWorkflow,
    goToPreviousStep,
    
    // Verification specific actions
    verifyItem: verification.verifyItem,
    verifyAllItems: verification.verifyAllItems,
    updateVerificationItem: verification.updateVerificationItem,
    
    // Direct access to specialized hooks
    documentProcessing,
    verification,
    research,
    report
  };
} 