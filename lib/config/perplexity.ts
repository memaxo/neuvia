/**
 * Configuration settings for Perplexity Deep Research API integration.
 */

/**
 * Perplexity configuration interface
 */
export interface PerplexityConfig {
  /**
   * API key for Perplexity
   */
  apiKey: string;
  
  /**
   * Optional custom API endpoint
   */
  baseURL?: string;
  
  /**
   * Model to use for research
   */
  model: string;
  
  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * Default Perplexity configuration
 */
const perplexityConfig: PerplexityConfig = {
  apiKey: process.env.PERPLEXITY_API_KEY || '',
  model: 'sonar-deep-research',
  debug: process.env.NODE_ENV === 'development',
};

export default perplexityConfig; 