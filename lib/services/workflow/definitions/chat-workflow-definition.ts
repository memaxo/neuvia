/**
 * @fileoverview Chat workflow definition and transition rules.
 *
 * This file centralizes chat-specific workflow states and transitions,
 * ensuring consistency between database and domain models using the
 * WorkflowStepMapper utility.
 */

import {
  WorkflowStep,
  DomainOnlyWorkflowStep,
  WorkflowTransition,
  ProcessingPhase
} from '@/lib/types/workflow';
import { WorkflowStepMapper } from '../utils/workflow-utils';

// ==========================================================================
// Chat Workflow Step Constants
// ==========================================================================

/**
 * Chat workflow steps from the DB schema.
 * Using the canonical naming constants to ensure consistency across the application.
 */
export const CHAT_STEP_STARTED: WorkflowStep = 'chat_started';
export const CHAT_STEP_IN_PROGRESS: WorkflowStep = 'chat_in_progress';
export const CHAT_STEP_COMPLETED: WorkflowStep = 'chat_completed';
export const CHAT_STEP_ERROR: WorkflowStep = 'chat_error';

/**
 * Domain-specific chat workflow steps that extend the base steps.
 * These don't exist in the database directly but map to DB steps
 * using the WorkflowStepMapper.
 */
export const CHAT_STEP_THINKING: WorkflowStep = DomainOnlyWorkflowStep.RESEARCH;
export const CHAT_STEP_PROCESSING: WorkflowStep = 'chat_in_progress';
export const CHAT_STEP_ANALYZING: WorkflowStep = DomainOnlyWorkflowStep.RESEARCH_ANALYSIS;
export const CHAT_STEP_QUERYING: WorkflowStep = DomainOnlyWorkflowStep.RESEARCH_QUERY;
export const CHAT_STEP_SUMMARIZING: WorkflowStep = DomainOnlyWorkflowStep.RESEARCH_SUMMARIZATION;

// ==========================================================================
// Chat Workflow Transition Definitions
// ==========================================================================

/**
 * Allowed transitions between chat workflow steps.
 * These mirror the transitions defined in the main ALLOWED_TRANSITIONS array,
 * but are specialized for chat workflows.
 */
export const CHAT_WORKFLOW_TRANSITIONS: WorkflowTransition[] = [
  // Initial state transitions
  {
    from: 'idle',
    to: CHAT_STEP_STARTED,
    allowData: true,
    description: 'Start chat without document',
  },
  
  // Chat flow - basic progression
  {
    from: CHAT_STEP_STARTED,
    to: CHAT_STEP_IN_PROGRESS,
    allowData: true,
    description: 'Processing chat message',
  },
  {
    from: CHAT_STEP_IN_PROGRESS,
    to: CHAT_STEP_COMPLETED,
    allowData: true,
    description: 'Chat message processed',
  },
  {
    from: CHAT_STEP_COMPLETED,
    to: CHAT_STEP_IN_PROGRESS,
    allowData: true,
    description: 'Processing another message',
  },
  
  // Advanced chat processing with research/analysis steps
  {
    from: CHAT_STEP_IN_PROGRESS,
    to: CHAT_STEP_THINKING,
    allowData: true,
    description: 'Doing extended research for chat response',
  },
  {
    from: CHAT_STEP_THINKING,
    to: CHAT_STEP_ANALYZING,
    allowData: true,
    description: 'Analyzing research results',
  },
  {
    from: CHAT_STEP_ANALYZING,
    to: CHAT_STEP_SUMMARIZING,
    allowData: true,
    description: 'Summarizing findings for response',
  },
  {
    from: CHAT_STEP_ANALYZING,
    to: CHAT_STEP_QUERYING,
    allowData: true,
    description: 'Querying additional data sources',
  },
  {
    from: CHAT_STEP_QUERYING,
    to: CHAT_STEP_SUMMARIZING,
    allowData: true,
    description: 'Summarizing query results',
  },
  {
    from: CHAT_STEP_SUMMARIZING,
    to: CHAT_STEP_COMPLETED,
    allowData: true,
    description: 'Completed research and summarization',
  },
  {
    from: CHAT_STEP_THINKING,
    to: CHAT_STEP_COMPLETED,
    allowData: true,
    description: 'Completed research directly',
  },
  
  // Transition to and from error state
  {
    from: CHAT_STEP_STARTED,
    to: CHAT_STEP_ERROR,
    requireData: true,
    description: 'Error starting chat',
  },
  {
    from: CHAT_STEP_IN_PROGRESS,
    to: CHAT_STEP_ERROR,
    requireData: true,
    description: 'Error during chat processing',
  },
  {
    from: CHAT_STEP_THINKING,
    to: CHAT_STEP_ERROR,
    requireData: true,
    description: 'Error during research',
  },
  {
    from: CHAT_STEP_ANALYZING,
    to: CHAT_STEP_ERROR,
    requireData: true,
    description: 'Error during analysis',
  },
  {
    from: CHAT_STEP_QUERYING,
    to: CHAT_STEP_ERROR,
    requireData: true,
    description: 'Error during data query',
  },
  {
    from: CHAT_STEP_SUMMARIZING,
    to: CHAT_STEP_ERROR,
    requireData: true,
    description: 'Error during summarization',
  },
  {
    from: CHAT_STEP_COMPLETED,
    to: CHAT_STEP_ERROR,
    requireData: true,
    description: 'Error after chat completion',
  },
  
  // Recovery paths
  {
    from: CHAT_STEP_ERROR,
    to: CHAT_STEP_IN_PROGRESS,
    allowData: true,
    description: 'Retry after error',
  },
  {
    from: CHAT_STEP_ERROR,
    to: 'idle',
    description: 'Reset after error',
  },
  
  // Completion to new interactions
  {
    from: 'complete',
    to: CHAT_STEP_IN_PROGRESS,
    allowData: true,
    description: 'Continue with chat after workflow completion',
  },
];

