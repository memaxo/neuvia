"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useChat } from "@/contexts/chat-context"; // New: We'll store verification in the chat context

import { DataDisplay } from "./data-display";
import { VerificationControls } from "./verification-controls";

// Types
import type { ExtractedData, VerificationItem } from "@/lib/processing/types";

/**
 * VerificationUI Props
 * - extractedData: the data that was extracted, potentially incomplete
 * - originalText: the raw text used for reference
 * - onVerify: callback once user finishes verifying
 * - onComplete: final step if the user chooses to skip or after generating a report
 * - patientId, departmentId: used if we pass them to generate the final report
 */
interface VerificationUIProps {
  extractedData: ExtractedData;
  originalText: string;
  onVerify: (verificationItems: VerificationItem[]) => void;
  onComplete: () => void;
  patientId: string;
  departmentId: string;
}

export function VerificationUI({
  extractedData,
  originalText,
  onVerify,
  onComplete,
  patientId,
  departmentId,
}: VerificationUIProps) {
  const router = useRouter();
  const { toast } = useToast();

  // We'll store a local copy of the extracted items in a verificationItems array
  const [verificationItems, setVerificationItems] =
    useState<VerificationItem[]>(generateVerificationItems(extractedData));

  // We track the active section in the UI, default to the first key or "demographics"
  const initialSection = Object.keys(extractedData)?.[0] || "demographics";
  const [activeSection, setActiveSection] = useState<keyof ExtractedData>(
    initialSection as keyof ExtractedData
  );

  // We'll track if user can proceed to generating a report
  const [showReportPrompt, setShowReportPrompt] = useState(false);

  // We'll track error messages if user tries to proceed without verifying
  const [errorMessage, setErrorMessage] = useState("");

  // Access the chat context to store verified data
  const { updateVerifiedData } = useChat();

  // Handle changes to verification items
  const handleVerification = (
    itemId: string,
    isVerified: boolean,
    corrections?: Record<string, any>
  ) => {
    setVerificationItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, isVerified, corrections }
          : item
      )
    );
  };

  // Attempt to finalize verification for the active section
  const handleSectionComplete = () => {
    // Check if all items are verified
    const allVerified = verificationItems.every((item) => item.isVerified);

    // If not all verified, show error
    if (!allVerified) {
      setErrorMessage(
        "Some fields are not verified. Please verify or correct all extracted data before proceeding."
      );
      return;
    }
    setErrorMessage(""); // Clear errors
    onVerify(verificationItems); // Let parent know we verified everything
    // Store corrected data in chat context so we can reuse for final report
    updateVerifiedData(assembleVerifiedData(verificationItems));

    // Move to the next stage
    setShowReportPrompt(true);
  };

  // If user decides to skip or after finishing, we run onComplete
  const handleSkipReport = () => {
    setShowReportPrompt(false);
    onComplete();
  };

  // Actually generate a final report
  const handleGenerateReport = async () => {
    try {
      // We'll call the server action from e.g. /dashboard/reports/actions
      // We'll pass the corrected data from the chat context or from verificationItems
      // For demonstration, we'll do a mock call here
      updateVerifiedData(assembleVerifiedData(verificationItems));

      // Mock: Just show a success toast
      toast({
        title: "Generating Report",
        description:
          "We are now generating a comprehensive medical report based on your verified data.",
      });

      // In a real scenario, we might do something like:
      // const result = await generateReport(...)
      // if (result.success) { router.push(...) }
      // else show error
      // For now, let's just finalize
      onComplete();
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Error",
        description:
          "Failed to generate report. Please check your data and try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-background p-4">
      <h2 className="text-xl font-semibold">Verify Extracted Information</h2>

      {/* Section Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Object.keys(extractedData).map((sectionKey) => (
          <button
            key={sectionKey}
            className={`rounded-full px-3 py-1 text-sm ${
              activeSection === sectionKey
                ? "bg-primary text-primary-foreground"
                : "bg-secondary hover:bg-secondary/80"
            }`}
            onClick={() =>
              setActiveSection(sectionKey as keyof ExtractedData)
            }
          >
            {sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}
          </button>
        ))}
      </div>

      {/* Show data display + verification controls */}
      <div className="flex gap-4">
        {/* Left side: data display */}
        <div className="flex-1">
          <DataDisplay
            data={extractedData[activeSection]}
            verificationItems={verificationItems.filter(
              (item) => item.section === activeSection
            )}
          />
        </div>

        {/* Right side: verification controls */}
        <div className="w-1/3 border-l pl-4">
          <VerificationControls
            items={verificationItems.filter(
              (item) => item.section === activeSection
            )}
            onVerify={handleVerification}
          />
        </div>
      </div>

      {/* Original text reference */}
      <div className="mt-4">
        <h3 className="mb-2 font-medium">Original Text</h3>
        <div className="max-h-40 overflow-y-auto rounded bg-muted p-2">
          {originalText}
        </div>
      </div>

      {/* Show any error messages */}
      {errorMessage && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {/* If everything is verified, prompt user to generate a report */}
      {showReportPrompt && (
        <div className="mt-4 rounded-lg border bg-muted p-4">
          <h3 className="mb-2 text-lg font-semibold">
            Generate Medical Report
          </h3>
          <p className="mb-4 text-muted-foreground">
            Would you like to generate a comprehensive medical report based on
            the verified information?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleSkipReport}>
              Skip
            </Button>
            <Button variant="default" onClick={handleGenerateReport}>
              Generate Report
            </Button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!showReportPrompt && (
        <div className="mt-4 flex justify-end gap-2">
          <Button
            className="rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            onClick={handleSectionComplete}
          >
            Complete Verification
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * We convert extracted data into an array of verification items
 * so user can verify each field. If it's an array or object, we push
 * multiple items. We store them in local state.
 */
function generateVerificationItems(data: ExtractedData): VerificationItem[] {
  const items: VerificationItem[] = [];

  function addItems(section: keyof ExtractedData, value: any) {
    if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        items.push({
          id: `${section}-${idx}`,
          section: section as string,
          key: `${section}-${idx}`,
          value: item,
          confidence: item.confidence || 0,
          isVerified: false,
        });
      });
    } else if (typeof value === "object" && value !== null) {
      items.push({
        id: `${section}-0`,
        section: section as string,
        key: section as string,
        value,
        confidence: value.confidence || 0,
        isVerified: false,
      });
    }
  }

  // For each section, add items
  Object.entries(data).forEach(([sectionKey, sectionValue]) => {
    addItems(sectionKey as keyof ExtractedData, sectionValue);
  });

  return items;
} 

/**
 * Once everything is verified, we assemble the final corrected data
 * from verification items (including corrections).
 */
function assembleVerifiedData(verificationItems: VerificationItem[]) {
  // We'll group items by their section
  const grouped: Record<string, any> = {};
  verificationItems.forEach((item) => {
    // If the user provided corrections, merge them in
    const correctedValue = item.corrections
      ? { ...item.value, ...item.corrections }
      : item.value;

    // If the item.key is e.g. "demographics-0" or "symptoms-3"
    // We'll parse item.section as the top-level key
    if (!grouped[item.section]) {
      grouped[item.section] = [];
    }
    grouped[item.section].push(correctedValue);
  });

  // For arrays vs. single objects, we might do more logic,
  // but for demonstration, let's keep them as arrays
  return grouped;
}