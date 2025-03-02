/**
 * API route for retrieving all reports for a specific patient
 * 
 * This route handles listing all reports for a patient with optional filtering
 */
import { NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'

/**
 * GET /api/patient/[patientId]/reports
 * Retrieves all reports for a specific patient
 */
export async function GET(
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
        error: 'You must be logged in to access reports'
      })
    }
    
    const patientId = params.patientId
    
    // Get query parameters
    const searchParams = req.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const reportType = searchParams.get('type') || 'all'
    
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
    
    // Build the query
    let query = supabase
      .from('reports')
      .select('id, title, status, report_type, format, created_at, completed_at, metadata, error_message', { count: 'exact' })
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    // Add type filter if not 'all'
    if (reportType !== 'all') {
      query = query.eq('report_type', reportType)
    }
    
    // Fetch the reports
    const { data: reports, error: reportsError, count } = await query
    
    if (reportsError) {
      console.error('Error fetching reports:', reportsError)
      return apiError({
        message: 'Failed to retrieve reports',
        status: 500,
        error: 'Database error'
      })
    }
    
    // Format the response
    const formattedReports = (reports || []).map(report => ({
      id: report.id,
      title: report.title,
      status: report.status,
      reportType: report.report_type,
      format: report.format,
      createdAt: report.created_at,
      completedAt: report.completed_at,
      metadata: report.metadata,
      errorMessage: report.error_message
    }))
    
    return apiSuccess({
      reports: formattedReports,
      total: count || 0,
      hasMore: count ? offset + formattedReports.length < count : false
    })
  } catch (error) {
    console.error('Unexpected error retrieving reports:', error)
    return apiError({
      message: 'An unexpected error occurred',
      status: 500,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}