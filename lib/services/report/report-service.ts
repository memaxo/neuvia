import { createBrowserClient } from '@/lib/supabase/clients'
import { ApplicationError } from '@/lib/errors'
import { ProcessingPhase } from '@/lib/types/workflow'
import { DocumentCategory } from '@/lib/types/document'
import logger from '@/lib/logger'
import type { ReportData, ReportDocument, ReportSections} from '@/lib/types/report';
import { ReportType, ReportStatus } from '@/lib/types/report'
import { reportTypeMapper, reportStatusMapper } from '@/lib/types/report-mapper'
import type { ResearchDocument, ResearchResult, ResearchSource } from '@/lib/types/research'
import type { VerifiedDocument } from '@/lib/types/verification'
import type { UUID } from '@/lib/types/base'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { getFormatterForType } from './formatters/report-formatter'
import { SectionParser } from './parsers/section-parser'

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
 *
 * PHASE 1 ANALYSIS NOTES:
 * - This service encapsulates domain logic related to report generation
 * - Note on line 97-98: "extracts the domain logic from the workflow file"
 *   suggests this service was intentionally refactored to pull logic from workflows
 * - Contains business logic for report formatting, data merging, and persistence
 * - Should be the single point of entry for all report operations, not workflow files
 */
export class ReportService {
  private readonly supabase: SupabaseClient<Database>

  constructor(supabaseClient?: SupabaseClient<Database>) {
    this.supabase = supabaseClient || createBrowserClient()
  }
  
