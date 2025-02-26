/**
 * @deprecated DEPRECATED: This Firecrawl implementation has been replaced with the Perplexity
 * Deep Research API integration. Please use the new implementation in lib/services/research/perplexity-client.ts.
 * 
 * This file is maintained for backward compatibility but will be removed in a future version.
 * 
 * Firecrawl Client
 * 
 * Client for interacting with the Firecrawl API.
 */
import FirecrawlApp from '@mendable/firecrawl-js';
import { FireCrawlLoader } from '@langchain/community/document_loaders/web/firecrawl';

import firecrawlConfig, { validateFirecrawlConfig } from '@/lib/config/firecrawl';
import { FirecrawlError } from './types';

/**
 * Creates a Firecrawl client instance with error handling
 */
export function createFirecrawlClient(): FirecrawlApp {
  // Validate configuration
  validateFirecrawlConfig();
  
  // Create client instance
  const client = new FirecrawlApp({
    apiKey: firecrawlConfig.apiKey,
  });
  
  return client;
}

/**
 * Creates a FireCrawl loader for document operations
 * @param url URL to load
 * @param mode Operation mode
 */
export function createFirecrawlLoader(
  url: string, 
  mode: 'scrape' | 'extract' = 'scrape'
): FireCrawlLoader {
  // Validate configuration
  validateFirecrawlConfig();
  
  // Create loader instance
  const loader = new FireCrawlLoader({
    url,
    apiKey: firecrawlConfig.apiKey,
    mode,
  });
  
  return loader;
}

/**
 * Singleton instance of the Firecrawl client
 */
let firecrawlClientInstance: FirecrawlApp | null = null;

/**
 * Get the Firecrawl client instance (singleton pattern)
 */
export function getFirecrawlClient(): FirecrawlApp {
  if (!firecrawlClientInstance) {
    try {
      firecrawlClientInstance = createFirecrawlClient();
    } catch (error) {
      console.error('Failed to create Firecrawl client:', error);
      throw new FirecrawlError(
        'Failed to initialize Firecrawl client. Check your API key and configuration.',
        500
      );
    }
  }
  
  return firecrawlClientInstance;
}

/**
 * Reset the client instance (useful for tests)
 */
export function resetFirecrawlClient(): void {
  firecrawlClientInstance = null;
}

/**
 * Log a Firecrawl error with proper formatting
 */
export function logFirecrawlError(error: any, operation: string): void {
  const isFirecrawlError = error instanceof FirecrawlError;
  
  console.error(
    `[Firecrawl][${operation}] Error: ${error.message}`,
    isFirecrawlError ? { statusCode: error.statusCode } : ''
  );
  
  if (firecrawlConfig.debug) {
    console.error('Firecrawl error details:', error);
  }
}

// Export default client instance
export default getFirecrawlClient(); 