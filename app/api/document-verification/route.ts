import { verificationService } from '@/lib/services/verification/verification-service'
import { workflowService } from '@/lib/services/workflow/workflow-service'
import { createServerClient } from '@/lib/supabase/clients'
import type { NextRequest } from 'next/server'
import { ValidationError, NotFoundError, AuthenticationError } from '@/lib/errors'
import { apiSuccess, getRequestId } from '@/lib/api-response'
import { createApiRoute } from '@/lib/api/route-helpers'
import logger from '@/lib/logger'

export const POST = createApiRoute(async (req: NextRequest) => {
  const requestId = getRequestId(req);
  const moduleLogger = logger.withMetadata({ 
    module: 'API',
    endpoint: '/api/document-verification',
    method: 'POST',
    requestId
  });
  
  const correlationId = generateCorrelationId()
  moduleLogger.info(`[${correlationId}] Processing document verification request`);

  try {
    const { documentId, workflowId } = await req.json()

    // Create Supabase client
    const supabase = await createServerClient()

    // Fetch the document
    const { data: patientDocument, error: docError } = await supabase
      .from('patient_documents')
      .select('*, patients(*)')
      .eq('id', documentId)
      .single()

    if (docError || !patientDocument) {
      moduleLogger.error('Error fetching patient document', { documentId, correlationId }, docError)
      throw new NotFoundError({
        message: 'Patient document not found',
        resource: 'Document',
        code: 'DOCUMENT_NOT_FOUND',
        data: { documentId, correlationId },
        cause: docError,
      })
    }

    // Get workflow state using service
    const workflowState = await workflowService.getWorkflowState(workflowId)

    if (!workflowState) {
      moduleLogger.error('Error fetching workflow', { workflowId, correlationId })
      throw new NotFoundError({
        message: 'Workflow not found',
        resource: 'Workflow',
        code: 'WORKFLOW_NOT_FOUND',
        data: { workflowId, correlationId },
      })
    }

    // Format workflow data for API response
    const workflow = {
      id: workflowId,
      current_step: workflowState.currentStep,
      metadata: workflowState.metadata,
    }

    // Build the extracted document model
    const extractedDocument = {
      id: patientDocument.id,
      patientId: patientDocument.patient_id,
      documentType: {
        category: patientDocument.category || 'clinical',
        type: 'medical_record',
      },
      extractedData: {
        rawText: patientDocument.content_text || '',
        entities: patientDocument.key_findings || [],
        metadata: patientDocument.metadata || {},
        confidence: 0.7,
      },
      processingStatus: {
        status: patientDocument.processing_status || 'processed',
        processedAt: patientDocument.updated_at,
      },
      fileName: patientDocument.file_path?.split('/').pop() || '',
      fileType: patientDocument.file_type,
    }

    // For demonstration, if you have a separate method for generating items:
    const verificationItems = verificationService.generateVerificationItems(extractedDocument)

    moduleLogger.info(`[${correlationId}] Successfully generated verification items`, {
      documentId,
      workflowId,
      itemCount: verificationItems.length,
    })

    return apiSuccess({
      document: extractedDocument,
      verificationItems,
      workflow,
    })
  } catch (error) {
    moduleLogger.error(`[${correlationId}] Error in document verification route`, error)
    const errInfo = handleVerificationRouteError(error, correlationId, 'Failed to verify document')
    return apiError({
      message: errInfo.message,
      code: errInfo.code,
      errors: errInfo.details,
      status: errInfo.status,
    })
  }
}, { 
  openApiPath: '/document-verification',
  method: 'post',
  validate: true,
  logMetadata: { endpoint: '/api/document-verification', method: 'POST' }
});

export const GET = createApiRoute(async (request: NextRequest) => {
  const requestId = getRequestId(request);
  const moduleLogger = logger.withMetadata({ 
    module: 'API',
    endpoint: '/api/document-verification',
    method: 'GET',
    requestId
  });
  
  moduleLogger.info('Processing document verification lookup request');
  
  // Create Supabase client
  const supabase = await createServerClient()

  // Verify user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError({
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
      data: { error: authError?.message }
    });
  }

  // Get URL parameters - OpenAPI validation will ensure these are present
  const { searchParams } = new URL(request.url)
  const extractedDocumentId = searchParams.get('extractedDocumentId')

  // Get patient document
  const { data: patientDocument, error: docError } = await supabase
    .from('patient_documents')
    .select('*')
    .eq('id', extractedDocumentId)
    .single()

  if (docError || !patientDocument) {
    moduleLogger.error('Error fetching patient document', { extractedDocumentId }, docError);
    throw new NotFoundError({
      message: 'Patient document not found',
      resource: 'Document',
      code: 'DOCUMENT_NOT_FOUND',
      data: { documentId: extractedDocumentId },
      cause: docError
    });
  }

  // Transform to expected format
  const extractedDocument = {
    id: patientDocument.id,
    createdAt: new Date(patientDocument.created_at || Date.now()),
    documentType: patientDocument.document_type,
    patientId: patientDocument.patient_id,
    extractedData: {
      rawText: patientDocument.content_text || '',
      metadata: patientDocument.metadata || {},
      chunks: [],
    },
    isSuccessful: patientDocument.is_processed || false,
    errorMessage: patientDocument.processing_error,
  }

  // Generate verification items
  const verificationItems =
    verificationService.generateVerificationItems(extractedDocument)

  moduleLogger.info('Successfully generated verification items', { 
    documentId: extractedDocumentId,
    itemCount: verificationItems.length 
  });

  // Return verification items with standardized format
  return apiSuccess({
    verificationItems,
  });
}, { 
  openApiPath: '/document-verification',
  method: 'get',
  validate: true,
  logMetadata: { endpoint: '/api/document-verification', method: 'GET' }
});