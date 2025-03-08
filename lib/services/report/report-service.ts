import { createBrowserClient } from '@/lib/supabase/clients'
import { ApplicationError } from '@/lib/errors'
import { ProcessingPhase } from '@/lib/types/workflow'
import { DocumentCategory } from '@/lib/types/document'
import logger from '@/lib/logger'
import type { ReportData, ReportDocument, ReportSections} from '@/lib/types/report';
import { ReportType, ReportStatus } from '@/lib/types/report'
import type { ResearchDocument, ResearchResult, ResearchSource } from '@/lib/types/research'
import type { VerifiedDocument } from '@/lib/types/verification'
import type { UUID } from '@/lib/types/base'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

// Create module-specific logger
const moduleLogger = logger.withMetadata({ module: 'ReportService' })

/**
 * Extended report generation parameters
 */
interface ReportGenerationParams {
  /**
   * Patient ID
   */
  patientId: string
  
  /**
   * Report type (string alias, can map to 'medical-diagnosis', 'research', etc.)
   */
  type: string
  
  /**
   * Research data
   */
  researchData: ResearchResult
  
  /**
   * Context data
   */
  contextData?: Record<string, unknown>
  
  /**
   * Whether to save to database
   */
  saveToDatabase?: boolean
}

/**
 * Extended report options
 */
interface ReportOptions {
  /**
   * Progress callback
   */
  onProgress?: (phase: ProcessingPhase, progress: number) => void
  
  /**
   * Success callback
   */
  onSuccess?: (data: ReportData) => void
  
  /**
   * Error callback
   */
  onError?: (message: string) => void
  
  /**
   * Whether to create a report document
   */
  createReportDocument?: boolean
  
  /**
   * Context data
   */
  contextData?: Record<string, unknown>
  
  /**
   * Whether to save to database
   */
  saveToDatabase?: boolean
}

/**
 * Report Service
 * Single entry point for report generation across the application
 */
export class ReportService {
  private readonly supabase: SupabaseClient<Database>

  constructor(supabaseClient?: SupabaseClient<Database>) {
    this.supabase = supabaseClient || createBrowserClient()
  }

  /**
   * Helper method to update progress status
   * @private
   */
  private updateProgressStatus(
    phase: ProcessingPhase,
    progress: number,
    currentStep: string | undefined,
    onProgress?: (phase: ProcessingPhase, progress: number) => void
  ): void {
    if (onProgress !== null && onProgress !== undefined) {
      onProgress(phase, progress);
    }
    moduleLogger.debug('Progress status updated', {
      phase,
      progress,
      currentStep,
    });
  }

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
    moduleLogger.info('Generating report from document', {
      documentId: documentInput.id,
      documentType:
        'verifiedData' in documentInput
          ? documentInput.documentType
          : documentInput.documentType,
    })

    const isVerifiedDocument = 'verifiedData' in documentInput

    // Set up progress tracking
    const updateStatus = (
      phase: ProcessingPhase,
      progress: number,
      currentStep?: string
    ) => {
      this.updateProgressStatus(phase, progress, currentStep, options?.onProgress);
    }

