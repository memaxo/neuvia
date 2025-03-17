import { NextResponse } from 'next/server'
import { createDocumentIndexingWorkflow } from '@/workflow/graphs/rag-workflow'
import { SupabaseCheckpointer } from '@/workflow/checkpointer/supabase-checkpointer'
import { RAGIndexingError } from '@/lib/services/rag/error/rag-errors'
import { supabaseClient } from '@/lib/supabase/client'
import { z } from 'zod'

// Input validation schema
const DocumentIndexRequestSchema = z.object({
  documentId: z.string().uuid(),
  chunkSize: z.number().min(100).max(2000).optional(),
  chunkOverlap: z.number().min(0).max(500).optional(),
  embeddingModel: z.string().optional(),
})

/**
 * POST handler for document indexing API
 * 
 * This endpoint accepts a document ID and indexing parameters
 * and triggers the indexing process using the RAG workflow.
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json()
    
    // Validate request
    const validationResult = DocumentIndexRequestSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.format() },
        { status: 400 }
      )
    }
    
    const { documentId, chunkSize, chunkOverlap, embeddingModel } = validationResult.data
    
    // Create workflow with checkpointer
    const checkpointer = new SupabaseCheckpointer(supabaseClient)
    const workflow = createDocumentIndexingWorkflow(checkpointer)
    
    // Generate a workflow ID for tracking
    const workflowId = `indexing-${documentId}`
    
    // Initial state for the workflow
    const initialState = {
      action: 'index_document',
      documentId,
      indexingOptions: {
        chunkSize,
        chunkOverlap,
        embeddingModel
      },
      documentProcessing: {
        indexingStatus: 'pending',
        indexingComplete: false,
        lastUpdated: new Date().toISOString()
      }
    }
    
    // Run the workflow
    const result = await workflow.invoke(initialState, {
      workflowId,
    })
    
    // Handle different response types
    if (result.status === 'completed') {
      return NextResponse.json({
        documentId,
        indexed: true,
        status: 'completed'
      })
    } else if (result.status === 'error') {
      return NextResponse.json(
        { 
          error: 'Error indexing document',
          message: result.error || 'Unknown error occurred',
          documentId
        },
        { status: 500 }
      )
    } else {
      return NextResponse.json({
        documentId,
        indexed: false,
        status: result.status
      })
    }
  } catch (error) {
    // Handle specific error types
    if (error instanceof RAGIndexingError) {
      return NextResponse.json(
        { error: 'Error indexing document', message: error.message },
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