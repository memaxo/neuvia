import { langChainCore } from '@/lib/langchain/core'
import type { ProcessingStatus } from '@/lib/processing/types/base'
import type { ExtractedDocument } from '@/lib/processing/types/extraction'
import { createWorkflowCallbacks, runWithWorkflow } from '@/lib/utils/langchain'
import type { ProcessingPhase, WorkflowStep } from '@/lib/workflow/types'
import type { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import { StringOutputParser } from '@langchain/core/output_parsers'
import {
  ApplicationError,
  ExternalServiceError,
  SystemError,
  ValidationError,
  normalizeError,
} from '@/lib/errors'
import logger from '@/lib/logger'
/**
 * Patient Summary LangChain Integration
 *
 * This module provides LangChain-based utilities for extracting, processing, and verifying
 * patient summaries from medical documents. It integrates with the application's workflow
 * and supports progress tracking during multi-stage operations.
 */
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from '@langchain/core/prompts'
import type { RunnableConfig } from '@langchain/core/runnables'
import { RunnableSequence } from '@langchain/core/runnables'

// Types for callbacks and progress tracking
type ProgressCallback = (progress: number, phase: string) => void
type StatusCallback = (status: ProcessingStatus) => void

/**
 * Patient summary extraction result
 */
export interface PatientSummaryResult {
  /**
   * Whether the extraction was successful
   */
  success: boolean

  /**
   * The extracted patient summary in markdown format
   */
  summary: string

  /**
   * Error message if extraction failed
   */
  error?: string

  /**
   * Extracted structured data (if available)
   */
  structuredData?: PatientSummaryData
}

/**
 * Structured patient summary data
 */
export interface PatientSummaryData {
  /**
   * Patient demographics
   */
  demographics?: {
    name?: string
    dateOfBirth?: string
    gender?: string
    mrn?: string
  }

  /**
   * Medical history items
   */
  medicalHistory?: string[]

  /**
   * Allergies list
   */
  allergies?: string[]

  /**
   * Current medications
   */
  medications?: {
    name: string
    dosage?: string
    frequency?: string
  }[]

  /**
   * Vital signs
   */
  vitalSigns?: {
    name: string
    value: string
    unit?: string
    date?: string
  }[]

  /**
   * Assessment summary
   */
  assessment?: string

  /**
   * Plan summary
   */
  plan?: string
}

/**
 * Verification status enum
 */
export enum VerificationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Model options for LLM chains
 */
interface ModelOptions {
  /**
   * Temperature (0-1). Higher values make output more random.
   */
  temperature?: number

  /**
   * Whether to use Gemini Flash instead of O3 Mini
   */
  useGemini?: boolean

  /**
   * Maximum tokens to generate
   */
  maxTokens?: number
}

/**
 * Create a runnable extraction sequence for patient summary generation
 *
 * @param workflowId Optional workflow ID for tracking
 * @param options Model options
 * @param onProgress Optional progress callback
 * @returns Runnable sequence for extraction
 */
function createExtractionSequence(
  workflowId: string | null = null,
  options: ModelOptions = {},
  onProgress?: ProgressCallback
) {
  // Default to Gemini Flash for extraction (better at unstructured medical text)
  const useGemini = options.useGemini ?? true

  // Create the model with appropriate settings and callbacks
  const callbackHandlers: BaseCallbackHandler[] = []

  if (workflowId || onProgress) {
    callbackHandlers.push(
      ...createWorkflowCallbacks(workflowId, 'extraction' as WorkflowStep, {
        onProgress: (progress: number) => {
          onProgress?.(progress, 'Analyzing medical document')
        },
      })
    )
  }

  // Select the appropriate model
  const llm = useGemini
    ? langChainCore.createChatGemini({
        modelName: 'gemini-flash',
        temperature: options.temperature ?? 0.1,
        streaming: false,
        callbacks: callbackHandlers,
      })
    : langChainCore.createChatOpenAI({
        modelName: 'o3-mini',
        temperature: options.temperature ?? 0.1,
        streaming: false,
        callbacks: callbackHandlers,
      })

  // Create comprehensive prompt for medical document extraction
  const extractionPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      `You are a clinical documentation specialist with expertise in extracting patient information from medical documents.
      Extract a comprehensive patient summary from the medical document provided.
      Format your response as clean, well-structured markdown that a healthcare professional would find easy to read.
      
      Include the following sections:
      1. Demographics (name, DOB, gender, MRN if available)
      2. Medical History
      3. Allergies
      4. Current Medications (with dosage and frequency if available)
      5. Vital Signs
      6. Assessment
      7. Plan
      
      For each section:
      - Use clear headings (## for main sections, ### for subsections)
      - Format medications and allergies as bullet lists
      - Present vital signs in a structured format
      - Highlight critical information
      - Be comprehensive but concise
      - Maintain medical accuracy
      - If information for a section is not available, state "No information available"`
    ),
    HumanMessagePromptTemplate.fromTemplate(
      `Extract a patient summary from this medical document:\n\n{documentText}`
    ),
  ])

  // Create and return the runnable sequence
  return RunnableSequence.from([
    extractionPrompt,
    llm,
    new StringOutputParser(),
  ])
}

