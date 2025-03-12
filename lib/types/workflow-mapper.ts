/**
 * @fileoverview Mapper for converting between domain workflow entities and database representations.
 */
import { BaseEntityMapper } from './mapper-base';
import type { WorkflowState, ProcessingPhase } from './workflow';
import type { DbWorkflowState } from './db-adapters';
import { WorkflowStepMapper } from '../services/workflow/utils/step-mapper';
import type { Database } from './database';

/**
 * Mapper for workflow state entities
 */
export class WorkflowStateMapper extends BaseEntityMapper<WorkflowState, DbWorkflowState> {
  /**
   * Convert a database workflow state to a domain workflow state
   */
  toDomain(dbState: DbWorkflowState): WorkflowState {
    return {
      currentStep: WorkflowStepMapper.toDomainStep(dbState.step as Database['public']['Enums']['workflow_step']),
      progress: dbState.progress,
      phase: dbState.phase as ProcessingPhase | undefined,
      error: dbState.error,
      metadata: dbState.metadata,
      timestamp: dbState.timestamp,
    };
  }

  /**
   * Convert a domain workflow state to a database workflow state
   */
  toDatabase(state: WorkflowState): DbWorkflowState {
    return {
      id: '', // This should be provided when creating or fetching from database
      step: WorkflowStepMapper.toDatabaseStep(state.currentStep),
      progress: state.progress,
      phase: state.phase as string | undefined,
      error: state.error,
      metadata: state.metadata,
      timestamp: state.timestamp,
    };
  }
}

// Export a singleton instance
export const workflowStateMapper = new WorkflowStateMapper(); 