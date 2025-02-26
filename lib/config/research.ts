/**
 * Research configuration
 * 
 * Configuration for research providers and options.
 */

/**
 * Available research providers
 */
export type ResearchProvider = 'perplexity' | 'firecrawl';

/**
 * Research configuration options
 */
export interface ResearchConfig {
  /**
   * Default research provider to use
   */
  defaultProvider: ResearchProvider;
  
  /**
   * Whether to enable debug mode
   */
  debug: boolean;
  
  /**
   * Default research options
   */
  defaultOptions: {
    /**
     * Default depth of research
     */
    depth: 'basic' | 'standard' | 'comprehensive';
    
    /**
     * Default sources limit
     */
    sourcesLimit: number;
    
    /**
     * Default setting for including source content
     */
    includeSourceContent: boolean;
  };
}

/**
 * Research configuration
 */
const researchConfig: ResearchConfig = {
  // Default to Perplexity provider
  defaultProvider: 'perplexity',
  
  // Enable debug mode in development
  debug: process.env.NODE_ENV === 'development',
  
  // Default research options
  defaultOptions: {
    depth: 'standard',
    sourcesLimit: 5,
    includeSourceContent: true
  }
};

export default researchConfig; 