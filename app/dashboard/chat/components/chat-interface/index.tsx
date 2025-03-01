"use client";

// External dependencies
import { useEffect, useState, useCallback, useRef } from "react";
import { AlertCircle, FileText, CheckCircle, RefreshCw } from "lucide-react";

// Internal components
import { useToast } from "@/components/ui/use-toast";
import { useChatContext } from "@/contexts/chat-context";
import type { Message } from "@/lib/chat/types";
import type { ExtractedData } from "@/lib/processing/types/extraction";
import type { VerificationItem } from "@/lib/processing/types/verification";
import type { ProcessingPhase, WorkflowStep } from "@/lib/workflow/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

// Import existing components from the codebase with correct paths
import { DocumentUploader } from "@/components/upload/document-uploader";
import { WorkflowStatusDisplay } from "./workflow-display";
import { ChatMessageList } from "@/components/chat/message/message-list";
import { MessageInput } from "@/components/chat/input/text-input";
import { ReportGenerationPanel } from "@/components/chat/workflow/report-panel";

interface ChatInterfaceProps {
  readonly initialMode: string;
  readonly patientId: string;
}

// Define a type for the chat state
interface ChatState {
  messages: Message[];
  isLoading: boolean;
  extractResults: Array<{
    url: string;
    data: unknown;
  }>;
}

// Define a type for the system message response that matches the actual return type
interface SystemMessageResponse extends Message {
  [key: string]: unknown;
}

// Define a proper interface for the workflow object
interface WorkflowObject {
  workflowStep: WorkflowStep;
  processDocument: (file: File, patientId: string, signal: AbortSignal) => Promise<void>;
  extractedDocument?: unknown;
  startVerification?: (summary: string) => void;
  generateReport: () => void;
  formatReport: (format: string) => void;
  addMessage?: (message: Message) => void;
  verification?: {
    isInVerificationMode: boolean;
  };
}

/**
 * Custom hook for document processing with race condition handling
 */
