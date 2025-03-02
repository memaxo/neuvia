import { patientSummaryService } from '@/lib/services/patient/patient-summary-service'
import { createServerClient } from '@/lib/supabase/clients'
import { ValidationError, NotFoundError, AuthenticationError } from '@/lib/errors'
import { apiSuccess, getRequestId } from '@/lib/api-response'
import { createApiRoute } from '@/lib/api/route-helpers'
import logger from '@/lib/logger'

/**
 * Patient Summary Verification API
 *
 * Endpoint for verifying patient summaries
 */
import { NextRequest } from 'next/server'

/**
 * POST handler for verifying a patient summary
 *
 * @param request The request object
 * @param context Route parameters including the patient ID
 * @returns JSON response indicating success or failure
 */
export const POST = createApiRoute(async (
  request: NextRequest,
  { params }: { params: { patientId: string } }
) => {
  const requestId = getRequestId(request);
  const moduleLogger = logger.withMetadata({
    module: 'API',
    endpoint: '/api/patient/[patientId]/verify-summary',
    method: 'POST',
    requestId
  });
  
  moduleLogger.info('Processing patient summary verification request');
  
  const supabase = await createServerClient();

  // Verify authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new AuthenticationError({
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
      data: { cause: authError }
    });
  }

  // Get patient ID from route params
  const { patientId } = params;

  if (!patientId) {
    throw new ValidationError({
      message: 'Patient ID is required',
      code: 'MISSING_PATIENT_ID'
    });
  }

  // Parse the request body - OpenAPI validation handles this
  const body = await request.json()
  const { status = 'verified', comments } = body

  // Verify the summary
  moduleLogger.info('Verifying patient summary', { 
    patientId, 
    verifierId: user.id, 
    status 
  });
  
  const result = await patientSummaryService.verifySummary(
    patientId,
    user.id,
    status,
    comments
  );

  if (!result) {
    throw new NotFoundError({
      message: 'Summary not found or could not be verified',
      resource: 'PatientSummary',
      code: 'SUMMARY_NOT_FOUND',
      data: { patientId }
    });
  }

  moduleLogger.info('Patient summary verified successfully', { 
    patientId, 
    status,
    timestamp: new Date().toISOString()
  });

  // Return success response
  return apiSuccess({
    message: `Summary for patient ${patientId} has been ${status}`,
    patientId,
    verifiedAt: new Date().toISOString(),
    verifiedBy: user.id,
  });
}, {
  openApiPath: '/patient/{patientId}/verify-summary',
  method: 'post',
  validate: true,
  logMetadata: {
    endpoint: '/api/patient/[patientId]/verify-summary',
    method: 'POST'
  }
});

/**
 * GET handler for checking summary verification status
 *
 * @param request The request object
 * @param context Route parameters including the patient ID
 * @returns JSON response with verification status
 */
export const GET = createApiRoute(async (
  request: NextRequest,
  { params }: { params: { patientId: string } }
) => {
  const requestId = getRequestId(request);
  const moduleLogger = logger.withMetadata({
    module: 'API',
    endpoint: '/api/patient/[patientId]/verify-summary',
    method: 'GET',
    requestId
  });
  
  moduleLogger.info('Checking patient summary verification status');
  
  const supabase = await createServerClient();

  // Verify authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new AuthenticationError({
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
      data: { cause: authError }
    });
  }

  // Get patient ID from route params
  const { patientId } = params;

  if (!patientId) {
    throw new ValidationError({
      message: 'Patient ID is required',
      code: 'MISSING_PATIENT_ID'
    });
  }

  // Get verification status
  moduleLogger.info('Fetching summary verification status', { patientId });
  const status = await patientSummaryService.getSummaryVerificationStatus(patientId);

  if (!status) {
    moduleLogger.info('Summary has not been verified', { patientId });
    
    // This is not an error, just a valid state
    return apiSuccess({
      verified: false,
      message: 'Summary has not been verified',
      patientId,
    });
  }

  moduleLogger.info('Retrieved verification status', { 
    patientId, 
    status: status.status,
    verifiedAt: status.verifiedAt
  });

  // Return verification status
  return apiSuccess({
    verified: true,
    status: status.status,
    verifiedAt: status.verifiedAt,
    verifiedBy: status.verifiedBy,
    patientId,
  });
}, {
  openApiPath: '/patient/{patientId}/verify-summary',
  method: 'get',
  validate: true,
  logMetadata: {
    endpoint: '/api/patient/[patientId]/verify-summary',
    method: 'GET'
  }
});