/**
 * Chat API route for specific chat operations
 * 
 * Handles retrieving and deleting chat sessions.
 */
import type { NextRequest} from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'
import { createApiRoute } from '@/lib/api/route-helpers'
import { AuthenticationError } from '@/lib/errors/auth-errors'

/**
 * GET /api/chat/[chatId]
 * Retrieves a chat by ID
 */
export const GET = createApiRoute(async (
  req: NextRequest,
  { params }: { params: { chatId: string } }
) => {
  const supabase = createRouteHandlerClient({ cookies })
  
  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthenticationError({
      message: 'Authentication required to access chats',
      code: 'AUTH_UNAUTHORIZED',
      data: { error: authError?.message }
    })
  }
  
  const chatId = params.chatId
  const userId = user.id
  
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
      return apiError({
        message: 'Chat not found or you don\'t have access to it.',
        error: 'CHAT_NOT_FOUND',
        status: 404
      })
    }
    
    console.error('Error fetching chat:', error)
    return apiError({
      message: 'Failed to retrieve chat.',
      error: 'DATABASE_ERROR',
      status: 500
    })
  }
  
  // Return successful response
  return apiSuccess({
    chatId: chat.id,
    title: chat.title,
    workflowId: chat.workflow_id,
    createdAt: chat.created_at,
    metadata: chat.metadata
  })
}, {
  openApiPath: '/chat/{chatId}',
  method: 'get',
  validate: true,
  logMetadata: {
    endpoint: '/api/chat/[chatId]',
    method: 'GET'
  }
})

/**
 * DELETE /api/chat/[chatId]
 * Deletes a chat by ID
 */
export const DELETE = createApiRoute(async (
  req: NextRequest,
  { params }: { params: { chatId: string } }
) => {
  const supabase = createRouteHandlerClient({ cookies })
  
  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthenticationError({
      message: 'Authentication required to delete chats',
      code: 'AUTH_UNAUTHORIZED',
      data: { error: authError?.message }
    })
  }
  
  const chatId = params.chatId
  const userId = user.id
  
  // First verify the chat belongs to the user
  const { data: chatExists, error: checkError } = await supabase
    .from('chats')
    .select('id')
    .eq('id', chatId)
    .eq('user_id', userId)
    .single()
  
  if (checkError || !chatExists) {
    return apiError({
      message: 'Chat not found or you don\'t have access to it.',
      error: 'CHAT_NOT_FOUND',
      status: 404
    })
  }
  
  // Delete the chat messages first (due to foreign key constraints)
  const { error: messagesError } = await supabase
    .from('chat_messages')
    .delete()
    .eq('chat_id', chatId)
  
  if (messagesError) {
    console.error('Error deleting chat messages:', messagesError)
    return apiError({
      message: 'Failed to delete chat messages.',
      error: 'DATABASE_ERROR',
      status: 500
    })
  }
  
  // Delete the chat
  const { error: chatError } = await supabase
    .from('chats')
    .delete()
    .eq('id', chatId)
    .eq('user_id', userId)
  
  if (chatError) {
    console.error('Error deleting chat:', chatError)
    return apiError({
      message: 'Failed to delete chat.',
      error: 'DATABASE_ERROR',
      status: 500
    })
  }
  
  // Return successful response
  return apiSuccess(null)
}, {
  openApiPath: '/chat/{chatId}',
  method: 'delete',
  validate: true,
  logMetadata: {
    endpoint: '/api/chat/[chatId]',
    method: 'DELETE'
  }
})