function useDocumentProcessing(
  workflow: WorkflowObject, 
  patientId: string, 
  addSystemMessage: (content: string, type?: string, metadata?: any) => Message,
  updateProgressMessage: (messageId: string, progress: number, phase: string) => void
) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processPhase, setProcessPhase] = useState('');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [currentUpload, setCurrentUpload] = useState<File | null>(null);
  const [activeDocument, setActiveDocument] = useState<{
    id: string;
    title: string;
    content: string;
    kind: "text" | "code" | "spreadsheet";
  } | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  
  // AbortController reference for cancelling operations
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Helper function to get the phase based on progress
  const getProcessingPhase = (progress: number): string => {
    if (progress < 25) return 'Preparing document';
    if (progress < 50) return 'Extracting content';
    if (progress < 75) return 'Analyzing document';
    return 'Preparing for verification';
  };
  
  // Cleanup function to clear intervals and abort operations
  const cleanup = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  // Process document with race condition handling
  const processDocument = useCallback(async (file: File) => {
    // Clean up any existing operations
    cleanup();
    
    // Create new AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    setIsProcessing(true);
    setProcessProgress(0);
    setProcessPhase('Preparing document');
    setProcessingError(null);
    setCurrentUpload(file);
    
    // Add a system message indicating document processing has started
    const processingMsg = addSystemMessage(
      "Processing your document. This may take a moment...",
      "progress",
      { isProgress: true, progressValue: 0, progressPhase: "extraction" }
    );
    
    // Progress interval for simulating document processing progress
    progressIntervalRef.current = setInterval(() => {
      // Check if operation was aborted
      if (abortController.signal.aborted) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        return;
      }
      
      setProcessProgress(prev => {
        const newProgress = prev + 5;
        const currentPhase = getProcessingPhase(newProgress);
        
        // Update the phases based on progress
        if (newProgress === 25) {
          setProcessPhase('Extracting content');
        } else if (newProgress === 50) {
          setProcessPhase('Analyzing document');
        } else if (newProgress === 75) {
          setProcessPhase('Preparing for verification');
        }
        
        // Update the processing message with current progress
        if (processingMsg && processingMsg.id) {
          updateProgressMessage(processingMsg.id, newProgress, currentPhase);
        }
        
        return newProgress >= 100 ? 100 : newProgress;
      });
    }, 300);
    
    try {
      // Use workflow methods to process the document with abort signal
      await workflow.processDocument(file, patientId, abortController.signal);
      
      // If we want to access extracted document data:
      if (workflow.extractedDocument) {
        setExtractedData(workflow.extractedDocument as unknown as ExtractedData);
        
        // Mock setting some document preview data
        setActiveDocument({
          id: crypto.randomUUID(),
          title: file.name,
          content: "Document content would appear here...",
          kind: "text"
        });
        
        // After successful processing, add a message about the document
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setProcessProgress(100);
        setProcessPhase('Processing complete');
        
        // Add document completion message
        setTimeout(() => {
          // If appropriate for your flow, add a summary message that can be verified
          if (workflow.workflowStep === 'verification') {
            addSystemMessage(
              "Document processed successfully. Please review the extracted information below and confirm it's accurate, or provide corrections.",
              "verification_prompt"
            );
            
            // In a real application, you would have the actual extracted data here
            const extractedSummary = `
## Patient Information
- **Name**: John Doe
- **Age**: 45
- **Date of Birth**: January 15, 1978

## Medical History
- Hypertension (diagnosed 2015)
- Type 2 Diabetes (diagnosed 2018)
- History of lower back pain

## Current Medications
- Lisinopril 10mg daily
- Metformin 500mg twice daily
- Ibuprofen as needed for pain

## Recent Test Results
- Blood Pressure: 135/85
- Blood Glucose: 142 mg/dL (fasting)
- A1C: 7.1%
`;
            
            // Start verification with the extracted summary
            if (workflow.startVerification) {
              workflow.startVerification(extractedSummary);
            }
          }
        }, 1000);
      }
    } catch (error) {
      // Only handle error if not aborted
      if (!abortController.signal.aborted) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        
        const errorMsg = error instanceof Error ? error.message : "An unknown error occurred";
        setProcessingError(errorMsg);
        setProcessProgress(0);
        
        // Differentiate between network errors and processing errors
        const isNetworkError = error instanceof TypeError && 
          (error.message.includes('network') || error.message.includes('fetch'));
        
        toast({
          title: isNetworkError ? "Network Error" : "Processing Error",
          description: isNetworkError 
            ? "Failed to connect to the server. Please check your internet connection and try again."
            : "Failed to process document. Please try again or contact support.",
          variant: "destructive"
        });
        
        addSystemMessage(
          `There was an error processing your document: ${errorMsg}. Would you like to try uploading it again?`,
          "error",
          { isError: true }
        );
      }
    } finally {
      // Only update state if not aborted
      if (!abortController.signal.aborted) {
        setIsProcessing(false);
      }
    }
  }, [workflow, patientId, addSystemMessage, updateProgressMessage, getProcessingPhase, toast, cleanup]);
  
  // Retry processing with the current upload
  const retryProcessing = useCallback(() => {
    if (currentUpload) {
      void processDocument(currentUpload);
    } else {
      toast({
        title: "No document to retry",
        description: "Please upload a document first.",
        variant: "destructive"
      });
    }
  }, [currentUpload, processDocument, toast]);
  
  return {
    isProcessing,
    processProgress,
    processPhase,
    processingError,
    currentUpload,
    activeDocument,
    extractedData,
    processDocument,
    retryProcessing,
    setCurrentUpload
  };
}

/**
 * Custom hook for verification flow
 */
