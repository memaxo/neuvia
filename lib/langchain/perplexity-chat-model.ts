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
  
  /**
   * Enhanced error logging with consistent structure
   *
   * @param method Method where error occurred
   * @param error The error object
   * @param context Additional context information
   */
  private logError(method: string, error: unknown, context: Record<string, any> = {}): void {
    const moduleLogger = logger.withMetadata({
      module: 'PerplexityChat',
      method,
      model: this.model,
      ...context
    });
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    moduleLogger.error(`Error in ${method}`, {
      errorMessage,
      errorStack,
      ...context
    }, error);
  }

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
    // Handle different combinations of message types appropriately
    const systemMessages: string[] = [];
    const conversationMessages: string[] = [];
    
    for (const message of messages) {
      const type = message._getType();
      const content = typeof message.content === 'string'
        ? message.content
        : JSON.stringify(message.content);
        
      if (type === 'system') {
        systemMessages.push(`${content}`);
      } else if (type === 'human') {
        conversationMessages.push(`Human: ${content}`);
      } else if (type === 'ai') {
        conversationMessages.push(`AI: ${content}`);
      } else {
        conversationMessages.push(`${content}`);
      }
    }
    
    // Combine system messages at the beginning, followed by conversation
    return [
      ...systemMessages,
      ...conversationMessages
    ].join('\n\n');
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
      method: '_generateFromPrompt',
    });

    try {
      moduleLogger.info('Generating with Perplexity API', {
        model: this.model,
        promptLength: prompt.length,
        temperature: this.temperature,
        maxTokens: this.maxTokens
      });

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
        responseLength: response.text.length
      });

      return {
        text: response.text,
        sources: this.includeSources ? sources : undefined,
      };
    } catch (error) {
      this.logError('_generateFromPrompt', error, {
        promptLength: prompt.length,
        temperature: this.temperature,
        maxTokens: this.maxTokens
      });
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
      model: this.model
    });

    try {
      const prompt = this._messagesToPrompt(messages);
      moduleLogger.info('Streaming with Perplexity API', {
        model: this.model,
        promptLength: prompt.length,
        messageCount: messages.length
      });

      // Create the Perplexity provider with the API key
      const perplexityProvider = createPerplexity({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
      })(this.model);

      // Extract the instance methods we need to use inside the generator
      const extractSourcesFromText = this.extractSourcesFromText.bind(this);
      const includeSources = this.includeSources;

      // The AI SDK has two ways to handle streaming - we'll use the one that works with LangChain
      const streamMethod = generateText.stream;
      if (!streamMethod) {
        // Fallback to non-streaming if streaming not available
        moduleLogger.warn('Streaming not available, falling back to non-streaming mode');
        const result = await this._generate(messages, options, runManager);
        
        // Create a simple generator that yields the entire result at once
        async function* singleChunkGenerator() {
          const message = result.generations[0].message;
          const chunk = new ChatGenerationChunk({
            message: new AIMessageChunk({
              content: message.content,
              additional_kwargs: message.additional_kwargs,
            }),
            text: message.content,
          });
          yield chunk;
        }
        
        return singleChunkGenerator();
      }

      // Use the stream method from AI SDK
      const stream = await streamMethod({
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

      // Process the stream into LangChain format
      async function* langChainGenerator() {
        let accumulatedText = '';
        let sourcesParsed = false;
        let allSources: PerplexitySource[] = [];
        
        try {
          for await (const chunk of stream) {
            // Safety check for null/undefined chunks
            if (!chunk) continue;
            
            accumulatedText += chunk;
            
            // Create an AIMessageChunk with the current tokens
            const messageChunk = new AIMessageChunk({
              content: chunk,
            });
            
            // Add potential sources to metadata if they're available
            if (!sourcesParsed && accumulatedText.includes('Sources:')) {
              try {
                const potentialSources = extractSourcesFromText(accumulatedText);
                if (potentialSources.length > 0) {
                  sourcesParsed = true;
                  allSources = potentialSources;
                  
                  // Add sources to the message metadata
                  messageChunk.additional_kwargs = {
                    ...messageChunk.additional_kwargs,
                    sources: potentialSources,
                  };
                }
              } catch (sourceError) {
                // Don't let source extraction break the streaming
                moduleLogger.warn('Failed to extract sources during streaming', {}, sourceError);
              }
            }
            
            // Create a chat generation chunk
            const generationChunk = new ChatGenerationChunk({
              message: messageChunk,
              text: chunk,
            });
            
            // Send to callback manager if provided
            if (runManager) {
              try {
                await runManager.handleLLMNewToken(chunk);
              } catch (callbackError) {
                // Don't let callback errors break the streaming
                moduleLogger.warn('Error in streaming callback', {}, callbackError);
              }
            }
            
            yield generationChunk;
          }
          
          // After stream completes, check for sources again
          if (!sourcesParsed && includeSources) {
            try {
              allSources = extractSourcesFromText(accumulatedText);
              
              if (allSources.length > 0) {
                // Yield a final chunk with source information
                const finalMessageChunk = new AIMessageChunk({
                  content: '',
                  additional_kwargs: {
                    sources: allSources,
                  },
                });
                
                const finalGenerationChunk = new ChatGenerationChunk({
                  message: finalMessageChunk,
                  text: '',
                });
                
                yield finalGenerationChunk;
              }
            } catch (sourceError) {
              moduleLogger.warn('Failed to extract sources after streaming completed', {}, sourceError);
            }
          }
        } catch (streamingError) {
          // Handle errors during streaming
          moduleLogger.error('Error during streaming process', {
            accumulatedLength: accumulatedText.length,
          }, streamingError);
          
          // Rethrow the error to be handled by the caller
          throw streamingError;
        }
      }

      return langChainGenerator();
    } catch (error) {
      this.logError('_generateStream', error, {
        messageCount: messages.length,
        temperature: this.temperature,
        maxTokens: this.maxTokens
      });
      throw error;
    }
  }
  
  /**
   * Helper function to extract sources from text content
   * This is a backup mechanism when sources aren't provided in a structured format
   */
  private extractSourcesFromText(text: string): PerplexitySource[] {
    if (!text || typeof text !== 'string') return [];
    
    try {
      const sources: PerplexitySource[] = [];
      
      // Common patterns for source sections
      const sourcePatterns = [
        /Sources?:[\s\n]+((?:.+[\n]?)+)/i,
        /References?:[\s\n]+((?:.+[\n]?)+)/i,
        /Citations?:[\s\n]+((?:.+[\n]?)+)/i
      ];
      
      // Try each pattern
      for (const pattern of sourcePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const sourcesText = match[1];
          
          // Split into individual sources
          const sourceLines = sourcesText
            .split(/\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0 && line.includes('http'));
          
          for (const line of sourceLines) {
            // Extract URL
            const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch && urlMatch[1]) {
              const url = urlMatch[1].replace(/[.,;:)]$/, ''); // Clean up URL
              
              // Extract title (text before the URL)
              let title = line.split(urlMatch[1])[0].trim();
              if (title.endsWith('-') || title.endsWith(':')) {
                title = title.slice(0, -1).trim();
              }
              
              sources.push({
                title: title || undefined,
                url,
                snippet: line,
              });
            }
          }
          
          // If we found sources, no need to try other patterns
          if (sources.length > 0) break;
        }
      }
      
      return sources;
    } catch (error) {
      // In case of any error, return empty array to avoid breaking the main flow
      return [];
    }
  }
} 