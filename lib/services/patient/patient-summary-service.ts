import { perplexityService } from '@/lib/services/perplexity/perplexity-service'
import type { Json } from '@/lib/supabase'
import { createServerClient } from '@/lib/supabase/clients'
import { mistral } from '@ai-sdk/mistral'
import { openai } from '@ai-sdk/openai'
import { ApplicationError, ExternalServiceError, SystemError } from '@/lib/errors'
import { ValidationError } from '@/lib/errors/verification-errors'
import logger from '@/lib/logger'
/**
 * Patient Summary Service
 *
 * Service for generating comprehensive patient summaries from multiple documents.
 * Uses a two-stage approach:
 * 1. Extract essential information from each document using Mistral
 * 2. Compile and prioritize information into a summary using OpenAI's o3-mini model
 */
import { generateText } from 'ai'

// Import types and values
import { DocumentCategory, VerificationStatus as VerificationStatusEnum } from '@/lib/types'
import type { 
  DocumentType, 
  ExtractedData, 
  ResearchOptions, 
  ResearchResult,
  VerificationItem 
} from '@/lib/types'

// Local custom types - not yet migrated to centralized type system
type DocumentExtraction = {
  documentId: UUID;
  documentType: DocumentType;
  documentDate: string;
  sections: Record<string, ExtractedSection>;
  metadata: {
    extractionConfidence: number;
    extractionDate: string;
  };
}

type ExtractedSection = {
  items: Array<{
    text: string;
    importance: number;
    confidence: number;
    temporalMarker: string;
  }>;
}

type PatientSummary = {
  patientInfo: PatientSummarySection;
  medicalHistory: PatientSummarySection;
  currentConditions: PatientSummarySection;
  medications: PatientSummarySection;
  recentFindings: PatientSummarySection;
  treatmentPlans: PatientSummarySection;
  labResults: PatientSummarySection;
  imagingResults: PatientSummarySection;
  recommendations: PatientSummarySection;
  metadata: {
    generatedAt: string;
    documentCount: number;
    documents: Array<{
      id: string;
      type: DocumentType;
      title: string;
      date: string;
    }>;
    verificationInfo?: {
      verifiedAt?: string;
      verifiedBy?: string;
      status?: string;
    };
  };
}

type PatientSummarySection = {
  title: string;
  content: string;
  sources: string[];
}

type VerifiedPatientSummary = PatientSummary & {
  verificationItems: VerificationItem[];
  verificationStatus: {
    isVerified: boolean;
    verifiedAt?: string;
    verifiedBy?: string;
    corrections?: {
      comments?: string;
    };
  };
  verificationMetadata: {
    verifiedAt: string;
    verifiedBy: string;
  };
}

// Alias UUID type for local use
type UUID = string;

// Local interface for patient document
interface PatientDocument {
  id: string;
  content_text?: string;
  document_type?: DocumentType | Record<string, string>;
  document_date?: string;
}

/**
 * Essential extraction prompt template for individual documents
 */
const DOCUMENT_EXTRACTION_PROMPT = `
# Medical Document Essential Information Extraction

## TASK
You are a medical AI assistant specializing in extracting the most ESSENTIAL information from medical documents.
Extract only the clinically significant information from the provided document.

## DOCUMENT METADATA
Document Type: {documentType}
Document Category: {documentCategory}
Document Date: {documentDate}

## DOCUMENT CONTENT
{documentContent}

## EXTRACTION GUIDELINES
1. Focus ONLY on clinically relevant information
2. Assign each extracted item an importance score (1-10) where:
   - 10: Critical for immediate clinical decisions (e.g., acute conditions, severe allergies)
   - 7-9: High clinical significance (current diagnoses, active medications)
   - 4-6: Moderate clinical relevance (stable chronic conditions)
   - 1-3: Background medical information (past resolved issues)
3. Assign each item a confidence score (0-1) based on how clearly it's stated in the document
4. Include a temporal marker (current, past, future) for each item
5. Group information into appropriate clinical categories

## OUTPUT FORMAT
Return a JSON object with the following structure:
{
  "sections": {
    "demographics": { 
      "items": [
        {"text": "string", "importance": number, "confidence": number, "temporalMarker": "string"}
      ]
    },
    "diagnoses": { "items": [] },
    "medications": { "items": [] },
    "labValues": { "items": [] },
    "procedures": { "items": [] },
    "plans": { "items": [] },
    "allergies": { "items": [] },
    "vitalSigns": { "items": [] },
    // Include any other relevant sections with data
  },
  "metadata": {
    "extractionConfidence": number  // Overall confidence in the extraction (0-1)
  }
}

ONLY include sections that contain extracted information. Omit empty sections.
`

/**
 * Summary compilation prompt template for aggregating document extractions
 */
