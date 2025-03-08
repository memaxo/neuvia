import type { NextRequest} from 'next/server';
import { createServerClient } from '@/lib/supabase/clients'
import { v4 as uuidv4 } from 'uuid'
import { documentService } from '@/lib/services/document/document-service'
import { rateLimit } from '@/lib/rate-limit'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'
import { createApiRoute } from '@/lib/api/route-helpers'
import { AuthenticationError } from '@/lib/errors/auth-errors'

/**
 * Process document endpoint
 * 
 * Handles document processing for extraction and analysis
 */
export const POST = createApiRoute(async (request: NextRequest) => {
  // Rate limiting
  const limiter = rateLimit({
    maxPerMinute: 5, // More restrictive than upload since processing is CPU intensive
    maxPerHour: 50,
  })
  const result = await limiter.check(request)
  if (!result.success) {
    return apiError({
      message: 'Rate limit exceeded',
      error: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      details: {
        retryAfter: result.retryAfter,
      }
    })
  }

  // Get user from session
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new AuthenticationError({
      message: 'Authentication required to process documents',
      code: 'AUTH_UNAUTHORIZED',
      data: { error: authError?.message }
    })
  }
  
  const userId = user.id

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
    return apiError({
      message: 'No file provided',
      error: 'BAD_REQUEST',
      status: 400
    })
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
  return apiSuccess({
    document_id: result.id || documentId,
    processing_status: result.processing_status || 'processing',
    estimated_completion_time: result.estimatedCompletionTime || 30,
    metadata: result.metadata,
    extracted_data: result.extractedData || null,
  })
}, {
  openApiPath: '/documents/process',
  method: 'post',
  validate: false, // Skip validation for file uploads
  logMetadata: {
    endpoint: '/api/documents/process',
    method: 'POST'
  }
})