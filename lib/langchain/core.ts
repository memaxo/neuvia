import type { Database } from '@/lib/supabase'
import type { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages'
import {
  StringOutputParser,
  JsonOutputParser,
} from '@langchain/core/output_parsers'
import { ChatPromptTemplate, PromptTemplate } from '@langchain/core/prompts'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import {
  ExternalServiceError,
  SystemError,
  ApplicationError,
} from '@/lib/errors'
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
// Import Runnable components
import {
  RunnableSequence,
  RunnablePassthrough,
  RunnableBranch,
  RunnableMap,
} from '@langchain/core/runnables'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { BaseRetriever } from '@langchain/core/retrievers'
// Import memory components
import { BufferMemory } from 'langchain/memory'
// Import zod for schema validation
import type { z } from 'zod'
// Import the PerplexityChat model
import { PerplexityChat, type PerplexityChatOptions } from '@/lib/langchain/perplexity-chat-model'

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
      method: 'initialize',
    })

    if (this.initialized) {
      moduleLogger.info('LangChain Core already initialized')
      return
    }

    moduleLogger.info('Initializing LangChain Core')

    try {
      // Verify required configurations
      this.validateConfig()

      // Initialize singleton components
      // Future enhancements: Add any global initialization here

      this.initialized = true
      moduleLogger.info('LangChain Core initialized successfully')
    } catch (error) {
      moduleLogger.error('Failed to initialize LangChain Core', {}, error)

      if (error instanceof ApplicationError) {
        // Just rethrow application errors
        throw error
      }

      throw new SystemError({
        message: 'Failed to initialize LangChain Core',
        code: 'LANGCHAIN_INIT_FAILED',
        cause: error,
      })
    }
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'validateConfig',
    })

    moduleLogger.info('Validating LangChain configuration')

    // Validate OpenAI configuration
    if (!this.config.openai.apiKey) {
      moduleLogger.error('Missing OpenAI API key')
      throw new ApplicationError({
        message: 'OpenAI API key is required for LangChain initialization',
        code: 'MISSING_OPENAI_API_KEY',
      })
    }

    // Validate Supabase configuration
    if (!this.config.supabase.url) {
      moduleLogger.error('Missing Supabase URL')
      throw new ApplicationError({
        message: 'Supabase URL is required for LangChain initialization',
        code: 'MISSING_SUPABASE_URL',
      })
    }

    if (!this.config.supabase.serviceKey) {
      moduleLogger.error('Missing Supabase service key')
      throw new ApplicationError({
        message:
          'Supabase service key is required for LangChain initialization',
        code: 'MISSING_SUPABASE_KEY',
      })
    }

    // Validate Gemini configuration if being used
    if (this.config.gemini && !this.config.gemini.apiKey) {
      moduleLogger.warn('Gemini config present but API key is missing')
    }

    moduleLogger.info('LangChain configuration validated successfully')

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
      streaming: options?.streaming ?? false,
    })

    try {
      this.ensureInitialized()

      moduleLogger.info('Creating OpenAI chat model')

      return new ChatOpenAI({
        openAIApiKey: this.config.openai.apiKey,
        modelName: options?.modelName || this.config.openai.chatModel, // Defaults to 'o3-mini'
        temperature: options?.temperature ?? 0.7,
        streaming: options?.streaming ?? false,
        callbacks: options?.callbacks,
      })
    } catch (error) {
      moduleLogger.error('Failed to create OpenAI chat model', {}, error)

      if (error instanceof ApplicationError) {
        // Rethrow application errors
        throw error
      }

      throw new ExternalServiceError({
        message: 'Failed to create OpenAI chat model',
        service: 'OpenAI',
        code: 'OPENAI_MODEL_CREATION_FAILED',
        cause: error,
      })
    }
  }

  /**
   * Create a Gemini chat model (Gemini 2.0 Flash)
   *
   * @param options Optional configuration for the chat model
   * @returns Gemini chat model or falls back to OpenAI if Gemini is not available
   */
  public createChatGemini(options?: {
    modelName?: string
    temperature?: number
    streaming?: boolean
    callbacks?: BaseCallbackHandler[]
    fallbackToOpenAI?: boolean
  }) {
    const fallbackToOpenAI = options?.fallbackToOpenAI ?? true
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'createChatGemini',
      modelName: options?.modelName || this.config.gemini?.modelName,
      streaming: options?.streaming ?? false,
      fallbackToOpenAI,
    })

    try {
      this.ensureInitialized()

      // Check if Gemini API key is available
      if (!this.config.gemini?.apiKey) {
        moduleLogger.warn('Gemini API key is not configured - using fallback model')
        
        if (fallbackToOpenAI) {
          moduleLogger.info('Falling back to OpenAI model')
          return this.createChatOpenAI({
            temperature: options?.temperature,
            streaming: options?.streaming,
            callbacks: options?.callbacks,
          })
        }
        
        throw new ApplicationError({
          message: 'Gemini API key is not configured and fallback is disabled',
          code: 'MISSING_GEMINI_API_KEY',
        })
      }

      moduleLogger.info('Creating Gemini chat model')

      return new ChatGoogleGenerativeAI({
        apiKey: this.config.gemini.apiKey,
        modelName: options?.modelName || this.config.gemini.modelName, // Defaults to 'gemini-2.0-flash'
        temperature: options?.temperature ?? 0.7,
        streaming: options?.streaming ?? false,
        callbacks: options?.callbacks,
      })
    } catch (error) {
      moduleLogger.error('Failed to create Gemini chat model', {}, error)

      if (error instanceof ApplicationError) {
        // If fallback is enabled and this is a configuration error, try OpenAI
        if (fallbackToOpenAI && error.code === 'MISSING_GEMINI_API_KEY') {
          moduleLogger.info('Falling back to OpenAI model after Gemini configuration error')
          return this.createChatOpenAI({
            temperature: options?.temperature,
            streaming: options?.streaming,
            callbacks: options?.callbacks,
          })
        }
        
        // Otherwise rethrow application errors
        throw error
      }

      // If fallback is enabled, try OpenAI for other errors
      if (fallbackToOpenAI) {
        moduleLogger.info('Falling back to OpenAI model after Gemini error', {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
        })
        return this.createChatOpenAI({
          temperature: options?.temperature,
          streaming: options?.streaming,
          callbacks: options?.callbacks,
        })
      }

      throw new ExternalServiceError({
        message: 'Failed to create Gemini chat model',
        service: 'Google Gemini',
        code: 'GEMINI_MODEL_CREATION_FAILED',
        cause: error,
      })
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
      modelName: options?.modelName || this.config.openai.embeddingModel,
    })

    try {
      this.ensureInitialized()

      moduleLogger.info('Creating OpenAI embeddings')

      return new OpenAIEmbeddings({
        openAIApiKey: this.config.openai.apiKey,
        modelName: options?.modelName || this.config.openai.embeddingModel, // text-embedding-3-small
        batchSize: options?.batchSize,
      })
    } catch (error) {
      moduleLogger.error('Failed to create OpenAI embeddings', {}, error)

      if (error instanceof ApplicationError) {
        // Rethrow application errors
        throw error
      }

      throw new ExternalServiceError({
        message: 'Failed to create OpenAI embeddings',
        service: 'OpenAI',
        code: 'OPENAI_EMBEDDINGS_CREATION_FAILED',
        cause: error,
      })
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
      method: 'createPromptTemplate',
    })

    try {
      this.ensureInitialized()

      moduleLogger.info('Creating prompt template')

      if (!template) {
        throw new ApplicationError({
          message: 'Template string is required',
          code: 'MISSING_TEMPLATE',
        })
      }

      return PromptTemplate.fromTemplate(template)
    } catch (error) {
      if (error instanceof ApplicationError) {
        // Rethrow application errors
        throw error
      }

      moduleLogger.error('Failed to create prompt template', {}, error)

      throw new SystemError({
        message: 'Failed to create prompt template',
        code: 'PROMPT_TEMPLATE_CREATION_FAILED',
        cause: error,
      })
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
      method: 'createChatPromptTemplate',
    })

    try {
      this.ensureInitialized()

      moduleLogger.info('Creating chat prompt template')

      if (!systemTemplate) {
        throw new ApplicationError({
          message: 'System template is required',
          code: 'MISSING_SYSTEM_TEMPLATE',
        })
      }

      if (!humanTemplate) {
        throw new ApplicationError({
          message: 'Human template is required',
          code: 'MISSING_HUMAN_TEMPLATE',
        })
      }

      return ChatPromptTemplate.fromMessages([
        ['system', systemTemplate],
        ['human', humanTemplate],
      ])
    } catch (error) {
      if (error instanceof ApplicationError) {
        // Rethrow application errors
        throw error
      }

      moduleLogger.error('Failed to create chat prompt template', {}, error)

      throw new SystemError({
        message: 'Failed to create chat prompt template',
        code: 'CHAT_PROMPT_TEMPLATE_CREATION_FAILED',
        cause: error,
      })
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
      role,
    })

    try {
      this.ensureInitialized()

      moduleLogger.info('Creating message')

      if (!content) {
        throw new ApplicationError({
          message: 'Message content is required',
          code: 'MISSING_MESSAGE_CONTENT',
        })
      }

      switch (role) {
        case 'system':
          return new SystemMessage(content)
        case 'human':
          return new HumanMessage(content)
        case 'ai':
          return new AIMessage(content)
        default:
          throw new ApplicationError({
            message: `Unknown message role: ${role}`,
            code: 'INVALID_MESSAGE_ROLE',
          })
      }
    } catch (error) {
      if (error instanceof ApplicationError) {
        // Rethrow application errors
        throw error
      }

      moduleLogger.error('Failed to create message', {}, error)

      throw new SystemError({
        message: 'Failed to create message',
        code: 'MESSAGE_CREATION_FAILED',
        cause: error,
      })
    }
  }

  /**
   * Create a string output parser
   */
  public createStringOutputParser() {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'createStringOutputParser',
    })

    try {
      this.ensureInitialized()

      moduleLogger.info('Creating string output parser')

      return new StringOutputParser()
    } catch (error) {
      moduleLogger.error('Failed to create string output parser', {}, error)

      throw new SystemError({
        message: 'Failed to create string output parser',
        code: 'OUTPUT_PARSER_CREATION_FAILED',
        cause: error,
      })
    }
  }

  /**
   * Create a simple LLM chain using the Runnable interface
   *
   * @param prompt The prompt template
   * @param model The chat model
   * @param outputParser The output parser (defaults to StringOutputParser)
   * @returns A runnable sequence that can be invoked with input variables
   */
  public createLLMChain(
    prompt: ChatPromptTemplate | PromptTemplate,
    model?: BaseChatModel,
    outputParser = new StringOutputParser()
  ) {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'createLLMChain',
    })

    try {
      this.ensureInitialized()

      moduleLogger.info('Creating LLM chain')

      // Use default model if not provided
      const llm = model || this.createChatOpenAI()

      // Create and return the runnable sequence
      return RunnableSequence.from([prompt, llm, outputParser])
    } catch (error) {
      moduleLogger.error('Failed to create LLM chain', {}, error)

      throw new SystemError({
        message: 'Failed to create LLM chain',
        code: 'LLM_CHAIN_CREATION_FAILED',
        cause: error,
      })
    }
  }

  /**
   * Create a retrieval chain using the Runnable interface
   *
   * @param retriever The retriever to use for document lookup
   * @param prompt The prompt template for generating responses
   * @param model The chat model (defaults to OpenAI)
   * @returns A runnable sequence for retrieval-augmented generation
   */
  public createRetrievalChain(
    retriever: BaseRetriever,
    prompt: ChatPromptTemplate,
    model?: BaseChatModel
  ) {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'createRetrievalChain',
    })

    try {
      this.ensureInitialized()

      moduleLogger.info('Creating retrieval chain')

      // Use default model if not provided
      const llm = model || this.createChatOpenAI()

      // Create the retrieval chain
      return RunnableSequence.from([
        RunnableMap.from({
          context: retriever,
          question: new RunnablePassthrough(),
        }),
        prompt,
        llm,
        new StringOutputParser(),
      ])
    } catch (error) {
      moduleLogger.error('Failed to create retrieval chain', {}, error)

      throw new SystemError({
        message: 'Failed to create retrieval chain',
        code: 'RETRIEVAL_CHAIN_CREATION_FAILED',
        cause: error,
      })
    }
  }

  /**
   * Create a conditional branch chain that routes to different chains based on a condition
   *
   * @param branches Array of condition-chain pairs
   * @param defaultBranch The default chain to use if no conditions match
   * @returns A runnable branch that routes to the appropriate chain
   */
  public createBranchChain<InputType, OutputType>(
    branches: Array<
      [(input: InputType) => boolean, RunnableSequence<InputType, OutputType>]
    >,
    defaultBranch: RunnableSequence<InputType, OutputType>
  ) {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'createBranchChain',
    })

    try {
      this.ensureInitialized()

      moduleLogger.info('Creating branch chain')

      // Spread the branches array and add the default branch at the end
      return RunnableBranch.from([...branches, defaultBranch])
    } catch (error) {
      moduleLogger.error('Failed to create branch chain', {}, error)

      throw new SystemError({
        message: 'Failed to create branch chain',
        code: 'BRANCH_CHAIN_CREATION_FAILED',
        cause: error,
      })
    }
  }

  /**
   * Create a JSON output parser for structured data
   *
   * @returns A JSON output parser
   */
  public createJsonOutputParser() {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'createJsonOutputParser',
    })

    try {
      this.ensureInitialized()

      moduleLogger.info('Creating JSON output parser')

      return new JsonOutputParser()
    } catch (error) {
      moduleLogger.error('Failed to create JSON output parser', {}, error)

      throw new SystemError({
        message: 'Failed to create JSON output parser',
        code: 'JSON_PARSER_CREATION_FAILED',
        cause: error,
      })
    }
  }

  /**
   * Create a structured output chain that parses LLM responses into structured JSON
   *
   * @param prompt The prompt template
   * @param model The chat model
   * @returns A runnable sequence that outputs structured JSON data
   */
  public createStructuredOutputChain(
    prompt: ChatPromptTemplate,
    model?: BaseChatModel
  ) {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'createStructuredOutputChain',
    })

    try {
      this.ensureInitialized()

      moduleLogger.info('Creating structured output chain')

      // Use default model if not provided
      const llm =
        model ||
        this.createChatOpenAI({
          temperature: 0.1, // Lower temperature for structured outputs
        })

      // Create JSON output parser
      const outputParser = this.createJsonOutputParser()

      // Create and return the runnable sequence
      return RunnableSequence.from([prompt, llm, outputParser])
    } catch (error) {
      moduleLogger.error('Failed to create structured output chain', {}, error)

      throw new SystemError({
        message: 'Failed to create structured output chain',
        code: 'STRUCTURED_OUTPUT_CHAIN_CREATION_FAILED',
        cause: error,
      })
    }
  }

  /**
   * Create a conversational retrieval chain with memory
   *
   * @param retriever The retriever to use for document lookup
   * @param systemPrompt The system prompt template
   * @param model The chat model
   * @returns A runnable for conversational retrieval QA
   */
  public createConversationalRetrievalChain(
    retriever: BaseRetriever,
    systemPrompt: string,
    model?: BaseChatModel
  ) {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'createConversationalRetrievalChain',
    })

    try {
      this.ensureInitialized()

      moduleLogger.info('Creating conversational retrieval chain')

      // Use default model if not provided
      const llm = model || this.createChatOpenAI()

      // Create memory for conversation history
      const memory = new BufferMemory({
        returnMessages: true,
        memoryKey: 'chat_history',
        inputKey: 'question',
      })

      // Create the chat prompt template
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          systemPrompt ||
            'You are a helpful assistant that answers questions based on the provided context. ' +
              "If you don't know the answer, say you don't know. " +
              'Keep your answers concise and based only on the provided context.',
        ],
        ['placeholder', '{chat_history}'],
        ['human', '{question}'],
        [
          'system',
          "Here's some additional context to help you answer: {context}",
        ],
      ])

      // Create the retrieval chain
      return RunnableSequence.from([
        {
          // Extract question from input
          question: (input) => input.question,
          // Pass through chat history
          chat_history: (input) => input.chat_history || [],
          // Retrieve relevant documents
          context: (input) =>
            retriever
              .invoke(input.question)
              .then((docs) => docs.map((doc) => doc.pageContent).join('\n\n')),
        },
        prompt,
        llm,
        new StringOutputParser(),
      ])
    } catch (error) {
      moduleLogger.error(
        'Failed to create conversational retrieval chain',
        {},
        error
      )

      throw new SystemError({
        message: 'Failed to create conversational retrieval chain',
        code: 'CONVERSATIONAL_CHAIN_CREATION_FAILED',
        cause: error,
      })
    }
  }

  /**
   * Create a Perplexity chat model (sonar-deep-research)
   *
   * @param options Optional configuration for the Perplexity chat model
   */
  public createPerplexityChat(options?: PerplexityChatOptions & {
    callbacks?: BaseCallbackHandler[]
  }) {
    const moduleLogger = logger.withMetadata({
      module: 'LangChainCore',
      method: 'createPerplexityChat',
      modelName: options?.model || 'sonar-deep-research',
    })

    try {
      this.ensureInitialized()

      moduleLogger.info('Creating Perplexity chat model')

      // Check if we have an API key
      const apiKey = options?.apiKey || this.config.perplexity?.apiKey || process.env.PERPLEXITY_API_KEY
      
      if (!apiKey) {
        moduleLogger.warn('No Perplexity API key found - you must provide an API key')
        throw new ApplicationError({
          message: 'Perplexity API key is required for creating a Perplexity chat model',
          code: 'MISSING_PERPLEXITY_API_KEY',
        })
      }

      return new PerplexityChat({
        apiKey,
        model: options?.model || 'sonar-deep-research',
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens,
        baseURL: options?.baseURL,
        includeSources: options?.includeSources ?? true,
        returnImages: options?.returnImages ?? false,
        callbacks: options?.callbacks,
      })
    } catch (error: unknown) {
      moduleLogger.error('Failed to create Perplexity chat model', {}, error)

      if (error instanceof ApplicationError) {
        // Rethrow application errors
        throw error
      }

      throw new ExternalServiceError({
        message: 'Failed to create Perplexity chat model',
        service: 'Perplexity',
        code: 'PERPLEXITY_MODEL_CREATION_FAILED',
        cause: error,
      })
    }
  }

  /**
   * Ensure the core is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new ApplicationError({
        message: 'LangChain Core is not initialized. Call initialize() first.',
        code: 'LANGCHAIN_NOT_INITIALIZED',
      })
    }
  }
}

// Export a singleton instance
export const langChainCore = LangChainCore.getInstance()
