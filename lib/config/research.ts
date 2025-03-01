/**
 * Research configuration
 *
 * Configuration for research providers and options.
 */
import perplexityConfig, {
  PERPLEXITY_DEBUG,
  PERPLEXITY_MODEL,
} from './perplexity'

/**
 * Available research providers
 */
export type ResearchProvider = 'perplexity'

/**
 * Research depth levels
 */
export type ResearchDepth = 'basic' | 'standard' | 'comprehensive'

/**
 * Research depth configuration mapping
 */
export interface ResearchDepthConfig {
  /**
   * Maximum tokens for each depth level
   */
  maxTokens: Record<ResearchDepth, number>

  /**
   * Temperature for each depth level
   */
  temperature: Record<ResearchDepth, number>

  /**
   * Sources limit for each depth level
   */
  sourcesLimit: Record<ResearchDepth, number>
}

/**
 * Provider-specific configuration
 */
export interface ResearchProviderConfig {
  /**
   * Perplexity configuration
   */
  perplexity: {
    /**
     * Model to use
     */
    model: string

    /**
     * Depth-specific configurations
     */
    depthConfig: ResearchDepthConfig
  }
}

/**
 * Research configuration options
 */
export interface ResearchConfig {
  /**
   * Default research provider to use
   */
  defaultProvider: ResearchProvider

  /**
   * Whether to enable debug mode
   */
  debug: boolean

  /**
   * Default research options
   */
  defaultOptions: {
    /**
     * Default depth of research
     */
    depth: ResearchDepth

    /**
     * Default sources limit
     */
    sourcesLimit: number

    /**
     * Default setting for including source content
     */
    includeSourceContent: boolean
  }

  /**
   * Provider-specific configurations
   */
  providers: ResearchProviderConfig
}

/**
 * Depth-specific configurations
 */
const depthConfig: ResearchDepthConfig = {
  maxTokens: {
    basic: 1500,
    standard: 3000,
    comprehensive: 4500,
  },
  temperature: {
    basic: 0.8,
    standard: 0.7,
    comprehensive: 0.5,
  },
  sourcesLimit: {
    basic: 3,
    standard: 5,
    comprehensive: 8,
  },
}

/**
 * Consolidated research configuration
 */
const researchConfig: ResearchConfig = {
  // Default to Perplexity provider
  defaultProvider: 'perplexity',

  // Use debug setting from perplexity config for consistency
  debug: PERPLEXITY_DEBUG,

  // Default research options
  defaultOptions: {
    depth: 'standard',
    sourcesLimit: 5,
    includeSourceContent: true,
  },

  // Provider-specific configurations
  providers: {
    perplexity: {
      model: PERPLEXITY_MODEL,
      depthConfig,
    },
  },
}

export default researchConfig
