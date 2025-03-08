/**
 * Chat API route for specific chat operations
 * 
 * Handles retrieving and deleting chat sessions.
 */
import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * GET /api/chat/[chatId]
 * Retrieves a chat by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to access chats.' },
        { status: 401 }
      )
    }
    
    const chatId = params.chatId
    const userId = session.user.id
    
    // Fetch the chat
    const { data: chat, error } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        // PGRST116 is the error code for "no rows found"
        return NextResponse.json(
          { error: 'Not Found', message: 'Chat not found or you don\'t have access to it.' },
          { status: 404 }
        )
      }
      
      console.error('Error fetching chat:', error)
      return NextResponse.json(
        { error: 'Database Error', message: 'Failed to retrieve chat.' },
        { status: 500 }
      )
    }
    
    // Return successful response
    return NextResponse.json({
      success: true,
      data: {
        chatId: chat.id,
        title: chat.title,
        workflowId: chat.workflow_id,
        createdAt: chat.created_at,
        metadata: chat.metadata
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Unexpected error in chat retrieval:', error)
    return NextResponse.json(
      { error: 'Server Error', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/chat/[chatId]
 * Deletes a chat by ID
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to delete chats.' },
        { status: 401 }
      )
    }
    
    const chatId = params.chatId
    const userId = session.user.id
    
    // First verify the chat belongs to the user
    const { data: chatExists, error: checkError } = await supabase
      .from('chats')
      .select('id')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single()
    
    if (checkError || !chatExists) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Chat not found or you don\'t have access to it.' },
        { status: 404 }
      )
    }
    
    // Delete the chat messages first (due to foreign key constraints)
    const { error: messagesError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('chat_id', chatId)
    
    if (messagesError) {
      console.error('Error deleting chat messages:', messagesError)
      return NextResponse.json(
        { error: 'Database Error', message: 'Failed to delete chat messages.' },
        { status: 500 }
      )
    }
    
    // Delete the chat
    const { error: chatError } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId)
      .eq('user_id', userId)
    
    if (chatError) {
      console.error('Error deleting chat:', chatError)
      return NextResponse.json(
        { error: 'Database Error', message: 'Failed to delete chat.' },
        { status: 500 }
      )
    }
    
    // Return successful response
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Unexpected error in chat deletion:', error)
    return NextResponse.json(
      { error: 'Server Error', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}