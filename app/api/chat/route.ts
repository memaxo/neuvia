/**
 * Chat API route
 * 
 * Handles creation of new chat sessions.
 */
import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/clients'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'

// Validation schema for chat creation
const CreateChatSchema = z.object({
  title: z.string().optional(),
  workflowId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional()
})

/**
 * POST /api/chat
 * Creates a new chat session
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to create a chat.' },
        { status: 401 }
      )
    }
    
    // Parse and validate request body
    const body = await req.json()
    const validatedData = CreateChatSchema.safeParse(body)
    
    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Validation Error', message: validatedData.error.errors },
        { status: 422 }
      )
    }
    
    const { title = 'New Chat', workflowId, metadata } = validatedData.data
    
    // Create chat in database
    const chatId = uuidv4()
    const userId = session.user.id
    
    const { data: chatData, error } = await supabase
      .from('chats')
      .insert({
        id: chatId,
        title,
        user_id: userId,
        workflow_id: workflowId,
        metadata: metadata || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error creating chat:', error)
      return NextResponse.json(
        { error: 'Database Error', message: 'Failed to create chat session.' },
        { status: 500 }
      )
    }
    
    // Return successful response
    return NextResponse.json({
      success: true,
      data: {
        chatId: chatData.id,
        title: chatData.title,
        workflowId: chatData.workflow_id,
        createdAt: chatData.created_at
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Unexpected error in chat creation:', error)
    return NextResponse.json(
      { error: 'Server Error', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}