import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getUser } from '@/app/auth/actions';
import { rateLimiter } from '@/lib/rate-limit';
import { scrape } from '@/lib/services/firecrawl/actions';

// Define the API's runtime environment
export const runtime = 'edge';

// Scrape request schema
const scrapeRequestSchema = z.object({
  url: z.string().url("Invalid URL"),
  includeMetadata: z.boolean().optional().default(true),
  format: z.enum(['markdown', 'text', 'html']).optional()
});

/**
 * Firecrawl scrape API handler
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

    // Apply rate limiting - 5 requests per minute (scraping is resource-intensive)
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
    const result = scrapeRequestSchema.safeParse(body);
    
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

    // Perform scraping using the Firecrawl service
    const { url, includeMetadata, format } = result.data;
    const scrapeResponse = await scrape(url, { includeMetadata, format });

    // Return the scrape results
    return NextResponse.json(scrapeResponse);
  } catch (error) {
    console.error('Firecrawl scrape error:', error);
    
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
 * GET method handler for scrape (primarily for testing/documentation)
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
      await (rateLimiter as any).check(request, 5, '1 m');
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Extract query parameters
    const url = request.nextUrl.searchParams.get('url');
    const includeMetadataParam = request.nextUrl.searchParams.get('includeMetadata');
    const formatParam = request.nextUrl.searchParams.get('format');
    
    // Validate URL
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Parse and validate URL
    try {
      new URL(url); // This will throw if the URL is invalid
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }
    
    // Parse parameters
    const includeMetadata = includeMetadataParam ? includeMetadataParam === 'true' : undefined;
    const format = formatParam as 'markdown' | 'text' | 'html' | undefined;
    
    // Validate format if provided
    if (format && !['markdown', 'text', 'html'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Must be markdown, text, or html' },
        { status: 400 }
      );
    }
    
    // Perform scraping
    const scrapeResponse = await scrape(url, { 
      includeMetadata, 
      format
    });

    // Return the scrape results
    return NextResponse.json(scrapeResponse);
  } catch (error) {
    console.error('Firecrawl scrape error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 