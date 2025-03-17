/**
 * Report Generation Node for LangGraph Workflow
 *
 * This node handles generation of patient reports based on verified summaries.
 * It integrates with the report services to generate, format, and store reports.
 */

import { reportGenerationService } from '@/lib/services/report/report-generation-service'
import { reportFormattingService } from '@/lib/services/report/report-formatting-service'
import { reportStorageService } from '@/lib/services/report/report-storage-service'
import { WorkflowSteps, ProcessingPhase } from '@/lib/types/workflow'
import { ReportFormat, ReportType, ReportGenerationParams } from '@/lib/types/report'
import type { WorkflowState, PartialWorkflowState } from '@/workflow/state/workflow-state'
import logger from '@/lib/logger'

// Create module-level logger
const moduleLogger = logger.withMetadata({ module: 'ReportGenerationNode' })

/**
 * Report generation node for LangGraph workflow
 *
 * This node takes a verified patient summary and generates a formatted report,
 * storing it in the database and updating the workflow state with the report information.
 *
 * @param state The current workflow state
 * @returns A partial workflow state with report generation results
 */
export const reportGenerationNode = async (
  state: WorkflowState
): Promise<PartialWorkflowState> => {
  try {
    // Log the start of report generation
    moduleLogger.info('Starting report generation', {
      patientId: state.patientId,
      threadId: state.threadId
    })
    
    // Update progress state to indicate report generation is starting
    const partialState: PartialWorkflowState = {
      progress: {
        currentStep: WorkflowSteps.REPORT_GENERATION,
        percentage: 80,
        phase: ProcessingPhase.REPORT_GENERATION,
        isCompleted: false
      },
      workflowUpdatedAt: new Date().toISOString()
    }
    
    // Validate required state data
    if (!state.patientId) {
      throw new Error('Patient ID is required for report generation')
    }
    
    if (!state.patientSummary && !state.verification?.status) {
      throw new Error('Verified patient summary is required for report generation')
    }
    
    // Update progress
    partialState.progress = {
      currentStep: WorkflowSteps.REPORT_GENERATION,
      percentage: 85,
      phase: ProcessingPhase.REPORT_GENERATION,
      isCompleted: false
    }
    
    // Extract structured data from the patient summary
    const patientSummary = state.patientSummary
    const patientSummaryMarkdown = state.patientSummaryMarkdown
    const structuredData = state.patientSummaryStructuredData || {}
    
    // Determine report type based on available data or state preferences
    const reportType = state.context?.reportType || ReportType.COMPREHENSIVE
    
    // Format output depending on desired format (default to markdown)
    const format = (state.context?.outputFormat as ReportFormat) || ReportFormat.MARKDOWN
    
    // Create research data mockup for the report generation
    // In a real implementation, this would come from aggregated data
    const researchData = {
      text: patientSummaryMarkdown || '',
      sources: [],
      summary: typeof structuredData.summary === 'string' ? structuredData.summary : '',
      keyFindings: Array.isArray(structuredData.keyFindings) ? structuredData.keyFindings : [],
      timestamp: new Date(),
      confidence: 0.95,
      modelName: 'verified-summary'
    }
    
    // Create context data with patient information
    const contextData = {
      patient: {
        id: state.patientId,
        firstName: typeof structuredData.firstName === 'string' ? structuredData.firstName : 'Unknown',
        lastName: typeof structuredData.lastName === 'string' ? structuredData.lastName : 'Patient',
        dateOfBirth: typeof structuredData.dateOfBirth === 'string' ? structuredData.dateOfBirth : undefined,
        mrn: typeof structuredData.mrn === 'string' ? structuredData.mrn : undefined
      },
      recommendations: Array.isArray(structuredData.recommendations) ? structuredData.recommendations : []
    }
    
    // Generate the report using the report generation service
    const generationStartTime = Date.now()
    moduleLogger.info('Generating report content', {
      patientId: state.patientId,
      reportType
    })
    
    const reportData = await reportGenerationService.generate({
      type: reportType.toString().toLowerCase(),
      patientId: state.patientId,
      researchData,
      contextData
    })
    
    const generationTime = Date.now() - generationStartTime
    moduleLogger.info('Report content generated', {
      patientId: state.patientId,
      reportId: reportData.report.id,
      generationTimeMs: generationTime
    })
    
    // Update progress
    partialState.progress = {
      currentStep: WorkflowSteps.REPORT_GENERATION,
      percentage: 90,
      phase: ProcessingPhase.FORMATTING,
      isCompleted: false
    }
    
    // Format the report if a specific format is requested
    if (format !== ReportFormat.MARKDOWN) {
      const formatStartTime = Date.now()
      moduleLogger.info('Formatting report', {
        patientId: state.patientId,
        reportId: reportData.report.id,
        format
      })
      
      const formatter = getFormatterForType(reportType.toString().toLowerCase())
      const formatOptions = formatter.getFormatOptions(format)
      
      const formattedContent = await reportFormattingService.formatOutput(
        reportData,
        format,
        formatOptions
      )
      
      // Add the formatted content to the report data
      reportData.formattedContent = {
        ...reportData.formattedContent,
        [format]: formattedContent
      }
      
      const formatTime = Date.now() - formatStartTime
      moduleLogger.info('Report formatting completed', {
        patientId: state.patientId,
        reportId: reportData.report.id,
        format,
        formatTimeMs: formatTime
      })
    }
    
    // Update progress
    partialState.progress = {
      currentStep: WorkflowSteps.REPORT_GENERATION,
      percentage: 95,
      phase: ProcessingPhase.STORAGE,
      isCompleted: false
    }
    
    // Save the report to storage
    const storageStartTime = Date.now()
    moduleLogger.info('Saving report to storage', {
      patientId: state.patientId,
      reportId: reportData.report.id
    })
    
    const savedReportId = await reportStorageService.saveReport(reportData)
    
    const storageTime = Date.now() - storageStartTime
    moduleLogger.info('Report saved to storage', {
      patientId: state.patientId,
      reportId: savedReportId,
      storageTimeMs: storageTime
    })
    
    // Final progress update
    partialState.progress = {
      currentStep: WorkflowSteps.REPORT_GENERATION,
      percentage: 100,
      phase: ProcessingPhase.COMPLETED,
      isCompleted: true
    }
    
    // Prepare report metadata for the state
    const reportMetadata = {
      title: reportData.report.title,
      generatedAt: reportData.report.metadata.generatedAt,
      format,
      sections: Object.keys(reportData.report.sections),
      status: 'completed'
    }
    
    moduleLogger.info('Report generation completed successfully', {
      patientId: state.patientId,
      reportId: savedReportId,
      totalTimeMs: generationTime + storageTime
    })
    
    // Return updated state with report information
    return {
      ...partialState,
      reportId: savedReportId,
      reportMetadata,
      reportData: {
        id: savedReportId,
        type: reportType,
        format,
        content: reportData.formattedContent?.[format] || patientSummaryMarkdown
      },
      progress: {
        currentStep: WorkflowSteps.REPORT_COMPLETED,
        percentage: 100,
        phase: ProcessingPhase.COMPLETED,
        isCompleted: true
      },
      workflowUpdatedAt: new Date().toISOString()
    }
  } catch (error) {
    // Log error
    moduleLogger.error('Report generation failed', {
      patientId: state.patientId
    }, error)
    
    // Return error state
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown report generation error',
        code: 'REPORT_GENERATION_ERROR',
        step: WorkflowSteps.REPORT_GENERATION,
        timestamp: new Date().toISOString(),
        recoverable: false,
        details: {
          error: String(error),
          patientId: state.patientId
        }
      },
      progress: {
        currentStep: WorkflowSteps.ERROR,
        percentage: state.progress?.percentage || 0,
        phase: ProcessingPhase.ERROR,
        isCompleted: false
      },
      workflowUpdatedAt: new Date().toISOString()
    }
  }
}

