import { langChainCore } from '@/lib/langchain/core'
import type {
  DocumentType,
  ProcessingStatus,
} from '@/lib/processing/types/base'
import type {
  ReportData,
  ReportDocument,
  ReportFormat,
  ReportGenerationParams,
  ReportOptions,
  ReportSections,
} from '@/lib/types/report'
import type {
  ResearchDocument,
  ResearchResult,
} from '@/lib/processing/types/research'
import type { VerifiedDocument } from '@/lib/processing/types/verification'
import { createBrowserClient } from '@/lib/supabase/clients'
import { createWorkflowCallbacks, runWithWorkflow } from '@/lib/utils/langchain'
import { perplexityService } from '@/lib/services/perplexity/perplexity-service'
import logger from '@/lib/logger'
import {
  ExternalServiceError,
  ValidationError,
  NotFoundError,
  SystemError,
  normalizeError,
  AuthenticationError,
  ApplicationError,
} from '@/lib/errors'

/**
 * Unified Report Service
 *
 * Single entry point for report generation across the application
 */
export class ReportService {
  private supabase = createBrowserClient()

  /**
   * Generate a report based on a research document or verified document
   *
   * @param documentInput Research document or verified document
   * @param options Report generation options
   * @returns Generated report data
   */
  async generateReportFromDocument(
    documentInput: ResearchDocument | VerifiedDocument,
    options?: ReportOptions
  ): Promise<ReportData> {
    // Create logger with context
    const moduleLogger = logger.withMetadata({
      module: 'ReportService',
      method: 'generateReportFromDocument',
      documentType:
        'verifiedData' in documentInput
          ? (documentInput as VerifiedDocument).documentType?.type
          : (documentInput as ResearchDocument).documentType?.type,
      patientId: documentInput.patientId,
    })

    // Track status
    const statusCallback = options?.onProgress
    const updateStatus = (
      phase: string,
      progress: number,
      currentStep?: string
    ) => {
      moduleLogger.debug(
        `Report generation progress: ${phase} - ${progress}%`,
        { currentStep }
      )
      statusCallback?.(phase as any, progress)
    }

    try {
      moduleLogger.info('Starting report generation')

      // Update status
      updateStatus('initialization', 0, 'Starting report generation')

      // Determine document type
      const isVerifiedDocument = 'verifiedData' in documentInput

      // First, create a ResearchResult object if it doesn't exist
      let researchResult: ResearchResult

      // If this is a verified document, we need to do the research first
      if (isVerifiedDocument) {
        // For verified documents, we need to perform research first
        const verifiedDocument = documentInput as VerifiedDocument

        updateStatus('research', 10, 'Performing research on verified data')

        // Extract patient data from verified document
        const patientData = Object.entries(verifiedDocument.verifiedData || {})
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n')

        // Use Perplexity to research the verified data
        researchResult = await perplexityService.performDeepResearch(
          `Analyze the patient data: ${verifiedDocument.documentType}`,
          {
            patientData,
            onProgress: (progress) => {
              updateStatus(
                'research',
                Math.floor(progress * 0.6), // First 60% for research
                `Performing research (${progress}%)`
              )
            },
          }
        )
      } else {
        // For research documents, use the existing research results
        const researchDocument = documentInput as ResearchDocument

        if (
          !researchDocument.researchResults ||
          researchDocument.researchResults.length === 0
        ) {
          moduleLogger.error('Research document has no research results', {
            documentId: researchDocument.id,
          })

          throw new ValidationError({
            message: 'Research document has no research results',
            code: 'MISSING_RESEARCH_RESULTS',
            data: { documentId: researchDocument.id },
          })
        }

        researchResult = researchDocument.researchResults[0]
      }

      // Now generate the report
      updateStatus('generation', 60, 'Generating report')

      const reportType = isVerifiedDocument
        ? 'medical-diagnosis'
        : (documentInput as ResearchDocument).documentType?.type === 'medical'
          ? 'medical-diagnosis'
          : 'research'

      const result = await this.generateReport(
        {
          type: reportType,
          patientId: documentInput.patientId || '',
          researchData: researchResult,
          contextData: isVerifiedDocument
            ? { verifiedDocument: documentInput }
            : { researchDocument: documentInput },
          saveToDatabase: options?.saveToDatabase !== false,
        },
        {
          onProgress: (phase, progress) => {
            updateStatus(
              'generation',
              // Scale progress to the remaining 40% (60-100%)
              60 + Math.floor(progress * 0.4),
              `Generating report (${progress}%)`
            )
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }
      )

      // Update status
      updateStatus('complete', 100, 'Report generated')
      moduleLogger.info('Report generation completed successfully', {
        reportType: result.metadata?.reportType,
      })

      // Create and return report document if needed
      if (options?.createReportDocument) {
        const reportDocument: ReportDocument = {
          id: crypto.randomUUID(),
          createdAt: new Date(),
          documentType: isVerifiedDocument
            ? (documentInput as VerifiedDocument).documentType
            : (documentInput as ResearchDocument).documentType,
          patientId: documentInput.patientId || '',
          researchDocument: isVerifiedDocument
            ? ({} as ResearchDocument)
            : (documentInput as ResearchDocument),
          reportData: result,
          format: options.reportFormat || 'markdown',
        }

        return result
      }

      return result
    } catch (error) {
      // Handle errors with structured error and logging
      const normalizedError = normalizeError(error)

      moduleLogger.error(
        'Failed to generate report',
        {
          errorCode: normalizedError.code,
        },
        normalizedError
      )

      // Call error callback if provided
      const errorMessage = normalizedError.message
      options?.onError?.(errorMessage)

      // Check if it's already our error type
      if (error instanceof ApplicationError) {
        throw error
      }

      // Otherwise normalize to a SystemError
      throw new SystemError({
        message: 'Failed to generate report',
        code: 'REPORT_GENERATION_FAILED',
        data: {
          documentId: 'id' in documentInput ? documentInput.id : undefined,
          documentType:
            'verifiedData' in documentInput
              ? (documentInput as VerifiedDocument).documentType?.type
              : (documentInput as ResearchDocument).documentType?.type,
        },
        cause: error,
      })
    }
  }

  /**
   * Generate a report based on provided parameters
   *
   * @param params Report generation parameters
   * @param options Report options including callbacks
   * @returns Generated report data
   */
  async generateReport(
    params: ReportGenerationParams,
    options?: ReportOptions
  ): Promise<ReportData> {
    const moduleLogger = logger.withMetadata({
      module: 'ReportService',
      method: 'generateReport',
      reportType: params.type,
      patientId: params.patientId,
    })

    try {
      moduleLogger.info('Starting report generation')

      // Track start time for performance measurement
      const startTime = Date.now()

      // Initial progress update
      options?.onProgress?.('initialization', 0)

      // IMPORTANT: This service now expects research data to be provided
      // and does not perform research itself
      if (!params.researchData) {
        moduleLogger.error('Missing research data', { reportType: params.type })
        throw new ValidationError({
          message: 'Research data must be provided to generate a report',
          code: 'MISSING_RESEARCH_DATA',
          data: { reportType: params.type },
        })
      }

      options?.onProgress?.('generation', 30)

      // Check if this is a fallback research result
      // If so, use an alternate report generation path that's optimized for fallback content
      if (params.researchData.isFallback) {
        moduleLogger.info('Using fallback report generation for fallback research data', {
          isFallback: true,
          modelName: params.researchData.modelName
        })
        
        return this.generateReportWithRunnables(
          params.researchData,
          params.patientId,
          {
            ...options,
            saveToDatabase: params.saveToDatabase,
            contextData: params.contextData,
          }
        )
      }

      // Format report based on type and provided research data
      const reportContent = await this.formatReport(
        params.type,
        params.researchData.text || '',
        params.contextData,
        params.researchData.sources || []
      )

      options?.onProgress?.('generation', 75)

      // Create the report data object
      const reportData: ReportData = {
        content: reportContent,
        sources: params.researchData.sources || [],
        patientId: params.patientId,
        generatedAt: new Date(),
        metadata: {
          modelName: params.researchData.modelName || 'unknown',
          confidence: params.researchData.confidence || 0.8,
          generationTime: Date.now() - startTime,
          reportType: params.type,
          contextData: params.contextData,
          isFallback: params.researchData.isFallback || false
        },
        sections: this.extractSections(reportContent),
      }

      options?.onProgress?.('generation', 90)

      // Save the report to the database if requested
      if (params.saveToDatabase) {
        await this.saveReport(reportData)
      }

      options?.onProgress?.('complete', 100)

      // Call success callback if provided
      options?.onSuccess?.(reportData)

      moduleLogger.info('Report generation completed successfully', {
        generationTime: Date.now() - startTime,
        reportType: params.type,
        isFallback: params.researchData.isFallback || false
      })

      return reportData
    } catch (error) {
      moduleLogger.error(
        'Standard report generation failed, attempting fallback approach',
        {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
        },
        error
      )
      
      // Try using the Runnable-based approach as a fallback when formatting fails
      try {
        moduleLogger.info('Using fallback report generation method')
        options?.onProgress?.('fallback', 40)
        
        const fallbackReport = await this.generateReportWithRunnables(
          params.researchData,
          params.patientId,
          {
            ...options,
            saveToDatabase: params.saveToDatabase,
            contextData: params.contextData,
          }
        )
        
        moduleLogger.info('Fallback report generation succeeded')
        return fallbackReport
      } catch (fallbackError) {
        // Handle errors with normalized error handling
        const normalizedError = normalizeError(error)

        moduleLogger.error(
          'All report generation methods failed',
          {
            errorCode: normalizedError.code,
            originalError: error instanceof Error ? error.message : String(error),
            fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          },
          normalizedError
        )

        // Call error callback if provided
        options?.onError?.(normalizedError.message)

        // If it's already our error type, rethrow it
        if (error instanceof ApplicationError) {
          throw error
        }

        // Otherwise normalize to a SystemError
        throw new SystemError({
          message: 'Failed to generate report',
          code: 'REPORT_GENERATION_FAILED',
          data: {
            reportType: params.type,
            patientId: params.patientId,
          },
          cause: error,
        })
      }
    }
  }

  /**
   * Generate a medical diagnosis report from existing research data
   *
   * @param researchData Research data from previous API call
   * @param patientId Patient ID
   * @param options Report options
   * @returns Generated report data
   */
  async generateMedicalDiagnosisReport(
    researchData: ResearchResult,
    patientId: string,
    options?: ReportOptions
  ): Promise<ReportData> {
    return this.generateReport(
      {
        type: 'medical-diagnosis',
        patientId,
        researchData,
        contextData: {
          patientData: researchData.patientData,
        },
        saveToDatabase: options?.saveToDatabase !== false,
      },
      options
    )
  }

  /**
   * Format a report to the specified format
   *
   * @param reportData Report data to format
   * @param format Desired format
   * @returns Formatted report content
   */
  async formatReportOutput(
    reportData: ReportData,
    format: ReportFormat = 'markdown'
  ): Promise<string> {
    if (!reportData) {
      throw new ValidationError({
        message: 'No report data available for formatting',
        code: 'MISSING_REPORT_DATA',
      })
    }

    const moduleLogger = logger.withMetadata({
      module: 'ReportService',
      method: 'formatReportOutput',
      format,
      patientId: reportData.patientId,
    })

    try {
      moduleLogger.info('Formatting report output', { format })

      // Format report based on desired output format
      let formattedContent = reportData.content

      switch (format) {
        case 'html':
          // Convert markdown to HTML
          formattedContent = await this.convertMarkdownToHtml(
            reportData.content
          )
          break

        case 'pdf':
          // For PDF, we'd typically generate HTML first then convert to PDF
          // This is a placeholder for that logic
          const htmlContent = await this.convertMarkdownToHtml(
            reportData.content
          )
          formattedContent = htmlContent
          // In a real implementation, you would convert HTML to PDF here
          break

        case 'markdown':
        default:
          // No conversion needed for markdown
          break
      }

      moduleLogger.info('Report formatting completed', { format })
      return formattedContent
    } catch (error) {
      const normalizedError = normalizeError(error)

      moduleLogger.error(
        'Failed to format report',
        {
          format,
          errorCode: normalizedError.code,
        },
        normalizedError
      )

      throw new ExternalServiceError({
        message: 'Failed to format report',
        code: 'REPORT_FORMAT_FAILED',
        service: 'FormatService',
        data: { format },
        cause: error,
      })
    }
  }

  /**
   * Generate report using enhanced Runnable patterns from LangChain
   * This method uses the new Runnable interface for better composition and streaming
   */
  async generateReportWithRunnables(
    researchData: ResearchResult,
    patientId: string,
    options?: ReportOptions
  ): Promise<ReportData> {
    try {
      // Track start time for performance measurement
      const startTime = Date.now()

      const moduleLogger = logger.withMetadata({
        module: 'ReportService',
        method: 'generateReportWithRunnables',
        patientId,
      })

      moduleLogger.info('Starting report generation with Runnable patterns')
      options?.onProgress?.('initialization', 10)

      // Create model with callbacks
      const llm = langChainCore.createChatOpenAI({
        temperature: 0.4,
        callbacks: createWorkflowCallbacks(null, 'report_generation', {
          onProgress: (progress: number) => {
            options?.onProgress?.('generation', progress)
          },
        }),
      })

      options?.onProgress?.('generation', 20)

      // Create a structured output schema for the report
      const reportChain = langChainCore.createStructuredOutputChain(
        langChainCore.createChatPromptTemplate(
          // System template
          `You are a medical report writer tasked with analyzing research data and creating a structured report.
           Analyze the following research data and extract key insights:
           
           {researchText}
           
           Create a professional medical report with the following sections:
           - Summary: A brief overview of the key findings
           - Findings: Detailed analysis of the research data
           - Diagnoses: Any potential diagnoses based on the findings
           - Recommendations: Suggested next steps or treatments
           - References: Sources used in the analysis`,
          // Human template
          `Please generate a comprehensive medical report based on the research data.`,
          // Input variables
          ['researchText']
        ),
        llm
      )

      options?.onProgress?.('generation', 40)

      // Invoke the chain with the research data
      const result = await reportChain.invoke({
        researchText: researchData.text,
      })

      options?.onProgress?.('generation', 80)

      // Create the report data object
      const reportData: ReportData = {
        content:
          result.content || result.text || JSON.stringify(result, null, 2),
        sources: researchData.sources || [],
        patientId,
        generatedAt: new Date(),
        metadata: {
          modelName: 'gpt-4',
          confidence: 0.85,
          generationTime: Date.now() - startTime,
          reportType: 'medical-diagnosis',
          contextData: options?.contextData,
        },
        sections:
          result.sections ||
          this.extractSections(result.content || result.text || ''),
      }

      options?.onProgress?.('generation', 90)

      // Save the report if requested
      if (options?.saveToDatabase !== false) {
        await this.saveReport(reportData)
      }

      options?.onProgress?.('complete', 100)

      // Call success callback if provided
      options?.onSuccess?.(reportData)

      moduleLogger.info(
        'Report generation with Runnables completed successfully',
        {
          generationTime: Date.now() - startTime,
        }
      )

      return reportData
    } catch (error) {
      // Handle errors
      const normalizedError = normalizeError(error)

      const errorLogger = logger.withMetadata({
        module: 'ReportService',
        method: 'generateReportWithRunnables',
        patientId,
        errorCode: normalizedError.code,
      })

      errorLogger.error(
        'Failed to generate report with Runnables',
        {},
        normalizedError
      )

      // Call error callback if provided
      options?.onError?.(normalizedError.message)

      // If it's already our error type, rethrow it
      if (error instanceof ApplicationError) {
        throw error
      }

      // Otherwise normalize to an ExternalServiceError
      throw new ExternalServiceError({
        message: 'Failed to generate report with AI',
        code: 'LANGCHAIN_RUNNABLE_REPORT_FAILED',
        service: 'Langchain',
        data: { patientId },
        cause: error,
      })
    }
  }

  /**
   * Format a report based on type and content
   *
   * @param type Report type
   * @param content Main report content
   * @param contextData Additional context data
   * @param sources Research sources
   * @returns Formatted report content
   */
  private async formatReport(
    type: string,
    content: string,
    contextData?: Record<string, any>,
    sources: any[] = []
  ): Promise<string> {
    // Format based on report type
    switch (type) {
      case 'medical-diagnosis':
        return this.formatMedicalDiagnosisReport(content, contextData, sources)

      case 'research':
        return this.formatResearchReport(content, contextData, sources)

      default:
        return this.formatStandardReport(content, contextData, sources)
    }
  }

  /**
   * Format a medical diagnosis report
   *
   * @param content Main report content
   * @param contextData Additional context data
   * @param sources Research sources
   * @returns Formatted medical diagnosis report
   */
  private formatMedicalDiagnosisReport(
    content: string,
    contextData?: Record<string, any>,
    sources: any[] = []
  ): string {
    // Extract patient info from context data
    const patientName = contextData?.patientName || 'Patient'

    // Create a properly formatted medical report
    let report = `# Medical Diagnosis Report for ${patientName}\n\n`

    // Add primary content
    report += `## Summary\n\n${content}\n\n`

    // Add sections if not already in the content
    if (
      !content.includes('## Findings') &&
      !content.includes('## Assessment')
    ) {
      report += `## Findings\n\nBased on the provided information, the patient presents with...\n\n`
      report += `## Assessment\n\nThe assessment indicates...\n\n`
      report += `## Recommendations\n\nRecommended next steps include...\n\n`
    }

    // Add sources section if available
    if (sources.length > 0) {
      report += `## References\n\n`
      sources.forEach((source, index) => {
        report += `${index + 1}. ${source.title || 'Unknown Source'} - ${source.url || 'No URL'}\n`
      })
    }

    return report
  }

  /**
   * Format a research report
   *
   * @param content Main report content
   * @param contextData Additional context data
   * @param sources Research sources
   * @returns Formatted research report
   */
  private formatResearchReport(
    content: string,
    contextData?: Record<string, any>,
    sources: any[] = []
  ): string {
    // Create a properly formatted research report
    let report = `# Research Report\n\n`

    // Add query if available
    if (contextData?.query) {
      report += `**Query:** ${contextData.query}\n\n`
    }

    // Add primary content
    report += `## Findings\n\n${content}\n\n`

    // Add sources section if available
    if (sources.length > 0) {
      report += `## Sources\n\n`
      sources.forEach((source, index) => {
        report += `${index + 1}. ${source.title || 'Unknown Source'} - ${source.url || 'No URL'}\n`
        if (source.description) {
          report += `   ${source.description}\n\n`
        }
      })
    }

    return report
  }

  /**
   * Format a standard report
   *
   * @param content Main report content
   * @param contextData Additional context data
   * @param sources Research sources
   * @returns Formatted standard report
   */
  private formatStandardReport(
    content: string,
    contextData?: Record<string, any>,
    sources: any[] = []
  ): string {
    // Create a properly formatted standard report
    let report = `# Report\n\n`

    // Add primary content
    report += content

    // Add sources if available
    if (sources.length > 0) {
      report += `\n\n## References\n\n`
      sources.forEach((source, index) => {
        report += `${index + 1}. ${source.title || 'Unknown Source'} - ${source.url || 'No URL'}\n`
      })
    }

    return report
  }

  /**
   * Convert markdown to HTML
   *
   * @param markdown Markdown content
   * @returns HTML content
   */
  private async convertMarkdownToHtml(markdown: string): Promise<string> {
    // This is a placeholder for a real markdown-to-html converter
    // In a production environment, you would use a library like marked or showdown

    const simpleHtml = markdown
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />')

    return `<html><body>${simpleHtml}</body></html>`
  }

  /**
   * Save a report to the database
   *
   * @param report Report data to save
   * @returns Saved report ID
   */
  private async saveReport(report: ReportData): Promise<string> {
    const moduleLogger = logger.withMetadata({
      module: 'ReportService',
      method: 'saveReport',
      patientId: report.patientId,
      reportType: report.metadata?.reportType,
    })

    try {
      moduleLogger.info('Saving report to database')

      // Get the current user ID from Supabase
      const {
        data: { user },
      } = await this.supabase.auth.getUser()
      const userId = user?.id

      if (!userId) {
        moduleLogger.error('Authentication required to save report')
        throw new AuthenticationError({
          message: 'User must be authenticated to save reports',
          code: 'AUTH_REQUIRED_FOR_REPORT',
        })
      }

      // Prepare a valid report record that matches the database schema
      const reportRecord = {
        patient_id: report.patientId,
        title:
          report.metadata.title ||
          `${report.metadata.reportType || 'diagnostic'} Report`,
        type:
          report.metadata.reportType === 'medical-diagnosis'
            ? 'diagnostic'
            : report.metadata.reportType === 'research'
              ? 'analytics'
              : 'diagnostic',
        status: 'completed',
        department_id:
          report.metadata.departmentId ||
          '00000000-0000-0000-0000-000000000000', // Default placeholder
        created_by: userId,
        updated_by: userId,

        // Convert content from markdown to JSON if needed
        content:
          typeof report.content === 'string'
            ? JSON.stringify({ markdown: report.content })
            : report.content,

        // Required metadata with strict structure
        metadata: {
          patientInfo: {
            symptoms: [],
            medicalHistory: [],
            currentMedications: [],
            allergies: [],
            vitalSigns: {},
          },
        },

        // Optional fields that might come from research
        summary: report.sections?.summary || '',
        findings: report.sections?.findings
          ? JSON.parse(
              `[{"description": "${report.sections.findings}", "category": "general", "severity": "medium"}]`
            )
          : null,
        recommendations: report.sections?.recommendations
          ? JSON.parse(
              `[{"recommendation": "${report.sections.recommendations}", "priority": "medium"}]`
            )
          : null,

        // Quality metrics
        confidence_score: report.metadata.confidence || 0.8,

        // Supporting documentation
        source_documents:
          report.sources && report.sources.length > 0
            ? report.sources.map((s) => ({
                title: s.title || 'Unnamed Source',
                url: s.url,
                description: s.description || '',
              }))
            : null,
      }

      // Insert the report
      const { data, error } = await this.supabase
        .from('reports')
        .insert(reportRecord)
        .select('id')
        .single()

      if (error) {
        moduleLogger.error('Database error saving report', { error })
        throw new ExternalServiceError({
          message: `Failed to save report to database`,
          code: 'DB_SAVE_FAILED',
          service: 'Database',
          data: {
            dbError: error.message,
            patientId: report.patientId,
          },
          cause: error,
        })
      }

      moduleLogger.info('Report saved successfully', { reportId: data.id })
      return data.id
    } catch (error) {
      // If it's already one of our error types, just log and rethrow
      if (error instanceof ApplicationError) {
        moduleLogger.error(
          'Failed to save report',
          {
            errorCode: error.code,
          },
          error
        )
        throw error
      }

      // Otherwise create a new error
      const normalizedError = normalizeError(error)
      moduleLogger.error('Failed to save report', {}, normalizedError)

      throw new SystemError({
        message: 'Failed to save report to database',
        code: 'REPORT_SAVE_FAILED',
        data: { patientId: report.patientId },
        cause: error,
      })
    }
  }

  /**
   * Extract sections from report content
   *
   * @param content Report content
   * @returns Extracted sections
   */
  private extractSections(content: string): ReportSections {
    const sections: ReportSections = {}

    // Extract sections based on markdown headers
    const sectionRegex = /## ([^\n]+)\n\n([^#]+)(?=\n## |$)/g
    let match

    while ((match = sectionRegex.exec(content)) !== null) {
      const sectionName = match[1].trim().toLowerCase().replace(/\s+/g, '_')
      const sectionContent = match[2].trim()
      sections[sectionName] = sectionContent
    }

    // Extract summary from first paragraph if no sections found
    if (Object.keys(sections).length === 0) {
      const firstParagraph = content.split('\n\n')[0]
      if (firstParagraph) {
        sections.summary = firstParagraph
      }
    }

    return sections
  }
}

// Export singleton instance
export const reportService = new ReportService()
