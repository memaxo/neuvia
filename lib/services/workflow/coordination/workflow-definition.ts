import { z } from 'zod';
import type { WorkflowStep } from '@/lib/types/workflow';

/**
 * Workflow action type to define actions that can be performed
 */
export interface WorkflowAction<TContext extends Record<string, any> = Record<string, any>> {
  type: string;
  payload?: any;
  meta?: {
    transactionId?: string;
    userId?: string;
  };
}

/**
 * Transition condition type for evaluating state transitions
 */
export type TransitionCondition<
  TContext extends Record<string, any> = Record<string, any>
> = (context: TContext, event: WorkflowAction) => boolean;

/**
 * Side effect that can be performed during transitions
 */
export type WorkflowEffect<
  TContext extends Record<string, any> = Record<string, any>
> = (context: TContext, event: WorkflowAction) => Promise<void> | void;

/**
 * Transition definition
 */
export interface Transition<
  TContext extends Record<string, any> = Record<string, any>
> {
  target: WorkflowStep;
  condition?: TransitionCondition<TContext>;
  effects?: WorkflowEffect<TContext>[];
  description?: string;
}

/**
 * State definition including allowed transitions
 */
export interface StateNode<
  TContext extends Record<string, any> = Record<string, any>
> {
  id: WorkflowStep;
  transitions: Record<string, Transition<TContext> | Transition<TContext>[]>;
  onEntry?: WorkflowEffect<TContext>[];
  onExit?: WorkflowEffect<TContext>[];
  data?: Record<string, unknown>;
  type?: 'default' | 'initial' | 'final' | 'error';
  description?: string;
}

/**
 * Schema definition for context validation
 */
export interface ContextSchema<TContext> {
  schema: z.ZodSchema<TContext>;
  initialValue: TContext;
}

/**
 * Complete workflow definition
 */
export interface WorkflowDefinition<
  TContext extends Record<string, any> = Record<string, any>
> {
  id: string;
  name: string;
  description?: string;
  version: string;
  states: Record<string, StateNode<TContext>>;
  context: ContextSchema<TContext>;
  initialState: WorkflowStep;
  domains: string[];
}

/**
 * Creates a workflow definition
 */
export function createWorkflowDefinition<
  TContext extends Record<string, any> = Record<string, any>
>(definition: WorkflowDefinition<TContext>): WorkflowDefinition<TContext> {
  // Validate the definition
  if (!definition.states[definition.initialState]) {
    throw new Error(`Initial state '${definition.initialState}' not found in states`);
  }
  
  return definition;
}