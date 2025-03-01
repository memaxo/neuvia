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
  metadata?: {
    patientId?: string
    documentType?: string
    studyDate?: string
  }
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/dicom', '.nii']
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

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

    const {
      fileName,
      fileSize,
      fileType,
      userId,
      metadata,
    }: ProcessUploadRequest = await req.json()

    // Validate file type
    if (!ALLOWED_TYPES.some((type) => fileType.toLowerCase().includes(type))) {
      throw new Error(
        'Invalid file type. Allowed types: JPEG, PNG, DICOM, NIfTI'
      )
    }

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      throw new Error('File too large. Maximum size: 100MB')
    }

    // Generate a unique file path with metadata
    const timestamp = new Date().toISOString()
    const fileExt = fileName.split('.').pop()
    const uniqueFileName = `${timestamp}-${crypto.randomUUID()}.${fileExt}`
    const filePath = metadata?.patientId
      ? `uploads/${userId}/${metadata.patientId}/${uniqueFileName}`
      : `uploads/${userId}/${uniqueFileName}`

    // Generate presigned URL for upload
    const { data, error } = await supabaseAdmin.storage
      .from('scans')
      .createSignedUploadUrl(filePath)

    if (error) {
      throw error
    }

    // Log the upload attempt
    await supabaseAdmin.from('upload_logs').insert({
      user_id: userId,
      file_name: fileName,
      file_size: fileSize,
      file_type: fileType,
      patient_id: metadata?.patientId,
      document_type: metadata?.documentType,
      study_date: metadata?.studyDate,
      status: 'pending',
      path: filePath,
    })

    return new Response(
      JSON.stringify({
        uploadUrl: data.signedUrl,
        path: filePath,
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
    --data '{"name":"Functions"}'

*/
