import researchConfig, {
  type ResearchDepth,
  type ResearchDepthConfig,
} from '@/lib/config/research'
import type { LangChainCore } from '@/lib/langchain/core'
import type { ResearchOptions } from '@/lib/types/research'
import logger from '@/lib/logger'
import { StructuredOutputParser } from 'langchain/output_parsers'
import { z } from 'zod'
import type { RunnableConfig } from '@langchain/core/runnables'

// Medical diagnosis-specific system prompt
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

// Define schemas for the structured output
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

/**
 * Factory for creating standardized LangChain chains for Perplexity research
 */
export class PerplexityChainFactory {
  private readonly langChain: LangChainCore
  private readonly logger: typeof logger

  constructor(langChain: LangChainCore, loggerInstance?: typeof logger) {
    this.langChain = langChain
    this.logger = loggerInstance || logger
  }

  /**
   * Create a standard research chain
   *
   * @param options Research options
   * @param config LangChain runnable config
   * @returns Runnable sequence for standard research
   */
  async createStandardResearchChain(
    options?: ResearchOptions,
    config?: RunnableConfig
  ) {
    const formatInstructions = await outputParser.getFormatInstructions()

    // Create the prompt template using a single template literal
    const researchPrompt = this.langChain.createPromptTemplate(
      `You are a research assistant specializing in medical information analysis.
Research the following query thoroughly: {query}

Depth: {depth}

${formatInstructions}`,
      ['query', 'depth']
    )

    // Create model
    const model = this.createModelWithConfig(
      options?.model ?? researchConfig.providers.perplexity.model,
      options?.temperature ??
        this.getConfigValueForDepth('temperature', options?.depth),
      options?.maxTokens ??
        this.getConfigValueForDepth('maxTokens', options?.depth)
    )

    // Create chain
    let chain = researchPrompt.pipe(model).pipe(outputParser)
    
    // Apply config if provided
    if (config) {
      chain = chain.withConfig(config)
    }

    return chain
  }

  /**
   * Create a medical diagnosis chain
   *
   * @param options Research options
   * @param config LangChain runnable config
   * @returns Runnable sequence for medical diagnosis
   */
  async createMedicalDiagnosisChain(
    options?: ResearchOptions,
    config?: RunnableConfig
  ) {
    const formatInstructions = await medicalDiagnosisParser.getFormatInstructions()

    // Create the prompt template
    const researchPrompt = this.langChain.createPromptTemplate(
      `${MEDICAL_DIAGNOSIS_SYSTEM_PROMPT}

${formatInstructions}

Patient Data:
{patientData}

Additional Query: {query}`,
      ['query', 'patientData']
    )

    // Create model
    const model = this.createModelWithConfig(
      options?.model ?? researchConfig.providers.perplexity.model,
      options?.temperature ??
        this.getConfigValueForDepth('temperature', 'comprehensive'),
      options?.maxTokens ??
        this.getConfigValueForDepth('maxTokens', 'comprehensive')
    )

    // Create chain
    let chain = researchPrompt.pipe(model).pipe(medicalDiagnosisParser)
    
    // Apply config if provided
    if (config) {
      chain = chain.withConfig(config)
    }

    return chain
  }

  /**
   * Create model with standardized configuration
   *
   * @param modelName Model name
   * @param temperature Temperature for generation
   * @param maxTokens Maximum tokens to generate
   * @returns Configured Perplexity chat model
   */
  createModelWithConfig(
    modelName: string,
    temperature: number,
    maxTokens?: number
  ) {
    this.logger.debug('Creating Perplexity model', {
      modelName,
      temperature,
      maxTokens
    })
    
    return this.langChain.createPerplexityChat({
      model: modelName,
      temperature: temperature,
      maxTokens: maxTokens
    })
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
    const useDepth = depth ?? researchConfig.defaultOptions.depth

    // Return the value for the specified property and depth
    return depthConfig[property][useDepth]
  }
}