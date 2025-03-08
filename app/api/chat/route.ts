/**
 * Chat API route
 * 
 * Handles creation of new chat sessions.
 */
import type { NextRequest} from 'next/server';
import { createServerClient } from '@/lib/supabase/clients'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'
import { createApiRoute } from '@/lib/api/route-helpers'
import { AuthenticationError } from '@/lib/errors/auth-errors'

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
export const POST = createApiRoute(async (req: NextRequest) => {
  const supabase = await createServerClient()
  
  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthenticationError({
      message: 'Authentication required to create a chat',
      code: 'AUTH_UNAUTHORIZED',
      data: { error: authError?.message }
    })
  }
  
  // Parse and validate request body
  const body = await req.json()
  const validatedData = CreateChatSchema.safeParse(body)
  
  if (!validatedData.success) {
    return apiError({
      message: 'Invalid request data',
      error: 'VALIDATION_ERROR',
      errors: validatedData.error.errors,
      status: 422
    })
  }
  
  const { title = 'New Chat', workflowId, metadata } = validatedData.data
  
  // Create chat in database
  const chatId = uuidv4()
  const userId = user.id
  
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
    return apiError({
      message: 'Failed to create chat session.',
      error: 'DATABASE_ERROR',
      status: 500
    })
  }
  
  // Return successful response
  return apiSuccess({
    chatId: chatData.id,
    title: chatData.title,
    workflowId: chatData.workflow_id,
    createdAt: chatData.created_at
  })
}, {
  openApiPath: '/chat',
  method: 'post',
  validate: true,
  logMetadata: {
    endpoint: '/api/chat',
    method: 'POST'
  }
})