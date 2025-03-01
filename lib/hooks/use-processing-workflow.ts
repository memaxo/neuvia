import { createBrowserClient } from '@/lib/supabase/clients'
import { useCallback, useMemo, useState } from 'react'
import { useDocumentProcessing } from './use-document-processing'
import { useReport } from './use-report'
import { useResearch } from './use-research'

// Import types from specific modules
import type {
  DocumentType,
  ProcessingStatus,
} from '@/lib/processing/types/base'
import type { ExtractedDocument } from '@/lib/processing/types/extraction'
import type {
  ReportDocument,
  ReportFormat,
  ReportOptions,
} from '@/lib/processing/types/report'
import type {
  ResearchDocument,
  ResearchOptions,
} from '@/lib/processing/types/research'
import type { Json } from '@/lib/supabase'
import type { WorkflowStep } from '@/lib/workflow/types'

/**
 * Integrated hook for the complete document processing workflow
 */
export function useProcessingWorkflow() {
  // Current workflow step
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('idle')

  // Error state
  const [error, setError] = useState<string | null>(null)

  // Use document processing hook
  const documentProcessing = useDocumentProcessing()

  // Ensure we're passing the correct type to useResearch
  const research = useResearch(null) // No verified document is passed now

  const report = useReport(research.researchDocument)

  // Initialize Supabase client
  const supabase = createBrowserClient()

  // Overall status from the currently active step
  const getActiveStatus = useMemo(() => {
    switch (workflowStep) {
      case 'extracting':
        return documentProcessing.status
      case 'report_generation':
        return research.status
      case 'complete':
        return report.status
      default:
        return {
          status: 'pending' as const,
          progress: 0,
          phase: 'initialization',
        }
    }
  }, [workflowStep, documentProcessing.status, research.status, report.status])

  /**
   * Load document by ID
   */
  const loadDocument = useCallback(
    async (documentId: string) => {
      setError(null)

      try {
        // Fetch document from the database
        const { data, error } = await supabase
          .from('patient_documents')
          .select('*')
          .eq('id', documentId)
          .single()

        if (error || !data) {
          throw new Error(error?.message || 'Document not found')
        }

        // Parse document type from database
        const docType: DocumentType = {
          category: (data.category as string) || 'clinical',
          type: 'note',
        }

        // Try to extract type from document_type if it exists and has a type property
        if (data.document_type && typeof data.document_type === 'object') {
          const docTypeObj = data.document_type as Record<string, any>
          if (docTypeObj.type && typeof docTypeObj.type === 'string') {
            docType.type = docTypeObj.type
          }
        }

        // Create an ExtractedDocument from the database data
        const extractedDoc: ExtractedDocument = {
          id: data.id,
          patientId: data.patient_id || '',
          documentType: docType,
          extractedData: {
            rawText: data.content_text || '',
            metadata: {
              extractedAt: new Date(),
              ...(typeof data.metadata === 'object' ? data.metadata : {}),
            },
          },
          isSuccessful: Boolean(data.is_processed) || true,
          createdAt: new Date(data.created_at || Date.now()),
        }

        setWorkflowStep('report_generation')
        return extractedDoc
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        return null
      }
    },
    [supabase]
  )

  /**
   * Process a document file
   */
  const processDocument = useCallback(
    async (file: File, patientId: string, documentType?: string) => {
      setError(null)
      setWorkflowStep('extracting')

      try {
        // Convert documentType string to DocumentType object if needed
        const docType: DocumentType | undefined = documentType
          ? { category: 'clinical', type: documentType } // Default to clinical category
          : undefined

        const result = await documentProcessing.processDocument(
          file,
          patientId,
          docType
        )

        if (result) {
          setWorkflowStep('report_generation')
          return result
        } else {
          throw new Error('Document processing failed')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        setWorkflowStep('idle')
        return null
      }
    },
    [documentProcessing]
  )

  /**
   * Perform research based on verified data
   */
  const performResearch = useCallback(
    async (query: string, options?: Omit<ResearchOptions, 'onProgress'>) => {
      setError(null)

      try {
        const result = await research.performResearch(query, options)

        if (result) {
          setWorkflowStep('report_generation')
          return result
        } else {
          throw new Error('Research failed')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        return null
      }
    },
    [research]
  )

  /**
   * Generate a report
   */
  const generateReport = useCallback(
    async (options?: Omit<ReportOptions, 'onProgress'>) => {
      setError(null)

      try {
        const result = await report.generateReport(options)

        if (result) {
          setWorkflowStep('report_generation')
          return result
        } else {
          throw new Error('Report generation failed')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        return null
      }
    },
    [report]
  )

  /**
   * Format the report
   */
  const formatReport = useCallback(
    async (format: ReportFormat) => {
      setError(null)

      try {
        const result = await report.formatReport(format)

        if (result) {
          setWorkflowStep('complete')
          return result
        } else {
          throw new Error('Report formatting failed')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        return null
      }
    },
    [report]
  )

  /**
   * Reset the entire workflow
   */
  const resetWorkflow = useCallback(() => {
    documentProcessing.reset()
    research.clearResults()
    report.reset()
    setWorkflowStep('idle')
    setError(null)
  }, [documentProcessing, research, report])

  /**
   * Go back to the previous step
   */
  const goToPreviousStep = useCallback(() => {
    switch (workflowStep) {
      case 'report_generation':
        setWorkflowStep('extracting')
        break
      case 'complete':
        setWorkflowStep('report_generation')
        break
      default:
        break
    }
  }, [workflowStep])

  return {
    // Workflow state
    workflowStep,
    error,
    status: getActiveStatus,

    // Document data from each step
    extractedDocument: documentProcessing.extractedDocument,
    researchResults: research.researchResults,
    researchDocument: research.researchDocument,
    reportData: report.reportData,
    formattedReport: report.formattedReport,
    reportDocument: report.reportDocument,

    // Workflow actions
    loadDocument,
    processDocument,
    performResearch,
    generateReport,
    formatReport,
    resetWorkflow,
    goToPreviousStep,

    // Direct access to specialized hooks
    documentProcessing,
    research,
    report,
  }
}
