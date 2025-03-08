import type { NextRequest} from 'next/server';
import { createServerClient } from '@/lib/supabase/clients'
import { v4 as uuidv4 } from 'uuid'
import { documentService } from '@/lib/services/document/document-service'
import { rateLimit } from '@/lib/rate-limit'
import { apiError, apiSuccess } from '@/lib/api/response-helpers'
import { createApiRoute } from '@/lib/api/route-helpers'
import { AuthenticationError } from '@/lib/errors/auth-errors'

/**
 * Upload document endpoint
 * 
 * Handles document upload, storage, and initial processing
 */
export const POST = createApiRoute(async (request: NextRequest) => {
  // Rate limiting
  const limiter = rateLimit({
    maxPerMinute: 10,
    maxPerHour: 100,
  })
  const result = await limiter.check(request)
  if (!result.success) {
    return apiError({
      message: 'Rate limit exceeded',
      error: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      details: {
        retryAfter: result.retryAfter,
      },
    })
  }

  // Get user from session
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new AuthenticationError({
      message: 'Authentication required to upload documents',
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
  return apiSuccess({
    document_id: result.id || documentId,
    url: result.url,
    processing_status: 'pending',
    metadata: result.metadata,
  })
}, {
  openApiPath: '/documents/upload',
  method: 'post',
  validate: false, // Skip validation for file uploads
  logMetadata: {
    endpoint: '/api/documents/upload',
    method: 'POST'
  }
})