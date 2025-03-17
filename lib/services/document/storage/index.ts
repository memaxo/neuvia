/**
 * Document Storage Service Exports
 * 
 * Public API for document storage services
 */

// Export services
export { DocumentDatabaseService } from './document-database-service'
export { DocumentMetadataService } from './document-metadata-service'
export { DocumentFormatterService } from './document-formatter-service'
export { DocumentStatusService } from './document-status-service'

// Export errors
export * from './errors'

// Export types
export * from './types'

// Create and export default service instances
import { DocumentDatabaseService } from './document-database-service'
import { DocumentMetadataService } from './document-metadata-service'
import { DocumentFormatterService } from './document-formatter-service'
import { DocumentStatusService } from './document-status-service'

// Create shared instances for easy use
const databaseService = new DocumentDatabaseService()
const metadataService = new DocumentMetadataService()
const formatterService = new DocumentFormatterService()
const statusService = new DocumentStatusService(databaseService)

export default {
  databaseService,
  metadataService,
  formatterService,
  statusService
}