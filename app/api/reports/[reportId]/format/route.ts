/**
 * API route for formatting an existing report
 */
import type { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'
import { z } from 'zod'
import { validateRequest } from '@/lib/api/validation'
import { ApplicationError } from '@/lib/errors'
import type { ReportFormat } from '@/lib/chat/types'
import { reportFormattingService, reportStorageService } from '@/lib/services/report'

// Request validation schema
const formatReportSchema = z.object({
  format: z.enum(['markdown', 'pdf', 'docx', 'html', 'json']).default('pdf'),
  style: z.enum(['clinical', 'academic', 'simplified']).default('clinical'),
  metadataInFooter: z.boolean().default(true)
})

/**
 * POST handler for formatting a report
 */
export async function POST(
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
    
    // Validate request body
    const result = await validateRequest(req, formatReportSchema)
    
    if (!result.success) {
      return apiError({
        message: 'Invalid request data',
        errors: result.errors,
        status: 422
      })
    }
    
    const { format, style, metadataInFooter } = result.data
    
    // Format options for the report
    const formatOptions: ReportFormat = {
      format,
      style,
      metadataInFooter
    }
    
    // Get the report from database
    const reportData = await reportStorageService.getReport(reportId)
    
    // Format the report
    const formattedContent = await reportFormattingService.formatOutput(
      reportData,
      format,
      {
        style,
        metadataInFooter
      }
    )
    
    // Create formatted report response
    const formattedReport = {
      id: reportId,
      content: formattedContent,
      format,
      downloadUrl: null
    }
    
    // Return success response
    return apiSuccess({
      id: formattedReport.id,
      content: formattedReport.content,
      format: formattedReport.format,
      formattedAt: new Date().toISOString(),
      url: formattedReport.downloadUrl
    })
  } catch (error) {
    console.error('Error formatting report:', error)
    
    return apiError({
      message: error instanceof ApplicationError 
        ? error.message
        : 'Failed to format report',
      status: error instanceof ApplicationError ? error.statusCode : 500
    })
  }
}