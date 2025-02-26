/**
 * @deprecated DEPRECATED: This Firecrawl implementation has been replaced with the Perplexity
 * Deep Research API integration. Please use the new implementation in lib/services/research/perplexity-client.ts.
 * 
 * This file is maintained for backward compatibility but will be removed in a future version.
 */

/**
 * Firecrawl Service
 * 
 * Central export file for Firecrawl functionality.
 */

// Export types
export * from './types';

// Export client
export { 
  default as firecrawlClient,
  getFirecrawlClient,
  createFirecrawlLoader,
  logFirecrawlError
} from './client';

// Export actions
export { 
  search,
  extract,
  scrape
} from './actions';

// Export hooks
export {
  useFirecrawlSearch,
  useFirecrawlExtract,
  useFirecrawlScrape
} from './hooks'; 