const SUMMARY_COMPILATION_PROMPT = `
# Patient Summary Compilation

## TASK
Compile a comprehensive patient summary from the extracted information from multiple medical documents.
Focus on creating a clinically useful summary that prioritizes the most important information.

## PATIENT INFORMATION
Patient ID: {patientId}
Number of Documents: {documentCount}

## DOCUMENT EXTRACTIONS
{documentExtractions}

## COMPILATION GUIDELINES
1. Prioritize information based on:
   - Importance score (higher is more important)
   - Recency (more recent information may supersede older information)
   - Confidence score (higher confidence is more reliable)
2. Resolve contradictions by preferring:
   - More recent information
   - Information with higher confidence scores
   - Information seen in multiple documents
3. Highlight critical information at the beginning of each section
4. Maintain clinical organization reflecting standard medical documentation

## OUTPUT FORMAT
For each section, provide markdown-formatted content that synthesizes the information
from all documents. Prioritize the most clinically significant information.

Focus on these key sections:
1. Patient Information
2. Medical History
3. Current Conditions
4. Medications
5. Recent Findings
6. Treatment Plans
7. Laboratory Results
8. Imaging Results
9. Recommendations

Each section should be clear, concise, and clinically relevant.
`

/**
 * Patient Summary Service
 * Handles the generation of comprehensive patient summaries
 */
