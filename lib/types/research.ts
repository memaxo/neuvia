
/**
 * Research and perplexity service types
 */
import type { ResearchDepth } from '@/lib/config/research'
import type { WorkflowStep, ProcessingPhase } from '@/lib/types/workflow'

/**
 * A source reference returned from research operations
 */
export interface ResearchSource {
  /**
   * Title of the source
   */
  title?: string
  
  /**
   * URL of the source
   */
  url: string
  
  /**
   * Brief excerpt or summary of the source content
   */
  snippet?: string
  
  /**
   * Optional index for ordered references
   */
  index?: number
}

/**
 * Options for performing research
 */
export interface ResearchOptions {
  /**
   * Research depth level
   */
  depth?: ResearchDepth
  
  /**
   * Model to use for research
   */
  model?: string
  
  /**
   * Temperature for generation (0-1)
   */
  temperature?: number
  
  /**
   * Maximum tokens to generate
   */
  maxTokens?: number
  
  /**
   * For medical diagnosis, whether this is a medical diagnosis
   */
  isMedicalDiagnosis?: boolean
  
  /**
   * For medical diagnosis, patient data to analyze
   */
  patientData?: string
  
  /**
   * Progress callback function
   */
  onProgress?: (progress: number) => void
  
  /**
   * Include source content in results
   */
  includeSourceContent?: boolean
  
  /**
   * Maximum number of sources to return
   */
  sourcesLimit?: number
  
  /**
   * Context data for research
   */
  contextData?: Record<string, any>
  
  /**
   * User ID who initiated the research
   */
  userId?: string
  
  /**
   * Patient ID if research is for a patient
   */
  patientId?: string
  
  /**
   * Document ID if research is related to a document
   */
  documentId?: string
  
  /**
   * Whether to include citations
   */
  includeCitations?: boolean
  
  /**
   * Whether to auto-generate report after research
   */
  autoGenerateReport?: boolean
  
  /**
   * Transaction ID for tracking operations
   */
  transactionId?: string
  
  /**
   * Chat ID if research was triggered from chat
   */
  chatId?: string
  
  /**
   * Whether to return to chat when research is complete
   */
  returnToChat?: boolean
  
  /**
   * Type of research to perform
   */
  researchType?: ResearchType
}

/**
 * Types of research that can be performed
 */
export enum ResearchType {
  STANDARD = 'standard',
  MEDICAL_DIAGNOSIS = 'medical-diagnosis',
  COMPREHENSIVE = 'comprehensive-research',
  LITERATURE_REVIEW = 'literature-review',
  CITATION_ANALYSIS = 'citation-analysis'
}

/**
 * Research workflow states
 */
export enum ResearchState {
  IDLE = 'idle',
  PENDING = 'research_pending',
  IN_PROGRESS = 'research_in_progress',
  COMPLETED = 'research_completed',
  ERROR = 'research_error',
  REPORT_GENERATION = 'report_generation',
  REPORT_COMPLETED = 'report_completed',
  REPORT_ERROR = 'report_error',
  CHAT_RETURN = 'chat_return',
  CHAT_COMPLETED = 'chat_completed',
  CHAT_ERROR = 'chat_error',
  COMPLETE = 'complete'
}

/**
 * Result from a research operation
 */
export interface ResearchResult {
  /**
   * Full research text with all details
   */
  text: string
  
  /**
   * Sources used in the research
   */
  sources: ResearchSource[]
  
  /**
   * Concise summary of research findings
   */
  summary: string
  
  /**
   * Key findings or takeaways
   */
  keyFindings: string[]
  
  /**
   * When the research was conducted
   */
  timestamp: Date
  
  /**
   * Confidence score (0-1)
   */
  confidence?: number
  
  /**
   * Model used for research
   */
  modelName?: string
}

/**
 * Research operation context for workflow
 */
export interface ResearchContext {
  /**
   * User ID who initiated research
   */
  userId?: string
  
  /**
   * Query that was researched
   */
  query?: string
  
  /**
   * Patient ID if research is for a patient
   */
  patientId?: string
  
  /**
   * Document ID if research is related to a document
   */
  documentId?: string
  
  /**
   * Unique research identifier
   */
  researchId?: string
  
  /**
   * When research was started
   */
  startedAt?: string
  
  /**
   * When research was completed
   */
  completedAt?: string
  
  /**
   * Error message if research failed
   */
  error?: string
  
  /**
   * Type of error if research failed
   */
  errorType?: string
  
  /**
   * Model used for research
   */
  model?: string
  
  /**
   * Whether citations were included
   */
  includeCitations?: boolean
  
  /**
   * Whether to auto-generate report after research
   */
  autoGenerateReport?: boolean
  
  /**
   * Research content/findings
   */
  researchContent?: string
  
  /**
   * Sources used in the research
   */
  sources?: ResearchSource[]
  
  /**
   * Current progress percentage (0-100)
   */
  progress: number
  
  /**
   * Transaction ID for tracking
   */
  transactionId?: string
  
  /**
   * Report ID if report was generated
   */
  reportId?: string
  
  /**
   * When report generation was started
   */
  reportGenerationStartedAt?: string
  
  /**
   * When report was completed
   */
  reportCompletedAt?: string
  
  /**
   * Previous research ID for history tracking
   */
  previousResearchId?: string
  
  /**
   * Previous research content for history tracking
   */
  previousResearchContent?: string
  
  /**
   * Previous sources for history tracking
   */
  previousSources?: ResearchSource[]
  
  /**
   * When previous research was completed
   */
  previousCompletedAt?: string
  
  /**
   * Chat ID if research was triggered from chat
   */
  chatId?: string
  
  /**
   * Whether to return to chat when complete
   */
  returnToChat?: boolean
  
  /**
   * Error message if report generation failed
   */
  reportError?: string
  
  /**
   * Whether research came from chat
   */
  fromChat?: boolean
  
  /**
   * When chat processing was completed
   */
  chatCompletedAt?: string
}

/**
 * Document containing research information
 */
export interface ResearchDocument {
  /**
   * Unique identifier
   */
  id: string
  
  /**
   * Creation timestamp
   */
  createdAt: Date
  
  /**
   * Document type
   */
  documentType: string
  
  /**
   * Associated patient ID
   */
  patientId?: string
  
  /**
   * Verified document used for research
   */
  verifiedDocument: any
  
  /**
   * Research results
   */
  researchResults: ResearchResult[]
  
  /**
   * Research queries
   */
  queries: string[]
}

/**
 * Research workflow status for tracking
 * Similar to ProcessingStatus but with research-specific states
 */
export interface ResearchStatus {
  /**
   * Current status value
   */
  status: 'pending' | 'processing' | 'success' | 'error'
  
  /**
   * Current progress percentage (0-100)
   */
  progress: number
  
  /**
   * Current processing phase
   */
  phase: ProcessingPhase
  
  /**
   * Current workflow step
   */
  step?: WorkflowStep
  
  /**
   * Current operation step description
   */
  currentStep?: string
  
  /**
   * Error message if status is error
   */
  error?: string
  
  /**
   * Research ID if available
   */
  researchId?: string
  
  /**
   * Report ID if report was generated
   */
  reportId?: string
}