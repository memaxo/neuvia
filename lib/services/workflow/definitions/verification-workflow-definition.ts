/**
 * @fileoverview Verification Workflow Definition
 *
 * PHASE 3 IMPLEMENTATION:
 * Defines the state machine for document verification workflows.
 * This includes states, transitions, and workflow state management.
 * 
 * This file follows the standardized workflow definition template structure
 * and has been updated to separate state transitions from business logic.
 * All business logic is delegated to the VerificationService and CorrectionService.
 * 
 * IMPORTANT: This file should ONLY contain state transition logic and not business logic.
 * Business logic should be delegated to domain services (verificationService, correctionService, etc.).
 */

import { z } from 'zod';
import { createWorkflowDefinition } from '../coordination/workflow-definition';
import { VerificationStatus } from '@/lib/types/verification';
import { ProcessingPhase } from '@/lib/types/workflow';
import logger from '@/lib/logger';

// Context schema for type validation
const verificationContextSchema = z.object({
  userId: z.string().optional(),
  documentId: z.string().optional(),
  patientId: z.string().optional(),
  verificationId: z.string().optional(),
  summaryId: z.string().optional(),
  currentSummary: z.string().optional(),
  originalContent: z.string().optional(),
  progress: z.number().default(0),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  correctionCount: z.number().default(0),
  corrections: z.array(z.any()).default([]),
  error: z.string().optional(),
  status: z.enum([
    'pending',
    'in_progress',
    'completed',
    'failed'
  ]).default('pending'),
  verificationMetadata: z.record(z.any()).optional(),
  autoGenerateReport: z.boolean().default(false)
});

// Context type derived from schema
type VerificationContext = z.infer<typeof verificationContextSchema>;

