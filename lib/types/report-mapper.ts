/**
 * @fileoverview Mapper for converting between domain report entities and database representations.
 */
import { BaseEntityMapper, EnumMapper } from './mapper-base';
import type {
  Report,
  ReportSections,
} from './report';
import { ReportType, ReportStatus } from './report';
import type {
  DbReport,
  DbReportSections,
} from './db-adapters';
import { documentTypeMapper } from './document-mapper';
import { toCamelCase, toSnakeCase } from './db-adapters';

/**
 * Mapper for report entities
 */
export class ReportMapper extends BaseEntityMapper<Report, DbReport> {
  toDomain(dbReport: DbReport): Report {
    return {
      id: dbReport.id,
      title: dbReport.title,
      patientId: dbReport.patient_id,
      createdBy: dbReport.created_by,
      organizationId: dbReport.organization_id,
      reportType: dbReport.report_type as Report['reportType'],
      status: dbReport.status as Report['status'],
      sections: dbReport.sections as ReportSections,
      sourceDocuments: dbReport.source_documents,
      metadata: {
        generatedAt: dbReport.metadata.generated_at,
        modifiedAt: dbReport.metadata.modified_at,
        modifiedBy: dbReport.metadata.modified_by,
        generationTimeMs: dbReport.metadata.generation_time_ms,
        parameters: dbReport.metadata.parameters,
        version: dbReport.metadata.version,
        documentTypes: dbReport.metadata.document_types?.map(type =>
          documentTypeMapper.toDomain(type)
        ),
        ...Object.fromEntries(
          Object.entries(dbReport.metadata)
            .filter(
              ([key]) =>
                ![
                  'generated_at',
                  'modified_at',
                  'modified_by',
                  'generation_time_ms',
                  'parameters',
                  'version',
                  'document_types',
                ].includes(key)
            )
            .map(([key, value]) => [toCamelCase(key), value])
        ),
      },
      createdAt: dbReport.created_at,
      updatedAt: dbReport.updated_at,
    };
  }

  toDatabase(report: Report): DbReport {
    return {
      id: report.id,
      title: report.title,
      patient_id: report.patientId,
      created_by: report.createdBy,
      organization_id: report.organizationId,
      report_type: report.reportType,
      status: report.status,
      sections: report.sections as DbReportSections,
      source_documents: report.sourceDocuments,
      metadata: {
        generated_at: report.metadata.generatedAt,
        modified_at: report.metadata.modifiedAt,
        modified_by: report.metadata.modifiedBy,
        generation_time_ms: report.metadata.generationTimeMs,
        parameters: report.metadata.parameters,
        version: report.metadata.version,
        document_types: report.metadata.documentTypes?.map(type =>
          documentTypeMapper.toDatabase(type)
        ),
        ...Object.fromEntries(
          Object.entries(report.metadata)
            .filter(
              ([key]) =>
                ![
                  'generatedAt',
                  'modifiedAt',
                  'modifiedBy',
                  'generationTimeMs',
                  'parameters',
                  'version',
                  'documentTypes',
                ].includes(key)
            )
            .map(([key, value]) => [toSnakeCase(key), value])
        ),
      },
      created_at: report.createdAt,
      updated_at: report.updatedAt,
    };
  }
}

/**
 * Mapper for report type enum
 */
export class ReportTypeMapper extends EnumMapper<ReportType, string> {
  protected readonly defaultDomainValue = ReportType.SUMMARY;
  protected readonly defaultDbValue = 'summary';

  protected readonly domainToDbMap = new Map<ReportType, string>([
    [ReportType.SUMMARY, 'summary'],
    [ReportType.COMPREHENSIVE, 'comprehensive'],
    [ReportType.TIMELINE, 'timeline'],
    [ReportType.CUSTOM, 'custom'],
  ]);

  protected readonly dbToDomainMap = new Map<string, ReportType>([
    ['summary', ReportType.SUMMARY],
    ['comprehensive', ReportType.COMPREHENSIVE],
    ['timeline', ReportType.TIMELINE],
    ['custom', ReportType.CUSTOM],
    // Add mappings for common custom types
    ['medical-diagnosis', ReportType.CUSTOM],
    ['research', ReportType.CUSTOM],
  ]);
}

/**
 * Mapper for report status enum
 */
export class ReportStatusMapper extends EnumMapper<ReportStatus, string> {
  protected readonly defaultDomainValue = ReportStatus.PENDING;
  protected readonly defaultDbValue = 'pending';

  protected readonly domainToDbMap = new Map<ReportStatus, string>([
    [ReportStatus.PENDING, 'pending'],
    [ReportStatus.GENERATING, 'generating'],
    [ReportStatus.COMPLETED, 'completed'],
    [ReportStatus.FAILED, 'failed'],
    [ReportStatus.REVIEW_REQUIRED, 'review_required'],
    [ReportStatus.APPROVED, 'approved'],
  ]);

  protected readonly dbToDomainMap = new Map<string, ReportStatus>([
    ['pending', ReportStatus.PENDING],
    ['generating', ReportStatus.GENERATING],
    ['completed', ReportStatus.COMPLETED],
    ['failed', ReportStatus.FAILED],
    ['review_required', ReportStatus.REVIEW_REQUIRED],
    ['approved', ReportStatus.APPROVED],
  ]);
}

// Export singleton instances for convenience
export const reportMapper = new ReportMapper();
export const reportTypeMapper = new ReportTypeMapper();
export const reportStatusMapper = new ReportStatusMapper();