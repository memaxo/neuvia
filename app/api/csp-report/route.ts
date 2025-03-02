import type { NextRequest } from 'next/server'
import logger from '@/lib/logger'
import { withErrorHandling, apiSuccess, getRequestId } from '@/lib/api-response'
import { ValidationError, SystemError } from '@/lib/errors'

/**
 * Handler for Content Security Policy violation reports
 * 
 * This endpoint receives and processes CSP violation reports sent by browsers.
 * No authentication is required as these reports come directly from user browsers.
 */
export async function POST(request: NextRequest) {
  // Use the error handling wrapper for consistent error responses
  return withErrorHandling(async () => {
    // Extract request ID for correlating logs
    const requestId = getRequestId(request)
    
    // Structured logging context
    const moduleLogger = logger.withMetadata({
      module: 'CSPReporter',
      method: 'POST',
      requestId,
      endpoint: '/api/csp-report',
      sourceIp: request.headers.get('x-forwarded-for') || 'unknown'
    })
    
    moduleLogger.info('Processing CSP violation report')
    
    // Parse the CSP report
    let report
    try {
      report = await request.json()
    } catch (error) {
      moduleLogger.warn('Failed to parse CSP report', {}, error)
      
      // Specific validation error with proper status code
      throw new ValidationError({
        message: 'Invalid CSP report format',
        code: 'INVALID_REPORT_FORMAT',
        data: { 
          contentType: request.headers.get('content-type'),
          contentLength: request.headers.get('content-length')
        },
        cause: error
      })
    }
    
    // Validate expected structure
    if (!report['csp-report']) {
      moduleLogger.warn('Malformed CSP report received', { reportKeys: Object.keys(report) })
      
      throw new ValidationError({
        message: 'Missing csp-report field',
        code: 'MISSING_REPORT_DATA',
        data: { 
          reportStructure: Object.keys(report),
          userAgent: request.headers.get('user-agent')
        }
      })
    }
    
    try {
      // Extract key information from the report
      const cspReport = report['csp-report']
      const blockedUri = cspReport['blocked-uri'] || 'not-specified'
      const violatedDirective = cspReport['violated-directive'] || 'not-specified'
      const documentUri = cspReport['document-uri'] || 'not-specified'
      const sourceFile = cspReport['source-file'] || 'not-specified'
      const lineNumber = cspReport['line-number'] || 'not-specified'
      const columnNumber = cspReport['column-number'] || 'not-specified'
      
      // Log CSP violations in a structured way
      moduleLogger.warn(
        'CSP Violation detected', 
        {
          blockedUri,
          violatedDirective,
          documentUri,
          sourceFile,
          lineNumber,
          columnNumber,
          userAgent: request.headers.get('user-agent'),
          timestamp: new Date().toISOString()
        }
      )
      
      // In production, you might want to send this to your monitoring service
      // try {
      //   await securityService.reportCspViolation(report)
      // } catch (monitorError) {
      //   logger.error('Failed to send CSP violation to monitoring', {}, monitorError)
      // }
      
      // Return a standardized success response
      return apiSuccess(
        { 
          reported: true,
          timestamp: new Date().toISOString()
        }, 
        { 
          status: 202, // Accepted
          headers: { 'Cache-Control': 'no-store' }
        }
      )
    } catch (error) {
      moduleLogger.error('Failed to process CSP report', { 
        hasReportData: !!report['csp-report'] 
      }, error)
      
      if (error instanceof ValidationError) {
        throw error
      }
      
      throw new SystemError({
        message: 'Failed to process CSP report',
        code: 'CSP_PROCESSING_ERROR',
        cause: error
      })
    }
  }, {
    // These options are passed to error handling
    logMetadata: { 
      feature: 'csp-reporting',
      component: 'api'
    }
  })
}