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
  
  // Mistral configuration
  MISTRAL_API_KEY: z.string().min(1),
  MISTRAL_EMBEDDING_MODEL: z.string().default('mistral-embed'),

  // Perplexity configuration
  PERPLEXITY_API_KEY: z.string().optional(),
  PERPLEXITY_MODEL: z.string().default('sonar-medium-online'),
  FORCE_PERPLEXITY: z
    .string()
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
    temperature: number
  }
  
  /**
   * Mistral configuration
   */
  mistral: {
    apiKey: string
    embeddingModel: string
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

  // Log all missing environment variables
  const envVars = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY',
                   'OPENAI_MODEL', 'MISTRAL_API_KEY', 'MISTRAL_EMBEDDING_MODEL',
                   'PERPLEXITY_API_KEY', 'PERPLEXITY_MODEL', 'FORCE_PERPLEXITY'];
  
  const missingVars = envVars.filter(v => !process.env[v])
                              .map(v => ({ name: v, required: ['NEXT_PUBLIC_SUPABASE_URL',
                                          'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY',
                                          'MISTRAL_API_KEY'].includes(v) }));
  
  if (missingVars.length > 0) {
    const requiredMissing = missingVars.filter(v => v.required);
    if (requiredMissing.length > 0) {
      console.warn(`Missing required environment variables: ${requiredMissing.map(v => v.name).join(', ')}`);
    }
    
    const optionalMissing = missingVars.filter(v => !v.required);
    if (optionalMissing.length > 0) {
      console.info(`Missing optional environment variables: ${optionalMissing.map(v => v.name).join(', ')}`);
    }
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
    MISTRAL_EMBEDDING_MODEL: process.env.MISTRAL_EMBEDDING_MODEL,
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
    const result = EnvSchema.parse(env);
    
    // Validate model compatibility
    validateModelCompatibility(result);
    
    // Additional validation for Perplexity API key when forced
    if (result.FORCE_PERPLEXITY && !result.PERPLEXITY_API_KEY) {
      throw new Error("Perplexity API key is required when FORCE_PERPLEXITY is set to 'true'");
    }
    
    return result;
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
 * Validate compatibility of configured models
 *
 * @param env Validated environment variables
 */
function validateModelCompatibility(env: z.infer<typeof EnvSchema>): void {
  // Validate that selected models are actually available/supported
  const supportedOpenAIModels = ['o3-mini'];
  if (env.OPENAI_MODEL && !supportedOpenAIModels.includes(env.OPENAI_MODEL)) {
    console.warn(`Warning: OpenAI model '${env.OPENAI_MODEL}' may not be supported. Supported models: ${supportedOpenAIModels.join(', ')}`);
  }
  
  // Check Mistral embedding model
  const supportedMistralEmbeddings = ['mistral-embed'];
  if (env.MISTRAL_EMBEDDING_MODEL && !supportedMistralEmbeddings.includes(env.MISTRAL_EMBEDDING_MODEL)) {
    console.warn(`Warning: Mistral embedding model '${env.MISTRAL_EMBEDDING_MODEL}' may not be supported. Supported models: ${supportedMistralEmbeddings.join(', ')}`);
  }
  
  // Check Perplexity model if forced
  if (env.FORCE_PERPLEXITY === 'true' && !env.PERPLEXITY_API_KEY) {
    console.error('ERROR: Perplexity is forced but API key is missing. This will cause runtime errors.');
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
      temperature: 0.7,
    },
    mistral: {
      apiKey: env.MISTRAL_API_KEY,
      embeddingModel: env.MISTRAL_EMBEDDING_MODEL,
    },
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