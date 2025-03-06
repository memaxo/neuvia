import { generateText } from 'ai';
import { createPerplexity } from '@ai-sdk/perplexity';
import {
  BaseChatModel,
  type BaseChatModelParams,
} from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
} from '@langchain/core/messages';
import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { ChatGenerationChunk, type ChatResult } from '@langchain/core/outputs';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import logger from '@/lib/logger';

/**
 * Interface for Perplexity source information
 */
export interface PerplexitySource {
  title?: string;
  url: string;
  snippet?: string;
  [key: string]: unknown;
}

/**
 * Interface for Perplexity API specific options
 */
export interface PerplexityChatOptions {
  /**
   * API key for Perplexity API
   */
  apiKey?: string;

  /**
   * Model name to use
   * @default "sonar-deep-research"
   */
  model?: string;

  /**
   * Temperature for sampling
   * @default 0.7
   */
  temperature?: number;

  /**
   * Maximum number of tokens to generate
   */
  maxTokens?: number;

  /**
   * Custom base URL for Perplexity API
   */
  baseURL?: string;

  /**
   * Whether to include web sources in the response
   * @default true
   */
  includeSources?: boolean;

  /**
   * Whether to return images (requires Tier-2 subscription)
   * @default false
   */
  returnImages?: boolean;
}

/**
 * Result interface with sources
 */
export interface PerplexityResult {
  text: string;
  sources?: PerplexitySource[];
}

/**
 * Chat model implementation for Perplexity API
 */
export class PerplexityChat extends BaseChatModel {
  static lc_name() {
    return 'PerplexityChat';
  }

  apiKey: string;
  model: string;
  temperature: number;
  maxTokens?: number;
  baseURL?: string;
  includeSources: boolean;
  returnImages: boolean;
  clientOptions: Record<string, unknown>;

  constructor(
    fields?: PerplexityChatOptions & BaseChatModelParams & { fetch?: any; headers?: Record<string, string> }
  ) {
    super(fields ?? {});

    // Get API key from environment variables or fields
    this.apiKey =
      fields?.apiKey ?? getEnvironmentVariable('PERPLEXITY_API_KEY') ?? '';
    
    if (!this.apiKey) {
      throw new Error(
        'Perplexity API key is required. Please provide it as a parameter or set the PERPLEXITY_API_KEY environment variable.'
      );
    }

    this.model = fields?.model ?? 'sonar-deep-research';
    this.temperature = fields?.temperature ?? 0.7;
    this.maxTokens = fields?.maxTokens;
    this.baseURL = fields?.baseURL;
    this.includeSources = fields?.includeSources ?? true;
    this.returnImages = fields?.returnImages ?? false;
    
    // Extract additional client options
    this.clientOptions = {};
    if (fields?.fetch) this.clientOptions.fetch = fields.fetch;
    if (fields?.headers) this.clientOptions.headers = fields.headers;
  }

  /** @ignore */
  _llmType(): string {
    return 'perplexity';
  }

  /**
   * Get the parameters that are used to invoke the model
   */
  invocationParams() {
    return {
      model: this.model,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    };
  }

  /**
   * Get the identifying parameters for this LLM
   */
  identifyingParams() {
    return {
      model: this.model,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    };
  }

  /**
   * Convert messages to prompt for the Perplexity API
   */
  private _messagesToPrompt(messages: BaseMessage[]): string {
    const messageString = messages
      .map((message) => {
        const type = message._getType();
        if (type === 'human') {
          return `${message.content}`;
        } else if (type === 'ai') {
          return `${message.content}`;
        } else if (type === 'system') {
          return `System: ${message.content}`;
        } else {
          return `${message.content}`;
        }
      })
      .join('\n\n');

    return messageString;
  }

  /**
   * Call the Perplexity API with text
   */
  private async _generateFromPrompt(
    prompt: string,
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun
  ): Promise<PerplexityResult> {
    const moduleLogger = logger.withMetadata({
      module: 'PerplexityChat',
      method: '_generate',
    });

    try {
      moduleLogger.info('Generating with Perplexity API', { model: this.model });

      // Create the Perplexity provider with the API key
      const perplexityProvider = createPerplexity({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
      })(this.model);

      // Generate text using the AI SDK
      const response = await generateText({
        model: perplexityProvider,
        prompt,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        ...(runManager && { onToken: (token: string) => runManager.handleLLMNewToken(token) }),
        providerOptions: {
          perplexity: {
            return_images: this.returnImages,
          },
        },
      });

      // Extract sources from the response if they exist
      const sources = response.sources?.map((source: any) => ({
        title: source.title ?? undefined,
        url: source.url ?? '',
        snippet: source.snippet ?? source.content ?? undefined, // Try both snippet and content
      })) as PerplexitySource[];

      moduleLogger.debug('Perplexity API response', {
        sourceCount: sources?.length ?? 0,
      });

      return {
        text: response.text,
        sources: this.includeSources ? sources : undefined,
      };
    } catch (error) {
      moduleLogger.error('Error generating with Perplexity API', {}, error);
      throw error;
    }
  }

  /**
   * Implementation of _generate method required by BaseChatModel
   */
  async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const prompt = this._messagesToPrompt(messages);
    const result = await this._generateFromPrompt(prompt, options, runManager);
    
    // Create an AIMessage from the result
    const message = new AIMessage(result.text);
    
    // If sources are included, add them to the message metadata
    if (result.sources && result.sources.length > 0) {
      message.additional_kwargs = {
        ...message.additional_kwargs,
        sources: result.sources,
      };
    }
    
    return {
      generations: [{ message, text: result.text }],
    };
  }

  /** @ignore */
  async _generateStream(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun
  ): Promise<AsyncGenerator<ChatGenerationChunk>> {
    const moduleLogger = logger.withMetadata({
      module: 'PerplexityChat',
      method: '_generateStream',
    });

    try {
      const prompt = this._messagesToPrompt(messages);
      moduleLogger.info('Streaming with Perplexity API', { model: this.model });

      // Create the Perplexity provider with the API key
      const perplexityProvider = createPerplexity({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
      })(this.model);

      // Not using AI SDK's streaming capabilities here as we need to return a generator
      // that yields ChatGenerationChunk objects. Instead, we'll generate the full response
      // and return it as a single chunk.
      const response = await generateText({
        model: perplexityProvider,
        prompt,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        providerOptions: {
          perplexity: {
            return_images: this.returnImages,
          },
        },
      });

      // Create a generator to return the single chunk
      async function* generator() {
        // Create a message chunk instead of a regular message
        const messageChunk = new AIMessageChunk({
          content: response.text,
        });
        
        const chunk = new ChatGenerationChunk({
          message: messageChunk,
          text: response.text,
        });
        
        yield chunk;
      }

      return generator();
    } catch (error) {
      moduleLogger.error('Error streaming with Perplexity API', {}, error);
      throw error;
    }
  }
} 