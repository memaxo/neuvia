/**
 * Firecrawl Configuration
 * 
 * Centralized configuration for Firecrawl API integration.
 * This file manages API keys, timeouts, and other settings.
 */

// Get API key from environment variables with fallback
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY ?? '';

// Configuration object
export const firecrawlConfig = {
  /**
   * API key for Firecrawl integration
   */
  apiKey: FIRECRAWL_API_KEY,
  
  /**
   * Base URL for Firecrawl API
   */
  baseUrl: 'https://api.firecrawl.dev',
  
  /**
   * Request timeout in milliseconds
   */
  timeout: 30000,
  
  /**
   * Maximum number of retries for failed requests
   */
  maxRetries: 3,
  
  /**
   * Default search results limit
   */
  defaultSearchLimit: 10,
  
  /**
   * Whether to include favicons in search results
   */
  includeFavicons: true,
  
  /**
   * Whether debug mode is enabled
   */
  debug: process.env.NODE_ENV === 'development',
};

/**
 * Validates that the configuration is valid
 * @returns True if configuration is valid, false otherwise
 */
export function validateFirecrawlConfig(): boolean {
  // Require API key
  if (!firecrawlConfig.apiKey) {
    console.error('Firecrawl API key is not set. Set FIRECRAWL_API_KEY in your environment.');
    return false;
  }
  
  return true;
}

// Export default configuration
export default firecrawlConfig; 