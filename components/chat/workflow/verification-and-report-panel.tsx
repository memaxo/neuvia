'use client'

import { DocumentPreview } from '@/components/chat/document-preview'
import { Button } from '@/components/ui/button'
import type { ProcessingPhase, WorkflowStep } from '@/lib/workflow/types'

interface ActiveDocument {
  id: string
  title: string
  content: string
  kind: 'text' | 'code' | 'spreadsheet'
}

interface VerificationAndReportPanelProps {
  currentStep: WorkflowStep
  currentPhase?: ProcessingPhase
  activeDocument?: ActiveDocument | null
  onGenerateReport: () => void
  onSkipReport: () => void
  onContinue: () => void
}

export function VerificationAndReportPanel({
  currentStep,
  currentPhase,
  activeDocument,
  onGenerateReport,
  onSkipReport,
  onContinue,
}: VerificationAndReportPanelProps) {
  return (
    <div className="mb-6">
      {currentStep === 'idle' && (
        <div className="bg-secondary/10 rounded border p-4">
          <p className="text-sm">
            You can upload a file to begin the extraction & verification
            process, or start chatting directly.
          </p>
        </div>
      )}

      {(currentStep === 'extracting' || currentStep === 'extraction' ||
        currentPhase === 'extraction') && (
        <div className="bg-secondary/10 rounded border p-4">
          <h2 className="font-semibold">Extraction In Progress...</h2>
          <p className="mt-2 text-sm">
            Your document is being processed. Please wait while data is
            extracted.
          </p>
          {activeDocument && (
            <div className="mt-4">
              <DocumentPreview isReadonly result={activeDocument} />
            </div>
          )}
        </div>
      )}

      {currentStep === 'verification' && (
        <div className="bg-secondary/10 rounded border p-4">
          <h2 className="font-semibold">Processing Complete</h2>
          <p className="mt-2 text-sm">
            Document processing is complete. The extracted information will be
            used to update patient summaries.
          </p>
          <div className="mt-4 flex justify-end">
            <Button onClick={onContinue} variant="default">
              Continue
            </Button>
          </div>
        </div>
      )}

      {currentStep === 'report_generation' && (
        <div className="bg-secondary/10 rounded border p-4">
          <h2 className="font-semibold">Report Generation</h2>
          <p className="mt-2 text-sm">
            You can finalize the process by generating a comprehensive report,
            or skip.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={onGenerateReport} variant="default">
              Generate Report
            </Button>
            <Button onClick={onSkipReport} variant="outline">
              Skip
            </Button>
          </div>
        </div>
      )}

      {currentStep === 'complete' && (
        <div className="bg-secondary/10 rounded border p-4">
          <h2 className="mb-2 font-semibold">Process Complete</h2>
          <p>
            You have completed the entire pipeline. You may continue the
            conversation or upload more documents.
          </p>
        </div>
      )}
    </div>
  )
}