/**
 * @fileoverview Canonical report types for the application
 * 
 * This file defines the standard report types used throughout the application,
 * including report structures, generation options, and formatting settings.
 */

import type { UUID, Timestamp, BaseEntity } from './base';
import type { DocumentType } from './document';
import type { ProcessingPhase } from './workflow';

// ==========================================================================
// Core Report Types
// ==========================================================================

/**
 * Report type enum
 */
export enum ReportType {
  /**
   * Brief summary report
   */
  SUMMARY = 'summary',
  
  /**
   * Comprehensive detailed report
   */
  COMPREHENSIVE = 'comprehensive',
  
  /**
   * Timeline-based report
   */
  TIMELINE = 'timeline',
  
  /**
   * Custom report format
   */
  CUSTOM = 'custom'
}

/**
 * Report generation status enum
 */
export enum ReportStatus {
  /**
   * Report generation pending
   */
  PENDING = 'pending',
  
  /**
   * Report is being generated
   */
  GENERATING = 'generating',
  
  /**
   * Report generation completed successfully
   */
  COMPLETED = 'completed',
  
  /**
   * Report generation failed
   */
  FAILED = 'failed',
  
  /**
   * Report requires review
   */
  REVIEW_REQUIRED = 'review_required',
  
  /**
   * Report has been reviewed and approved
   */
  APPROVED = 'approved'
}

/**
 * Report format enum
 */
export enum ReportFormat {
  /**
   * HTML format
   */
  HTML = 'html',
  
  /**
   * Plain text format
   */
  TEXT = 'text',
  
  /**
   * PDF format
   */
  PDF = 'pdf',
  
  /**
   * JSON format
   */
  JSON = 'json',
  
  /**
   * Markdown format
   */
  MARKDOWN = 'markdown'
}

/**
 * Report interface with common properties
 */
export interface Report extends BaseEntity {
  /**
   * Report title
   */
  title: string;
  
  /**
   * Patient ID this report is for
   */
  patientId: UUID;
  
  /**
   * User who created the report
   */
  createdBy?: UUID;
  
  /**
   * Organization ID
   */
  organizationId?: UUID;
  
  /**
   * Report type
   */
  reportType: ReportType;
  
  /**
   * Current report status
   */
  status: ReportStatus;
  
  /**
   * Report content organized by sections
   */
  sections: ReportSections;
  
  /**
   * Document IDs used as sources
   */
  sourceDocuments: UUID[];
  
  /**
   * Report metadata
   */
  metadata: ReportMetadata;
}

/**
 * Report sections organized by key
 */
export interface ReportSections {
  /**
   * Each key is a section identifier
   */
  [sectionKey: string]: {
    /**
     * Section title
     */
    title: string;
    
    /**
     * Section content
     */
    content: string;
    
    /**
     * Section order in the report
     */
    order: number;
    
    /**
     * Whether this section can be edited
     */
    editable?: boolean;
    
    /**
     * Whether this section is required
     */
    required?: boolean;
    
    /**
     * Section metadata
     */
    metadata?: Record<string, unknown>;
  };
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  /**
   * Report generation date
   */
  generatedAt: Timestamp;
  
  /**
   * Last modified date
   */
  modifiedAt?: Timestamp;
  
  /**
   * Last modified by
   */
  modifiedBy?: UUID;
  
  /**
   * Report generation time in milliseconds
   */
  generationTimeMs?: number;
  
  /**
   * Custom report parameters
   */
  parameters?: Record<string, unknown>;
  
  /**
   * Report version
   */
  version?: string;
  
  /**
   * Document types included in this report
   */
  documentTypes?: DocumentType[];
  
  /**
   * Custom metadata
   */
  [key: string]: unknown;
}

/**
 * Report generation parameters
 */
export interface ReportGenerationParams {
  /**
   * Patient ID
   */
  patientId: UUID;
  
  /**
   * Document IDs to include
   */
  documentIds?: UUID[];
  
  /**
   * Report type
   */
  reportType: ReportType;
  
  /**
   * Sections to include in custom report
   */
  includeSections?: string[];
  
  /**
   * Custom prompt for report generation
   */
  customPrompt?: string;
  
  /**
   * Additional parameters
   */
  parameters?: Record<string, unknown>;
  
  /**
   * Desired output format
   */
  outputFormat?: ReportFormat;
  
