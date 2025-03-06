
/**
 * Research and perplexity service types
 */
import type { ResearchDepth } from '@/lib/config/research'

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