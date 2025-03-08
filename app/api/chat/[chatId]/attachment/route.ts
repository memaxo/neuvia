/**
 * Chat Attachment API route
 * 
 * Handles uploading chat attachments.
 */
import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/clients'
import { v4 as uuidv4 } from 'uuid'

/**
 * POST /api/chat/[chatId]/attachment
 * Uploads a file attachment for a chat
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const supabase = await createServerClient()
    
    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to upload attachments.' },
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
    
    // Get form data from the request
    const formData = await req.formData()
    const file = formData.get('file') as File
    const messageId = formData.get('messageId') as string | null
    
    if (!file) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'No file found in the request.' },
        { status: 400 }
      )
    }
    
    // Check file size (limit to 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Payload Too Large', message: 'File exceeds the maximum allowed size of 10MB.' },
        { status: 413 }
      )
    }
    
    // Generate a unique path for the file in storage
    const attachmentId = uuidv4()
    const fileExtension = file.name.split('.').pop() || ''
    const storagePath = `${chatId}/${attachmentId}${fileExtension ? `.${  fileExtension}` : ''}`
    
    // Upload the file to Supabase Storage
    const { data: storageData, error: storageError } = await supabase
      .storage
      .from('chat-attachments')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      })
    
    if (storageError) {
      console.error('Error uploading file:', storageError)
      return NextResponse.json(
        { error: 'Storage Error', message: 'Failed to upload file to storage.' },
        { status: 500 }
      )
    }
    
    // Get a public URL for the file
    const { data: urlData } = await supabase
      .storage
      .from('chat-attachments')
      .getPublicUrl(storagePath)
    
    // Create an entry in the chat_attachments table
    const { data: attachmentData, error: attachmentError } = await supabase
      .from('chat_attachments')
      .insert({
        id: attachmentId,
        chat_id: chatId,
        message_id: messageId,
        user_id: userId,
        file_name: file.name,
        storage_path: storagePath,
        content_type: file.type,
        size: file.size,
        url: urlData.publicUrl,
        created_at: new Date().toISOString(),
        metadata: {
          originalFilename: file.name
        }
      })
      .select()
      .single()
    
    if (attachmentError) {
      console.error('Error creating attachment record:', attachmentError)
      
      // Attempt to clean up the uploaded file
      await supabase
        .storage
        .from('chat-attachments')
        .remove([storagePath])
      
      return NextResponse.json(
        { error: 'Database Error', message: 'Failed to create attachment record.' },
        { status: 500 }
      )
    }
    
    // Return successful response
    return NextResponse.json({
      success: true,
      data: {
        id: attachmentId,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        url: urlData.publicUrl,
        metadata: {
          originalFilename: file.name
        }
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Unexpected error in attachment upload:', error)
    return NextResponse.json(
      { error: 'Server Error', message: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}

// Configure the API route to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
}