export class PatientSummaryService {
  private static instance: PatientSummaryService
  private supabase: ReturnType<typeof createServerClient>

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.supabase = createServerClient()
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): PatientSummaryService {
    if (!PatientSummaryService.instance) {
      PatientSummaryService.instance = new PatientSummaryService()
    }
    return PatientSummaryService.instance
  }

  /**
   * Extract essential information from a single document using Mistral
   *
   * @param documentId Document ID
   * @param documentContent Document text content
   * @param documentType Document type information
   * @param documentDate Document date
   * @returns Structured extraction of essential information
   * @throws {ExternalServiceError} If extraction or parsing fails
   * @throws {ValidationError} If input parameters are invalid
   */
  async extractDocumentEssentials(
    documentId: UUID,
    documentContent: string,
    documentType: DocumentType,
    documentDate: string
  ): Promise<DocumentExtraction> {
    // Validate inputs using type predicates
    if (!documentId || typeof documentId !== 'string') {
      throw new ValidationError({
        message: 'Valid document ID is required',
        code: 'INVALID_DOCUMENT_ID',
        data: { documentId }
      });
    }
    
    if (!documentContent || typeof documentContent !== 'string') {
      throw new ValidationError({
        message: 'Document content is required',
        code: 'MISSING_DOCUMENT_CONTENT',
        data: { documentId, contentLength: documentContent?.length || 0 }
      });
    }
    
    if (!this.isValidDocumentType(documentType)) {
      throw new ValidationError({
        message: 'Valid document type is required',
        code: 'INVALID_DOCUMENT_TYPE',
        data: { documentId, documentType }
      });
    }
    
    if (!documentDate || typeof documentDate !== 'string') {
      throw new ValidationError({
        message: 'Valid document date is required',
        code: 'INVALID_DOCUMENT_DATE',
        data: { documentId, documentDate }
      });
    }
    
    // Create logger with metadata for this operation
    const moduleLogger = logger.withMetadata({
      module: 'PatientSummaryService',
      method: 'extractDocumentEssentials',
      documentId,
      documentType: documentType.type
    });

    try {
      moduleLogger.info('Extracting essential information from document using Mistral', {
        documentCategory: documentType.category,
        documentLength: documentContent.length
      });
      
      // Use Mistral model from the AI SDK
      // Type assertion to fix compatibility issue
      const model = mistral('mistral-small-latest') as any;

      // Format the extraction prompt
      const prompt = DOCUMENT_EXTRACTION_PROMPT
        .replace('{documentType}', documentType.type)
        .replace('{documentCategory}', documentType.category)
        .replace('{documentDate}', documentDate)
        .replace('{documentContent}', documentContent);

      // Call the Mistral model with explicit typing
      const response = await generateText({
        model,
        prompt,
        maxTokens: 2048,
        temperature: 0.3,
      });

      // Parse the response JSON with stronger type checking
      let extraction: Record<string, any>;
      try {
        // First verify we got a response
        if (!response || !response.text) {
          throw new Error('Empty response from Mistral');
        }
        
        // Parse as JSON
        const parsed = JSON.parse(response.text);
        
        // Verify it's an object
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Response is not a valid JSON object');
        }
        
        extraction = parsed;
      } catch (parseError) {
        moduleLogger.error('Failed to parse Mistral extraction response',
          { responseLength: response.text.length }, 
          parseError
        );
        
        throw new ExternalServiceError({
          message: 'Failed to parse document extraction response',
          service: 'Mistral',
          code: 'PARSE_ERROR',
          data: { 
            documentId, 
            responseLength: response.text.length,
            responsePreview: `${response.text.substring(0, 100)  }...`
          },
          cause: parseError
        });
      }

      // Format the extraction with proper typing and validation
      const result: DocumentExtraction = {
        documentId,
        documentType,
        documentDate,
        sections: typeof extraction.sections === 'object' && extraction.sections !== null 
          ? extraction.sections 
          : {},
        metadata: {
          extractionConfidence: typeof extraction.metadata?.extractionConfidence === 'number'
            ? extraction.metadata.extractionConfidence
            : 0.8, // Higher default confidence for Mistral
          extractionDate: new Date().toISOString(),
        },
      };

      // Validate the extraction result
      if (!this.isValidDocumentExtraction(result)) {
        throw new ExternalServiceError({
          message: 'Invalid extraction result format',
          service: 'Mistral',
          code: 'INVALID_EXTRACTION_FORMAT',
          data: { 
            documentId,
            validationErrors: this.getExtractionValidationErrors(result)
          }
        });
      }

      moduleLogger.info('Document extraction successful with Mistral', {
        sectionCount: Object.keys(result.sections).length,
        confidence: result.metadata.extractionConfidence
      });

      return result;
    } catch (error) {
      if (error instanceof ApplicationError) {
        // Already formatted appropriately, just re-throw
        throw error;
      }
      
      moduleLogger.error(
        'Failed to extract essentials from document with Mistral',
        { documentId, documentType: documentType.type },
        error
      );
      
      throw new ExternalServiceError({
        message: 'Failed to extract document information',
        service: 'Mistral',
        code: 'EXTRACTION_FAILED',
        data: { documentId, documentType: documentType.type },
        cause: error
      });
    }
  }
  
  /**
   * Type guard to validate a document type
   * @param value The value to check
   * @returns True if value is a valid DocumentType
   */
  private isValidDocumentType(value: unknown): value is DocumentType {
    if (!value || typeof value !== 'object') return false;
    
    const obj = value as Record<string, unknown>;
    
    // Check if category is a string and is a valid DocumentCategory
    const isValidCategory = typeof obj.category === 'string' && 
      Object.values(DocumentCategory).includes(obj.category as DocumentCategory);
    
    return (
      isValidCategory && 
      typeof obj.type === 'string'
    );
  }
  
  /**
   * Type guard to validate document extraction
   * @param value The value to check
   * @returns True if value is a valid DocumentExtraction
   */
  private isValidDocumentExtraction(value: unknown): value is DocumentExtraction {
    if (!value || typeof value !== 'object') return false;
    
    const obj = value as Record<string, unknown>;
    
    // Check required fields
    const hasValidDocumentId = typeof obj.documentId === 'string';
    const hasValidDocumentType = this.isValidDocumentType(obj.documentType);
    const hasValidDocumentDate = typeof obj.documentDate === 'string';
    
    // Check sections
    const hasValidSections = typeof obj.sections === 'object' && obj.sections !== null;
    
    // Check metadata
    const hasValidMetadata = typeof obj.metadata === 'object' && obj.metadata !== null;
    
    if (hasValidMetadata) {
      const metadata = obj.metadata as Record<string, unknown>;
      
      // Check metadata fields
      const hasValidConfidence = typeof metadata.extractionConfidence === 'number' && 
        metadata.extractionConfidence >= 0 && 
        metadata.extractionConfidence <= 1;
        
      const hasValidDate = typeof metadata.extractionDate === 'string';
      
      if (!hasValidConfidence || !hasValidDate) {
        return false;
      }
    }
    
    return (
      hasValidDocumentId &&
      hasValidDocumentType &&
      hasValidDocumentDate &&
      hasValidSections &&
      hasValidMetadata
    );
  }
  
  /**
   * Get validation errors for document extraction
   * @param value The value to check
   * @returns Object with validation errors
   */
  private getExtractionValidationErrors(value: unknown): Record<string, string> {
    const errors: Record<string, string> = {};
    
    if (!value || typeof value !== 'object') {
      return { value: 'Extraction must be an object' };
    }
    
    const obj = value as Record<string, unknown>;
    
    // Check required fields
    if (typeof obj.documentId !== 'string') {
      errors.documentId = 'Document ID must be a string';
    }
    
    if (!this.isValidDocumentType(obj.documentType)) {
      errors.documentType = 'Document type must be a valid object with category and type';
    }
    
    if (typeof obj.documentDate !== 'string') {
      errors.documentDate = 'Document date must be a string';
    }
    
    if (typeof obj.sections !== 'object' || obj.sections === null) {
      errors.sections = 'Sections must be an object';
    }
    
    if (typeof obj.metadata !== 'object' || obj.metadata === null) {
      errors.metadata = 'Metadata must be an object';
    } else {
      const metadata = obj.metadata as Record<string, unknown>;
      
      if (typeof metadata.extractionConfidence !== 'number' || 
          metadata.extractionConfidence < 0 || 
          metadata.extractionConfidence > 1) {
        errors['metadata.extractionConfidence'] = 'Extraction confidence must be a number between 0 and 1';
      }
      
      if (typeof metadata.extractionDate !== 'string') {
        errors['metadata.extractionDate'] = 'Extraction date must be a string';
      }
    }
    
    return errors;
  }

  /**
   * Compile a patient summary from multiple document extractions using OpenAI
   * with Mistral as a fallback option if needed
   *
   * @param patientId Patient ID
   * @param extractions Array of document extractions
   * @returns Compiled patient summary
   */
  async compilePatientSummary(
    patientId: string,
    extractions: DocumentExtraction[]
  ): Promise<PatientSummary> {
    const moduleLogger = logger.withMetadata({
      module: 'PatientSummaryService',
      method: 'compilePatientSummary',
      patientId,
      documentCount: extractions.length
    })

    try {
      moduleLogger.info('Compiling patient summary from document extractions', {
        documentIds: extractions.map(e => e.documentId)
      })

      // Use OpenAI o3-mini model consistently throughout the app
      // Type assertion to fix type compatibility issue
      const model = openai('o3-mini') as any

      // Format the compilation prompt
      const prompt = SUMMARY_COMPILATION_PROMPT.replace(
        '{patientId}',
        patientId
      )
        .replace('{documentCount}', extractions.length.toString())
        .replace('{documentExtractions}', JSON.stringify(extractions, null, 2))

      // Call the OpenAI model
      const response = await generateText({
        model,
        prompt,
        maxTokens: 4000,
        temperature: 0.2,
      })

      // Parse the responses into sections
      const sections = this.parseSummaryResponse(response.text)

      if (Object.keys(sections).length === 0) {
        moduleLogger.warn('No valid sections found in summary response', {
          responseLength: response.text.length
        })
      }

      // Create the patient summary
      const summary: PatientSummary = {
        patientInfo:
          sections.patientInfo ||
          this.createEmptySection('Patient Information'),
        medicalHistory:
          sections.medicalHistory || this.createEmptySection('Medical History'),
        currentConditions:
          sections.currentConditions ||
          this.createEmptySection('Current Conditions'),
        medications:
          sections.medications || this.createEmptySection('Medications'),
        recentFindings:
          sections.recentFindings || this.createEmptySection('Recent Findings'),
        treatmentPlans:
          sections.treatmentPlans || this.createEmptySection('Treatment Plans'),
        labResults:
          sections.labResults || this.createEmptySection('Laboratory Results'),
        imagingResults:
          sections.imagingResults || this.createEmptySection('Imaging Results'),
        recommendations:
          sections.recommendations ||
          this.createEmptySection('Recommendations'),
        metadata: {
          generatedAt: new Date().toISOString(),
          documentCount: extractions.length,
          documents: extractions.map((extraction) => ({
            id: extraction.documentId,
            type: extraction.documentType,
            title: `Document ${extraction.documentId}`,
            date: extraction.documentDate,
          })),
        },
      }

      moduleLogger.info('Successfully compiled patient summary', {
        sectionCount: Object.keys(sections).length
      })

      // Store the summary in Supabase
      await this.storeSummary(patientId, summary)

      return summary
    } catch (error) {
      if (error instanceof ApplicationError) {
        // Already formatted appropriately, just re-throw
        throw error;
      }

      moduleLogger.error('Failed to compile patient summary', {}, error);
      
      throw new ExternalServiceError({
        message: 'Failed to compile patient summary',
        service: 'OpenAI',
        code: 'COMPILATION_FAILED',
        data: { patientId, documentCount: extractions.length },
        cause: error
      });
    }
  }

  /**
   * Parse the summary response from OpenAI into structured sections
   *
   * @param responseText The response text from OpenAI
   * @returns Structured sections for the patient summary
   */
  private parseSummaryResponse(
    responseText: string
  ): Record<string, PatientSummarySection> {
    const sections: Record<string, PatientSummarySection> = {}
    const sectionMapping: Record<string, string> = {
      'Patient Information': 'patientInfo',
      'Medical History': 'medicalHistory',
      'Current Conditions': 'currentConditions',
      Medications: 'medications',
      'Recent Findings': 'recentFindings',
      'Treatment Plans': 'treatmentPlans',
      'Laboratory Results': 'labResults',
      'Imaging Results': 'imagingResults',
      Recommendations: 'recommendations',
    }

    // Split response by markdown headers
    const sectionMatches = responseText.match(
      /## (.+?)\n([\s\S]+?)(?=\n## |$)/g
    )

    if (!sectionMatches) {
      console.warn('No valid sections found in summary response')
      return sections
    }

    // Process each section
    sectionMatches.forEach((sectionText) => {
      const titleMatch = sectionText.match(/## (.+?)\n/)
      if (!titleMatch) return

      const title = titleMatch[1].trim()
      const content = sectionText.replace(titleMatch[0], '').trim()

      // Map to the correct section name
      const sectionKey = sectionMapping[title]
      if (sectionKey) {
        sections[sectionKey] = {
          title,
          content,
          sources: [], // We don't have direct sources in the compilation phase
        }
      }
    })

    return sections
  }

  /**
   * Create an empty section when a section is missing in the response
   *
   * @param title Section title
   * @returns Empty section
   */
  private createEmptySection(title: string): PatientSummarySection {
    return {
      title,
      content: 'No information available.',
      sources: [],
    }
  }

  /**
   * Main method to generate a patient summary from multiple documents
   * Uses the two-stage approach: document extraction followed by compilation
   *
   * @param patientId Patient ID
   * @param documents Array of patient documents
   * @returns Complete patient summary
   */
  async generatePatientSummary(
    patientId: string,
    documents: PatientDocument[]
  ): Promise<PatientSummary> {
    const moduleLogger = logger.withMetadata({
      module: 'PatientSummaryService',
      method: 'generatePatientSummary',
      patientId,
      documentCount: documents.length
    })

    try {
      moduleLogger.info('Starting patient summary generation')

      if (documents.length === 0) {
        moduleLogger.warn('No documents provided for summary generation')
        throw new ValidationError({
          message: 'Cannot generate summary: no documents provided',
          code: 'NO_DOCUMENTS',
          data: { patientId }
        })
      }

      // First check if we already have a summary for this patient
      const existingSummary = await this.getPatientSummary(patientId)
      if (existingSummary) {
        moduleLogger.info('Using existing patient summary', {
          generatedAt: existingSummary.metadata.generatedAt,
          documentCount: existingSummary.metadata.documentCount
        })
        
        // Check if the summary is up to date
        const existingDocIds = new Set(existingSummary.metadata.documents.map((doc: any) => doc.id))
        const newDocIds = new Set(documents.map(doc => doc.id))
        
        // Check if all current documents are already in the summary
        const isUpToDate = documents.every(doc => existingDocIds.has(doc.id))
        
        // If the summary is up to date, return it
        if (isUpToDate && existingDocIds.size === newDocIds.size) {
          moduleLogger.info('Existing summary is up to date')
          return existingSummary
        }
        
        moduleLogger.info('Existing summary needs to be updated', {
          existingDocCount: existingDocIds.size,
          newDocCount: newDocIds.size
        })
      }

      // Stage 1: Extract essential information from each document in parallel
      moduleLogger.info('Extracting essential information from documents')
      
      const extractions = await Promise.all(
        documents.map(async (document) => {
          return this.extractDocumentEssentials(
            document.id,
            document.content_text || '',
            typeof document.document_type === 'object'
              ? (document.document_type as DocumentType)
              : { category: DocumentCategory.ADMINISTRATIVE, type: 'unknown' },
            document.document_date || new Date().toISOString()
          )
        })
      )

      // Stage 2: Compile the extractions into a comprehensive summary
      moduleLogger.info('Compiling extractions into patient summary', {
        extractionCount: extractions.length
      })
      
      const summary = await this.compilePatientSummary(patientId, extractions)
      
      // Store the summary in the database
      await this.storeSummary(patientId, summary)
      
      return summary
    } catch (error) {
      if (error instanceof ApplicationError) {
        // Already formatted appropriately, just re-throw
        throw error
      }

      moduleLogger.error('Failed to generate patient summary', {}, error)
      
      throw new SystemError({
        message: 'Failed to generate patient summary',
        code: 'SUMMARY_GENERATION_FAILED',
        data: { patientId, documentCount: documents.length },
        cause: error
      })
    }
  }

  /**
   * Store the summary in Supabase
   *
   * @param patientId Patient ID
   * @param summary Patient summary
   */
  private async storeSummary(
    patientId: string,
    summary: PatientSummary
  ): Promise<void> {
    const moduleLogger = logger.withMetadata({
      module: 'PatientSummaryService',
      method: 'storeSummary',
      patientId
    })

    try {
      moduleLogger.info('Storing patient summary in database')

      // Create Supabase client and then use it
      const supabase = await createServerClient()

      // Get the current user ID or default to 'system'
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const userId = user?.id || 'system'

      // Check if a verified summary already exists for this patient
      const { data: existingSummary, error: fetchError } = await supabase
        .from('patient_summaries')
        .select('summary, verified_at, verified_by')
        .eq('patient_id', patientId)
        .maybeSingle()

      if (fetchError) {
        moduleLogger.error('Error fetching existing patient summary', {}, fetchError)
        throw new SystemError({
          message: 'Failed to fetch existing patient summary',
          code: 'DB_FETCH_ERROR',
          data: { patientId },
          cause: fetchError
        })
      }

      // Preserve verification data if it exists
      const summaryData = summary as unknown as Json
      let verifiedAt = null
      let verifiedBy = null

      if (existingSummary) {
        // Careful not to overwrite verification data
        verifiedAt = existingSummary.verified_at
        verifiedBy = existingSummary.verified_by
        moduleLogger.info('Preserving existing verification data', { verifiedBy, hasVerifiedAt: !!verifiedAt })
      }

      const { error: upsertError } = await supabase.from('patient_summaries').upsert(
        {
          patient_id: patientId,
          summary: summaryData,
          document_count: summary.metadata.documentCount,
          generated_at: summary.metadata.generatedAt,
          created_by: userId,
          last_modified_by: userId,
          // Preserve verification status if it exists
          ...(verifiedAt ? { verified_at: verifiedAt } : {}),
          ...(verifiedBy ? { verified_by: verifiedBy } : {}),
        },
        {
          onConflict: 'patient_id', // Use patient_id as conflict resolution strategy
        }
      )

      if (upsertError) {
        moduleLogger.error('Error upserting patient summary', {}, upsertError)
        throw new SystemError({
          message: 'Failed to store patient summary in database',
          code: 'DB_UPSERT_ERROR',
          data: { patientId },
          cause: upsertError
        })
      }

      moduleLogger.info('Successfully stored patient summary in database')
    } catch (error) {
      if (error instanceof ApplicationError) {
        // Already formatted appropriately, just re-throw
        throw error
      }

      moduleLogger.error('Error storing patient summary', {}, error)
      
      throw new SystemError({
        message: 'Failed to store patient summary',
        code: 'STORAGE_FAILED',
        data: { patientId },
        cause: error
      })
    }
  }

  /**
   * Merge verification data with an existing patient summary
   *
   * @param patientId Patient ID
   * @param verificationItems Verification items for the summary
   * @param status Verification status
   * @returns The verified patient summary
   */
  async mergeVerificationData(
    patientId: string,
    verificationItems: VerificationItem[],
    status: VerificationStatusEnum
  ): Promise<VerifiedPatientSummary | null> {
    try {
      // Get the Supabase client
      const supabase = await createServerClient()

      // Fetch the existing summary
      const { data: existingSummary, error } = await supabase
        .from('patient_summaries')
        .select('summary, id')
        .eq('patient_id', patientId)
        .single()

      if (error || !existingSummary) {
        console.warn(`No existing summary found for patient ${patientId}`)
        return null
      }

      // Parse the existing summary
      const summary = existingSummary.summary as unknown as PatientSummary

      // Create verified summary by extending the existing summary
      // Create a custom verification status object compatible with VerifiedPatientSummary
      const verificationStatusObj = {
        isVerified: status === VerificationStatusEnum.completed,
        verifiedAt: new Date().toISOString(),
        verifiedBy: 'system'
      };
      
      const verifiedSummary: VerifiedPatientSummary = {
        ...summary,
        verificationItems,
        verificationStatus: verificationStatusObj,
        verificationMetadata: {
          verifiedAt: new Date().toISOString(),
          verifiedBy: 'system',
        },
      }

      // Update the record with verification data
      const { error: updateError } = await supabase
        .from('patient_summaries')
        .update({
          verified_at: new Date().toISOString(),
          verified_by: 'system',
          summary: verifiedSummary as unknown as Json,
          last_modified_by: 'system',
        })
        .eq('id', existingSummary.id)

      if (updateError) throw updateError

      return verifiedSummary
    } catch (error) {
      console.error(
        `Error merging verification data for patient ${patientId}:`,
        error
      )
      return null
    }
  }

  /**
   * Verify a patient summary
   *
   * @param patientId Patient ID
   * @param verifiedBy User ID of the person verifying the summary
   * @param status Status to set (verified/rejected/etc)
   * @param comments Optional comments about the verification
   * @returns Updated patient summary
   */
  async verifySummary(
    patientId: string,
    verifiedBy: string,
    status: 'verified' | 'rejected' = 'verified',
    comments?: string
  ): Promise<PatientSummary | null> {
    try {
      // Get the Supabase client
      const supabase = await createServerClient()

      // Get the current date/time
      const verifiedAt = new Date().toISOString()

      // Create verification status based on VerificationStatus interface requirements
      const verificationStatus = {
        isVerified: status === 'verified',
        verifiedAt,
        verifiedBy,
        corrections: comments ? { comments } : undefined,
      }

      // Fetch the existing summary
      const { data: existingSummary, error } = await supabase
        .from('patient_summaries')
        .select('summary, id')
        .eq('patient_id', patientId)
        .single()

      if (error || !existingSummary) {
        console.warn(`No existing summary found for patient ${patientId}`)
        return null
      }

      // Parse the existing summary and add verification metadata
      const summary = existingSummary.summary as unknown as PatientSummary

      // Create updated summary with verification info
      // We'll add our own verification field since it doesn't exist in the base type
      const updatedSummary = {
        ...summary,
        metadata: {
          ...summary.metadata,
          // Add custom verification metadata fields
          verificationInfo: {
            verifiedAt,
            verifiedBy,
            status,
          },
        },
      }

      // Update the record with verification data
      const { error: updateError } = await supabase
        .from('patient_summaries')
        .update({
          verified_at: verifiedAt,
          verified_by: verifiedBy,
          summary: updatedSummary as unknown as Json,
          last_modified_by: verifiedBy,
        })
        .eq('id', existingSummary.id)

      if (updateError) throw updateError

      return updatedSummary
    } catch (error) {
      console.error(`Error verifying patient summary for ${patientId}:`, error)
      return null
    }
  }

  /**
   * Check if a patient summary has been verified
   *
   * @param patientId Patient ID
   * @returns Verification status or null if summary doesn't exist or isn't verified
   */
  async getSummaryVerificationStatus(patientId: string): Promise<{
    verifiedAt: string
    verifiedBy: string
    status: string
  } | null> {
    try {
      // Get the Supabase client
      const supabase = await createServerClient()

      // Fetch verification status
      const { data, error } = await supabase
        .from('patient_summaries')
        .select('verified_at, verified_by, summary')
        .eq('patient_id', patientId)
        .single()

      if (error || !data || !data.verified_at) {
        return null
      }

      // Get the verification status from the summary metadata if available
      const summary = data.summary as unknown as PatientSummary & {
        metadata: { verificationInfo?: { status: string } }
      }

      // Default to 'verified' if no specific status is saved
      const status = summary?.metadata?.verificationInfo?.status || 'verified'

      return {
        verifiedAt: data.verified_at,
        verifiedBy: data.verified_by || 'unknown',
        status,
      }
    } catch (error) {
      console.error(
        `Error getting verification status for patient ${patientId}:`,
        error
      )
      return null
    }
  }

  /**
   * Retrieve a patient summary by patient ID
   *
   * @param patientId Patient ID
   * @returns Patient summary or null if not found
   */
  async getPatientSummary(patientId: string): Promise<PatientSummary | null> {
    const moduleLogger = logger.withMetadata({
      module: 'PatientSummaryService',
      method: 'getPatientSummary',
      patientId
    })

    try {
      moduleLogger.info('Retrieving patient summary from database')
      
      // Get the Supabase client
      const supabase = await createServerClient()

      // Fetch the summary from the database
      const { data, error } = await supabase
        .from('patient_summaries')
        .select('summary')
        .eq('patient_id', patientId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found error
          moduleLogger.info('Patient summary not found in database')
          return null
        }
        
        moduleLogger.error('Error fetching patient summary from database', {}, error)
        throw new SystemError({
          message: 'Failed to retrieve patient summary',
          code: 'DB_FETCH_ERROR',
          data: { patientId },
          cause: error
        })
      }

      if (!data || !data.summary) {
        moduleLogger.info('Patient summary not found or empty')
        return null
      }

      moduleLogger.info('Successfully retrieved patient summary')
      
      // Parse the summary
      return data.summary as unknown as PatientSummary
    } catch (error) {
      if (error instanceof ApplicationError) {
        // Already formatted appropriately, just re-throw
        throw error
      }

      moduleLogger.error('Failed to retrieve patient summary', {}, error)
      
      throw new SystemError({
        message: 'Failed to retrieve patient summary',
        code: 'RETRIEVAL_FAILED',
        data: { patientId },
        cause: error
      })
    }
  }

  /**
   * Generate a markdown version of the patient summary
   *
   * @param summary Patient summary
   * @returns Markdown formatted summary
   */
  generateMarkdown(summary: PatientSummary): string {
    const sections = [
      {
        title: '🧑‍⚕️ Patient Information',
        content: summary.patientInfo.content,
      },
      { title: '📋 Medical History', content: summary.medicalHistory.content },
      {
        title: '🏥 Current Conditions',
        content: summary.currentConditions.content,
      },
      { title: '💊 Medications', content: summary.medications.content },
      { title: '🔍 Recent Findings', content: summary.recentFindings.content },
      { title: '📝 Treatment Plans', content: summary.treatmentPlans.content },
      { title: '🧪 Laboratory Results', content: summary.labResults.content },
      { title: '🔬 Imaging Results', content: summary.imagingResults.content },
      { title: '📋 Recommendations', content: summary.recommendations.content },
    ]

    const metadata = `
---
Generated: ${new Date(summary.metadata.generatedAt).toLocaleString()}
Documents Analyzed: ${summary.metadata.documentCount}
---
`

    const sourcesList = summary.metadata.documents
      .map(
        (doc: any) =>
          `- ${doc.type.category} - ${doc.type.type} (${new Date(doc.date).toLocaleDateString()})`
      )
      .join('\n')

    const markdownContent = sections
      .map((section) => `## ${section.title}\n\n${section.content}\n`)
      .join('\n')

    return `# Patient Summary\n\n${metadata}\n## Sources\n\n${sourcesList}\n\n${markdownContent}`
  }

  /**
   * Generate a deep research report based on a verified patient summary
   * This uses the o3-mini verified summary as the source of truth
   * before passing to Perplexity for deep medical diagnosis
   *
   * @param patientId Patient ID
   * @param userId User ID
   * @param additionalInstructions Optional additional instructions for research
   * @returns Research result or null if verification not found
   */
  async generateDeepResearchReport(
    patientId: string,
    userId: string,
    additionalInstructions?: string
  ): Promise<ResearchResult | null> {
    const summary = await this.getVerifiedSummary(patientId)

    if (!summary || !summary.metadata?.verificationInfo?.verifiedAt) {
      console.warn(
        `Cannot generate deep research report - patient summary ${patientId} is not verified`
      )
      return null
    }

    // Format the patient data for research
    const formattedPatientData = this.formatPatientDataForResearch(summary)

    // Create a research query that helps generate a comprehensive medical report
    const medicalResearchQuery = `
      Based on the patient summary, generate a comprehensive medical report that includes:
      1. An analysis of the patient's current conditions 
      2. Potential differential diagnoses with confidence levels
      3. Recommended treatments and follow-up actions
      4. Evidence-based support for your analysis
      ${additionalInstructions ? `\nAdditional instructions: ${additionalInstructions}` : ''}
    `.trim()

    // Set research options
    const researchOptions: ResearchOptions = {
      isMedicalDiagnosis: true,
      depth: 'comprehensive',
      includeSourceContent: false,
      contextData: {
        patientId,
        userId,
        additionalInstructions,
      },
    }

    // Use the perplexity service to perform the medical diagnosis
    // The verified o3-mini summary is the source of truth for the medical diagnosis
    const researchResult = await perplexityService.performMedicalDiagnosis(
      medicalResearchQuery,
      formattedPatientData,
      researchOptions
    )

    return researchResult
  }

  /**
   * Format patient data for research
   *
   * @param summary Patient summary
   * @returns Formatted patient data as text
   */
  private formatPatientDataForResearch(summary: PatientSummary): string {
    const sections = [
      this.formatSectionForResearch('Patient Information', summary.patientInfo),
      this.formatSectionForResearch('Medical History', summary.medicalHistory),
      this.formatSectionForResearch(
        'Current Conditions',
        summary.currentConditions
      ),
      this.formatSectionForResearch('Medications', summary.medications),
      this.formatSectionForResearch('Recent Findings', summary.recentFindings),
      this.formatSectionForResearch('Treatment Plans', summary.treatmentPlans),
      this.formatSectionForResearch('Lab Results', summary.labResults),
      this.formatSectionForResearch('Imaging Results', summary.imagingResults),
      this.formatSectionForResearch('Recommendations', summary.recommendations),
    ]

    // Add verification information from o3-mini model
    if (summary.metadata?.verificationInfo) {
      const verifiedBy =
        summary.metadata.verificationInfo.verifiedBy || 'Unknown'
      const verifiedAt =
        summary.metadata.verificationInfo.verifiedAt || 'Unknown date'
      const status =
        summary.metadata.verificationInfo.status || 'Unknown status'

      sections.push(
        `## Verification Status\nThis summary was ${status} by ${verifiedBy} on ${verifiedAt} using o3-mini model`
      )
    }

    return sections.join('\n\n')
  }

  /**
   * Format a section for research
   *
   * @param title Section title
   * @param section Section data
   * @returns Formatted section as text
   */
  private formatSectionForResearch(
    title: string,
    section: PatientSummarySection | any
  ): string {
    if (!section) return ''

    // Handle the PatientSummarySection format
    if (section.title && section.content) {
      return `## ${title}\n${section.content}`
    }

    // Handle array format
    if (Array.isArray(section)) {
      const items = section.map((item) => `- ${item}`).join('\n')
      return `## ${title}\n${items}`
    }

    // Handle object format
    if (typeof section === 'object') {
      return `## ${title}\n${JSON.stringify(section, null, 2)}`
    }

    // Handle string format
    return `## ${title}\n${section}`
  }

  /**
   * Get a verified patient summary
   *
   * @param patientId Patient ID
   * @returns Verified patient summary or null if not found or not verified
   */
  async getVerifiedSummary(patientId: string): Promise<PatientSummary | null> {
    // First get the summary
    const summary = await this.getPatientSummary(patientId)

    if (!summary) {
      console.warn(`No summary found for patient ${patientId}`)
      return null
    }

    // Check if it's verified
    if (!summary.metadata?.verificationInfo?.verifiedAt) {
      console.warn(`Summary for patient ${patientId} is not verified`)
      return null
    }

    return summary
  }
}

// Export singleton instance
export const patientSummaryService = PatientSummaryService.getInstance()