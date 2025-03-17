import { langChainCore } from '@/lib/langchain/core'
import { ragMemoryService } from '@/lib/services/rag/memory/rag-memory-service'
import { RAGError } from '@/lib/services/rag/error/rag-errors'
import type { WorkflowState } from '@/workflow/state/workflow-state'
import { withRetry } from '@/lib/utils/retry'

/**
 * LangGraph node for generating responses using RAG context
 * 
 * This node uses the retrieved context along with the user query
 * to generate an AI response with citations.
 * 
 * @param state Current workflow state
 * @returns Partial state update with generated response
 */
export const responseGenerationNode = async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
  // Get necessary state
  const messageContent = state.currentMessage?.content
  const ragContext = state.ragContext
  const chatId = state.chatId
  
  if (!messageContent) {
    throw new RAGError('Message content required for response generation')
  }
  
  if (!ragContext || !ragContext.retrievedChunks || ragContext.retrievedChunks.length === 0) {
    // No context found, generate response without context
    return await generateResponseWithoutContext(state)
  }
  
  try {
    // Prepare context for prompt
    const context = ragContext.retrievedChunks
      .map((chunk, index) => {
        return `[${index + 1}] ${chunk.content}\nSource: ${
          ragContext.sources.find(s => s.documentId === chunk.documentId)?.title || 'Unknown source'
        }`
      })
      .join('\n\n')
    
    // Retrieve conversation history if available
    let conversationContext = null
    if (chatId) {
      conversationContext = await ragMemoryService.retrieveConversationContext(chatId)
    }
    
    // Prepare conversation history for prompt
    const conversationHistory = conversationContext?.messages
      ? conversationContext.messages
        .slice(-5) // Use last 5 messages only
        .map(msg => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
        .join('\n\n')
      : ''
    
    // Create the prompt
    const prompt = `
    ${conversationHistory ? `Previous messages:\n${conversationHistory}\n\n` : ''}
    
    I'll provide you with some context information relevant to a question, and I'd like you to use this information to provide a thoughtful, accurate response. 
    
    Context information:
    ${context}
    
    Question: ${messageContent}
    
    Instructions:
    1. Analyze the context information carefully
    2. Provide a comprehensive answer addressing the question directly
    3. Only use information from the provided context
    4. If the context doesn't contain enough information to answer fully, acknowledge that
    5. Format your response in Markdown
    6. When using information from a specific source, add citation numbers like [1], [2], etc.
    7. Include a "Sources" section at the end that lists the cited sources
    
    Your answer:
    `
    
    // Generate response
    const chatModel = langChainCore.createGeminiChat({
      modelName: 'gemini-pro',
      maxOutputTokens: 4096,
      temperature: 0.3
    })
    
    const response = await withRetry(
      () => chatModel.invoke(prompt),
      {
        maxRetries: 3,
        baseDelay: 1000
      }
    )
    
    // Extract sources from the response
    const sources = ragContext.sources.map(source => ({
      title: source.title,
      documentId: source.documentId,
      url: source.url
    }))
    
    // Update conversation context if chat ID available
    if (chatId) {
      // Store the current messages in context
      const newMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      }
      
      const userMessage = {
        role: 'user',
        content: messageContent,
        timestamp: new Date().toISOString()
      }
      
      // Get or create context
      const context = conversationContext || {
        chatId,
        messages: [],
        recentChunks: [],
        recentSources: []
      }
      
      // Update context
      const updatedContext = {
        ...context,
        messages: [...context.messages, userMessage, newMessage],
        recentChunks: ragContext.retrievedChunks,
        recentSources: sources
      }
      
      // Store updated context
      await ragMemoryService.storeConversationContext(chatId, updatedContext)
    }
    
    // Return updated state with the response
    return {
      responseStatus: 'completed',
      assistantResponse: {
        content: response,
        sources,
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    // If error occurred, update state with error information
    return {
      responseStatus: 'error',
      assistantResponse: {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    }
  }
}

/**
 * Generate a response when no context is available
 * 
 * @param state Current workflow state
 * @returns Partial state update with generated response
 */
async function generateResponseWithoutContext(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const messageContent = state.currentMessage?.content
  const chatId = state.chatId
  
  try {
    // Retrieve conversation history if available
    let conversationContext = null
    if (chatId) {
      conversationContext = await ragMemoryService.retrieveConversationContext(chatId)
    }
    
    // Prepare conversation history for prompt
    const conversationHistory = conversationContext?.messages
      ? conversationContext.messages
        .slice(-5) // Use last 5 messages only
        .map(msg => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
        .join('\n\n')
      : ''
    
    // Create the prompt for no-context scenario
    const prompt = `
    ${conversationHistory ? `Previous messages:\n${conversationHistory}\n\n` : ''}
    
    I'll respond to your question based on my general knowledge, but please note I don't have access to specific documents or patient records unless they're provided to me.
    
    Question: ${messageContent}
    
    Instructions:
    1. Provide a helpful response based on general medical knowledge
    2. Be clear about limitations if specific information would be needed
    3. Format your response in Markdown
    4. Keep the response focused on the question
    
    Your answer:
    `
    
    // Generate response
    const chatModel = langChainCore.createGeminiChat({
      modelName: 'gemini-pro',
      maxOutputTokens: 2048,
      temperature: 0.4
    })
    
    const response = await withRetry(
      () => chatModel.invoke(prompt),
      {
        maxRetries: 3,
        baseDelay: 1000
      }
    )
    
    // Update conversation context if chat ID available
    if (chatId) {
      // Store the current messages in context
      const newMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      }
      
      const userMessage = {
        role: 'user',
        content: messageContent || '',
        timestamp: new Date().toISOString()
      }
      
      // Get or create context
      const context = conversationContext || {
        chatId,
        messages: [],
        recentChunks: [],
        recentSources: []
      }
      
      // Update context
      const updatedContext = {
        ...context,
        messages: [...context.messages, userMessage, newMessage]
      }
      
      // Store updated context
      await ragMemoryService.storeConversationContext(chatId, updatedContext)
    }
    
    // Return updated state with the response
    return {
      responseStatus: 'completed',
      assistantResponse: {
        content: response,
        noContextUsed: true,
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    // If error occurred, update state with error information
    return {
      responseStatus: 'error',
      assistantResponse: {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    }
  }
}