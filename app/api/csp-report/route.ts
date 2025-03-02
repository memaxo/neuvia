import type { NextRequest } from 'next/server'
import logger from '@/lib/logger'
import { apiSuccess, getRequestId } from '@/lib/api-response'
import { ValidationError, SystemError } from '@/lib/errors'
import { createApiRoute } from '@/lib/api/route-helpers'

/**
 * Handler for Content Security Policy violation reports
 * 
 * This endpoint receives and processes CSP violation reports sent by browsers.
 * No authentication is required as these reports come directly from user browsers.
 */
export const POST = createApiRoute(async (request: NextRequest) => {
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
  
  // Parse the CSP report - done by the middleware now
  const report = await request.json()
  
  // Validate expected structure - schemaValidation middleware now handles this
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
  openApiPath: '/csp-report',
  method: 'post',
  validate: true,
  logMetadata: { 
    feature: 'csp-reporting',
    component: 'api'
  }
})