/**
 * Create a runnable correction sequence for updating patient summaries
 *
 * @param workflowId Optional workflow ID for tracking
 * @param options Model options
 * @param onProgress Optional progress callback
 * @returns Runnable sequence for correction processing
 */
function createCorrectionSequence(
  workflowId: string | null = null,
  options: ModelOptions = {},
  onProgress?: ProgressCallback
) {
  // Use O3-mini for corrections (better at following instructions precisely)
  const useGemini = options.useGemini ?? false

  // Create callback handlers if needed
  const callbackHandlers: BaseCallbackHandler[] = []

  if (workflowId || onProgress) {
    callbackHandlers.push(
      ...createWorkflowCallbacks(workflowId, 'verification' as WorkflowStep, {
        onProgress: (progress: number) => {
          onProgress?.(progress, 'Processing correction')
        },
      })
    )
  }

  // Select the appropriate model
  const llm = useGemini
    ? langChainCore.createChatGemini({
        modelName: 'gemini-flash',
        temperature: options.temperature ?? 0.1,
        streaming: false,
        callbacks: callbackHandlers,
      })
    : langChainCore.createChatOpenAI({
        modelName: 'o3-mini',
        temperature: options.temperature ?? 0.1,
        streaming: false,
        callbacks: callbackHandlers,
      })

  // Create prompt for correction processing
  const correctionPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      `You are a clinical documentation specialist updating a patient summary based on user feedback.
      Apply the user's correction to the existing patient summary.
      
      Return the complete updated summary in clean, well-structured markdown, incorporating all the changes.
      
      Guidelines:
      - Maintain the same markdown structure as the original summary
      - Only make changes that align with the user's correction
      - Highlight the changes you've made by adding **[Updated]** at the end of modified lines
      - Keep all unrelated information intact
      - Ensure all medical information is presented accurately`
    ),
    HumanMessagePromptTemplate.fromTemplate(
      `Current Patient Summary:
      
{currentSummary}

User Correction:

{userCorrection}

Please update the summary to incorporate this correction.`
    ),
  ])

  // Create and return the runnable sequence
  return RunnableSequence.from([
    correctionPrompt,
    llm,
    new StringOutputParser(),
  ])
}

/**
 * Create a verification completion sequence to check if summary is ready
 *
 * @param workflowId Optional workflow ID for tracking
 * @param options Model options
 * @returns Runnable sequence for verification completion check
 */
function createVerificationCompletionSequence(
  workflowId: string | null = null,
  options: ModelOptions = {}
) {
  // Create callback handlers if needed
  const callbackHandlers: BaseCallbackHandler[] = []

  if (workflowId) {
    callbackHandlers.push(
      ...createWorkflowCallbacks(workflowId, 'verification' as WorkflowStep)
    )
  }

  // Use O3-mini for verification completion (better at classification tasks)
  const llm = langChainCore.createChatOpenAI({
    modelName: 'o3-mini',
    temperature: 0,
    streaming: false,
    callbacks: callbackHandlers,
  })

  // Create prompt for verification completion check
  const completionPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      `You are a medical verification assistant that determines if a patient summary is ready for report generation.
      Analyze the user's latest message to determine if they are confirming the summary is correct.
      
      If the user is confirming (with words like "confirm", "looks good", "correct", "approve", etc.), respond with "VERIFIED".
      If the user is providing corrections or asking questions, respond with "NEEDS_CORRECTION".
      If you're unsure about the user's intent, respond with "UNCLEAR".
      
      Only output one of these three values: "VERIFIED", "NEEDS_CORRECTION", or "UNCLEAR".`
    ),
    HumanMessagePromptTemplate.fromTemplate('{userMessage}'),
  ])

  // Create and return the runnable sequence
  return RunnableSequence.from([
    completionPrompt,
    llm,
    new StringOutputParser(),
  ])
}

