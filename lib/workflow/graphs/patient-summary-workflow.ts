// workflow/graphs/patient-summary-workflow.ts

import { StateGraph, Annotation, START, END } from '@langchain/langgraph'
import type { WorkflowState, WorkflowError, WorkflowInteraction } from '../state/workflow-state'
import { VerificationStatus } from '@/lib/types/verification'

// Fix import statements to handle default imports correctly
import extractionNode from '../nodes/extraction-node'
import analysisNode from '../nodes/analysis-node'
import patientSummaryGenerationNode from '../nodes/patient/summary-generation-node'
import patientVerificationNode from '../nodes/patient/verification-node'
import patientCorrectionNode from '../nodes/patient/correction-node'
import reportGenerationNode from '../nodes/patient/report-generation-node'

// Import checkpointer for state persistence (optional)
import type { SupabaseCheckpointer } from '../checkpointer/supabase-checkpointer'
// Remove unused import
// import type { LangGraphRunnableConfig } from '@langchain/langgraph'

// Define an annotation for the patient summary workflow state based on WorkflowState with optimized merging strategies
const PatientSummaryAnnotation = Annotation.Root({
  // For simple identifier strings, replacement is appropriate
  threadId: Annotation<string>({ value: (_curr, upd) => upd }),
  patientId: Annotation<string>({ value: (_curr, upd) => upd }),
  
  // For complex error objects, merge to preserve context when partial updates occur
  error: Annotation<WorkflowError | null>({ 
    value: (curr, upd) => {
      if (upd === null) return null;
      // If there's already an error, preserve its data and merge with updates
      if (curr) return { ...curr, ...upd };
      // Otherwise use the new error
      return upd;
    },
    default: () => null 
  }),
  
  // For verification data, merge existing data with updates to preserve verification history
  verification: Annotation<{ status: string } | null>({ 
    value: (curr, upd) => {
      if (upd === null) return null;
      // If there's existing verification data, merge it with updates
      if (curr) return { ...curr, ...upd };
      // Otherwise use the new verification data
      return upd;
    },
    default: () => null 
  }),
  
  // For simple boolean flags, replacement is typically fine
  needsCorrection: Annotation<boolean>({ value: (_curr, upd) => upd, default: () => false }),
  readyForReport: Annotation<boolean>({ value: (_curr, upd) => upd, default: () => false }),
  
  // Adding explicit support for interaction history to accumulate instead of replace
  interactionHistory: Annotation<WorkflowInteraction[]>({
    value: (curr, upd) => [...(curr || []), ...upd],
    default: () => []
  }),
  
  // Adding support for progress tracking with proper merging
  progress: Annotation<{ currentStep: string; percentage: number; phase: string; isCompleted: boolean } | null>({
    value: (curr, upd) => {
      if (upd === null) return null;
      // If there's existing progress data, merge it with updates
      if (curr) return { ...curr, ...upd };
      // Otherwise use the new progress data
      return upd;
    },
    default: () => null
  })
});

// Wrap nodes to match expected Runnable signature

// Extraction node wrapper (already defined)
const extractionNodeWrapper = async (state: WorkflowState) => {
  return extractionNode(state) as Promise<WorkflowState>;
};

