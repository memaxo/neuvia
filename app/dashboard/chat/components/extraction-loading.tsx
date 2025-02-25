"use client";

import { AlertCircle, ArrowRight, Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ExtractionLoadingProps {
  /** Current progress from 0 to 100, or null if unknown. */
  readonly progress?: number | null;
  /** Optional error message, indicates a failure occurred. */
  readonly error?: string | null;
  /** Error type for more contextual handling */
  readonly errorType?: 'format' | 'size' | 'network' | 'timeout' | 'permission' | 'unknown';
  /** If true, we are actively analyzing. */
  readonly isAnalyzing?: boolean;
  /** Called when user clicks "Retry" if there's an error. */
  readonly onRetry?: () => void;
  /** Called when user clicks "Cancel" if there's an error or if they don't want to continue. */
  readonly onCancel?: () => void;
  /** Optional callback for alternative extraction methods */
  readonly onTryAlternative?: () => void;
  /** Optional callback to download error logs */
  readonly onDownloadLogs?: () => void;
}

/**
 * Displays a specialized overlay or area while Gemini (or any chunking process)
 * is analyzing the user's file.  If there's an error, shows a retry/cancel prompt.
 */
export function ExtractionLoading({
  progress,
  error,
  errorType = 'unknown',
  isAnalyzing = true,
  onRetry,
  onCancel,
  onTryAlternative,
  onDownloadLogs
}: ExtractionLoadingProps) {

  if (error !== null && error !== undefined) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4 p-6 text-center">
        <div className="w-full max-w-md">
          <Alert className="border-red-200 bg-red-50" variant="error">
            <AlertCircle className="size-5 text-red-600" />
            <AlertTitle className="ml-2 font-semibold text-red-700">Extraction Failed</AlertTitle>
            <AlertDescription className="ml-2 text-red-600">
              {error}
            </AlertDescription>
          </Alert>
          
          {errorType && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-left">
              <h3 className="mb-2 text-sm font-medium text-amber-800">Troubleshooting Tips</h3>
              <ul className="list-disc space-y-1 pl-5 text-xs text-amber-700">
                {errorType === 'format' && (
                  <>
                    <li>Ensure your document is in a supported format (PDF, DOCX, TXT)</li>
                    <li>Check if the document contains extractable text</li>
                  </>
                )}
                {errorType === 'size' && (
                  <>
                    <li>Your document may be too large (max 10MB)</li>
                    <li>Try splitting the document into smaller parts</li>
                  </>
                )}
                {errorType === 'network' && (
                  <>
                    <li>Check your internet connection</li>
                    <li>The service might be experiencing high traffic</li>
                  </>
                )}
                {errorType === 'timeout' && (
                  <>
                    <li>The extraction process took too long</li>
                    <li>Try with a smaller or less complex document</li>
                  </>
                )}
                {errorType === 'permission' && (
                  <>
                    <li>You may not have permission to access this document</li>
                    <li>Check document permissions or try a different file</li>
                  </>
                )}
                {errorType === 'unknown' && (
                  <>
                    <li>An unexpected error occurred during extraction</li>
                    <li>Try again or use a different document</li>
                  </>
                )}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-col space-y-3">
            <Button 
              className="w-full" 
              onClick={onRetry}
              variant="default"
            >
              <RefreshCw className="mr-2 size-4" /> Try Again
            </Button>
            
            {onTryAlternative && (
              <Button 
                className="w-full border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100" 
                onClick={onTryAlternative}
                variant="outline"
              >
                <ArrowRight className="mr-2 size-4" /> Try Alternative Method
              </Button>
            )}
            
            {onDownloadLogs && (
              <Button 
                className="w-full" 
                onClick={onDownloadLogs}
                size="sm"
                variant="outline"
              >
                <Download className="mr-2 size-3" /> Download Error Logs
              </Button>
            )}
            
            <Button 
              className="text-muted-foreground w-full" 
              onClick={onCancel}
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center space-y-4 p-6 text-center">
      {isAnalyzing ? (
        <>
          <Loader2 className="size-6 animate-spin text-blue-400" />
          <h2 className="text-xl font-semibold">
            Your document is being analyzed...
          </h2>
          <p className="text-muted-foreground text-sm">
            Gemini is chunking and extracting data from your file. Please wait.
          </p>
          {typeof progress === "number" && (
            <div className="mt-4 w-full max-w-md">
              <Progress value={progress} />
              <p className="text-muted-foreground mt-1 text-sm">
                {progress}% complete
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center">
          <p className="text-muted-foreground text-sm">
            Waiting to start analyzing...
          </p>
        </div>
      )}
    </div>
  );
}