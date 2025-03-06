import perplexityConfig from '@/lib/config/perplexity'
import researchConfig, {
  type ResearchDepth,
  type ResearchDepthConfig,
} from '@/lib/config/research'
import { langChainCore } from '@/lib/langchain/core'
import type {
  ResearchOptions,
  ResearchResult,
  ResearchSource,
} from '@/lib/processing/types/research'
// Use string type assertion since we can't find the module
type WorkflowStep = string
import { createWorkflowCallbacks, runWithWorkflow } from '@/lib/utils/langchain'
import logger from '@/lib/logger'
import {
  ExternalServiceError,
  ValidationError,
  SystemError,
  normalizeError,
  type ApplicationError,
} from '@/lib/errors'
/**
 * Unified Perplexity Service
 *
 * Single entry point for all Perplexity API interactions across the application
 */
import { perplexity } from '@ai-sdk/perplexity'
import { generateText } from 'ai'
import { StructuredOutputParser } from 'langchain/output_parsers'
import { z } from 'zod'
import {
  RunnableSequence,
  RunnableBranch,
  RunnableMap,
  RunnablePassthrough,
} from '@langchain/core/runnables'

// Extend ResearchOptions to include depth
interface EnhancedResearchOptions extends ResearchOptions {
  /**
   * Research depth level
   */
  depth?: ResearchDepth
}

/**
 * Interface for the Perplexity API source information
 */
interface PerplexitySource {
  title?: string
  url: string
  snippet?: string
  [key: string]: any
}

/**
 * Interface for the Perplexity API completion
 */
interface PerplexityCompletion {
  text: string
  sources?: (PerplexitySource | string)[]
  [key: string]: any
}

// Create more specific error classes
class PerplexityAPIError extends ExternalServiceError {
  constructor(message: string, data?: Record<string, any>, cause?: unknown) {
    super({
      message,
      code: 'PERPLEXITY_API_ERROR',
      service: 'Perplexity API',
      data,
      cause,
    })
  }
}

class PerplexityParsingError extends ValidationError {
  constructor(message: string, data?: Record<string, any>, cause?: unknown) {
    super({
      message,
      code: 'PERPLEXITY_PARSING_ERROR',
      data,
      cause,
    })
  }
}

/**
 * Medical diagnosis-specific system prompt
 */
const MEDICAL_DIAGNOSIS_SYSTEM_PROMPT = `# Deep Research AI Differential Diagnosis & Treatment Prompt

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
   - Summarize your findings and recommend additional diagnostic tests, assessments, or referrals necessary for further evaluation and confirmation of the diagnosis.`

// Define a schema for the structured output from Perplexity API
const ResearchResultSchema = z.object({
  text: z
    .string()
    .describe('The full research text with all details and findings'),
  sources: z
    .array(
      z.object({
        title: z.string().optional().describe('The title of the source'),
        url: z.string().describe('The URL of the source'),
        snippet: z
          .string()
          .optional()
          .describe('A brief excerpt or summary of the source content'),
      })
    )
    .describe('The list of sources used in the research'),
  summary: z.string().describe('A concise summary of the research findings'),
  keyFindings: z
    .array(z.string())
    .describe('List of key findings or takeaways from the research'),
})

// More detailed schema for medical diagnosis results
const MedicalDiagnosisSchema = z.object({
  text: z
    .string()
    .describe('The full medical diagnosis report with all details'),
  sources: z
    .array(
      z.object({
        title: z.string().optional().describe('The title of the source'),
        url: z.string().describe('The URL of the source'),
        snippet: z
          .string()
          .optional()
          .describe('A brief excerpt or summary of the source content'),
      })
    )
    .describe('The medical references and literature sources used'),
  summary: z.string().describe('A concise summary of the diagnostic findings'),
  keyFindings: z
    .array(z.string())
    .describe('Key clinical findings from the analysis'),
  patientSummary: z
    .string()
    .optional()
    .describe('Overview of critical patient information'),
  differentialDiagnosis: z
    .array(
      z.object({
        condition: z.string().describe('Name of the condition or disorder'),
        confidence: z
          .number()
          .min(0)
          .max(100)
          .describe('Confidence rating as a percentage'),
        rationale: z
          .string()
          .describe('Detailed explanation supporting this diagnosis'),
        treatments: z
          .string()
          .describe('Recommended treatments and follow-up actions'),
      })
    )
    .optional()
    .describe(
      'Detailed breakdown of potential diagnoses with confidence ratings'
    ),
  recommendations: z
    .array(z.string())
    .optional()
    .describe(
      'Recommended diagnostic tests, assessments, or specialist referrals'
    ),
})

