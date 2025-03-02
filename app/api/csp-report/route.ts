import type { NextRequest } from 'next/server'
import logger from '@/lib/logger'
import { withErrorHandling, apiSuccess, getRequestId } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'

/**
 * Handler for Content Security Policy violation reports
 */
export async function POST(request: NextRequest) {
  // Use the error handling wrapper for consistent error responses
  return withErrorHandling(async () => {
    // Extract request ID for correlating logs
    const requestId = getRequestId(request)
    
    // Structured logging context
    const logContext = {
      module: 'csp-reporter',
      requestId,
      path: request.url,
      method: request.method
    }
    
    // Parse the CSP report
    let report
    try {
      report = await request.json()
    } catch (error) {
      // Specific validation error with proper status code
      throw new ValidationError({
        message: 'Invalid CSP report format',
        code: 'INVALID_REPORT_FORMAT',
        cause: error
      })
    }
    
    // Validate expected structure
    if (!report['csp-report']) {
      throw new ValidationError({
        message: 'Missing csp-report field',
        code: 'MISSING_REPORT_DATA'
      })
    }
    
    // Log CSP violations in a structured way
    logger.warn(
      'CSP Violation detected', 
      {
        ...logContext,
        blockedUri: report['csp-report']['blocked-uri'],
        violatedDirective: report['csp-report']['violated-directive'],
        sourceFile: report['csp-report']['source-file'],
        documentUri: report['csp-report']['document-uri'],
      }
    )
    
    // In production, you might want to send this to your monitoring service
    // await securityService.reportCspViolation(report)
    
    // Return a standardized success response
    return apiSuccess(
      { reported: true }, 
      { 
        status: 202, // Accepted
        headers: { 'Cache-Control': 'no-store' }
      }
    )
  }, {
    // These options are passed to error handling
    logMetadata: { 
      feature: 'csp-reporting',
      component: 'api'
    }
  })
}
