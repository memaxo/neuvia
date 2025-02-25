/**
 * Firecrawl Actions
 * 
 * Core API calls for interacting with Firecrawl.
 */
import { getFirecrawlClient, createFirecrawlLoader, logFirecrawlError } from './client';
import firecrawlConfig from '@/lib/config/firecrawl';
import type { 
  SearchResult, 
  ExtractResult, 
  ScrapeResult,
  SearchOptions,
  ExtractOptions,
  ScrapeOptions,
  FirecrawlResponse,
  FirecrawlError
} from './types';

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries
 * @param baseDelay Base delay in milliseconds
 */
async function retry<T>(
  fn: () => Promise<T>, 
  maxRetries: number = firecrawlConfig.maxRetries, 
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't wait on the last attempt
      if (attempt < maxRetries) {
        // Calculate exponential backoff with jitter
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
          30000 // Max 30 seconds
        );
        
        if (firecrawlConfig.debug) {
          console.log(`Firecrawl retry ${attempt + 1}/${maxRetries}, waiting ${Math.round(delay)}ms`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Perform a search using Firecrawl
 * @param query Search query
 * @param options Search options
 */
export async function search(
  query: string,
  options?: SearchOptions
): Promise<FirecrawlResponse<SearchResult[]>> {
  try {
    const client = getFirecrawlClient();
    
    // Use retry logic
    const result = await retry(async () => {
      return await client.search(query, {
        limit: options?.maxResults || firecrawlConfig.defaultSearchLimit
      });
    });
    
    if (!result.success) {
      const error = result.error || 'Unknown search error';
      logFirecrawlError(new Error(error), 'search');
      return { success: false, error };
    }
    
    // Process the results
    const searchResults = result.data.map((item: any) => {
      let favicon: string | undefined = undefined;
      
      try {
        if (options?.includeFavicons !== false && firecrawlConfig.includeFavicons) {
          const url = new URL(item.url ?? '');
          favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
        }
      } catch (e) {
        // If URL parsing fails, just skip the favicon
        if (firecrawlConfig.debug) {
          console.warn(`Failed to parse URL for favicon: ${item.url}`);
        }
      }
        
      return {
        title: item.title ?? '',
        url: item.url ?? '',
        description: item.description,
        source: item.source,
        favicon,
        relevance: item.relevance
      };
    });
    
    return {
      success: true,
      data: searchResults
    };
  } catch (error) {
    logFirecrawlError(error, 'search');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during search'
    };
  }
}

/**
 * Extract structured data from web pages
 * @param urls URLs to extract from
 * @param prompt Description of what data to extract
 * @param options Additional extraction options
 */
export async function extract(
  urls: string[],
  prompt: string,
  options?: Omit<ExtractOptions, 'prompt'>
): Promise<FirecrawlResponse<ExtractResult[]>> {
  try {
    const client = getFirecrawlClient();
    
    // Use retry logic
    const result = await retry(async () => {
      return await client.extract(urls, { 
        prompt,
        format: options?.format
      });
    });
    
    if (!result.success) {
      const error = result.error || 'Unknown extraction error';
      logFirecrawlError(new Error(error), 'extract');
      return { success: false, error };
    }
    
    // Process and validate the results
    const extractResults = (result.data || []).map((item: any) => {
      // Ensure the URL is present
      if (!item.url) {
        console.warn('Extract result missing URL:', item);
      }
      
      return {
        url: item.url || '',
        data: item.data || {}
      };
    });
    
    return {
      success: true,
      data: extractResults
    };
  } catch (error) {
    logFirecrawlError(error, 'extract');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during extraction'
    };
  }
}

/**
 * Scrape content from a web page
 * @param url URL to scrape
 * @param options Scrape options
 */
export async function scrape(
  url: string,
  options?: ScrapeOptions
): Promise<FirecrawlResponse<ScrapeResult>> {
  try {
    // Create loader with the configured options
    const loader = createFirecrawlLoader(url, 'scrape');
    
    // Use retry logic
    const docs = await retry(async () => {
      return await loader.load();
    });
    
    if (!docs.length) {
      const error = 'No content found on the page';
      logFirecrawlError(new Error(error), 'scrape');
      return {
        success: false,
        error
      };
    }
    
    const doc = docs[0];
    
    // Validate the doc has pageContent
    if (!doc.pageContent) {
      const error = 'Scraped page has no content';
      logFirecrawlError(new Error(error), 'scrape');
      return {
        success: false,
        error
      };
    }
    
    // Process the result
    const result: ScrapeResult = {
      url,
      data: doc.pageContent,
      title: doc.metadata.title,
      metadata: options?.includeMetadata !== false ? {
        description: doc.metadata.description,
        keywords: doc.metadata.keywords,
        robots: doc.metadata.robots,
        ogTitle: doc.metadata.ogTitle,
        ogDescription: doc.metadata.ogDescription,
        ogUrl: doc.metadata.ogUrl,
        ogImage: doc.metadata.ogImage,
        ogLocaleAlternate: doc.metadata.ogLocaleAlternate,
        ogSiteName: doc.metadata.ogSiteName,
        sourceURL: doc.metadata.sourceURL,
        pageStatusCode: doc.metadata.pageStatusCode ?? 200,
      } : undefined
    };
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    logFirecrawlError(error, 'scrape');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during scraping'
    };
  }
}

/**
 * Perform deep research using Firecrawl
 * @param query Research query
 * @param options Research options
 */
export async function deepResearch(
  query: string,
  options?: {
    maxResults?: number;
    includeContent?: boolean;
    synthesize?: boolean;
  }
): Promise<FirecrawlResponse<{
  query: string;
  results: SearchResult[];
  extractions: ExtractResult[];
  summary?: string;
}>> {
  try {
    // 1. Perform search
    const searchResponse = await search(query, {
      maxResults: options?.maxResults || 5
    });
    
    if (!searchResponse.success) {
      return {
        success: false,
        error: `Research failed at search step: ${searchResponse.error}`
      };
    }
    
    // No results
    if (!searchResponse.data || searchResponse.data.length === 0) {
      return {
        success: true,
        data: {
          query,
          results: [],
          extractions: []
        }
      };
    }
    
    // 2. Extract from top results
    const urls = searchResponse.data.map(result => result.url);
    const extractPrompt = `Extract key information related to "${query}". Include factual information only.`;
    
    const extractResponse = await extract(urls, extractPrompt, {
      format: 'json'
    });
    
    // Even if extraction fails, we can still return search results
    const extractions = extractResponse.success ? extractResponse.data || [] : [];
    
    // 3. Generate summary if requested
    let summary: string | undefined = undefined;
    
    if (options?.synthesize) {
      // This would be implemented with a call to an LLM or using Firecrawl directly
      // Placeholder for now
      summary = `Results for "${query}" synthesized from ${searchResponse.data.length} sources.`;
    }
    
    return {
      success: true,
      data: {
        query,
        results: searchResponse.data,
        extractions,
        summary
      }
    };
  } catch (error) {
    logFirecrawlError(error, 'deepResearch');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during deep research'
    };
  }
} 