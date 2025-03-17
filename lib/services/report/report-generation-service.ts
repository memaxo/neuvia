/**
 * @fileoverview Report Generation Service
 * 
 * Focuses exclusively on report generation logic without workflow orchestration.
 * Responsible for converting document/research data into structured report content.
 */

import { ApplicationError } from '@/lib/errors'
import { DocumentCategory } from '@/lib/types/document'
import logger from '@/lib/logger'
import type { ReportData, ReportSections, ReportDocument } from '@/lib/types/report'
import { ReportType, ReportStatus } from '@/lib/types/report'
import { reportTypeMapper } from '@/lib/types/report-mapper'
import type { ResearchDocument, ResearchResult, ResearchSource } from '@/lib/types/research'
import type { VerifiedDocument } from '@/lib/types/verification'
import type { UUID } from '@/lib/types/base'
import { getFormatterForType } from './formatters/report-formatter'
import { SectionParser } from './parsers/section-parser'

// Custom error type for report generation
export class ReportGenerationError extends ApplicationError {
  constructor(message: string, cause?: unknown) {
    super({
      message,
      code: 'REPORT_GENERATION_ERROR',
      cause
    })
  }
}

// Create module-specific logger
const moduleLogger = logger.withMetadata({ module: 'ReportGenerationService' })

/**
 * Extended report generation parameters
 */
export interface ReportGenerationParams {
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
}

/**
 * Report Generation Service
 * 
 * Responsible for converting input data into structured reports
 * without handling persistence or workflow orchestration.
 */
export class ReportGenerationService {
  /**
   * Generate a report based on a research document or verified document
   */
  async generateFromDocument(
    documentInput: ResearchDocument | VerifiedDocument,
    contextData?: Record<string, unknown>
  ): Promise<ReportData> {
    moduleLogger.info('Generating report from document', {
      documentId: documentInput.id,
      documentType:
        'verifiedData' in documentInput
          ? documentInput.documentType
          : documentInput.documentType,
    })

    const isVerifiedDocument = 'verifiedData' in documentInput

    try {
      // Extract research data from the document
      let researchData: ResearchResult
      let patientId = ''

      if (isVerifiedDocument) {
        // For verified documents, extract the research data
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
          throw new ReportGenerationError('No research results available for report generation')
        }
        researchData = researchDoc.researchResults[0]
        patientId = researchDoc.patientId ?? ''
      }

      // Decide the final report type (string form)
      let docType = 'research'
      if (isVerifiedDocument) {
        docType = 'medical-diagnosis'
      } else if (documentInput.documentType === 'medical') {
        docType = 'medical-diagnosis'
      }

      // Generate the report
      return this.generate({
        type: docType,
        patientId,
        researchData,
        contextData
      })
    } catch (error: unknown) {
      moduleLogger.error('Report generation failed', {
        error,
        documentId: documentInput.id,
        documentType:
          'verifiedData' in documentInput
            ? documentInput.documentType
            : documentInput.documentType,
      })

      throw new ReportGenerationError(
        'Failed to generate report from document',
        error
      )
    }
  }

  /**
   * Generate a report from research data
   */
  async generate(params: ReportGenerationParams): Promise<ReportData> {
    const startTime = Date.now()
    moduleLogger.info('Generating report', {
      type: params.type,
      patientId: params.patientId,
    })

    try {
      // If it's a fallback research data, handle differently
      if (params.researchData.modelName === 'fallback') {
        moduleLogger.info('Using fallback report generation for fallback research data', {
          isFallback: true,
          modelName: params.researchData.modelName,
        })
        return this.generateWithRunnables(
          params.researchData,
          params.patientId,
          params.contextData
        )
      }

      // Use the formatter strategy pattern
      const formatter = getFormatterForType(params.type)
      const reportContent = formatter.format(
        params.researchData.text,
        params.contextData,
        params.researchData.sources
      )

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

      throw new ReportGenerationError(
        'Failed to generate report', 
        error
      )
    }
  }

  /**
   * Generate a medical diagnosis report
   */
  async generateMedicalDiagnosis(
    researchData: ResearchResult,
    patientId: string,
    contextData?: Record<string, unknown>
  ): Promise<ReportData> {
    moduleLogger.info('Generating medical diagnosis report', {
      patientId,
    })

    return this.generate({
      type: 'medical-diagnosis',
      patientId,
      researchData,
      contextData
    })
  }

  /**
   * Generate a report using the runnables approach for fallback content
   */
  private async generateWithRunnables(
    researchData: ResearchResult,
    patientId: string,
    contextData?: Record<string, unknown>
  ): Promise<ReportData> {
    const startTime = Date.now()
    moduleLogger.info('Generating report with runnables', {
      patientId,
    })

    try {
      // For fallback, just create a standard style using formatter strategy
      const formatter = getFormatterForType('standard')
      const reportContent = formatter.format(
        researchData.text,
        contextData,
        researchData.sources
      )

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
            parameters: contextData ?? {},
            modelName: researchData.modelName ?? 'unknown',
            confidence: fallbackConfidence,
            version: '1.0',
          },
        },
        patient: typeof contextData?.patient === 'object' && contextData?.patient !== null
          ? this.ensurePatientObject(contextData.patient, patientId)
          : {
              id: patientId,
              firstName: 'Unknown',
              lastName: 'Patient',
            },
        sourceDocuments: this.mapSourcesToDocuments(researchData.sources),
      }

      moduleLogger.info('Fallback report generation completed', {
        generationTime: Date.now() - startTime,
      })

      return fallbackData
    } catch (error: unknown) {
      moduleLogger.error('Fallback report generation failed', {
        error,
      })

      throw new ReportGenerationError(
        'Failed to generate fallback report',
        error
      )
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

// Create a singleton instance
export const reportGenerationService = new ReportGenerationService()