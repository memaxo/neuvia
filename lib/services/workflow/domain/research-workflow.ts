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
import { BaseWorkflowProcessor } from '../base/base-workflow-processor'
import { DomainOnlyWorkflowStep } from '@/lib/types/workflow'
import { Result } from '../error/result'

import type { WorkflowStep, ProcessingPhase, WorkflowState } from '@/lib/types/workflow'
import type { WorkflowProcessOptions } from '../base/base-workflow-processor'

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
export class ResearchWorkflow extends BaseWorkflowProcessor<ResearchOptions, ResearchResult> {
  constructor() {
    super('Research', 'error');
  }
  
  /**
   * Execute research query
   * @returns A Result containing ResearchResult if successful, or error details if failed
   */
  async executeResearch(
    workflowId: string,
    options: ResearchOptions
  ): Promise<Result<ResearchResult>> {
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'RESEARCH_INVALID_INPUT',
        { parameter: 'workflowId' }
      );
    }
    
    if (!options || !options.query || !options.userId) {
      return Result.failure(
        'Research query and user ID are required', 
        'RESEARCH_INVALID_INPUT',
        { 
          missingQuery: !options?.query, 
          missingUserId: !options?.userId
        }
      );
    }
    
    try {
      // Wrap the process call with Result pattern
      const researchResult = await this.process(
        workflowId,
        options,
        {
          targetStep: DomainOnlyWorkflowStep.RESEARCH,
          metadata: {
            query: options.query,
            userId: options.userId,
            patientId: options.patientId,
            documentId: options.documentId,
            model: options.model,
            includeCitations: options.includeCitations,
            autoGenerateReport: options.autoGenerateReport
          },
          onProgress: options.onProgress,
          transactionId: options.transactionId,
          recoveryStep: fromStep => {
            // Return to the original step if research fails
            return fromStep;
          }
        }
      );
      
      return Result.success(researchResult);
    } catch (error) {
      const normalizedError = normalizeError(error);
      logger.error('Research execution failed', {
        workflowId,
        query: options.query,
        userId: options.userId,
        error: normalizedError.message
      });
      
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'RESEARCH_EXECUTION_FAILED',
        {
          workflowId,
          query: options.query,
          userId: options.userId,
          patientId: options.patientId,
          documentId: options.documentId,
          originalError: error
        }
      );
    }
  }
  
  /**
   * Get research results - read-only operation
   * @returns A Result containing ResearchResult if successful, or error details if failed
   */
  async getResearchResults(
    workflowId: string,
    researchId: string
  ): Promise<Result<ResearchResult | null>> {
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'RESEARCH_INVALID_INPUT',
        { parameter: 'workflowId' }
      );
    }
    
    if (!researchId) {
      return Result.failure(
        'Research ID is required',
        'RESEARCH_INVALID_INPUT',
        { parameter: 'researchId' }
      );
    }
  
    try {
      // Get workflow state using Result.fromPromise for error handling
      const stateResult = await Result.fromPromise(
        workflowRepository.getWorkflowState(workflowId)
      );
      
      if (stateResult.isFailure()) {
        return Result.failure(
          `Failed to retrieve workflow state: ${stateResult.error.message}`,
          stateResult.error.code || 'RESEARCH_STATE_RETRIEVAL_FAILED',
          stateResult.error.details
        );
      }
      
      const state = stateResult.value;
      if (!state) {
        return Result.success(null);
      }
      
      // Check if research ID matches
      if (state.metadata?.researchId !== researchId) {
        try {
          // Try to find in event history
          const eventsResult = await Result.fromPromise(
            workflowEventSourcing.getEventHistory(workflowId, {
              eventType: ['research_completed']
            })
          );
          
          if (eventsResult.isFailure()) {
            return Result.failure(
              `Failed to retrieve event history: ${eventsResult.error.message}`,
              eventsResult.error.code || 'RESEARCH_EVENT_RETRIEVAL_FAILED',
              eventsResult.error.details
            );
          }
          
          // Find event with this research ID
          for (const event of eventsResult.value) {
            if (event.event_data?.researchId === researchId) {
              // Return basic info from event
              const researchResult = {
                researchId,
                query: event.event_data.query,
                success: true,
                metadata: {
                  timestamp: event.occurred_at,
                  eventType: event.event_type,
                  ...event.event_data
                }
              };
              return Result.success(researchResult);
            }
          }
          
          // Research ID not found
          return Result.success(null);
        } catch (eventError) {
          logger.error('Error retrieving research event history', {
            workflowId,
            researchId,
            error: eventError instanceof Error ? eventError.message : String(eventError)
          });
          
          return Result.failure(
            'Failed to search event history for research',
            'RESEARCH_EVENT_SEARCH_FAILED',
            { workflowId, researchId, originalError: eventError }
          );
        }
      }
      
      // Get research content and metadata
      const researchContent = state.metadata?.researchContent;
      const sources = state.metadata?.sources;
      
      // Return research data
      const researchResult = {
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
      
      return Result.success(researchResult);
    } catch (err) {
      const normalizedError = normalizeError(err);
      logger.error('Failed to get research results', {
        workflowId,
        researchId,
        error: normalizedError.message
      });
      
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'RESEARCH_RETRIEVAL_FAILED',
        {
          workflowId,
          researchId,
          originalError: err
        }
      );
    }
  }
  
  /**
   * Implementation of required abstract method for domain-specific processing
   */
  protected async doProcess(
    workflowId: string,
    input: ResearchOptions,
    currentState: WorkflowState,
    options: WorkflowProcessOptions & {
      progressCallback?: (progress: number, phase: ProcessingPhase) => void;
    }
  ): Promise<ResearchResult> {
    const { userId, query, patientId, documentId, model, includeCitations, autoGenerateReport } = input;
    const progressCallback = options.progressCallback || (() => {});
    
    // Generate research ID
    const researchId = `research-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    // Initial progress update
    progressCallback(10, ProcessingPhase.RESEARCH);
    
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
    const researchContent = this.simulateResearchResults(query);
    
    // Generate citation sources if requested
    const sources = includeCitations
      ? this.simulateCitationSources()
      : undefined;
    
    // Log research completion event
    await this.logEvent(
      workflowId,
      'research_completed',
      {
        researchId,
        query,
        timestamp: new Date().toISOString(),
        userId,
        patientId,
        documentId,
        contentLength: researchContent.length,
        sourcesCount: sources?.length || 0,
        transactionId: options.transactionId
      }
    );
    
    // Auto-generate report if requested
    if (autoGenerateReport) {
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
          transactionId: options.transactionId
        }
      );
    } else {
      // Otherwise return to chat_in_progress or idle
      const targetStep: WorkflowStep = currentState.currentStep === 'chat_in_progress'
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
          transactionId: options.transactionId
        }
      );
    }
    
    // Final progress update
    progressCallback(100, ProcessingPhase.RESEARCH);
    
    // Return result
    return {
      researchId,
      query,
      success: true,
      content: researchContent,
      sources,
      metadata: {
        completedAt: new Date().toISOString(),
        userId,
        patientId,
        documentId,
        model,
        autoGenerateReport
      }
    };
  }
  
  /**
   * Implementation of required abstract method for domain-specific error handling
   * @deprecated Use Result pattern instead with Result.failure()
   */
  protected createErrorResult(
    error: ApplicationError,
    input: ResearchOptions
  ): ResearchResult {
    logger.warn(
      'createErrorResult is deprecated. Use Result.failure() instead.',
      { method: 'ResearchWorkflow.createErrorResult' }
    );
    
    return {
      researchId: '',
      query: input.query,
      success: false,
      metadata: {
        error: error.message,
        code: error.code || 'RESEARCH_ERROR',
        userId: input.userId,
        patientId: input.patientId,
        documentId: input.documentId
      },
      error: error.message
    };
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