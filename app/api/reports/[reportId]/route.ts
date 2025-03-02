/**
 * API route for getting a specific report
 */
import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'
import { ApplicationError } from '@/lib/errors'
import { reportService } from '@/lib/services/report/report-service'

/**
 * GET handler for retrieving a report
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const { reportId } = params
    
    if (!reportId) {
      return apiError({
        message: 'Report ID is required',
        status: 400
      })
    }
    
    // Get the report
    const report = await reportService.getReport(reportId)
    
    if (!report) {
      return apiError({
        message: 'Report not found',
        status: 404
      })
    }
    
    // Return success response
    return apiSuccess({
      id: report.id,
      title: report.title,
      content: report.content,
      format: report.format,
      createdAt: report.createdAt,
      patientId: report.patientId,
      generatedBy: report.generatedBy,
      detailLevel: report.detailLevel,
      metadata: report.metadata,
      downloadUrl: report.downloadUrl
    })
  } catch (error) {
    console.error('Error retrieving report:', error)
    
    return apiError({
      message: error instanceof ApplicationError 
        ? error.message
        : 'Failed to retrieve report',
      status: error instanceof ApplicationError ? error.statusCode : 500
    })
  }
}