    try {
      updateStatus(ProcessingPhase.INITIALIZATION, 0, 'Initializing report generation')

      // Extract research data from the document
      let researchData: ResearchResult
      let patientId = ''

      if (isVerifiedDocument) {
        // For verified documents, we need to extract the research data
        const verifiedDoc = documentInput as VerifiedDocument
        const content = verifiedDoc.verifiedData?.content ?? {}
        const summary = typeof content.summary === 'string' ? content.summary : ''
        const keyFindings = Array.isArray(content.keyFindings) ? content.keyFindings : []
        
        researchData = {
          text: typeof content.content === 'string' ? content.content : '',
          sources: [],
          summary,
          keyFindings,
          timestamp: new Date(),
          confidence: 0.95,
          modelName: 'verified-document'
        }
        patientId = verifiedDoc.patientId ?? ''
      } else {
        // For research documents, use the research results
        const researchDoc = documentInput as ResearchDocument
        if (researchDoc.researchResults === null || researchDoc.researchResults === undefined || researchDoc.researchResults.length === 0) {
          throw new ApplicationError({
            message: 'No research results available for report generation',
            code: 'MISSING_RESEARCH_RESULTS'
          })
        }
        researchData = researchDoc.researchResults[0]
        patientId = researchDoc.patientId ?? ''
      }

      updateStatus(ProcessingPhase.ANALYSIS, 20, 'Generating report content')

      // Decide the final report type (string form)
      let docType = 'research'
      if (isVerifiedDocument) {
        docType = 'medical-diagnosis'
      } else if (documentInput.documentType === 'medical') {
        docType = 'medical-diagnosis'
      }

      // Generate the report
      const result = await this.generateReport({
        type: docType,
        patientId,
        researchData,
        contextData: options?.contextData,
        saveToDatabase: options?.saveToDatabase !== false,
      }, options)

      updateStatus(ProcessingPhase.COMPLETION, 90, 'Finalizing report')

      // Create a report document if requested
      if (options?.createReportDocument) {
        try {
          await this.supabase.from('reports').insert({
            id: crypto.randomUUID(),
            patient_id: patientId || '00000000-0000-0000-0000-000000000000',
            title: result.report.title,
            type: 'diagnostic',
            status: 'completed',
            content: JSON.stringify(result.report),
            department_id: '00000000-0000-0000-0000-000000000000', // Default placeholder
            created_by: '00000000-0000-0000-0000-000000000000', // Required field
            updated_by: '00000000-0000-0000-0000-000000000000', // Required field
            metadata: {
              patientInfo: {
                symptoms: [],
                medicalHistory: [],
                currentMedications: [],
                allergies: [],
                vitalSigns: {},
              },
            },
          })
        } catch (error: unknown) {
          moduleLogger.error('Failed to create report document', {
            error,
            documentId: documentInput.id,
          })
        }
      }

      // Call success callback if provided
      if (options?.onSuccess) {
        options.onSuccess(result)
      }

      moduleLogger.info('Report generation completed', {
        documentId: documentInput.id,
        reportType: docType,
      })

      return result
    } catch (error: unknown) {
      moduleLogger.error('Report generation failed', {
        error,
        documentId: documentInput.id,
        documentType:
          'verifiedData' in documentInput
            ? documentInput.documentType
            : documentInput.documentType,
      })

      if (options?.onError) {
        options.onError(error instanceof Error ? error.message : 'Unknown error')
      }

      throw new ApplicationError({
        message: 'Failed to generate report',
        cause: error,
      })
    }
  }

  /**
   * Generate a report from research data
   *
   * @param params Report generation parameters
   * @param options Report generation options
   * @returns Generated report data
   */
  async generateReport(
    params: ReportGenerationParams,
    options?: ReportOptions
  ): Promise<ReportData> {
    const startTime = Date.now()
    moduleLogger.info('Generating report', {
      type: params.type,
      patientId: params.patientId,
    })

    // Set up progress tracking
    const updateStatus = (
      phase: ProcessingPhase,
      progress: number,
      currentStep?: string
    ) => {
      this.updateProgressStatus(phase, progress, currentStep, options?.onProgress);
    }

    try {
      updateStatus(ProcessingPhase.INITIALIZATION, 10, 'Preparing report data')

      // If it's a fallback research data, handle differently
      if (params.researchData.modelName === 'fallback') {
        moduleLogger.info('Using fallback report generation for fallback research data', {
          isFallback: true,
          modelName: params.researchData.modelName,
        })
        return this.generateReportWithRunnables(
          params.researchData,
          params.patientId,
          options
        )
      }

      // Generate the report content based on the type
      let reportContent = ''
      updateStatus(ProcessingPhase.ANALYSIS, 30, 'Generating report content')

      if (params.type === 'medical-diagnosis') {
        reportContent = await this.formatMedicalDiagnosisReport(
          params.researchData.text,
          params.contextData,
          params.researchData.sources
        )
      } else if (params.type === 'research') {
        reportContent = this.formatResearchReport(
          params.researchData.text,
          params.contextData,
          params.researchData.sources
        )
      } else {
        reportContent = this.formatStandardReport(
          params.researchData.text,
          params.contextData,
          params.researchData.sources
        )
      }

      updateStatus(ProcessingPhase.COMPLETION, 80, 'Finalizing report')

      // Create the report data structure
      const sections = this.extractSections(reportContent)

      const finalReportId = crypto.randomUUID()
      const nowIso = new Date().toISOString()

      const processedModelName = params.researchData.modelName ?? 'unknown'
      const processedConfidence = typeof params.researchData.confidence === 'number'
        ? params.researchData.confidence
        : 0.8

      const reportData: ReportData = {
        report: {
          id: finalReportId,
          title: `${params.type.charAt(0).toUpperCase() + params.type.slice(1)} Report`,
          patientId: params.patientId,
          // Use the actual ReportType from the string if possible, else fallback
          reportType: this.mapReportType(params.type),
          status: ReportStatus.COMPLETED,
          sections,
          sourceDocuments: params.researchData.sources.map(s => s.url),
          createdAt: nowIso,
          updatedAt: nowIso,
          metadata: {
            generatedAt: nowIso,
            generationTimeMs: Date.now() - startTime,
            parameters: params.contextData ?? {},
            modelName: processedModelName,
            confidence: processedConfidence,
            version: '1.0',
          },
        },
        patient: typeof params.contextData?.patient === 'object' && params.contextData?.patient !== null
          ? this.ensurePatientObject(params.contextData.patient, params.patientId)
          : {
              id: params.patientId,
              firstName: 'Unknown',
              lastName: 'Patient',
            },
        sourceDocuments: this.mapSourcesToDocuments(params.researchData.sources),
      }

      // Save the report to the database if requested
      if (params.saveToDatabase !== false) {
        try {
          await this.saveReport(reportData)
        } catch (err: unknown) {
          moduleLogger.error('Failed to save report to database', {
            err,
            reportType: params.type,
          })
        }
      }

      // Call success callback if provided
      if (options?.onSuccess) {
        options.onSuccess(reportData)
      }

      moduleLogger.info('Report generation completed', {
        type: params.type,
        generationTime: Date.now() - startTime,
      })

      return reportData
    } catch (error: unknown) {
      moduleLogger.error('Report generation failed', {
        error,
        type: params.type,
      })

      if (options?.onError) {
        options.onError(error instanceof Error ? error.message : 'Unknown error')
      }

      throw new ApplicationError({
        message: 'Failed to generate report',
        cause: error,
      })
    }
  }

  /**
   * Generate a medical diagnosis report
   *
   * @param researchData Research data
   * @param patientId Patient ID
   * @param options Report generation options
   * @returns Generated report data
   */
  async generateMedicalDiagnosisReport(
    researchData: ResearchResult,
    patientId: string,
    options?: ReportOptions
  ): Promise<ReportData> {
    moduleLogger.info('Generating medical diagnosis report', {
      patientId,
    })

    return this.generateReport(
      {
        type: 'medical-diagnosis',
        patientId,
        researchData,
        contextData: options?.contextData,
        saveToDatabase: options?.saveToDatabase !== false,
      },
      options
    )
  }

  /**
   * Format report output in the specified format
   *
   * @param reportData Report data
   * @param format Output format
   * @returns Formatted report content
   */
  async formatReportOutput(
    reportData: ReportData,
    format: string = 'markdown'
  ): Promise<string> {
    moduleLogger.info('Formatting report output', {
      format,
    })

    // Gather the sections sorted by order
    const sectionsObj = reportData.report.sections
    const sortedEntries = Object.entries(sectionsObj).sort(([, a], [, b]) => a.order - b.order)

    if (format === 'markdown' || format === 'md') {
      let mdContent = `# ${reportData.report.title}\n\n`
      for (const [, section] of sortedEntries) {
        mdContent += `## ${section.title}\n\n${section.content}\n\n`
      }
      if (reportData.sourceDocuments?.length) {
        mdContent += '## Sources\n\n'
        reportData.sourceDocuments.forEach((src, i) => {
          mdContent += `${i + 1}. ${src.title ?? 'Unknown Source'}: ${src.citation ?? ''}\n`
        })
      }
      mdContent += '\n\n---\n\n'
      mdContent += `Generated at: ${new Date(reportData.report.metadata.generatedAt).toLocaleString()}\n`
      mdContent += `Report ID: ${reportData.report.id}\n`
      return mdContent
    }

    if (format === 'html') {
      const markdownVersion = await this.formatReportOutput(reportData, 'markdown')
      return await this.convertMarkdownToHtml(markdownVersion)
    }

    if (format === 'text' || format === 'txt') {
      let textContent = `${reportData.report.title}\n\n`
      for (const [, section] of sortedEntries) {
        textContent += `${section.title.toUpperCase()}\n${'='.repeat(section.title.length)}\n\n${section.content}\n\n`
      }
      if (reportData.sourceDocuments?.length) {
        textContent += 'SOURCES\n=======\n\n'
        reportData.sourceDocuments.forEach((src, i) => {
          textContent += `${i + 1}. ${src.title ?? 'Unknown Source'}: ${src.citation ?? ''}\n`
        })
      }
      textContent += '\n\n-----------------------------------------\n\n'
      textContent += `Generated at: ${new Date(reportData.report.metadata.generatedAt).toLocaleString()}\n`
      textContent += `Report ID: ${reportData.report.id}\n`
      return textContent
    }

    throw new ApplicationError({
      message: `Unsupported report format: ${format}`,
      code: 'UNSUPPORTED_FORMAT',
    })
  }

  /**
   * Generate a report using the runnables approach for fallback content
   *
   * @param researchData Research data
   * @param patientId Patient ID
   * @param options Report generation options
   * @returns Generated report data
   */
  async generateReportWithRunnables(
    researchData: ResearchResult,
    patientId: string,
    options?: ReportOptions
  ): Promise<ReportData> {
    const startTime = Date.now()
    moduleLogger.info('Generating report with runnables', {
      patientId,
    })

    const updateStatus = (phase: ProcessingPhase, progress: number, step?: string) => {
      this.updateProgressStatus(phase, progress, step, options?.onProgress);
    }

    try {
      updateStatus(ProcessingPhase.INITIALIZATION, 10, 'Preparing fallback report data')

      updateStatus(ProcessingPhase.ANALYSIS, 30, 'Generating fallback report content')

      // For fallback, just create a standard style
      const reportContent = this.formatStandardReport(
        researchData.text,
        options?.contextData,
        researchData.sources
      )

      updateStatus(ProcessingPhase.COMPLETION, 80, 'Finalizing fallback report')

      const sections = this.extractSections(reportContent)
      const fallbackReportId = crypto.randomUUID()
      const nowIso = new Date().toISOString()

      const fallbackConfidence = typeof researchData.confidence === 'number'
        ? researchData.confidence
        : 0.8

      const fallbackData: ReportData = {
        report: {
          id: fallbackReportId,
          title: 'Research Report',
          patientId,
          reportType: ReportType.SUMMARY, // fallback to SUMMARY
          status: ReportStatus.COMPLETED,
          sections,
          sourceDocuments: researchData.sources.map(s => s.url),
          createdAt: nowIso,
          updatedAt: nowIso,
          metadata: {
            generatedAt: nowIso,
            generationTimeMs: Date.now() - startTime,
            parameters: options?.contextData ?? {},
            modelName: researchData.modelName ?? 'unknown',
            confidence: fallbackConfidence,
            version: '1.0',
          },
        },
        patient: typeof options?.contextData?.patient === 'object' && options?.contextData?.patient !== null
          ? this.ensurePatientObject(options.contextData.patient, patientId)
          : {
              id: patientId,
              firstName: 'Unknown',
              lastName: 'Patient',
            },
        sourceDocuments: this.mapSourcesToDocuments(researchData.sources),
      }

      if (options?.saveToDatabase !== false) {
        try {
          await this.saveReport(fallbackData)
        } catch (err: unknown) {
          moduleLogger.error('Failed to save fallback report to database', {
            err,
          })
        }
      }

      if (options?.onSuccess) {
        options.onSuccess(fallbackData)
      }

      moduleLogger.info('Report generation with runnables completed', {
        generationTime: Date.now() - startTime,
      })

      return fallbackData
    } catch (error: unknown) {
      moduleLogger.error('Report generation with runnables failed', {
        error,
      })

      if (options?.onError) {
        options.onError(error instanceof Error ? error.message : 'Unknown error')
      }

      throw new ApplicationError({
        message: 'Failed to generate report with runnables',
        cause: error,
      })
    }
  }

  /**
   * Format a medical diagnosis report
   */
  private async formatMedicalDiagnosisReport(
    content: string,
    contextData?: Record<string, unknown>,
    sources: ResearchSource[] = []
  ): Promise<string> {
    let report = '# Medical Diagnosis Report\n\n'
    if (contextData && typeof contextData.patient === 'object' && contextData.patient !== null) {
      const patientObj = contextData.patient as Record<string, unknown>
      const fName = typeof patientObj.firstName === 'string' ? patientObj.firstName : ''
      const lName = typeof patientObj.lastName === 'string' ? patientObj.lastName : ''
      const dob = typeof patientObj.dateOfBirth === 'string' ? patientObj.dateOfBirth : 'Unknown'
      const mrn = typeof patientObj.mrn === 'string' ? patientObj.mrn : 'Unknown'
      report += '## Patient Information\n\n'
      report += `**Name**: ${fName} ${lName}\n`
      report += `**DOB**: ${dob}\n`
      report += `**MRN**: ${mrn}\n\n`
    }

    report += '## Diagnosis\n\n'
    report += `${content}\n\n`

    if (contextData && contextData.recommendations !== undefined) {
      report += '## Recommendations\n\n'
      // If it's an object, JSON.stringify it
      if (typeof contextData.recommendations === 'object' && contextData.recommendations !== null) {
        report += `${JSON.stringify(contextData.recommendations, null, 2)}\n\n`
      } else {
        report += `${String(contextData.recommendations)}\n\n`
      }
    }

    if (sources.length > 0) {
      report += '## Sources\n\n'
      sources.forEach((source, idx) => {
        report += `${idx + 1}. ${source.title ?? 'Unknown Source'}: ${source.url}\n`
      })
    }
    return report
  }

  /**
   * Format a research report
   */
  private formatResearchReport(
    content: string,
    contextData?: Record<string, unknown>,
    sources: ResearchSource[] = []
  ): string {
    let report = '# Research Report\n\n'
    if (contextData && contextData.query !== undefined) {
      report += '## Research Query\n\n'
      // If it's an object, JSON.stringify
      if (typeof contextData.query === 'object' && contextData.query !== null) {
        report += `${JSON.stringify(contextData.query, null, 2)}\n\n`
      } else {
        report += `${String(contextData.query)}\n\n`
      }
    }

    report += '## Findings\n\n'
    report += `${content}\n\n`

    if (contextData && contextData.keyPoints !== undefined && Array.isArray(contextData.keyPoints)) {
      report += '## Key Points\n\n';
      (contextData.keyPoints as Array<unknown>).forEach((point: unknown, i: number) => {
        report += `${i + 1}. ${String(point)}\n`;
      });
      report += '\n';
    }

    if (sources.length > 0) {
      report += '## Sources\n\n'
      sources.forEach((source, idx) => {
        report += `${idx + 1}. ${source.title ?? 'Unknown Source'}: ${source.url}\n`
      })
    }
    return report
  }

  /**
   * Format a standard report
   */
  private formatStandardReport(
    content: string,
    _contextData?: Record<string, unknown>, // Prefix with underscore to indicate it's unused
    sources: ResearchSource[] = []
  ): string {
    let report = '# Report\n\n'
    report += '## Content\n\n'
    report += `${content}\n\n`

    if (sources.length > 0) {
      report += '## Sources\n\n'
      sources.forEach((source, idx) => {
        report += `${idx + 1}. ${source.title ?? 'Unknown Source'}: ${source.url}\n`
      })
    }
    return report
  }

  /**
   * Convert markdown content to HTML
   */
  private async convertMarkdownToHtml(markdown: string): Promise<string> {
    try {
      let html = '<html><head><style>'
      html += 'body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }'
      html += 'h1, h2, h3 { color: #333; }'
      html += 'h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }'
      html += 'h2 { border-bottom: 1px solid #eee; padding-bottom: 5px; }'
      html += '</style></head><body>'

      const content = markdown
        .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
        .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
        .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '</p><p>')

      html += `<p>${content}</p></body></html>`
      return html
    } catch (error: unknown) {
      moduleLogger.error('Failed to convert markdown to HTML', { error })
      return `<html><body><pre>${markdown}</pre></body></html>`
    }
  }

  /**
   * Save a report to the database
   */
  private async saveReport(reportData: ReportData): Promise<string> {
    try {
      moduleLogger.info('Saving report to database', {
        reportId: reportData.report.id,
      })

      // Convert sections & sourceDocuments to JSON
      const contentObj = {
        sections: reportData.report.sections,
        sourceDocuments: reportData.report.sourceDocuments,
      }
      const contentJson = JSON.stringify(contentObj)

      // Convert the metadata to pure JSON
      // Convert any enum, record, or object to strings
      const safeMetadata = JSON.parse(JSON.stringify({
        ...reportData.report.metadata,
        // If reportType is an enum, store its string value
        reportType: String(reportData.report.reportType),
      }))

      const dbReport = {
        id: reportData.report.id,
        title: reportData.report.title,
        patient_id: reportData.report.patientId,
        type: 'diagnostic', // valid type from DB check
        status: 'completed', // valid status
        department_id: '00000000-0000-0000-0000-000000000000', // placeholder
        created_by: '00000000-0000-0000-0000-000000000000', // placeholder
        updated_by: '00000000-0000-0000-0000-000000000000', // placeholder
        content: contentJson,
        metadata: safeMetadata,
      }

      const { error } = await this.supabase.from('reports').insert(dbReport)

      if (error) {
        throw new ApplicationError({
          message: 'Failed to save report to database',
          cause: error,
        })
      }
      return reportData.report.id
    } catch (error: unknown) {
      moduleLogger.error('Failed to save report to database', {
        error,
        reportId: reportData.report.id,
      })
      throw new ApplicationError({
        message: 'Failed to save report to database',
        cause: error,
      })
    }
  }

  /**
   * Extract sections from report content
   */
  private extractSections(content: string): ReportSections {
    const sections: ReportSections = {}
    // Use a regex to find `## heading`
    const sectionRegex = /^## (.*?)$([\s\S]*?)(?=^## |\s*$)/gm
    let match: RegExpExecArray | null
    let index = 0

    while ((match = sectionRegex.exec(content)) !== null) {
      const title = match[1].trim()
      const sectionContent = match[2].trim()
      const key = title.toLowerCase().replace(/\s+/g, '_')

      sections[key] = {
        title,
        content: sectionContent,
        order: index,
        editable: true,
      }
      index++
    }

    if (Object.keys(sections).length === 0) {
      sections.content = {
        title: 'Content',
        content: content.trim(),
        order: 0,
        editable: true,
      }
    }

    return sections
  }

  /**
   * Map string to actual ReportType
   */
  private mapReportType(typeStr: string): ReportType {
    switch (typeStr.toLowerCase()) {
      case 'summary':
        return ReportType.SUMMARY
      case 'comprehensive':
        return ReportType.COMPREHENSIVE
      case 'timeline':
        return ReportType.TIMELINE
      case 'medical-diagnosis':
      case 'research':
        return ReportType.CUSTOM
      default:
        return ReportType.CUSTOM
    }
  }

  /**
   * Convert a raw object to a minimal patient object
   */
  private ensurePatientObject(
    data: unknown,
    fallbackId: string
  ): {
    id: string
    firstName: string
    lastName: string
    dateOfBirth?: string
    mrn?: string
  } {
    if (data === null || data === undefined || typeof data !== 'object') {
      return {
        id: fallbackId,
        firstName: 'Unknown',
        lastName: 'Patient',
      }
    }

    const obj = data as Record<string, unknown>
    const id = typeof obj.id === 'string' ? obj.id : fallbackId
    const firstName = typeof obj.firstName === 'string' ? obj.firstName : 'Unknown'
    const lastName = typeof obj.lastName === 'string' ? obj.lastName : 'Patient'
    const dateOfBirth = typeof obj.dateOfBirth === 'string' ? obj.dateOfBirth : undefined
    const mrn = typeof obj.mrn === 'string' ? obj.mrn : undefined

    return {
      id, firstName, lastName, dateOfBirth, mrn
    }
  }

  /**
   * Convert sources to report documents
   */
  private mapSourcesToDocuments(sources: ResearchSource[]): ReportDocument[] {
    return sources.map(source => {
      return {
        id: crypto.randomUUID(),
        title: source.title ?? 'Unknown Source',
        documentType: {
          category: DocumentCategory.ADMINISTRATIVE,
          type: 'reference',
        },
        citation: source.url,
        relevanceScore: source.index !== undefined ? 1 - source.index / sources.length : 0.5,
      }
    })
  }
}

export const reportService = new ReportService()