import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

import { patientSummaryService } from '@/lib/services/patient/patient-summary-service'
import { rateLimit } from '@/lib/rate-limit'

/**
 * Patient summary endpoint
 * 
 * GET: Retrieves the patient summary
 * POST: Generates or updates a patient summary
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
  // Rate limiting
  const limiter = rateLimit({
    maxPerMinute: 20,
    maxPerHour: 200,
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

    // Get patient ID from route params
    const { patientId } = params
    if (!patientId) {
      return NextResponse.json(
        {
          error: {
            message: 'Patient ID is required',
            code: 'INVALID_INPUT',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      )
    }

    // Fetch the patient summary
    const summary = await patientSummaryService.getPatientSummary(patientId)
    
    if (!summary) {
      return NextResponse.json(
        {
          error: {
            message: 'Patient summary not found',
            code: 'NOT_FOUND',
            timestamp: new Date().toISOString(),
            details: {
              resource: 'patient_summary',
            },
          },
        },
        { status: 404 }
      )
    }

    // Return success response
    return NextResponse.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error retrieving patient summary:', error)
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Failed to retrieve patient summary',
          code: 'SERVER_ERROR',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
  // Rate limiting
  const limiter = rateLimit({
    maxPerMinute: 5,
    maxPerHour: 50,
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

    // Get patient ID from route params
    const { patientId } = params
    if (!patientId) {
      return NextResponse.json(
        {
          error: {
            message: 'Patient ID is required',
            code: 'INVALID_INPUT',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      )
    }

    // Parse request body
    const requestData = await request.json()
    const { documentIds, generateNew = false } = requestData

    // Generate or update patient summary
    let summary
    if (generateNew) {
      // Generate a new summary from documents
      summary = await patientSummaryService.generatePatientSummary(
        patientId,
        documentIds,
        userId
      )
    } else {
      // Update existing summary
      const existingSummary = await patientSummaryService.getPatientSummary(patientId)
      if (existingSummary && documentIds) {
        // Update with new documents
        summary = await patientSummaryService.updatePatientSummary(
          patientId,
          existingSummary,
          documentIds,
          userId
        )
      } else {
        // Generate new if no existing summary
        summary = await patientSummaryService.generatePatientSummary(
          patientId,
          documentIds,
          userId
        )
      }
    }

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        summary_id: summary.id,
        patient_id: patientId,
        content: summary.content,
        status: summary.status || 'completed',
        generated_at: summary.generated_at || new Date().toISOString(),
        metadata: summary.metadata,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error generating patient summary:', error)
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Failed to generate patient summary',
          code: 'SERVER_ERROR',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    )
  }
}