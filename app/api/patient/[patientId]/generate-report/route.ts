import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { createServerClient } from '@/lib/supabase/clients'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'
import { reportService } from '@/lib/services/report/report-service'
import { perplexityService } from '@/lib/services/perplexity/perplexity-service'
import { ReportType, ReportStatus } from '@/lib/types/report'
import logger from '@/lib/logger'

/**
 * Zod schema for validating incoming requests.
 * Allows 'expert' but we map it to 'comprehensive' when used.
 */
const generatePatientReportSchema = z.object({
  reportType: z.enum(['diagnosis', 'summary', 'treatment', 'recommendation']).default('diagnosis'),
  researchDepth: z.enum(['basic', 'comprehensive', 'expert']).default('comprehensive'),
  includeSources: z.boolean().default(true),
  format: z.enum(['markdown', 'pdf', 'docx', 'html', 'json']).default('pdf'),
  style: z.enum(['clinical', 'academic', 'simplified']).default('clinical'),
  metadataInFooter: z.boolean().default(true),
  workflowId: z.string().uuid().optional()
})

/**
 * POST /api/patient/[patientId]/generate-report
 * Generates a medical report for a specific patient
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { patientId: string } }
) {
  try {
    const supabase = await createServerClient()

    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession()
    // Use === null for eqeqeq
    if (session === null) {
      return apiError({
        message: 'Unauthorized',
        status: 401,
        error: 'You must be logged in to generate reports'
      })
    }

    const { patientId } = params

    // Verify the patient
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .eq('id', patientId)
      .single()

    // Use !== null and === null for eqeqeq
    if (patientError !== null || patient === null) {
      return apiError({
        message: 'Patient not found',
        status: 404,
        error: 'The specified patient does not exist or you do not have access'
      })
    }

    // Parse and validate request body
    const body = await req.json()
    const validationResult = generatePatientReportSchema.safeParse(body)

    if (!validationResult.success) {
      return apiError({
        message: 'Invalid request data',
        status: 422,
        errors: validationResult.error.errors
      })
    }

    const requestData = validationResult.data

    /**
     * Convert 'expert' -> 'comprehensive' to ensure it's a valid depth
     * for the perplexity service. Then cast to the narrower type.
     */
    const finalResearchDepth = requestData.researchDepth === 'expert'
      ? 'comprehensive'
      : requestData.researchDepth

    // Create a unique ID for this report
    const reportId = randomUUID()

    // Insert initial report record with 'processing' status
    const { error: createError } = await supabase
      .from('reports')
      .insert({
        id: reportId,
        patient_id: patientId,
        created_by: session.user.id,
        updated_by: session.user.id, // required by DB
        title: `${requestData.reportType.charAt(0).toUpperCase() + requestData.reportType.slice(1)} Report - ${
          patient.first_name || ''
        } ${patient.last_name || 'Patient'}`,
        status: 'processing',
        type: requestData.reportType === 'diagnosis' ? 'diagnostic' : 'progress',
        department_id: '00000000-0000-0000-0000-000000000000',
        metadata: {
          researchDepth: finalResearchDepth,
          includeSources: requestData.includeSources,
          style: requestData.style,
          metadataInFooter: requestData.metadataInFooter,
          generator: 'perplexity'
        },
        created_at: new Date().toISOString()
      })

    if (createError !== null) {
      logger.error('Error creating report record', { error: createError })
      return apiError({
        message: 'Failed to initiate report generation',
        status: 500,
        error: 'Database error'
      })
    }

    // Kick off background generation without blocking response
    // Use a self-invoking async function + catch to avoid .then(...)
    void (async () => {
      try {
        await generateReportAsync(reportId, patientId, {
          ...requestData,
          researchDepth: finalResearchDepth
        })
      } catch (error) {
        logger.error('Error in background report generation', { error })
        await updateReportStatusToFailed(reportId, error)
      }
    })()

    // Estimate completion time based on research depth
    let completionTimeMinutes = 5
    if (finalResearchDepth === 'basic') {
      completionTimeMinutes = 1
    } else if (finalResearchDepth === 'comprehensive') {
      completionTimeMinutes = 3
    }

    const estimatedCompletionTime = new Date()
    estimatedCompletionTime.setMinutes(
      estimatedCompletionTime.getMinutes() + completionTimeMinutes
    )

    // Return immediate response with the report ID
    return apiSuccess({
      reportId,
      status: 'processing',
      estimatedCompletionTime: estimatedCompletionTime.toISOString(),
      message: `Report generation initiated. Estimated completion time: ${completionTimeMinutes} minutes.`
    })
  } catch (error: unknown) {
    logger.error('Unexpected error in report generation', { error })
    return apiError({
      message: 'An unexpected error occurred',
      status: 500,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Updates a report status to 'failed'
 */
async function updateReportStatusToFailed(reportId: string, error: unknown): Promise<void> {
  try {
    const supabase = await createServerClient()
    await supabase
      .from('reports')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error)
      })
      .eq('id', reportId)
  } catch (updateError) {
    logger.error('Failed to update report status', { error: updateError })
  }
}

/**
 * Asynchronous function to generate the report in the background
 */