// Analysis node wrapper
const analysisNodeWrapper = async (state: WorkflowState) => {
  const result = await analysisNode(state);
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
 * Create a patient summary workflow
 * 
 * This workflow orchestrates the complete process from document extraction
 * to patient summary generation, verification, and report creation.
 * 
 * @param checkpointer Optional Supabase checkpointer for state persistence
 * @returns Compiled LangGraph workflow
 */
export const createPatientSummaryWorkflow = (checkpointer?: SupabaseCheckpointer) => {
  // Create workflow graph using the annotation and cast to allow arbitrary node names
  const graph = new StateGraph(PatientSummaryAnnotation) as unknown as StateGraph<WorkflowState, WorkflowState, WorkflowState, string>;
  
  // Add nodes to the graph with wrappers to ensure proper return types
  graph.addNode("documentExtraction", extractionNodeWrapper);
  graph.addNode("documentAnalysis", analysisNodeWrapper);
  graph.addNode("patientSummaryGeneration", patientSummaryGenerationNodeWrapper);
  graph.addNode("patientVerification", patientVerificationNodeWrapper);
  graph.addNode("patientCorrection", patientCorrectionNodeWrapper);
  graph.addNode("reportGeneration", reportGenerationNodeWrapper);
  
  // Set up the workflow graph edges
  graph.addEdge(START, "documentExtraction");
  graph.addEdge("documentExtraction", "documentAnalysis");
  graph.addEdge("documentAnalysis", "patientSummaryGeneration");
  
  // Add conditional edges with proper error handling
  graph.addConditionalEdges("patientSummaryGeneration", (state: WorkflowState) => {
    if (state.error !== undefined && state.error !== null) {
      return END;
    }
    return "patientVerification";
  });
  
  graph.addConditionalEdges("patientVerification", (state: WorkflowState) => {
    if (state.needsCorrection === true) {
      return "patientCorrection";
    }
    if (state.verification?.status === VerificationStatus.completed && state.readyForReport === true) {
      return "reportGeneration";
    }
    if (state.error !== undefined && state.error !== null) {
      return END;
    }
    return "patientVerification";
  });
  
  // After correction, go back to verification
  graph.addEdge("patientCorrection", "patientVerification");
  
  // After report generation, end the workflow
  graph.addConditionalEdges("reportGeneration", () => END);
  
  // Define END node that processes the final state
  graph.addNode(END, async (state: WorkflowState) => {
    // Using console.log intentionally for workflow completion logging
    console.log(`Workflow completed for patient: ${state.patientId}`);
    return state;
  });
  
  // Compile the graph with checkpointer
  return graph.compile({
    checkpointer: checkpointer as any // Maintain existing casting for backward compatibility
  });
};

/**
 * Create a simplified workflow for just summary generation and verification
 * 
 * This workflow assumes documents are already extracted and analyzed.
 * Useful for cases where processing happens separately.
 * 
 * @param checkpointer Optional Supabase checkpointer for state persistence
 * @returns Compiled LangGraph workflow
 */
export const createSummaryVerificationWorkflow = (checkpointer?: SupabaseCheckpointer) => {
  // Create workflow graph using the annotation and cast to allow arbitrary node names
  const graph = new StateGraph(PatientSummaryAnnotation) as unknown as StateGraph<WorkflowState, WorkflowState, WorkflowState, string>;
  
  // Add only the necessary nodes, with wrappers to ensure proper return types
  graph.addNode("patientSummaryGeneration", patientSummaryGenerationNodeWrapper);
  graph.addNode("patientVerification", patientVerificationNodeWrapper);
  graph.addNode("patientCorrection", patientCorrectionNodeWrapper);
  
  // Add edges
  graph.addEdge(START, "patientSummaryGeneration");
  graph.addEdge("patientSummaryGeneration", "patientVerification");
  
  // Add conditional edges for verification loop with proper error handling
  graph.addConditionalEdges("patientVerification", (state: WorkflowState) => {
    if (state.needsCorrection === true) {
      return "patientCorrection";
    }
    if (state.verification?.status === VerificationStatus.completed) {
      return END;
    }
    return "patientVerification";
  });
  
  // After correction, go back to verification
  graph.addEdge("patientCorrection", "patientVerification");
  
  // Define END node that processes the final state
  graph.addNode(END, async (state: WorkflowState) => {
    // Using console.log intentionally for workflow completion logging
    console.log(`Verification completed for patient: ${state.patientId}`);
    return state;
  });
  
  // Compile the graph
  return graph.compile({
    checkpointer: checkpointer as any // Maintain existing casting for backward compatibility
  });
};

/**
 * Create a workflow for document-to-report generation
 * 
 * This workflow handles the complete process from document upload
 * to report generation without requiring verification.
 * Useful for batch processing.
 * 
 * @param checkpointer Optional Supabase checkpointer for state persistence
 * @returns Compiled LangGraph workflow
 */
export const createDocumentToReportWorkflow = (checkpointer?: SupabaseCheckpointer) => {
  // Create workflow graph using the annotation and cast to allow arbitrary node names
  const graph = new StateGraph(PatientSummaryAnnotation) as unknown as StateGraph<WorkflowState, WorkflowState, WorkflowState, string>;
  
  // Add nodes to the graph with wrappers to ensure proper return types
  graph.addNode("documentExtraction", extractionNodeWrapper);
  graph.addNode("documentAnalysis", analysisNodeWrapper);
  graph.addNode("patientSummaryGeneration", patientSummaryGenerationNodeWrapper);
  graph.addNode("reportGeneration", reportGenerationNodeWrapper);
  
  // Add sequential path
  graph.addEdge(START, "documentExtraction");
  graph.addEdge("documentExtraction", "documentAnalysis");
  graph.addEdge("documentAnalysis", "patientSummaryGeneration");
  graph.addEdge("patientSummaryGeneration", "reportGeneration");
  graph.addEdge("reportGeneration", END);
  
  // Define END node that processes the final state
  graph.addNode(END, async (state: WorkflowState) => {
    // Using console.log intentionally for workflow completion logging
    console.log(`Report generated for patient: ${state.patientId}`);
    return state;
  });
  
  // Compile the graph
  return graph.compile({
    checkpointer: checkpointer as any // Maintain existing casting for backward compatibility
  });
};

// Export the workflow creation functions
export default createPatientSummaryWorkflow;