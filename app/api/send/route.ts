import { Resend } from 'resend'
import { EmailTemplate } from '@/components/email-template'
import { apiSuccess, getRequestId } from '@/lib/api-response'
import { 
  ExternalServiceError, 
  ValidationError, 
  AuthenticationError,
  SystemError 
} from '@/lib/errors'
import { createApiRoute } from '@/lib/api/route-helpers'
import logger from '@/lib/logger'
import { createServerClient } from '@/lib/supabase/clients'

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Email sending API endpoint
 * 
 * Handles sending emails through the Resend service
 */
export const POST = createApiRoute(async (req: Request) => {
  const requestId = getRequestId(req);
  const moduleLogger = logger.withMetadata({
    module: 'EmailSend',
    method: 'POST',
    requestId,
    endpoint: '/api/send'
  });

  moduleLogger.info('Processing email send request');

  // Verify authentication
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    moduleLogger.warn('Authentication failed', { authError });
    throw new AuthenticationError({
      message: 'Authentication required to send emails',
      code: 'AUTH_REQUIRED',
      data: { error: authError?.message }
    });
  }

  // Validate environment configuration
  if (!process.env.RESEND_API_KEY) {
    moduleLogger.error('Missing Resend API key');
    throw new SystemError({
      message: 'Email service is not properly configured',
      code: 'EMAIL_CONFIG_ERROR'
    });
  }

  // Parse request body
  let body;
  try {
    body = await req.json();
  } catch (error) {
    moduleLogger.error('Failed to parse request JSON', {}, error);
    throw new ValidationError({
      message: 'Invalid JSON in request body',
      code: 'INVALID_JSON'
    });
  }

  // Validate required fields - validation is handled by OpenAPI validation middleware
  const { to, subject, firstName } = body;

  moduleLogger.info('Sending email with Resend', { 
    recipientCount: to.length,
    userId: user.id
  });

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Neuvia <no-reply@neuvia.app>',
      to,
      subject,
      react: EmailTemplate({ firstName }),
    });

    if (error) {
      moduleLogger.error('Resend API error', { errorData: error }, error);
      
      throw new ExternalServiceError({
        message: 'Failed to send email',
        service: 'Resend',
        code: 'EMAIL_SEND_FAILED',
        data: { 
          errorDetails: error,
          recipientCount: to.length,
          userId: user.id
        },
        cause: error instanceof Error ? error : new Error(String(error))
      });
    }

    moduleLogger.info('Email sent successfully', { 
      emailId: data?.id,
      recipientCount: to.length,
      userId: user.id,
      timestamp: new Date().toISOString()
    });

    return apiSuccess({
      id: data?.id,
      sent: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // If it's already an ExternalServiceError, no need to wrap it again
    if (error instanceof ExternalServiceError) {
      throw error;
    }
    
    moduleLogger.error('Unexpected error sending email', {
      recipientCount: to?.length,
      userId: user?.id
    }, error);
    
    throw new ExternalServiceError({
      message: 'Failed to send email',
      service: 'Resend',
      code: 'EMAIL_SEND_ERROR',
      data: {
        recipientCount: to?.length,
        userId: user?.id
      },
      cause: error
    });
  }
}, {
  openApiPath: '/send',
  method: 'post',
  validate: true,
  logMetadata: { endpoint: '/api/send' }
});