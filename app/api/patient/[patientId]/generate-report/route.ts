/**
 * API route for generating patient reports
 * 
 * This route handles the generation of patient reports using Perplexity for research
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'
import { reportService } from '@/lib/services/report/report-service'
import { perplexityService } from '@/lib/services/perplexity/perplexity-service'

// Request validation schema
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
    const supabase = createRouteHandlerClient({ cookies })
    
    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return apiError({
        message: 'Unauthorized',
        status: 401,
        error: 'You must be logged in to generate reports'
      })
    }
    
    const patientId = params.patientId
    
    // Verify patient exists and user has access
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, name')
      .eq('id', patientId)
      .single()
    
    if (patientError || !patient) {
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
    
    // Create a unique ID for this report
    const reportId = uuidv4()
    
    // Create an initial report record with "processing" status
    const { error: createError } = await supabase
      .from('reports')
      .insert({
        id: reportId,
        patient_id: patientId,
        user_id: session.user.id,
        title: `${requestData.reportType.charAt(0).toUpperCase() + requestData.reportType.slice(1)} Report - ${patient.name || 'Patient'}`,
        status: 'processing',
        format: requestData.format,
        report_type: requestData.reportType,
        workflow_id: requestData.workflowId,
        metadata: {
          researchDepth: requestData.researchDepth,
          includeSources: requestData.includeSources,
          style: requestData.style,
          metadataInFooter: requestData.metadataInFooter,
          generator: 'perplexity'
        },
        created_at: new Date().toISOString()
      })
    
    if (createError) {
      console.error('Error creating report record:', createError)
      return apiError({
        message: 'Failed to initiate report generation',
        status: 500,
        error: 'Database error'
      })
    }
    
    // Start the report generation process asynchronously
    // This will run in the background and won't block the response
    generateReportAsync(
      reportId,
      patientId, 
      requestData
    ).catch(error => {
      console.error('Error in background report generation:', error)
      // Update the report status to failed
      supabase
        .from('reports')
        .update({ 
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error)
        })
        .eq('id', reportId)
        .then(result => {
          if (result.error) {
            console.error('Failed to update report status:', result.error)
          }
        })
    })
    
    // Calculate estimated completion time based on research depth
    const completionTimeMinutes = 
      requestData.researchDepth === 'basic' ? 1 :
      requestData.researchDepth === 'comprehensive' ? 3 : 5
    
    const estimatedCompletionTime = new Date()
    estimatedCompletionTime.setMinutes(estimatedCompletionTime.getMinutes() + completionTimeMinutes)
    
    // Return immediate response with the report ID
    return apiSuccess({
      reportId,
      status: 'processing',
      estimatedCompletionTime: estimatedCompletionTime.toISOString(),
      message: `Report generation initiated. Estimated completion time: ${completionTimeMinutes} minutes.`
    })
  } catch (error) {
    console.error('Unexpected error in report generation:', error)
    return apiError({
      message: 'An unexpected error occurred',
      status: 500,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Asynchronous function to generate the report
 * This runs in the background after the API response is sent
 */
