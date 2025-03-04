/**
 * Document Service Implementation
 *
 * Centralized service for document processing, extraction, and storage
 * 
 * Note: This service now uses the specialized extraction, storage, and analysis
 * services internally for improved separation of concerns. For new code, consider
 * using the specialized services directly through the module exports.
 */

// Import specialized services
import {
  DocumentExtractionService,
  DocumentStorageService,
  DocumentAnalysisService
} from './index'

import { getDbCompatibleMetadata } from '@/lib/processing/types/verification'
import logger from '@/lib/logger'
import {
  ExternalServiceError,
  SystemError,
  ValidationError,
  NotFoundError,
  normalizeError,
  ApplicationError,
} from '@/lib/errors'

/**
 * Document Service Implementation
 *
 * Centralized service for document processing, extraction, and storage
 */
import { createBrowserClient } from '@/lib/supabase/clients'
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx'
import { WebPDFLoader } from '@langchain/community/document_loaders/web/pdf'
import { Document } from 'langchain/document'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import * as pdfjsLib from 'pdfjs-dist'

// Import types from specific modules
import type {
  DocumentType,
  ProcessingStatus,
  ExtractedData,
  ExtractedDocument,
  DocumentMetadata
} from '@/lib/types'
import { 
  documentFromDb, 
  documentToDb, 
  extractedDocumentFromDb, 
  extractedDocumentToDb,
  DbExtractedDocument
} from '@/lib/types/db-adapters'
import type { Json } from '@/lib/supabase'
import { uploadService } from '@/lib/services/upload/upload-service'

// Create instances of specialized services for internal use
const extractionService = new DocumentExtractionService()
const storageService = new DocumentStorageService()
const analysisService = new DocumentAnalysisService()

/**
 * Custom error class for document service errors
 */
class DocumentServiceError extends ApplicationError {
  constructor(
    message: string,
    code: string,
    isRetryable: boolean = false,
    data?: Record<string, unknown>
  ) {
    super({
      message,
      code,
      data: {
        ...data,
        isRetryable,
      },
    })
  }
}

/**
 * Document processing options with enhanced metadata
 */
interface DocumentProcessingOptions {
  documentType?: DocumentType
  onStatusUpdate?: (status: ProcessingStatus) => void
  metadata?: Record<string, any>
  isPatientDocument?: boolean
  patientId?: string
  departmentId?: string

  // Enhanced options
  extractionLevel?: 'basic' | 'enhanced' | 'comprehensive'
  preserveSections?: boolean
  extractMetadata?: boolean
  chunkingStrategy?: 'simple' | 'semantic' | 'section-based'
  prioritizeFields?: string[]
}

/**
 * Enhanced document extraction options
 */
interface EnhancedExtractionOptions {
  splitPages?: boolean
  extractTables?: boolean
  detectSections?: boolean
  ocrImages?: boolean
  preserveLayout?: boolean
  maxPageLength?: number
}

/**
 * Enhanced chunking options
 */
interface ChunkingOptions {
  chunkSize: number
  chunkOverlap: number
  preserveMetadata: boolean
  strategy: 'size' | 'semantic' | 'section'
}

/**
 * Document type detection result
 */
interface DocumentTypeDetectionResult {
  type: DocumentType
  confidence: number
  detectedSections?: string[]
  possibleTypes?: DocumentType[]
}

/**
 * Upload document result
 */
interface UploadDocumentResult {
  documentId: string
  fileName: string
  extractionStatus?: string
}

/**
 * Document Service with centralized functionality for
 * document uploading, extraction, and storage
 */
export class DocumentService {
  private supabase = createBrowserClient()

  /**
   * Maximum supported file size (20MB)
   */
  private readonly maxFileSize = 20 * 1024 * 1024

  /**
   * Default enhanced extraction options
   */
  private readonly defaultExtractionOptions: EnhancedExtractionOptions = {
    splitPages: true,
    extractTables: true,
    detectSections: true,
    ocrImages: true,
    preserveLayout: true,
    maxPageLength: 5000,
  }

  /**
   * Default chunking options
   */
  private readonly defaultChunkingOptions: ChunkingOptions = {
    chunkSize: 1000,
    chunkOverlap: 200,
    preserveMetadata: true,
    strategy: 'semantic',
  }

  /**
   * Supported document types with enhanced metadata
   */
  private readonly supportedTypes = [
    {
      mimeType: 'application/pdf',
      extensions: ['pdf'],
      extractionLevel: 'comprehensive',
    },
    {
      mimeType: 'text/plain',
      extensions: ['txt'],
      extractionLevel: 'basic',
    },
    {
      mimeType: 'application/msword',
      extensions: ['doc'],
      extractionLevel: 'enhanced',
    },
    {
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extensions: ['docx'],
      extractionLevel: 'enhanced',
    },
    // New supported types
    {
      mimeType: 'image/jpeg',
      extensions: ['jpg', 'jpeg'],
      extractionLevel: 'basic',
      requiresOcr: true,
    },
    {
      mimeType: 'image/png',
      extensions: ['png'],
      extractionLevel: 'basic',
      requiresOcr: true,
    },
  ]

