import type { ProcessingPhase, WorkflowStep } from '@/lib/types/workflow';

/**
 * Format an error message with workflow context
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
 * Calculate overall progress based on multi-stage workflow
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
 * Safely sanitize workflow data for logging
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
 * Get phase label for logging and display
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
 * Map a workflow step to a phase (best guess)
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
 * Generate a unique transaction ID
 */
export function generateTransactionId(): string {
  return `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if a value is truly empty (null, undefined, empty string, or empty object/array)
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