/**
 * Extract a comprehensive patient summary from document text
 *
 * @param documentText The full text of the medical document
 * @param workflowId Optional workflow ID for tracking
 * @param options Model options for extraction
 * @param onProgress Optional progress callback
 * @param onStatus Optional status callback
 * @returns Extraction result with summary and structured data
 */
export async function extractPatientSummary(
  documentText: string,
  workflowId: string | null = null,
  options: ModelOptions = {},
  onProgress?: ProgressCallback,
  onStatus?: StatusCallback
): Promise<PatientSummaryResult> {
  const moduleLogger = logger.withMetadata({
    module: 'PatientSummary',
    method: 'extractPatientSummary',
    workflowId: workflowId || undefined,
    documentLength: documentText?.length,
  })

  try {
    if (!documentText || documentText.trim() === '') {
      moduleLogger.warn('Empty document text provided for extraction')

      onStatus?.({
        status: 'error',
        progress: 0,
        error: 'Empty document text provided',
        phase: 'initialization' as ProcessingPhase,
      })

      return {
        success: false,
        summary: '',
        error: 'Cannot extract summary from empty document',
      }
    }

    moduleLogger.info('Starting patient summary extraction', {
      useGemini: options.useGemini ?? true,
      temperature: options.temperature ?? 0.1,
    })

    // Update status if callback provided
    onStatus?.({
      status: 'processing',
      progress: 0,
      currentStep: 'Starting patient summary extraction',
      phase: 'initialization',
    })

    // Progress reporting
    onProgress?.(0, 'Starting extraction')

    // Create extraction sequence
    const extractionSequence = createExtractionSequence(
      workflowId,
      options,
      onProgress
    )

    // Prepare runnable config for tracking and progress
    const runnableConfig: RunnableConfig = {
      runName: 'Patient Summary Extraction',
      metadata: { workflowId: workflowId || undefined },
    }

    // Run with workflow to track progress
    const result = await runWithWorkflow<string>(
      'extraction' as WorkflowStep,
      async () => {
        moduleLogger.info('Invoking extraction sequence')
        // Call the sequence with the document text
        return extractionSequence.invoke(
          { documentText: documentText.slice(0, 32000) }, // Limit text to avoid token limits
          runnableConfig
        )
      },
      {
        onProgress: (progress: number) =>
          onProgress?.(progress, 'Processing document'),
        workflowId,
      }
    )

    if (!result) {
      moduleLogger.error('Extraction sequence returned empty result')
      throw new ExternalServiceError({
        message: 'Failed to extract patient summary - empty result returned',
        service: options.useGemini ? 'Gemini' : 'OpenAI',
        code: 'EMPTY_EXTRACTION_RESULT',
        data: { workflowId: workflowId || undefined },
      })
    }

    moduleLogger.info('Patient summary extraction completed successfully', {
      summaryLength: result.length,
    })

    // Report completion
    onProgress?.(100, 'Extraction complete')
    onStatus?.({
      status: 'success',
      progress: 100,
      currentStep: 'Patient summary extracted successfully',
      phase: 'extraction_completed',
    })

    return {
      success: true,
      summary: result,
      structuredData: {}, // In a real implementation, we would parse the markdown to extract structured data
    }
  } catch (error) {
    // Handle extraction errors
    if (error instanceof ApplicationError) {
      // Log but don't rewrap if it's already an ApplicationError
      moduleLogger.error('Patient summary extraction failed', {}, error)

      const errorMessage = error.message

      // Report error
      onStatus?.({
        status: 'error',
        progress: 0,
        error: errorMessage,
        phase: 'error',
      })

      return {
        success: false,
        summary: '',
        error: errorMessage,
      }
    }

    // For other types of errors, log and wrap in a SystemError
    const errorMessage = error instanceof Error ? error.message : String(error)

    moduleLogger.error(
      'Error extracting patient summary',
      { workflowId: workflowId || undefined },
      error
    )

    // Report error
    onStatus?.({
      status: 'error',
      progress: 0,
      error: errorMessage,
      phase: 'error',
    })

    return {
      success: false,
      summary: '',
      error: errorMessage,
    }
  }
}

