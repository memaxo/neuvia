/**
 * Perplexity Deep Research Client
 * 
 * Core client for interacting with Perplexity's Deep Research API.
 */
import { perplexity } from '@ai-sdk/perplexity';
import { generateText } from 'ai';
import perplexityConfig from '@/lib/config/perplexity';

/**
 * Options for performing deep research
 */
export interface ResearchOptions {
  /**
   * Maximum number of tokens in the response
   */
  maxTokens?: number;
  
  /**
   * Temperature for generation
   */
  temperature?: number;
  
  /**
   * Whether to include images in the response (Tier-2 users only)
   */
  includeImages?: boolean;
  
  /**
   * Whether this is a medical diagnosis query that should use the specialized prompt
   */
  isMedicalDiagnosis?: boolean;
  
  /**
   * Extracted patient data from Gemini 2.0 flash document extraction
   */
  patientData?: string;
}

/**
 * Represents a source in the research results
 */
export interface ResearchSource {
  /**
   * Title of the source
   */
  title?: string;
  
  /**
   * URL of the source
   */
  url: string;
  
  /**
   * Snippet from the source content
   */
  snippet?: string;
}

/**
 * Research result from Perplexity API
 */
export interface ResearchResult {
  /**
   * Generated text with research findings
   */
  text: string;
  
  /**
   * Sources used for the research
   */
  sources: ResearchSource[];
}

/**
 * Default debug mode flag
 */
const DEFAULT_DEBUG = process.env.NODE_ENV === 'development';

/**
 * Medical differential diagnosis prompt template
 */
const MEDICAL_DIAGNOSIS_PROMPT = `# Deep Research AI Differential Diagnosis & Treatment Prompt

You are an advanced clinical decision support system specializing in evaluating complex patient presentations across medical, psychological, and behavioral fields. Analyze the provided patient summary and generate a direct, evidence-based breakdown of the most likely conditions or issues. For each condition or issue, include:

1. **Condition/Disorder Name:** Clearly state the specific condition or issue.
2. **Confidence Rating:** Provide a percent confidence (e.g., 70%) that reflects the likelihood based on the data.
3. **Rationale:** Explain the reasoning behind your confidence rating by referencing key patient information (symptoms, history, behavioral observations, test results, etc.) and relevant guidelines or literature.
4. **Possible Treatments & Follow-ups:** Offer potential treatment options (e.g., therapeutic interventions, counseling strategies, medications, lifestyle modifications) and recommended follow-up actions or referrals.

Your response should follow this structure:

1. **Patient Summary Overview:**  
   - Briefly restate the critical patient information and key findings.

2. **Differential Diagnosis Breakdown:**  
   - **Condition/Disorder 1:**  
     - **Confidence:** X%  
     - **Rationale:** [Detailed explanation supporting why this condition is likely, including relevant patient history, symptoms, and any supporting evidence from literature or guidelines.]  
     - **Possible Treatments & Follow-ups:** [Recommendations for therapy, counseling, medication, referrals, or further assessments.]  
   - **Condition/Disorder 2:**  
     - **Confidence:** Y%  
     - **Rationale:** [Detailed explanation supporting this option.]  
     - **Possible Treatments & Follow-ups:** [Recommendations for appropriate interventions and follow-up actions.]  
   - **Condition/Disorder 3:**  
     - **Confidence:** Z%  
     - **Rationale:** [Detailed explanation supporting this option.]  
     - **Possible Treatments & Follow-ups:** [Recommendations for interventions and follow-up.]  
   - *[Include additional conditions as relevant]*

3. **Conclusion:**  
   - Summarize your findings and recommend additional diagnostic tests, assessments, or referrals necessary for further evaluation and confirmation of the diagnosis.

Patient Summary Data:  
{{PATIENT_DATA}}

Your output should directly name each potential condition or issue along with its confidence rating, provide a clear rationale for each, and offer possible treatment options and follow-up actions.`;

/**
 * Perform deep research using Perplexity API
 * 
 * @param query Research query
 * @param options Research options
 * @param debug Whether to log debugging information
 * @returns Research result with sources
 */
