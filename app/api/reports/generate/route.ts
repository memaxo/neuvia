/**
 * API route for generating reports
 */
import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'
import { z } from 'zod'
import { validateRequest } from '@/lib/api/validation'
import { ApplicationError } from '@/lib/errors'
import { ReportFormat } from '@/lib/chat/types'
import { reportService } from '@/lib/services/report/report-service'

// Request validation schema
const generateReportSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  workflowId: z.string().optional(),
  format: z.enum(['markdown', 'pdf', 'docx', 'html', 'json']).default('pdf'),
  style: z.enum(['clinical', 'academic', 'simplified']).default('clinical'),
  detailLevel: z.enum(['basic', 'standard', 'comprehensive']).default('standard'),
  includeVerificationData: z.boolean().default(true),
  metadataInFooter: z.boolean().default(true)
})

/**
 * POST handler for generating a report
 */
export async function POST(req: NextRequest) {
  try {
    // Validate request body
    const result = await validateRequest(req, generateReportSchema)
    
    if (!result.success) {
      return apiError({
        message: 'Invalid request data',
        errors: result.errors,
        status: 422
      })
    }
    
    const { 
      patientId, 
      workflowId, 
      format, 
      style, 
      detailLevel, 
      includeVerificationData,
      metadataInFooter
    } = result.data
    
    // Format options for the report
    const formatOptions: ReportFormat = {
      format,
      style,
      metadataInFooter
    }
    
    // Generate the report
    const report = await reportService.generateReport(patientId, {
      workflowId,
      format: formatOptions,
      detailLevel,
      includeVerificationData
    })
    
    // Return success response
    return apiSuccess({
      id: report.id,
      title: report.title,
      content: report.content,
      format: report.format,
      generatedAt: report.createdAt,
      patientId: report.patientId,
      size: report.content?.length || 0,
      url: report.downloadUrl
    })
  } catch (error) {
    console.error('Error generating report:', error)
    
    return apiError({
      message: error instanceof ApplicationError 
        ? error.message
        : 'Failed to generate report',
      status: error instanceof ApplicationError ? error.statusCode : 500
    })
  }
}