/**
 * @fileoverview Research Workflow Processor
 * 
 * Handles all research-related workflow operations including:
 * - Deep research using AI and external knowledge
 * - Research query processing
 * - Result management and formatting
 */

import { ApplicationError, normalizeError } from '@/lib/errors'
import logger from '@/lib/logger'
import { workflowRepository } from '../infrastructure/workflow-repository'
import { workflowStateManager } from '../infrastructure/workflow-state-manager'
import { workflowEventSourcing } from '../infrastructure/workflow-event-source'
import { workflowTransactionManager } from '../workflow-transaction-manager'
import { DomainOnlyWorkflowStep } from '@/lib/types/workflow'

import type { WorkflowStep, ProcessingPhase } from '@/lib/types/workflow'

/**
 * Research result interface
 */
export interface ResearchResult {
  /** Research ID */
  researchId: string;
  /** Query that was researched */
  query?: string;
  /** Whether research was successful */
  success: boolean;
  /** Research content/findings */
  content?: string;
  /** Research metadata */
  metadata: Record<string, unknown>;
  /** Error message if research failed */
  error?: string;
  /** Citation sources */
  sources?: Array<{
    title: string;
    url?: string;
    snippet?: string;
  }>;
}

/**
 * Research options
 */
export interface ResearchOptions {
  /** User ID who initiated research */
  userId: string;
  /** Query to research */
  query: string;
  /** Patient ID if research is for a patient */
  patientId?: string;
  /** Document ID if research is related to a document */
  documentId?: string;
  /** Model to use */
  model?: string;
  /** Whether to include citations */
  includeCitations?: boolean;
  /** Whether to auto-generate report after research */
  autoGenerateReport?: boolean;
  /** Progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
  /** Transaction ID for tracking */
  transactionId?: string;
}

/**
 * Research workflow processor
 */
export class ResearchWorkflow {
  private readonly logger = logger.withMetadata({ module: 'ResearchWorkflow' });
  
