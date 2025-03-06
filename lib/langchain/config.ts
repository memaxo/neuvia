import type { Database } from '@/lib/supabase'
/**
 * LangChain Configuration Module
 *
 * Type-safe configuration for LangChain components
 */
import { z } from 'zod'

/**
 * Environment variable schema validation
 */
const EnvSchema = z.object({
  // Supabase configuration
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // OpenAI configuration
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('o3-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),

  // Gemini configuration
  GEMINI_API_KEY: z.string().optional().refine(
    (val) => process.env.FORCE_GEMINI !== 'true' || (val && val.length > 0),
    {
      message: "Gemini API key is required when FORCE_GEMINI is set to 'true'",
    }
  ),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  FORCE_GEMINI: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),

  // Perplexity configuration
  PERPLEXITY_API_KEY: z.string().optional().refine(
    (val) => process.env.FORCE_PERPLEXITY !== 'true' || (val && val.length > 0),
    {
      message: "Perplexity API key is required when FORCE_PERPLEXITY is set to 'true'",
    }
  ),
  PERPLEXITY_MODEL: z.string().default('sonar-medium-online'),
  FORCE_PERPLEXITY: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
})

/**
 * Configuration for LangChain
 */
export interface LangChainConfig {
  /**
   * Supabase configuration
   */
  supabase: {
    url: string
    serviceKey: string

    /**
     * Vector store configuration
     */
    vectorStore: {
      tableName: keyof Database['public']['Tables']
      queryName: keyof Database['public']['Functions']
      embeddingColumnName: string
      metadataColumnName: string
    }
  }

  /**
   * OpenAI configuration (O3 Mini)
   */
  openai: {
    apiKey: string
    chatModel: string
    embeddingModel: string
    temperature: number
  }

  /**
   * Gemini configuration (Gemini 2.0 Flash)
   */
  gemini?: {
    apiKey: string
    modelName: string
    temperature: number
    forceUse?: boolean
  }

  /**
   * Perplexity configuration
   */
  perplexity?: {
    apiKey: string
    modelName: string
    forceUse?: boolean
  }
}

/**
 * Load and validate environment configuration
 */
function loadEnvConfig(): Partial<z.infer<typeof EnvSchema>> {
  if (typeof process === 'undefined') {
    // Return empty object if running in browser
    return {}
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    FORCE_GEMINI: process.env.FORCE_GEMINI,
    PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
    PERPLEXITY_MODEL: process.env.PERPLEXITY_MODEL,
    FORCE_PERPLEXITY: process.env.FORCE_PERPLEXITY,
  }
}

/**
 * Get validated environment variables
 */
export function getEnvConfig(): z.infer<typeof EnvSchema> {
  const env = loadEnvConfig()

  try {
    return EnvSchema.parse(env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .filter((e) => e.code === 'invalid_type' && e.received === 'undefined')
        .map((e) => e.path.join('.'))

      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}`
      )
    }

    throw error
  }
}

/**
 * Default LangChain configuration
 */
export function getDefaultConfig(): LangChainConfig {
  const env = getEnvConfig()

  const config: LangChainConfig = {
    supabase: {
      url: env.NEXT_PUBLIC_SUPABASE_URL,
      serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
      vectorStore: {
        tableName: 'document_chunks',
        queryName: 'match_documents',
        embeddingColumnName: 'chunk_embedding',
        metadataColumnName: 'metadata',
      },
    },
    openai: {
      apiKey: env.OPENAI_API_KEY,
      chatModel: env.OPENAI_MODEL,
      embeddingModel: env.OPENAI_EMBEDDING_MODEL,
      temperature: 0.7,
    },
  }

  // Add Gemini configuration if API key is available or if forced
  if (env.GEMINI_API_KEY || env.FORCE_GEMINI) {
    config.gemini = {
      apiKey: env.GEMINI_API_KEY || '', // Empty string if missing but forced
      modelName: env.GEMINI_MODEL,
      temperature: 0.7,
      forceUse: env.FORCE_GEMINI || false,
    }
    
    // Log warning if forced but missing API key
    if (env.FORCE_GEMINI && !env.GEMINI_API_KEY) {
      console.warn('WARNING: Gemini is forced but API key is missing. This will cause errors.')
    }
  }

  // Add Perplexity configuration if API key is available or if forced
  if (env.PERPLEXITY_API_KEY || env.FORCE_PERPLEXITY) {
    config.perplexity = {
      apiKey: env.PERPLEXITY_API_KEY || '', // Empty string if missing but forced
      modelName: env.PERPLEXITY_MODEL,
      forceUse: env.FORCE_PERPLEXITY || false,
    }
    
    // Log warning if forced but missing API key
    if (env.FORCE_PERPLEXITY && !env.PERPLEXITY_API_KEY) {
      console.warn('WARNING: Perplexity is forced but API key is missing. This will cause errors.')
    }
  }

  return config
}
