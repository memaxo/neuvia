import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/clients'
import { v4 as uuidv4 } from 'uuid'

import { documentService } from '@/lib/services/document/document-service'
import { rateLimit } from '@/lib/rate-limit'

/**
 * Process document endpoint
 * 
 * Handles document processing for extraction and analysis
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const limiter = rateLimit({
    maxPerMinute: 5, // More restrictive than upload since processing is CPU intensive
    maxPerHour: 50,
  })
  const result = await limiter.check(request)
  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          timestamp: new Date().toISOString(),
          details: {
            retryAfter: result.retryAfter,
          },
        },
      },
      { status: 429 }
    )
  }

  try {
    // Get user from session
    const supabase = await createServerClient()
    const { data } = await supabase.auth.getSession()
    const userId = data?.session?.user.id

    if (!userId) {
      return NextResponse.json(
        {
          error: {
            message: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const patientId = formData.get('patientId') as string
    const documentType = formData.get('documentType') as string
    const documentCategory = formData.get('documentCategory') as string
    const metadataStr = formData.get('metadata') as string
    const metadata = metadataStr ? JSON.parse(metadataStr) : {}

    // Validate input
    if (!file) {
      return NextResponse.json(
        {
          error: {
            message: 'No file provided',
            code: 'INVALID_INPUT',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      )
    }

    // Process the document
    const documentId = uuidv4()
    const result = await documentService.processDocument({
      file,
      documentId,
      userId,
      patientId,
      documentType: {
        category: documentCategory || 'clinical',
        type: documentType || 'general',
      },
      extractText: true,
      extractStructuredData: true,
      metadata,
    })

    // Return success response with processing status
    return NextResponse.json({
      success: true,
      data: {
        document_id: result.id || documentId,
        processing_status: result.processing_status || 'processing',
        estimated_completion_time: result.estimatedCompletionTime || 30,
        metadata: result.metadata,
        extracted_data: result.extractedData || null,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error processing document:', error)
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Failed to process document',
          code: 'SERVER_ERROR',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    )
  }
}