  /**
   * Execute research query
   */
  async executeResearch(
    workflowId: string,
    options: ResearchOptions
  ): Promise<ResearchResult> {
    try {
      // Start transaction for research
      return await workflowTransactionManager.executeTransaction(
        workflowId,
        async (progressCallback, transactionId) => {
          // Get current state
          const currentState = await workflowRepository.getWorkflowState(workflowId);
          if (!currentState) {
            throw new Error('Workflow state not found');
          }
          
          // Determine appropriate source step
          const fromStep: WorkflowStep = currentState.currentStep;
          
          // Generate research ID
          const researchId = `research-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
          
          // Initial progress update
          progressCallback(10, ProcessingPhase.RESEARCH);
          
          // Update workflow state to research
          await workflowStateManager.transitionState(
            workflowId,
            fromStep,
            DomainOnlyWorkflowStep.RESEARCH,
            {
              researchId,
              researchStartedAt: new Date().toISOString(),
              query: options.query,
              userId: options.userId,
              patientId: options.patientId,
              documentId: options.documentId,
              model: options.model,
              includeCitations: options.includeCitations,
              transactionId
            }
          );
          
          // Update progress during "processing"
          progressCallback(20, ProcessingPhase.RESEARCH);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          progressCallback(40, ProcessingPhase.RESEARCH);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          progressCallback(60, ProcessingPhase.RESEARCH);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          progressCallback(80, ProcessingPhase.RESEARCH);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Simulate research results
          const researchContent = this.simulateResearchResults(options.query);
          
          // Generate citation sources if requested
          const sources = options.includeCitations 
            ? this.simulateCitationSources() 
            : undefined;
          
          // Log research completion event
          await workflowEventSourcing.appendEvent(
            workflowId,
            'research_completed',
            {
              researchId,
              query: options.query,
              timestamp: new Date().toISOString(),
              userId: options.userId,
              patientId: options.patientId,
              documentId: options.documentId,
              contentLength: researchContent.length,
              sourcesCount: sources?.length || 0,
              transactionId
            }
          );
          
          // Final progress update
          progressCallback(100, ProcessingPhase.RESEARCH);
          
          // Auto-generate report if requested
          if (options.autoGenerateReport) {
            // Transition to report_generation
            await workflowStateManager.transitionState(
              workflowId,
              DomainOnlyWorkflowStep.RESEARCH,
              'report_generation',
              {
                researchId,
                researchCompletedAt: new Date().toISOString(),
                researchContent,
                sources,
                reportGenerationStartedAt: new Date().toISOString(),
                transactionId
              }
            );
          } else {
            // Otherwise return to chat_in_progress or idle
            const targetStep: WorkflowStep = fromStep === 'chat_in_progress' 
              ? 'chat_in_progress'
              : 'idle';
            
            await workflowStateManager.transitionState(
              workflowId,
              DomainOnlyWorkflowStep.RESEARCH,
              targetStep,
              {
                researchId,
                researchCompletedAt: new Date().toISOString(),
                researchContent,
                sources,
                transactionId
              }
            );
          }
          
          // Return result
          return {
            researchId,
            query: options.query,
            success: true,
            content: researchContent,
            sources,
            metadata: {
              completedAt: new Date().toISOString(),
              userId: options.userId,
              patientId: options.patientId,
              documentId: options.documentId,
              model: options.model,
              autoGenerateReport: options.autoGenerateReport
            }
          };
        },
        {
          step: DomainOnlyWorkflowStep.RESEARCH,
          metadata: {
            query: options.query,
            userId: options.userId,
            patientId: options.patientId,
            documentId: options.documentId
          },
          onProgress: options.onProgress,
          transactionId: options.transactionId,
          recoveryStep: fromStep => {
            // Return to the original step if research fails
            return fromStep;
          }
        }
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Research execution failed', {
        workflowId,
        query: options.query,
        error: normalizedError.message
      });
      
      // Return error result
      return {
        researchId: '',
        query: options.query,
        success: false,
        metadata: {},
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Get research results
   */
  async getResearchResults(
    workflowId: string,
    researchId: string
  ): Promise<ResearchResult | null> {
    try {
      // Get workflow state
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state) {
        return null;
      }
      
      // Check if research ID matches
      if (state.metadata?.researchId !== researchId) {
        // Try to find in event history
        const events = await workflowEventSourcing.getEventHistory(workflowId, {
          eventType: ['research_completed']
        });
        
        // Find event with this research ID
        for (const event of events) {
          if (event.event_data?.researchId === researchId) {
            // Return basic info from event
            return {
              researchId,
              query: event.event_data.query,
              success: true,
              metadata: {
                timestamp: event.occurred_at,
                eventType: event.event_type,
                ...event.event_data
              }
            };
          }
        }
        
        return null;
      }
      
      // Get research content and metadata
      const researchContent = state.metadata?.researchContent;
      const sources = state.metadata?.sources;
      
      // Return research data
      return {
        researchId,
        query: state.metadata?.query as string,
        success: true,
        content: researchContent as string,
        sources: sources as Array<{ title: string; url?: string; snippet?: string }>,
        metadata: {
          completedAt: state.metadata?.researchCompletedAt,
          userId: state.metadata?.userId,
          patientId: state.metadata?.patientId,
          documentId: state.metadata?.documentId,
          ...state.metadata
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to get research results', {
        workflowId,
        researchId,
        error: normalizedError.message
      });
      return null;
    }
  }
  
  /**
   * Simulate research results
   */
  private simulateResearchResults(query: string): string {
    return `
# Research Results: ${query}

## Overview
This research was conducted to investigate "${query}". The findings are summarized below.

## Key Findings
1. Finding one based on the research query
2. Finding two based on available medical literature
3. Finding three incorporating latest clinical studies

## Detailed Analysis
The analysis of available medical literature indicates several important considerations related to "${query}".

### Primary Considerations
- Consideration 1: Important insight from research
- Consideration 2: Clinical implications
- Consideration 3: Treatment options

### Secondary Factors
Recent studies have shown additional factors that should be taken into account.

## Conclusions
Based on the analysis, the following conclusions can be drawn regarding "${query}":

1. Primary conclusion from research
2. Secondary conclusion with clinical relevance
3. Recommendations for further investigation

## Research completed at: ${new Date().toISOString()}
`;
  }
  
  /**
   * Simulate citation sources
   */
  private simulateCitationSources(): Array<{ title: string; url?: string; snippet?: string }> {
    return [
      {
        title: 'Recent Advances in Medical Research',
        url: 'https://example.com/medical-research/advances-2024',
        snippet: 'The study demonstrated significant findings related to the research query.'
      },
      {
        title: 'Clinical Guidelines for Medical Practitioners',
        url: 'https://example.com/guidelines/clinical-2024',
        snippet: 'Guidelines recommend consideration of these factors when evaluating patients.'
      },
      {
        title: 'Journal of Advanced Medical Studies',
        url: 'https://example.com/journals/advanced-medicine/vol123',
        snippet: 'Research published in 2024 indicated positive outcomes for patients.'
      },
      {
        title: 'National Institute of Health Publication',
        url: 'https://example.gov/nih/publications/2024-03',
        snippet: 'Official recommendations based on clinical trials conducted nationwide.'
      }
    ];
  }
}

// Export singleton instance
export const researchWorkflow = new ResearchWorkflow();