// ==========================================================================
// Helper Functions
// ==========================================================================

/**
 * Check if a workflow step is a chat-related step.
 */
export function isChatWorkflowStep(step: WorkflowStep): boolean {
  return (
    step === CHAT_STEP_STARTED ||
    step === CHAT_STEP_IN_PROGRESS ||
    step === CHAT_STEP_COMPLETED ||
    step === CHAT_STEP_ERROR ||
    step === CHAT_STEP_THINKING ||
    step === CHAT_STEP_ANALYZING ||
    step === CHAT_STEP_QUERYING ||
    step === CHAT_STEP_SUMMARIZING
  );
}

/**
 * Check if workflow step is one of the core DB-defined chat steps.
 */
export function isCoreChatStep(step: WorkflowStep): boolean {
  return (
    step === CHAT_STEP_STARTED ||
    step === CHAT_STEP_IN_PROGRESS ||
    step === CHAT_STEP_COMPLETED ||
    step === CHAT_STEP_ERROR
  );
}

/**
 * Get the appropriate DB workflow step for a domain chat step.
 * Uses the WorkflowStepMapper to ensure consistency.
 */
export function getChatWorkflowDbStep(step: WorkflowStep): string {
  return WorkflowStepMapper.toDatabaseStep(step);
}

/**
 * Get a display-friendly label for a chat workflow step.
 */
export function getChatWorkflowStepLabel(step: WorkflowStep): string {
  const labels: Record<string, string> = {
    [CHAT_STEP_STARTED]: 'Chat Started',
    [CHAT_STEP_IN_PROGRESS]: 'Processing Message',
    [CHAT_STEP_COMPLETED]: 'Message Completed',
    [CHAT_STEP_ERROR]: 'Chat Error',
    [CHAT_STEP_THINKING]: 'Researching',
    [CHAT_STEP_ANALYZING]: 'Analyzing',
    [CHAT_STEP_QUERYING]: 'Querying Data',
    [CHAT_STEP_SUMMARIZING]: 'Summarizing',
  };
  
  return labels[step] || 'Unknown Chat Step';
}

/**
 * Get the recommended processing phase for a chat workflow step.
 */
export function getChatWorkflowPhase(step: WorkflowStep): ProcessingPhase {
  const phases: Record<string, ProcessingPhase> = {
    [CHAT_STEP_STARTED]: ProcessingPhase.INITIALIZATION,
    [CHAT_STEP_IN_PROGRESS]: ProcessingPhase.CHAT_PROCESSING,
    [CHAT_STEP_COMPLETED]: ProcessingPhase.COMPLETION,
    [CHAT_STEP_ERROR]: ProcessingPhase.ERROR,
    [CHAT_STEP_THINKING]: ProcessingPhase.RESEARCH,
    [CHAT_STEP_ANALYZING]: ProcessingPhase.ANALYSIS,
    [CHAT_STEP_QUERYING]: ProcessingPhase.RESEARCH_QUERY,
    [CHAT_STEP_SUMMARIZING]: ProcessingPhase.RESEARCH_SUMMARIZATION,
  };
  
  return phases[step] || ProcessingPhase.CHAT_PROCESSING;
}

/**
 * Find the next valid chat workflow step based on the current step.
 */
export function getNextChatWorkflowStep(
  currentStep: WorkflowStep,
  options?: {
    requireData?: boolean;
    allowError?: boolean;
  }
): WorkflowStep[] {
  const { requireData = false, allowError = false } = options || {};
  
  return CHAT_WORKFLOW_TRANSITIONS
    .filter(transition =>
      transition.from === currentStep &&
      (!requireData || transition.allowData) &&
      (allowError || transition.to !== CHAT_STEP_ERROR)
    )
    .map(transition => transition.to);
}

/**
 * Check if a transition between two chat workflow steps is valid.
 */
export function isValidChatWorkflowTransition(
  fromStep: WorkflowStep,
  toStep: WorkflowStep
): boolean {
  return CHAT_WORKFLOW_TRANSITIONS.some(
    transition => transition.from === fromStep && transition.to === toStep
  );
}

/**
 * Get the initial metadata for a chat workflow.
 */
export function getInitialChatWorkflowMetadata(
  chatId: string,
  userId: string,
  options?: {
    title?: string;
    description?: string;
    tags?: string[];
  }
): Record<string, unknown> {
  const now = new Date().toISOString();
  
  return {
    chatId,
    userId,
    startedAt: now,
    lastUpdatedAt: now,
    title: options?.title || 'New Chat',
    description: options?.description || '',
    tags: options?.tags || [],
    messageCount: 0,
    progress: 0,
    phase: ProcessingPhase.INITIALIZATION,
    error: null
  };
}