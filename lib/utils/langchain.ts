import type {
  WorkflowContext,
  WorkflowStep,
} from '@/lib/processing/types/workflow'
import { workflowManager } from '@/lib/utils/workflow-manager'
import type { WorkflowOptions } from '@/lib/utils/workflow-manager'
/**
 * Langchain Workflow Integration Utilities
 *
 * Helper functions for integrating Langchain with our workflow manager
 */
import { BaseCallbackHandler } from '@langchain/core/callbacks/base'

/**
 * Workflow callback handler that integrates with our workflow manager
 */
class WorkflowCallbackHandler extends BaseCallbackHandler {
  name = 'WorkflowCallbackHandler'

  constructor(
    private readonly workflowContext: WorkflowContext,
    private readonly onProgress?: (progress: number) => void
  ) {
    super()
  }

  async handleLLMStart(): Promise<void> {
    this.reportProgress(10)
  }

  async handleLLMEnd(): Promise<void> {
    this.reportProgress(100)
  }

  async handleLLMError(err: Error): Promise<void> {
    workflowManager.reportError({ onError: (msg) => console.error(msg) }, err)
  }

  async handleChainStart(): Promise<void> {
    this.reportProgress(5)
  }

  async handleChainEnd(): Promise<void> {
    this.reportProgress(95)
  }

  async handleChainError(err: Error): Promise<void> {
    workflowManager.reportError({ onError: (msg) => console.error(msg) }, err)
  }

  async handleToolStart(): Promise<void> {
    this.reportProgress(30)
  }

  async handleToolEnd(): Promise<void> {
    this.reportProgress(70)
  }

  async handleToolError(err: Error): Promise<void> {
    workflowManager.reportError({ onError: (msg) => console.error(msg) }, err)
  }

  /**
   * Helper method to report progress
   */
  private reportProgress(progress: number): void {
    // Only include onProgress in options if it exists
    const options = this.onProgress ? { onProgress: this.onProgress } : {}

    workflowManager.reportProgress(options, this.workflowContext.step, progress)
  }
}

/**
 * Create Langchain callbacks that report progress to our workflow manager
 */
export function createWorkflowCallbacks(
  workflowId: string | null,
  step: WorkflowStep,
  options?: {
    onProgress?: (progress: number) => void
    stepDescription?: string
  }
): BaseCallbackHandler[] {
  // Create a workflow context for consistent handling
  const workflowContext = workflowManager.createWorkflowContext(
    workflowId,
    step,
    options?.stepDescription
  )

  return [new WorkflowCallbackHandler(workflowContext, options?.onProgress)]
}

/**
 * Run a Langchain operation within our workflow manager
 */
export async function runWithWorkflow<T>(
  workflowStep: WorkflowStep,
  operation: () => Promise<T>,
  options?: WorkflowOptions<T> & { workflowId?: string | null }
): Promise<T> {
  // Extract workflowId and create clean options
  const { workflowId, ...cleanOptions } = options || {}

  return workflowManager.handleWorkflowOperation<T>(
    workflowId || null,
    workflowStep,
    operation,
    cleanOptions
  )
}