/**
 * Helper to get the appropriate formatter for a report type
 */
function getFormatterForType(type: string) {
  const { getFormatterForType } = require('@/lib/services/report/formatters/report-formatter')
  return getFormatterForType(type)
}

/**
 * Enhanced report generation node with more customization options
 * This is an alternative entry point for workflows that need more detailed report options
 *
 * @param state The current workflow state
 * @param options Additional report generation options
 * @returns A partial workflow state with report generation results
 */
export const enhancedReportGenerationNode = async (
  state: WorkflowState,
  options: {
    reportType?: ReportType;
    format?: ReportFormat;
    includeSources?: boolean;
    includeRecommendations?: boolean;
    includeVisualizations?: boolean;
  } = {}
): Promise<PartialWorkflowState> => {
  // Merge options into the state context
  const contextWithOptions = {
    ...state.context,
    reportType: options.reportType || state.context?.reportType,
    outputFormat: options.format || state.context?.outputFormat,
    includeSources: options.includeSources !== undefined ? options.includeSources : true,
    includeRecommendations: options.includeRecommendations !== undefined ? options.includeRecommendations : true,
    includeVisualizations: options.includeVisualizations !== undefined ? options.includeVisualizations : false
  }
  
  // Call the standard report generation node with the enhanced context
  return reportGenerationNode({
    ...state,
    context: contextWithOptions
  })
}

export default reportGenerationNode