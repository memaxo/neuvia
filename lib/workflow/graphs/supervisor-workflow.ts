// lib/workflow/graphs/supervisor-workflow.ts
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import type { WorkflowState } from '../state/workflow-state';
import { VerificationStatus } from '@/lib/types/verification';
import { ProcessingPhase, WorkflowSteps } from '@/lib/types/workflow';

// Import all sub-agent nodes
import messageProcessingNode from '../nodes/chat/message-processing-node';
import { responseGenerationNode } from '../nodes/chat/response-generation-node';
import extractionNode from '../nodes/extraction-node';
import analysisNode from '../nodes/analysis-node';
import patientSummaryGenerationNode from '../nodes/patient/summary-generation-node';
import patientVerificationNode from '../nodes/patient/verification-node';
import patientCorrectionNode from '../nodes/patient/correction-node';
import reportGenerationNode from '../nodes/patient/report-generation-node';

// Define an annotation for the supervisor workflow state
const SupervisorWorkflowAnnotation = Annotation.Root({
  // Core identifiers
  threadId: Annotation<string>({ value: (_curr, upd) => upd }),
  patientId: Annotation<string>({ value: (_curr, upd) => upd }),
  userId: Annotation<string>({ value: (_curr, upd) => upd }),
  
  // Error handling
  error: Annotation<Record<string, any> | null>({ 
    value: (curr, upd) => {
      if (upd === null) return null;
      if (curr) return { ...curr, ...upd };
      return upd;
    },
    default: () => null 
  }),
  
  // Workflow control flags
  needsCorrection: Annotation<boolean>({ value: (_curr, upd) => upd, default: () => false }),
  readyForReport: Annotation<boolean>({ value: (_curr, upd) => upd, default: () => false }),
  
  // Context for decision making
  context: Annotation<Record<string, any> | null>({
    value: (curr, upd) => {
      if (upd === null) return null;
      if (curr) return { ...curr, ...upd };
      return upd;
    },
    default: () => null 
  }),
  
  // Verification data
  verification: Annotation<Record<string, any> | null>({ 
    value: (curr, upd) => {
      if (upd === null) return null;
      if (curr) return { ...curr, ...upd };
      return upd;
    },
    default: () => null 
  }),
  
  // Interaction history
  interactionHistory: Annotation<any[]>({
    value: (curr, upd) => [...(curr || []), ...upd],
    default: () => []
  })
});

// Wrap extractionNode to match expected Runnable signature
const extractionNodeWrapper = async (state: WorkflowState, config?: any) => {
  return extractionNode(state, config) as Promise<WorkflowState>;
};

/**
 * Creates a supervisor workflow for processing documents and patient data
 * 
 * This workflow orchestrates the processing of medical documents and patient data,
 * including extraction, analysis, verification, and report generation.
 * 
 * @param checkpointer - Checkpointer for persisting state
 * @returns Compiled state graph workflow
 */
export function createSupervisorWorkflow(checkpointer: any) {
  // Create workflow graph using the annotation and cast to allow arbitrary node names
  const graph = new StateGraph(SupervisorWorkflowAnnotation) as unknown as StateGraph<WorkflowState, WorkflowState, WorkflowState, string>;
  
  // Add all processing nodes
  graph.addNode("messageProcessing", messageProcessingNode);
  graph.addNode("responseGeneration", responseGenerationNode);
  graph.addNode("documentExtraction", extractionNodeWrapper);
  graph.addNode("documentAnalysis", analysisNode);
  graph.addNode("patientSummaryGeneration", patientSummaryGenerationNode);
  graph.addNode("patientVerification", patientVerificationNode);
  graph.addNode("patientCorrection", patientCorrectionNode);
  graph.addNode("reportGeneration", reportGenerationNode);
  
  // Define the END node that completes the workflow
  graph.addNode(END, async (state: WorkflowState) => {
    return {
      ...state,
      status: state.error ? 'error' : 'completed',
      completedAt: new Date().toISOString()
    };
  });
  
  // Start with message processing
  graph.addEdge(START, "messageProcessing");
  
  // Add conditional routing based on message intent
  graph.addConditionalEdges(
    "messageProcessing",
    (state: WorkflowState) => {
      // Extract intent from the state context
      const intent = state.context?.lastIntent || 'general_chat';
      
      // Route to appropriate node based on intent
      switch (intent) {
        case 'document_extraction': 
          return "documentExtraction";
        case 'verification': 
          return "patientVerification";
        case 'correction': 
          return "patientCorrection";
        case 'report_generation': 
          return "reportGeneration";
        default: 
          return "responseGeneration";
      }
    }
  );
  
  // Define document processing flow
  graph.addEdge("documentExtraction", "documentAnalysis");
  graph.addEdge("documentAnalysis", "patientSummaryGeneration");
  graph.addEdge("patientSummaryGeneration", "responseGeneration");
  
  // Define verification flow with conditional edges
  graph.addConditionalEdges(
    "patientVerification",
    (state: WorkflowState) => {
      // If corrections needed, go to correction node
      if (state.needsCorrection) {
        return "patientCorrection";
      }
      
      // If verification complete and report ready, generate report
      if (state.verification?.status === VerificationStatus.completed && 
          state.readyForReport) {
        return "reportGeneration";
      }
      
      // Otherwise, generate a response
      return "responseGeneration";
    }
  );
  
  // After correction, determine next step
  graph.addConditionalEdges(
    "patientCorrection",
    (state: WorkflowState) => {
      // If still in verification process, return to verification
      return state.verification?.status === "in_progress"
        ? "patientVerification" 
        : "responseGeneration";
    }
  );
  
  // Report generation leads to response
  graph.addEdge("reportGeneration", "responseGeneration");
  
  // All responses lead to the end node
  graph.addEdge("responseGeneration", END);
  
  // Compile the graph with checkpointer
  return graph.compile({
    checkpointer: checkpointer as any // Cast for backward compatibility
  });
}