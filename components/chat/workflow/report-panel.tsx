"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LoaderCircle, MessageSquareText } from "lucide-react";

interface ReportGenerationPanelProps {
  visible: boolean;
  isGenerating: boolean;
  onGenerateReport: (notes: string) => void;
  onCancel: () => void;
}

export function ReportGenerationPanel({
  visible,
  isGenerating,
  onGenerateReport,
  onCancel
}: ReportGenerationPanelProps) {
  const [notes, setNotes] = useState("");

  if (!visible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerateReport(notes);
  };

  return (
    <div className="bg-secondary/10 mb-6 rounded border p-4">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="flex items-center gap-2">
          <MessageSquareText className="size-5" />
          <h2 className="font-semibold">Report Generation</h2>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="report-notes">Additional Notes (Optional)</Label>
          <Textarea
            className="h-24"
            disabled={isGenerating}
            id="report-notes"
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes or context for the report..."
            value={notes}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            disabled={isGenerating}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="gap-2"
            disabled={isGenerating}
            type="submit"
          >
            {isGenerating && <LoaderCircle className="size-4 animate-spin" />}
            {isGenerating ? "Generating..." : "Generate Report"}
          </Button>
        </div>
      </form>
    </div>
  );
} 