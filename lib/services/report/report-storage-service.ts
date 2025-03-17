/**
 * @fileoverview Report Storage Service
 * 
 * Focuses exclusively on report persistence without workflow orchestration.
 * Responsible for saving, retrieving, and managing report data in the database.
 */

import { createBrowserClient } from '@/lib/supabase/clients'
import { ApplicationError } from '@/lib/errors'
import logger from '@/lib/logger'
import type { ReportData } from '@/lib/types/report'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

// Custom error type for report storage operations
export class ReportStorageError extends ApplicationError {
  constructor(message: string, cause?: unknown) {
    super({
      message,
      code: 'REPORT_STORAGE_ERROR',
      cause
    })
  }
}

// Create module-specific logger
const moduleLogger = logger.withMetadata({ module: 'ReportStorageService' })

/**
 * Report Storage Service
 * 
 * Responsible for database operations related to reports
 * Handles saving, retrieving, and updating reports.
 */
export class ReportStorageService {
  private readonly supabase: SupabaseClient<Database>

  constructor(supabaseClient?: SupabaseClient<Database>) {
    this.supabase = supabaseClient || createBrowserClient()
  }

  /**
   * Save a report to the database
   * 
   * @param reportData Report data to save
   * @returns Report ID
   */
  async saveReport(reportData: ReportData): Promise<string> {
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
        throw new ReportStorageError('Failed to save report to database', error)
      }
      return reportData.report.id
    } catch (error: unknown) {
      moduleLogger.error('Failed to save report to database', {
        error,
        reportId: reportData.report.id,
      })
      throw new ReportStorageError('Failed to save report to database', error)
    }
  }

  /**
   * Retrieve a report from the database
   * 
   * @param reportId Report ID to retrieve
   * @returns Report data
   */
  async getReport(reportId: string): Promise<ReportData> {
    try {
      moduleLogger.info('Retrieving report from database', {
        reportId,
      })

      const { data, error } = await this.supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single()

      if (error) {
        throw new ReportStorageError('Failed to retrieve report from database', error)
      }

      if (!data) {
        throw new ReportStorageError(`Report with ID ${reportId} not found`)
      }

      // Process the retrieved report into the ReportData structure
      // This is a placeholder implementation - would need proper mapping
      // based on the actual database schema and application types
      const contentObj = JSON.parse(data.content as string)
      
      // Construct a minimal ReportData structure from the database record
      const reportData: ReportData = {
        report: {
          id: data.id,
          title: data.title,
          patientId: data.patient_id,
          reportType: data.type,
          status: data.status,
          sections: contentObj.sections || {},
          sourceDocuments: contentObj.sourceDocuments || [],
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          metadata: data.metadata || {},
        },
        sourceDocuments: [],
        patient: {
          id: data.patient_id,
          firstName: 'Unknown',
          lastName: 'Patient',
        },
      }

      return reportData
    } catch (error: unknown) {
      moduleLogger.error('Failed to retrieve report from database', {
        error,
        reportId,
      })
      throw new ReportStorageError(`Failed to retrieve report with ID ${reportId}`, error)
    }
  }

  /**
   * Update an existing report in the database
   * 
   * @param reportId Report ID to update
   * @param updateData Report data to update
   * @returns Updated report ID
   */
  async updateReport(reportId: string, updateData: Partial<ReportData>): Promise<string> {
    try {
      moduleLogger.info('Updating report in database', {
        reportId,
      })

      // Get the current report data
      const currentReport = await this.getReport(reportId)

      // Merge the update data with current data
      const mergedReport: ReportData = {
        ...currentReport,
        report: {
          ...currentReport.report,
          ...updateData.report,
          updatedAt: new Date().toISOString(),
        },
        ...(updateData.sourceDocuments && { sourceDocuments: updateData.sourceDocuments }),
        ...(updateData.patient && { patient: updateData.patient }),
      }

      // Save the updated report
      return this.saveReport(mergedReport)
    } catch (error: unknown) {
      moduleLogger.error('Failed to update report in database', {
        error,
        reportId,
      })
      throw new ReportStorageError(`Failed to update report with ID ${reportId}`, error)
    }
  }

  /**
   * Delete a report from the database
   * 
   * @param reportId Report ID to delete
   * @returns Success indicator
   */
  async deleteReport(reportId: string): Promise<boolean> {
    try {
      moduleLogger.info('Deleting report from database', {
        reportId,
      })

      const { error } = await this.supabase
        .from('reports')
        .delete()
        .eq('id', reportId)

      if (error) {
        throw new ReportStorageError('Failed to delete report from database', error)
      }

      return true
    } catch (error: unknown) {
      moduleLogger.error('Failed to delete report from database', {
        error,
        reportId,
      })
      throw new ReportStorageError(`Failed to delete report with ID ${reportId}`, error)
    }
  }

  /**
   * Get a list of reports for a patient
   * 
   * @param patientId Patient ID to retrieve reports for
   * @param limit Maximum number of reports to retrieve
   * @returns Array of report summaries
   */
  async getPatientReports(patientId: string, limit: number = 10): Promise<{
    id: string;
    title: string;
    createdAt: string;
    status: string;
    reportType: string;
  }[]> {
    try {
      moduleLogger.info('Retrieving patient reports from database', {
        patientId,
        limit,
      })

      const { data, error } = await this.supabase
        .from('reports')
        .select('id, title, created_at, status, type')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw new ReportStorageError('Failed to retrieve patient reports from database', error)
      }

      return (data || []).map(report => ({
        id: report.id,
        title: report.title,
        createdAt: report.created_at,
        status: report.status,
        reportType: report.type,
      }))
    } catch (error: unknown) {
      moduleLogger.error('Failed to retrieve patient reports from database', {
        error,
        patientId,
      })
      throw new ReportStorageError(`Failed to retrieve reports for patient with ID ${patientId}`, error)
    }
  }
}

// Create a singleton instance
export const reportStorageService = new ReportStorageService()