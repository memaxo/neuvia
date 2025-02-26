/**
 * Perplexity Research API Route
 * 
 * Handles research requests and delegates to the Perplexity API
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { ResearchOptions } from '@/lib/processing/types/research';
import { createServerClient } from '@/lib/supabase/clients';
import { perplexityService } from '@/lib/services/perplexity/perplexity-service';

/**
 * POST handler for research requests
 * 
 * @param req The request object
 * @returns JSON response with research results
 */
export async function POST(req: NextRequest) {
  try {
    // Create Supabase client
    const supabase = await createServerClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse the request body
    const body = await req.json();
    const { query, options } = body;
    
    // Validate the request
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }
    
    // Prepare research options
    const researchOptions: ResearchOptions = {
      depth: options?.depth || 'standard',
      sourcesLimit: options?.sourcesLimit || 5,
      includeSourceContent: options?.includeSourceContent ?? true,
      isMedicalDiagnosis: options?.isMedicalDiagnosis || false,
      patientData: options?.patientData
    };
    
    // Record the start time for metrics
    const startTime = Date.now();
    
    // Perform the research using the unified Perplexity service
    const result = options?.isMedicalDiagnosis && options?.patientData
      ? await perplexityService.performMedicalDiagnosis(query, options.patientData, researchOptions)
      : await perplexityService.performDeepResearch(query, researchOptions);
    
    // Calculate the elapsed time
    const elapsed = Date.now() - startTime;
    
    // Return the result with timing information
    return NextResponse.json({
      ...result,
      _meta: {
        elapsed: `${elapsed}ms`,
        provider: 'perplexity'
      }
    });
  } catch (error) {
    console.error('[API] Perplexity research error:', error);
    return NextResponse.json(
      { error: `Research failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 