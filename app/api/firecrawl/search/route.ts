import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getUser } from '@/app/auth/actions';
import { rateLimiter } from '@/lib/rate-limit';
import { search } from '@/lib/services/firecrawl/actions';
import firecrawlConfig from '@/lib/config/firecrawl';

// Define the API's runtime environment
export const runtime = 'edge';

// Search request schema
const searchRequestSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  maxResults: z.number().optional().default(firecrawlConfig.defaultSearchLimit),
  includeFavicons: z.boolean().optional().default(true),
  filters: z.record(z.string()).optional()
});

/**
 * Firecrawl search API handler
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

    // Apply rate limiting - 10 requests per minute
    try {
      await (rateLimiter as any).check(request, 10, '1 m');
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const result = searchRequestSchema.safeParse(body);
    
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

    // Perform the search using the Firecrawl service
    const { query, maxResults, includeFavicons, filters } = result.data;
    const searchResponse = await search(query, { 
      maxResults, 
      includeFavicons,
      filters
    });

    // Return the search results
    return NextResponse.json(searchResponse);
  } catch (error) {
    console.error('Firecrawl search error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET method handler for search (primarily for testing/documentation)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getUser();
    if (!session?.data?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Apply rate limiting
    try {
      await (rateLimiter as any).check(request, 10, '1 m');
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Extract query parameters
    const query = request.nextUrl.searchParams.get('query');
    const maxResultsParam = request.nextUrl.searchParams.get('maxResults');
    const includeFaviconsParam = request.nextUrl.searchParams.get('includeFavicons');
    
    // Validate query
    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Parse and validate parameters
    const maxResults = maxResultsParam ? parseInt(maxResultsParam, 10) : undefined;
    const includeFavicons = includeFaviconsParam ? includeFaviconsParam === 'true' : undefined;
    
    // Perform the search
    const searchResponse = await search(query, { 
      maxResults, 
      includeFavicons
    });

    // Return the search results
    return NextResponse.json(searchResponse);
  } catch (error) {
    console.error('Firecrawl search error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 