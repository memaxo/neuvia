/**
 * Firecrawl Service Types
 * 
 * Type definitions for the Firecrawl service integration.
 */

/**
 * Allowed Firecrawl tools/operations
 */
export type FirecrawlTool = 'search' | 'extract' | 'scrape' | 'deepResearch';

/**
 * Search result from Firecrawl
 */
export interface SearchResult {
  /**
   * Title of the search result
   */
  title: string;
  
  /**
   * URL of the search result
   */
  url: string;
  
  /**
   * Optional description snippet
   */
  description?: string;
  
  /**
   * Source of the result (e.g., "Google Scholar")
   */
  source?: string;
  
  /**
   * URL to the favicon for the result
   */
  favicon?: string;
  
  /**
   * Relevance score (if available)
   */
  relevance?: number;
}

/**
 * Options for search requests
 */
export interface SearchOptions {
  /**
   * Maximum number of results to return
   */
  maxResults?: number;
  
  /**
   * Whether to include favicons in results
   */
  includeFavicons?: boolean;
  
  /**
   * Any filters to apply to the search
   */
  filters?: Record<string, string>;
}

/**
 * Extraction result from Firecrawl
 */
export interface ExtractResult {
  /**
   * URL that was extracted from
   */
  url: string;
  
  /**
   * Extracted structured data
   */
  data: any;
}

/**
 * Options for extraction requests
 */
export interface ExtractOptions {
  /**
   * Prompt describing what data to extract
   */
  prompt: string;
  
  /**
   * Format for the extraction results
   */
  format?: 'json' | 'markdown' | 'text';
}

/**
 * Scrape result from Firecrawl
 */
export interface ScrapeResult {
  /**
   * URL that was scraped
   */
  url: string;
  
  /**
   * Scraped content
   */
  data: string;
  
  /**
   * Title of the page (if available)
   */
  title?: string;
  
  /**
   * Metadata from the page
   */
  metadata?: {
    description?: string;
    keywords?: string;
    robots?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogUrl?: string;
    ogImage?: string;
    ogLocaleAlternate?: string;
    ogSiteName?: string;
    sourceURL?: string;
    pageStatusCode?: number;
  };
}

/**
 * Options for scrape requests
 */
export interface ScrapeOptions {
  /**
   * Whether to include page metadata
   */
  includeMetadata?: boolean;
  
  /**
   * Format for the scraped content
   */
  format?: 'markdown' | 'text' | 'html';
}

/**
 * Generic response from Firecrawl API
 */
export interface FirecrawlResponse<T> {
  /**
   * Whether the request was successful
   */
  success: boolean;
  
  /**
   * Error message (if success is false)
   */
  error?: string;
  
  /**
   * Response data (if success is true)
   */
  data?: T;
}

/**
 * Error from Firecrawl API
 */
export class FirecrawlError extends Error {
  /**
   * Status code from the API
   */
  statusCode?: number;
  
  /**
   * Raw response from the API
   */
  response?: any;
  
  constructor(message: string, statusCode?: number, response?: any) {
    super(message);
    this.name = 'FirecrawlError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

/**
 * Available Firecrawl tools
 */
export const firecrawlTools: FirecrawlTool[] = ['search', 'extract', 'scrape', 'deepResearch']; 