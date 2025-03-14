/**
 * @fileoverview Progress Tracker
 * 
 * Manages workflow progress tracking and notifications during transaction execution.
 * Provides a consistent way to update progress across all workflow operations.
 */

import logger from '@/lib/logger';
import { workflowService } from '../core/workflow-service';
import type { WorkflowStep, ProcessingPhase } from '@/lib/types/workflow';

/**
 * Options for progress tracking
 */
export interface ProgressTrackerOptions {
  /** Workflow ID */
  workflowId: string;
  
  /** Transaction ID */
  transactionId: string;
  
  /** Current workflow step */
  step: WorkflowStep;
  
  /** Whether to send chat notifications */
  withNotifications?: boolean;
  
  /** Chat ID for notifications */
  chatId?: string;
  
  /** External progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
  
  /** Function to log transaction events */
  logger: (level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) => void;
}

/**
 * Service for tracking and reporting workflow progress
 */
export class ProgressTracker {
  private readonly logger = logger.withMetadata({ module: 'ProgressTracker' });
  private lastProgress = 0;
  private lastPhase?: ProcessingPhase;
  
  constructor(private readonly options: ProgressTrackerOptions) {}
  
  /**
   * Update progress with optional notification
   */
  async updateProgress(progress: number, phase: ProcessingPhase): Promise<void> {
    // Skip duplicate updates
    if (progress === this.lastProgress && phase === this.lastPhase) {
      return;
    }
    
    this.lastProgress = progress;
    this.lastPhase = phase;
    
    // Log significant progress changes
    if (progress % 20 === 0 || progress === 100) {
      this.options.logger('info', `Transaction progress: ${progress}%`, {
        transactionId: this.options.transactionId,
        progress,
        phase: phase.toString()
      });
    }
    
    // Update workflow progress
    try {
      if (this.options.withNotifications && this.options.chatId) {
        // With notification message
        await workflowService.updateWithChatMessage(
          this.options.workflowId,
          this.options.step,
          {
            transactionId: this.options.transactionId,
            progress,
            phase: phase.toString(),
            timestamp: new Date().toISOString()
          },
          `Operation progress: ${progress}% (${phase})`,
          'system',
          {
            type: 'progress_update',
            transactionId: this.options.transactionId,
            progress,
            phase: phase.toString()
          }
        );
      } else {
        // Without notification
        await workflowService.updateProgress(
          this.options.workflowId,
          progress,
          phase,
          this.options.step
        );
      }
    } catch (progressError) {
      this.options.logger('warn', 'Failed to update progress', {
        error: progressError instanceof Error ? progressError.message : String(progressError)
      });
    }
    
    // Call external progress handler if provided
    if (this.options.onProgress) {
      this.options.onProgress(progress, phase);
    }
  }
  
  /**
   * Update completion status
   */
  async updateCompletion(success: boolean = true): Promise<void> {
    const now = new Date().toISOString();
    const finalMetadata = {
      transactionId: this.options.transactionId,
      completedAt: now,
      success,
      progress: 100,
      phase: ProcessingPhase.COMPLETION.toString()
    };
    
    try {
      if (this.options.withNotifications && this.options.chatId) {
        await workflowService.updateWithChatMessage(
          this.options.workflowId,
          this.options.step,
          finalMetadata,
          `Operation ${success ? 'completed successfully' : 'failed'}`,
          'system',
          {
            type: success ? 'transaction_completed' : 'transaction_failed',
            transactionId: this.options.transactionId,
            success
          }
        );
      } else {
        await workflowService.updateWorkflowState(
          this.options.workflowId,
          this.options.step,
          finalMetadata
        );
      }
      
      // Log completion status
      this.options.logger(
        success ? 'info' : 'error',
        `Transaction ${success ? 'completed successfully' : 'failed'}`,
        { transactionId: this.options.transactionId }
      );
      
      // Log completion event
      await workflowService.logWorkflowEvent(
        this.options.workflowId,
        success ? 'transaction_completed' : 'transaction_failed',
        {
          transactionId: this.options.transactionId,
          step: this.options.step,
          timestamp: now,
          success
        }
      );
    } catch (error) {
      this.logger.error('Failed to update completion status', {
        workflowId: this.options.workflowId,
        transactionId: this.options.transactionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Create a progress callback function
   */
  createProgressCallback(): (progress: number, phase: ProcessingPhase) => Promise<void> {
    return this.updateProgress.bind(this);
  }
}

/**
 * Create a progress tracker instance
 */
export function createProgressTracker(options: ProgressTrackerOptions): ProgressTracker {
  return new ProgressTracker(options);
}