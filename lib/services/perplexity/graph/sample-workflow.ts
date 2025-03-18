import { StateGraph } from '@langchain/langgraph'
import { RunnableConfig } from '@langchain/core/runnables'
import logger from '@/lib/logger'
import type { ResearchOptions, ResearchResult } from '@/lib/types/research'
import { PerplexityWorkflowState } from './index'
import {
  researchNode,
  comprehensiveResearchNode,
  medicalDiagnosisNode,
  streamingResearchNode,
  processStreamingResultsNode
} from './index'

/**
 * Error handler node for handling errors in the workflow
 */
async function errorHandlerNode(
  state: PerplexityWorkflowState
) {
  const moduleLogger = logger.withMetadata({
    module: 'ErrorHandlerNode',
  })

  moduleLogger.error('Workflow encountered errors', { 
    errors: state.errors 
  })

  return {
    result: {
      ...state,
      hasError: true,
    }
  }
}

/**
 * Router node for deciding what research type to perform
 */
async function researchRouterNode(
  state: PerplexityWorkflowState
) {
  const researchType = state.options?.researchType || 'standard'
  const isMedical = state.options?.isMedicalDiagnosis === true || !!state.patientData
  
  if (isMedical) {
    return { next: "medical_diagnosis" }
  }
  
  if (researchType === 'comprehensive') {
    return { next: "comprehensive_research" }
  }
  
  if (state.options?.streaming === true) {
    return { next: "streaming_research" }
  }
  
  return { next: "standard_research" }
}

/**
 * Create a research workflow that determines which type of research to perform
 * and handles errors appropriately.
 */
export function createResearchWorkflow() {
  // Create a new workflow builder
  const workflow = new StateGraph<PerplexityWorkflowState>({
    channels: {
      // Define the input/output channels for the workflow
      results: {
        value: [] as ResearchResult[],
      },
      errors: {
        value: [] as string[],
      },
    }
  })
  
  // Add nodes to the workflow
  workflow.addNode("router", researchRouterNode)
  workflow.addNode("standard_research", researchNode)
  workflow.addNode("comprehensive_research", comprehensiveResearchNode)
  workflow.addNode("medical_diagnosis", medicalDiagnosisNode)
  workflow.addNode("streaming_research", streamingResearchNode)
  workflow.addNode("process_streaming", processStreamingResultsNode)
  workflow.addNode("error_handler", errorHandlerNode)
  
  // Define the workflow edges
  workflow.setEntryPoint("router")
  
  // Connect the router to the appropriate research nodes
  workflow.addEdge("router", "standard_research")
  workflow.addConditionalEdges(
    "router",
    (state) => state.next as string,
    {
      "standard_research": "standard_research",
      "comprehensive_research": "comprehensive_research",
      "medical_diagnosis": "medical_diagnosis",
      "streaming_research": "streaming_research",
    }
  )
  
  // Connect the streaming research node to the processing node
  workflow.addEdge("streaming_research", "process_streaming")
  
  // Add conditional edges from each node to either end or error handler
  workflow.addConditionalEdges(
    "standard_research",
    (state) => state.errors && state.errors.length > 0 ? "error_handler" : undefined,
    {}
  )
  
  workflow.addConditionalEdges(
    "comprehensive_research",
    (state) => state.errors && state.errors.length > 0 ? "error_handler" : undefined,
    {}
  )
  
  workflow.addConditionalEdges(
    "medical_diagnosis",
    (state) => state.errors && state.errors.length > 0 ? "error_handler" : undefined,
    {}
  )
  
  workflow.addConditionalEdges(
    "process_streaming",
    (state) => state.errors && state.errors.length > 0 ? "error_handler" : undefined,
    {}
  )
  
  // Compile the workflow
  return workflow.compile()
}

/**
 * Example usage:
 * 
 * const workflow = createResearchWorkflow();
 * 
 * // For standard research
 * const result = await workflow.invoke({
 *   query: "What is the impact of climate change on ocean ecosystems?",
 * });
 * 
 * // For comprehensive research
 * const result = await workflow.invoke({
 *   query: "What is the impact of climate change on ocean ecosystems?",
 *   options: { researchType: "comprehensive" }
 * });
 * 
 * // For medical diagnosis
 * const result = await workflow.invoke({
 *   query: "What might be causing these symptoms?",
 *   patientData: "Patient reports fever, cough, and fatigue for 3 days...",
 * });
 * 
 * // For streaming research
 * const result = await workflow.invoke({
 *   query: "What is the latest research on quantum computing?",
 *   options: { streaming: true }
 * });
 */