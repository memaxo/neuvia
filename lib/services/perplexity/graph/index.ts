/**
 * @file LangGraph Nodes Entry Point
 * 
 * This file exports all perplexity-related LangGraph nodes for easy integration
 * with LangGraph workflows.
 */

// Export research nodes
export {
  researchNode,
  comprehensiveResearchNode,
  literatureReviewNode
} from './research-node'

// Export medical nodes
export {
  medicalDiagnosisNode,
  patientRecordsAnalysisNode
} from './medical-node'

// Export streaming nodes
export {
  streamingResearchNode,
  processStreamingResultsNode
} from './streaming-node'

// Export common workflow integration type
export interface PerplexityWorkflowState {
  // Input fields
  query?: string;
  patientData?: string;
  analysisPrompt?: string;
  
  // Configuration
  options?: any;
  config?: any;
  
  // Results
  results?: any[];
  streamingResults?: ReadableStream<any>;
  
  // Error handling
  errors?: string[];
  hasError?: boolean;
}