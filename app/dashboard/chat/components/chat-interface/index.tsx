"use client";

// External dependencies
import type { Message, ChatRequestOptions } from "ai";
import { useEffect, useState } from "react";

// Internal types
import { DataStreamHandler } from "@/components/chat/data-stream-handler";
import { DocumentPreview } from "@/components/chat/document-preview";
import { Messages } from "@/components/chat/messages";

// Internal components
import { useToast } from "@/components/ui/use-toast";
import { useChatContext } from "@/contexts/chat-context";
import type { ChatMode } from "@/lib/chat/types";
import type { ExtractedData } from "@/lib/processing/types/extraction";
import type { VerificationItem } from "@/lib/processing/types/verification";
import type { Vote } from "@/lib/types/vote";

import { VerificationAdapter } from "../verification/verification-adapter";
import { documentService } from '@/lib/services/document/document-service';

// Adjust this to use the same workflow step type from the workflow
import type { WorkflowStep } from "@/lib/processing/types/workflow";

interface ChatInterfaceProps {
  initialMode: string;
  patientId: string;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  extractResults: {
    url: string;
    data: any;
  }[];
}

export function ChatInterface({ initialMode, patientId }: ChatInterfaceProps) {
  const { toast } = useToast();

  // Chat context / methods - updated to use the new structure
  const { 
    messages, 
    isLoading, 
    sendMessage, 
    mode,
    workflow 
  } = useChatContext();

  // Chat messages / extraction data
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    extractResults: [],
  });

  // For manual or inline doc preview
  const [activeDocument, setActiveDocument] = useState<{
    id: string;
    title: string;
    content: string;
    kind: "text" | "code" | "spreadsheet";
  } | null>(null);

  // If we extracted data to verify
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);

  // This simulates original text for verification reference
  const [originalText, setOriginalText] = useState<string>("");

  const [isProcessing, setIsProcessing] = useState(false);

  // Workflow: after verification completes, do we show "report generation" step or finalize?
  const handleVerificationComplete = (verificationItems: VerificationItem[]) => {
    // Use the workflow method to move to the next step
    workflow.generateReport();
  };

  // Once user decides to skip or finish report generation
  const handleReportGenerationComplete = () => {
    // Use the workflow method to mark workflow as complete
    if (workflow.workflowStep !== 'complete') {
      // Format the report to complete the workflow
      workflow.formatReport('pdf');
    }
    
    // Suppose we already have the final report content from somewhere, or we fetch it:
    // For demonstration, let's embed a mock final report
    const finalReportMarkdown = "**Final Report**\n\n- Diagnosis: Example Condition\n- Recommendations: Follow instructions\n";
  
    // We'll push it as an assistant message
    setChatState(prev => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: finalReportMarkdown,
          createdAt: new Date(),
        }
      ]
    }));
  };

  const handleDocumentUpload = async (file: File) => {
    try {
      setIsProcessing(true);
      
      // Use workflow methods to process the document
      await workflow.processDocument(file, patientId);
      
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
      }
    } catch (error) {
      toast({
        title: "Processing Error",
        description: "Failed to process document. Please retry or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Set chat messages
  const handleSetMessages = (
    messages: Message[] | ((prevMessages: Message[]) => Message[])
  ) => {
    setChatState((prev) => ({
      ...prev,
      messages: typeof messages === "function" ? messages(prev.messages) : messages,
    }));
  };

  // Just an example reload function
  const handleReload = async (chatRequestOptions?: ChatRequestOptions) => {
    // Implement reload logic if needed
    console.log("Reloading messages...", chatRequestOptions);
    return null;
  };

  // Conditionally render UI based on the pipeline step
  const renderContentByWorkflowStep = () => {
    // Get the current workflow step from the workflow object
    const currentWorkflowStep = workflow.workflowStep;

    switch (currentWorkflowStep) {
      case 'idle':
        return (
          <div className="bg-secondary/10 rounded border p-4">
            <p className="text-sm">
              You can upload a file to begin the extraction & verification process, or start chatting directly.
            </p>
          </div>
        );

      case 'extraction':
        return (
          <div className="bg-secondary/10 rounded border p-4">
            <h2 className="font-semibold">Extraction In Progress...</h2>
            <p className="mt-2 text-sm">
              Your document is being processed. Please wait while data is extracted.
            </p>
            {activeDocument && (
              <div className="mt-4">
                <DocumentPreview isReadonly result={activeDocument} />
              </div>
            )}
          </div>
        );

      case 'verification':
        if (!extractedData) {
          return (
            <div className="bg-secondary/10 rounded border p-4">
              <p>No extracted data found. Cannot verify.</p>
            </div>
          );
        }
        return (
          <VerificationAdapter
            departmentId="some-department-id"
            documentId={activeDocument?.id || ""}
            extractedData={extractedData}
            onCancel={() => workflow.resetWorkflow()}
            onComplete={handleReportGenerationComplete}
            originalText={originalText}
            patientId={patientId}
            workflowId={activeDocument?.id || ""}
          />
        );

      case 'report_generation':
        // Possibly show a final screen or direct the user to a "Generate Report" UI
        return (
          <div className="bg-secondary/10 rounded border p-4">
            <h2 className="font-semibold">Report Generation</h2>
            <p className="mt-2 text-sm">
              You can finalize the process by generating a comprehensive report, or skip.
            </p>
            <button
              className="mt-4 rounded bg-blue-500 px-4 py-2 text-white"
              onClick={() => {
                // If you want to call generateReport from here, do so
                handleReportGenerationComplete();
              }}
            >
              Generate Report (Mock)
            </button>
            <button
              className="ml-2 mt-4 rounded bg-gray-500 px-4 py-2 text-white"
              onClick={handleReportGenerationComplete}
            >
              Skip
            </button>
          </div>
        );

      case 'complete':
        return (
          <div className="bg-secondary/10 rounded border p-4">
            <h2 className="mb-2 font-semibold">Process Complete</h2>
            <p>You have completed the entire pipeline. You may continue the conversation or upload more documents.</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col space-y-4 p-4">
      {/* Upload Button or drag area - sample approach */}
      <div className="mb-4">
        <input
          disabled={workflow.workflowStep !== "idle" && workflow.workflowStep !== "complete"}
          onChange={async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            await handleDocumentUpload(files[0]);
            // Clear the file input
            e.target.value = "";
          }}
          type="file"
        />
      </div>

      {/* Display pipeline-based content */}
      {renderContentByWorkflowStep()}

      {/* If not actively verifying, show the standard chat UI (except for extraction in progress, etc.) */}
      {(workflow.workflowStep === "idle" ||
        workflow.workflowStep === "complete") && (
        <div className="flex-1 overflow-y-auto rounded border p-4">
          <Messages
            chatId={patientId}
            isBlockVisible={false}
            isLoading={chatState.isLoading}
            isReadonly={false}
            messages={chatState.messages}
            reload={handleReload}
            setMessages={handleSetMessages}
            votes={[] as Vote[]}
          />
        </div>
      )}

      {/* Or if you'd like to show chat even during extraction, remove the condition above. */}

      {/* Research / Extract Results - disabled temporarily */}
      {/*
      {mode === "verification" && chatState.extractResults.length > 0 && (
        <div className="space-y-4">
          <DeepResearch
            isEditing={true}
            onEdit={() => {}}
          />
          <ExtractResults
            title="Extracted Results"
            description="Here are the results extracted from your document."
            results={chatState.extractResults}
          />
        </div>
      )}
      */}

      {/* Basic message input for normal chat usage */}
      {(workflow.workflowStep === "idle" ||
        workflow.workflowStep === "complete") && (
        <div className="mt-auto">
          <form
            className="flex items-center space-x-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const input = form.elements.namedItem(
                "message"
              ) as HTMLInputElement;
              const message = input.value.trim();
              if (message) {
                input.value = "";
                await sendMessage(message);
              }
            }}
          >
            <input
              className="flex-1 rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none"
              name="message"
              placeholder="Type your message..."
              type="text"
            />
            <button
              className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
              type="submit"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
} 