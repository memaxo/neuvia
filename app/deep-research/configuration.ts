/**
 * Configuration management for the deep research system.
 * Defines default values, enums, and validation schemas.
 */

import { z } from "zod";

/**
 * Available LLM models with their specific versions
 */
export const SupportedModels = {
  GPT4: "gpt-4-turbo-preview",
  CLAUDE: "claude-3-sonnet-20240229"
} as const;

/**
 * Available search providers with their API requirements
 */
export const SearchProviders = {
  TAVILY: "TAVILY",
  PERPLEXITY: "PERPLEXITY"
} as const;

/**
 * Environment variable schema for required API keys and settings
 */
export const EnvSchema = z.object({
  TAVILY_API_KEY: z.string().min(1, "Tavily API key is required"),
  PERPLEXITY_API_KEY: z.string().min(1, "Perplexity API key is required"),
  OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
  ANTHROPIC_API_KEY: z.string().min(1, "Anthropic API key is required"),
  REDIS_URL: z.string().url("Redis URL must be a valid URL").optional(),
}).refine(
  (env) => {
    // Ensure at least one search provider's API key is present
    return Boolean(env.TAVILY_API_KEY || env.PERPLEXITY_API_KEY);
  },
  { message: "At least one search provider API key is required" }
);

/**
 * Rate limiting configuration for API requests
 */
export const RateLimitSchema = z.object({
  maxRequests: z.number().int().positive().default(10),
  perSeconds: z.number().int().positive().default(60)
}).describe("Rate limiting configuration for API requests");

/**
 * Configuration schema with essential options and documentation
 */
export const ConfigSchema = z.object({
  /** The LLM model to use for research tasks */
  model: z.enum([SupportedModels.GPT4, SupportedModels.CLAUDE])
    .describe("The language model to use for research tasks"),
  
  /** The search provider to use for web research */
  searchProvider: z.enum([SearchProviders.TAVILY, SearchProviders.PERPLEXITY])
    .describe("The search provider to use for web research"),
  
  /** Maximum number of sources to retrieve per search query */
  maxSourcesPerQuery: z.number().int().min(1).max(10).default(3)
    .describe("Maximum number of sources to retrieve per search query"),
  
  /** Whether to enable caching of research results */
  cacheEnabled: z.boolean().default(true)
    .describe("Whether to enable caching of research results"),
  
  /** Rate limiting configuration */
  rateLimits: RateLimitSchema.default({
    maxRequests: 10,
    perSeconds: 60
  }),
  
  /** Report organizational style */
  report_structure: z.string().default("Standard Report Organization")
    .describe("Defines the report’s organizational style"),
  
  /** Number of search queries to generate per section */
  number_of_queries: z.number().int().min(1).default(3)
    .describe("Number of search queries to generate per section"),
  
  /** Maximum iterative research rounds allowed */
  max_search_depth: z.number().int().min(1).default(3)
    .describe("Maximum iterative research rounds allowed"),
  
  /** LLM model to use for planning */
  planner_model: z.string().default("gpt-4-turbo-preview")
    .describe("LLM model to use for planning")
});

export type ResearchConfig = z.infer<typeof ConfigSchema>;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: ResearchConfig = {
  model: SupportedModels.GPT4,
  searchProvider: SearchProviders.TAVILY,
  maxSourcesPerQuery: 3,
  cacheEnabled: true,
  rateLimits: {
    maxRequests: 10,
    perSeconds: 60
  },
  report_structure: "Standard Report Organization",
  number_of_queries: 3,
  max_search_depth: 3,
  planner_model: "gpt-4-turbo-preview"
};

/**
 * Validates environment variables and returns typed env object
 * @throws {z.ZodError} If validation fails
 */
export function validateEnv(): z.infer<typeof EnvSchema> {
  return EnvSchema.parse(process.env);
}

/**
 * Loads and validates configuration with optional overrides
 * @param overrides - Optional partial configuration overrides
 * @returns Validated configuration object
 * @throws {z.ZodError} If validation fails
 */
export function loadConfiguration(overrides?: Partial<ResearchConfig>): ResearchConfig {
  // Validate environment variables first
  validateEnv();
  
  const merged = { ...DEFAULT_CONFIG, ...overrides };
  return ConfigSchema.parse(merged);
}