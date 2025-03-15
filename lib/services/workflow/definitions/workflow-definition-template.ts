/**
 * @fileoverview Workflow Definition Template
 *
 * PHASE 3 IMPLEMENTATION:
 * This standardized template should be used for all workflow definitions.
 * It provides a consistent structure for defining state machines, transitions,
 * and effects while keeping business logic separate from state transitions.
 */

import { z } from 'zod';
import { createWorkflowDefinition } from '../coordination/workflow-definition';
import type { WorkflowAction, StateNode, Transition, WorkflowEffect } from '../coordination/workflow-definition';
import type { WorkflowStep } from '@/lib/types/workflow';
import logger from '@/lib/logger';

/**
 * Context schema for type validation
 * Define all properties that will be stored in the workflow context.
 */
const workflowContextSchema = z.object({
  // Required base properties
  userId: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  progress: z.number().default(0),
  error: z.string().optional(),
  
  // Add domain-specific properties here
  // ...
});

/**
 * Context type derived from schema
 */
type WorkflowContext = z.infer<typeof workflowContextSchema>;

/**
 * Initial context value
 * Should set reasonable defaults for all required properties.
 */
const initialContext: WorkflowContext = {
  progress: 0,
  // Set other defaults as needed
};

// ========================================================================
// Common Effects
// ========================================================================

/**
 * Effect to track errors
 */
const trackError: WorkflowEffect<WorkflowContext> = (context, action) => {
  const errorMessage = action.payload?.error || 'Unknown error';
  
  // Store error information
  context.error = errorMessage;
  
  // Log error for debugging
  logger.error('Workflow error occurred', {
    error: errorMessage,
    details: action.payload
  });
};

/**
 * Effect to clear errors
 */
const clearError: WorkflowEffect<WorkflowContext> = (context) => {
  context.error = undefined;
  
  logger.info('Error state cleared');
};

// Add more common effects here as needed

// ========================================================================
// State Definitions
// ========================================================================

/**
 * idle state - initial state before workflow starts
 */
const idleState: StateNode<WorkflowContext> = {
  id: 'idle',
  type: 'initial',
  description: 'Initial state before workflow begins',
  transitions: {
    // Define transitions from idle state
    'START': {
      target: 'processing', // Replace with appropriate next state
      effects: [
        (context, action) => {
          // Record start data
          context.startedAt = new Date().toISOString();
          context.userId = action.payload?.userId || action.meta?.userId;
          
          // Set any additional metadata
          if (action.payload) {
            Object.entries(action.payload).forEach(([key, value]) => {
              if (key !== 'userId') {
                (context as any)[key] = value;
              }
            });
          }
          
          logger.info('Workflow started', {
            userId: context.userId
          });
        }
      ]
    }
  }
};

/**
 * processing state - workflow is actively running
 */
const processingState: StateNode<WorkflowContext> = {
  id: 'processing',
  description: 'Workflow is actively processing',
  transitions: {
    // Define transitions from processing state
    'PROGRESS_UPDATE': {
      target: 'processing', // Same state, just updating progress
      effects: [
        (context, action) => {
          // Update progress
          if (typeof action.payload?.progress === 'number') {
            context.progress = action.payload.progress;
          }
          
          logger.debug('Progress updated', {
            progress: context.progress
          });
        }
      ]
    },
    'COMPLETE': {
      target: 'completed',
      effects: [
        (context, action) => {
          // Record completion data
          context.completedAt = new Date().toISOString();
          context.progress = 100;
          
          logger.info('Processing completed successfully', {
            userId: context.userId,
            duration: context.startedAt ? 
              new Date().getTime() - new Date(context.startedAt).getTime() :
              undefined
          });
        }
      ]
    },
    'PROCESS_ERROR': {
      target: 'error',
      effects: [
        trackError,
        (context, action) => {
          logger.error('Processing error occurred', {
            error: action.payload?.error
          });
        }
      ]
    }
  }
};

/**
 * completed state - workflow finished successfully
 */
const completedState: StateNode<WorkflowContext> = {
  id: 'completed',
  type: 'final',
  description: 'Workflow completed successfully',
  transitions: {
    // Define any transitions from completed state
    'RESET': {
      target: 'idle',
      effects: [
        (context) => {
          // Keep only minimal history
          const userId = context.userId;
          const previous = {
            startedAt: context.startedAt,
            completedAt: context.completedAt
          };
          
          // Reset the context
          Object.keys(context).forEach(key => {
            if (key !== 'previousRuns') {
              delete (context as any)[key];
            }
          });
          
          // Initialize default values
          context.progress = 0;
          context.userId = userId;
          
          // Track history if needed
          (context as any).previousRuns = [
            ...((context as any).previousRuns || []),
            previous
          ];
          
          logger.info('Workflow reset to idle', {
            previousCompletion: previous.completedAt
          });
        }
      ]
    }
  }
};

/**
 * error state - workflow encountered an error
 */
const errorState: StateNode<WorkflowContext> = {
  id: 'error',
  type: 'error',
  description: 'Workflow encountered an error',
  transitions: {
    // Define transitions from error state
    'RETRY': {
      target: 'processing',
      effects: [
        clearError,
        (context) => {
          // Update retry count if needed
          (context as any).retryCount = ((context as any).retryCount || 0) + 1;
          
          logger.info('Retrying workflow after error', {
            retryCount: (context as any).retryCount
          });
        }
      ]
    },
    'RESET': {
      target: 'idle',
      effects: [
        (context) => {
          // Keep only minimal history
          const userId = context.userId;
          const error = context.error;
          
          // Reset the context
          Object.keys(context).forEach(key => {
            if (key !== 'previousRuns') {
              delete (context as any)[key];
            }
          });
          
          // Initialize default values
          context.progress = 0;
          context.userId = userId;
          
          // Track history if needed
          (context as any).previousRuns = [
            ...((context as any).previousRuns || []),
            {
              error,
              timestamp: new Date().toISOString()
            }
          ];
          
          logger.info('Error state reset to idle', {
            previousError: error
          });
        }
      ]
    }
  }
};

// ========================================================================
// Workflow Definition
// ========================================================================

/**
 * Create the workflow definition
 * Each domain should use this common pattern for consistency.
 */
export const workflowDefinition = createWorkflowDefinition<WorkflowContext>({
  id: 'workflow-id', // REPLACE with specific workflow ID
  name: 'Workflow Name', // REPLACE with specific workflow name
  description: 'Workflow description', // REPLACE with specific description
  version: '1.0.0',
  initialState: 'idle',
  domains: ['Domain'], // REPLACE with specific domain(s)
  context: {
    schema: workflowContextSchema,
    initialValue: initialContext
  },
  states: {
    'idle': idleState,
    'processing': processingState,
    'completed': completedState,
    'error': errorState
    // Add additional states as needed
  }
});

// Export the definition
export default workflowDefinition;