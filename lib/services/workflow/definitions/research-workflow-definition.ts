import { z } from 'zod';
import { createWorkflowDefinition } from '../coordination/workflow-definition';
import type { WorkflowDefinition, WorkflowAction, StateNode } from '../coordination/workflow-definition';
import type { WorkflowStep } from '@/lib/types/workflow';
import { DomainOnlyWorkflowStep } from '@/lib/types/workflow';
import logger from '@/lib/logger';

// Research workflow context schema
const ResearchContextSchema = z.object({
  userId: z.string().optional(),
  query: z.string().optional(),
  patientId: z.string().optional(),
  documentId: z.string().optional(),
  researchId: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  error: z.string().optional(),
  errorType: z.string().optional(),
  model: z.string().optional(),
  includeCitations: z.boolean().optional(),
  autoGenerateReport: z.boolean().optional(),
  researchContent: z.string().optional(),
  sources: z.array(z.object({
    title: z.string().optional(),
    url: z.string(),
    snippet: z.string().optional(),
  })).optional(),
  progress: z.number().default(0),
  transactionId: z.string().optional(),
  reportId: z.string().optional(),
  reportGenerationStartedAt: z.string().optional(),
  reportCompletedAt: z.string().optional(),
  previousResearchId: z.string().optional(),
  previousResearchContent: z.string().optional(),
  previousSources: z.array(z.object({
    title: z.string().optional(),
    url: z.string(),
    snippet: z.string().optional(),
  })).optional(),
  previousCompletedAt: z.string().optional(),
  chatId: z.string().optional(),
  returnToChat: z.boolean().optional(),
  reportError: z.string().optional(),
  fromChat: z.boolean().optional(),
  chatCompletedAt: z.string().optional(),
});

// Type alias for the research context
type ResearchContext = z.infer<typeof ResearchContextSchema>;

// Define initial context
const initialContext: ResearchContext = {
  progress: 0
};