/**
 * Process a user correction and update the patient summary
 *
 * @param currentSummary Current markdown summary
 * @param userCorrection User's correction message
 * @param workflowId Optional workflow ID for tracking
 * @param options Model options for correction processing
 * @param onProgress Optional progress callback
 * @param onStatus Optional status callback
 * @returns Updated patient summary
 */
export async function processCorrection(
  currentSummary: string,
  userCorrection: string,
  workflowId: string | null = null,
  options: ModelOptions = {},
  onProgress?: ProgressCallback,
  onStatus?: StatusCallback
): Promise<PatientSummaryResult> {
  const moduleLogger = logger.withMetadata({
    module: 'PatientSummary',
    method: 'processCorrection',
    workflowId: workflowId || undefined,
    correctionLength: userCorrection?.length,
  })

  try {
    // Input validation
    if (!currentSummary || currentSummary.trim() === '') {
      moduleLogger.warn('Empty current summary provided for correction')
      throw new ValidationError({
        message: 'Current summary is required for correction processing',
        code: 'EMPTY_SUMMARY',
        data: { workflowId: workflowId || undefined },
      })
    }

    if (!userCorrection || userCorrection.trim() === '') {
      moduleLogger.warn('Empty correction provided')
      throw new ValidationError({
        message: 'User correction is required',
        code: 'EMPTY_CORRECTION',
        data: { workflowId: workflowId || undefined },
      })
    }

    moduleLogger.info('Starting patient summary correction processing', {
      useGemini: options.useGemini ?? false,
      temperature: options.temperature ?? 0.1,
    })

    // Update status if callback provided
    onStatus?.({
      status: 'processing',
      progress: 0,
      currentStep: 'Processing correction',
      phase: 'correction',
    })

    // Progress reporting
    onProgress?.(0, 'Starting correction processing')

    // Create correction sequence
    const correctionSequence = createCorrectionSequence(
      workflowId,
      options,
      onProgress
    )

    // Prepare runnable config
    const runnableConfig: RunnableConfig = {
      runName: 'Patient Summary Correction',
      metadata: {
        workflowId: workflowId || undefined,
        correctionLength: userCorrection.length,
      },
    }

    // Process the correction
    const result = await runWithWorkflow<string>(
      'verification' as WorkflowStep,
      async () => {
        moduleLogger.info('Invoking correction sequence')
        return correctionSequence.invoke(
          {
            currentSummary,
            userCorrection,
          },
          runnableConfig
        )
      },
      {
        onProgress: (progress: number) =>
          onProgress?.(progress, 'Processing correction'),
        workflowId,
      }
    )

    if (!result) {
      moduleLogger.error('Correction sequence returned empty result')
      throw new ExternalServiceError({
        message: 'Failed to process correction - empty result returned',
        service: options.useGemini ? 'Gemini' : 'OpenAI',
        code: 'EMPTY_CORRECTION_RESULT',
        data: { workflowId: workflowId || undefined },
      })
    }

    moduleLogger.info('Patient summary correction completed successfully', {
      summaryLength: result.length,
    })

    // Report completion
    onProgress?.(100, 'Correction processed')
    onStatus?.({
      status: 'success',
      progress: 100,
      currentStep: 'Summary updated successfully',
      phase: 'verification',
    })

    return {
      success: true,
      summary: result,
      structuredData: {}, // In a real implementation, we would parse the markdown to extract structured data
    }
  } catch (error) {
    // Handle correction errors
    if (error instanceof ApplicationError) {
      // Log but don't rewrap if it's already an ApplicationError
      moduleLogger.error('Patient summary correction failed', {}, error)

      const errorMessage = error.message

      // Report error
      onStatus?.({
        status: 'error',
        progress: 0,
        error: errorMessage,
        phase: 'error',
      })

      return {
        success: false,
        summary: currentSummary,
        error: errorMessage,
      }
    }

    // For other types of errors, log and wrap in a SystemError
    const errorMessage = error instanceof Error ? error.message : String(error)

    moduleLogger.error(
      'Error processing patient summary correction',
      { workflowId: workflowId || undefined },
      error
    )

    // Report error
    onStatus?.({
      status: 'error',
      progress: 0,
      error: errorMessage,
      phase: 'error',
    })

    return {
      success: false,
      summary: currentSummary,
      error: errorMessage,
    }
  }
}

