import { StateGraph, Annotation, START, END } from '@langchain/langgraph'
import type { WorkflowState } from '../state/workflow-state'
import { documentIndexingNode } from '../nodes/rag/document-indexing-node'
import { contextRetrievalNode } from '../nodes/rag/context-retrieval-node'
import { responseGenerationNode } from '../nodes/rag/response-generation-node'
import { sourceAttributionNode } from '../nodes/rag/source-attribution-node'
import { memoryUpdateNode } from '../nodes/rag/memory-update-node'
import type { SupabaseCheckpointer } from '../checkpointer/supabase-checkpointer'

// Define an annotation for the RAG workflow state based on WorkflowState
const RAGWorkflowAnnotation = Annotation.Root({
  // For simple identifier strings, replacement is appropriate
  threadId: Annotation<string>({ value: (_curr, upd) => upd }),
  chatId: Annotation<string>({ value: (_curr, upd) => upd }),
  documentId: Annotation<string>({ value: (_curr, upd) => upd }),
  
  // For actions, replacement is appropriate
  action: Annotation<string>({ value: (_curr, upd) => upd }),
  
  // For document processing status, merge existing data with updates
  documentProcessing: Annotation<Record<string, any> | null>({ 
    value: (curr, upd) => {
      if (upd === null) return null;
      if (curr) return { ...curr, ...upd };
      return upd;
    },
    default: () => null 
  }),
  
  // For current message, replacement is appropriate
  currentMessage: Annotation<{ content: string; role: string } | null>({
    value: (_curr, upd) => upd,
    default: () => null
  }),
  
  // For assistant response, merge existing data with updates
  assistantResponse: Annotation<Record<string, any> | null>({
    value: (curr, upd) => {
      if (upd === null) return null;
      if (curr) return { ...curr, ...upd };
      return upd;
    },
    default: () => null
  }),
  
  // For response status, replacement is appropriate
  responseStatus: Annotation<string>({ value: (_curr, upd) => upd }),
  
  // Adding explicit support for interaction history to accumulate instead of replace
  interactionHistory: Annotation<any[]>({
    value: (curr, upd) => [...(curr || []), ...upd],
    default: () => []
  }),
  
  // For error handling
  error: Annotation<Record<string, any> | null>({ 
    value: (curr, upd) => {
      if (upd === null) return null;
      if (curr) return { ...curr, ...upd };
      return upd;
    },
    default: () => null 
  }),
});

/**
 * Create a RAG workflow for document indexing and chat
 * 
 * This workflow handles the entire RAG process from document indexing
 * to retrieving context, generating responses, and managing conversation memory.
 * 
 * @param checkpointer Optional Supabase checkpointer for state persistence
 * @returns Compiled LangGraph workflow
 */
export const createRAGWorkflow = (checkpointer?: SupabaseCheckpointer) => {
  // Create workflow graph using the annotation and cast to allow arbitrary node names
  const graph = new StateGraph(RAGWorkflowAnnotation) as unknown as StateGraph<WorkflowState, WorkflowState, WorkflowState, string>;
  
  // Add nodes to the graph
  graph.addNode("documentIndexing", documentIndexingNode);
  graph.addNode("contextRetrieval", contextRetrievalNode);
  graph.addNode("responseGeneration", responseGenerationNode);
  graph.addNode("sourceAttribution", sourceAttributionNode);
  graph.addNode("memoryUpdate", memoryUpdateNode);
  
  // Add conditional edge from START to determine entry point
  graph.addConditionalEdges(
    START,
    (state: WorkflowState) => {
      // Check state to determine which node to start with
      if (state.action === 'index_document' && state.documentId) {
        return 'documentIndexing';
      }
      
      if (state.action === 'chat' && state.currentMessage?.content) {
        return 'contextRetrieval';
      }
      
      // Default to retrieval for most cases
      return 'contextRetrieval';
    }
  );
  
  // Add edges for RAG interaction flow
  graph.addEdge('contextRetrieval', 'responseGeneration');
  graph.addEdge('responseGeneration', 'sourceAttribution');
  graph.addEdge('sourceAttribution', 'memoryUpdate');
  graph.addEdge('memoryUpdate', END);
  graph.addEdge('documentIndexing', END);
  
  // Define END node that processes the final state
  graph.addNode(END, async (state: WorkflowState) => {
    // Using console.log intentionally for workflow completion logging
    console.log(`RAG workflow completed for thread: ${state.threadId}`);
    return state;
  });
  
  // Compile the graph with checkpointer
  return graph.compile({
    checkpointer: checkpointer as any // Cast for backward compatibility
  });
}

