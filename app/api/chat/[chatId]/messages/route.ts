/**
 * Chat Messages API route
 * 
 * Handles retrieving and sending chat messages.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/clients'
import { v4 as uuidv4 } from 'uuid'
import { withZodValidation, validateWithZod } from '@/lib/api/middleware/zod-validation'
import { CreateMessageSchema } from '@/lib/schemas/chat'
import { isChatMessage } from '@/lib/types/chat'
import { ValidationError, zodErrorToValidationError } from '@/lib/errors'

/**
 * GET /api/chat/[chatId]/messages
 * Retrieves messages for a specific chat
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
        { error: 'Unauthorized', message: 'You must be logged in to access chat messages.' },
        { status: 401 }
      )
    }
    
    const chatId = params.chatId
    const userId = session.user.id
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10)
    const before = req.nextUrl.searchParams.get('before')
    
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
    
    // Build the query
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    // Add before timestamp filter if provided
    if (before) {
      query = query.lt('created_at', before)
    }
    
    // Fetch the messages
    const { data: messages, error } = await query
    
    if (error) {
      console.error('Error fetching chat messages:', error)
      return NextResponse.json(
        { error: 'Database Error', message: 'Failed to retrieve chat messages.' },
        { status: 500 }
      )
    }
    
    // Check if there are more messages
    const { count, error: countError } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('chat_id', chatId)
      .lt('created_at', messages.length > 0 ? messages[messages.length - 1].created_at : new Date().toISOString())
    
    // Transform the messages for the API response
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      role: msg.role,
      createdAt: msg.created_at,
      metadata: msg.metadata || {}
    }))
    
    // Return successful response
    return NextResponse.json({
      success: true,
      data: {
        messages: formattedMessages,
        hasMore: !countError && count ? count > 0 : false
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Unexpected error in fetching chat messages:', error)
    return NextResponse.json(
      { error: 'Server Error', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/chat/[chatId]/messages
 * Sends a new message in a chat
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to send messages.' },
        { status: 401 }
      )
    }
    
    // We'll use our withZodValidation middleware to handle all this
    try {
      const body = await req.json()
      const validatedData = validateWithZod(CreateMessageSchema, body, 'Invalid message format')
      
      const { content, metadata = {} } = validatedData
      // Note: attachments are now part of metadata in our new schema
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
    
    // Create message in database
    const messageId = uuidv4()
    const now = new Date().toISOString()
    
    const { error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        id: messageId,
        chat_id: chatId,
        role: 'user',
        content,
        user_id: userId,
        attachments: metadata.attachments || [],
        metadata,
        created_at: now
      })
    
    if (insertError) {
      console.error('Error creating message:', insertError)
      return NextResponse.json(
        { error: 'Database Error', message: 'Failed to send message.' },
        { status: 500 }
      )
    }
    
    // In a real-world scenario, we'd likely:
    // 1. Process the message with an AI or other service
    // 2. Generate a response
    // 3. Save the response to the database
    // 4. Return both the user message and the response
    
    // For this implementation, we'll simulate an AI response
    const responseId = uuidv4()
    const responseContent = `This is an automated response to: "${content}"`
    
    const { error: responseError } = await supabase
      .from('chat_messages')
      .insert({
        id: responseId,
        chat_id: chatId,
        role: 'assistant',
        content: responseContent,
        user_id: null, // No user for assistant messages
        metadata: {
          isAutomated: true,
          responseTime: new Date().getTime() - new Date(now).getTime()
        },
        created_at: new Date().toISOString()
      })
    
    if (responseError) {
      console.error('Error creating response message:', responseError)
      // We'll continue even if the response fails to save
    }
    
    // Create message objects with proper structure
    const userMessage = {
      id: messageId,
      content,
      role: 'user',
      createdAt: now,
      metadata
    };
    
    const assistantMessage = {
      id: responseId,
      content: responseContent,
      role: 'assistant',
      createdAt: new Date().toISOString(),
      metadata: {
        isAutomated: true
      }
    };
    
    // Validate message objects using our type guards
    if (!isChatMessage(userMessage)) {
      console.error('Invalid user message format:', userMessage);
    }
    
    if (!isChatMessage(assistantMessage)) {
      console.error('Invalid assistant message format:', assistantMessage);
    }
    
    // Return successful response
    return NextResponse.json({
      success: true,
      data: {
        messageId,
        chatId,
        message: userMessage,
        response: assistantMessage
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Unexpected error in sending message:', error)
    
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.code, message: error.message, details: error.data },
        { status: error.statusCode }
      )
    }
    
    return NextResponse.json(
      { error: 'Server Error', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}