/**
 * Check if user message confirms verification completion
 *
 * @param userMessage User's message text
 * @param workflowId Optional workflow ID for tracking
 * @returns Verification status (VERIFIED, NEEDS_CORRECTION, or UNCLEAR)
 */
export async function checkVerificationCompletion(
  userMessage: string,
  workflowId: string | null = null
): Promise<'VERIFIED' | 'NEEDS_CORRECTION' | 'UNCLEAR'> {
  const moduleLogger = logger.withMetadata({
    module: 'PatientSummary',
    method: 'checkVerificationCompletion',
    workflowId: workflowId || undefined,
    messageLength: userMessage?.length,
  })

  try {
    // Input validation
    if (!userMessage || userMessage.trim() === '') {
      moduleLogger.warn('Empty user message provided for verification check')
      throw new ValidationError({
        message: 'User message is required for verification check',
        code: 'EMPTY_MESSAGE',
        data: { workflowId: workflowId || undefined },
      })
    }

    moduleLogger.info('Starting verification completion check')

    // Create verification completion sequence
    const completionSequence = createVerificationCompletionSequence(workflowId)

    // Prepare runnable config
    const runnableConfig: RunnableConfig = {
      runName: 'Verification Completion Check',
      metadata: { workflowId: workflowId || undefined },
    }

    // Check if the message confirms verification
    const result = await completionSequence.invoke(
      { userMessage },
      runnableConfig
    )

    if (!result) {
      moduleLogger.error('Verification check returned empty result')
      throw new ExternalServiceError({
        message:
          'Failed to check verification completion - empty result returned',
        service: 'OpenAI',
        code: 'EMPTY_VERIFICATION_RESULT',
        data: { workflowId: workflowId || undefined },
      })
    }

    // Parse the result
    const decision = result.trim().toUpperCase()

    // Validate the decision
    if (['VERIFIED', 'NEEDS_CORRECTION', 'UNCLEAR'].includes(decision)) {
      moduleLogger.info('Verification check completed', { decision })
      return decision as 'VERIFIED' | 'NEEDS_CORRECTION' | 'UNCLEAR'
    }

    // Log unexpected model response
    moduleLogger.warn('Model returned unexpected verification status', {
      actualResponse: decision,
      defaultingTo: 'UNCLEAR',
    })

    // Default to unclear if the model returned something unexpected
    return 'UNCLEAR'
  } catch (error) {
    if (error instanceof ApplicationError) {
      // Log but don't rewrap if it's already an ApplicationError
      moduleLogger.error('Verification check failed', {}, error)
      return 'UNCLEAR'
    }

    // For other types of errors, log and normalize
    moduleLogger.error(
      'Error checking verification completion',
      { workflowId: workflowId || undefined },
      error
    )

    return 'UNCLEAR'
  }
}

/**
 * Stream patient summary extraction for real-time updates
 *
 * @param documentText The full text of the medical document
 * @param workflowId Optional workflow ID for tracking
 * @param options Model options for extraction
 * @returns Async generator of summary chunks
 */