async function generateReportAsync(
  reportId: string,
  patientId: string,
  options: z.infer<typeof generatePatientReportSchema> & { researchDepth: 'basic' | 'comprehensive' }
): Promise<void> {
  const supabase = await createServerClient()

  try {
    // Fetch patient
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single()

    // eqeqeq fix
    if (patientError !== null || patient === null) {
      throw new Error('Patient not found')
    }

    // Fetch documents
    const { data: patientDocuments, error: docsError } = await supabase
      .from('patient_documents')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })

    if (docsError !== null) {
      throw new Error('Failed to retrieve patient documents')
    }

    // Format patient data
    const patientDataForResearch = formatPatientDataForResearch(
      patient,
      patientDocuments || []
    )

    // Build query based on reportType
    let researchQuery = ''
    if (options.reportType === 'diagnosis') {
      researchQuery = `Analyze the following patient data and provide a differential diagnosis: ${patientDataForResearch}`
    } else if (options.reportType === 'summary') {
      researchQuery = `Create a comprehensive patient summary from the following data: ${patientDataForResearch}`
    } else if (options.reportType === 'treatment') {
      researchQuery = `Based on the following patient data, recommend treatment options: ${patientDataForResearch}`
    } else if (options.reportType === 'recommendation') {
      researchQuery = `Review the following patient data and provide medical recommendations: ${patientDataForResearch}`
    }

    // Mark report as 'researching'
    await supabase
      .from('reports')
      .update({ status: 'researching' })
      .eq('id', reportId)

    // Run perplexity research
    const researchResult = await perplexityService.performDeepResearch(researchQuery, {
      depth: options.researchDepth,
      includeSources: options.includeSources,
      onProgress: async (progress: number) => {
        // Update metadata with progress
        await supabase
          .from('reports')
          .update({
            metadata: {
              ...options,
              progress
            }
          })
          .eq('id', reportId)
      }
    })

    // Mark report as 'formatting'
    await supabase
      .from('reports')
      .update({ status: 'formatting' })
      .eq('id', reportId)

    // Format the output
    const formattedContent = await reportService.formatReportOutput({
      report: {
        id: reportId,
        patientId,
        title: `${options.reportType.charAt(0).toUpperCase() + options.reportType.slice(1)} Report`,
        reportType: ReportType.SUMMARY, // default to SUMMARY
        status: ReportStatus.PENDING,
        sections: {
          content: {
            title: 'Content',
            content: researchResult.text,
            order: 0,
            editable: true
          }
        },
        sourceDocuments: [],
        metadata: {
          generatedAt: new Date().toISOString(),
          version: '1.0'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      // This second argument isn't typed in the old snippet, but the code in `report-service` uses a param for sources
      sources: researchResult.sources ?? []
    }, options.format)

    // Mark report as 'completed', store text in 'content', plus formattedContent, etc.
    // Convert researchResult.sources to JSON for DB
    await supabase
      .from('reports')
      .update({
        status: 'completed',
        content: researchResult.text,
        formatted_content: formattedContent,
        completed_at: new Date().toISOString(),
        // must convert array to valid JSON
        source_documents: JSON.parse(JSON.stringify(researchResult.sources ?? []))
      })
      .eq('id', reportId)

    // If not markdown or json, attempt to upload
    if (options.format !== 'markdown' && options.format !== 'json') {
      const fileName = `${reportId}.${options.format}`
      const filePath = `reports/${fileName}`

      let contentType = 'text/html'
      if (options.format === 'pdf') {
        contentType = 'application/pdf'
      } else if (options.format === 'docx') {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }

      const formattedContentBlob = new Blob([formattedContent ?? ''], { type: contentType })
      const { error: uploadError } = await supabase
        .storage
        .from('reports')
        .upload(filePath, formattedContentBlob, {
          contentType,
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError !== null) {
        logger.error('Error uploading formatted report', { error: uploadError })
      }
    }
  } catch (error: unknown) {
    logger.error('Error in generateReportAsync', { error })

    // Mark report as 'failed'
    await supabase
      .from('reports')
      .update({ 
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error)
      })
      .eq('id', reportId)

    throw error
  }
}

/**
 * Helper to build a research-friendly string from patient & document data
 */
function formatPatientDataForResearch(
  patient: Record<string, unknown>,
  documents: Array<Record<string, unknown>>
): string {
  // Basic
  const firstName = typeof patient.first_name === 'string' ? patient.first_name : 'Unknown'
  const lastName = typeof patient.last_name === 'string' ? patient.last_name : 'Unknown'
  const age = typeof patient.age === 'number' ? patient.age : 'Unknown'
  const gender = typeof patient.gender === 'string' ? patient.gender : 'Unknown'

  let formattedData = [
    `Patient Name: ${firstName} ${lastName}`,
    `Age: ${age}`,
    `Gender: ${gender}`,
    `Medical ID: ${patient.id}`
  ].join('\n')

  // Additional fields
  if (typeof patient.medical_history === 'string' && patient.medical_history.length > 0) {
    formattedData += `\n\nMEDICAL HISTORY:\n${patient.medical_history}`
  }

  if (typeof patient.current_medications === 'string' && patient.current_medications.length > 0) {
    formattedData += `\n\nCURRENT MEDICATIONS:\n${patient.current_medications}`
  }

  if (typeof patient.allergies === 'string' && patient.allergies.length > 0) {
    formattedData += `\n\nALLERGIES:\n${patient.allergies}`
  }

  // Summaries from each doc
  if (documents.length !== 0) {
    formattedData += '\n\nDOCUMENT SUMMARIES:'
    for (const doc of documents) {
      const docType = typeof doc.document_type === 'string' ? doc.document_type : 'Document'
      const createdAt = typeof doc.created_at === 'string'
        ? new Date(doc.created_at).toLocaleDateString()
        : 'Unknown date'

      formattedData += `\n\n${docType} (${createdAt}):\n`
      if (typeof doc.summary === 'string' && doc.summary.length > 0) {
        formattedData += doc.summary
      } else if (typeof doc.content === 'string' && doc.content.length > 0) {
        const snippet = doc.content.substring(0, 500)
        formattedData += snippet + (doc.content.length > 500 ? '...' : '')
      }
    }
  }

  return formattedData
}