  /**
   * Medical document section patterns
   */
  private readonly medicalSectionPatterns = [
    {
      name: 'patient_information',
      patterns: ['patient information', 'demographics', 'patient data'],
    },
    {
      name: 'chief_complaint',
      patterns: ['chief complaint', 'presenting complaint', 'reason for visit'],
    },
    {
      name: 'history_of_present_illness',
      patterns: ['history of present illness', 'hpi', 'present illness'],
    },
    {
      name: 'past_medical_history',
      patterns: ['past medical history', 'pmh', 'medical history'],
    },
    {
      name: 'medications',
      patterns: ['medications', 'current medications', 'meds', 'prescription'],
    },
    {
      name: 'allergies',
      patterns: ['allergies', 'drug allergies', 'medication allergies'],
    },
    {
      name: 'review_of_systems',
      patterns: ['review of systems', 'ros', 'systems review'],
    },
    {
      name: 'physical_examination',
      patterns: [
        'physical examination',
        'physical exam',
        'examination',
        'exam',
      ],
    },
    { name: 'assessment', patterns: ['assessment', 'impression', 'diagnosis'] },
    { name: 'plan', patterns: ['plan', 'treatment plan', 'recommendations'] },
    {
      name: 'laboratory_results',
      patterns: ['laboratory', 'lab results', 'laboratory studies'],
    },
    {
      name: 'imaging_results',
      patterns: ['imaging', 'radiology', 'x-ray', 'ct scan', 'mri'],
    },
    {
      name: 'procedures',
      patterns: ['procedures', 'interventions', 'operations'],
    },
  ]

  /**
   * Special medical document patterns for improved processing
   */
  private readonly medicalDocumentTypes: Record<string, DocumentType> = {
    PROGRESS_NOTE: { category: 'clinical', type: 'progress_note' },
    HISTORY_AND_PHYSICAL: { category: 'clinical', type: 'history_physical' },
    DISCHARGE_SUMMARY: { category: 'clinical', type: 'discharge_summary' },
    OPERATIVE_REPORT: { category: 'clinical', type: 'operative_report' },
    CONSULTATION: { category: 'clinical', type: 'consultation' },
    PATHOLOGY_REPORT: { category: 'lab', type: 'pathology_report' },
    RADIOLOGY_REPORT: { category: 'imaging', type: 'radiology_report' },
    LAB_RESULTS: { category: 'lab', type: 'lab_results' },
    MEDICATION_LIST: { category: 'clinical', type: 'medication_list' },
    IMMUNIZATION_RECORD: { category: 'clinical', type: 'immunization_record' },
  }

  /**
   * Enhanced extract text method using multiple strategies for better extraction
   * Handles complex PDFs, document structures, and formatting
   *
   * @param file File to extract text from
   * @param options Document processing options
   * @returns Extracted text with enhanced metadata
   */
  async extractText(
    file: File,
    options: EnhancedExtractionOptions = this.defaultExtractionOptions
  ): Promise<ExtractedData> {
    try {
      // Forward to the specialized extraction service
      return await extractionService.extractText(file, options)
    } catch (error) {
      // Enhanced error handling with structured logging
      const moduleLogger = logger.withMetadata({
        module: 'DocumentService',
        method: 'extractText',
        fileType: file.type,
        fileName: file.name,
      })

      moduleLogger.error('Failed to extract text from document', {}, error)

      // If it's already a normalized error, rethrow it
      if (error instanceof ValidationError || error instanceof SystemError) {
        throw error
      }

      // Otherwise, normalize the error with the appropriate context
      throw new SystemError({
        message: 'Failed to extract text from document',
        code: 'EXTRACTION_FAILED',
        data: {
          fileType: file.type,
          fileName: file.name,
        },
        cause: error,
      })
    }
  }

  /**
   * Enhanced PDF extraction with page analysis, table detection, and sectioning
   *
   * @param blob PDF blob to process
   * @param options Extraction options
   * @returns Enhanced extraction result
   */
  private async extractPdfWithEnhancement(
    blob: Blob,
    options: EnhancedExtractionOptions
  ): Promise<{
    text: string
    chunks: Array<{ content: string; pageNumber: number; metadata?: any }>
    pageCount: number
    hasImages: boolean
    hasTables: boolean
    detectedSections: string[]
    textQuality: number
  }> {
    // Use PDF.js for enhanced extraction
    const arrayBuffer = await blob.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const pageCount = pdf.numPages
    let fullText = ''
    const chunks: Array<{
      content: string
      pageNumber: number
      metadata?: any
    }> = []
    const detectedSections: string[] = []
    let hasImages = false
    let hasTables = false
    let textQuality = 1.0

    // Process each page
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i)

      // Get text content with layout information
      const textContent = await page.getTextContent({
        normalizeWhitespace: true,
      } as any)

      // Check for potential tables by analyzing text item positions
      const potentialTable = this.detectTablesInPdfPage(textContent)
      if (potentialTable) {
        hasTables = true
      }

      // Extract images if present (simplified)
      const operatorList = await page.getOperatorList()
      if (operatorList.fnArray.includes(pdfjsLib.OPS.paintImageXObject)) {
        hasImages = true
      }

      // Convert text content to string with layout preservation
      let pageText = ''
      let lastY: number | undefined
      let lastX = 0

      textContent.items.forEach((item: any) => {
        const currentY = item.transform[5]
        const currentX = item.transform[4]

        // Add newlines for new vertical positions (new lines)
        if (lastY !== undefined && Math.abs(currentY - lastY) > 5) {
          pageText += '\n'
          lastX = 0
        }

        // Add spaces for horizontal gaps
        if (lastX !== 0 && currentX - lastX > 10) {
          pageText += ' '
        }

        pageText += item.str
        lastY = currentY
        lastX = currentX + item.width
      })

      fullText += `${pageText}\n\n`

      // Detect sections in this page
      const pageSections = this.detectSectionsInText(pageText)
      detectedSections.push(...pageSections)

      // Create page chunk
      chunks.push({
        content: pageText,
        pageNumber: i,
        metadata: {
          hasTable: potentialTable,
          hasImage: hasImages,
          sections: pageSections,
        },
      })

