"use client";

// External dependencies
import type { Message, ChatRequestOptions } from "ai";
import { useEffect, useState } from "react";

// Internal types
import { DataStreamHandler } from "@/components/chat/data-stream-handler";
import { DocumentPreview } from "@/components/chat/document-preview";
import { Messages } from "@/components/chat/messages";
import { DeepResearch } from "@/components/research/deep-research";
import { ExtractResults } from "@/components/research/extract-results";

// Internal components
import { useToast } from "@/components/ui/use-toast";
import { useChat } from "@/contexts/chat-context";
import type { ChatMode } from "@/lib/chat/types";
import type { VerificationItem, ExtractedData } from "@/lib/processing/types";
import type { Vote } from "@/lib/types/vote";

import { VerificationAdapter } from "../verification/verification-adapter";
import { documentService } from '@/lib/services/document/document-service';

type WorkflowStep =
  | "idle"
  | "uploading"
  | "extracting"
  | "verification"
  | "report_generation"
  | "complete";

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

  // Chat context / methods
  const { state, sendMessage, processDocument } = useChat();

  // Pipeline step to enforce flow: uploading -> extracting -> verification -> ...
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("idle");

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
    // If you'd like to confirm all verified, go next step
    // For now, we go to "report_generation" or finalize
    setWorkflowStep("report_generation");
  };

  // Once user decides to skip or finish report generation
  const handleReportGenerationComplete = () => {
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
        },
      ],
    }));
  
    setWorkflowStep("complete");
    toast({
      title: "Workflow Complete",
      description: "Your document is verified and (optionally) a report is generated.",
    });
  }

  // Document upload from chat (unifying logic with the standard processDocument)
  const handleDocumentUpload = async (file: File) => {
    setWorkflowStep("uploading");
    try {
      setIsProcessing(true);
      // For preview
      const documentId = crypto.randomUUID();
      const fileText = await file.text();
      setActiveDocument({
        id: documentId,
        title: file.name,
        content: fileText,
        kind: "text",
      });
      setOriginalText(fileText);

      // Next step: extracting
      setWorkflowStep("extracting");

      // Process document using unified document service
      const { extractedDocument, workflowId } = await documentService.processDocument(file, {
        patientId,
        onStatusUpdate: (status) => {
          // Update UI with processing status if needed
          console.log('Document processing status:', status);
        }
      });
      
      if (extractedDocument && extractedDocument.isSuccessful) {
        setExtractedData(extractedDocument.extractedData);
      }

      // Move to verification
      setWorkflowStep("verification");
    } catch (error) {
      console.error("Error processing document:", error);
      toast({
        title: "Error",
        description: "Failed to process document. Please retry or contact support.",
        variant: "destructive",
      });
      setWorkflowStep("idle");
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
    switch (workflowStep) {
      case "idle":
      case "uploading":
        return (
          <div className="bg-secondary/10 rounded border p-4">
            <p className="text-sm">
              You can upload a file to begin the extraction & verification process, or start chatting directly.
            </p>
          </div>
        );

      case "extracting":
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
            {isProcessing && activeDocument && (
              <DataStreamHandler id={activeDocument.id} />
            )}
          </div>
        );

      case "verification":
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
            onCancel={() => setWorkflowStep("idle")}
            onComplete={handleReportGenerationComplete}
            originalText={originalText}
            patientId={patientId}
            workflowId={activeDocument?.id || ""}
          />
        );

      case "report_generation":
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

      case "complete":
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
          disabled={workflowStep !== "idle" && workflowStep !== "complete"}
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
      {(workflowStep === "idle" ||
        workflowStep === "complete" ||
        workflowStep === "uploading") && (
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

      {/* Research / Extract Results (if you keep them in normal mode) */}
      {state.mode === "verification" && chatState.extractResults.length > 0 && (
        <div className="space-y-4">
          <DeepResearch
            activity={[]}
            isActive={true}
            isLoading={isProcessing}
            onToggle={() => {}}
            sources={[]}
          />
          <ExtractResults
            isLoading={chatState.isLoading}
            results={chatState.extractResults}
            title="Extracted Data"
          />
        </div>
      )}

      {/* Basic message input for normal chat usage */}
      {(workflowStep === "idle" ||
        workflowStep === "complete" ||
        workflowStep === "uploading") && (
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