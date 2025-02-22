import { Loader2, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { generateReport } from "../actions";
import type { GenerateReportInput } from "../actions";

interface GenerateReportButtonProps {
  patientId: string;
  patientInfo: Omit<GenerateReportInput["patientInfo"], "vitalSigns"> & {
    vitalSigns: Record<string, string>;
  };
  onSuccess?: (reportId: string) => void;
}

export function GenerateReportButton({
  patientId,
  patientInfo,
  onSuccess,
}: GenerateReportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = async () => {
    try {
      setIsGenerating(true);
      const result = await generateReport({
        patientId,
        patientInfo,
      });

      toast.success("Report generation started");
      onSuccess?.(result.reportId);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to generate report"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      disabled={isGenerating}
      onClick={handleGenerateReport}
      variant="default"
    >
      {isGenerating ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" />
          Generating Report...
        </>
      ) : (
        <>
          <FileText className="mr-2 size-4" />
          Generate Report
        </>
      )}
    </Button>
  );
} 