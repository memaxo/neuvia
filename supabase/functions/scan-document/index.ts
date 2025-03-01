// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createClient } from 'jsr:@supabase/supabase-js'

import { corsHeaders } from '../_shared/cors.ts'

interface ScanRequest {
  filePath: string
  userId: string
  uploadId: string
}

interface ValidationResult {
  isValid: boolean
  format?: string
  metadata?: Record<string, unknown>
  error?: string
}

console.log('Hello from Functions!')

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

// Validate medical file formats
async function validateMedicalFile(
  data: Uint8Array,
  fileType: string
): Promise<ValidationResult> {
  try {
    // Medical Images
    if (fileType.includes('dicom')) {
      // Check for DICOM magic number (128 byte preamble + 'DICM')
      const isDICOM =
        data.length > 132 &&
        data[128] === 0x44 && // 'D'
        data[129] === 0x49 && // 'I'
        data[130] === 0x43 && // 'C'
        data[131] === 0x4d // 'M'

      if (!isDICOM) {
        return { isValid: false, error: 'Invalid DICOM format' }
      }

      return {
        isValid: true,
        format: 'DICOM',
        metadata: {
          validated: true,
          timestamp: new Date().toISOString(),
        },
      }
    }

    // NIfTI validation
    if (fileType.includes('nii') || fileType.includes('nifti')) {
      // Check for NIfTI-1 magic number ('ni1\0' or 'n+1\0')
      const isNIfTI =
        data.length > 4 &&
        ((data[0] === 0x6e &&
          data[1] === 0x69 &&
          data[2] === 0x31 &&
          data[3] === 0x00) || // 'ni1\0'
          (data[0] === 0x6e &&
            data[1] === 0x2b &&
            data[2] === 0x31 &&
            data[3] === 0x00)) // 'n+1\0'

      if (!isNIfTI) {
        return { isValid: false, error: 'Invalid NIfTI format' }
      }

      return {
        isValid: true,
        format: 'NIfTI',
        metadata: {
          validated: true,
          timestamp: new Date().toISOString(),
        },
      }
    }

    // Image validation for JPEG/PNG
    if (
      fileType.includes('jpeg') ||
      fileType.includes('jpg') ||
      fileType.includes('png')
    ) {
      // Simple magic number check for JPEG/PNG
      const isJPEG = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
      const isPNG =
        data[0] === 0x89 &&
        data[1] === 0x50 &&
        data[2] === 0x4e &&
        data[3] === 0x47

      if (!isJPEG && !isPNG) {
        return { isValid: false, error: 'Invalid image format' }
      }

      return {
        isValid: true,
        format: isJPEG ? 'JPEG' : 'PNG',
        metadata: {
          validated: true,
          timestamp: new Date().toISOString(),
        },
      }
    }

    // PDF validation
    if (fileType.includes('pdf')) {
      // Check for PDF magic number ('%PDF')
      const isPDF =
        data.length > 4 &&
        data[0] === 0x25 && // '%'
        data[1] === 0x50 && // 'P'
        data[2] === 0x44 && // 'D'
        data[3] === 0x46 // 'F'

      if (!isPDF) {
        return { isValid: false, error: 'Invalid PDF format' }
      }

      return {
        isValid: true,
        format: 'PDF',
        metadata: {
          validated: true,
          timestamp: new Date().toISOString(),
        },
      }
    }

    // Word document validation (DOCX)
    if (
      fileType.includes(
        'openxmlformats-officedocument.wordprocessingml.document'
      ) ||
      fileType.includes('msword')
    ) {
      // Check for ZIP magic number (DOCX is a ZIP file)
      const isZIP =
        data.length > 4 &&
        data[0] === 0x50 && // 'P'
        data[1] === 0x4b && // 'K'
        data[2] === 0x03 && // '\x03'
        data[3] === 0x04 // '\x04'

      if (!isZIP) {
        return { isValid: false, error: 'Invalid Word document format' }
      }

      return {
        isValid: true,
        format: 'DOCX',
        metadata: {
          validated: true,
          timestamp: new Date().toISOString(),
        },
      }
    }

    // Text and Markdown files
    if (
      fileType.includes('text/plain') ||
      fileType.includes('text/markdown') ||
      fileType.includes('text/x-markdown')
    ) {
      // Check if content is valid UTF-8
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true })
        decoder.decode(data)

        return {
          isValid: true,
          format: fileType.includes('markdown') ? 'Markdown' : 'Text',
          metadata: {
            validated: true,
            timestamp: new Date().toISOString(),
          },
        }
      } catch {
        return { isValid: false, error: 'Invalid text encoding' }
      }
    }

    // XML validation
    if (fileType.includes('xml')) {
      try {
        const content = new TextDecoder().decode(data)
        // Basic XML validation - check for opening and closing tags
        if (
          !content.trim().startsWith('<?xml') &&
          !content.trim().startsWith('<')
        ) {
          return { isValid: false, error: 'Invalid XML format' }
        }
        return {
          isValid: true,
          format: 'XML',
          metadata: {
            validated: true,
            timestamp: new Date().toISOString(),
          },
        }
      } catch {
        return { isValid: false, error: 'Invalid XML format' }
      }
    }

    // JSON validation
    if (fileType.includes('json')) {
      try {
        const content = new TextDecoder().decode(data)
        JSON.parse(content)
        return {
          isValid: true,
          format: 'JSON',
          metadata: {
            validated: true,
            timestamp: new Date().toISOString(),
          },
        }
      } catch {
        return { isValid: false, error: 'Invalid JSON format' }
      }
    }

    return { isValid: false, error: 'Unsupported file type' }
  } catch (err) {
    const error = err as Error
    return { isValid: false, error: `Validation error: ${error.message}` }
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

    const { filePath, userId, uploadId }: ScanRequest = await req.json()

    // Download file for scanning
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('scans')
      .download(filePath)

    if (downloadError) {
      throw downloadError
    }

    // Convert file to Uint8Array for validation
    const fileBuffer = await fileData.arrayBuffer()
    const fileArray = new Uint8Array(fileBuffer)

    // Validate file format
    const validationResult = await validateMedicalFile(
      fileArray,
      filePath.toLowerCase()
    )

    if (!validationResult.isValid) {
      // Update upload status to failed
      await supabaseAdmin
        .from('upload_logs')
        .update({
          status: 'failed',
          error_message: validationResult.error,
        })
        .eq('id', uploadId)

      // Delete invalid file
      await supabaseAdmin.storage.from('scans').remove([filePath])

      throw new Error(validationResult.error || 'File validation failed')
    }

    // Update upload status and metadata
    await supabaseAdmin
      .from('upload_logs')
      .update({
        status: 'validated',
        metadata: validationResult.metadata,
        validated_at: new Date().toISOString(),
      })
      .eq('id', uploadId)

    return new Response(
      JSON.stringify({
        success: true,
        validation: validationResult,
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

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/scan-document' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
