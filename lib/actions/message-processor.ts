import { ChatMode, Message } from '@/lib/chat/types';
import { ChatAction } from '@/lib/chat/types';
import { chatActions } from './chat-actions';
import type { Dispatch } from 'react';
import type { UseProcessingWorkflowResult } from '@/lib/chat/types';

/**
 * Process a message based on the current chat mode
 */
export async function processMessage(
  content: string, 
  mode: ChatMode,
  dispatch: Dispatch<ChatAction>,
  workflow: UseProcessingWorkflowResult
): Promise<void> {
  const normalizedContent = content.toLowerCase().trim();
  
  // Handle verification mode
  if (mode === 'verification') {
    await handleVerificationMessage(normalizedContent, content, dispatch, workflow);
  }
  // Handle report generation mode
  else if (mode === 'report_generation') {
    await handleReportGenerationMessage(normalizedContent, content, dispatch, workflow);
  }
  // Default chat handling
  else {
    await handleDefaultChatMessage(content, dispatch, workflow);
  }
}

/**
 * Handle a message in verification mode
 */
async function handleVerificationMessage(
  normalizedContent: string,
  originalContent: string,
  dispatch: Dispatch<ChatAction>,
  workflow: UseProcessingWorkflowResult
): Promise<void> {
  // Handle confirmation
  if (normalizedContent === 'confirm' || normalizedContent === 'approve') {
    // Complete verification
    dispatch(chatActions.completeVerification(true));
    
    if (workflow.completeVerification) {
      try {
        await workflow.completeVerification(true);
      } catch (error) {
        console.error('Error completing verification:', error);
        dispatch(chatActions.setError('Failed to complete verification'));
        return;
      }
    }
    
    // Add system message
    dispatch(chatActions.addMessage({
      role: 'system',
      content: 'Verification completed. Would you like to generate a report?',
      createdAt: new Date(),
      metadata: {
        type: 'verification_complete'
      }
    }));
    
    // Transition to report generation
    dispatch(chatActions.startReportGeneration());
    if (workflow.generateReport) {
      workflow.generateReport();
    }
  }
  // Handle rejection
  else if (normalizedContent === 'reject' || normalizedContent === 'decline') {
    dispatch(chatActions.addMessage({
      role: 'system',
      content: 'Verification rejected. Please provide details on what needs to be corrected.',
      createdAt: new Date(),
      metadata: {
        type: 'verification_rejected'
      }
    }));
  }
  // Handle corrections
  else if (
    normalizedContent.startsWith('correct:') || 
    normalizedContent.includes('needs correction') ||
    normalizedContent.includes('fix this') ||
    normalizedContent.includes('change this')
  ) {
    const correctionText = normalizedContent.startsWith('correct:') 
      ? originalContent.substring(8).trim() 
      : originalContent;
      
    dispatch(chatActions.submitCorrection(correctionText));
    
    // Process the correction
    if (workflow.processCorrection) {
      dispatch(chatActions.addMessage({
        role: 'system',
        content: 'Processing your correction...',
        createdAt: new Date(),
        metadata: {
          isProgress: true,
          progressValue: 0,
          progressPhase: 'correction'
        }
      }));
      
      try {
        // This should get the current summary from the state
        // For now, we'll rely on the workflow having access to it
        const result = await workflow.processCorrection(
          '', // Current summary would be passed here
          correctionText,
          crypto.randomUUID()
        );
        
        if (result && result.summary) {
          // Add the corrected summary
          dispatch(chatActions.addMessage({
            role: 'assistant',
            content: result.summary,
            createdAt: new Date(),
            metadata: {
              isSummary: true,
              summaryVersionId: result.summaryId,
              verificationMetadata: {
                verificationStatus: 'in_progress',
                correctionCount: result.correctionCount
              }
            }
          }));
        }
      } catch (error) {
        console.error('Error processing correction:', error);
        
        dispatch(chatActions.setError(
          error instanceof Error ? error.message : 'Error processing correction'
        ));
        
        dispatch(chatActions.addMessage({
          role: 'system',
          content: `Error processing correction: ${
            error instanceof Error ? error.message : 'Unknown error'
          }. Please try again or simplify your correction.`,
          createdAt: new Date(),
          metadata: {
            type: 'error',
            isError: true
          }
        }));
      }
    }
  }
  // Handle other messages in verification mode normally
  else {
    // Just add the user's question as a regular message
    dispatch(chatActions.addMessage({
      role: 'assistant',
      content: `I'm in verification mode. You can type "confirm" to approve the document, or provide corrections.`,
      createdAt: new Date()
    }));
  }
}