  /**
   * Target language
   */
  language?: string;
}

/**
 * Report generation options
 */
export interface ReportOptions {
  /**
   * Whether to include patient demographics
   */
  includeDemographics?: boolean;
  
  /**
   * Whether to include images/charts
   */
  includeVisualizations?: boolean;
  
  /**
   * Whether to include source citations
   */
  includeCitations?: boolean;
  
  /**
   * Maximum report length (characters)
   */
  maxLength?: number;
  
  /**
   * Formatting options
   */
  formatting?: {
    /**
     * Font size
     */
    fontSize?: string;
    
    /**
     * Font family
     */
    fontFamily?: string;
    
    /**
     * Line spacing
     */
    lineSpacing?: number;
    
    /**
     * Custom CSS for HTML reports
     */
    customCss?: string;
  };
  
  /**
   * Whether to include a table of contents
   */
  includeTableOfContents?: boolean;
  
  /**
   * Whether to include timestamps
   */
  includeTimestamps?: boolean;
  
  /**
   * Callback for progress updates
   */
  onProgress?: (phase: ProcessingPhase, progress: number) => void;
}

/**
 * Report generation progress
 */
export interface ReportGenerationProgress {
  /**
   * Progress percentage (0-100)
   */
  progress: number;
  
  /**
   * Current phase
   */
  phase: ProcessingPhase;
  
  /**
   * Current operation description
   */
  operation: string;
  
  /**
   * Estimated time remaining in milliseconds
   */
  estimatedTimeRemainingMs?: number;
  
  /**
   * Additional progress metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Report document reference
 */
export interface ReportDocument {
  /**
   * Document ID
   */
  id: UUID;
  
  /**
   * Document title
   */
  title: string;
  
  /**
   * Document type
   */
  documentType: DocumentType;
  
  /**
   * Document date
   */
  documentDate?: Timestamp;
  
  /**
   * Citation text
   */
  citation?: string;
  
  /**
   * Relevant page numbers
   */
  pages?: number[];
  
  /**
   * Relevance score (0-1)
   */
  relevanceScore?: number;
}

/**
 * Report audit log entry
 */
export interface ReportAuditLogEntry {
  /**
   * Log entry ID
   */
  id: UUID;
  
  /**
   * Report ID
   */
  reportId: UUID;
  
  /**
   * User ID who made the change
   */
  userId: UUID;
  
  /**
   * Action performed
   */
  action: 'create' | 'update' | 'delete' | 'export' | 'share' | 'view';
  
  /**
   * When the action was performed
   */
  timestamp: Timestamp;
  
  /**
   * Changes made (if applicable)
   */
  changes?: {
    /**
     * Previous state
     */
    before?: Record<string, unknown>;
    
    /**
     * New state
     */
    after?: Record<string, unknown>;
  };
  
  /**
   * Additional context
   */
  context?: Record<string, unknown>;
}

/**
 * Report data for frontend display
 */
export interface ReportData {
  /**
   * Report information
   */
  report: Report;
  
  /**
   * Patient information
   */
  patient?: {
    /**
     * Patient ID
     */
    id: UUID;
    
    /**
     * First name
     */
    firstName: string;
    
    /**
     * Last name
     */
    lastName: string;
    
    /**
     * Date of birth
     */
    dateOfBirth?: string;
    
    /**
     * Medical record number
     */
    mrn?: string;
  };
  
  /**
   * Source documents
   */
  sourceDocuments: ReportDocument[];
  
  /**
   * Formatted content for display
   */
  formattedContent?: {
    /**
     * HTML content
     */
    html?: string;
    
    /**
     * Markdown content
     */
    markdown?: string;
    
    /**
     * Plain text content
     */
    text?: string;
  };
}

/**
 * Create a new report with default values
 */
export function createEmptyReport(
  patientId: UUID,
  reportType: ReportType = ReportType.SUMMARY,
  createdBy?: UUID
): Report {
  const now = new Date().toISOString();
  const id = `report-${Date.now()}`;
  
  return {
    id,
    patientId,
    title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
    reportType,
    status: ReportStatus.PENDING,
    sections: {},
    sourceDocuments: [],
    createdBy,
    createdAt: now,
    updatedAt: now,
    metadata: {
      generatedAt: now,
      version: '1.0'
    }
  };
}