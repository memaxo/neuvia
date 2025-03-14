import { z } from 'zod';
import { createWorkflowDefinition } from '../coordination/workflow-definition';
import { ProcessingPhase } from '@/lib/types/workflow';
import { ReportFormat, ReportType } from '@/lib/types/report';

/**
 * Report workflow context schema
 */
const reportContextSchema = z.object({
  // User information
  userId: z.string().optional(),
  
  // Workflow metadata
  progress: z.number().default(0),
  phase: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  
  // Report inputs
  patientId: z.string().optional(),
  documentId: z.string().optional(),
  verificationId: z.string().optional(),
  
  // Report parameters
  reportType: z.nativeEnum(ReportType).default(ReportType.SUMMARY),
  format: z.nativeEnum(ReportFormat).default(ReportFormat.MARKDOWN),
  includeCitations: z.boolean().default(true),
  includeAppendices: z.boolean().default(false),
  includeVisualizations: z.boolean().default(false),
  
  // Report outputs
  reportId: z.string().optional(),
  reportTitle: z.string().optional(),
  reportContent: z.string().optional(),
  reportMetadata: z.record(z.unknown()).optional(),
  
  // Formatting options
  formatOptions: z.record(z.unknown()).optional(),
  availableFormats: z.array(z.string()).default([
    ReportFormat.MARKDOWN,
    ReportFormat.HTML,
    ReportFormat.TEXT,
    ReportFormat.PDF
  ]),
  
  // Error handling
  error: z.string().optional(),
  errorTimestamp: z.string().optional(),
  errorContext: z.string().optional()
});

// Define report workflow types based on schema
export type ReportContext = z.infer<typeof reportContextSchema>;

/**
 * Report workflow definition
 * Defines states, transitions, and effects for report generation
 */
