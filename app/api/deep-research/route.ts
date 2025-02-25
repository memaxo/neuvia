import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getUser } from '@/app/auth/actions';
import { rateLimiter } from '@/lib/rate-limit';
import { deepResearch } from '@/lib/services/firecrawl/actions';

// Define the API's runtime environment
export const runtime = 'edge';

// Request schema
const researchRequestSchema = z.object({
  topic: z.string().min(1, "Research topic is required"),
  maxResults: z.number().optional().default(5),
  includeContent: z.boolean().optional().default(true),
  synthesize: z.boolean().optional().default(true)
});

/**
 * Deep Research API handler
 * This endpoint uses the Firecrawl service to perform comprehensive research
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getUser();
    if (!session?.data?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Apply rate limiting - 3 requests per minute (research is intensive)
    try {
      await (rateLimiter as any).check(request, 3, '1 m');
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const result = researchRequestSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data', 
          details: result.error.errors 
        },
        { status: 400 }
      );
    }

    // Perform the deep research
    const { topic, maxResults, includeContent, synthesize } = result.data;
    
    console.log(`[DeepResearch] Researching topic: ${topic}`);
    
    const researchResponse = await deepResearch(topic, { 
      maxResults, 
      includeContent,
      synthesize
    });

    // Handle research failures
    if (!researchResponse.success) {
      console.error(`[DeepResearch] Failed: ${researchResponse.error}`);
      return NextResponse.json(
        { 
          success: false, 
          error: researchResponse.error || 'Research operation failed' 
        },
        { status: 500 }
      );
    }

    // Transform the data into a report-friendly format
    const reportData = {
      topic,
      results: researchResponse.data?.results || [],
      extractions: researchResponse.data?.extractions || [],
      summary: researchResponse.data?.summary || `Research results for: ${topic}`,
      timestamp: new Date().toISOString()
    };

    // Return the research results
    return NextResponse.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    console.error('Deep research error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 