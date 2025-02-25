import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getUser } from '@/app/auth/actions';
import { rateLimiter } from '@/lib/rate-limit';
import { extract } from '@/lib/services/firecrawl/actions';

// Define the API's runtime environment
export const runtime = 'edge';

// Extract request schema
const extractRequestSchema = z.object({
  urls: z.array(z.string().url("Invalid URL")).min(1, "At least one URL is required"),
  prompt: z.string().min(1, "Extraction prompt is required"),
  format: z.enum(['json', 'markdown', 'text']).optional()
});

/**
 * Firecrawl extract API handler
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

    // Apply rate limiting - 5 requests per minute (extraction is resource-intensive)
    try {
      await (rateLimiter as any).check(request, 5, '1 m');
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const result = extractRequestSchema.safeParse(body);
    
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

    // Perform extraction using the Firecrawl service
    const { urls, prompt, format } = result.data;
    const extractionResponse = await extract(urls, prompt, { format });

    // Return the extraction results
    return NextResponse.json(extractionResponse);
  } catch (error) {
    console.error('Firecrawl extraction error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 