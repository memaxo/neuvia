// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { createClient } from 'jsr:@supabase/supabase-js'

import { corsHeaders } from '../_shared/cors.ts'

interface ProcessUploadRequest {
  fileName: string
  fileSize: number
  fileType: string
  userId: string
  patientId?: string
  documentType?: string
  departmentId?: string
}

// File upload configuration
const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png'
]
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

// Create a Supabase client with the service role key
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

/**
 * Process Upload Function
 *
 * Simplified Edge Function that validates file requests and generates upload URLs.
 * No workflow state or document processing logic is included here.
 */
Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Parse request
    const {
      fileName,
      fileSize,
      fileType,
      userId,
      patientId,
      documentType,
      departmentId,
    }: ProcessUploadRequest = await req.json()

    // Validate file type
    if (!ALLOWED_TYPES.includes(fileType.toLowerCase())) {
      throw new Error(
        'Invalid file type. Allowed types: PDF, plain text, Word documents, JPEG, PNG'
      )
    }

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      throw new Error('File too large. Maximum size: 20MB')
    }

    // Generate a unique file path
    const timestamp = new Date().toISOString()
    const fileExt = fileName.split('.').pop()
    const uniqueFileName = `${timestamp}-${crypto.randomUUID()}.${fileExt}`
    
    // Structure file path based on patient ID if provided
    const filePath = patientId
      ? `patient-documents/${patientId}/${uniqueFileName}`
      : `uploads/${userId}/${uniqueFileName}`

    // Generate presigned URL for upload
    const { data, error } = await supabaseAdmin.storage
      .from('documents')
      .createSignedUploadUrl(filePath)

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({
        uploadUrl: data.signedUrl,
        path: filePath,
        fileName,
        fileType,
        patientId,
        documentType,
        departmentId
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (err) {
    const error = err as Error
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/process-upload' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"fileName":"example.pdf","fileSize":1024,"fileType":"application/pdf","userId":"user-123"}'

*/