async function generateReportAsync(
  reportId: string,
  patientId: string,
  options: z.infer<typeof generatePatientReportSchema>
) {
  const supabase = createRouteHandlerClient({ cookies })
  
  try {
    // Fetch patient data
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single()
    
    if (patientError || !patient) {
      throw new Error('Patient not found')
    }
    
    // Fetch patient medical records and verified documents
    const { data: patientDocuments, error: docsError } = await supabase
      .from('patient_documents')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    
    if (docsError) {
      throw new Error('Failed to retrieve patient documents')
    }
    
    // Format patient data for research
    const patientDataForResearch = formatPatientDataForResearch(patient, patientDocuments || [])
    
    // Define research query based on report type
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
    
    // Update report status to researching
    await supabase
      .from('reports')
      .update({ status: 'researching' })
      .eq('id', reportId)
    
    // Perform research with Perplexity
    const researchResult = await perplexityService.performDeepResearch(
      researchQuery,
      {
        depth: options.researchDepth as any,
        sources: options.includeSources,
        onProgress: async (progress) => {
          // Update report with progress
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
      }
    )
    
    // Update report status to formatting
    await supabase
      .from('reports')
      .update({ status: 'formatting' })
      .eq('id', reportId)
    
    // Generate the formal report from research results
    const reportFormat = {
      format: options.format,
      style: options.style,
      metadataInFooter: options.metadataInFooter
    }
    
    // Format the report content using the report service
    const formattedReport = await reportService.formatResearchResult(
      researchResult,
      reportFormat,
      {
        patientId,
        patientName: patient.name || 'Patient',
        reportType: options.reportType
      }
    )
    
    // Save the completed report
    await supabase
      .from('reports')
      .update({
        status: 'completed',
        content: formattedReport.content,
        formatted_content: formattedReport.formattedContent || null,
        completed_at: new Date().toISOString(),
        sources: researchResult.sources
      })
      .eq('id', reportId)
    
    // If the format is not markdown, generate a download URL
    if (options.format !== 'markdown' && options.format !== 'json') {
      // Convert the formatted content to a file and upload to storage
      // This is just a placeholder - actual implementation depends on how you handle file storage
      const fileName = `${reportId}.${options.format}`
      const filePath = `reports/${fileName}`
      
      // Upload the file to storage
      // Example implementation (would need adjustment for actual file type)
      const formattedContentBlob = new Blob([formattedReport.formattedContent || ''], { 
        type: options.format === 'pdf' ? 'application/pdf' : 
              options.format === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 
              'text/html'
      })
      
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('reports')
        .upload(filePath, formattedContentBlob, {
          contentType: options.format === 'pdf' ? 'application/pdf' : 
                     options.format === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 
                     'text/html',
          cacheControl: '3600',
          upsert: true
        })
      
      if (uploadError) {
        console.error('Error uploading formatted report:', uploadError)
      } else {
        // Get public URL
        const { data: urlData } = await supabase
          .storage
          .from('reports')
          .getPublicUrl(filePath)
        
        // Update the report with the download URL
        await supabase
          .from('reports')
          .update({
            download_url: urlData.publicUrl
          })
          .eq('id', reportId)
      }
    }
    
    return true
  } catch (error) {
    console.error('Error in generateReportAsync:', error)
    
    // Update the report status to failed
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
 * Helper function to format patient data for research
 */
function formatPatientDataForResearch(
  patient: any,
  documents: any[]
): string {
  // Basic patient info
  let formattedData = [
    `Patient Name: ${patient.name || 'Unknown'}`,
    `Age: ${patient.age || 'Unknown'}`,
    `Gender: ${patient.gender || 'Unknown'}`,
    `Medical ID: ${patient.id}`
  ].join('\n')
  
  // Add additional patient fields if available
  if (patient.medical_history) {
    formattedData += `\n\nMEDICAL HISTORY:\n${patient.medical_history}`
  }
  
  if (patient.current_medications) {
    formattedData += `\n\nCURRENT MEDICATIONS:\n${patient.current_medications}`
  }
  
  if (patient.allergies) {
    formattedData += `\n\nALLERGIES:\n${patient.allergies}`
  }
  
  // Add document data
  if (documents.length > 0) {
    formattedData += '\n\nDOCUMENT SUMMARIES:'
    
    for (const doc of documents) {
      formattedData += `\n\n${doc.document_type || 'Document'} (${new Date(doc.created_at).toLocaleDateString()}):\n`
      
      if (doc.summary) {
        formattedData += doc.summary
      } else if (doc.content) {
        // If no summary, add a truncated version of the content
        formattedData += doc.content.substring(0, 500) + (doc.content.length > 500 ? '...' : '')
      }
    }
  }
  
  return formattedData
}