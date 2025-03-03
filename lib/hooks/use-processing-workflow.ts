import { createBrowserClient } from '@/lib/supabase/clients'
import { useCallback, useMemo, useState } from 'react'
import { useDocumentProcessing } from './use-document-processing'
import { useReport } from './use-report'
import { useResearch } from './use-research'
import { workflowService } from '@/lib/services/workflow/workflow-service'
import { workflowStateManager } from '@/lib/services/workflow/workflow-state-manager'
import { 
  DocumentProcessingError, 
  VerificationError,
  ReportGenerationError,
  NotFoundError,
  ValidationError,
  normalizeError
} from '@/lib/errors'

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
        // Create workflow state to track document processing
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData?.user?.id
        
        // Only create workflow if we have a user ID
        let workflowId: string | null = null
        if (userId) {
          const metadata = {
            patientId,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            documentType,
            startedAt: new Date().toISOString(),
            workflow_type: 'document_processing'
          }
          
          // Use the workflow service to create a new workflow state
          workflowId = await workflowService.createWorkflowState(
            userId, 
            'extracting',
            metadata
          )
          
          if (workflowId) {
            // Store workflow ID using state manager for access across components
            workflowStateManager.setCurrentWorkflowId(workflowId)
          }
        }

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
          // Update workflow state using service
          if (workflowId) {
            await workflowService.updateWorkflowState(
              workflowId,
              'verification',
              {
                patientId,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                documentType,
                documentId: result.id,
                completedAt: new Date().toISOString()
              }
            )
          }
          
          setWorkflowStep('verification')
          return result
        } else {
          throw new Error('Document processing failed')
        }
      } catch (err) {
        // Normalize the error for consistent handling
        const normalizedError = normalizeError(err)
        
        // Create a domain-specific document processing error for better diagnostics
        const documentError = new DocumentProcessingError({
          message: normalizedError.message,
          code: 'DOCUMENT_PROCESSING_FAILED',
          phase: 'extraction',
          data: {
            fileName: file.name, 
            fileSize: file.size,
            fileType: file.type,
            patientId
          },
          cause: err
        })
        
        // Update local state
        setError(documentError.message)
        setWorkflowStep('idle')
        
        // Update workflow state to error with detailed error information
        await workflowStateManager.setWorkflowError(documentError.message, {
          errorAt: documentError.timestamp,
          errorCode: documentError.code,
          errorPhase: 'extraction',
          errorDetails: documentError.data,
          recoverable: true
        })
        
        return null
      }
    },
    [documentProcessing, supabase]
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
   * Initiate verification process for a document
   */
  const initiateVerification = useCallback(
    async (extractedDocument: ExtractedDocument) => {
      setError(null)
      setWorkflowStep('verification')
      
      try {
        const workflowId = workflowStateManager.getCurrentWorkflowId()
        
        // If we have a workflow ID, update it to verification
        if (workflowId) {
          await workflowService.updateWorkflowState(
            workflowId,
            'verification',
            {
              verificationStartedAt: new Date().toISOString(),
              documentId: extractedDocument.id,
              patientId: extractedDocument.patientId,
              documentType: extractedDocument.documentType
            }
          )
        }
        
        // Use API client to initiate verification through the correct endpoint
        const userId = (await supabase.auth.getUser()).data.user?.id
        
        if (!userId) {
          throw new Error('User not authenticated')
        }
        
        // Call patient-summary-service to generate summary if needed
        const { data: patientSummary, error: summaryError } = await supabase
          .rpc('generate_patient_summary', {
            p_document_id: extractedDocument.id,
            p_patient_id: extractedDocument.patientId,
            p_user_id: userId
          })
          
        if (summaryError) {
          throw new Error(`Failed to generate patient summary: ${summaryError.message}`)
        }
        
        return {
          summaryId: patientSummary?.id || extractedDocument.id,
          summary: patientSummary?.content || extractedDocument.extractedData.rawText,
          structuredData: patientSummary?.structured_data || extractedDocument.extractedData
        }
      } catch (err) {
        // Normalize the error for consistent handling
        const normalizedError = normalizeError(err)
        
        // Create a domain-specific verification error for better diagnostics
        const verificationError = new VerificationError({
          message: normalizedError.message,
          code: 'VERIFICATION_INITIALIZATION_FAILED',
          documentId: extractedDocument.id,
          data: {
            patientId: extractedDocument.patientId,
            documentType: extractedDocument.documentType,
            failureReason: normalizedError.message
          },
          cause: err
        })
        
        // Update local state
        setError(verificationError.message)
        setWorkflowStep('error')
        
        // Update workflow state to error with detailed error information
        await workflowStateManager.setWorkflowError(verificationError.message, {
          errorAt: verificationError.timestamp,
          errorCode: verificationError.code,
          errorStage: 'verification',
          errorDetails: verificationError.data,
          recoverable: true
        })
        
        return null
      }
    },
    [supabase]
  )
  
  /**
   * Process a user correction to the summary
   */
  const processCorrection = useCallback(
    async (correctionText: string, currentSummary: string) => {
      setError(null)
      
      try {
        const workflowId = workflowStateManager.getCurrentWorkflowId()
        
        // If we have a workflow ID, update it to verification_in_progress
        if (workflowId) {
          await workflowService.updateWorkflowState(
            workflowId,
            'verification_in_progress',
            {
              correction: correctionText,
              correctionAt: new Date().toISOString()
            }
          )
        }
        
        // Use API client to process the correction
        const userId = (await supabase.auth.getUser()).data.user?.id
        
        if (!userId) {
          throw new Error('User not authenticated')
        }
        
        // Call patient-summary-service to process correction
        const { data: updatedSummary, error: correctionError } = await supabase
          .rpc('process_summary_correction', {
            p_summary_id: workflowId || 'temp',
            p_correction: correctionText,
            p_current_content: currentSummary,
            p_user_id: userId
          })
          
        if (correctionError) {
          throw new Error(`Failed to process correction: ${correctionError.message}`)
        }
        
        return {
          summaryId: updatedSummary?.id || workflowId || 'temp',
          summary: updatedSummary?.content || `${currentSummary}\n\nCorrection: ${correctionText}`,
          structuredData: updatedSummary?.structured_data || {}
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        
        return null
      }
    },
    [supabase]
  )
  
  /**
   * Complete verification process
   */
  const completeVerification = useCallback(
    async (isApproved: boolean) => {
      setError(null)
      
      try {
        const workflowId = workflowStateManager.getCurrentWorkflowId()
        
        // If we have a workflow ID, update it to verification_completed or verification_failed
        if (workflowId) {
          await workflowService.updateWorkflowState(
            workflowId,
            isApproved ? 'verification_completed' : 'verification_failed',
            {
              verificationCompletedAt: new Date().toISOString(),
              verificationApproved: isApproved
            }
          )
        }
        
        return {
          isCompleted: true,
          isApproved,
          completedAt: new Date().toISOString()
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        
        return null
      }
    },
    [supabase]
  )
  
  /**
   * Generate a report
   */
  const generateReport = useCallback(
    async (options?: Omit<ReportOptions, 'onProgress'>) => {
      setError(null)
      setWorkflowStep('report_generation')
      
      try {
        const workflowId = workflowStateManager.getCurrentWorkflowId()
        
        // If we have a workflow ID, update it to report_generation
        if (workflowId) {
          await workflowService.updateWorkflowState(
            workflowId,
            'report_generation',
            {
              reportGenerationStartedAt: new Date().toISOString(),
              reportOptions: options
            }
          )
        }

        const result = await report.generateReport(options)

        if (result) {
          // Update workflow state to complete using service
          if (workflowId) {
            await workflowService.updateWorkflowState(
              workflowId,
              'complete',
              {
                reportGenerationCompletedAt: new Date().toISOString(),
                reportId: result.id
              }
            )
          }
          
          setWorkflowStep('complete')
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
    
    // Verification actions
    initiateVerification,
    processCorrection,
    completeVerification,
    
    // Research and report actions
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
