import type { Database } from '@/lib/supabase'
import type { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { ChatPromptTemplate, PromptTemplate } from '@langchain/core/prompts'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ExternalServiceError, SystemError, ValidationError } from '@/lib/errors'
import logger from '@/lib/logger'
/**
 * LangChain Core Implementation
 *
 * Core initialization of LangChain components and type-safe factory methods.
 * This module serves as the central point for managing LangChain components
 * in the Neuvia application.
 */
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai'
import {
  type EnhancedSupabaseVectorStore,
  supabaseVectorStore,
} from '../vectorstore/supabase-store'
import { getDefaultConfig } from './config'

/**
 * LangChain Core class
 * Provides factory methods for creating LangChain components
 */
export class LangChainCore {
  private static instance: LangChainCore
  private initialized = false

  private constructor(private readonly config = getDefaultConfig()) {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): LangChainCore {
    if (!LangChainCore.instance) {
      LangChainCore.instance = new LangChainCore()
    }
    return LangChainCore.instance
  }

  /**
   * Initialize the LangChain Core
   * This method must be called before using any component
   */
  public async initialize(): Promise<void> {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'initialize'
    });
    
    if (this.initialized) {
      moduleLogger.info('LangChain Core already initialized');
      return;
    }

    moduleLogger.info('Initializing LangChain Core');
    
    try {
      // Verify required configurations
      this.validateConfig();

      // Initialize singleton components
      // Future enhancements: Add any global initialization here

      this.initialized = true;
      moduleLogger.info('LangChain Core initialized successfully');
    } catch (error) {
      moduleLogger.error('Failed to initialize LangChain Core', {}, error);
      
      if (error instanceof ValidationError) {
        // Just rethrow validation errors
        throw error;
      }
      
      throw new SystemError({
        message: 'Failed to initialize LangChain Core',
        code: 'LANGCHAIN_INIT_FAILED',
        cause: error
      });
    }
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'validateConfig'
    });
    
    moduleLogger.info('Validating LangChain configuration');
    
    // Validate OpenAI configuration
    if (!this.config.openai.apiKey) {
      moduleLogger.error('Missing OpenAI API key');
      throw new ValidationError({
        message: 'OpenAI API key is required for LangChain initialization',
        code: 'MISSING_OPENAI_API_KEY'
      });
    }

    // Validate Supabase configuration
    if (!this.config.supabase.url) {
      moduleLogger.error('Missing Supabase URL');
      throw new ValidationError({
        message: 'Supabase URL is required for LangChain initialization',
        code: 'MISSING_SUPABASE_URL'
      });
    }
    
    if (!this.config.supabase.serviceKey) {
      moduleLogger.error('Missing Supabase service key');
      throw new ValidationError({
        message: 'Supabase service key is required for LangChain initialization',
        code: 'MISSING_SUPABASE_KEY'
      });
    }

    // Validate Gemini configuration if being used
    if (this.config.gemini && !this.config.gemini.apiKey) {
      moduleLogger.warn('Gemini config present but API key is missing');
    }

    moduleLogger.info('LangChain configuration validated successfully');
    
    // Other validations can be added here
  }

  /**
   * Get the Supabase vector store
   */
  public getVectorStore(): EnhancedSupabaseVectorStore {
    this.ensureInitialized()
    return supabaseVectorStore
  }

  /**
   * Create an OpenAI chat model (O3 Mini)
   *
   * @param options Optional configuration for the chat model
   */
  public createChatOpenAI(options?: {
    modelName?: string
    temperature?: number
    streaming?: boolean
    callbacks?: BaseCallbackHandler[]
  }) {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'createChatOpenAI',
      modelName: options?.modelName || this.config.openai.chatModel,
      streaming: options?.streaming ?? false
    });
    
    try {
      this.ensureInitialized();
      
      moduleLogger.info('Creating OpenAI chat model');
      
      return new ChatOpenAI({
        openAIApiKey: this.config.openai.apiKey,
        modelName: options?.modelName || this.config.openai.chatModel, // Defaults to 'o3-mini'
        temperature: options?.temperature ?? 0.7,
        streaming: options?.streaming ?? false,
        callbacks: options?.callbacks,
      });
    } catch (error) {
      moduleLogger.error('Failed to create OpenAI chat model', {}, error);
      
      if (error instanceof ValidationError) {
        // Rethrow validation errors
        throw error;
      }
      
      throw new ExternalServiceError({
        message: 'Failed to create OpenAI chat model',
        service: 'OpenAI',
        code: 'OPENAI_MODEL_CREATION_FAILED',
        cause: error
      });
    }
  }

  /**
   * Create a Gemini chat model (Gemini 2.0 Flash)
   *
   * @param options Optional configuration for the chat model
   */
  public createChatGemini(options?: {
    modelName?: string
    temperature?: number
    streaming?: boolean
    callbacks?: BaseCallbackHandler[]
  }) {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'createChatGemini',
      modelName: options?.modelName || this.config.gemini?.modelName,
      streaming: options?.streaming ?? false
    });
    
    try {
      this.ensureInitialized();
      
      // Check if Gemini API key is available
      if (!this.config.gemini?.apiKey) {
        moduleLogger.error('Gemini API key is not configured');
        throw new ValidationError({
          message: 'Gemini API key is not configured',
          code: 'MISSING_GEMINI_API_KEY'
        });
      }
      
      moduleLogger.info('Creating Gemini chat model');

      return new ChatGoogleGenerativeAI({
        apiKey: this.config.gemini.apiKey,
        modelName: options?.modelName || this.config.gemini.modelName, // Defaults to 'gemini-2.0-flash'
        temperature: options?.temperature ?? 0.7,
        streaming: options?.streaming ?? false,
        callbacks: options?.callbacks,
      });
    } catch (error) {
      moduleLogger.error('Failed to create Gemini chat model', {}, error);
      
      if (error instanceof ValidationError) {
        // Rethrow validation errors
        throw error;
      }
      
      throw new ExternalServiceError({
        message: 'Failed to create Gemini chat model',
        service: 'Google Gemini',
        code: 'GEMINI_MODEL_CREATION_FAILED',
        cause: error
      });
    }
  }

  /**
   * Create OpenAI embeddings
   *
   * @param options Optional configuration for the embeddings
   */
  public createEmbeddings(options?: {
    modelName?: string
    batchSize?: number
  }) {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'createEmbeddings',
      modelName: options?.modelName || this.config.openai.embeddingModel
    });
    
    try {
      this.ensureInitialized();
      
      moduleLogger.info('Creating OpenAI embeddings');
      
      return new OpenAIEmbeddings({
        openAIApiKey: this.config.openai.apiKey,
        modelName: options?.modelName || this.config.openai.embeddingModel, // text-embedding-3-small
        batchSize: options?.batchSize,
      });
    } catch (error) {
      moduleLogger.error('Failed to create OpenAI embeddings', {}, error);
      
      if (error instanceof ValidationError) {
        // Rethrow validation errors
        throw error;
      }
      
      throw new ExternalServiceError({
        message: 'Failed to create OpenAI embeddings',
        service: 'OpenAI',
        code: 'OPENAI_EMBEDDINGS_CREATION_FAILED',
        cause: error
      });
    }
  }

  /**
   * Create a prompt template
   *
   * @param template Prompt template string
   * @param inputVariables Array of input variable names
   */
  public createPromptTemplate(template: string, inputVariables: string[]) {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'createPromptTemplate'
    });
    
    try {
      this.ensureInitialized();
      
      moduleLogger.info('Creating prompt template');
      
      if (!template) {
        throw new ValidationError({
          message: 'Template string is required',
          code: 'MISSING_TEMPLATE'
        });
      }
      
      return PromptTemplate.fromTemplate(template);
    } catch (error) {
      if (error instanceof ValidationError) {
        // Rethrow validation errors
        throw error;
      }
      
      moduleLogger.error('Failed to create prompt template', {}, error);
      
      throw new SystemError({
        message: 'Failed to create prompt template',
        code: 'PROMPT_TEMPLATE_CREATION_FAILED',
        cause: error
      });
    }
  }

  /**
   * Create a chat prompt template
   *
   * @param systemTemplate System message template
   * @param humanTemplate Human message template
   * @param inputVariables Array of input variable names
   */
  public createChatPromptTemplate(
    systemTemplate: string,
    humanTemplate: string,
    inputVariables: string[]
  ) {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'createChatPromptTemplate'
    });
    
    try {
      this.ensureInitialized();
      
      moduleLogger.info('Creating chat prompt template');
      
      if (!systemTemplate) {
        throw new ValidationError({
          message: 'System template is required',
          code: 'MISSING_SYSTEM_TEMPLATE'
        });
      }
      
      if (!humanTemplate) {
        throw new ValidationError({
          message: 'Human template is required',
          code: 'MISSING_HUMAN_TEMPLATE'
        });
      }
      
      return ChatPromptTemplate.fromMessages([
        ['system', systemTemplate],
        ['human', humanTemplate],
      ]);
    } catch (error) {
      if (error instanceof ValidationError) {
        // Rethrow validation errors
        throw error;
      }
      
      moduleLogger.error('Failed to create chat prompt template', {}, error);
      
      throw new SystemError({
        message: 'Failed to create chat prompt template',
        code: 'CHAT_PROMPT_TEMPLATE_CREATION_FAILED',
        cause: error
      });
    }
  }

  /**
   * Create a message based on the role
   *
   * @param role Message role (system, human, ai)
   * @param content Message content
   */
  public createMessage(role: 'system' | 'human' | 'ai', content: string) {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'createMessage',
      role
    });
    
    try {
      this.ensureInitialized();
      
      moduleLogger.info('Creating message');
      
      if (!content) {
        throw new ValidationError({
          message: 'Message content is required',
          code: 'MISSING_MESSAGE_CONTENT'
        });
      }
      
      switch (role) {
        case 'system':
          return new SystemMessage(content);
        case 'human':
          return new HumanMessage(content);
        case 'ai':
          return new AIMessage(content);
        default:
          throw new ValidationError({
            message: `Unknown message role: ${role}`,
            code: 'INVALID_MESSAGE_ROLE'
          });
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        // Rethrow validation errors
        throw error;
      }
      
      moduleLogger.error('Failed to create message', {}, error);
      
      throw new SystemError({
        message: 'Failed to create message',
        code: 'MESSAGE_CREATION_FAILED',
        cause: error
      });
    }
  }

  /**
   * Create a string output parser
   */
  public createStringOutputParser() {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'createStringOutputParser'
    });
    
    try {
      this.ensureInitialized();
      
      moduleLogger.info('Creating string output parser');
      
      return new StringOutputParser();
    } catch (error) {
      moduleLogger.error('Failed to create string output parser', {}, error);
      
      throw new SystemError({
        message: 'Failed to create string output parser',
        code: 'OUTPUT_PARSER_CREATION_FAILED',
        cause: error
      });
    }
  }

  /**
   * Ensure the core is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new ValidationError({
        message: 'LangChain Core is not initialized. Call initialize() first.',
        code: 'LANGCHAIN_NOT_INITIALIZED'
      });
    }
  }
}

// Export a singleton instance
export const langChainCore = LangChainCore.getInstance()