/**
 * Handle a message in report generation mode
 */
async function handleReportGenerationMessage(
  normalizedContent: string,
  originalContent: string,
  dispatch: Dispatch<ChatAction>,
  workflow: UseProcessingWorkflowResult
): Promise<void> {
  // Handle confirmation to generate report
  if (
    normalizedContent === 'yes' || 
    normalizedContent.includes('generate report') || 
    normalizedContent.includes('create report')
  ) {
    dispatch(chatActions.addMessage({
      role: 'system',
      content: 'Generating your report. This may take a moment...',
      createdAt: new Date(),
      metadata: {
        isProgress: true,
        progressValue: 0,
        progressPhase: 'report_generation'
      }
    }));
    
    if (workflow.formatReport) {
      try {
        // Choose a format based on user's message
        const format = 
          normalizedContent.includes('pdf') ? 'pdf' : 
          normalizedContent.includes('docx') ? 'docx' : 
          normalizedContent.includes('html') ? 'html' : 
          'pdf'; // Default format
          
        await workflow.formatReport(format);
        
        // Add a report complete message
        dispatch(chatActions.addMessage({
          role: 'system',
          content: 'Report generation complete!',
          createdAt: new Date(),
          metadata: {
            type: 'report_complete'
          }
        }));
        
        // Generate mock report content
        const reportContent = `**Final Report**\n\n- Diagnosis: Example Condition\n- Recommendations: Follow instructions\n\n**Additional Notes:** ${
          normalizedContent.includes('with notes') ? 'User requested additional notes.' : ''
        }`;
        
        // Add the report as a message
        dispatch(chatActions.addMessage({
          role: 'assistant',
          content: reportContent,
          createdAt: new Date(),
          metadata: {
            isReport: true
          }
        }));
        
        // Complete report generation
        dispatch(chatActions.completeReportGeneration({
          content: reportContent,
          format: format
        }));
      } catch (error) {
        console.error('Error generating report:', error);
        
        dispatch(chatActions.setError(
          error instanceof Error ? error.message : 'Error generating report'
        ));
        
        dispatch(chatActions.addMessage({
          role: 'system',
          content: `Error generating report: ${
            error instanceof Error ? error.message : 'Unknown error'
          }. Please try again.`,
          createdAt: new Date(),
          metadata: {
            type: 'error',
            isError: true
          }
        }));
      }
    }
  }
  // Handle skipping report generation
  else if (
    normalizedContent === 'no' || 
    normalizedContent.includes('skip') || 
    normalizedContent.includes('cancel')
  ) {
    dispatch(chatActions.addMessage({
      role: 'system',
      content: 'Report generation skipped. You can continue chatting or upload a new document.',
      createdAt: new Date(),
      metadata: {
        type: 'workflow_complete'
      }
    }));
    
    dispatch(chatActions.completeReportGeneration(null));
    
    if (workflow.formatReport) {
      try {
        // Format a minimal report
        await workflow.formatReport('none');
      } catch (error) {
        console.error('Error completing workflow:', error);
      }
    }
  }
  // Handle other messages in report generation mode
  else {
    dispatch(chatActions.addMessage({
      role: 'assistant',
      content: 'Would you like me to generate a report based on the verified information? Type "yes" to generate or "no" to skip.',
      createdAt: new Date()
    }));
  }
}

/**
 * Handle a message in default chat mode
 */
async function handleDefaultChatMessage(
  content: string,
  dispatch: Dispatch<ChatAction>,
  workflow: UseProcessingWorkflowResult
): Promise<void> {
  // Check current workflow step
  const currentWorkflowStep = workflow.workflowStep;
  
  // In extraction or other processing steps
  if (currentWorkflowStep === 'extraction') {
    dispatch(chatActions.addMessage({
      role: 'assistant',
      content: 'I\'m currently processing a document. Please wait for the extraction to complete.',
      createdAt: new Date()
    }));
    return;
  }
  
  // Default chat handling - simulate a basic response
  dispatch(chatActions.addMessage({
    role: 'assistant',
    content: `I received your message: "${content}".`,
    createdAt: new Date()
  }));
} 