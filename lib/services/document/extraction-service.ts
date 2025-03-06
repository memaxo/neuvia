/**
 * Document Extraction Service
 * 
 * Responsible for extracting text and content from various document formats
 * using specialized strategies for each format type.
 */

import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { Document } from 'langchain/document'
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx'
import { WebPDFLoader } from '@langchain/community/document_loaders/web/pdf'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import * as pdfjsLib from 'pdfjs-dist'
import logger from '@/lib/logger'
import { normalizeError, ValidationError, SystemError, ApplicationError } from '@/lib/errors'

import type { 
  DocumentType, 
  ExtractedData, 
  ProcessingStatus,
} from '@/lib/types/document'

/**
 * Enhanced extraction options
 */
export interface EnhancedExtractionOptions {
  splitPages?: boolean
  extractTables?: boolean
  detectSections?: boolean
  ocrImages?: boolean
  preserveLayout?: boolean
  maxPageLength?: number
}

/**
 * Chunking options
 */
export interface ChunkingOptions {
  chunkSize: number
  chunkOverlap: number
  preserveMetadata: boolean
  strategy: 'size' | 'semantic' | 'section'
}

/**
 * Custom error class for extraction errors
 */
class ExtractionError extends ApplicationError {
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
 * Service for handling document content extraction
 */
export class DocumentExtractionService {
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
   * Main method to extract text from a document file
   * 
   * @param file File to extract text from
   * @param options Extraction options
   * @returns Extracted text data
   */
  async extractText(
    file: File,
    options: EnhancedExtractionOptions = this.defaultExtractionOptions
  ): Promise<ExtractedData> {
    try {
      const fileType = file.type
      let rawText = ''
      const chunks: {
        content: string
        pageNumber?: number
        metadata?: Record<string, any>
      }[] = []
      const metadata: Record<string, any> = {
        filename: file.name,
        fileFormat: file.type,
        fileSize: file.size,
        extractedAt: new Date(),
      }

      // Create a blob from the file for processing
      const blob = new Blob([await file.arrayBuffer()], { type: fileType })

      // Determine appropriate extraction method
      switch (fileType) {
        case 'application/pdf': {
          // Enhanced PDF extraction with page splitting and table detection
          const result = await this.extractPdfWithEnhancement(blob, options)
          rawText = result.text
          chunks.push(...result.chunks)

          // Add PDF-specific metadata
          metadata.pageCount = result.pageCount
          metadata.hasImages = result.hasImages
          metadata.hasTables = result.hasTables
          metadata.detectedSections = result.detectedSections
          metadata.textQuality = result.textQuality
          break
        }

        case 'text/plain': {
          // Simple text extraction
          const textContent = await file.text()

          // Process the text to detect sections
          const processedText = await this.processTextDocument(
            textContent,
            options
          )
          rawText = processedText.text
          chunks.push(...processedText.chunks)

          // Add text-specific metadata
          metadata.lineCount = textContent.split('\n').length
          metadata.detectedSections = processedText.detectedSections
          break
        }

        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
          // Enhanced Word document extraction
          const result = await this.extractWordDocument(blob, options)
          rawText = result.text
          chunks.push(...result.chunks)

          // Add Word-specific metadata
          metadata.pageCount = result.pageCount
          metadata.hasTables = result.hasTables
          metadata.detectedSections = result.detectedSections
          break
        }

        case 'image/jpeg':
        case 'image/png': {
          // Process images with OCR if enabled
          if (options.ocrImages) {
            const result = await this.performOcrOnImage(blob)
            rawText = result.text

            // Add image-specific metadata
            metadata.imageWidth = result.width
            metadata.imageHeight = result.height
            metadata.ocrConfidence = result.confidence
          } else {
            throw new ValidationError({
              message: 'OCR is required for image processing but is disabled',
              code: 'OCR_DISABLED',
              data: { fileType },
            })
          }
          break
        }

        default:
          throw new ValidationError({
            message: `Unsupported file type: ${fileType}`,
            code: 'UNSUPPORTED_FILE_TYPE',
            data: { fileType },
          })
      }

      // Create the extracted data object
      const extractedData: ExtractedData = {
        rawText,
        metadata,
        chunks: chunks.length > 0 ? chunks : undefined,
      }

      return extractedData
    } catch (error) {
      // Enhanced error handling with structured logging
      const moduleLogger = logger.withMetadata({
        module: 'DocumentExtractionService',
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
    // Use LangChain's WebPDFLoader to load PDF pages
    const loader = new WebPDFLoader(blob);
    const docs = await loader.load(); // Each Document represents a PDF page
    const pageCount = docs.length;
    let fullText = '';
    const chunks: Array<{ content: string; pageNumber: number; metadata?: any }> = [];
    let detectedSections: string[] = [];
    let hasImages = false; // WebPDFLoader does not extract images, so default is false
    let hasTables = false;
  
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const pageText = doc.pageContent;
      fullText += pageText + "\n\n";
  
      // Detect sections in the page using our custom logic
      const pageSections = this.detectSectionsInText(pageText);
      detectedSections = detectedSections.concat(pageSections);
  
      // Simple table detection using regex on the page text
      if (/\b(table|row)\b/i.test(pageText)) {
        hasTables = true;
      }
  
      // Create a chunk for the page
      chunks.push({
        content: pageText,
        pageNumber: i + 1,
        metadata: { sections: pageSections }
      });
  
      // Additional semantic chunking if pageText is too long
      if (options.splitPages && pageText.length > (options.maxPageLength || 5000)) {
        const pageChunks = await this.createSemanticChunks(pageText, {
          ...this.defaultChunkingOptions,
          chunkSize: options.maxPageLength || 5000,
        });
        pageChunks.forEach((chunk, index) => {
          chunks.push({
            content: chunk.pageContent,
            pageNumber: i + 1,
            metadata: { ...chunk.metadata, chunkIndex: index }
          });
        });
      }
    }
  
    fullText = fullText.trim();
    detectedSections = Array.from(new Set(detectedSections));
  
    const charCount = fullText.replace(/\s+/g, '').length;
    const nonAlphaCount = fullText.replace(/[a-zA-Z0-9\s]/g, '').length;
    const nonAlphaRatio = charCount > 0 ? nonAlphaCount / charCount : 0;
    const textQuality = Math.max(0.1, 1.0 - (nonAlphaRatio > 0.3 ? 0.5 : 0));
  
    return {
      text: fullText,
      chunks,
      pageCount,
      hasImages,
      hasTables,
      detectedSections,
      textQuality,
    };
  }

  /**
   * Detect tables in PDF page by analyzing text positioning
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
   * Process multiple documents in parallel
   */
  async processDocuments(
    files: File[],
    options?: EnhancedExtractionOptions
  ): Promise<ExtractedData[]> {
    if (!files || files.length === 0) {
      return []
    }

    try {
      // Process files in parallel with a concurrency limit
      const concurrencyLimit = 3
      const results: ExtractedData[] = []
      
      // Process in batches to limit concurrency
      for (let i = 0; i < files.length; i += concurrencyLimit) {
        const batch = files.slice(i, i + concurrencyLimit)
        const batchPromises = batch.map(file => this.extractText(file, options))
        
        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
      }
      
      return results
    } catch (error) {
      // Log error
      const moduleLogger = logger.withMetadata({
        module: 'DocumentExtractionService',
        method: 'processDocuments',
        fileCount: files.length,
      })
      
      moduleLogger.error('Failed to process documents batch', {}, error)
      
      // Rethrow normalized error
      throw normalizeError(error)
    }
  }
}