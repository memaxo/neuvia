'use client'

import { DocumentPreview } from '@/components/chat/document-preview'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/lib/stores/chat-store'
import type { ProcessingPhase, WorkflowStep } from '@/lib/workflow/types'
import { useCallback } from 'react'
// Import specialized workflow hooks
import { useDocumentWorkflow } from '@/lib/workflow/hooks/use-document-workflow'
import { useVerificationWorkflow } from '@/lib/workflow/hooks/use-verification-workflow'
import { useReportWorkflow } from '@/lib/workflow/hooks/use-report-workflow'

interface ActiveDocument {
  id: string
  title: string
  content: string
  kind: 'text' | 'code' | 'spreadsheet'
}

interface VerificationAndReportPanelProps {
  currentStep?: WorkflowStep
  currentPhase?: ProcessingPhase
  activeDocument?: ActiveDocument | null
  onGenerateReport?: () => void
  onSkipReport?: () => void
  onContinue?: () => void
}

export function VerificationAndReportPanel({
  currentStep: propCurrentStep,
  currentPhase: propCurrentPhase,
  activeDocument: propActiveDocument,
  onGenerateReport: propOnGenerateReport,
  onSkipReport: propOnSkipReport,
  onContinue: propOnContinue,
}: VerificationAndReportPanelProps) {
  // Get the user ID and chat ID for workflow hook initialization
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_user_id') || undefined : undefined
  const chatId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_chat_id') || undefined : undefined
  
  // Initialize specialized workflow hooks
  const {
    state: documentState,
    status: documentStatus
  } = useDocumentWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  const {
    state: verificationState,
    status: verificationStatus,
    completeVerification
  } = useVerificationWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  const {
    state: reportState,
    status: reportStatus,
    beginReportGeneration: beginReport
  } = useReportWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  // Get data from Zustand store (still needed until fully migrated)
  const extractedDocument = useChatStore(state => state.extractedDocument)
  const generateReport = useChatStore(state => state.generateReport)
  const formatReport = useChatStore(state => state.formatReport)
  const storeBeginReportGeneration = useChatStore(state => state.beginReportGeneration)
  
  // Derive the current workflow step and phase from specialized hooks
  const hooksCurrentStep = documentStatus.currentStep !== 'idle' ? documentStatus.currentStep : 
                      verificationStatus.currentStep !== 'idle' ? verificationStatus.currentStep :
                      reportStatus.currentStep !== 'idle' ? reportStatus.currentStep : 'idle'
  
  const hooksCurrentPhase = documentState.phase || verificationState.phase || reportState.phase
  
  // Use props if provided, otherwise use values from specialized hooks
  const currentStep = propCurrentStep || hooksCurrentStep
  const currentPhase = propCurrentPhase || hooksCurrentPhase
  
  // Create active document from extracted document if not provided
  const activeDocument = propActiveDocument || (extractedDocument ? {
    id: extractedDocument.id || crypto.randomUUID(),
    title: 'Extracted Document',
    content: extractedDocument.extractedData?.rawText || 'Document content',
    kind: 'text'
  } : null)
  
  // Default handlers using specialized hooks
  const handleGenerateReport = useCallback(() => {
    if (propOnGenerateReport) {
      propOnGenerateReport()
    } else {
      // Get patient ID if available
      const patientId = typeof localStorage !== 'undefined' ? 
        localStorage.getItem('current_patient_id') || undefined : undefined
      
      // Use specialized report workflow hook
      if (patientId) {
        void beginReport('comprehensive', { patientId })
      } else {
        void beginReport('comprehensive')
      }
      
      // For backward compatibility
      generateReport()
    }
  }, [propOnGenerateReport, beginReport, generateReport])
  
  const handleSkipReport = useCallback(() => {
    if (propOnSkipReport) {
      propOnSkipReport()
    } else {
      // Use specialized report workflow hook
      void beginReport('none')
      
      // For backward compatibility
      formatReport({ format: 'pdf' })
    }
  }, [propOnSkipReport, beginReport, formatReport])
  
  const handleContinue = useCallback(() => {
    if (propOnContinue) {
      propOnContinue()
    } else {
      // Get patient ID if available
      const patientId = typeof localStorage !== 'undefined' ? 
        localStorage.getItem('current_patient_id') || undefined : undefined
      
      // Use specialized report workflow hook
      if (patientId) {
        void beginReport('comprehensive', { patientId })
      } else {
        void beginReport('comprehensive')
      }
      
      // For backward compatibility
      storeBeginReportGeneration()
    }
  }, [propOnContinue, beginReport, storeBeginReportGeneration])
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
            <Button onClick={handleContinue} variant="default">
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
            <Button onClick={handleGenerateReport} variant="default">
              Generate Report
            </Button>
            <Button onClick={handleSkipReport} variant="outline">
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