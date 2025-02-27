// lib/workflow/workflow-context.tsx
import React, { createContext, useContext } from 'react';
import { useWorkflow } from './use-workflow';
import type { WorkflowStep } from './types';

/**
 * Create a typed context for the workflow
 */
const WorkflowContext = createContext<ReturnType<typeof useWorkflow> | undefined>(undefined);

/**
 * Props for the WorkflowProvider component
 */
export interface WorkflowProviderProps {
  userId?: string;
  initialStep?: WorkflowStep;
  chatId?: string | null;
  children: React.ReactNode;
}

/**
 * Provider component that makes workflow state available to any
 * child component that calls useWorkflowContext()
 */
export function WorkflowProvider({
  userId,
  initialStep,
  chatId,
  children
}: WorkflowProviderProps) {
  const workflow = useWorkflow({ userId, initialStep, chatId });
  
  return (
    <WorkflowContext.Provider value={workflow}>
      {children}
    </WorkflowContext.Provider>
  );
}

/**
 * Hook to access the workflow context
 * Must be used within a WorkflowProvider component
 */
export function useWorkflowContext() {
  const context = useContext(WorkflowContext);
  
  if (!context) {
    throw new Error('useWorkflowContext must be used within a WorkflowProvider');
  }
  
  return context;
}