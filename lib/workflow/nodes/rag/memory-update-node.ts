import { ragMemoryService } from '@/lib/services/rag/memory/rag-memory-service'
import { RAGMemoryError } from '@/lib/services/rag/error/rag-errors'
import type { WorkflowState } from '@/workflow/state/workflow-state'
import type { ConversationContext } from '@/lib/types/rag'

/**
 * LangGraph node for updating the RAG memory
 * 
 * This node handles pruning and optimizing the conversation memory
 * to keep it within token limits and ensure high quality context.
 * 
 * @param state Current workflow state
 * @returns Partial state update with memory status
 */
export const memoryUpdateNode = async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
  // Get the chat ID from state
  const chatId = state.chatId
  
  // Skip if no chat ID
  if (!chatId) {
    return {
      memoryStatus: 'skipped',
      memoryTimestamp: new Date().toISOString()
    }
  }
  
  try {
    // Get current context
    const conversationContext = await ragMemoryService.retrieveConversationContext(chatId)
    
    // Skip if no context
    if (!conversationContext) {
      return {
        memoryStatus: 'skipped',
        memoryTimestamp: new Date().toISOString()
      }
    }
    
    // Prune context if needed
    const messageCount = conversationContext.messages?.length || 0
    const chunkCount = conversationContext.recentChunks?.length || 0
    
    // Only prune if we have a lot of context
    const shouldPrune = messageCount > 10 || chunkCount > 5
    
    if (shouldPrune) {
      // Prune context to manage token usage
      const prunedContext = await ragMemoryService.pruneConversationContext(
        chatId,
        state.maxMemoryTokens || 4000
      )
      
      return {
        memoryStatus: 'pruned',
        memoryTimestamp: new Date().toISOString(),
        memoryStats: {
          messageCount: prunedContext.messages?.length || 0,
          chunkCount: prunedContext.recentChunks?.length || 0,
          sourceCount: prunedContext.recentSources?.length || 0
        }
      }
    }
    
    // No pruning needed
    return {
      memoryStatus: 'unchanged',
      memoryTimestamp: new Date().toISOString(),
      memoryStats: {
        messageCount: conversationContext.messages?.length || 0,
        chunkCount: conversationContext.recentChunks?.length || 0,
        sourceCount: conversationContext.recentSources?.length || 0
      }
    }
  } catch (error) {
    // If error occurred, update state with error information
    return {
      memoryStatus: 'error',
      memoryError: error instanceof Error ? error.message : String(error),
      memoryTimestamp: new Date().toISOString()
    }
  }
}