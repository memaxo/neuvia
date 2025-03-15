import type { ProcessingPhase, WorkflowStep, DomainOnlyWorkflowStep } from '@/lib/types/workflow';
import type { Database } from '@/lib/types/database';

/**
 * Consolidated Workflow Utilities
 * This file includes common helper functions and the WorkflowStepMapper class.
 */

/**
 * Format an error message with workflow context.
 */
export function formatWorkflowError(
  message: string,
  details: Record<string, unknown> = {}
): string {
  const context = Object.entries(details)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
  
  return context ? `${message} (${context})` : message;
}

/**
 * Calculate overall progress based on multi-stage workflow.
 */
export function calculateOverallProgress(
  stages: { weight: number; progress: number }[]
): number {
  const totalWeight = stages.reduce((sum, stage) => sum + stage.weight, 0);
  const weightedProgress = stages.reduce(
    (sum, stage) => sum + (stage.progress * stage.weight) / 100,
    0
  );
  
  return Math.floor((weightedProgress / totalWeight) * 100);
}

/**
 * Safely sanitize workflow data for logging.
 */
export function sanitizeForLogging(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (data instanceof File) {
    return `File: ${data.name} (${data.size} bytes)`;
  }
  
  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map(item => sanitizeForLogging(item));
    }
    
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      // Skip sensitive keys
      if (key.toLowerCase().includes('password') || key.toLowerCase().includes('token')) {
        result[key] = '[REDACTED]';
      }
      // Truncate large strings
      else if (typeof value === 'string' && value.length > 100) {
        result[key] = `${value.substring(0, 100)}... (truncated)`;
      }
      // Recursively sanitize objects
      else if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeForLogging(value);
      }
      // Keep other values as is
      else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  return data;
}

/**
 * Get a human-readable label for a processing phase.
 */
export function getPhaseLabel(phase: ProcessingPhase): string {
  switch (phase) {
    case ProcessingPhase.UPLOAD:
      return 'Uploading';
    case ProcessingPhase.UPLOADING:
      return 'Uploading';
    case ProcessingPhase.EXTRACTION:
      return 'Extracting Content';
    case ProcessingPhase.EXTRACTION_COMPLETED:
      return 'Extraction Complete';
    case ProcessingPhase.VERIFICATION:
      return 'Verifying';
    case ProcessingPhase.VERIFICATION_PENDING:
      return 'Waiting for Verification';
    case ProcessingPhase.VERIFICATION_PROCESSING:
      return 'Processing Verification';
    case ProcessingPhase.VERIFICATION_COMPLETION:
      return 'Completing Verification';
    case ProcessingPhase.VERIFICATION_REJECTION:
      return 'Rejecting Verification';
    case ProcessingPhase.INITIALIZATION:
      return 'Initializing';
    case ProcessingPhase.PROCESSING:
      return 'Processing';
    case ProcessingPhase.FINALIZATION:
      return 'Finalizing';
    case ProcessingPhase.REPORT_GENERATION:
      return 'Generating Report';
    case ProcessingPhase.REPORT_FORMATTING:
      return 'Formatting Report';
    case ProcessingPhase.REPORT_PREVIEW:
      return 'Previewing Report';
    case ProcessingPhase.RESEARCH:
      return 'Researching';
    case ProcessingPhase.CHAT_PROCESSING:
      return 'Processing Chat';
    case ProcessingPhase.COMPLETION:
      return 'Completing';
    case ProcessingPhase.CORRECTION:
      return 'Processing Correction';
    case ProcessingPhase.ANALYSIS:
      return 'Analyzing';
    case ProcessingPhase.ERROR:
      return 'Error';
    default:
      return 'Processing';
  }
}

/**
 * Map a workflow step to a default processing phase.
 */
export function getDefaultPhaseForStep(step: WorkflowStep): ProcessingPhase {
  switch (step) {
    case WorkflowSteps.UPLOADING:
      return ProcessingPhase.UPLOADING;
    case WorkflowSteps.EXTRACTING:
      return ProcessingPhase.EXTRACTION;
    case WorkflowSteps.VERIFICATION:
    case WorkflowSteps.VERIFICATION_PENDING:
      return ProcessingPhase.VERIFICATION_PENDING;
    case WorkflowSteps.VERIFICATION_IN_PROGRESS:
      return ProcessingPhase.VERIFICATION_PROCESSING;
    case WorkflowSteps.VERIFICATION_COMPLETED:
      return ProcessingPhase.VERIFICATION_COMPLETION;
    case WorkflowSteps.VERIFICATION_FAILED:
      return ProcessingPhase.VERIFICATION_REJECTION;
    case WorkflowSteps.REPORT_GENERATION:
      return ProcessingPhase.REPORT_GENERATION;
    case WorkflowSteps.CHAT_STARTED:
    case WorkflowSteps.CHAT_IN_PROGRESS:
      return ProcessingPhase.CHAT_PROCESSING;
    case WorkflowSteps.COMPLETE:
      return ProcessingPhase.COMPLETION;
    case WorkflowSteps.ERROR:
    case WorkflowSteps.CHAT_ERROR:
      return ProcessingPhase.ERROR;
    case WorkflowSteps.DOCUMENT_ANALYSIS:
      return ProcessingPhase.ANALYSIS;
    case WorkflowSteps.REPORT_PRESENTATION:
      return ProcessingPhase.REPORT_PREVIEW;
    case WorkflowSteps.RESEARCH:
      return ProcessingPhase.RESEARCH;
    default:
      return ProcessingPhase.PROCESSING;
  }
}

/**
 * Generate a unique transaction ID.
 */