  /**
   * Prepare report data for workflow processing
   * This method extracts the domain logic from the workflow file
   * 
   * @param options Report generation options
   * @returns Processed report data with ID and metadata
   */
  async prepareReportData(options: {
    workflowId: string;
    verificationId: string;
    userId: string;
  }): Promise<{
    reportId: string;
    metadata: Record<string, any>;
  }> {
    const reportModuleLogger = logger.withMetadata({
      module: 'ReportService',
      method: 'prepareReportData',
      workflowId: options.workflowId,
      verificationId: options.verificationId
    });
    
    try {
      // Generate a new report ID
      const reportId = crypto.randomUUID();
      
      // Build report metadata
      const metadata = {
        reportId,
        generatedAt: new Date().toISOString(),
        generatedBy: options.userId,
        sourceVerificationId: options.verificationId,
        workflowId: options.workflowId,
        status: 'pending',
        reportType: ReportType.DIAGNOSTIC
      };
      
      reportModuleLogger.info('Report data prepared for workflow', {
        reportId,
        workflowId: options.workflowId,
        verificationId: options.verificationId
      });
      
      return {
        reportId,
        metadata
      };
    } catch (error) {
      reportModuleLogger.error('Failed to prepare report data', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Provide fallback data in case of error
      return {
        reportId: crypto.randomUUID(),
        metadata: {
          generatedAt: new Date().toISOString(),
          generatedBy: options.userId,
          status: 'pending',
          sourceVerificationId: options.verificationId
        }
      };
    }
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

      // Generate the report content based on the type using the formatter strategy
      updateStatus(ProcessingPhase.ANALYSIS, 30, 'Generating report content')

      // Use the formatter strategy pattern
      const formatter = getFormatterForType(params.type)
      const reportContent = formatter.format(
        params.researchData.text,
        params.contextData,
        params.researchData.sources
      )

      updateStatus(ProcessingPhase.COMPLETION, 80, 'Finalizing report')

      // Create the report data structure using the section parser
      const sections = SectionParser.extractSections(reportContent)

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
          reportType: reportTypeMapper.toDomain(params.type),
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
   * @param formatOptions Optional format-specific options
   * @param onProgress Optional progress callback
   * @returns Formatted report content
   */
  export async formatReportOutput(
    reportData: ReportData,
    format: string = 'markdown',
    formatOptions: Record<string, unknown> = {},
    onProgress?: (progress: number, phase: ProcessingPhase) => void
  ): Promise<string> {
    moduleLogger.info('Formatting report output', {
      format,
      formatOptions
    });
  
    // Report progress if callback provided
    const reportProgress = (progress: number, phase: ProcessingPhase = ProcessingPhase.REPORT_FORMATTING) => {
      if (onProgress) {
        onProgress(progress, phase);
      }
    };
  
    reportProgress(10);
  
    // Gather the sections sorted by order
    const sectionsObj = reportData.report.sections
    const sortedEntries = Object.entries(sectionsObj).sort(([, a], [, b]) => a.order - b.order)
  
    reportProgress(20);
  
    // Check if we have a supported formatter for this format
    const formatter = getFormatterForType(reportData.report.reportType.toString());
    const supportedFormats = formatter.getSupportedFormats();
    
    if (!supportedFormats.includes(format)) {
      moduleLogger.warn(`Format ${format} not directly supported, falling back to best match`, {
        requestedFormat: format,
        supportedFormats
      });
    }
  
    reportProgress(30);
  
    // Get format-specific options with defaults
    const mergedOptions = {
      ...formatter.getFormatOptions(format),
      ...formatOptions
    };
  
    reportProgress(40);
  
    // Process based on format
    if (format === 'markdown' || format === 'md') {
      let mdContent = `# ${reportData.report.title}\n\n`
      
      reportProgress(50);
      
      for (const [, section] of sortedEntries) {
        mdContent += `## ${section.title}\n\n${section.content}\n\n`
      }
      
      reportProgress(70);
      
      // Include sources if specified in options
      if (reportData.sourceDocuments?.length &&
          (mergedOptions.includeSources === undefined || mergedOptions.includeSources === true)) {
        mdContent += '## Sources\n\n'
        reportData.sourceDocuments.forEach((src, i) => {
          mdContent += `${i + 1}. ${src.title ?? 'Unknown Source'}: ${src.citation ?? ''}\n`
        })
      }
      
      // Include footer
      mdContent += '\n\n---\n\n'
      mdContent += `Generated at: ${new Date(reportData.report.metadata.generatedAt).toLocaleString()}\n`
      mdContent += `Report ID: ${reportData.report.id}\n`
      
      reportProgress(100);
      return mdContent;
    }
  
    if (format === 'html') {
      // Get markdown first, then convert to HTML
      reportProgress(50);
      const markdownVersion = await this.formatReportOutput(
        reportData,
        'markdown',
        {
          ...mergedOptions,
          // Force progress reporting to avoid duplicate callbacks
          _skipProgress: true
        }
      );
      
      reportProgress(80);
      // Convert to HTML with format options
      const html = await this.convertMarkdownToHtml(
        markdownVersion,
        mergedOptions as {
          includeStyles?: boolean;
          responsiveDesign?: boolean;
          tableOfContents?: boolean;
        }
      );
      
      reportProgress(100);
      return html;
    }
  
    if (format === 'text' || format === 'txt') {
      const plainTextWidth = typeof mergedOptions.plainTextWidth === 'number'
        ? mergedOptions.plainTextWidth
        : 80;
        
      let textContent = `${reportData.report.title}\n\n`;
      
      reportProgress(50);
      
      for (const [, section] of sortedEntries) {
        textContent += `${section.title.toUpperCase()}\n${'='.repeat(Math.min(section.title.length, plainTextWidth))}\n\n${section.content}\n\n`
      }
      
      reportProgress(70);
      
      // Include sources if specified in options
      if (reportData.sourceDocuments?.length &&
          (mergedOptions.includeSources === undefined || mergedOptions.includeSources === true)) {
        textContent += 'SOURCES\n=======\n\n'
        reportData.sourceDocuments.forEach((src, i) => {
          textContent += `${i + 1}. ${src.title ?? 'Unknown Source'}: ${src.citation ?? ''}\n`
        })
      }
      
      // Include footer
      textContent += '\n\n' + '-'.repeat(Math.min(plainTextWidth, 80)) + '\n\n'
      textContent += `Generated at: ${new Date(reportData.report.metadata.generatedAt).toLocaleString()}\n`
      textContent += `Report ID: ${reportData.report.id}\n`
      
      reportProgress(100);
      return textContent;
    }
  
    // Support for PDF generation (placeholder)
    if (format === 'pdf') {
      reportProgress(40);
      // In a real implementation this would use a PDF generation library
      // Here we'll create a placeholder with a message
      const htmlVersion = await this.formatReportOutput(
        reportData,
        'html',
        mergedOptions,
        // Pipe through progress but remap the range
        (progress, phase) => reportProgress(40 + progress * 0.5, phase)
      );
      
      reportProgress(90);
      // Simulate PDF conversion
      const pdfPlaceholder = `PDF_CONTENT
  ===== PDF CONVERSION PLACEHOLDER =====
  Report: ${reportData.report.title}
  Generated: ${new Date().toISOString()}
  Options: ${JSON.stringify(mergedOptions)}
  Content Length: ${htmlVersion.length} bytes
  ===================================
  `;
      
      reportProgress(100);
      return pdfPlaceholder;
    }
  
    // Support for DOCX generation (placeholder)
    if (format === 'docx') {
      reportProgress(40);
      // In a real implementation this would use a DOCX generation library
      // Here we'll create a placeholder with a message
      const markdownVersion = await this.formatReportOutput(
        reportData,
        'markdown',
        mergedOptions,
        // Pipe through progress but remap the range
        (progress, phase) => reportProgress(40 + progress * 0.5, phase)
      );
      
      reportProgress(90);
      // Simulate DOCX conversion
      const docxPlaceholder = `DOCX_CONTENT
  ===== DOCX CONVERSION PLACEHOLDER =====
  Report: ${reportData.report.title}
  Generated: ${new Date().toISOString()}
  Options: ${JSON.stringify(mergedOptions)}
  Content Length: ${markdownVersion.length} bytes
  ===================================
  `;
      
      reportProgress(100);
      return docxPlaceholder;
    }
  
    // Support for JSON format
    if (format === 'json') {
      reportProgress(50);
      
      const jsonOutput = {
        title: reportData.report.title,
        id: reportData.report.id,
        timestamp: reportData.report.metadata.generatedAt,
        patient: reportData.patient,
        sections: Object.entries(reportData.report.sections).map(([key, section]) => ({
          id: key,
          title: section.title,
          content: section.content,
          order: section.order
        })),
        sources: reportData.sourceDocuments,
        metadata: {
          ...reportData.report.metadata,
          formatOptions: mergedOptions
        }
      };
      
      reportProgress(100);
      return JSON.stringify(jsonOutput, null, 2);
    }
  
    throw new ApplicationError({
      message: `Unsupported report format: ${format}`,
      code: 'UNSUPPORTED_FORMAT',
      data: {
        requestedFormat: format,
        supportedFormats
      }
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

      // For fallback, just create a standard style using formatter strategy
      const formatter = getFormatterForType('standard')
      const reportContent = formatter.format(
        researchData.text,
        options?.contextData,
        researchData.sources
      )

      updateStatus(ProcessingPhase.COMPLETION, 80, 'Finalizing fallback report')

      // Use the section parser to extract sections
      const sections = SectionParser.extractSections(reportContent)
      
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
            reportType: 'fallback',
          })
        }
      }
      
      // Call success callback if provided
      if (options?.onSuccess) {
        options.onSuccess(fallbackData)
      }

      moduleLogger.info('Fallback report generation completed', {
        generationTime: Date.now() - startTime,
      })

      return fallbackData
    } catch (error: unknown) {
      moduleLogger.error('Fallback report generation failed', {
        error,
      })

      if (options?.onError) {
        options.onError(error instanceof Error ? error.message : 'Unknown error')
      }

      throw new ApplicationError({
        message: 'Failed to generate fallback report',
        cause: error,
      })
    }
  }

  /**
   * Convert markdown content to HTML with formatting options
   *
   * @param markdown Markdown content to convert
   * @param options Formatting options
   * @returns HTML content
   */
  private async convertMarkdownToHtml(
    markdown: string,
    options: {
      includeStyles?: boolean;
      responsiveDesign?: boolean;
      tableOfContents?: boolean;
    } = {}
  ): Promise<string> {
    try {
      // Default options
      const {
        includeStyles = true,
        responsiveDesign = true,
        tableOfContents = false
      } = options;
      
      // Start building HTML
      let html = '<!DOCTYPE html>\n<html>\n<head>\n';
      html += '<meta charset="UTF-8">\n';
      html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
      html += '<title>Medical Report</title>\n';
      
      // Add styles if enabled
      if (includeStyles) {
        html += '<style>\n';
        
        // Base styles
        html += 'body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }\n';
        html += 'h1, h2, h3 { color: #2c3e50; }\n';
        html += 'h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }\n';
        html += 'h2 { border-bottom: 1px solid #eee; padding-bottom: 5px; }\n';
        html += 'pre { background-color: #f8f8f8; padding: 10px; border-radius: 5px; overflow-x: auto; }\n';
        html += 'blockquote { border-left: 4px solid #ccc; padding-left: 15px; color: #777; }\n';
        html += 'table { border-collapse: collapse; width: 100%; }\n';
        html += 'th, td { padding: 8px; border: 1px solid #ddd; }\n';
        html += 'th { background-color: #f2f2f2; }\n';
        html += 'tr:nth-child(even) { background-color: #f9f9f9; }\n';
        
        // Responsive design if enabled
        if (responsiveDesign) {
          html += '@media (min-width: 768px) { body { max-width: 800px; margin: 0 auto; padding: 20px; } }\n';
          html += '@media (max-width: 767px) { body { padding: 15px; } table { display: block; overflow-x: auto; } }\n';
        } else {
          // Fixed layout
          html += 'body { max-width: 800px; margin: 0 auto; padding: 20px; }\n';
        }
        
        // Table of contents styles if enabled
        if (tableOfContents) {
          html += '.toc { background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin-bottom: 20px; }\n';
          html += '.toc ul { padding-left: 20px; }\n';
          html += '.toc a { text-decoration: none; color: #2c3e50; }\n';
          html += '.toc a:hover { text-decoration: underline; }\n';
        }
        
        html += '</style>\n';
      }
      
      html += '</head>\n<body>\n';
      
      // Generate table of contents if enabled
      if (tableOfContents) {
        html += '<div class="toc">\n';
        html += '<h2>Table of Contents</h2>\n';
        html += '<ul>\n';
        
        // Extract headings
        const headings = markdown.match(/^#{1,3} (.+)$/gm) || [];
        headings.forEach((heading, index) => {
          const level = (heading.match(/^#+/) || [''])[0].length;
          const text = heading.replace(/^#+\s+/, '');
          const anchor = `section-${index}`;
          
          const indent = '  '.repeat(level - 1);
          html += `${indent}<li><a href="#${anchor}">${text}</a></li>\n`;
        });
        
        html += '</ul>\n';
        html += '</div>\n';
        
        // Add anchors to headings in content
        let headingIndex = 0;
        markdown = markdown.replace(/^(#{1,3} .+)$/gm, (match) => {
          const anchor = `section-${headingIndex++}`;
          return `<a id="${anchor}"></a>\n${match}`;
        });
      }
      
      // Convert markdown to HTML
      const content = markdown
        .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
        .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
        .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^- (.*?)$/gm, '<li>$1</li>')
        .replace(/^(\d+)\. (.*?)$/gm, '<li>$2</li>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
        .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">')
        .replace(/\n\n/g, '</p><p>');
      
      html += `<p>${content}</p>\n`;
      html += '</body>\n</html>';
      
      return html;
    } catch (error: unknown) {
      moduleLogger.error('Failed to convert markdown to HTML', { error });
      return `<html><body><pre>${markdown}</pre></body></html>`;
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
   * @deprecated Use reportTypeMapper.toDomain() instead
   */
  private mapReportType(typeStr: string): ReportType {
    return reportTypeMapper.toDomain(typeStr);
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