/**
 * LangChain Core Implementation
 * 
 * Core initialization of LangChain components and type-safe factory methods.
 * This module serves as the central point for managing LangChain components
 * in the Neuvia application.
 */
import { ChatOpenAI, OpenAIEmbeddings} from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate , ChatPromptTemplate } from '@langchain/core/prompts';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { getDefaultConfig } from './config';
import { supabaseVectorStore, type EnhancedSupabaseVectorStore } from '../vectorstore/supabase-store';
import type { Database } from '@/lib/supabase';

/**
 * LangChain Core class
 * Provides factory methods for creating LangChain components
 */
export class LangChainCore {
  private static instance: LangChainCore;
  private initialized = false;
  
  private constructor(
    private readonly config = getDefaultConfig()
  ) {}
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): LangChainCore {
    if (!LangChainCore.instance) {
      LangChainCore.instance = new LangChainCore();
    }
    return LangChainCore.instance;
  }
  
  /**
   * Initialize the LangChain Core
   * This method must be called before using any component
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Verify required configurations
    this.validateConfig();
    
    // Initialize singleton components
    // Future enhancements: Add any global initialization here
    
    this.initialized = true;
    console.log('LangChain Core initialized successfully');
  }
  
  /**
   * Validate configuration
   */
  private validateConfig(): void {
    // Validate OpenAI configuration
    if (!this.config.openai.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    // Validate Supabase configuration
    if (!this.config.supabase.url || !this.config.supabase.serviceKey) {
      throw new Error('Supabase URL and service key are required');
    }
    
    // Other validations can be added here
  }
  
  /**
   * Get the Supabase vector store
   */
  public getVectorStore(): EnhancedSupabaseVectorStore {
    this.ensureInitialized();
    return supabaseVectorStore;
  }
  
  /**
   * Create an OpenAI chat model (O3 Mini)
   * 
   * @param options Optional configuration for the chat model
   */
  public createChatOpenAI(options?: {
    modelName?: string;
    temperature?: number;
    streaming?: boolean;
    callbacks?: BaseCallbackHandler[];
  }) {
    this.ensureInitialized();
    
    return new ChatOpenAI({
      openAIApiKey: this.config.openai.apiKey,
      modelName: options?.modelName || this.config.openai.chatModel, // Defaults to 'o3-mini'
      temperature: options?.temperature ?? 0.7,
      streaming: options?.streaming ?? false,
      callbacks: options?.callbacks,
    });
  }
  
  /**
   * Create a Gemini chat model (Gemini 2.0 Flash)
   * 
   * @param options Optional configuration for the chat model
   */
  public createChatGemini(options?: {
    modelName?: string;
    temperature?: number;
    streaming?: boolean;
    callbacks?: BaseCallbackHandler[];
  }) {
    this.ensureInitialized();
    
    // Check if Gemini API key is available
    if (!this.config.gemini?.apiKey) {
      throw new Error('Gemini API key is not configured');
    }
    
    return new ChatGoogleGenerativeAI({
      apiKey: this.config.gemini.apiKey,
      modelName: options?.modelName || this.config.gemini.modelName, // Defaults to 'gemini-2.0-flash'
      temperature: options?.temperature ?? 0.7,
      streaming: options?.streaming ?? false,
      callbacks: options?.callbacks,
    });
  }
  
  /**
   * Create OpenAI embeddings
   * 
   * @param options Optional configuration for the embeddings
   */
  public createEmbeddings(options?: {
    modelName?: string;
    batchSize?: number;
  }) {
    this.ensureInitialized();
    
    return new OpenAIEmbeddings({
      openAIApiKey: this.config.openai.apiKey,
      modelName: options?.modelName || this.config.openai.embeddingModel, // text-embedding-3-small
      batchSize: options?.batchSize,
    });
  }
  
  /**
   * Create a prompt template
   * 
   * @param template Prompt template string
   * @param inputVariables Array of input variable names
   */
  public createPromptTemplate(
    template: string,
    inputVariables: string[]
  ) {
    this.ensureInitialized();
    
    return PromptTemplate.fromTemplate(template);
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
    this.ensureInitialized();
    
    return ChatPromptTemplate.fromMessages([
      ["system", systemTemplate],
      ["human", humanTemplate],
    ]);
  }
  
  /**
   * Create a message based on the role
   * 
   * @param role Message role (system, human, ai)
   * @param content Message content
   */
  public createMessage(
    role: 'system' | 'human' | 'ai',
    content: string
  ) {
    this.ensureInitialized();
    
    switch (role) {
      case 'system':
        return new SystemMessage(content);
      case 'human':
        return new HumanMessage(content);
      case 'ai':
        return new AIMessage(content);
      default:
        throw new Error(`Unknown message role: ${role}`);
    }
  }
  
  /**
   * Create a string output parser
   */
  public createStringOutputParser() {
    this.ensureInitialized();
    
    return new StringOutputParser();
  }
  
  /**
   * Ensure the core is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('LangChain Core is not initialized. Call initialize() first.');
    }
  }
}

// Export a singleton instance
export const langChainCore = LangChainCore.getInstance(); 