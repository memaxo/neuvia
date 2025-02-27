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
  
  /**
   * Default temperature for generation
   */
  temperature?: number;
  
  /**
   * Default token limit
   */
  maxTokens?: number;
}

// Export individual settings for easier imports
export const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || '';
export const PERPLEXITY_MODEL = 'sonar-deep-research';
export const PERPLEXITY_DEBUG = process.env.NODE_ENV === 'development';

/**
 * Default Perplexity configuration
 */
const perplexityConfig: PerplexityConfig = {
  apiKey: PERPLEXITY_API_KEY,
  model: PERPLEXITY_MODEL,
  debug: PERPLEXITY_DEBUG,
  temperature: 0.7,
  maxTokens: 3000,
};

export default perplexityConfig; 