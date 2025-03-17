/**
 * API route for generating reports
 */
import type { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'
import { z } from 'zod'
import { validateRequest } from '@/lib/api/validation'
import { ApplicationError } from '@/lib/errors'
import type { ReportFormat } from '@/lib/chat/types'
import { reportGenerationService, reportStorageService } from '@/lib/services/report'

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
    
    // TODO: This is a simplified implementation - in real code, we would need to get the research data first
    // For now, create placeholder research data
    const researchData = {
      text: `Generated report for patient ${patientId}`,
      sources: [],
      summary: "Patient summary",
      keyFindings: ["Finding 1", "Finding 2"],
      timestamp: new Date(),
      confidence: 0.9,
      modelName: "gpt-4"
    }
    
    // Generate the report
    const reportData = await reportGenerationService.generate({
      patientId,
      type: detailLevel === 'comprehensive' ? 'medical-diagnosis' : 'summary',
      researchData,
      contextData: {
        workflowId,
        includeVerificationData,
        format: formatOptions
      }
    })
    
    // Save to database
    await reportStorageService.saveReport(reportData)
    
    // Convert to API response format
    const report = {
      id: reportData.report.id,
      title: reportData.report.title,
      content: JSON.stringify(reportData.report.sections),
      format: format,
      createdAt: reportData.report.createdAt,
      patientId: reportData.report.patientId,
      downloadUrl: null
    }
    
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