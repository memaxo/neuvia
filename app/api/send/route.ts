import { Resend } from 'resend'
import { EmailTemplate } from '@/components/email-template'
import { apiError, apiSuccess, withErrorHandling } from '@/lib/api-response'
import { ExternalServiceError, ValidationError } from '@/lib/errors'
import logger from '@/lib/logger'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const moduleLogger = logger.withMetadata({
      module: 'EmailSend',
      method: 'POST'
    });

    moduleLogger.info('Sending email with Resend');

    if (!process.env.RESEND_API_KEY) {
      moduleLogger.error('Missing Resend API key');
      throw new ValidationError({
        message: 'Email service is not properly configured',
        code: 'EMAIL_CONFIG_ERROR'
      });
    }

    // In a real implementation, we would parse the request body
    // and validate the email data before sending
    // const body = await req.json();
    // const { to, subject, firstName } = body;

    try {
      const { data, error } = await resend.emails.send({
        from: 'Acme <onboarding@resend.dev>',
        to: ['delivered@resend.dev'],
        subject: 'Hello world',
        react: EmailTemplate({ firstName: 'John' }),
      });

      if (error) {
        moduleLogger.error('Resend API error', { errorData: error }, error);
        
        throw new ExternalServiceError({
          message: 'Failed to send email',
          service: 'Resend',
          code: 'EMAIL_SEND_FAILED',
          data: { errorDetails: error },
          cause: error instanceof Error ? error : new Error(String(error))
        });
      }

      moduleLogger.info('Email sent successfully', { 
        emailId: data?.id 
      });

      return apiSuccess(data);
    } catch (error) {
      moduleLogger.error('Unexpected error sending email', {}, error);
      
      throw new ExternalServiceError({
        message: 'Failed to send email',
        service: 'Resend',
        code: 'EMAIL_SEND_ERROR',
        cause: error
      });
    }
  }, {
    logMetadata: { endpoint: '/api/send' }
  });
}