export async function* streamPatientSummary(
  documentText: string,
  workflowId: string | null = null,
  options: ModelOptions = {}
): AsyncGenerator<string> {
  const moduleLogger = logger.withMetadata({
    module: 'PatientSummary',
    method: 'streamPatientSummary',
    workflowId: workflowId || undefined,
    documentLength: documentText?.length,
  })

  try {
    // Input validation
    if (!documentText || documentText.trim() === '') {
      moduleLogger.warn('Empty document text provided for streaming extraction')
      throw new ValidationError({
        message: 'Cannot stream summary from empty document',
        code: 'EMPTY_DOCUMENT',
        data: { workflowId: workflowId || undefined },
      })
    }

    moduleLogger.info('Starting patient summary streaming', {
      useGemini: options.useGemini ?? true,
      temperature: options.temperature ?? 0.1,
    })

    // Default to Gemini Flash with streaming enabled
    const useGemini = options.useGemini ?? true

    // Create callback handlers
    const callbackHandlers: BaseCallbackHandler[] = []

    if (workflowId) {
      callbackHandlers.push(
        ...createWorkflowCallbacks(workflowId, 'extraction' as WorkflowStep)
      )
    }

    // Select the appropriate model with streaming enabled
    const llm = useGemini
      ? langChainCore.createChatGemini({
          modelName: 'gemini-flash',
          temperature: options.temperature ?? 0.1,
          streaming: true,
          callbacks: callbackHandlers,
        })
      : langChainCore.createChatOpenAI({
          modelName: 'o3-mini',
          temperature: options.temperature ?? 0.1,
          streaming: true,
          callbacks: callbackHandlers,
        })

    // Create extraction prompt
    const extractionPrompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        `You are a clinical documentation specialist with expertise in extracting patient information from medical documents.
        Extract a comprehensive patient summary from the medical document provided.
        Format your response as clean, well-structured markdown that a healthcare professional would find easy to read.
        
        Include the following sections:
        1. Demographics (name, DOB, gender, MRN if available)
        2. Medical History
        3. Allergies
        4. Current Medications (with dosage and frequency if available)
        5. Vital Signs
        6. Assessment
        7. Plan`
      ),
      HumanMessagePromptTemplate.fromTemplate(
        `Extract a patient summary from this medical document:\n\n{documentText}`
      ),
    ])

    // Create streaming sequence
    const streamingSequence = RunnableSequence.from([
      extractionPrompt,
      llm,
      new StringOutputParser(),
    ])

    // Prepare runnable config
    const runnableConfig: RunnableConfig = {
      runName: 'Patient Summary Streaming',
      metadata: { workflowId: workflowId || undefined },
    }

    // Stream the generation
    moduleLogger.info('Starting streaming extraction sequence')
    const stream = await streamingSequence.stream(
      { documentText: documentText.slice(0, 32000) }, // Limit text to avoid token limits
      runnableConfig
    )

    // Yield each chunk
    for await (const chunk of stream) {
      yield chunk
    }

    moduleLogger.info('Streaming extraction completed successfully')
  } catch (error) {
    if (error instanceof ApplicationError) {
      // Log but don't rewrap if it's already an ApplicationError
      moduleLogger.error('Patient summary streaming failed', {}, error)
      yield `Error: ${error.message}`
    } else {
      // For other types of errors, log and normalize
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      moduleLogger.error(
        'Error streaming patient summary',
        { workflowId: workflowId || undefined },
        error
      )

      yield `Error: ${errorMessage}`
    }
  }
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn Function to retry
 * @param retries Maximum number of retries
 * @param delay Initial delay in milliseconds
 * @param loggerMetadata Additional logger metadata
 * @returns Promise that resolves with the function result
 * @throws ApplicationError if all retries are exhausted
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000,
  loggerMetadata?: Record<string, any>
): Promise<T> {
  const moduleLogger = logger.withMetadata({
    module: 'PatientSummary',
    method: 'retryWithBackoff',
    maxRetries: retries,
    initialDelay: delay,
    ...loggerMetadata,
  })

  try {
    if (typeof fn !== 'function') {
      moduleLogger.error('Invalid retry function provided', {
        fnType: typeof fn,
      })
      throw new ValidationError({
        message: 'Invalid function provided for retry operation',
        code: 'INVALID_RETRY_FUNCTION',
        data: { fnType: typeof fn },
      })
    }

    moduleLogger.debug('Executing function with retry capability', {
      remainingRetries: retries,
    })

    return await fn()
  } catch (error) {
    // Check if we should retry
    if (retries <= 0) {
      moduleLogger.error(
        'Retry attempts exhausted',
        {
          remainingRetries: 0,
        },
        error
      )

      // Use normalizeError to ensure we're returning an ApplicationError
      const normalizedError = normalizeError(error)

      // Create a new error with the retry metadata instead of modifying the read-only data property
      throw new SystemError({
        message: normalizedError.message,
        code: normalizedError.code,
        statusCode: normalizedError.statusCode,
        data: {
          ...normalizedError.data,
          retryExhausted: true,
          maxRetries: retries,
        },
        cause: normalizedError,
      })
    }

    // Determine if we should retry based on error type
    const normalizedError = normalizeError(error)
    const shouldRetry = determineRetryability(normalizedError)

    if (!shouldRetry) {
      moduleLogger.info('Error not retriable, failing immediately', {
        errorCode: normalizedError.code,
        errorType: normalizedError.name,
      })
      throw normalizedError
    }

    // Log the retry attempt
    moduleLogger.warn('Operation failed, retrying with backoff', {
      remainingRetries: retries - 1,
      currentDelay: delay,
      nextDelay: delay * 2,
      errorMessage: normalizedError.message,
      errorCode: normalizedError.code,
    })

    // Wait with exponential backoff
    await new Promise((resolve) => setTimeout(resolve, delay))

    // Retry with increased delay
    return retryWithBackoff(fn, retries - 1, delay * 2, loggerMetadata)
  }
}

