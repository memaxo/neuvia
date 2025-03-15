/**
 * Export all workflow hooks
 *
 * This file exports all workflow hooks with a simplified interface.
 *
 * Hook Design Principles:
 * - These hooks provide a simplified and reactive interface to interact with workflow services.
 * - They manage local state and subscribe to realtime changes from the persistent workflow layer.
 * - Hooks abstract the complexity of state synchronization between the database and the UI.
 * - Domain-specific logic is encapsulated within service classes, while hooks handle UI state and effects.
 * - Use these hooks to integrate workflow state into your components, ensuring consistency with the underlying service classes.
 */

// Export domain-specific hooks
export { useDocumentWorkflow } from './useDocumentWorkflow'
export { useVerificationWorkflow } from './useVerificationWorkflow'
export { useReportWorkflow } from './useReportWorkflow'

// Export the base workflow hook
export { useBaseWorkflow } from './useBaseWorkflow'

// Export types
export type { UseBaseWorkflowOptions } from './useBaseWorkflow'
export type {
  UseDocumentWorkflowOptions,
  ProcessDocumentOptions,
  DocumentWorkflowResult
} from './useDocumentWorkflow'
export type {
  UseVerificationWorkflowOptions,
  VerificationResult
} from './useVerificationWorkflow'
export type {
  UseReportWorkflowOptions,
  ReportGenerationOptions,
  ReportResult
} from './useReportWorkflow'