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

// Wrap nodes to ensure they return complete WorkflowState objects

// Message processing node wrapper
const messageProcessingNodeWrapper = async (state: WorkflowState) => {
  const result = await messageProcessingNode(state);
  return { ...state, ...result } as WorkflowState;
};

// Extraction node wrapper
const extractionNodeWrapper = async (state: WorkflowState) => {
  return extractionNode(state) as Promise<WorkflowState>;
};

// Analysis node wrapper
const analysisNodeWrapper = async (state: WorkflowState) => {
  const result = await analysisNode(state);
  return { ...state, ...result } as WorkflowState;
};

// Response generation node wrapper
const responseGenerationNodeWrapper = async (state: WorkflowState) => {
  const result = await responseGenerationNode(state);
  return { ...state, ...result } as WorkflowState;
};

// Patient summary generation node wrapper
const patientSummaryGenerationNodeWrapper = async (state: WorkflowState) => {
  const result = await patientSummaryGenerationNode(state);
  return { ...state, ...result } as WorkflowState;
};

// Patient verification node wrapper
const patientVerificationNodeWrapper = async (state: WorkflowState) => {
  const result = await patientVerificationNode(state);
  return { ...state, ...result } as WorkflowState;
};

// Patient correction node wrapper
const patientCorrectionNodeWrapper = async (state: WorkflowState) => {
  const result = await patientCorrectionNode(state);
  return { ...state, ...result } as WorkflowState;
};

// Report generation node wrapper
const reportGenerationNodeWrapper = async (state: WorkflowState) => {
  const result = await reportGenerationNode(state);
  return { ...state, ...result } as WorkflowState;
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
  
  // Add all processing nodes with wrappers to ensure proper return types
  graph.addNode("messageProcessing", messageProcessingNodeWrapper);
  graph.addNode("responseGeneration", responseGenerationNodeWrapper);
  graph.addNode("documentExtraction", extractionNodeWrapper);
  graph.addNode("documentAnalysis", analysisNodeWrapper);
  graph.addNode("patientSummaryGeneration", patientSummaryGenerationNodeWrapper);
  graph.addNode("patientVerification", patientVerificationNodeWrapper);
  graph.addNode("patientCorrection", patientCorrectionNodeWrapper);
  graph.addNode("reportGeneration", reportGenerationNodeWrapper);
  
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