// Create output parsers from the schemas
const outputParser = StructuredOutputParser.fromZodSchema(ResearchResultSchema)
const medicalDiagnosisParser = StructuredOutputParser.fromZodSchema(
  MedicalDiagnosisSchema
)

// Default debug flag - use research config for consistency
const DEFAULT_DEBUG = researchConfig.debug

/**
 * Standard system prompt for deep research
 */
const DEEP_RESEARCH_SYSTEM_PROMPT = `You are a research assistant specializing in analyzing information and providing comprehensive reports.
Your task is to research the query thoroughly and provide detailed, accurate information.
Use appropriate terminology and cite reliable sources.
Structure your response clearly with sections, and ensure all claims are evidence-based.

You MUST return your response in a structured format according to the specification below.`

/**
 * Interface for parsed output from LangChain output parser
 */
interface ParsedResearchOutput {
  text: string
  sources: ResearchSource[]
  summary: string
  keyFindings: string[]
}

/**
 * Utility class for text extraction operations
 */
class TextExtractionUtils {
  /**
   * Extract differential diagnoses from text
   *
   * @param text Research text
   * @returns Array of differential diagnoses
   */
  static extractDifferentialDiagnoses(text: string): string[] {
    const diagnoses: string[] = []

    // Look for headers indicating conditions
    const conditionRegex =
      /(?:##?\s*|[\*\d]+\.\s*)(?:Condition|Disorder|Diagnosis)[^\n]*?:\s*([^\n]+)/gi
    let conditionMatch

    while ((conditionMatch = conditionRegex.exec(text)) !== null) {
      if (conditionMatch[1]) {
        diagnoses.push(conditionMatch[1].trim())
      }
    }

    // Look for confidence ratings
    const confidenceRegex =
      /(?:##?\s*|[\*\d]+\.\s*)Confidence[^\n]*?:\s*(\d+)%/gi
    const confidences: string[] = []
    let confidenceMatch

    while ((confidenceMatch = confidenceRegex.exec(text)) !== null) {
      if (confidenceMatch[1]) {
        confidences.push(`${confidenceMatch[1]}%`)
      }
    }

    // Combine conditions with confidences if available
    if (diagnoses.length > 0 && confidences.length === diagnoses.length) {
      return diagnoses.map(
        (diagnosis, index) => `${diagnosis} (${confidences[index]} confidence)`
      )
    }

    // Fall back to sections that might indicate diagnoses
    if (diagnoses.length === 0) {
      const sectionRegex = /##?\s*([^#\n]+?)(?:\n|$)/g
      let sectionMatch

      while ((sectionMatch = sectionRegex.exec(text)) !== null) {
        const sectionTitle = sectionMatch[1].trim()
        if (
          sectionTitle.includes('Diagnos') ||
          sectionTitle.includes('Condition') ||
          sectionTitle.includes('Disorder') ||
          sectionTitle.includes('Assessment')
        ) {
          diagnoses.push(sectionTitle)
        }
      }
    }

    return diagnoses.length > 0
      ? diagnoses
      : TextExtractionUtils.extractKeyFindings(text)
  }

  /**
   * Extract a summary from research text
   *
   * @param text Research text
   * @returns Extracted summary
   */
  static extractSummary(text: string): string {
    // Look for a summary section
    const summaryMatch = text.match(
      /(?:^|\n)(?:##?\s*Summary\s*\n+|\*\*Summary\*\*\s*\n+)([^\n].*?)(?:\n+(?:##?|$))/s
    )
    if (summaryMatch && summaryMatch[1]) {
      return summaryMatch[1].trim()
    }

    // If no explicit summary section, use the first paragraph
    const firstParagraph = text.split(/\n\n+/)[0]
    if (firstParagraph && firstParagraph.length > 50) {
      return firstParagraph.trim()
    }

    // If very short text, use it all
    if (text.length < 500) {
      return text.trim()
    }

    // Otherwise, use first 200 characters + "..."
    return `${text.substring(0, 200).trim()}...`
  }

  /**
   * Extract key findings from research text
   *
   * @param text Research text
   * @returns Array of key findings
   */
  static extractKeyFindings(text: string): string[] {
    const findings: string[] = []

    // Look for bullet points and numbered lists
    const bulletPoints = text.match(/(?:^|\n)[•*-]\s+([^\n]+)/g)
    if (bulletPoints) {
      bulletPoints.forEach((point) => {
        findings.push(point.replace(/^[•*-]\s+/, '').trim())
      })
    }

    // Look for numbered points
    const numberedPoints = text.match(/(?:^|\n)\d+\.\s+([^\n]+)/g)
    if (numberedPoints) {
      numberedPoints.forEach((point) => {
        findings.push(point.replace(/^\d+\.\s+/, '').trim())
      })
    }

    // Look for findings/key points section
    const findingsSection = text.match(
      /(?:##?\s*(?:Key\s*)?Findings|Observations|Results)\s*\n+([^#]+)/i
    )
    if (findingsSection && findingsSection[1]) {
      const sectionPoints = findingsSection[1]
        .split(/\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
      findings.push(...sectionPoints)
    }

    // If we found nothing or very little, extract first few sentences
    if (findings.length < 2) {
      const sentences = text.match(/[^.!?]+[.!?]+/g)
      if (sentences && sentences.length > 0) {
        const selectedSentences = sentences.slice(0, 3).map((s) => s.trim())
        findings.push(...selectedSentences)
      }
    }

    // Remove duplicates and limit length
    return [...new Set(findings)].slice(0, 5)
  }

  /**
   * Extract sources from text when metadata is not available
   *
   * @param text The research text
   * @returns Extracted sources
   */
  static extractSourcesFromText(text: string): ResearchSource[] {
    const sources: ResearchSource[] = []

    // Look for URLs in the text
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const urlMatches = text.match(urlRegex)

    if (urlMatches) {
      urlMatches.forEach((url) => {
        sources.push({
          url,
          title: TextExtractionUtils.getTitleFromUrl(url),
        })
      })
    }

    // Look for numbered references [1], [2], etc.
    const referenceRegex = /\[(\d+)\]\s*([^[\n]+)/g
    let match

    while ((match = referenceRegex.exec(text)) !== null) {
      const index = parseInt(match[1])
      const reference = match[2].trim()

      // Extract URL if present
      const urlMatch = reference.match(urlRegex)
      const url = urlMatch ? urlMatch[0] : 'undefined' // Default to string "undefined" instead of undefined

      sources.push({
        title: reference.replace(urlRegex, '').trim(),
        url,
        index,
      })
    }

    return sources
  }

  /**
   * Extract a title from a URL
   *
   * @param url The URL to extract a title from
   * @returns A simple title based on the URL
   */
  static getTitleFromUrl(url: string): string {
    try {
      const { hostname, pathname } = new URL(url)
      const parts = pathname.split('/').filter(Boolean)

      if (parts.length > 0) {
        // Convert the last path segment to a title (e.g., "how-to-research" -> "How To Research")
        const lastPart = parts[parts.length - 1]
          .replace(/[-_]/g, ' ')
          .replace(/\.html|\.php|\.asp/g, '')

        return lastPart.charAt(0).toUpperCase() + lastPart.slice(1)
      }

      // Fallback to the domain name
      return hostname.replace(/^www\./, '')
    } catch (e) {
      return url
    }
  }
}

/**
 * PerplexityService class - the single source of truth for all Perplexity API interactions
 */
export class PerplexityService {
  // Add a cache for research results
  private researchCache = new Map<
    string,
    { result: ResearchResult; timestamp: Date }
  >()

  /**
   * Get a unique cache key for a research query and options
   */
  private getCacheKey(
    query: string,
    options?: EnhancedResearchOptions
  ): string {
    return `${query}|${JSON.stringify(options)}`
  }

  /**
   * Get a cached research result if available and not expired
   */
  private getCachedResult(
    query: string,
    options?: EnhancedResearchOptions
  ): ResearchResult | null {
    const key = this.getCacheKey(query, options)
    const cached = this.researchCache.get(key)

    // Return null if not cached
    if (!cached || !cached.timestamp) {
      return null
    }

    // Calculate cache age in milliseconds
    const cacheAge = new Date().getTime() - cached.timestamp.getTime()
    if (cacheAge > 3600000) {
      // 1 hour in milliseconds
      return null
    }

    return cached.result
  }

  /**
   * Cache a research result
   */
  private cacheResult(
    query: string,
    options: EnhancedResearchOptions | undefined,
    result: ResearchResult
  ): void {
    const key = this.getCacheKey(query, options)
    this.researchCache.set(key, { result, timestamp: new Date() })
  }

  /**
   * Handle parsing error with detailed logging
   *
   * @param error The parsing error
   * @param text The original text that failed to parse
   * @returns A fallback parsed output
   */
  private handleParsingError(
    error: unknown,
    text: string
  ): ParsedResearchOutput {
    // Create a logger with context metadata
    const moduleLogger = logger.withMetadata({
      module: 'PerplexityService',
      method: 'handleParsingError',
      textLength: text.length,
      errorType: error instanceof Error ? error.name : typeof error,
    })

    // Log detailed error information with structured logging
    moduleLogger.warn(
      'Structured parsing failed',
      {
        errorMessage: error instanceof Error ? error.message : String(error),
        textPreview: text.length > 200 ? `${text.substring(0, 200)}...` : text,
      },
      error
    )

    // Determine if this is likely a medical diagnosis text
    const isMedicalDiagnosis =
      text.includes('Differential Diagnosis') ||
      text.includes('Patient Summary') ||
      text.includes('Condition:') ||
      text.includes('Confidence:')

    // Return a fallback object with manually extracted information
    return {
      text,
      summary: TextExtractionUtils.extractSummary(text),
      keyFindings: isMedicalDiagnosis
        ? TextExtractionUtils.extractDifferentialDiagnoses(text)
        : TextExtractionUtils.extractKeyFindings(text),
      sources: [], // Empty sources array, will be filled later
    }
  }

  /**
   * Process raw text from Perplexity API response into a structured research result
   *
   * @param text The raw text from the Perplexity API response
   * @param completion The full completion object from the Perplexity API
   * @param isMedicalDiagnosis Whether this is a medical diagnosis request
   * @returns A structured research result
   */
  private async processApiResponse(
    text: string,
    completion: PerplexityCompletion,
    isMedicalDiagnosis: boolean = false
  ): Promise<ResearchResult> {
    // Try to parse the response using the structured output parser
    let parsedOutput: ParsedResearchOutput
    let sources: ResearchSource[] = []
    let keyFindings: string[] = []
    let summary: string = ''

    try {
      // Choose the appropriate parser based on the request type
      if (isMedicalDiagnosis) {
        // For medical diagnoses, use the specialized medical diagnosis parser
        const medicalResult = await medicalDiagnosisParser.parse(text)

        // Convert the structured medical diagnosis to our standard format
        summary = medicalResult.summary
        sources = medicalResult.sources || []

        // Extract key findings from the differential diagnosis
        if (
          medicalResult.differentialDiagnosis &&
          medicalResult.differentialDiagnosis.length > 0
        ) {
          keyFindings = medicalResult.differentialDiagnosis.map(
            (diagnosis) =>
              `${diagnosis.condition} (${diagnosis.confidence}% confidence)`
          )

          // Add recommendations to key findings if available
          if (
            medicalResult.recommendations &&
            medicalResult.recommendations.length > 0
          ) {
            keyFindings = [...keyFindings, ...medicalResult.recommendations]
          }
        } else {
          keyFindings = medicalResult.keyFindings || []
        }

        parsedOutput = {
          text,
          summary,
          sources,
          keyFindings,
        }
      } else {
        // For standard research, use the regular output parser
        parsedOutput = (await outputParser.parse(text)) as ParsedResearchOutput
        sources = parsedOutput.sources
      }
    } catch (parseError) {
      // Handle parsing error and get fallback parsed output
      parsedOutput = this.handleParsingError(parseError, text)

      // Extract sources from the response - either from metadata or by parsing text
      sources =
        Array.isArray(completion.sources) && completion.sources.length > 0
          ? (completion.sources
              .filter(Boolean)
              .map((source: PerplexitySource | string) => {
                if (!source) return null

                return {
                  title:
                    typeof source === 'object' && 'title' in source
                      ? source.title
                      : undefined,
                  url:
                    typeof source === 'object' && 'url' in source
                      ? source.url
                      : typeof source === 'string'
                        ? source
                        : 'unknown',
                  snippet:
                    typeof source === 'object' && 'snippet' in source
                      ? source.snippet
                      : undefined,
                }
              })
              .filter(Boolean) as ResearchSource[])
          : TextExtractionUtils.extractSourcesFromText(text)
    }

    // Create result object with more structured information
    return {
      text: parsedOutput.text || text,
      sources,
      summary: parsedOutput.summary || TextExtractionUtils.extractSummary(text),
      timestamp: new Date(),
      confidence: isMedicalDiagnosis ? 0.9 : 0.85, // Higher confidence for medical diagnosis
      keyFindings: parsedOutput.keyFindings?.length
        ? parsedOutput.keyFindings
        : TextExtractionUtils.extractKeyFindings(text),
    }
  }

  /**
   * Get configuration value based on research depth
   *
   * @param property Configuration property to retrieve
   * @param depth Research depth level
   * @returns Configuration value for the specified depth
   */
  private getConfigValueForDepth<K extends keyof ResearchDepthConfig>(
    property: K,
    depth?: ResearchDepth
  ): number {
    // Get depth config from research configuration
    const depthConfig = researchConfig.providers.perplexity.depthConfig

    // Use provided depth or default from config
    const useDepth = depth || researchConfig.defaultOptions.depth

    // Return the value for the specified property and depth
    return depthConfig[property][useDepth]
  }

  /**
   * Execute an async operation with retry logic
   *
   * @param operation The operation to execute
   * @param maxRetries Maximum number of retries
   * @param delay Initial delay between retries (increases with each retry)
   * @returns The result of the operation
   * @throws The last error encountered if all retries fail
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: unknown

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error

        // Don't retry if it's a validation error
        if (error instanceof ValidationError) {
          throw error
        }

        // Wait before retrying
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay * attempt))
        }
      }
    }

    throw lastError
  }

  /**
   * Handle research errors
   */
  private handleResearchError(
    query: string,
    options: EnhancedResearchOptions | undefined,
    error: Error | unknown
  ): void {
    const normalizedError = normalizeError(error)
    logger
      .withMetadata({
        module: 'PerplexityService',
        method: 'handleResearchError',
        query,
        errorCode: normalizedError.code,
      })
      .error('Research failed', {}, normalizedError)
  }

  /**
   * Create a model for Perplexity API
   */
  private createPerplexityModel(options: {
    modelName: string
    temperature?: number
    maxTokens?: number
    callbacks?: any[]
  }) {
    // This is a placeholder - LangChain doesn't have direct Perplexity integration yet
    // In a real implementation, we would create a custom LLM class for Perplexity
    return langChainCore.createChatOpenAI({
      modelName: options.modelName,
      temperature: options.temperature || 0.3,
      callbacks: options.callbacks,
    })
  }

  /**
   * Create a standard research chain
   */
  private createStandardResearchChain(
    options?: EnhancedResearchOptions,
    callbacks?: any[]
  ) {
    return async (input: { query: string; depth?: ResearchDepth }) => {
      const formatInstructions = await outputParser.getFormatInstructions()

      // Create the prompt template using a single template literal
      const researchPrompt = langChainCore.createPromptTemplate(
        `You are a research assistant specializing in medical information analysis.
Research the following query thoroughly: {query}

Depth: {depth}

${formatInstructions}`,
        ['query', 'depth']
      )

      // Create the model
      const model = this.createPerplexityModel({
        modelName: options?.model || researchConfig.providers.perplexity.model,
        temperature:
          options?.temperature ||
          this.getConfigValueForDepth('temperature', options?.depth),
        maxTokens:
          options?.maxTokens ||
          this.getConfigValueForDepth('maxTokens', options?.depth),
        callbacks,
      })

      // Create and run the chain
      const chain = researchPrompt.pipe(model).pipe(outputParser)

      return chain.invoke({
        query: input.query,
        depth: input.depth || 'standard',
      })
    }
  }

  /**
   * Create a medical diagnosis chain
   */
  private createMedicalDiagnosisChain(
    options?: EnhancedResearchOptions,
    callbacks?: any[]
  ) {
    return async (input: {
      query: string
      patientData: string
      depth?: ResearchDepth
    }) => {
      const formatInstructions =
        await medicalDiagnosisParser.getFormatInstructions()

      // Create the prompt template
      const researchPrompt = langChainCore.createPromptTemplate(
        `${MEDICAL_DIAGNOSIS_SYSTEM_PROMPT}

${formatInstructions}

Patient Data:
{patientData}

Additional Query: {query}`,
        ['query', 'patientData']
      )

      // Create the model
      const model = this.createPerplexityModel({
        modelName: options?.model || researchConfig.providers.perplexity.model,
        temperature:
          options?.temperature ||
          this.getConfigValueForDepth('temperature', 'comprehensive'),
        maxTokens:
          options?.maxTokens ||
          this.getConfigValueForDepth('maxTokens', 'comprehensive'),
        callbacks,
      })

      // Create and run the chain
      const chain = researchPrompt.pipe(model).pipe(medicalDiagnosisParser)

      return chain.invoke({
        query: input.query,
        patientData: input.patientData,
      })
    }
  }

  /**
   * Perform deep research using Perplexity API with improved Runnable pattern
   *
   * @param query Research query
   * @param options Research options
   * @param debug Enable debug logging
   * @returns Research result
   */
  async performDeepResearch(
    query: string,
    options?: EnhancedResearchOptions,
    debug: boolean = DEFAULT_DEBUG
  ): Promise<ResearchResult> {
    const moduleLogger = logger.withMetadata({
      module: 'PerplexityService',
      method: 'performDeepResearch',
      isMedicalDiagnosis: !!options?.isMedicalDiagnosis,
      model: options?.model || researchConfig.providers.perplexity.model,
      depth: options?.depth || 'standard',
    })

    if (debug) {
      moduleLogger.debug('Performing deep research', {
        query,
        options,
      })
    }

    // Check cache first
    const cachedResult = this.getCachedResult(query, options)
    if (cachedResult) {
      moduleLogger.debug('Using cached research result', {
        cacheAge: new Date().getTime() - cachedResult.timestamp.getTime(),
        query,
      })
      return cachedResult
    }

    // Use the retry mechanism for the API call
    return this.withRetry(async () => {
      // Run with workflow to track progress
      const result = await runWithWorkflow(
        'research' as WorkflowStep,
        async () => {
          // Track progress if a callback is provided
          const onProgress = options?.onProgress
          if (onProgress) {
            onProgress(10) // Research started
          }

          // Use RunnableBranch to handle different research types
          const researchChain = RunnableBranch.from([
            [
              (input) => !!input.isMedicalDiagnosis,
              async (input) => {
                const diagnosisChain = this.createMedicalDiagnosisChain(
                  options,
                  createWorkflowCallbacks(null, 'research', {
                    onProgress: options?.onProgress,
                  })
                )

                return diagnosisChain({
                  query,
                  patientData: input.patientData || '',
                  depth: options?.depth || 'comprehensive',
                })
              },
            ],
            async (input) => {
              const standardChain = this.createStandardResearchChain(
                options,
                createWorkflowCallbacks(null, 'research', {
                  onProgress: options?.onProgress,
                })
              )

              return standardChain({
                query,
                depth: options?.depth || 'standard',
              })
            },
          ])

          // Process the chain's output
          const chainResult = await researchChain.invoke({
            query,
            isMedicalDiagnosis: !!options?.isMedicalDiagnosis,
            patientData: options?.patientData,
            depth: options?.depth || 'standard',
          })

          // Update progress if callback exists
          if (onProgress) {
            onProgress(70) // Research completed, processing results
          }

          // Format the result
          const formattedResult: ResearchResult = {
            text: chainResult.text,
            sources: chainResult.sources || [],
            summary: chainResult.summary,
            keyFindings: chainResult.keyFindings,
            timestamp: new Date(),
            confidence: options?.isMedicalDiagnosis ? 0.9 : 0.85,
            modelName:
              options?.model || researchConfig.providers.perplexity.model,
          }

          // Final progress update
          if (onProgress) {
            onProgress(100) // Research and processing complete
          }

          // Cache the result for future use
          this.cacheResult(query, options, formattedResult)

          return formattedResult
        },
        {
          onProgress: options?.onProgress,
          onError: (error) => this.handleResearchError(query, options, error),
        }
      )

      return result
    })
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
    options?: Omit<
      EnhancedResearchOptions,
      'isMedicalDiagnosis' | 'patientData'
    >
  ): Promise<ResearchResult> {
    // For the new differential diagnosis format, we need to modify how we pass the query and patient data
    const enhancedOptions = {
      ...options,
      isMedicalDiagnosis: true,
      patientData: `${patientData}\n\n${query ? `Additional query: ${query}` : ''}`,
      depth: options?.depth || 'comprehensive', // Use comprehensive depth for medical diagnoses
      maxTokens:
        options?.maxTokens ||
        this.getConfigValueForDepth('maxTokens', 'comprehensive'),
      temperature:
        options?.temperature ||
        this.getConfigValueForDepth('temperature', 'comprehensive'),
    }

    // Use a specialized query format for medical diagnosis that works with our new prompt structure
    const diagnosticQuery =
      'Provide a comprehensive differential diagnosis based on the patient data'

    return this.performDeepResearch(diagnosticQuery, enhancedOptions)
  }

  /**
   * Perform research using Langchain for improved structure and reasoning
   */
  async performResearchWithLangchain(
    query: string,
    options?: EnhancedResearchOptions
  ): Promise<ResearchResult> {
    return runWithWorkflow(
      'research' as WorkflowStep,
      async () => {
        // Create a parser for structured output
        const researchParser = StructuredOutputParser.fromZodSchema(
          z.object({
            text: z
              .string()
              .describe('The full research text with all details'),
            sources: z.array(
              z.object({
                title: z.string().optional(),
                url: z.string(),
                snippet: z.string().optional(),
              })
            ),
            summary: z.string().describe('A concise summary of the findings'),
            keyFindings: z.array(z.string()),
          })
        )

        // Get format instructions
        const formatInstructions = await researchParser.getFormatInstructions()

        // Create research prompt with single template literal
        const researchPrompt = langChainCore.createPromptTemplate(
          `You are a research assistant specializing in medical information analysis.
Research the following query thoroughly: {query}

Depth: {depth}

${formatInstructions}`,
          ['query', 'depth']
        )

        // Create the model with callbacks
        const model = langChainCore.createChatOpenAI({
          modelName: options?.model || 'o3-mini',
          temperature: options?.temperature || 0.3,
          callbacks: createWorkflowCallbacks(null, 'research', {
            onProgress: options?.onProgress,
          }),
        })

        // Create and run the chain
        const chain = researchPrompt.pipe(model).pipe(researchParser)

        const result = await chain.invoke({
          query,
          depth: options?.depth || 'standard',
        })

        // Format as ResearchResult
        return {
          text: result.text,
          sources: result.sources,
          summary: result.summary,
          keyFindings: result.keyFindings,
          timestamp: new Date(),
          confidence: 0.85,
          modelName: options?.model || 'o3-mini',
        }
      },
      {
        onProgress: options?.onProgress,
        onError: (error: unknown) => {
          this.handleResearchError(query, options, error)
        },
      }
    )
  }

  /**
   * Perform streaming research with real-time results
   *
   * @param query Research query
   * @param options Research options
   * @param callbacks Optional callbacks for streaming events
   * @returns ReadableStream of partial results
   */
  async performStreamingResearch(
    query: string,
    options?: EnhancedResearchOptions,
    callbacks?: any[]
  ): Promise<ReadableStream> {
    // This is a placeholder for streaming implementation
    // The actual implementation would depend on how LangChain
    // and Perplexity support streaming

    const moduleLogger = logger.withMetadata({
      module: 'PerplexityService',
      method: 'performStreamingResearch',
      query,
    })

    moduleLogger.info('Starting streaming research', {
      model: options?.model || researchConfig.providers.perplexity.model,
    })

    // Create a new ReadableStream for sending chunks
    return new ReadableStream({
      start(controller) {
        // Start the research process and stream results
        // This would be implemented with the actual streaming API
        controller.close()
      },
    })
  }
}

// Export singleton instance
export const perplexityService = new PerplexityService()
