import type { ResearchOptions } from '@/lib/processing/types/research'
import { perplexityService } from '@/lib/services/perplexity/perplexity-service'
import { createServerClient } from '@/lib/supabase/clients'
/**
 * Perplexity Research API Route
 *
 * Handles all research requests including medical diagnoses and general research
 * through a unified API endpoint.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Type for structured API errors
interface ApiError {
  message: string
  code?: string
  details?: unknown
  context?: Record<string, unknown>
}

/**
 * POST handler for research requests
 *
 * @param req The request object
 * @returns JSON response with research results
 */
export async function POST(req: NextRequest) {
  try {
    // Create Supabase client
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

    // Parse the request body
    const body = await req.json()
    const { query, options, documentId } = body

    // Validate the request
    if (!query && !documentId) {
      return NextResponse.json(
        { error: 'Either query or documentId is required' },
        { status: 400 }
      )
    }

    if (query && typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query must be a string' },
        { status: 400 }
      )
    }

    // Prepare research options
    const researchOptions: ResearchOptions = {
      depth: options?.depth || 'standard',
      sourcesLimit: options?.sourcesLimit || 5,
      includeSourceContent: options?.includeSourceContent ?? true,
      isMedicalDiagnosis: options?.isMedicalDiagnosis || false,
      patientData: options?.patientData,
    }

    // Handle document-based research (primarily for medical diagnoses)
    if (documentId) {
      // Mark as medical diagnosis if not explicitly set
      researchOptions.isMedicalDiagnosis = options?.isMedicalDiagnosis !== false

      try {
        // Get document data - using any to bypass type issues
        // The correct table name is determined based on the medical diagnosis routes
        const { data: document, error: documentError } = await supabase
          .from('patient_documents')
          .select('*')
          .eq('id', documentId)
          .single()

        if (documentError || !document) {
          return NextResponse.json(
            {
              error: `Document not found: ${documentError?.message || ''}`,
              code: 'DOCUMENT_NOT_FOUND',
              documentId,
            },
            { status: 404 }
          )
        }

        // Collect patient data from available sources
        let patientData = ''

        // Try various approaches to get document content
        // Using any types to bypass schema issues

        try {
          // Try to get document chunks
          const { data: chunks } = await supabase
            .from('document_chunks')
            .select('content')
            .eq('document_id', documentId)
            .order('page_number', { ascending: true })

          if (chunks && chunks.length > 0) {
            patientData = chunks.map((chunk: any) => chunk.content).join('\n\n')
          }
        } catch (chunkError) {
          console.log('[API] Error fetching document chunks:', chunkError)
          // Continue with alternative method - this is not fatal
        }

        // If still no data, use document content directly - check both field names
        if (!patientData) {
          // Handle different field names in different document tables
          if (typeof document === 'object') {
            if ('content_text' in document && document.content_text) {
              patientData = document.content_text
            } else if ('content' in document && document.content) {
              patientData =
                typeof document.content === 'string'
                  ? document.content
                  : JSON.stringify(document.content, null, 2)
            }
          }
        }

        if (!patientData) {
          const error: ApiError = {
            message: 'No content found for document',
            code: 'DOCUMENT_CONTENT_MISSING',
            context: { documentId, documentType: document.category },
          }

          return NextResponse.json({ error }, { status: 400 })
        }

        // Set the patient data in options
        researchOptions.patientData = patientData

        // For medical diagnoses from documents, use optimized parameters if not specified
        if (researchOptions.isMedicalDiagnosis) {
          researchOptions.maxTokens = options?.maxTokens || 4000
          researchOptions.temperature = options?.temperature || 0.5
          researchOptions.depth = options?.depth || 'comprehensive'
        }
      } catch (dbError) {
        console.error('[API] Database error while fetching document:', dbError)
        return NextResponse.json(
          {
            error: 'Failed to retrieve document data',
            code: 'DATABASE_ERROR',
            details:
              dbError instanceof Error ? dbError.message : String(dbError),
          },
          { status: 500 }
        )
      }
    }

    // Record the start time for metrics
    const startTime = Date.now()

    // Determine appropriate query text
    const queryText =
      query ||
      (researchOptions.isMedicalDiagnosis
        ? 'Provide a comprehensive differential diagnosis based on the patient data'
        : 'Research this topic thoroughly')

    try {
      // Perform the research using the unified Perplexity service
      const result =
        researchOptions.isMedicalDiagnosis && researchOptions.patientData
          ? await perplexityService.performMedicalDiagnosis(
              queryText,
              researchOptions.patientData,
              researchOptions
            )
          : await perplexityService.performDeepResearch(
              queryText,
              researchOptions
            )

      // Calculate the elapsed time
      const elapsed = Date.now() - startTime

      // Prepare the response
      const response = {
        ...result,
        _meta: {
          elapsed: `${elapsed}ms`,
          provider: 'perplexity',
          requestTime: new Date().toISOString(),
          ...(documentId ? { documentId } : {}),
        },
      }

      // Return the result with timing information
      return NextResponse.json(response)
    } catch (apiError) {
      // Use more detailed error handling for API errors
      console.error('[API] Perplexity API error:', apiError)

      // Return a structured error response
      const errorResponse: ApiError = {
        message: 'Research operation failed',
        code: 'PERPLEXITY_API_ERROR',
        details:
          apiError instanceof Error ? apiError.message : String(apiError),
        context: {
          query: queryText,
          isMedicalDiagnosis: researchOptions.isMedicalDiagnosis,
          elapsedMs: Date.now() - startTime,
        },
      }

      return NextResponse.json({ error: errorResponse }, { status: 500 })
    }
  } catch (error) {
    // Global error handler for unexpected errors
    console.error('[API] Perplexity research unexpected error:', error)

    return NextResponse.json(
      {
        error: `Research failed: ${error instanceof Error ? error.message : String(error)}`,
        code: 'UNEXPECTED_ERROR',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