/**
 * Determine if an error should be retried
 *
 * @param error The normalized application error
 * @returns boolean indicating if retry should be attempted
 */
function determineRetryability(error: ApplicationError): boolean {
  // Don't retry validation errors
  if (error instanceof ValidationError) {
    return false
  }

  // Don't retry 4xx errors (except specific retriable ones)
  if (error.statusCode >= 400 && error.statusCode < 500) {
    // Some 4xx errors might be retriable (like 429 Too Many Requests)
    const retriable4xxCodes = ['TOO_MANY_REQUESTS', 'RATE_LIMITED']
    return retriable4xxCodes.includes(error.code || '')
  }

  // Server errors (5xx) are generally retriable
  if (error.statusCode >= 500) {
    return true
  }

  // ExternalServiceErrors are generally retriable
  if (error instanceof ExternalServiceError) {
    // Unless they have specific non-retriable codes
    const nonRetriableServiceCodes = [
      'SERVICE_UNAVAILABLE',
      'UNAUTHORIZED_SERVICE',
    ]
    return !nonRetriableServiceCodes.includes(error.code || '')
  }

  // Default to allowing retry for other error types
  return true
}

/**
 * Generate a sample patient summary for testing
 *
 * @returns Sample patient summary in markdown format
 */
export function generateSampleSummary(): string {
  return `## Patient Demographics
  - **Name:** John Doe
  - **DOB:** 01/15/1975 (48 years)
  - **Gender:** Male
  - **MRN:** 12345678

## Medical History
- Hypertension (diagnosed 2018)
- Type 2 Diabetes Mellitus (diagnosed 2019)
- Hyperlipidemia
- Appendectomy (2010)

## Allergies
- Penicillin (hives)
- Shellfish (anaphylaxis)
- Latex (rash)

## Current Medications
- Lisinopril 20mg daily
- Metformin 1000mg twice daily
- Atorvastatin 40mg nightly
- Aspirin 81mg daily

## Vital Signs
- **Blood Pressure:** 138/82 mmHg
- **Heart Rate:** 72 bpm
- **Respiratory Rate:** 16 breaths/min
- **Temperature:** 98.6°F (37°C)
- **SpO2:** 98% on room air
- **Weight:** 185 lbs (84 kg)
- **Height:** 5'10" (178 cm)
- **BMI:** 26.5 kg/m²

## Assessment
Patient is a 48-year-old male with controlled hypertension and diabetes. Recent labs show HbA1c of 6.8% (improved from 7.2% three months ago). Blood pressure is slightly elevated but improved from previous visit. Lipid profile is within target range with current statin therapy.

## Plan
1. Continue current medication regimen
2. Schedule follow-up in 3 months with repeat HbA1c and lipid panel
3. Encouraged continued dietary modifications and regular exercise
4. Recommended annual eye exam and diabetic foot check
5. Consider 24-hour ambulatory blood pressure monitoring if home readings remain elevated`
}
