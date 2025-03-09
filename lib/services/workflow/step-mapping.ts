import type { WorkflowStep, DomainOnlyWorkflowStep } from '@/lib/types/workflow';
import type { Database } from '@/lib/types/database';

/**
 * Maps between domain workflow steps and database workflow steps
 */
export class WorkflowStepMapper {
  // Map from domain steps to DB steps
  private static readonly domainToDbMap = new Map<WorkflowStep, Database['public']['Enums']['workflow_step']>([
    ['idle', 'idle'],
    ['uploading', 'uploading'],
    ['extracting', 'extracting'],
    ['verification', 'verification'],
    ['verification_pending', 'verification_pending'],
    ['verification_in_progress', 'verification_in_progress'],
    ['verification_completed', 'verification_completed'],
    ['verification_failed', 'verification_failed'],
    ['report_generation', 'report_generation'],
    ['complete', 'complete'],
    ['chat_started', 'chat_started'],
    ['chat_in_progress', 'chat_in_progress'],
    ['chat_completed', 'chat_completed'],
    ['chat_error', 'chat_error'],
    // Domain-only mappings
    [DomainOnlyWorkflowStep.ERROR, 'chat_error'],
    [DomainOnlyWorkflowStep.RESEARCH, 'chat_in_progress'],
    [DomainOnlyWorkflowStep.REPORT_PRESENTATION, 'report_generation']
  ]);
  
  // Map from DB steps to domain steps (inverse mapping)
  private static readonly dbToDomainMap = new Map<Database['public']['Enums']['workflow_step'], WorkflowStep>(
    Array.from(WorkflowStepMapper.domainToDbMap.entries()).map(([k, v]) => [v, k])
  );
  
  /**
   * Convert domain workflow step to DB step
   */
  static toDatabaseStep(step: WorkflowStep): Database['public']['Enums']['workflow_step'] {
    return this.domainToDbMap.get(step) || 'idle';
  }
  
  /**
   * Convert DB step to domain workflow step
   */
  static toDomainStep(dbStep: Database['public']['Enums']['workflow_step']): WorkflowStep {
    return this.dbToDomainMap.get(dbStep) || 'idle';
  }
}