export const reportWorkflowDefinition = createWorkflowDefinition<ReportContext>({
  id: 'report-workflow',
  name: 'Report Generation Workflow',
  description: 'Handles report generation, formatting, and presentation',
  version: '1.0.0',
  initialState: 'idle',
  domains: ['Report'],
  context: {
    schema: reportContextSchema,
    initialValue: {
      progress: 0,
      reportType: ReportType.SUMMARY,
      format: ReportFormat.MARKDOWN,
      includeCitations: true,
      includeAppendices: false,
      includeVisualizations: false,
      availableFormats: [
        ReportFormat.MARKDOWN,
        ReportFormat.HTML,
        ReportFormat.TEXT,
        ReportFormat.PDF
      ]
    }
  },
  states: {
    'idle': {
      id: 'idle',
      type: 'initial',
      description: 'Initial state before report generation starts',
      transitions: {
        'GENERATE_REPORT': {
          target: 'report_generation',
          effects: [
            async (context, event) => {
              // Record report generation start
              context.startedAt = new Date().toISOString();
              context.patientId = event.payload?.patientId;
              context.documentId = event.payload?.documentId;
              context.verificationId = event.payload?.verificationId;
              context.reportType = event.payload?.reportType || ReportType.SUMMARY;
              context.format = event.payload?.format || ReportFormat.MARKDOWN;
              context.progress = 0;
              context.phase = ProcessingPhase.INITIALIZATION;
            }
          ]
        }
      },
      onEntry: [
        async (context) => {
          // Reset context when entering idle state
          context.progress = 0;
          context.error = undefined;
          context.reportContent = undefined;
          context.reportId = undefined;
        }
      ]
    },
    'report_generation': {
      id: 'report_generation',
      description: 'Report is being generated',
      transitions: {
        'GENERATION_COMPLETED': {
          target: 'report_presentation',
          effects: [
            async (context, event) => {
              // Store report generation results
              context.reportId = event.payload.reportId;
              context.reportTitle = event.payload.title;
              context.reportContent = event.payload.content;
              context.reportMetadata = event.payload.metadata;
              context.progress = 100;
              context.phase = ProcessingPhase.COMPLETION;
            }
          ]
        },
        'GENERATION_FAILED': {
          target: 'error',
          effects: [
            async (context, event) => {
              context.error = event.payload.error;
              context.errorTimestamp = new Date().toISOString();
              context.errorContext = 'report_generation';
            }
          ]
        },
        'UPDATE_PROGRESS': {
          target: 'report_generation', // Self-transition
          effects: [
            async (context, event) => {
              context.progress = event.payload.progress;
              context.phase = event.payload.phase;
            }
          ]
        }
      },
      onEntry: [
        async (context) => {
          // Initialize generation state
          context.progress = 0;
          context.phase = ProcessingPhase.REPORT_GENERATION;
        }
      ]
    },
    'report_presentation': {
      id: 'report_presentation',
      description: 'Report is available for presentation or formatting',
      transitions: {
        'FORMAT_REPORT': {
          target: 'report_formatting',
          effects: [
            async (context, event) => {
              // Set formatting options
              context.format = event.payload.format;
              context.formatOptions = event.payload.options;
              context.progress = 0;
            }
          ],
          condition: (context, event) => {
            // Only allow format transition if we have a valid format
            return event.payload?.format && context.availableFormats.includes(event.payload.format);
          }
        },
        'COMPLETE_WORKFLOW': {
          target: 'complete',
          effects: [
            async (context) => {
              context.completedAt = new Date().toISOString();
              context.progress = 100;
              context.phase = ProcessingPhase.COMPLETION;
            }
          ]
        }
      },
      onEntry: [
        async (context) => {
          // Update state for presentation
          context.phase = ProcessingPhase.REPORT_PRESENTATION;
          context.progress = 100;
        }
      ]
    },
    'report_formatting': {
      id: 'report_formatting',
      description: 'Report is being formatted',
      transitions: {
        'FORMAT_COMPLETED': {
          target: 'report_presentation',
          effects: [
            async (context, event) => {
              // Update with formatted content
              context.reportContent = event.payload.content;
              context.format = event.payload.format;
              context.reportMetadata = {
                ...context.reportMetadata,
                formattedAt: new Date().toISOString(),
                format: event.payload.format
              };
              context.progress = 100;
            }
          ]
        },
        'FORMAT_FAILED': {
          target: 'error',
          effects: [
            async (context, event) => {
              context.error = event.payload.error;
              context.errorTimestamp = new Date().toISOString();
              context.errorContext = 'report_formatting';
            }
          ]
        },
        'UPDATE_PROGRESS': {
          target: 'report_formatting', // Self-transition
          effects: [
            async (context, event) => {
              context.progress = event.payload.progress;
              context.phase = event.payload.phase;
            }
          ]
        }
      },
      onEntry: [
        async (context) => {
          // Initialize formatting state
          context.progress = 0;
          context.phase = ProcessingPhase.REPORT_FORMATTING;
        }
      ]
    },
    'complete': {
      id: 'complete',
      type: 'final',
      description: 'Report workflow is complete',
      transitions: {
        'RESTART': {
          target: 'idle',
          effects: [
            async (context) => {
              // Save report ID before reset
              const reportId = context.reportId;
              
              // Reset state but keep report ID
              context.progress = 0;
              context.phase = ProcessingPhase.INITIALIZATION;
              context.error = undefined;
              context.reportContent = undefined;
              
              // Restore report ID
              context.reportId = reportId;
            }
          ]
        }
      },
      onEntry: [
        async (context) => {
          context.completedAt = context.completedAt || new Date().toISOString();
          context.progress = 100;
          context.phase = ProcessingPhase.COMPLETION;
        }
      ]
    },
    'error': {
      id: 'error',
      type: 'error',
      description: 'Error state for report workflow',
      transitions: {
        'RETRY_GENERATION': {
          target: 'report_generation',
          effects: [
            async (context) => {
              // Clear error state for retry
              context.error = undefined;
              context.errorTimestamp = undefined;
              context.errorContext = undefined;
              context.progress = 0;
            }
          ]
        },
        'RETRY_FORMATTING': {
          target: 'report_formatting',
          condition: (context) => context.errorContext === 'report_formatting',
          effects: [
            async (context) => {
              // Clear error state for retry
              context.error = undefined;
              context.errorTimestamp = undefined;
              context.errorContext = undefined;
              context.progress = 0;
            }
          ]
        },
        'RESET': {
          target: 'idle',
          effects: [
            async (context) => {
              // Reset everything
              context.error = undefined;
              context.errorTimestamp = undefined;
              context.errorContext = undefined;
              context.progress = 0;
              context.reportContent = undefined;
              context.reportId = undefined;
            }
          ]
        }
      },
      onEntry: [
        async (context, event) => {
          // Save error information if not already set
          if (!context.errorTimestamp) {
            context.errorTimestamp = new Date().toISOString();
          }
          
          if (!context.error && event?.payload?.error) {
            context.error = event.payload.error;
          }
          
          context.phase = ProcessingPhase.ERROR;
        }
      ]
    }
  }
});