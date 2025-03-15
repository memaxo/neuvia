/**
 * Export all workflow hooks
 *
 * This file exports all workflow hooks with a consistent interface.
 * Under the hood, all specific workflow hooks now use the generic workflow implementation.
 */

// Export domain-specific hooks
export { useDocumentWorkflow } from './useDocumentWorkflow'
export { useVerificationWorkflow } from './useVerificationWorkflow'
export { useReportWorkflow } from './useReportWorkflow'

// Export the generic workflow hook for custom implementations
export { useGenericWorkflow } from './useGenericWorkflow'
export type { DomainActions, ProcessOptions, UseGenericWorkflowOptions } from './useGenericWorkflow'

// Export domain-specific action configurations
export { documentActions } from './documentActions'
export { verificationActions } from './verificationActions'
export { reportActions } from './reportActions'

// Export types
export type { DocumentInput, DocumentWorkflowResult, DocumentState } from './documentActions'
export type { VerificationInput, VerificationResult, VerificationState } from './verificationActions'
export type { ReportInput, ReportResult, ReportState } from './reportActions'