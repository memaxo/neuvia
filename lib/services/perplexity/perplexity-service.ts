/**
 * Unified Perplexity Service
 * 
 * Single entry point for all Perplexity API interactions across the application
 */
import { perplexity } from '@ai-sdk/perplexity';
import { generateText } from 'ai';
import perplexityConfig from '@/lib/config/perplexity';
import type { ResearchOptions, ResearchResult, ResearchSource } from '@/lib/processing/types/research';

// Default debug flag
const DEFAULT_DEBUG = perplexityConfig.debug || false;

/**
 * Standard system prompt for deep research
 */
const DEEP_RESEARCH_SYSTEM_PROMPT = `You are a medical research assistant specializing in analyzing patient data and providing comprehensive reports.
Your task is to research the query thoroughly and provide detailed, accurate information.
Use medical terminology appropriately and cite reliable sources.
Structure your response clearly with sections, and ensure all claims are evidence-based.`;

/**
 * Medical diagnosis-specific system prompt
 */
const MEDICAL_DIAGNOSIS_SYSTEM_PROMPT = `You are a medical AI assistant with expertise in analyzing patient data and providing clinical insights.
Your task is to analyze the provided patient information and offer a detailed medical assessment.
You should:
1. Identify potential diagnoses based on the symptoms and patient history
2. Suggest relevant tests or examinations that could confirm the diagnosis
3. Recommend potential treatment options
4. Note any concerning signs that may require urgent attention
5. Provide evidence-based reasoning for your conclusions
Use appropriate medical terminology and cite relevant medical literature when possible.`;

/**
 * Extract sources from text when API doesn't return them
 * 
 * @param text Text to extract sources from
 * @returns Extracted sources
 */
function extractSourcesFromText(text: string): ResearchSource[] {
  const sources: ResearchSource[] = [];
  
  // Look for URLs in the text
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urlMatches = text.match(urlRegex);
  
  if (urlMatches) {
    urlMatches.forEach(url => {
      sources.push({
        url,
        title: url.split('/').pop() || url,
      });
    });
  }
  
  // Look for numbered references [1], [2], etc.
  const referenceRegex = /\[(\d+)\]\s*([^[\n]+)/g;
  let match;
  
  while ((match = referenceRegex.exec(text)) !== null) {
    const index = parseInt(match[1]);
    const reference = match[2].trim();
    
    // Extract URL if present
    const urlMatch = reference.match(urlRegex);
    const url = urlMatch ? urlMatch[0] : undefined;
    
    sources.push({
      title: reference.replace(urlRegex, '').trim(),
      url: url,
      index,
    });
  }
  
  return sources;
}

/**
 * Unified Perplexity Service
 */
export class PerplexityService {
  /**
   * Perform deep research using Perplexity API
   * 
   * @param query Research query
   * @param options Research options
   * @param debug Enable debug logging
   * @returns Research result
   */
  async performDeepResearch(
    query: string,
    options?: ResearchOptions,
    debug: boolean = DEFAULT_DEBUG
  ): Promise<ResearchResult> {
    if (debug) {
      console.log('[PerplexityService] Performing deep research:', query);
      console.log('[PerplexityService] Options:', options);
    }
    
    try {
      // Build the prompt
      const promptText = options?.isMedicalDiagnosis
        ? `Analyze the following patient data and provide a detailed medical assessment:\n\n${options.patientData || ''}\n\nUser query: ${query}`
        : query;
      
      // Select the appropriate system prompt
      const systemPrompt = options?.isMedicalDiagnosis
        ? MEDICAL_DIAGNOSIS_SYSTEM_PROMPT
        : DEEP_RESEARCH_SYSTEM_PROMPT;
      
      // Use the AI SDK to call Perplexity API following the documentation pattern
      const completion = await generateText({
        model: perplexity('sonar-deep-research'), // Specify the model ID
        prompt: promptText,
        temperature: options?.temperature || 0.7,
        maxTokens: options?.maxTokens || 3000, // Higher token limit for medical diagnoses
        system: systemPrompt,
        providerOptions: options?.includeImages ? {
          perplexity: {
            return_images: true
          }
        } : undefined
      });
      
      const text = completion.text;
      
      // Extract sources from the response - either from metadata or by parsing text
      const sources = Array.isArray(completion.sources) && completion.sources.length > 0
        ? completion.sources
            .filter(Boolean)
            .map(source => {
              if (!source) return null;
              
              return {
                title: typeof source === 'object' && 'title' in source ? source.title : undefined,
                url: typeof source === 'object' && 'url' in source 
                  ? source.url 
                  : typeof source === 'string' ? source : 'unknown',
                snippet: typeof source === 'object' && 'snippet' in source ? source.snippet : undefined
              };
            })
            .filter(Boolean) as ResearchSource[]
        : extractSourcesFromText(text);
      
      return {
        text,
        sources
      };
    } catch (error) {
      console.error('[PerplexityService] Error:', error);
      throw new Error(`Research failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Perform medical diagnosis using Perplexity API
   * 
   * @param query User query
   * @param patientData Patient data
   * @param options Research options
   * @returns Research result
   */
  async performMedicalDiagnosis(
    query: string,
    patientData: string,
    options?: ResearchOptions
  ): Promise<ResearchResult> {
    return this.performDeepResearch(query, {
      ...options,
      isMedicalDiagnosis: true,
      patientData
    });
  }
}

// Export singleton instance
export const perplexityService = new PerplexityService(); 