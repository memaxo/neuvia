import type { WorkflowStep, DomainOnlyWorkflowStep } from '@/lib/types/workflow';
import { DomainOnlyWorkflowStep as DomainSteps } from '@/lib/types/workflow';
import type { Database } from '@/lib/types/database';

/**
 * Maps between domain workflow steps and database workflow steps
 * This is the canonical source for all step mappings in the application
 */
export class WorkflowStepMapper {
  // Map from domain steps to DB steps
  private static readonly domainToDbMap = new Map<WorkflowStep, Database['public']['Enums']['workflow_step']>([
    // Basic workflow steps
    ['idle', 'idle'],
    ['uploading', 'uploading'],
    ['extracting', 'extracting'],
    ['verification', 'verification'],
    ['report_generation', 'report_generation'],
    ['complete', 'complete'],
    
    // Verification domain steps
    ['verification_pending', 'verification_pending'],
    ['verification_in_progress', 'verification_in_progress'],
    ['verification_completed', 'verification_completed'],
    ['verification_failed', 'verification_failed'],
    
    // Chat domain steps
    ['chat_started', 'chat_started'],
    ['chat_in_progress', 'chat_in_progress'],
    ['chat_completed', 'chat_completed'],
    ['chat_error', 'chat_error'],
    
    // Domain-only mappings with specific fallbacks
    [DomainSteps.ERROR, 'chat_error'],  // Generic errors map to chat_error in DB
    [DomainSteps.RESEARCH, 'chat_in_progress'],  // Research maps to chat_in_progress in DB
    [DomainSteps.REPORT_PRESENTATION, 'report_generation']  // Report presentation maps to report_generation in DB
  ]);
  
  // Domain-specific error step mappings
  private static readonly domainErrorMap = new Map<string, WorkflowStep>([
    ['chat', 'chat_error'],
    ['verification', 'verification_failed'],
    ['document', DomainSteps.ERROR],
    ['report', DomainSteps.ERROR],
    ['research', DomainSteps.ERROR]
  ]);
  
  // Map from DB steps to domain steps (inverse mapping)
  private static readonly dbToDomainMap = new Map<Database['public']['Enums']['workflow_step'], WorkflowStep>(
    Array.from(WorkflowStepMapper.domainToDbMap.entries()).map(([k, v]) => [v, k])
  );
  
  /**
   * Convert domain workflow step to DB step
   * This is the SINGLE source of truth for mapping domain steps to DB steps
   */
  static toDatabaseStep(step: WorkflowStep): Database['public']['Enums']['workflow_step'] {
    // Use the map to get the DB step, or fallback to 'idle'
    return this.domainToDbMap.get(step) || 'idle';
  }
  
  /**
   * Convert DB step to domain workflow step
   * This is the SINGLE source of truth for mapping DB steps to domain steps
   */
  static toDomainStep(dbStep: Database['public']['Enums']['workflow_step']): WorkflowStep {
    // Use the map to get the domain step, or fallback to 'idle'
    return this.dbToDomainMap.get(dbStep) || 'idle';
  }
  
  /**
   * Get domain-specific error step
   * Provides the appropriate error step based on the domain
   */
  static getDomainErrorStep(domain: string): WorkflowStep {
    // Convert domain to lowercase for case-insensitive matching
    const normalizedDomain = domain.toLowerCase();
    
    // Look up domain in error map, return generic error if not found
    return this.domainErrorMap.get(normalizedDomain) || DomainSteps.ERROR;
  }
  
  /**
   * Determine if a step belongs to a specific domain
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
        return step === 'report_generation' || step === DomainSteps.REPORT_PRESENTATION;
      case 'research':
        return step === DomainSteps.RESEARCH;
      default:
        return false;
    }
  }
  
  /**
   * Get the domain name from a workflow step
   */
  static getDomainFromStep(step: WorkflowStep): string | null {
    if (step.startsWith('chat_')) return 'chat';
    if (step.startsWith('verification_')) return 'verification';
    if (step === 'uploading' || step === 'extracting') return 'document';
    if (step === 'report_generation' || step === DomainSteps.REPORT_PRESENTATION) return 'report';
    if (step === DomainSteps.RESEARCH) return 'research';
    
    // Special cases
    if (step === DomainSteps.ERROR) return null; // Generic error has no specific domain
    if (step === 'idle' || step === 'complete') return null; // Common states with no specific domain
    
    return null;
  }
}