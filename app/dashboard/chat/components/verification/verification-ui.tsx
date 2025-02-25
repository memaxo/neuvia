"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { DocumentProcessingService } from "@/lib/processing/document-processing-service";

import { DataDisplay } from "./data-display";

// Import required types
import type { ExtractedData } from "@/lib/processing/types";
import type { VerificationStatus } from "@/lib/processing/types/verification";

/**
 * VerificationItem interface based on our app's requirements
 */
interface VerificationItem {
  id: string;
  section: string;
  field: string;
  key: string;  // Required by the DocumentProcessingService
  value: string;
  confidence: number;
  isVerified: boolean;
  corrections?: Record<string, any>;
  label?: string;
  note?: string;
}

/**
 * VerificationUI Props
 * - extractedData: the data that was extracted, potentially incomplete
 * - originalText: the raw text used for reference
 * - onVerify: callback once user finishes verifying
 * - onComplete: final step if the user chooses to skip or after generating a report
 * - patientId, departmentId: used if we pass them to generate the final report
 * - workflowId: optional parameter for workflow integration
 */
interface VerificationUIProps {
  extractedData: ExtractedData;
  originalText: string;
  onVerify: (verificationItems: VerificationItem[]) => void;
  onComplete: () => void;
  patientId: string;
  departmentId: string;
  workflowId?: string;
}

// Interface for data display
interface DataItem {
  [key: string]: unknown;
}

