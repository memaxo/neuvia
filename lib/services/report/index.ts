/**
 * @fileoverview Report Services Index
 * 
 * This file exports all report-related services as a cohesive API.
 * Each service is focused on a single area of responsibility.
 */

// Export service instances
export { reportGenerationService } from './report-generation-service'
export { reportFormattingService } from './report-formatting-service'
export { reportStorageService } from './report-storage-service'

// Export service classes
export { 
  ReportGenerationService,
  ReportGenerationError
} from './report-generation-service'

export { 
  ReportFormattingService,
  ReportFormattingError
} from './report-formatting-service'

export { 
  ReportStorageService, 
  ReportStorageError
} from './report-storage-service'

// Export formatters
export { 
  getFormatterForType,
  ReportFormatter,
  MedicalDiagnosisFormatter,
  ResearchFormatter,
  StandardFormatter 
} from './formatters/report-formatter'

// Export parsers
export { SectionParser } from './parsers/section-parser'