import { NextResponse } from 'next/server'
import { createRAGChatWorkflow } from '@/workflow/graphs/rag-workflow'
import { SupabaseCheckpointer } from '@/workflow/checkpointer/supabase-checkpointer'
import { RAGMemoryError, RAGRetrievalError } from '@/lib/services/rag/error/rag-errors'
import { supabaseClient } from '@/lib/supabase/client'
import { z } from 'zod'

// Input validation schema
const RAGChatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  chatId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  documentType: z.string().optional(),
  minRelevance: z.number().min(0).max(1).optional(),
  limit: z.number().min(1).max(20).optional(),
})

/**
 * POST handler for RAG chat API
 * 
 * This endpoint accepts a message and optional parameters and returns
 * a generated response with relevant sources from RAG.
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json()
    
    // Validate request
    const validationResult = RAGChatRequestSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.format() },
        { status: 400 }
      )
    }
    
    const { message, chatId, patientId, documentType, minRelevance, limit } = validationResult.data
    
    // Create workflow with checkpointer
    const checkpointer = new SupabaseCheckpointer(supabaseClient)
    const workflow = createRAGChatWorkflow(checkpointer)
    
    // Generate a new chat ID if not provided
    const actualChatId = chatId || crypto.randomUUID()
    
    // Generate message ID for tracking
    const messageId = crypto.randomUUID()
    
    // Initial state for the workflow
    const initialState = {
      action: 'chat',
      chatId: actualChatId,
      patientId,
      messageId,
      currentMessage: {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      },
      retrievalOptions: {
        documentType,
        minRelevance: minRelevance || 0.7,
        limit: limit || 5,
        includeMetadata: true
      }
    }
    
    // Run the workflow
    const result = await workflow.invoke(initialState, {
      workflowId: actualChatId,
    })
    
    // Handle different response types
    if (result.status === 'completed') {
      return NextResponse.json({
        response: result.response,
        sources: result.sources || [],
        chatId: result.chatId || actualChatId
      })
    } else if (result.status === 'error') {
      return NextResponse.json(
        { 
          error: 'Error generating response',
          message: result.error || 'Unknown error occurred',
          chatId: result.chatId || actualChatId
        },
        { status: 500 }
      )
    } else {
      return NextResponse.json(
        { 
          error: 'Unknown response status',
          status: result.status,
          chatId: result.chatId || actualChatId
        },
        { status: 500 }
      )
    }
  } catch (error) {
    // Handle specific error types
    if (error instanceof RAGRetrievalError) {
      return NextResponse.json(
        { error: 'Error retrieving context', message: error.message },
        { status: 500 }
      )
    } else if (error instanceof RAGMemoryError) {
      return NextResponse.json(
        { error: 'Error managing memory', message: error.message },
        { status: 500 }
      )
    } else {
      return NextResponse.json(
        { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      )
    }
  }
}