export function generateTransactionId(): string {
  return `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if a value is truly empty (null, undefined, empty string, or empty object/array).
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  
  if (typeof value === 'object') {
    return Object.keys(value as object).length === 0;
  }
  
  return false;
}

/**
 * WorkflowStepMapper provides mappings between domain workflow steps and database workflow steps.
 */
export class WorkflowStepMapper {
  // Map from domain steps to DB steps
  private static readonly domainToDbMap = new Map<WorkflowStep, Database['public']['Enums']['workflow_step']>([
    // Core workflow steps (DB-backed)
    [WorkflowSteps.IDLE, 'idle'],
    [WorkflowSteps.UPLOADING, 'uploading'],
    [WorkflowSteps.EXTRACTING, 'extracting'],
    [WorkflowSteps.VERIFICATION, 'verification'],
    [WorkflowSteps.REPORT_GENERATION, 'report_generation'],
    [WorkflowSteps.COMPLETE, 'complete'],
    
    // Verification-specific steps (DB-backed)
    [WorkflowSteps.VERIFICATION_PENDING, 'verification_pending'],
    [WorkflowSteps.VERIFICATION_IN_PROGRESS, 'verification_in_progress'],
    [WorkflowSteps.VERIFICATION_COMPLETED, 'verification_completed'],
    [WorkflowSteps.VERIFICATION_FAILED, 'verification_failed'],
    
    // Chat-specific steps (DB-backed)
    [WorkflowSteps.CHAT_STARTED, 'chat_started'],
    [WorkflowSteps.CHAT_IN_PROGRESS, 'chat_in_progress'],
    [WorkflowSteps.CHAT_COMPLETED, 'chat_completed'],
    [WorkflowSteps.CHAT_ERROR, 'chat_error'],
    
    // Domain-only steps (mapped to appropriate DB steps)
    [WorkflowSteps.ERROR, 'chat_error'],
    [WorkflowSteps.RESEARCH, 'chat_in_progress'],
    [WorkflowSteps.REPORT_PRESENTATION, 'report_generation'],
    [WorkflowSteps.DOCUMENT_ANALYSIS, 'document_analysis'],
    [WorkflowSteps.DOCUMENT_FORMATTING, 'document_formatting'],
    [WorkflowSteps.DOCUMENT_INDEXING, 'document_indexing'],
    [WorkflowSteps.DOCUMENT_PREVIEW, 'document_preview'],
    [WorkflowSteps.VERIFICATION_CORRECTION, 'verification_correction'],
    [WorkflowSteps.VERIFICATION_REVIEW, 'verification_review'],
    [WorkflowSteps.RECOVERABLE_ERROR, 'recoverable_error'],
    [WorkflowSteps.PERMANENT_ERROR, 'permanent_error']
  ]);

  // Domain-specific error step mappings
  private static readonly domainErrorMap = new Map<string, WorkflowStep>([
    ['chat', WorkflowSteps.CHAT_ERROR],
    ['verification', WorkflowSteps.VERIFICATION_FAILED],
    ['document', WorkflowSteps.ERROR],
    ['report', WorkflowSteps.ERROR],
    ['research', WorkflowSteps.ERROR]
  ]);

  // Map from DB steps to domain steps (inverse mapping)
  private static readonly dbToDomainMap = new Map<Database['public']['Enums']['workflow_step'], WorkflowStep>(
    Array.from(WorkflowStepMapper.domainToDbMap.entries()).map(([k, v]) => [v, k])
  );

  /**
   * Convert domain workflow step to DB step.
   */
  static toDatabaseStep(step: WorkflowStep): Database['public']['Enums']['workflow_step'] {
    return this.domainToDbMap.get(step) || 'idle';
  }

  /**
   * Convert DB step to domain workflow step.
   */
  static toDomainStep(dbStep: Database['public']['Enums']['workflow_step']): WorkflowStep {
    return this.dbToDomainMap.get(dbStep) || WorkflowSteps.IDLE;
  }

  /**
   * Get the appropriate domain-specific error step.
   */
  static getDomainErrorStep(domain: string): WorkflowStep {
    const normalizedDomain = domain.toLowerCase();
    return this.domainErrorMap.get(normalizedDomain) || WorkflowSteps.ERROR;
  }

  /**
   * Determine if a step belongs to a specific domain.
   */
  static isStepInDomain(step: WorkflowStep, domain: string): boolean {
    const normalizedDomain = domain.toLowerCase();
    switch (normalizedDomain) {
      case 'chat':
        return step.startsWith('chat_');
      case 'verification':
        return step.startsWith('verification_');
      case 'document':
        return step === WorkflowSteps.UPLOADING || step === WorkflowSteps.EXTRACTING;
      case 'report':
        return step === WorkflowSteps.REPORT_GENERATION || step === WorkflowSteps.REPORT_PRESENTATION;
      case 'research':
        return step === WorkflowSteps.RESEARCH;
      default:
        return false;
    }
  }

  /**
   * Get the domain name from a workflow step.
   */
  static getDomainFromStep(step: WorkflowStep): string | null {
    if (step.startsWith('chat_')) return 'chat';
    if (step.startsWith('verification_')) return 'verification';
    if (step === WorkflowSteps.UPLOADING || step === WorkflowSteps.EXTRACTING) return 'document';
    if (step === WorkflowSteps.REPORT_GENERATION || step === WorkflowSteps.REPORT_PRESENTATION) return 'report';
    if (step === WorkflowSteps.RESEARCH) return 'research';
    if (step === WorkflowSteps.ERROR) return null;
    if (step === WorkflowSteps.IDLE || step === WorkflowSteps.COMPLETE) return null;
    return null;
  }
}