// Research workflow definition
export const researchWorkflowDefinition: WorkflowDefinition<ResearchContext> = createWorkflowDefinition({
  id: 'research-workflow',
  name: 'Research Workflow',
  description: 'Handles research query processing and results management',
  version: '1.0.0',
  initialState: 'idle' as WorkflowStep,
  domains: ['Research'],
  context: {
    schema: ResearchContextSchema,
    initialValue: initialContext
  },
  states: {
    'idle': {
      id: 'idle' as WorkflowStep,
      type: 'initial',
      description: 'Initial state before research starts',
      transitions: {
        'START_RESEARCH': {
          target: 'research_pending' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Record research start
              context.query = event.payload?.query;
              context.userId = event.payload?.userId;
              context.patientId = event.payload?.patientId;
              context.documentId = event.payload?.documentId;
              context.model = event.payload?.model;
              context.includeCitations = event.payload?.includeCitations;
              context.autoGenerateReport = event.payload?.autoGenerateReport;
              context.startedAt = new Date().toISOString();
              context.transactionId = event.meta?.transactionId;
              context.progress = 10;
            }
          ]
        }
      }
    },
    'research_pending': {
      id: 'research_pending' as WorkflowStep,
      description: 'Research is pending to start',
      transitions: {
        'RESEARCH_START': {
          target: 'research_in_progress' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Update progress
              context.progress = 20;
              context.researchId = event.payload?.researchId ||
                `research-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
              context.fromChat = event.payload?.fromChat === true;
              context.chatId = event.payload?.chatId;
            }
          ]
        },
        'CANCEL_RESEARCH': {
          target: 'idle' as WorkflowStep,
          effects: [
            async (context, event) => {
              context.error = 'Research cancelled by user';
              context.errorType = 'user_cancelled';
            }
          ]
        }
      }
    },
    'research_in_progress': {
      id: 'research_in_progress' as WorkflowStep,
      description: 'Research is currently being processed',
      transitions: {
        'RESEARCH_PROGRESS_UPDATE': {
          target: 'research_in_progress' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Update progress
              context.progress = event.payload?.progress || context.progress;
            }
          ]
        },
        'RESEARCH_COMPLETED': {
          target: 'research_completed' as WorkflowStep,
          condition: (context, event) => !context.autoGenerateReport,
          effects: [
            async (context, event) => {
              // Store research results
              context.completedAt = new Date().toISOString();
              context.researchContent = event.payload?.content;
              context.sources = event.payload?.sources;
              context.progress = 100;
              
              // If this research came from chat, we should track that
              if (context.fromChat && context.chatId) {
                context.returnToChat = true;
              }
            }
          ]
        },
        'RESEARCH_COMPLETED_AUTOREPORT': {
          target: 'report_generation' as WorkflowStep,
          condition: (context, event) => context.autoGenerateReport === true,
          effects: [
            async (context, event) => {
              // Store research results and transition to report generation
              context.completedAt = new Date().toISOString();
              context.researchContent = event.payload?.content;
              context.sources = event.payload?.sources;
              context.progress = 100;
              
              // Initialize report generation
              context.reportGenerationStartedAt = new Date().toISOString();
            }
          ]
        },
        'RESEARCH_FAILED': {
          target: 'research_error' as WorkflowStep,
          effects: [
            async (context, event) => {
              context.error = event.payload?.error || 'Research failed';
              context.errorType = event.payload?.errorType || 'api_error';
              
              // If this research came from chat, we should track that
              if (context.fromChat && context.chatId) {
                context.returnToChat = true;
              }
            }
          ]
        },
        'CANCEL_RESEARCH': {
          target: 'idle' as WorkflowStep,
          effects: [
            async (context, event) => {
              context.error = 'Research cancelled by user';
              context.errorType = 'user_cancelled';
            }
          ]
        }
      }
    },
    'research_completed': {
      id: 'research_completed' as WorkflowStep,
      description: 'Research has been completed successfully',
      transitions: {
        'GENERATE_REPORT': {
          target: 'report_generation' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Initialize report generation
              context.reportGenerationStartedAt = new Date().toISOString();
              context.autoGenerateReport = true;
            }
          ]
        },
        'RETURN_TO_CHAT': {
          target: 'chat_return' as WorkflowStep,
          condition: (context, event) => context.fromChat === true && context.chatId !== undefined,
          effects: [
            async (context, event) => {
              context.returnToChat = true;
              context.chatCompletedAt = new Date().toISOString();
            }
          ]
        },
        'START_NEW_RESEARCH': {
          target: 'research_pending' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Save previous research
              context.previousResearchId = context.researchId;
              context.previousResearchContent = context.researchContent;
              context.previousSources = context.sources;
              context.previousCompletedAt = context.completedAt;
              
              // Setup new research
              context.query = event.payload?.query;
              context.progress = 10;
              context.researchId = undefined;
              context.researchContent = undefined;
              context.sources = undefined;
              context.completedAt = undefined;
            }
          ]
        },
        'COMPLETE_WORKFLOW': {
          target: 'complete' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Nothing specific to do here
            }
          ]
        }
      }
    },
    'research_error': {
      id: 'research_error' as WorkflowStep,
      type: 'error',
      description: 'Research has failed with an error',
      transitions: {
        'RETRY_RESEARCH': {
          target: 'research_pending' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Clear error state
              context.error = undefined;
              context.errorType = undefined;
              context.progress = 10;
            }
          ]
        },
        'RETURN_TO_CHAT': {
          target: 'chat_return' as WorkflowStep,
          condition: (context, event) => context.fromChat === true && context.chatId !== undefined,
          effects: [
            async (context, event) => {
              context.returnToChat = true;
              context.chatCompletedAt = new Date().toISOString();
            }
          ]
        },
        'COMPLETE_WORKFLOW': {
          target: 'complete' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Nothing specific to do here
            }
          ]
        }
      }
    },
    'report_generation': {
      id: 'report_generation' as WorkflowStep,
      description: 'Report is being generated based on research',
      transitions: {
        'REPORT_PROGRESS_UPDATE': {
          target: 'report_generation' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Update progress
              context.progress = event.payload?.progress || context.progress;
            }
          ]
        },
        'REPORT_COMPLETED': {
          target: 'report_completed' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Store report results
              context.reportCompletedAt = new Date().toISOString();
              context.reportId = event.payload?.reportId;
              context.progress = 100;
            }
          ]
        },
        'REPORT_FAILED': {
          target: 'report_error' as WorkflowStep,
          effects: [
            async (context, event) => {
              context.reportError = event.payload?.error || 'Report generation failed';
              
              // If this research came from chat, we should track that
              if (context.fromChat && context.chatId) {
                context.returnToChat = true;
              }
            }
          ]
        },
        'CANCEL_REPORT': {
          target: 'research_completed' as WorkflowStep,
          effects: [
            async (context, event) => {
              context.reportError = 'Report generation cancelled by user';
              context.autoGenerateReport = false;
            }
          ]
        }
      }
    },
    'report_completed': {
      id: 'report_completed' as WorkflowStep,
      description: 'Report has been completed successfully',
      transitions: {
        'RETURN_TO_CHAT': {
          target: 'chat_return' as WorkflowStep,
          condition: (context, event) => context.fromChat === true && context.chatId !== undefined,
          effects: [
            async (context, event) => {
              context.returnToChat = true;
              context.chatCompletedAt = new Date().toISOString();
            }
          ]
        },
        'COMPLETE_WORKFLOW': {
          target: 'complete' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Nothing specific to do here
            }
          ]
        },
        'START_NEW_RESEARCH': {
          target: 'research_pending' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Save previous research
              context.previousResearchId = context.researchId;
              context.previousResearchContent = context.researchContent;
              context.previousSources = context.sources;
              context.previousCompletedAt = context.completedAt;
              
              // Setup new research
              context.query = event.payload?.query;
              context.progress = 10;
              context.researchId = undefined;
              context.researchContent = undefined;
              context.sources = undefined;
              context.completedAt = undefined;
              context.reportId = undefined;
              context.reportCompletedAt = undefined;
              context.reportGenerationStartedAt = undefined;
            }
          ]
        }
      }
    },
    'report_error': {
      id: 'report_error' as WorkflowStep,
      type: 'error',
      description: 'Report generation has failed with an error',
      transitions: {
        'RETRY_REPORT': {
          target: 'report_generation' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Clear error state
              context.reportError = undefined;
              context.reportGenerationStartedAt = new Date().toISOString();
              context.progress = 10;
            }
          ]
        },
        'RETURN_TO_RESEARCH': {
          target: 'research_completed' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Return to research without auto-generating report
              context.autoGenerateReport = false;
            }
          ]
        },
        'RETURN_TO_CHAT': {
          target: 'chat_return' as WorkflowStep,
          condition: (context, event) => context.fromChat === true && context.chatId !== undefined,
          effects: [
            async (context, event) => {
              context.returnToChat = true;
              context.chatCompletedAt = new Date().toISOString();
            }
          ]
        },
        'COMPLETE_WORKFLOW': {
          target: 'complete' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Nothing specific to do here
            }
          ]
        }
      }
    },
    'chat_return': {
      id: 'chat_return' as WorkflowStep,
      description: 'Research results are being returned to chat',
      transitions: {
        'CHAT_PROCESSING_COMPLETE': {
          target: 'chat_completed' as WorkflowStep,
          effects: [
            async (context, event) => {
              context.chatCompletedAt = new Date().toISOString();
            }
          ]
        },
        'CHAT_PROCESSING_FAILED': {
          target: 'chat_error' as WorkflowStep,
          effects: [
            async (context, event) => {
              context.error = event.payload?.error || 'Chat processing failed';
              context.errorType = 'chat_processing_error';
            }
          ]
        }
      }
    },
    'chat_completed': {
      id: 'chat_completed' as WorkflowStep,
      description: 'Research results have been successfully processed in chat',
      transitions: {
        'COMPLETE_WORKFLOW': {
          target: 'complete' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Nothing specific to do here
            }
          ]
        },
        'START_NEW_RESEARCH': {
          target: 'research_pending' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Save previous research
              context.previousResearchId = context.researchId;
              context.previousResearchContent = context.researchContent;
              context.previousSources = context.sources;
              context.previousCompletedAt = context.completedAt;
              
              // Setup new research
              context.query = event.payload?.query;
              context.progress = 10;
              context.researchId = undefined;
              context.researchContent = undefined;
              context.sources = undefined;
              context.completedAt = undefined;
              context.chatCompletedAt = undefined;
            }
          ]
        }
      }
    },
    'chat_error': {
      id: 'chat_error' as WorkflowStep,
      type: 'error',
      description: 'Chat processing of research results has failed',
      transitions: {
        'RETRY_CHAT_PROCESSING': {
          target: 'chat_return' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Clear error state
              context.error = undefined;
              context.errorType = undefined;
            }
          ]
        },
        'RETURN_TO_RESEARCH': {
          target: 'research_completed' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Return to research state
              context.returnToChat = false;
              context.chatCompletedAt = undefined;
            }
          ]
        },
        'COMPLETE_WORKFLOW': {
          target: 'complete' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Nothing specific to do here
            }
          ]
        }
      }
    },
    'complete': {
      id: 'complete' as WorkflowStep,
      type: 'final',
      description: 'Research workflow has been completed',
      transitions: {
        'START_NEW_RESEARCH': {
          target: 'research_pending' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Save previous research
              context.previousResearchId = context.researchId;
              context.previousResearchContent = context.researchContent;
              context.previousSources = context.sources;
              context.previousCompletedAt = context.completedAt;
              
              // Setup new research
              context.query = event.payload?.query;
              context.progress = 10;
              context.researchId = undefined;
              context.researchContent = undefined;
              context.sources = undefined;
              context.completedAt = undefined;
              context.reportId = undefined;
              context.reportCompletedAt = undefined;
              context.reportGenerationStartedAt = undefined;
              context.chatCompletedAt = undefined;
            }
          ]
        }
      }
    },
    'error': {
      id: 'error' as WorkflowStep,
      type: 'error',
      description: 'Research workflow has encountered an unrecoverable error',
      transitions: {
        'RETRY_WORKFLOW': {
          target: 'research_pending' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Clear error state and restart
              context.error = undefined;
              context.errorType = undefined;
              context.progress = 10;
            }
          ]
        },
        'COMPLETE_WORKFLOW': {
          target: 'complete' as WorkflowStep,
          effects: [
            async (context, event) => {
              // Nothing specific to do here
            }
          ]
        }
      }
    }
  }
});