/**
 * Create a document indexing workflow
 * 
 * This simplified workflow focuses only on document indexing
 * for batch processing of documents.
 * 
 * @param checkpointer Optional Supabase checkpointer for state persistence
 * @returns Compiled LangGraph workflow for document indexing
 */
export const createDocumentIndexingWorkflow = (checkpointer?: SupabaseCheckpointer) => {
  // Create workflow graph using the annotation and cast to allow arbitrary node names
  const graph = new StateGraph(RAGWorkflowAnnotation) as unknown as StateGraph<WorkflowState, WorkflowState, WorkflowState, string>;
  
  // Add nodes to the graph
  graph.addNode("documentIndexing", documentIndexingNode);
  
  // Add edges
  graph.addEdge(START, "documentIndexing");
  graph.addEdge("documentIndexing", END);
  
  // Define END node that processes the final state
  graph.addNode(END, async (state: WorkflowState) => {
    // Using console.log intentionally for workflow completion logging
    console.log(`Document indexing completed for document: ${state.documentId}`);
    
    // Return final state with structured result
    return {
      ...state,
      documentIndexingComplete: state.documentProcessing?.indexingComplete === true,
      status: state.documentProcessing?.indexingStatus || 'unknown',
      error: state.documentProcessing?.indexingError
    };
  });
  
  // Compile the graph
  return graph.compile({
    checkpointer: checkpointer as any // Cast for backward compatibility
  });
}

/**
 * Create a chat-only RAG workflow
 * 
 * This workflow focuses only on the chat interaction part of RAG,
 * assuming documents are already indexed.
 * 
 * @param checkpointer Optional Supabase checkpointer for state persistence
 * @returns Compiled LangGraph workflow for RAG chat
 */
export const createRAGChatWorkflow = (checkpointer?: SupabaseCheckpointer) => {
  // Create workflow graph using the annotation and cast to allow arbitrary node names
  const graph = new StateGraph(RAGWorkflowAnnotation) as unknown as StateGraph<WorkflowState, WorkflowState, WorkflowState, string>;
  
  // Add nodes to the graph
  graph.addNode("contextRetrieval", contextRetrievalNode);
  graph.addNode("responseGeneration", responseGenerationNode);
  graph.addNode("sourceAttribution", sourceAttributionNode);
  graph.addNode("memoryUpdate", memoryUpdateNode);
  
  // Add edges
  graph.addEdge(START, "contextRetrieval");
  graph.addEdge("contextRetrieval", "responseGeneration");
  graph.addEdge("responseGeneration", "sourceAttribution");
  graph.addEdge("sourceAttribution", "memoryUpdate");
  graph.addEdge("memoryUpdate", END);
  
  // Define END node that processes the final state
  graph.addNode(END, async (state: WorkflowState) => {
    // Using console.log intentionally for workflow completion logging
    console.log(`RAG chat completed for chat: ${state.chatId}`);
    
    // Return final state with structured result
    return {
      ...state,
      response: state.assistantResponse?.content,
      sources: state.assistantResponse?.sources,
      status: state.responseStatus || 'unknown',
      error: state.assistantResponse?.error
    };
  });
  
  // Compile the graph
  return graph.compile({
    checkpointer: checkpointer as any // Cast for backward compatibility
  });
}