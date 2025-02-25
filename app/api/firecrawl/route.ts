import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getUser } from '@/app/auth/actions';
import { rateLimiter } from '@/lib/rate-limit';
import firecrawlConfig from '@/lib/config/firecrawl';
import { firecrawlTools } from '@/lib/services/firecrawl/types';

// Define the API's runtime environment
export const runtime = 'edge';

/**
 * Main Firecrawl API information handler
 * Returns available tools and configuration info
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

    // Apply rate limiting - 15 requests per minute
    try {
      await (rateLimiter as any).check(request, 15, '1 m');
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Return API info
    return NextResponse.json({
      success: true,
      data: {
        version: '1.0.0',
        availableTools: firecrawlTools,
        endpoints: [
          '/api/firecrawl/search',
          '/api/firecrawl/extract',
          '/api/firecrawl/scrape'
        ],
        limits: {
          searchResultsLimit: firecrawlConfig.defaultSearchLimit,
          maxRetries: firecrawlConfig.maxRetries
        }
      }
    });
  } catch (error) {
    console.error('Firecrawl API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 