function useVerificationFlow(
  workflow: WorkflowObject,
  addSystemMessage: (content: string, type?: string, metadata?: any) => Message
) {
  const [inVerificationMode, setInVerificationMode] = useState(false);
  const [verificationPrompted, setVerificationPrompted] = useState(false);
  
  // Update verification mode based on workflow
  useEffect(() => {
    setInVerificationMode(
      Boolean(workflow.verification?.isInVerificationMode) || 
      workflow.workflowStep === 'verification'
    );
  }, [workflow.verification?.isInVerificationMode, workflow.workflowStep]);
  
  // Add verification instructions when entering verification mode
  useEffect(() => {
    if (inVerificationMode && !verificationPrompted) {
      setVerificationPrompted(true);
      
      // Delay the prompt slightly for better UX
      const timeoutId = setTimeout(() => {
        addSystemMessage(
          "Please review the information above. You can:\n\n" +
          "- Type 'confirm' to approve it as accurate\n" +
          "- Type corrections directly to fix any issues\n" +
          "- Ask questions if you need clarification",
          "verification_instructions"
        );
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [inVerificationMode, verificationPrompted, addSystemMessage]);
  
  // Handle verification completion
  const completeVerification = useCallback((_verificationItems: VerificationItem[]) => {
    // Use the workflow method to move to the next step
    workflow.generateReport();
    // Add a system message indicating we're ready to generate a report
    addSystemMessage(
      "Verification complete! Would you like to generate a report with the verified information?",
      "verification_complete"
    );
    setVerificationPrompted(false);
    return true;
  }, [workflow, addSystemMessage]);
  
  // Handle continue after verification
  const continueAfterVerification = useCallback(() => {
    workflow.generateReport();
    setVerificationPrompted(true);
    addSystemMessage(
      "Would you like to generate a report based on the verified information?",
      "verification_complete"
    );
  }, [workflow, addSystemMessage]);
  
  return {
    inVerificationMode,
    verificationPrompted,
    completeVerification,
    continueAfterVerification
  };
}

/**
 * Custom hook for report generation
 */
function useReportGeneration(
  workflow: WorkflowObject,
  addSystemMessage: (content: string, type?: string, metadata?: any) => Message,
  updateProgressMessage: (messageId: string, progress: number, phase: string) => void
) {
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportProgress, setReportProgress] = useState(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Show or hide the report generation panel based on workflow step
  useEffect(() => {
    if (workflow.workflowStep === 'report_generation') {
      setShowReportPanel(true);
    } else {
      setShowReportPanel(false);
    }
  }, [workflow.workflowStep]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);
  
  // Generate the final report
  const generateReport = useCallback((notes: string) => {
    setIsGeneratingReport(true);
    setReportProgress(0);
    
    // Add a message indicating report generation has started
    const progressMsg = addSystemMessage(
      "Generating your report. This may take a moment...",
      "progress",
      { isProgress: true, progressValue: 0, progressPhase: "report_generation" }
    );
    
    // Simulate report generation with progress updates
    progressIntervalRef.current = setInterval(() => {
      setReportProgress(prev => {
        const newProgress = prev + 10;
        
        // Update progress message
        if (progressMsg?.id) {
          updateProgressMessage(progressMsg.id, newProgress, "Generating report");
        }
        
        if (newProgress >= 100) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
          
          setTimeout(() => {
            // Format the report to complete the workflow
            workflow.formatReport('pdf');
            
            // Add a report message to the chat
            const finalReportMarkdown = `**Final Report**\n\n- Diagnosis: Example Condition\n- Recommendations: Follow instructions\n${notes ? `\n**Additional Notes:** ${notes}` : ""}`;
            
            addSystemMessage(
              "Report generation complete!",
              "report_complete"
            );
            
            const newMessage: Message = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: finalReportMarkdown,
              createdAt: new Date(),
              metadata: {
                isReport: true
              }
            };
            
            // Add the report message
            if (workflow.addMessage) {
              workflow.addMessage(newMessage);
            }
            
            setIsGeneratingReport(false);
            setShowReportPanel(false);
          }, 500);
        }
        
        return newProgress;
      });
    }, 400);
    
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [workflow, addSystemMessage, updateProgressMessage]);
  
  // Skip report generation
  const skipReport = useCallback(() => {
    workflow.formatReport('pdf');
    setShowReportPanel(false);
    addSystemMessage(
      "Report generation skipped. You can continue chatting or upload a new document.",
      "workflow_complete"
    );
  }, [workflow, addSystemMessage]);
  
  return {
    showReportPanel,
    isGeneratingReport,
    reportProgress,
    generateReport,
    skipReport,
    setShowReportPanel
  };
}

export function ChatInterface({ initialMode: _initialMode, patientId }: ChatInterfaceProps) {
  const { toast } = useToast();

  // Chat context / methods
  const { 
    messages: contextMessages, 
    isLoading: contextIsLoading, 
    sendMessage, 
    workflow,
    addSystemMessage,
  } = useChatContext();
  
  // Chat messages / extraction data
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    extractResults: [],
  });
  
  // Function to update progress messages
  const updateProgressMessage = useCallback((
    messageId: string,
    progress: number,
    phase: string
  ) => {
    setChatState(prev => {
      const messages = [...prev.messages];
      const msgIndex = messages.findIndex(m => m.id === messageId);
      
      if (msgIndex !== -1) {
        messages[msgIndex] = {
          ...messages[msgIndex],
          metadata: {
            ...messages[msgIndex].metadata,
            progressValue: progress,
            progressPhase: phase
          }
        };
      }
      
      return {
        ...prev,
        messages
      };
    });
  }, []);
  
  // Use custom hooks with type assertion for workflow
  const documentProcessing = useDocumentProcessing(
    workflow as unknown as WorkflowObject, 
    patientId, 
    addSystemMessage,
    updateProgressMessage
  );
  
  const verificationFlow = useVerificationFlow(
    workflow as unknown as WorkflowObject,
    addSystemMessage
  );
  
  const reportGeneration = useReportGeneration(
    workflow as unknown as WorkflowObject,
    addSystemMessage,
    updateProgressMessage
  );
  
  // Use context messages when they change
  useEffect(() => {
    if (contextMessages && contextMessages.length > 0) {
      setChatState(prev => ({
        ...prev,
        messages: contextMessages as Message[],
      }));
    }
  }, [contextMessages]);

  // Use context loading state
  useEffect(() => {
    setChatState(prev => ({
      ...prev,
      isLoading: contextIsLoading,
    }));
  }, [contextIsLoading]);
  
  // Helper to render the error recovery UI
  const renderErrorRecovery = () => {
    if (!documentProcessing.processingError) return null;
    
    return (
      <Alert className="mb-4">
        <AlertCircle className="size-4" />
        <AlertTitle>Document Processing Failed</AlertTitle>
        <AlertDescription>
          {documentProcessing.processingError}
          <div className="mt-2 flex gap-2">
            <Button 
              className="gap-1" 
              onClick={documentProcessing.retryProcessing} 
              size="sm"
              variant="outline"
            >
              <RefreshCw className="size-3" /> Retry
            </Button>
            <Button 
              onClick={() => documentProcessing.setCurrentUpload(null)} 
              size="sm" 
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  };

  // Render the workflow status indicator
  const renderWorkflowStatus = () => {
    if (workflow.workflowStep === 'idle' || workflow.workflowStep === 'complete') {
      return null;
    }
    
    return (
      <div className="bg-muted/50 flex items-center gap-2 border-b px-4 py-2">
        <Badge className="gap-1" variant="outline">
          {verificationFlow.inVerificationMode ? (
            <>
              <CheckCircle className="size-3" />
              <span>Verification Mode</span>
            </>
          ) : (
            <>
              <FileText className="size-3" />
              <span>Processing Document</span>
            </>
          )}
        </Badge>
        {documentProcessing.isProcessing && (
          <>
            <Progress className="h-2 flex-1" value={documentProcessing.processProgress} />
            <span className="text-muted-foreground text-xs">{documentProcessing.processPhase}</span>
          </>
        )}
      </div>
    );
  };
  
  // Process a confirmation message based on the chat input
  const handleMessageSubmit = async (message: string) => {
    const lowerMessage = message.toLowerCase().trim();
    
    // Handle verification confirmations and report generation requests
    if (verificationFlow.inVerificationMode && (lowerMessage === 'confirm' || lowerMessage === 'approve')) {
      await sendMessage(message);
      verificationFlow.completeVerification([]);
      return;
    }
    
    if (workflow.workflowStep === 'report_generation') {
      if (lowerMessage === 'yes' || lowerMessage.includes('generate report')) {
        await sendMessage(message);
        reportGeneration.setShowReportPanel(true);
        return;
      } else if (lowerMessage === 'no' || lowerMessage.includes('skip')) {
        await sendMessage(message);
        reportGeneration.skipReport();
        return;
      }
    }
    
    // Default handling for other messages
    await sendMessage(message);
  };
  
  // Get dynamic placeholder text based on current state
  const getDynamicPlaceholder = () => {
    if (verificationFlow.inVerificationMode) {
      return "Type 'confirm' to approve or enter corrections...";
    } else if (workflow.workflowStep === 'report_generation') {
      return "Type 'yes' to generate a report or 'no' to skip...";
    }
    return "Type a message...";
  };

  return (
    <div className="flex h-full flex-col">
      {/* Document uploader */}
      <div className="border-b p-4">
        <DocumentUploader 
          allowedTypes={['.pdf', '.docx', '.txt', '.jpg', '.png']}
          description="Upload a document to begin processing"
          multiple={false}
          onComplete={(fileUpload) => {
            // Handle the completed upload by fetching the file from the URL
            // Since FileUpload doesn't contain the File object directly
            fetch(fileUpload.url)
              .then(response => {
                if (!response.ok) {
                  throw new Error('Failed to fetch document');
                }
                return response.blob();
              })
              .then(blob => {
                // Create a File object from the blob
                const file = new File(
                  [blob], 
                  fileUpload.metadata?.originalFilename ?? 'document', 
                  { type: fileUpload.contentType ?? '' }
                );
                return documentProcessing.processDocument(file);
              })
              .catch(error => {
                toast({
                  title: "Processing Error",
                  description: "Failed to process the uploaded document",
                  variant: "destructive"
                });
                // eslint-disable-next-line no-console
                console.error('Document processing error:', error);
              });
          }}
          onError={(error) => {
            toast({
              title: "Upload Error",
              description: error,
              variant: "destructive"
            });
          }}
          onStatusChange={(status) => {
            // Update UI based on upload status if needed
            if (status.status === 'uploading') {
              // Show uploading state
            }
          }}
          showProgress={true}
        />
      </div>
      
      {/* Workflow status indicator */}
      {renderWorkflowStatus()}
      
      {/* Error recovery UI */}
      {documentProcessing.processingError && (
        <div className="px-4 pt-4">
          {renderErrorRecovery()}
        </div>
      )}
      
      {/* Workflow content based on current step */}
      {workflow.workflowStep !== "idle" && workflow.workflowStep !== "complete" && !verificationFlow.inVerificationMode && (
        <div className="px-4 pt-4">
          <WorkflowStatusDisplay 
            activeDocument={documentProcessing.activeDocument}
            currentPhase={documentProcessing.processPhase as ProcessingPhase}
            currentStep={workflow.workflowStep as WorkflowStep}
            onContinueAction={verificationFlow.continueAfterVerification}
            onGenerateReportAction={() => reportGeneration.setShowReportPanel(true)}
            onSkipReportAction={reportGeneration.skipReport}
          />
        </div>
      )}
      
      {/* Report generation panel */}
      <ReportGenerationPanel
        isGenerating={reportGeneration.isGeneratingReport}
        onCancel={() => reportGeneration.setShowReportPanel(false)}
        onGenerateReport={reportGeneration.generateReport}
        visible={reportGeneration.showReportPanel}
      />
      
      {/* Chat message list - always visible to maintain conversation flow */}
      <ChatMessageList 
        isLoading={chatState.isLoading}
        messages={chatState.messages}
      />
      
      {/* Message input - always available for continuation of chat */}
      <MessageInput 
        isDisabled={chatState.isLoading || documentProcessing.isProcessing || reportGeneration.isGeneratingReport}
        onSendMessage={handleMessageSubmit}
        placeholder={getDynamicPlaceholder()}
      />
    </div>
  );
} 