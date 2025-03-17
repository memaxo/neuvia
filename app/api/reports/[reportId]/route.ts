/**
 * API route for getting a specific report
 */
import type { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'
import { ApplicationError } from '@/lib/errors'
import { reportStorageService } from '@/lib/services/report'

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
    
    // Get the report from storage service
    const reportData = await reportStorageService.getReport(reportId)
    
    // Convert to API response format
    const report = {
      id: reportData.report.id,
      title: reportData.report.title,
      content: JSON.stringify(reportData.report.sections),
      format: 'json',
      createdAt: reportData.report.createdAt,
      patientId: reportData.report.patientId,
      generatedBy: reportData.report.createdBy || '',
      detailLevel: reportData.report.reportType,
      metadata: reportData.report.metadata,
      downloadUrl: null
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