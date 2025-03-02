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
        // Create workflow state to track document processing
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData?.user?.id
        
        // Only create workflow if we have a user ID
        let workflowId: string | null = null
        if (userId) {
          const { data, error } = await supabase
            .from('workflow_states')
            .insert({
              user_id: userId,
              current_step: 'extracting',
              workflow_type: 'document_processing',
              metadata: {
                patientId,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                documentType,
                startedAt: new Date().toISOString()
              }
            })
            .select('id')
            .single()
            
          if (!error && data) {
            workflowId = data.id
            // Store workflow ID in localStorage for access across components
            localStorage.setItem('current_workflow_id', workflowId)
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
          // Update workflow state
          if (workflowId) {
            await supabase
              .from('workflow_states')
              .update({
                current_step: 'verification',
                metadata: {
                  patientId,
                  fileName: file.name,
                  fileSize: file.size,
                  fileType: file.type,
                  documentType,
                  documentId: result.id,
                  completedAt: new Date().toISOString()
                }
              })
              .eq('id', workflowId)
          }
          
          setWorkflowStep('verification')
          return result
        } else {
          throw new Error('Document processing failed')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        setWorkflowStep('idle')
        
        // Update workflow state to error if we have a workflow ID
        const workflowId = localStorage.getItem('current_workflow_id')
        if (workflowId) {
          await supabase
            .from('workflow_states')
            .update({
              current_step: 'error',
              metadata: {
                errorMessage,
                errorAt: new Date().toISOString()
              }
            })
            .eq('id', workflowId)
        }
        
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
        const workflowId = localStorage.getItem('current_workflow_id')
        
        // If we have a workflow ID, update it to verification
        if (workflowId) {
          await supabase
            .from('workflow_states')
            .update({
              current_step: 'verification',
              metadata: {
                verificationStartedAt: new Date().toISOString(),
                documentId: extractedDocument.id,
                patientId: extractedDocument.patientId,
                documentType: extractedDocument.documentType
              }
            })
            .eq('id', workflowId)
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
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        setWorkflowStep('error')
        
        // Update workflow state to error if we have a workflow ID
        const workflowId = localStorage.getItem('current_workflow_id')
        if (workflowId) {
          await supabase
            .from('workflow_states')
            .update({
              current_step: 'error',
              metadata: {
                errorMessage,
                errorAt: new Date().toISOString(),
                errorStage: 'verification'
              }
            })
            .eq('id', workflowId)
        }
        
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
        const workflowId = localStorage.getItem('current_workflow_id')
        
        // If we have a workflow ID, update it to verification_in_progress
        if (workflowId) {
          await supabase
            .from('workflow_states')
            .update({
              current_step: 'verification_in_progress',
              metadata: {
                correction: correctionText,
                correctionAt: new Date().toISOString()
              }
            })
            .eq('id', workflowId)
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
        const workflowId = localStorage.getItem('current_workflow_id')
        
        // If we have a workflow ID, update it to verification_completed or verification_failed
        if (workflowId) {
          await supabase
            .from('workflow_states')
            .update({
              current_step: isApproved ? 'verification_completed' : 'verification_failed',
              metadata: {
                verificationCompletedAt: new Date().toISOString(),
                verificationApproved: isApproved
              }
            })
            .eq('id', workflowId)
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
        const workflowId = localStorage.getItem('current_workflow_id')
        
        // If we have a workflow ID, update it to report_generation
        if (workflowId) {
          await supabase
            .from('workflow_states')
            .update({
              current_step: 'report_generation',
              metadata: {
                reportGenerationStartedAt: new Date().toISOString(),
                reportOptions: options
              }
            })
            .eq('id', workflowId)
        }

        const result = await report.generateReport(options)

        if (result) {
          // Update workflow state to complete
          if (workflowId) {
            await supabase
              .from('workflow_states')
              .update({
                current_step: 'complete',
                metadata: {
                  reportGenerationCompletedAt: new Date().toISOString(),
                  reportId: result.id
                }
              })
              .eq('id', workflowId)
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
