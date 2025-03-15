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
    case ProcessingPhase.EXTRACTION:
      return 'Extracting Content';
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
    case ProcessingPhase.RESEARCH:
      return 'Researching';
    case ProcessingPhase.CHAT_PROCESSING:
      return 'Processing Chat';
    case ProcessingPhase.COMPLETION:
      return 'Completing';
    case ProcessingPhase.CORRECTION:
      return 'Processing Correction';
    default:
      return 'Processing';
  }
}

/**
 * Map a workflow step to a default processing phase.
 */
export function getDefaultPhaseForStep(step: WorkflowStep): ProcessingPhase {
  switch (step) {
    case 'uploading':
      return ProcessingPhase.UPLOAD;
    case 'extracting':
      return ProcessingPhase.EXTRACTION;
    case 'verification':
    case 'verification_pending':
      return ProcessingPhase.VERIFICATION_PENDING;
    case 'verification_in_progress':
      return ProcessingPhase.VERIFICATION_PROCESSING;
    case 'verification_completed':
      return ProcessingPhase.VERIFICATION_COMPLETION;
    case 'verification_failed':
      return ProcessingPhase.VERIFICATION_REJECTION;
    case 'report_generation':
      return ProcessingPhase.REPORT_GENERATION;
    case 'chat_started':
    case 'chat_in_progress':
      return ProcessingPhase.CHAT_PROCESSING;
    case 'complete':
      return ProcessingPhase.COMPLETION;
    case 'error':
    case 'chat_error':
      return ProcessingPhase.PROCESSING;
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
    ['idle', 'idle'],
    ['uploading', 'uploading'],
    ['extracting', 'extracting'],
    ['verification', 'verification'],
    ['report_generation', 'report_generation'],
    ['complete', 'complete'],
    ['verification_pending', 'verification_pending'],
    ['verification_in_progress', 'verification_in_progress'],
    ['verification_completed', 'verification_completed'],
    ['verification_failed', 'verification_failed'],
    ['chat_started', 'chat_started'],
    ['chat_in_progress', 'chat_in_progress'],
    ['chat_completed', 'chat_completed'],
    ['chat_error', 'chat_error'],
    [DomainOnlyWorkflowStep.ERROR, 'chat_error'],
    [DomainOnlyWorkflowStep.RESEARCH, 'chat_in_progress'],
    [DomainOnlyWorkflowStep.REPORT_PRESENTATION, 'report_generation']
  ]);

  // Domain-specific error step mappings
  private static readonly domainErrorMap = new Map<string, WorkflowStep>([
    ['chat', 'chat_error'],
    ['verification', 'verification_failed'],
    ['document', DomainOnlyWorkflowStep.ERROR],
    ['report', DomainOnlyWorkflowStep.ERROR],
    ['research', DomainOnlyWorkflowStep.ERROR]
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
    return this.dbToDomainMap.get(dbStep) || 'idle';
  }

  /**
   * Get the appropriate domain-specific error step.
   */
  static getDomainErrorStep(domain: string): WorkflowStep {
    const normalizedDomain = domain.toLowerCase();
    return this.domainErrorMap.get(normalizedDomain) || DomainOnlyWorkflowStep.ERROR;
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
        return step === 'uploading' || step === 'extracting';
      case 'report':
        return step === 'report_generation' || step === DomainOnlyWorkflowStep.REPORT_PRESENTATION;
      case 'research':
        return step === DomainOnlyWorkflowStep.RESEARCH;
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
    if (step === 'uploading' || step === 'extracting') return 'document';
    if (step === 'report_generation' || step === DomainOnlyWorkflowStep.REPORT_PRESENTATION) return 'report';
    if (step === DomainOnlyWorkflowStep.RESEARCH) return 'research';
    if (step === DomainOnlyWorkflowStep.ERROR) return null;
    if (step === 'idle' || step === 'complete') return null;
    return null;
  }
}