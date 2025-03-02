import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'

import { documentService } from '@/lib/services/document/document-service'
import { rateLimit } from '@/lib/rate-limit'

/**
 * Upload document endpoint
 * 
 * Handles document upload, storage, and initial processing
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const limiter = rateLimit({
    maxPerMinute: 10,
    maxPerHour: 100,
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
    const supabase = createRouteHandlerClient({ cookies })
    const { data: session } = await supabase.auth.getSession()
    const userId = session?.session?.user.id

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

    // Process the upload
    const documentId = uuidv4()
    const result = await documentService.uploadDocument({
      file,
      documentId,
      userId,
      patientId,
      metadata: {
        document_type: {
          category: documentCategory || 'clinical',
          type: documentType || 'general',
        },
        ...metadata,
      },
    })

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        document_id: result.id || documentId,
        url: result.url,
        processing_status: 'pending',
        metadata: result.metadata,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error uploading document:', error)
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Failed to upload document',
          code: 'SERVER_ERROR',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    )
  }
}