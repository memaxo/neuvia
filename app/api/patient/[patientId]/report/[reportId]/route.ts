/**
 * API route for retrieving a specific patient report
 * 
 * This route handles retrieval of a generated report for a specific patient
 */
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/clients'
import { apiError, apiSuccess } from '@/lib/api/route-helpers'

/**
 * GET /api/patient/[patientId]/report/[reportId]
 * Retrieves a specific patient report
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { patientId: string, reportId: string } }
) {
  try {
    const supabase = await createServerClient()
    
    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return apiError({
        message: 'Unauthorized',
        status: 401,
        error: 'You must be logged in to access reports'
      })
    }
    
    const { patientId, reportId } = params
    
    // Verify patient exists and user has access
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .single()
    
    if (patientError || !patient) {
      return apiError({
        message: 'Patient not found',
        status: 404,
        error: 'The specified patient does not exist or you do not have access'
      })
    }
    
    // Fetch the report
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .eq('patient_id', patientId)
      .single()
    
    if (reportError || !report) {
      return apiError({
        message: 'Report not found',
        status: 404,
        error: 'The specified report does not exist or you do not have access'
      })
    }
    
    // Format the response
    const formattedReport = {
      id: report.id,
      patientId: report.patient_id,
      title: report.title,
      status: report.status,
      reportType: report.report_type,
      format: report.format,
      content: report.content,
      formattedContent: report.formatted_content,
      downloadUrl: report.download_url,
      createdAt: report.created_at,
      completedAt: report.completed_at,
      metadata: report.metadata,
      sources: report.sources || [],
      errorMessage: report.error_message
    }
    
    return apiSuccess(formattedReport)
  } catch (error) {
    console.error('Unexpected error retrieving report:', error)
    return apiError({
      message: 'An unexpected error occurred',
      status: 500,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}