export function VerificationUI({
  extractedData,
  originalText,
  onVerify,
  onComplete,
  patientId,
  departmentId,
  workflowId,
}: VerificationUIProps) {
  const router = useRouter();
  const { toast } = useToast();
  const processingService = new DocumentProcessingService();

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
  
  // Track loading states
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // We'll track error messages if user tries to proceed without verifying
  const [errorMessage, setErrorMessage] = useState("");

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

    // Move to the next stage
    setShowReportPrompt(true);
  };

  // If user decides to skip or after finishing, we run onComplete
  const handleSkipReport = () => {
    setShowReportPrompt(false);
    onComplete();
  };

  // Generate a report directly from verification (bypass research)
  const handleDirectReportGeneration = async () => {
    if (!workflowId) {
      toast({
        title: "Error",
        description: "Workflow ID is required for direct report generation.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsGeneratingReport(true);
      
      // Create verification status
      const status: VerificationStatus = {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: 'user' // This would be the actual user ID in production
      };
      
      // Assemble verified data from verification items
      const verifiedData = assembleVerifiedData(verificationItems);
      
      // Get the original extracted document from the metadata
      const extractedDocument = extractedData.metadata?.extractedDocument;
      
      if (!extractedDocument) {
        throw new Error("Extracted document not found in metadata");
      }
      
      // Save verification results to get the verified document
      const verifiedDocument = await processingService.saveVerificationResults(
        workflowId,
        verificationItems,
        status,
        extractedDocument
      );
      
      // Generate report directly from verification
      await processingService.generateReportFromVerification(
        workflowId,
        verifiedDocument,
        {
          onProgress: (phase, progress) => {
            toast({
              title: "Generating Report",
              description: `${phase} - ${progress}% complete`,
            });
          }
        }
      );
      
      toast({
        title: "Report Generated",
        description: "Report has been successfully generated directly from verification.",
      });
      
      // Navigate to reports page
      router.push('/dashboard/reports');
      
    } catch (error) {
      console.error("Error generating direct report:", error);
      toast({
        title: "Error",
        description: `Failed to generate report: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReport(false);
      onComplete(); // Complete verification process
    }
  };

  // Actually generate a final report
  const handleGenerateReport = async () => {
    try {
      // We'll call the server action from e.g. /dashboard/reports/actions
      // We'll pass the corrected data from the chat context or from verificationItems
      // For demonstration, we'll do a mock call here

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
    <div className="bg-background flex flex-col gap-4 rounded-lg border p-4">
      <h2 className="text-xl font-semibold">Verify Extracted Information</h2>

      {/* Section Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Object.keys(extractedData).map((sectionKey) => (
          <button
            className={`rounded-full px-3 py-1 text-sm ${
              activeSection === sectionKey
                ? "bg-primary text-primary-foreground"
                : "bg-secondary hover:bg-secondary/80"
            }`}
            key={sectionKey}
            onClick={() =>
              setActiveSection(sectionKey as keyof ExtractedData)
            }
          >
            {sectionKey}
          </button>
        ))}
      </div>

      {/* Active Section Content */}
      <div className="flex flex-col gap-2">
        <DataDisplay
          data={extractedData[activeSection] as DataItem | DataItem[]}
          verificationItems={verificationItems.filter(
            (item) => item.section === activeSection
          )}
        />
      </div>

      {/* Controls and Actions */}
      <div className="mt-4 flex justify-between">
        <div className="bg-muted max-h-40 overflow-y-auto rounded p-2">
          <h3 className="mb-2 font-medium">Original Text</h3>
          <p className="text-sm">{originalText}</p>
        </div>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={handleSectionComplete}
        >
          Complete Verification
        </Button>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="border-destructive bg-destructive/10 text-destructive rounded-md border p-3">
          {errorMessage}
        </div>
      )}

      {/* Report Generation Prompt */}
      {showReportPrompt && (
        <div className="bg-muted mt-4 flex flex-col gap-4 rounded-md p-4">
          <h3 className="text-lg font-medium">Verification Complete</h3>
          <p className="text-muted-foreground">
            You have successfully verified the extracted information. What would
            you like to do next?
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              className="sm:order-1"
              onClick={handleSkipReport}
              variant="outline"
            >
              Skip Report
            </Button>
            {workflowId && (
              <Button
                className="bg-green-600 text-white hover:bg-green-700 sm:order-2"
                disabled={isGeneratingReport}
                onClick={handleDirectReportGeneration}
                variant="secondary"
              >
                {isGeneratingReport ? "Generating..." : "Generate Direct Report"}
              </Button>
            )}
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90 sm:order-3"
              onClick={handleGenerateReport}
            >
              Research & Generate Report
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function generateVerificationItems(data: ExtractedData): VerificationItem[] {
  const items: VerificationItem[] = [];
  
  function addItems(section: keyof ExtractedData, value: any) {
    // Skip if value is null or undefined
    if (value === null || value === undefined) {
      return;
    }
    
    // Handle array values
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          // For nested objects in arrays, add each property
          Object.entries(item).forEach(([propKey, propValue]) => {
            const id = `${String(section)}.${index}.${propKey}`;
            items.push({
              id,
              section: String(section),
              field: `${String(section)}.${index}.${propKey}`,
              key: id, // Use id for the key as required
              value: String(propValue),
              confidence: 0.85, // Placeholder confidence value
              isVerified: false
            });
          });
        } else {
          // For primitive values in arrays
          const id = `${String(section)}.${index}`;
          items.push({
            id,
            section: String(section),
            field: `${String(section)}[${index}]`,
            key: id, // Use id for the key as required
            value: String(item),
            confidence: 0.85, // Placeholder confidence value
            isVerified: false
          });
        }
      });
    }
    // Handle object values
    else if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([key, propValue]) => {
        // Skip nested objects/arrays for simplicity
        if (propValue !== null && typeof propValue !== 'object') {
          const id = `${String(section)}.${key}`;
          items.push({
            id,
            section: String(section),
            field: key,
            key: id, // Use id for the key as required
            value: String(propValue),
            confidence: 0.85, // Placeholder confidence value
            isVerified: false
          });
        }
      });
    }
    // Handle primitive values
    else {
      const id = String(section);
      items.push({
        id,
        section: String(section),
        field: String(section),
        key: id, // Use id for the key as required
        value: String(value),
        confidence: 0.85, // Placeholder confidence value
        isVerified: false
      });
    }
  }
  
  // Process each section in the data
  Object.entries(data).forEach(([key, value]) => {
    addItems(key as keyof ExtractedData, value);
  });
  
  return items;
}

function assembleVerifiedData(verificationItems: VerificationItem[]) {
  // Create an object to store verified data
  const verifiedData: Record<string, any> = {};
  
  // Iterate through verification items and add to verified data
  verificationItems.forEach(item => {
    if (item.isVerified) {
      // Split the field path
      const pathParts = item.field.split('.');
      
      // Navigate and create nested objects as needed
      let current = verifiedData;
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        if (i === pathParts.length - 1) {
          // Last part, set the value
          // If there are corrections, use those instead
          current[part] = item.corrections ? item.corrections.value : item.value;
        } else {
          // Not the last part, ensure the path exists
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      }
    }
  });
  
  return verifiedData;
}