// Define the verification workflow
export const verificationWorkflowDefinition = createWorkflowDefinition<VerificationContext>({
  id: 'verification-workflow',
  name: 'Document Verification Workflow',
  description: 'Controls the document verification process including user corrections',
  version: '1.0.0',
  domains: ['Verification'],
  initialState: 'idle',
  context: {
    schema: verificationContextSchema,
    initialValue: {
      progress: 0,
      correctionCount: 0,
      corrections: [],
      status: 'pending'
    }
  },
  states: {
    'idle': {
      id: 'idle',
      type: 'initial',
      description: 'Initial state before verification starts',
      transitions: {
        'INITIATE_VERIFICATION': {
          target: 'verification_pending',
          condition: (context, event) => !!event.payload?.documentId,
          effects: [
            async (context, event) => {
              // Record initiation data
              context.documentId = event.payload.documentId;
              context.startedAt = new Date().toISOString();
              context.userId = event.payload.userId || event.meta?.userId;
              context.patientId = event.payload.patientId;
              context.verificationId = event.payload.verificationId; // Should be provided by service
              context.summaryId = event.payload.summaryId; // Should be provided by service
              context.originalContent = event.payload.documentText || '';
              context.currentSummary = event.payload.documentText || '';
              context.status = 'pending';
              context.autoGenerateReport = event.payload.autoGenerateReport || false;
              
              logger.info('Verification initiated', {
                documentId: context.documentId,
                verificationId: context.verificationId,
                userId: context.userId
              });
            }
          ]
        }
      }
    },
    'verification_pending': {
      id: 'verification_pending',
      description: 'Verification has been initiated and is awaiting processing',
      transitions: {
        'PREPARE_VERIFICATION': {
          target: 'verification_in_progress',
          effects: [
            async (context, event) => {
              // Update progress
              context.progress = 100;
              context.status = 'in_progress';
              
              // Add summary data if provided
              if (event.payload?.summary) {
                context.currentSummary = event.payload.summary;
              }
              
              // Add structured data if provided
              if (event.payload?.structuredData) {
                context.verificationMetadata = {
                  ...context.verificationMetadata,
                  structuredData: event.payload.structuredData,
                  verification_status: VerificationStatus.inProgress,
                  currentVersionId: context.summaryId,
                  lastUpdated: new Date().toISOString()
                };
              }
              
              logger.info('Verification is ready for user interaction', {
                verificationId: context.verificationId,
                documentId: context.documentId
              });
            }
          ]
        },
        'CANCEL_VERIFICATION': {
          target: 'idle',
          effects: [
            async (context, event) => {
              context.error = event.payload?.reason || 'Verification cancelled by user';
              logger.info('Verification cancelled', {
                verificationId: context.verificationId,
                documentId: context.documentId,
                reason: context.error
              });
            }
          ]
        },
        'VERIFICATION_ERROR': {
          target: 'error',
          effects: [
            async (context, event) => {
              context.error = event.payload?.error || 'Error during verification preparation';
              context.status = 'failed';
              
              logger.error('Verification preparation error', {
                verificationId: context.verificationId,
                documentId: context.documentId,
                error: context.error
              });
            }
          ]
        }
      },
      onEntry: [
        async (context) => {
          // Set metadata for verification pending
          context.verificationMetadata = {
            ...context.verificationMetadata,
            verification_status: VerificationStatus.pending,
            originalSummaryId: context.summaryId,
            currentVersionId: context.summaryId,
            correctionCount: 0,
            corrections: [],
            lastUpdated: new Date().toISOString()
          };
        }
      ]
    },
    'verification_in_progress': {
      id: 'verification_in_progress',
      description: 'User is actively reviewing and potentially correcting the verification',
      transitions: {
        'SUBMIT_CORRECTION': {
          target: 'verification_in_progress',
          condition: (context, event) => !!event.payload?.correctionText,
          effects: [
            async (context, event) => {
              // Use provided IDs from the service
              const newSummaryId = event.payload.summaryId || context.summaryId;
              
              // Record correction (ID should be provided by the correction service)
              const correction = {
                id: event.payload.correctionId,
                text: event.payload.correctionText,
                timestamp: new Date().toISOString(),
                userId: event.meta?.userId || context.userId,
                summaryId: newSummaryId,
                previousSummaryId: context.summaryId
              };
              
              // Update context with correction
              context.correctionCount += 1;
              context.corrections.push(correction);
              context.summaryId = newSummaryId;
              
              // If new summary content is provided, update it
              if (event.payload.newSummary) {
                context.currentSummary = event.payload.newSummary;
              }
              
              // Update metadata
              context.verificationMetadata = {
                ...context.verificationMetadata,
                verification_status: VerificationStatus.inProgress,
                currentVersionId: newSummaryId,
                correctionCount: context.correctionCount,
                corrections: context.corrections,
                lastUpdated: new Date().toISOString()
              };
              
              logger.info('Correction submitted', {
                verificationId: context.verificationId,
                correctionCount: context.correctionCount,
                summaryId: newSummaryId
              });
            }
          ]
        },
        'CONFIRM_VERIFICATION': {
          target: 'verification_completed',
          effects: [
            async (context, event) => {
              context.completedAt = new Date().toISOString();
              context.status = 'completed';
              
              // Update metadata
              context.verificationMetadata = {
                ...context.verificationMetadata,
                verification_status: VerificationStatus.completed,
                verifiedAt: context.completedAt,
                verifiedBy: event.meta?.userId || context.userId,
                lastUpdated: context.completedAt
              };
              
              logger.info('Verification confirmed and completed', {
                verificationId: context.verificationId,
                documentId: context.documentId,
                userId: event.meta?.userId || context.userId,
                correctionCount: context.correctionCount
              });
            }
          ]
        },
        'REJECT_VERIFICATION': {
          target: 'verification_failed',
          effects: [
            async (context, event) => {
              context.completedAt = new Date().toISOString();
              context.status = 'failed';
              context.error = event.payload?.reason || 'Verification rejected by user';
              
              // Update metadata
              context.verificationMetadata = {
                ...context.verificationMetadata,
                verification_status: VerificationStatus.failed,
                rejectedAt: context.completedAt,
                rejectedBy: event.meta?.userId || context.userId,
                rejectionReason: context.error,
                lastUpdated: context.completedAt
              };
              
              logger.info('Verification rejected', {
                verificationId: context.verificationId,
                documentId: context.documentId,
                userId: event.meta?.userId || context.userId,
                reason: context.error
              });
            }
          ]
        },
        'VERIFICATION_ERROR': {
          target: 'error',
          effects: [
            async (context, event) => {
              context.error = event.payload?.error || 'Error during verification';
              context.status = 'failed';
              
              logger.error('Verification in-progress error', {
                verificationId: context.verificationId,
                documentId: context.documentId,
                error: context.error
              });
            }
          ]
        }
      }
    },
    'verification_completed': {
      id: 'verification_completed',
      description: 'Verification has been successfully completed',
      type: 'final',
      transitions: {
        'GENERATE_REPORT': {
          target: 'report_generation',
          condition: (context) => context.autoGenerateReport === true,
          effects: [
            async (context, event) => {
              logger.info('Transitioning to report generation after verification', {
                verificationId: context.verificationId,
                documentId: context.documentId,
                autoGenerate: context.autoGenerateReport
              });
            }
          ]
        },
        'RESET_VERIFICATION': {
          target: 'idle',
          effects: [
            async (context) => {
              // Keep only minimal history
              const previousVerificationId = context.verificationId;
              const previousDocumentId = context.documentId;
              
              // Reset the context
              Object.keys(context).forEach(key => {
                if (key !== 'previousVerifications') {
                  delete context[key as keyof typeof context];
                }
              });
              
              // Initialize default values
              context.progress = 0;
              context.correctionCount = 0;
              context.corrections = [];
              context.status = 'pending';
              
              // Track history
              context.previousVerifications = [
                ...(context.previousVerifications || []),
                {
                  verificationId: previousVerificationId,
                  documentId: previousDocumentId,
                  completedAt: new Date().toISOString()
                }
              ];
              
              logger.info('Verification reset to idle', {
                previousVerificationId
              });
            }
          ]
        }
      }
    },
    'verification_failed': {
      id: 'verification_failed',
      description: 'Verification was rejected or failed',
      transitions: {
        'RETRY_VERIFICATION': {
          target: 'verification_in_progress',
          effects: [
            async (context, event) => {
              // Clear error but keep correction history
              context.error = undefined;
              context.status = 'in_progress';
              
              // Update metadata
              context.verificationMetadata = {
                ...context.verificationMetadata,
                verification_status: VerificationStatus.inProgress,
                retryCount: (context.verificationMetadata?.retryCount || 0) + 1,
                lastUpdated: new Date().toISOString()
              };
              
              logger.info('Retrying verification after failure', {
                verificationId: context.verificationId,
                documentId: context.documentId,
                retryCount: context.verificationMetadata?.retryCount
              });
            }
          ]
        },
        'RESET_VERIFICATION': {
          target: 'idle',
          effects: [
            async (context) => {
              // Keep only minimal history
              const previousVerificationId = context.verificationId;
              const previousDocumentId = context.documentId;
              const previousError = context.error;
              
              // Reset the context
              Object.keys(context).forEach(key => {
                if (key !== 'previousVerifications') {
                  delete context[key as keyof typeof context];
                }
              });
              
              // Initialize default values
              context.progress = 0;
              context.correctionCount = 0;
              context.corrections = [];
              context.status = 'pending';
              
              // Track history
              context.previousVerifications = [
                ...(context.previousVerifications || []),
                {
                  verificationId: previousVerificationId,
                  documentId: previousDocumentId,
                  status: 'failed',
                  error: previousError,
                  completedAt: new Date().toISOString()
                }
              ];
              
              logger.info('Failed verification reset to idle', {
                previousVerificationId,
                error: previousError
              });
            }
          ]
        }
      }
    },
    'report_generation': {
      id: 'report_generation',
      description: 'Report is being generated following verification',
      transitions: {
        'REPORT_COMPLETED': {
          target: 'complete',
          effects: [
            async (context, event) => {
              // Store report ID if provided
              if (event.payload?.reportId) {
                context.reportId = event.payload.reportId;
              }
              
              logger.info('Report generation completed', {
                verificationId: context.verificationId,
                documentId: context.documentId,
                reportId: context.reportId
              });
            }
          ]
        },
        'REPORT_ERROR': {
          target: 'error',
          effects: [
            async (context, event) => {
              context.error = event.payload?.error || 'Error during report generation';
              
              logger.error('Report generation error', {
                verificationId: context.verificationId,
                documentId: context.documentId,
                error: context.error
              });
            }
          ]
        }
      }
    },
    'complete': {
      id: 'complete',
      type: 'final',
      description: 'Verification workflow has completed successfully',
      transitions: {
        'RESET_VERIFICATION': {
          target: 'idle',
          effects: [
            async (context) => {
              // Keep only minimal history
              const previousVerificationId = context.verificationId;
              const previousDocumentId = context.documentId;
              const previousReportId = context.reportId;
              
              // Reset the context
              Object.keys(context).forEach(key => {
                if (key !== 'previousVerifications') {
                  delete context[key as keyof typeof context];
                }
              });
              
              // Initialize default values
              context.progress = 0;
              context.correctionCount = 0;
              context.corrections = [];
              context.status = 'pending';
              
              // Track history
              context.previousVerifications = [
                ...(context.previousVerifications || []),
                {
                  verificationId: previousVerificationId,
                  documentId: previousDocumentId,
                  reportId: previousReportId,
                  completedAt: new Date().toISOString()
                }
              ];
              
              logger.info('Completed verification reset to idle', {
                previousVerificationId,
                previousReportId
              });
            }
          ]
        }
      }
    },
    'error': {
      id: 'error',
      type: 'error',
      description: 'An error occurred during the verification process',
      transitions: {
        'RETRY_VERIFICATION': {
          target: 'verification_pending',
          effects: [
            async (context, event) => {
              // Clear error but keep main context
              context.error = undefined;
              context.status = 'pending';
              
              // Update metadata
              context.verificationMetadata = {
                ...context.verificationMetadata,
                verification_status: VerificationStatus.pending,
                retryCount: (context.verificationMetadata?.retryCount || 0) + 1,
                lastUpdated: new Date().toISOString()
              };
              
              logger.info('Retrying verification from error state', {
                verificationId: context.verificationId,
                documentId: context.documentId,
                retryCount: context.verificationMetadata?.retryCount
              });
            }
          ]
        },
        'RESET_VERIFICATION': {
          target: 'idle',
          effects: [
            async (context) => {
              // Keep only minimal history
              const previousVerificationId = context.verificationId;
              const previousDocumentId = context.documentId;
              const previousError = context.error;
              
              // Reset the context
              Object.keys(context).forEach(key => {
                if (key !== 'previousVerifications') {
                  delete context[key as keyof typeof context];
                }
              });
              
              // Initialize default values
              context.progress = 0;
              context.correctionCount = 0;
              context.corrections = [];
              context.status = 'pending';
              
              // Track history
              context.previousVerifications = [
                ...(context.previousVerifications || []),
                {
                  verificationId: previousVerificationId,
                  documentId: previousDocumentId,
                  status: 'error',
                  error: previousError,
                  timestamp: new Date().toISOString()
                }
              ];
              
              logger.info('Error state reset to idle', {
                previousVerificationId,
                error: previousError
              });
            }
          ]
        }
      }
    }
  }
});

export default verificationWorkflowDefinition;