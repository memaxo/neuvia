// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from "jsr:@supabase/supabase-js"

import { corsHeaders } from '../_shared/cors.ts'

console.log("Hello from Functions!")

interface DownloadRequest {
  filePath: string
  userId: string
  patientId?: string
}

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

// Verify user has access to the requested file
async function verifyAccess(userId: string, filePath: string, patientId?: string): Promise<boolean> {
  try {
    // Check if file exists in upload_logs
    const { data: logEntry, error: logError } = await supabaseAdmin
      .from('upload_logs')
      .select('user_id, patient_id, status')
      .eq('path', filePath)
      .single()

    if (logError || !logEntry) {
      return false
    }

    // Verify file is validated
    if (logEntry.status !== 'validated') {
      return false
    }

    // Check user permissions
    // 1. File owner can access
    if (logEntry.user_id === userId) {
      return true
    }

    // 2. If patient ID is provided, check if user has access to patient
    if (patientId) {
      const { data: access, error: accessError } = await supabaseAdmin
        .from('patient_access')
        .select('id')
        .eq('user_id', userId)
        .eq('patient_id', patientId)
        .single()

      if (!accessError && access) {
        return true
      }
    }

    return false
  } catch (err) {
    const error = err as Error
    console.error('Access verification error:', error.message)
    return false
  }
}

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

    const { filePath, userId, patientId }: DownloadRequest = await req.json()

    // Verify access
    const hasAccess = await verifyAccess(userId, filePath, patientId)
    if (!hasAccess) {
      throw new Error('Access denied')
    }

    // Generate short-lived signed URL (5 minutes)
    const { data, error } = await supabaseAdmin
      .storage
      .from('scans')
      .createSignedUrl(filePath, 300)

    if (error) {
      throw error
    }

    // Log access
    await supabaseAdmin.from('access_logs').insert({
      user_id: userId,
      file_path: filePath,
      patient_id: patientId,
      access_type: 'download',
      accessed_at: new Date().toISOString()
    })

    return new Response(
      JSON.stringify({
        downloadUrl: data.signedUrl,
        expiresAt: new Date(Date.now() + 300000).toISOString() // 5 minutes from now
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (err) {
    const error = err as Error
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/generate-download' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