export async function performDeepResearch(
  query: string,
  options?: ResearchOptions,
  debug: boolean = DEFAULT_DEBUG
): Promise<ResearchResult> {
  if (debug) {
    console.log('[PerplexityClient] Research query:', query);
  }
  
  try {
    let promptText = query;
    let systemPrompt = "You are a helpful research assistant. You provide comprehensive, accurate, and well-sourced information. When responding to research requests, always include at least 3-5 sources with URLs and detailed citations.";
    
    // Use medical diagnosis prompt template if specified
    if (options?.isMedicalDiagnosis) {
      // Insert patient data from Gemini 2.0 extraction into the prompt template
      const patientData = options.patientData || 'No patient data provided';
      promptText = MEDICAL_DIAGNOSIS_PROMPT.replace('{{PATIENT_DATA}}', patientData);
      
      // Add the query as context for the diagnosis
      if (query) {
        promptText = `${promptText}\n\nAdditional context for diagnosis: ${query}`;
      }
      
      // Use a more specialized system prompt for medical diagnosis
      systemPrompt = "You are an advanced medical diagnostic assistant with expertise in clinical medicine, psychology, and behavioral health. Provide evidence-based differential diagnoses with confidence ratings, rationales, and treatment recommendations. Always include relevant medical literature citations.";
    }
    
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
    console.error('[PerplexityClient] Error:', error);
    throw new Error(`Research failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Perform medical differential diagnosis using Perplexity API and Gemini document extraction
 * 
 * @param query Additional context for the diagnosis
 * @param patientData Extracted patient data from document
 * @param options Research options
 * @param debug Whether to log debugging information
 * @returns Research result with differential diagnosis and sources
 */
export async function performMedicalDiagnosis(
  query: string,
  patientData: string,
  options?: Omit<ResearchOptions, 'isMedicalDiagnosis' | 'patientData'>,
  debug: boolean = DEFAULT_DEBUG
): Promise<ResearchResult> {
  // Call the general research function with medical diagnosis options
  return performDeepResearch(query, {
    ...options,
    isMedicalDiagnosis: true,
    patientData,
    maxTokens: options?.maxTokens || 4000, // Higher token limit for medical diagnoses
    temperature: options?.temperature || 0.5, // Lower temperature for more consistent medical results
  }, debug);
}

/**
 * Extract sources from text when metadata is not available
 * This is a fallback method when the API doesn't return structured sources
 * 
 * @param text The research text
 * @returns Extracted sources
 */
function extractSourcesFromText(text: string): ResearchSource[] {
  const sources: ResearchSource[] = [];
  
  // Look for URLs in the text
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex) || [];
  
  // Create sources from the URLs
  urls.forEach(url => {
    sources.push({
      url,
      title: getTitleFromUrl(url),
    });
  });
  
  // Look for references like [1] or [2] followed by text and URL
  const referenceRegex = /\[\d+\]\s*([^:]+):\s*(https?:\/\/[^\s]+)/g;
  let match;
  
  while ((match = referenceRegex.exec(text)) !== null) {
    sources.push({
      title: match[1].trim(),
      url: match[2].trim(),
    });
  }
  
  // For medical text, look for journal references with doi or pubmed IDs
  const medicalRefRegex = /(?:doi|DOI|pmid|PMID)[:\s]*([\d\.\/\-]+)/g;
  while ((match = medicalRefRegex.exec(text)) !== null) {
    const id = match[1].trim();
    let url = '';
    
    if (match[0].toLowerCase().includes('doi')) {
      url = `https://doi.org/${id}`;
    } else if (match[0].toLowerCase().includes('pmid')) {
      url = `https://pubmed.ncbi.nlm.nih.gov/${id}/`;
    }
    
    if (url) {
      sources.push({
        url,
        title: `Medical reference ${id}`,
      });
    }
  }
  
  return sources;
}

/**
 * Extract a title from a URL
 * 
 * @param url The URL to extract a title from
 * @returns A simple title based on the URL
 */
function getTitleFromUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    const parts = pathname.split('/').filter(Boolean);
    
    if (parts.length > 0) {
      // Convert the last path segment to a title (e.g., "how-to-research" -> "How To Research")
      const lastPart = parts[parts.length - 1]
        .replace(/[-_]/g, ' ')
        .replace(/\.html|\.php|\.asp/g, '');
      
      return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
    }
    
    // Fallback to the domain name
    return hostname.replace(/^www\./, '');
  } catch (e) {
    return url;
  }
} 