import { patientSummaryService } from '@/lib/services/patient/patient-summary-service'
import { createServerClient } from '@/lib/supabase/clients'
/**
 * Patient Summary Verification API
 *
 * Endpoint for verifying patient summaries
 */
import { NextResponse } from 'next/server'

/**
 * POST handler for verifying a patient summary
 *
 * @param request The request object
 * @param context Route parameters including the patient ID
 * @returns JSON response indicating success or failure
 */
export async function POST(
  request: Request,
  { params }: { params: { patientId: string } }
) {
  try {
    const supabase = await createServerClient()

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get patient ID from route params
    const { patientId } = params

    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID is required' },
        { status: 400 }
      )
    }

    // Parse the request body
    const body = await request.json()
    const { status = 'verified', comments } = body

    // Verify the summary
    const result = await patientSummaryService.verifySummary(
      patientId,
      user.id,
      status,
      comments
    )

    if (!result) {
      return NextResponse.json(
        { error: 'Summary not found or could not be verified' },
        { status: 404 }
      )
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: `Summary for patient ${patientId} has been ${status}`,
      patientId,
      verifiedAt: new Date().toISOString(),
      verifiedBy: user.id,
    })
  } catch (error) {
    console.error('Error verifying patient summary:', error)

    return NextResponse.json(
      {
        error: `Failed to verify summary: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * GET handler for checking summary verification status
 *
 * @param request The request object
 * @param context Route parameters including the patient ID
 * @returns JSON response with verification status
 */
export async function GET(
  request: Request,
  { params }: { params: { patientId: string } }
) {
  try {
    const supabase = await createServerClient()

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get patient ID from route params
    const { patientId } = params

    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID is required' },
        { status: 400 }
      )
    }

    // Get verification status
    const status =
      await patientSummaryService.getSummaryVerificationStatus(patientId)

    if (!status) {
      return NextResponse.json(
        {
          verified: false,
          message: 'Summary has not been verified',
          patientId,
        },
        { status: 200 }
      )
    }

    // Return verification status
    return NextResponse.json({
      verified: true,
      status: status.status,
      verifiedAt: status.verifiedAt,
      verifiedBy: status.verifiedBy,
      patientId,
    })
  } catch (error) {
    console.error('Error checking summary verification status:', error)

    return NextResponse.json(
      {
        error: `Failed to check verification status: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