      // Break text into smaller chunks if needed
      if (
        options.splitPages &&
        pageText.length > (options.maxPageLength || 5000)
      ) {
        const pageChunks = await this.createSemanticChunks(pageText, {
          ...this.defaultChunkingOptions,
          chunkSize: options.maxPageLength || 5000,
        })

        // Add page number and metadata to each chunk
        pageChunks.forEach((chunk, index) => {
          chunks.push({
            content: chunk.pageContent,
            pageNumber: i,
            metadata: {
              ...chunk.metadata,
              chunkIndex: index,
            },
          })
        })
      }
    }

    // Estimate text quality based on recognized characters and potential OCR artifacts
    const wordCount = fullText.split(/\s+/).length
    const charCount = fullText.replace(/\s+/g, '').length
    const nonAlphanumericRatio =
      fullText.replace(/[a-zA-Z0-9\s]/g, '').length / charCount
    textQuality = Math.max(0.1, 1.0 - (nonAlphanumericRatio > 0.3 ? 0.5 : 0))

    return {
      text: fullText,
      chunks,
      pageCount,
      hasImages,
      hasTables,
      detectedSections: [...new Set(detectedSections)], // Remove duplicates
      textQuality,
    }
  }

  /**
   * Detect tables in PDF page by analyzing text positioning
   *
   * @param textContent PDF.js text content
   * @returns Whether a table was detected
   */
  private detectTablesInPdfPage(textContent: any): boolean {
    if (!textContent.items || textContent.items.length < 10) {
      return false
    }

    // Collect all x-positions
    const xPositions: number[] = []
    textContent.items.forEach((item: any) => {
      xPositions.push(item.transform[4])
    })

    // Count frequency of each x-position
    const xFrequency: Record<number, number> = {}
    xPositions.forEach((x) => {
      // Round to handle minor variations
      const roundedX = Math.round(x)
      xFrequency[roundedX] = (xFrequency[roundedX] || 0) + 1
    })

    // Count x-positions that appear multiple times (column alignments)
    const columnCount = Object.values(xFrequency).filter(
      (count) => count > 2
    ).length

    // If we have 3+ columns with aligned text, it's likely a table
    return columnCount >= 3
  }

  /**
   * Process a text document to detect sections and create chunks
   *
   * @param text Text content
   * @param options Extraction options
   * @returns Processed text with chunks and detected sections
   */
  private async processTextDocument(
    text: string,
    options: EnhancedExtractionOptions
  ): Promise<{
    text: string
    chunks: Array<{ content: string; metadata?: any }>
    detectedSections: string[]
  }> {
    const chunks: Array<{ content: string; metadata?: any }> = []
    let detectedSections: string[] = []

    // Detect sections in the text
    if (options.detectSections) {
      detectedSections = this.detectSectionsInText(text)
    }

    // Create chunks based on sections if sections found
    if (detectedSections.length > 0) {
      const sectionChunks = this.splitTextBySections(text)
      chunks.push(
        ...sectionChunks.map((section) => ({
          content: section.content,
          metadata: { section: section.section },
        }))
      )
    } else {
      // Use semantic chunking as fallback
      const semanticChunks = await this.createSemanticChunks(
        text,
        this.defaultChunkingOptions
      )
      chunks.push(
        ...semanticChunks.map((chunk: Document) => ({
          content: chunk.pageContent,
          metadata: chunk.metadata,
        }))
      )
    }

    return { text, chunks, detectedSections }
  }

  /**
   * Extract text from a Word document with enhanced processing
   *
   * @param blob Word document blob
   * @param options Extraction options
   * @returns Enhanced extraction result
   */
  private async extractWordDocument(
    blob: Blob,
    options: EnhancedExtractionOptions
  ): Promise<{
    text: string
    chunks: Array<{ content: string; metadata?: any }>
    pageCount: number
    hasTables: boolean
    detectedSections: string[]
  }> {
    // Use LangChain DocxLoader
    const loader = new DocxLoader(blob)
    const docs = await loader.load()

    // Extract text and estimate page count based on content length
    const fullText = docs.map((doc) => doc.pageContent).join('\n\n')
    const estimatedPageCount = Math.max(1, Math.ceil(fullText.length / 3000))

    // Detect sections
    const detectedSections = this.detectSectionsInText(fullText)

    // Check for potential tables
    const hasTables =
      /\b(table|row)\b/i.test(fullText) ||
      fullText.split('\n').some((line) => line.split(/\s+/).length > 6)

    // Create chunks - preferring section-based if sections found
    let chunks: Array<{ content: string; metadata?: any }> = []

    if (detectedSections.length > 0 && options.detectSections) {
      const sectionChunks = this.splitTextBySections(fullText)
      chunks = sectionChunks.map((section) => ({
        content: section.content,
        metadata: { section: section.section },
      }))
    } else {
      // Fallback to semantic chunking
      const semanticChunks = await this.createSemanticChunks(
        fullText,
        this.defaultChunkingOptions
      )
      chunks = semanticChunks.map((chunk: Document) => ({
        content: chunk.pageContent,
        metadata: chunk.metadata,
      }))
    }

    return {
      text: fullText,
      chunks,
      pageCount: estimatedPageCount,
      hasTables,
      detectedSections,
    }
  }

  /**
   * Perform OCR on an image to extract text
   * This would use a proper OCR service in production
   *
   * @param blob Image blob
   * @returns OCR result
   */
  private async performOcrOnImage(blob: Blob): Promise<{
    text: string
    width: number
    height: number
    confidence: number
  }> {
    // This is a mock implementation - in a real system, you would:
    // 1. Use a dedicated OCR service like Google Cloud Vision, Tesseract.js, or a HIPAA-compliant medical OCR service
    // 2. Process the image to improve OCR quality (deskew, enhance contrast, etc.)
    // 3. Apply medical-specific OCR models if available

    // Simulate creating an image to get dimensions
    const url = URL.createObjectURL(blob)
    const img = document.createElement('img')
    img.src = url

    // Wait for image to load
    await new Promise((resolve) => {
      img.onload = resolve
    })

    // Get dimensions
    const width = img.width
    const height = img.height

    // Clean up
    URL.revokeObjectURL(url)

    // In a real implementation, you would call an OCR service here
    // For this example, return a mock result
    return {
      text: 'This is placeholder text that would come from an OCR service. In a real implementation, the image would be processed to extract actual text content.',
      width,
      height,
      confidence: 0.75,
    }
  }

  /**
   * Detect medical document sections from text
   *
   * @param text Document text
   * @returns Array of detected section names
   */
  private detectSectionsInText(text: string): string[] {
    const detectedSections: string[] = []

    // Look for common medical document section headers
    for (const section of this.medicalSectionPatterns) {
      for (const pattern of section.patterns) {
        // Look for the pattern surrounded by whitespace or at the beginning of a line
        const regex = new RegExp(`(^|\\s)(${pattern})(:|\\s|$)`, 'i')
        if (regex.test(text)) {
          detectedSections.push(section.name)
          break // Found this section, no need to check other patterns
        }
      }
    }

    return detectedSections
  }

  /**
   * Split text by detected sections
   *
   * @param text Document text
   * @returns Array of sections with content
   */
  private splitTextBySections(
    text: string
  ): Array<{ section: string; content: string }> {
    const sections: Array<{ section: string; content: string }> = []
    let currentContent = ''
    let currentSection = 'unknown'

    // Split text into lines for processing
    const lines = text.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check if this line is a section header
      let newSectionFound = false

      for (const section of this.medicalSectionPatterns) {
        for (const pattern of section.patterns) {
          // Look for the pattern surrounded by whitespace or at the beginning of a line
          const regex = new RegExp(`(^|\\s)(${pattern})(:|\\s|$)`, 'i')
          if (regex.test(line)) {
            // If we were already building a section, save it
            if (currentContent.trim()) {
              sections.push({
                section: currentSection,
                content: currentContent.trim(),
              })
            }

            // Start a new section
            currentSection = section.name
            currentContent = `${line}\n` // Include the header in the content
            newSectionFound = true
            break
          }
        }
        if (newSectionFound) break
      }

      // If not a new section, add to current content
      if (!newSectionFound) {
        currentContent += `${line}\n`
      }
    }

    // Add the last section if not empty
    if (currentContent.trim()) {
      sections.push({
        section: currentSection,
        content: currentContent.trim(),
      })
    }

    return sections
  }

  /**
   * Create semantic chunks from text using LangChain's RecursiveCharacterTextSplitter
   *
   * @param text Text to chunk
   * @param options Chunking options
   * @returns Array of chunks with metadata
   */
  private async createSemanticChunks(
    text: string,
    options: ChunkingOptions
  ): Promise<Document[]> {
    // Create a text splitter
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap,
      // Use medical-specific separators
      separators: [
        '\n\n', // Double line breaks (strong separator)
        '\n', // Single line breaks
        '. ', // End of sentences
        ': ', // Colons often introduce new content
        ', ', // Commas may separate list items
        ' ', // Last resort - split on spaces
      ],
    })

    // Create a document with the text
    const doc = new Document({
      pageContent: text,
      metadata: {},
    })

    // Split the document
    return await splitter.splitDocuments([doc])
  }

  /**
   * Document type detection using content analysis
   *
   * @param content Document content
   * @returns Detected document type with confidence
   */
  async detectDocumentType(
    content: string
  ): Promise<DocumentTypeDetectionResult> {
    // Forward to the specialized analysis service
    return await analysisService.detectDocumentType(content)
  }

  /**
   * Batch process multiple documents in parallel with improved type safety
   *
   * @param files Array of files to process
   * @param patientId Patient ID for all documents
   * @param options Document processing options
   * @returns Object containing arrays of successful and failed documents
   * @throws {ValidationError} If inputs are invalid
   * @throws {SystemError} If there's a system-level batch processing error
   */
  async batchProcessDocuments(
    files: File[],
    patientId: UUID,
    options?: DocumentProcessingOptions
  ): Promise<{
    successful: ExtractedDocument[];
    failed: { file: File; error: Error }[];
  }> {
    // Validate inputs
    if (!Array.isArray(files) || files.length === 0) {
      throw new ValidationError({
        message: 'Files array must contain at least one file',
        code: 'EMPTY_FILES_ARRAY',
        data: { fileCount: files?.length || 0 }
      });
    }
    
    if (!patientId || typeof patientId !== 'string') {
      throw new ValidationError({
        message: 'Valid patient ID is required',
        code: 'INVALID_PATIENT_ID',
        data: { patientId }
      });
    }
    
    // Create logger with metadata for this operation
    const moduleLogger = logger.withMetadata({
      module: 'DocumentService',
      method: 'batchProcessDocuments',
      fileCount: files.length,
      patientId
    });
    
    moduleLogger.info('Starting batch document processing');
    
    // Limit batch size to prevent overwhelming the system
    const batchSize = 5;
    const successful: ExtractedDocument[] = [];
    const failed: { file: File; error: Error }[] = [];

    try {
      // Calculate total batches for logging
      const totalBatches = Math.ceil(files.length / batchSize);
      
      // Process files in batches
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const currentBatch = Math.floor(i / batchSize) + 1;
        
        moduleLogger.debug(`Processing batch ${currentBatch} of ${totalBatches}`, {
          batchSize: batch.length,
          startIndex: i,
          endIndex: Math.min(i + batchSize - 1, files.length - 1)
        });

        // Process each file in the batch in parallel with explicit typing
        const results: PromiseSettledResult<ExtractedDocument>[] = await Promise.allSettled(
          batch.map((file) =>
            this.processDocument(file, {
              ...options,
              patientId,
            })
          )
        );

        // Collect results with explicit type checking
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            // Validate the result before adding to successful array
            const document = result.value;
            if (this.isValidExtractedDocument(document)) {
              successful.push(document);
            } else {
              // If document is invalid, treat as failure
              failed.push({ 
                file: batch[index], 
                error: new Error('Document processing returned invalid format') 
              });
            }
          } else {
            // For rejected promises, ensure we have a proper Error object
            const error = result.reason instanceof Error 
              ? result.reason 
              : new Error(String(result.reason));
            
            failed.push({ file: batch[index], error });
          }
        });
        
        moduleLogger.info(`Completed batch ${currentBatch} of ${totalBatches}`, {
          batchSuccessCount: results.filter(r => r.status === 'fulfilled').length,
          batchFailureCount: results.filter(r => r.status === 'rejected').length
        });
      }

      // Log final results
      moduleLogger.info('Batch processing completed', {
        totalFiles: files.length,
        successCount: successful.length,
        failureCount: failed.length,
        successRate: `${(successful.length / files.length * 100).toFixed(1)}%`
      });
      
      return { successful, failed };
    } catch (error) {
      moduleLogger.error('Unexpected error in batch processing', {}, error);
      
      // Normalize the error for consistent handling
      if (!(error instanceof ApplicationError)) {
        throw new SystemError({
          message: `Batch processing failed: ${error instanceof Error ? error.message : String(error)}`,
          code: 'BATCH_PROCESSING_FAILED',
          data: { fileCount: files.length, patientId },
          cause: error
        });
      }
      
      // Rethrow if it's already an ApplicationError
      throw error;
    }
  }

  /**
   * Process a document with extraction and analysis
   *
   * @param file Document file to process
   * @param options Document processing options
   * @returns ExtractedDocument with processing results
   * @throws {ValidationError} If file type or size is invalid
   * @throws {SystemError} If there's a system-level error
   */
  async processDocument(
    file: File,
    options?: DocumentProcessingOptions
  ): Promise<ExtractedDocument> {
    if (!file) {
      throw new ValidationError({
        message: 'File is required',
        code: 'MISSING_FILE'
      });
    }
    
    // Provide default status callback if none supplied
    const onStatusUpdate = options?.onStatusUpdate ?? (() => {});
    
    // Initialize processing status
    const initialStatus: ProcessingStatus = {
      status: 'processing',
      progress: 0,
      currentStep: 'Starting document processing',
      phase: 'initialization',
    };
    onStatusUpdate(initialStatus);

    // Create logger for this operation
    const moduleLogger = logger.withMetadata({
      module: 'DocumentService',
      method: 'processDocument',
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      patientId: options?.patientId,
    });

    try {
      moduleLogger.info('Starting document processing');

      // Validate file type and size with type predicates
      if (!(await this.validateFileType(file))) {
        throw new ValidationError({
          message: `Unsupported file type: ${file.type}`,
          code: 'UNSUPPORTED_FILE_TYPE',
          data: { fileType: file.type },
        });
      }

      if (!(await this.validateFileSize(file))) {
        throw new ValidationError({
          message: `File size exceeds maximum allowed size of ${this.maxFileSize / (1024 * 1024)}MB`,
          code: 'FILE_TOO_LARGE',
          data: { fileSize: file.size, maxSize: this.maxFileSize },
        });
      }

      // Extract text with enhanced options
      const extractionStatus: ProcessingStatus = {
        status: 'processing',
        progress: 10,
        currentStep: 'Extracting text from document',
        phase: 'extraction',
      };
      onStatusUpdate(extractionStatus);

      // Determine extraction level based on options or file type
      const extractionLevel: 'basic' | 'enhanced' | 'comprehensive' =
        options?.extractionLevel || this.getExtractionLevelForFile(file);

      // Configure extraction options based on extraction level
      const extractionOptions: EnhancedExtractionOptions = {
        ...this.defaultExtractionOptions,
        splitPages: extractionLevel !== 'basic',
        extractTables: extractionLevel !== 'basic',
        detectSections: extractionLevel !== 'basic',
        ocrImages: extractionLevel === 'comprehensive',
        preserveLayout: extractionLevel === 'comprehensive',
      };

      // Use extraction service to extract text
      const extractedData = await extractionService.extractText(file, extractionOptions);

      // Update progress with explicit typing
      const analysisStatus: ProcessingStatus = {
        status: 'processing',
        progress: 50,
        currentStep: 'Analyzing document content',
        phase: 'analysis',
      };
      onStatusUpdate(analysisStatus);

      // Document type detection using analysis service
      const detectionResult = options?.documentType
        ? { type: options.documentType, confidence: 1.0 }
        : await analysisService.detectDocumentType(extractedData.rawText);

      // Add detected sections to metadata if available
      if (
        detectionResult.detectedSections &&
        Array.isArray(detectionResult.detectedSections) &&
        detectionResult.detectedSections.length > 0
      ) {
        extractedData.metadata.detectedSections = detectionResult.detectedSections;
      }

      // Add document type confidence to metadata
      extractedData.metadata.documentTypeConfidence = detectionResult.confidence;

      // Construct final extracted document with explicit typing for all properties
      const documentId: UUID = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      
      const extractedDocument: ExtractedDocument = {
        id: documentId,
        createdAt: timestamp,
        updatedAt: timestamp,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        documentType: detectionResult.type,
        patientId: options?.patientId,
        extractedData: extractedData,
        isProcessed: true,
        processingStatus: 'completed',
        lifecycleStage: 'EXTRACTED'
      };

      // Validate the constructed document
      if (!this.isValidExtractedDocument(extractedDocument)) {
        throw new SystemError({
          message: 'Failed to create valid document from extraction result',
          code: 'INVALID_EXTRACTION_RESULT',
          data: { 
            validationErrors: this.getDocumentValidationErrors(extractedDocument)
          }
        });
      }

      // Store document in database if patient ID provided
      if (options?.patientId) {
        try {
          const dbId = await storageService.saveDocument(
            extractedDocument,
            options.departmentId
          );

          // Update with database ID if different
          if (dbId !== documentId) {
            extractedDocument.id = dbId;
          }
        } catch (saveError) {
          moduleLogger.warn(
            'Document extracted but failed to save to database',
            { saveError: saveError instanceof Error ? saveError.message : String(saveError) }
          );
          // Continue with the extracted document even if saving failed
        }
      }

      // Final success status
      const completionStatus: ProcessingStatus = {
        status: 'success',
        progress: 100,
        currentStep: 'Document extraction completed',
        phase: 'extraction',
      };
      onStatusUpdate(completionStatus);

      return extractedDocument;
    } catch (error) {
      // Enhanced error handling with structured logging
      const normalizedError = normalizeError(error);
      
      moduleLogger.error('Error processing document', {
        errorCode: normalizedError.code,
        errorMessage: normalizedError.message
      }, normalizedError);

      // Update status for the caller with explicit typing
      const errorStatus: ProcessingStatus = {
        status: 'error',
        progress: 0,
        error: normalizedError.message,
        phase: 'extraction',
      };
      onStatusUpdate(errorStatus);

      // Return an error-labeled extracted document with explicit typing
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorCode =
        error instanceof ApplicationError ? error.code : 'PROCESSING_ERROR';
      const errorId: UUID = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      return {
        id: errorId,
        createdAt: timestamp,
        updatedAt: timestamp,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        documentType: options?.documentType || {
          category: 'unknown',
          type: 'unknown',
        },
        patientId: options?.patientId,
        extractedData: {
          rawText: '',
          metadata: {
            extractedAt: new Date(),
            error: errorMessage,
            errorCode,
          },
        },
        isProcessed: false,
        processingError: errorMessage,
        processingStatus: 'failed',
        lifecycleStage: 'FAILED'
      };
    }
  }

  /**
   * Get extraction level for a file based on its type
   *
   * @param file File to get extraction level for
   * @returns Extraction level
   */
  private getExtractionLevelForFile(
    file: File
  ): 'basic' | 'enhanced' | 'comprehensive' {
    const fileType = this.supportedTypes.find(
      (type) => type.mimeType === file.type
    )

    if (!fileType) {
      return 'basic' // Default to basic for unknown types
    }

    return fileType.extractionLevel as 'basic' | 'enhanced' | 'comprehensive'
  }

  /**
   * Save document to database with improved metadata handling
   *
   * @param extractedDocument Extracted document
   * @param departmentId Optional department ID
   * @returns Saved document ID
   * @throws {ValidationError} If the document is invalid
   * @throws {SystemError} If there's a database error
   */
  async saveDocument(
    extractedDocument: ExtractedDocument,
    departmentId?: string
  ): Promise<UUID> {
    const moduleLogger = logger.withMetadata({
      module: 'DocumentService',
      method: 'saveDocument',
      documentId: extractedDocument.id,
      patientId: extractedDocument.patientId,
    });
    
    try {
      // Validate the document with type assertion guard before saving
      if (!this.isValidExtractedDocument(extractedDocument)) {
        throw new ValidationError({
          message: 'Invalid document format',
          code: 'INVALID_DOCUMENT',
          data: { 
            documentId: extractedDocument.id,
            validationErrors: this.getDocumentValidationErrors(extractedDocument)
          }
        });
      }
      
      // First convert from application model to DB model
      const dbDocument = extractedDocumentToDb(extractedDocument);
      
      // Add departmentId if provided
      if (departmentId) {
        dbDocument.department_id = departmentId;
      }
      
      // Forward to the specialized storage service
      const documentId = await storageService.saveDocument(dbDocument, departmentId);
      moduleLogger.info('Document saved successfully', { documentId });
      
      return documentId;
    } catch (error) {
      moduleLogger.error('Failed to save document to database', {}, error);

      // Normalize the error for consistent handling
      if (!(error instanceof ApplicationError)) {
        throw new SystemError({
          message: `Failed to save document: ${error instanceof Error ? error.message : String(error)}`,
          code: 'DOCUMENT_SAVE_FAILED',
          data: { documentId: extractedDocument.id },
          cause: error
        });
      }
      
      // Rethrow if it's already an ApplicationError
      throw error;
    }
  }
  
  /**
   * Validate if an extracted document is valid
   * @param document The document to validate
   * @returns True if the document is valid
   */
  private isValidExtractedDocument(document: unknown): document is ExtractedDocument {
    if (!document || typeof document !== 'object') return false;
    
    const doc = document as Record<string, unknown>;
    
    // Check required fields
    const hasValidId = typeof doc.id === 'string';
    const hasValidCreatedAt = doc.createdAt instanceof Date || 
      (typeof doc.createdAt === 'string' && !isNaN(Date.parse(doc.createdAt as string)));
    const hasValidFileName = typeof doc.fileName === 'string';
    const hasValidFileSize = typeof doc.fileSize === 'number' && (doc.fileSize as number) >= 0;
    const hasValidFileType = typeof doc.fileType === 'string';
    
    // Check document type
    const hasValidDocumentType = typeof doc.documentType === 'object' && doc.documentType !== null &&
      typeof (doc.documentType as {category?: unknown, type?: unknown}).category === 'string' &&
      typeof (doc.documentType as {category?: unknown, type?: unknown}).type === 'string';
    
    // Check extracted data
    const hasValidExtractedData = typeof doc.extractedData === 'object' && doc.extractedData !== null &&
      typeof (doc.extractedData as {rawText?: unknown}).rawText === 'string' &&
      typeof (doc.extractedData as {metadata?: unknown}).metadata === 'object';
    
    // Check processing status fields
    const hasValidProcessingStatus = typeof doc.processingStatus === 'string';
    const hasValidIsProcessed = typeof doc.isProcessed === 'boolean';
    
    return (
      hasValidId &&
      hasValidCreatedAt &&
      hasValidFileName &&
      hasValidFileSize &&
      hasValidFileType &&
      hasValidDocumentType &&
      hasValidExtractedData &&
      hasValidProcessingStatus &&
      hasValidIsProcessed
    );
  }
  
  /**
   * Get validation errors for an invalid extracted document
   * @param document The document to validate
   * @returns Object mapping fields to error messages
   */
  private getDocumentValidationErrors(document: unknown): Record<string, string> {
    if (!document || typeof document !== 'object') {
      return { document: 'Document must be an object' };
    }
    
    const doc = document as Record<string, unknown>;
    const errors: Record<string, string> = {};
    
    // Check required fields
    if (typeof doc.id !== 'string') {
      errors.id = 'Document ID must be a string';
    }
    
    if (!(doc.createdAt instanceof Date) && 
        !(typeof doc.createdAt === 'string' && !isNaN(Date.parse(doc.createdAt as string)))) {
      errors.createdAt = 'Created date must be a valid date';
    }
    
    if (typeof doc.fileName !== 'string') {
      errors.fileName = 'File name must be a string';
    }
    
    if (typeof doc.fileSize !== 'number' || (doc.fileSize as number) < 0) {
      errors.fileSize = 'File size must be a non-negative number';
    }
    
    if (typeof doc.fileType !== 'string') {
      errors.fileType = 'File type must be a string';
    }
    
    // Check document type
    if (typeof doc.documentType !== 'object' || doc.documentType === null) {
      errors.documentType = 'Document type must be an object';
    } else {
      const documentType = doc.documentType as {category?: unknown, type?: unknown};
      if (typeof documentType.category !== 'string') {
        errors['documentType.category'] = 'Document category must be a string';
      }
      if (typeof documentType.type !== 'string') {
        errors['documentType.type'] = 'Document type must be a string';
      }
    }
    
    // Check extracted data
    if (typeof doc.extractedData !== 'object' || doc.extractedData === null) {
      errors.extractedData = 'Extracted data must be an object';
    } else {
      const extractedData = doc.extractedData as {rawText?: unknown, metadata?: unknown};
      if (typeof extractedData.rawText !== 'string') {
        errors['extractedData.rawText'] = 'Raw text must be a string';
      }
      if (typeof extractedData.metadata !== 'object') {
        errors['extractedData.metadata'] = 'Metadata must be an object';
      }
    }
    
    // Check processing status fields
    if (typeof doc.processingStatus !== 'string') {
      errors.processingStatus = 'Processing status must be a string';
    }
    
    if (typeof doc.isProcessed !== 'boolean') {
      errors.isProcessed = 'isProcessed must be a boolean';
    }
    
    return errors;
  }

  /**
   * Generate a brief content summary for document listing
   *
   * @param text Document text
   * @returns Brief summary
   */
  private generateContentSummary(text: string): string {
    if (!text) return ''

    // Extract the first few sentences (max 200 chars)
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)

    if (sentences.length === 0) {
      return 'Empty document'
    }

    // Take up to 3 sentences
    let summary = sentences.slice(0, 3).join('. ').trim()

    // Truncate if too long
    if (summary.length > 200) {
      summary = `${summary.substring(0, 197)}...`
    }

    return summary
  }

  /**
   * Upload a document to storage and prepare for processing
   *
   * @param patientId Patient ID for the document
   * @param file File to upload
   * @param options Upload options with document type and callbacks
   * @returns Upload result with document ID and status
   * @throws {ValidationError} If input parameters are invalid
   * @throws {SystemError} If there's a system-level upload error
   */
  async uploadDocument(
    patientId: UUID,
    file: File,
    options: {
      documentType: DocumentType;
      departmentId?: UUID;
      priority?: 'low' | 'normal' | 'high';
      tags?: string[];
      onStatusUpdate?: (status: ProcessingStatus) => void;
    }
  ): Promise<UploadDocumentResult> {
    // Create logger for this operation
    const moduleLogger = logger.withMetadata({
      module: 'DocumentService',
      method: 'uploadDocument',
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      patientId
    });
    
    // Validate inputs using type predicates
    if (!patientId || typeof patientId !== 'string') {
      throw new ValidationError({
        message: 'Valid patient ID is required',
        code: 'INVALID_PATIENT_ID',
        data: { patientId }
      });
    }
    
    if (!file || !(file instanceof File)) {
      throw new ValidationError({
        message: 'Valid file is required',
        code: 'INVALID_FILE',
        data: { fileName: file?.name }
      });
    }
    
    if (!options || !options.documentType || !this.isValidDocumentType(options.documentType)) {
      throw new ValidationError({
        message: 'Valid document type is required',
        code: 'MISSING_DOCUMENT_TYPE',
        data: { 
          fileName: file.name, 
          patientId,
          documentType: options?.documentType 
        }
      });
    }
    
    // Convert progress callback format to match upload service
    const progressHandler = options.onStatusUpdate 
      ? (progress: number, status: string) => {
          options.onStatusUpdate?.({
            status: progress === 100 ? 'success' : 'processing',
            progress,
            currentStep: status,
            phase: progress < 50 ? 'uploading' : 'extraction'
          });
        }
      : undefined;
      
    try {
      moduleLogger.info('Starting document upload', {
        documentType: `${options.documentType.category}/${options.documentType.type}`
      });
      
      // Call the upload service's patient document upload with explicit type assertions
      const uploadResult = await uploadService.uploadPatientDocument(
        file,
        patientId,
        options.documentType,
        options.departmentId,
        progressHandler
      );
      
      if (!uploadResult || !uploadResult.id) {
        throw new SystemError({
          message: 'Upload service returned invalid result',
          code: 'INVALID_UPLOAD_RESULT',
          data: { fileName: file.name }
        });
      }
      
      moduleLogger.info('Document upload completed successfully', { 
        documentId: uploadResult.id 
      });
      
      // Return a properly typed UploadDocumentResult
      const result: UploadDocumentResult = {
        documentId: uploadResult.id,
        fileName: file.name,
        extractionStatus: 'uploaded'
      };
      
      return result;
    } catch (error) {
      moduleLogger.error('Document upload failed', {}, error);
      
      // Update status for the caller with explicit typing
      if (options.onStatusUpdate) {
        const errorStatus: ProcessingStatus = {
          status: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : String(error),
          phase: 'uploading'
        };
        options.onStatusUpdate(errorStatus);
      }
      
      // Normalize the error for consistent handling
      if (!(error instanceof ApplicationError)) {
        throw new SystemError({
          message: `Document upload failed: ${error instanceof Error ? error.message : String(error)}`,
          code: 'UPLOAD_FAILED',
          data: { fileName: file.name, patientId },
          cause: error
        });
      }
      
      // Rethrow if it's already an ApplicationError
      throw error;
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
    
    return (
      typeof obj.category === 'string' && 
      typeof obj.type === 'string'
    );
  }

  /**
   * Retry extraction for a failed document
   *
   * @param documentId Document ID to retry
   * @param options Retry options
   * @returns Extraction result
   */
  async retryExtraction(
    documentId: string,
    options?: {
      forceReExtract?: boolean
      extractionLevel?: 'basic' | 'enhanced' | 'comprehensive'
    }
  ): Promise<{
    success: boolean
    documentId: string
  }> {
    try {
      // Fetch the document record
      const { data: dbDocument, error: docError } = await this.supabase
        .from('patient_documents')
        .select('*')
        .eq('id', documentId)
        .single()

      if (docError || !dbDocument) {
        throw new DocumentServiceError(
          `Document not found: ${docError?.message || 'Unknown error'}`,
          'DOCUMENT_NOT_FOUND',
          false,
          { documentId }
        )
      }
      
      // Convert to application model for consistent property access
      const document = documentFromDb(dbDocument);

      // Get storage path
      const storagePath = dbDocument.file_path

      if (!storagePath) {
        throw new DocumentServiceError(
          'Document has no storage path',
          'MISSING_STORAGE_PATH',
          false,
          { documentId }
        )
      }

      // Create a signed URL
      const { data: urlData, error: urlError } = await this.supabase.storage
        .from('documents')
        .createSignedUrl(storagePath, 60 * 60)

      if (urlError || !urlData?.signedUrl) {
        throw new DocumentServiceError(
          `Failed to generate signed URL: ${urlError?.message || 'Unknown error'}`,
          'SIGNED_URL_ERROR',
          true,
          { urlError }
        )
      }

      // Update the document status with safe metadata handling
      await this.supabase
        .from('patient_documents')
        .update({
          processing_status: 'processing',
          metadata: getDbCompatibleMetadata({
            ...(document.metadata && typeof document.metadata === 'object'
              ? document.metadata
              : {}),
            reprocessing: true,
            reprocessingTime: new Date().toISOString(),
            extractionLevel: options?.extractionLevel || 'comprehensive',
          }) as Json,
        })
        .eq('id', documentId)

      // Invoke the extraction function
      await this.supabase.functions.invoke('document-extraction', {
        body: {
          documentId,
          fileUrl: urlData.signedUrl,
          fileName: document.fileName || dbDocument.title || 'unknown',
          fileType: document.fileType || dbDocument.file_type,
          options: {
            documentType: document.documentType || dbDocument.document_type,
            departmentId: document.departmentId || dbDocument.department_id,
            forceReExtract: options?.forceReExtract || true,
            extractionLevel: options?.extractionLevel || 'comprehensive',
          },
        },
      })

      return {
        success: true,
        documentId,
      }
    } catch (error) {
      console.error('Error retrying extraction:', error)

      throw error instanceof DocumentServiceError
        ? error
        : new DocumentServiceError(
            `Failed to retry extraction: ${error instanceof Error ? error.message : String(error)}`,
            'RETRY_FAILED',
            false,
            { documentId, originalError: error }
          )
    }
  }

  /**
   * Validates file type against supported types
   *
   * @param file The file to validate
   * @returns Whether the file type is supported
   */
  private async validateFileType(file: File): Promise<boolean> {
    return this.supportedTypes.some((type) => type.mimeType === file.type)
  }

  /**
   * Validates file size against maximum supported size
   *
   * @param file The file to validate
   * @returns Whether the file size is within limits
   */
  private async validateFileSize(file: File): Promise<boolean> {
    return file.size <= this.maxFileSize
  }
}

// Export singleton instance
export const documentService = new DocumentService()
