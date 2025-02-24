"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ExtractionLoadingProps {
  /** Current progress from 0 to 100, or null if unknown. */
  progress?: number | null;
  /** Optional error message, indicates a failure occurred. */
  error?: string | null;
  /** If true, we are actively analyzing. */
  isAnalyzing?: boolean;
  /** Called when user clicks "Retry" if there's an error. */
  onRetry?: () => void;
  /** Called when user clicks "Cancel" if there's an error or if they don't want to continue. */
  onCancel?: () => void;
}

/**
 * Displays a specialized overlay or area while Gemini (or any chunking process)
 * is analyzing the user’s file.  If there's an error, shows a retry/cancel prompt.
 */
export function ExtractionLoading({
  progress,
  error,
  isAnalyzing = true,
  onRetry,
  onCancel
}: ExtractionLoadingProps) {

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4 p-6 text-center">
        <h2 className="text-lg font-semibold text-red-600">Extraction Failed</h2>
        <p className="text-sm text-red-500">{error}</p>
        <div className="mt-4 flex items-center space-x-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="default" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center space-y-4 p-6 text-center">
      {isAnalyzing ? (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          <h2 className="text-xl font-semibold">
            Your document is being analyzed...
          </h2>
          <p className="text-sm text-muted-foreground">
            Gemini is chunking and extracting data from your file. Please wait.
          </p>
          {typeof progress === "number" && (
            <div className="mt-4 w-full max-w-md">
              <Progress value={progress} />
              <p className="mt-1 text-sm text-muted-foreground">
                {progress}% complete
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Waiting to start analyzing...
          </p>
        </div>
      )}
    </div>
  );
}