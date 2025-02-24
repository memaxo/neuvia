"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/contexts/chat-context";
import type { WorkflowStep } from "@/contexts/chat-context";
import { ExtractionLoading } from "./extraction-loading";
import { VerificationUI } from "./verification/verification-ui";

/**
 * This demonstrates a linear wizard controlling the entire flow:
 * 1. Upload
 * 2. Extraction
 * 3. Verification
 * 4. Report Generation
 * 5. Complete
 *
 * We assume you have the relevant components for each step, reusing the context for data.
 */

export function ReportWizard() {
  const { state, setWorkflowStep, processDocument, verifyExtractedData } = useChat();

  const handleUploadClick = async (file: File) => {
    setWorkflowStep("uploading");
    // Perform your file read or pass to processDocument
    await processDocument(file);
  };

  const handleVerify = async (verificationItems: any[]) => {
    // user verified the data
    await verifyExtractedData(verificationItems);
  };

  const handleGoToReport = () => {
    setWorkflowStep("report_generation");
  };

  const handleFinish = () => {
    setWorkflowStep("complete");
  };

  function renderStep(step: WorkflowStep) {
    switch (step) {
      case "idle":
        return (
          <div className="flex flex-col items-center gap-4">
            <p>Start your workflow by uploading a file.</p>
            <input
              type="file"
              onChange={async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;
                await handleUploadClick(files[0]);
              }}
            />
          </div>
        );

      case "uploading":
        return (
          <div className="mt-6 text-center">
            <p className="text-sm">Uploading your file, please wait...</p>
          </div>
        );

      case "extracting":
        return (
          <ExtractionLoading
            progress={state.processingStatus?.progress ?? null}
            error={state.error ?? null}
            isAnalyzing={true}
            onRetry={() => setWorkflowStep("uploading")}
            onCancel={() => setWorkflowStep("idle")}
          />
        );

      case "verification":
        if (!state.extractedData) {
          return (
            <div className="p-4 text-center">
              <p>No extracted data to verify. Possibly an error occurred.</p>
              <Button onClick={() => setWorkflowStep("idle")}>Go Back</Button>
            </div>
          );
        }
        return (
          <VerificationUI
            extractedData={state.extractedData}
            originalText={"Original text from file?"}
            onVerify={handleVerify}
            onComplete={handleGoToReport}
            patientId={"some-patient-id"}
            departmentId={"some-department-id"}
          />
        );

      case "report_generation":
        // Additional check: ensure user has completed verification
        const notAllVerified = !state.extractedData || state.workflowStep !== "report_generation";
        return (
          <div className="p-4">
            <h2 className="mb-2 text-lg font-semibold">Generate Report</h2>
            <p className="mb-4 text-sm">
              Please verify the extracted data before proceeding to generate a report.
              This step ensures human oversight and accurate information.
            </p>
            <Button
              onClick={handleFinish}
              disabled={notAllVerified}
            >
              Generate Mock Report
            </Button>
            {notAllVerified && (
              <p className="mt-2 text-red-500 text-sm">
                Verification is not completed. You must complete verification first.
              </p>
            )}
          </div>
        );

      case "complete":
        return (
          <div className="p-4 text-center">
            <h2 className="text-lg font-semibold">All Done!</h2>
            <p className="mb-4 text-sm">Your document is verified and a report generated.</p>
            <Button onClick={() => setWorkflowStep("idle")}>Start Over</Button>
          </div>
        );

      default:
        return (
          <div className="p-4">
            <p>Unknown step: {step}</p>
          </div>
        );
    }
  }

  return (
    <div className="rounded border p-6">
      <h1 className="mb-4 text-xl font-bold">Report Wizard</h1>
      {renderStep(state.workflowStep)}
    </div>
  );
}