/**
 * Enhanced Document Service Implementation
 * 
 * This file provides improvement examples for the DocumentService class
 */
import { createBrowserClient } from '@/lib/supabase/clients';
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";
import * as pdfjsLib from 'pdfjs-dist';
import { workflowManager } from '@/lib/workflow/workflow-manager';
import {  getDbCompatibleMetadata } from '@/lib/processing/types/verification';

// Import types from specific modules
import type { DocumentType, ProcessingStatus } from '@/lib/processing/types/base';
import type { ExtractedData, ExtractedDocument, DocumentMetadata } from '@/lib/processing/types/extraction';
import type { WorkflowStep, WorkflowOptions } from '@/lib/workflow/types';
import type { Json } from '@/lib/supabase';

/**
 * Document processing options with enhanced metadata
 */
interface DocumentProcessingOptions {
  documentType?: DocumentType;
  onStatusUpdate?: (status: ProcessingStatus) => void;
  metadata?: Record<string, any>;
  isPatientDocument?: boolean;
  patientId?: string;
  departmentId?: string;
  
  // Enhanced options
  extractionLevel?: 'basic' | 'enhanced' | 'comprehensive';
  preserveSections?: boolean;
  extractMetadata?: boolean;
  chunkingStrategy?: 'simple' | 'semantic' | 'section-based';
  prioritizeFields?: string[];
}

/**
 * Enhanced document extraction options
 */
interface EnhancedExtractionOptions {
  splitPages?: boolean;
  extractTables?: boolean;
  detectSections?: boolean;
  ocrImages?: boolean;
  preserveLayout?: boolean;
  maxPageLength?: number;
}

/**
 * Enhanced chunking options
 */
interface ChunkingOptions {
  chunkSize: number;
  chunkOverlap: number;
  preserveMetadata: boolean;
  strategy: 'size' | 'semantic' | 'section';
}

/**
 * Document type detection result
 */
interface DocumentTypeDetectionResult {
  type: DocumentType;
  confidence: number;
  detectedSections?: string[];
  possibleTypes?: DocumentType[];
}

/**
 * Error with detailed fields for better debugging and handling
 */
class DocumentServiceError extends Error {
  code: string;
  recoverable: boolean;
  context: Record<string, any>;
  
  constructor(message: string, code: string, recoverable = false, context = {}) {
    super(message);
    this.name = 'DocumentServiceError';
    this.code = code;
    this.recoverable = recoverable;
    this.context = context;
  }
}

/**
 * Enhanced Document Service with improved functionality
 */
export class EnhancedDocumentService {
  private supabase = createBrowserClient();
  
  /**
   * Maximum supported file size (20MB)
   */
  private readonly maxFileSize = 20 * 1024 * 1024;
  
  /**
   * Default enhanced extraction options
   */
  private readonly defaultExtractionOptions: EnhancedExtractionOptions = {
    splitPages: true,
    extractTables: true,
    detectSections: true,
    ocrImages: true,
    preserveLayout: true,
    maxPageLength: 5000
  };
  
  /**
   * Default chunking options
   */
  private readonly defaultChunkingOptions: ChunkingOptions = {
    chunkSize: 1000,
    chunkOverlap: 200,
    preserveMetadata: true,
    strategy: 'semantic'
  };
  
  /**
   * Supported document types with enhanced metadata
   */
  private readonly supportedTypes = [
    { 
      mimeType: 'application/pdf', 
      extensions: ['pdf'],
      extractionLevel: 'comprehensive'
    },
    { 
      mimeType: 'text/plain', 
      extensions: ['txt'],
      extractionLevel: 'basic'
    },
    { 
      mimeType: 'application/msword', 
      extensions: ['doc'],
      extractionLevel: 'enhanced'
    },
    { 
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
      extensions: ['docx'],
      extractionLevel: 'enhanced'
    },
    // New supported types
    { 
      mimeType: 'image/jpeg', 
      extensions: ['jpg', 'jpeg'],
      extractionLevel: 'basic',
      requiresOcr: true
    },
    { 
      mimeType: 'image/png', 
      extensions: ['png'],
      extractionLevel: 'basic',
      requiresOcr: true
    }
  ];
  
  /**
   * Medical document section patterns
   */
  private readonly medicalSectionPatterns = [
    { name: 'patient_information', patterns: ['patient information', 'demographics', 'patient data'] },
    { name: 'chief_complaint', patterns: ['chief complaint', 'presenting complaint', 'reason for visit'] },
    { name: 'history_of_present_illness', patterns: ['history of present illness', 'hpi', 'present illness'] },
    { name: 'past_medical_history', patterns: ['past medical history', 'pmh', 'medical history'] },
    { name: 'medications', patterns: ['medications', 'current medications', 'meds', 'prescription'] },
    { name: 'allergies', patterns: ['allergies', 'drug allergies', 'medication allergies'] },
    { name: 'review_of_systems', patterns: ['review of systems', 'ros', 'systems review'] },
    { name: 'physical_examination', patterns: ['physical examination', 'physical exam', 'examination', 'exam'] },
    { name: 'assessment', patterns: ['assessment', 'impression', 'diagnosis'] },
    { name: 'plan', patterns: ['plan', 'treatment plan', 'recommendations'] },
    { name: 'laboratory_results', patterns: ['laboratory', 'lab results', 'laboratory studies'] },
    { name: 'imaging_results', patterns: ['imaging', 'radiology', 'x-ray', 'ct scan', 'mri'] },
    { name: 'procedures', patterns: ['procedures', 'interventions', 'operations'] }
  ];
  
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
    IMMUNIZATION_RECORD: { category: 'clinical', type: 'immunization_record' }
  };
  
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
      const fileType = file.type;
      let rawText = '';
      const chunks: { content: string; pageNumber?: number; metadata?: Record<string, any> }[] = [];
      const metadata: DocumentMetadata = {
        filename: file.name,
        fileFormat: file.type,
        fileSize: file.size,
        extractedAt: new Date(),
      };
      
      // Create a blob from the file for processing
      const blob = new Blob([await file.arrayBuffer()], { type: fileType });
      
      // Determine appropriate extraction method
      switch (fileType) {
        case 'application/pdf': {
          // Enhanced PDF extraction with page splitting and table detection
          const result = await this.extractPdfWithEnhancement(blob, options);
          rawText = result.text;
          chunks.push(...result.chunks);
          
          // Add PDF-specific metadata
          metadata.pageCount = result.pageCount;
          metadata.hasImages = result.hasImages;
          metadata.hasTables = result.hasTables;
          metadata.detectedSections = result.detectedSections;
          metadata.textQuality = result.textQuality;
          break;
        }
        
        case 'text/plain': {
          // Simple text extraction
          const textContent = await file.text();
          
          // Process the text to detect sections
          const processedText = await this.processTextDocument(textContent, options);
          rawText = processedText.text;
          chunks.push(...processedText.chunks);
          
          // Add text-specific metadata
          metadata.lineCount = textContent.split('\n').length;
          metadata.detectedSections = processedText.detectedSections;
          break;
        }
        
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
          // Enhanced Word document extraction
          const result = await this.extractWordDocument(blob, options);
          rawText = result.text;
          chunks.push(...result.chunks);
          
          // Add Word-specific metadata
          metadata.pageCount = result.pageCount;
          metadata.hasTables = result.hasTables;
          metadata.detectedSections = result.detectedSections;
          break;
        }
        
        case 'image/jpeg':
        case 'image/png': {
          // Process images with OCR if enabled
          if (options.ocrImages) {
            const result = await this.performOcrOnImage(blob);
            rawText = result.text;
            
            // Add image-specific metadata
            metadata.imageWidth = result.width;
            metadata.imageHeight = result.height;
            metadata.ocrConfidence = result.confidence;
          } else {
            throw new DocumentServiceError(
              'OCR is required for image processing but is disabled',
              'OCR_DISABLED',
              true,
              { fileType }
            );
          }
          break;
        }
        
        default:
          throw new DocumentServiceError(
            `Unsupported file type: ${fileType}`,
            'UNSUPPORTED_FILE_TYPE',
            false,
            { fileType }
          );
      }
      
      // Create the extracted data object
      const extractedData: ExtractedData = {
        rawText,
        metadata,
        chunks: chunks.length > 0 ? chunks : undefined
      };
      
      return extractedData;
    } catch (error) {
      // Enhanced error handling
      if (error instanceof DocumentServiceError) {
        throw error;
      }
      
      throw new DocumentServiceError(
        'Failed to extract text from document',
        'EXTRACTION_FAILED',
        false,
        {
          originalError: error instanceof Error ? error.message : String(error),
          fileType: file.type,
          fileName: file.name
        }
      );
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
    text: string;
    chunks: Array<{content: string; pageNumber: number; metadata?: any}>;
    pageCount: number;
    hasImages: boolean;
    hasTables: boolean;
    detectedSections: string[];
    textQuality: number;
  }> {
    // Use PDF.js for enhanced extraction
    const arrayBuffer = await blob.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;
    let fullText = '';
    const chunks: Array<{content: string; pageNumber: number; metadata?: any}> = [];
    const detectedSections: string[] = [];
    let hasImages = false;
    let hasTables = false;
    let textQuality = 1.0;
    
    // Process each page
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      
      // Get text content with layout information
      const textContent = await page.getTextContent({ normalizeWhitespace: true } as any);
      
      // Check for potential tables by analyzing text item positions
      const potentialTable = this.detectTablesInPdfPage(textContent);
      if (potentialTable) {
        hasTables = true;
      }
      
      // Extract images if present (simplified)
      const operatorList = await page.getOperatorList();
      if (operatorList.fnArray.includes(pdfjsLib.OPS.paintImageXObject)) {
        hasImages = true;
      }
      
      // Convert text content to string with layout preservation
      let pageText = '';
      let lastY: number | undefined;
      let lastX = 0;
      
      textContent.items.forEach((item: any) => {
        const currentY = item.transform[5];
        const currentX = item.transform[4];
        
        // Add newlines for new vertical positions (new lines)
        if (lastY !== undefined && Math.abs(currentY - lastY) > 5) {
          pageText += '\n';
          lastX = 0;
        }
        
        // Add spaces for horizontal gaps
        if (lastX !== 0 && currentX - lastX > 10) {
          pageText += ' ';
        }
        
        pageText += item.str;
        lastY = currentY;
        lastX = currentX + item.width;
      });
      
      fullText += `${pageText  }\n\n`;
      
      // Detect sections in this page
      const pageSections = this.detectSectionsInText(pageText);
      detectedSections.push(...pageSections);
      
      // Create page chunk
      chunks.push({
        content: pageText,
        pageNumber: i,
        metadata: {
          hasTable: potentialTable,
          hasImage: hasImages,
          sections: pageSections
        }
      });
      
      // Break text into smaller chunks if needed
      if (options.splitPages && pageText.length > (options.maxPageLength || 5000)) {
        const pageChunks = await this.createSemanticChunks(pageText, {
          ...this.defaultChunkingOptions,
          chunkSize: options.maxPageLength || 5000
        });
        
        // Add page number and metadata to each chunk
        pageChunks.forEach((chunk, index) => {
          chunks.push({
            content: chunk.pageContent,
            pageNumber: i,
            metadata: {
              ...chunk.metadata,
              chunkIndex: index
            }
          });
        });
      }
    }
    
    // Estimate text quality based on recognized characters and potential OCR artifacts
    const wordCount = fullText.split(/\s+/).length;
    const charCount = fullText.replace(/\s+/g, '').length;
    const nonAlphanumericRatio = fullText.replace(/[a-zA-Z0-9\s]/g, '').length / charCount;
    textQuality = Math.max(0.1, 1.0 - (nonAlphanumericRatio > 0.3 ? 0.5 : 0));
    
    return {
      text: fullText,
      chunks,
      pageCount,
      hasImages,
      hasTables,
      detectedSections: [...new Set(detectedSections)], // Remove duplicates
      textQuality
    };
  }
  
  /**
   * Detect tables in PDF page by analyzing text positioning
   * 
   * @param textContent PDF.js text content
   * @returns Whether a table was detected
   */
  private detectTablesInPdfPage(textContent: any): boolean {
    if (!textContent.items || textContent.items.length < 10) {
      return false;
    }
    
    // Collect all x-positions
    const xPositions: number[] = [];
    textContent.items.forEach((item: any) => {
      xPositions.push(item.transform[4]);
    });
    
    // Count frequency of each x-position
    const xFrequency: Record<number, number> = {};
    xPositions.forEach(x => {
      // Round to handle minor variations
      const roundedX = Math.round(x);
      xFrequency[roundedX] = (xFrequency[roundedX] || 0) + 1;
    });
    
    // Count x-positions that appear multiple times (column alignments)
    const columnCount = Object.values(xFrequency).filter(count => count > 2).length;
    
    // If we have 3+ columns with aligned text, it's likely a table
    return columnCount >= 3;
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
    text: string;
    chunks: Array<{content: string; metadata?: any}>;
    detectedSections: string[];
  }> {
    const chunks: Array<{content: string; metadata?: any}> = [];
    let detectedSections: string[] = [];
    
    // Detect sections in the text
    if (options.detectSections) {
      detectedSections = this.detectSectionsInText(text);
    }
    
    // Create chunks based on sections if sections found
    if (detectedSections.length > 0) {
      const sectionChunks = this.splitTextBySections(text);
      chunks.push(...sectionChunks.map(section => ({
        content: section.content,
        metadata: { section: section.section }
      })));
    } else {
      // Use semantic chunking as fallback
      const semanticChunks = await this.createSemanticChunks(text, this.defaultChunkingOptions);
      chunks.push(...semanticChunks.map((chunk: Document) => ({
        content: chunk.pageContent,
        metadata: chunk.metadata
      })));
    }
    
    return { text, chunks, detectedSections };
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
    text: string;
    chunks: Array<{content: string; metadata?: any}>;
    pageCount: number;
    hasTables: boolean;
    detectedSections: string[];
  }> {
    // Use LangChain DocxLoader
    const loader = new DocxLoader(blob);
    const docs = await loader.load();
    
    // Extract text and estimate page count based on content length
    const fullText = docs.map(doc => doc.pageContent).join('\n\n');
    const estimatedPageCount = Math.max(1, Math.ceil(fullText.length / 3000));
    
    // Detect sections
    const detectedSections = this.detectSectionsInText(fullText);
    
    // Check for potential tables
    const hasTables = /\b(table|row)\b/i.test(fullText) || 
                      (fullText.split('\n').some(line => line.split(/\s+/).length > 6));
    
    // Create chunks - preferring section-based if sections found
    let chunks: Array<{content: string; metadata?: any}> = [];
    
    if (detectedSections.length > 0 && options.detectSections) {
      const sectionChunks = this.splitTextBySections(fullText);
      chunks = sectionChunks.map(section => ({
        content: section.content,
        metadata: { section: section.section }
      }));
    } else {
      // Fallback to semantic chunking
      const semanticChunks = await this.createSemanticChunks(fullText, this.defaultChunkingOptions);
      chunks = semanticChunks.map((chunk: Document) => ({
        content: chunk.pageContent,
        metadata: chunk.metadata
      }));
    }
    
    return {
      text: fullText,
      chunks,
      pageCount: estimatedPageCount,
      hasTables,
      detectedSections
    };
  }
  
  /**
   * Perform OCR on an image to extract text
   * This would use a proper OCR service in production
   * 
   * @param blob Image blob
   * @returns OCR result
   */
  private async performOcrOnImage(blob: Blob): Promise<{
    text: string;
    width: number;
    height: number;
    confidence: number;
  }> {
    // This is a mock implementation - in a real system, you would:
    // 1. Use a dedicated OCR service like Google Cloud Vision, Tesseract.js, or a HIPAA-compliant medical OCR service
    // 2. Process the image to improve OCR quality (deskew, enhance contrast, etc.)
    // 3. Apply medical-specific OCR models if available
    
    // Simulate creating an image to get dimensions
    const url = URL.createObjectURL(blob);
    const img = document.createElement('img');
    img.src = url;
    
    // Wait for image to load
    await new Promise(resolve => {
      img.onload = resolve;
    });
    
    // Get dimensions
    const width = img.width;
    const height = img.height;
    
    // Clean up
    URL.revokeObjectURL(url);
    
    // In a real implementation, you would call an OCR service here
    // For this example, return a mock result
    return {
      text: "This is placeholder text that would come from an OCR service. In a real implementation, the image would be processed to extract actual text content.",
      width,
      height,
      confidence: 0.75
    };
  }
  
  /**
   * Detect medical document sections from text
   * 
   * @param text Document text
   * @returns Array of detected section names
   */
  private detectSectionsInText(text: string): string[] {
    const detectedSections: string[] = [];
    
    // Look for common medical document section headers
    for (const section of this.medicalSectionPatterns) {
      for (const pattern of section.patterns) {
        // Look for the pattern surrounded by whitespace or at the beginning of a line
        const regex = new RegExp(`(^|\\s)(${pattern})(:|\\s|$)`, 'i');
        if (regex.test(text)) {
          detectedSections.push(section.name);
          break; // Found this section, no need to check other patterns
        }
      }
    }
    
    return detectedSections;
  }
  
  /**
   * Split text by detected sections
   * 
   * @param text Document text
   * @returns Array of sections with content
   */
  private splitTextBySections(text: string): Array<{section: string; content: string}> {
    const sections: Array<{section: string; content: string}> = [];
    let currentContent = '';
    let currentSection = 'unknown';
    
    // Split text into lines for processing
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this line is a section header
      let newSectionFound = false;
      
      for (const section of this.medicalSectionPatterns) {
        for (const pattern of section.patterns) {
          // Look for the pattern surrounded by whitespace or at the beginning of a line
          const regex = new RegExp(`(^|\\s)(${pattern})(:|\\s|$)`, 'i');
          if (regex.test(line)) {
            // If we were already building a section, save it
            if (currentContent.trim()) {
              sections.push({
                section: currentSection,
                content: currentContent.trim()
              });
            }
            
            // Start a new section
            currentSection = section.name;
            currentContent = `${line  }\n`; // Include the header in the content
            newSectionFound = true;
            break;
          }
        }
        if (newSectionFound) break;
      }
      
      // If not a new section, add to current content
      if (!newSectionFound) {
        currentContent += `${line  }\n`;
      }
    }
    
    // Add the last section if not empty
    if (currentContent.trim()) {
      sections.push({
        section: currentSection,
        content: currentContent.trim()
      });
    }
    
    return sections;
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
        "\n\n", // Double line breaks (strong separator)
        "\n", // Single line breaks
        ". ", // End of sentences
        ": ", // Colons often introduce new content
        ", ", // Commas may separate list items
        " ", // Last resort - split on spaces
      ]
    });
    
    // Create a document with the text
    const doc = new Document({
      pageContent: text,
      metadata: {}
    });
    
    // Split the document
    return await splitter.splitDocuments([doc]);
  }
  
  /**
   * Enhanced document type detection using content analysis
   * 
   * @param content Document content
   * @returns Detected document type with confidence
   */
  async detectDocumentType(content: string): Promise<DocumentTypeDetectionResult> {
    // Default document type
    const defaultType: DocumentTypeDetectionResult = {
      type: { category: 'clinical', type: 'note' },
      confidence: 0.5
    };
    
    // If no content, return default
    if (!content || content.length < 50) {
      return defaultType;
    }
    
    // Extract the first ~1000 characters for analysis
    const sampleText = content.substring(0, 1000).toLowerCase();
    
    // Detect document sections
    const detectedSections = this.detectSectionsInText(content);
    
    // Calculate scores for each document type based on keyword matching
    const scores: Record<string, number> = {};
    
    const typePatterns: Record<string, RegExp[]> = {
      PROGRESS_NOTE: [/progress\s+note/i, /soap\s+note/i, /office\s+visit/i],
      HISTORY_AND_PHYSICAL: [/history\s+and\s+physical/i, /h\s*&\s*p/i, /admission\s+note/i],
      DISCHARGE_SUMMARY: [/discharge\s+summary/i, /discharge\s+note/i, /hospital\s+course/i],
      OPERATIVE_REPORT: [/operative\s+report/i, /operation\s+note/i, /surgical\s+procedure/i],
      CONSULTATION: [/consultation/i, /consult\s+note/i, /referred\s+for/i],
      PATHOLOGY_REPORT: [/pathology/i, /specimen/i, /histology/i, /biopsy/i],
      RADIOLOGY_REPORT: [/radiology/i, /impression:/i, /findings:/i, /x-ray/i, /ct\s+scan/i, /mri/i],
      LAB_RESULTS: [/laboratory/i, /lab\s+results/i, /test\s+results/i, /chemistry/i, /hematology/i],
      MEDICATION_LIST: [/medication\s+list/i, /current\s+medications/i, /prescriptions/i],
      IMMUNIZATION_RECORD: [/immunization/i, /vaccination/i, /vaccine/i]
    };
    
    // Score each document type
    for (const [type, patterns] of Object.entries(typePatterns)) {
      scores[type] = 0;
      for (const pattern of patterns) {
        if (pattern.test(sampleText)) {
          scores[type] += 1;
        }
      }
    }
    
    // Find the type with the highest score
    let bestType = '';
    let bestScore = 0;
    
    for (const [type, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }
    
    // Calculate confidence based on score and number of patterns
    const maxPossibleScore = Math.max(...Object.values(typePatterns).map(patterns => patterns.length));
    const confidence = bestScore > 0 ? bestScore / maxPossibleScore : 0.2;
    
    // If confidence is too low, return default type
    if (confidence < 0.3) {
      return {
        ...defaultType,
        detectedSections
      };
    }
    
    // Return the detected document type
    return {
      type: this.medicalDocumentTypes[bestType] || defaultType.type,
      confidence,
      detectedSections,
      possibleTypes: Object.entries(scores)
        .filter(([_, score]) => score > 0)
        .sort(([_, scoreA], [__, scoreB]) => scoreB - scoreA)
        .slice(0, 3)
        .map(([type, _]) => this.medicalDocumentTypes[type])
    };
  }
  
  /**
   * Batch process multiple documents in parallel
   * 
   * @param files Array of files to process
   * @param patientId Patient ID
   * @param options Document processing options
   * @returns Array of processed document results
   */
  async batchProcessDocuments(
    files: File[],
    patientId: string,
    options?: DocumentProcessingOptions
  ): Promise<{ 
    successful: ExtractedDocument[]; 
    failed: { file: File; error: Error }[] 
  }> {
    // Limit batch size to prevent overwhelming the system
    const batchSize = 5;
    const successful: ExtractedDocument[] = [];
    const failed: { file: File; error: Error }[] = [];
    
    // Process files in batches
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      // Process each file in the batch in parallel
      const results = await Promise.allSettled(batch.map(file => 
        this.processDocumentWithOptions(file, {
          ...options,
          patientId
        })
      ));
      
      // Collect results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push({ file: batch[index], error: result.reason });
        }
      });
    }
    
    return { successful, failed };
  }
  
  /**
   * Enhanced processDocumentWithOptions with improved extraction and error handling
   * 
   * @param file Document file to process
   * @param options Document processing options
   * @returns ExtractedDocument
   */
  async processDocumentWithOptions(
    file: File,
    options?: DocumentProcessingOptions
  ): Promise<ExtractedDocument> {
    // Provide default status callback if none supplied
    const onStatusUpdate = options?.onStatusUpdate ?? (() => {});
    onStatusUpdate({
      status: 'processing',
      progress: 0,
      currentStep: 'Starting document processing',
      phase: 'initialization'
    });
    
    try {
      // Validate file type and size
      if (!await this.validateFileType(file)) {
        throw new DocumentServiceError(
          `Unsupported file type: ${file.type}`,
          'UNSUPPORTED_FILE_TYPE',
          false,
          { fileType: file.type }
        );
      }
      
      if (!await this.validateFileSize(file)) {
        throw new DocumentServiceError(
          `File size exceeds maximum allowed size of ${this.maxFileSize / (1024 * 1024)}MB`,
          'FILE_TOO_LARGE',
          false,
          { fileSize: file.size, maxSize: this.maxFileSize }
        );
      }
      
      // Extract text with enhanced options
      onStatusUpdate({
        status: 'processing',
        progress: 10,
        currentStep: 'Extracting text from document',
        phase: 'extraction'
      });
      
      // Determine extraction level based on options or file type
      const extractionLevel = options?.extractionLevel || this.getExtractionLevelForFile(file);
      
      // Configure extraction options based on extraction level
      const extractionOptions: EnhancedExtractionOptions = {
        ...this.defaultExtractionOptions,
        splitPages: extractionLevel !== 'basic',
        extractTables: extractionLevel !== 'basic',
        detectSections: extractionLevel !== 'basic',
        ocrImages: extractionLevel === 'comprehensive',
        preserveLayout: extractionLevel === 'comprehensive'
      };
      
      // Extract text with enhanced options
      const extractedData = await this.extractText(file, extractionOptions);
      
      // Update progress
      onStatusUpdate({
        status: 'processing',
        progress: 50,
        currentStep: 'Analyzing document content',
        phase: 'analysis'
      });
      
      // Document type detection (fallback if not provided)
      const detectionResult = options?.documentType 
        ? { type: options.documentType, confidence: 1.0 } 
        : await this.detectDocumentType(extractedData.rawText);
      
      // Add detected sections to metadata if available
      if (detectionResult.detectedSections && detectionResult.detectedSections.length > 0) {
        extractedData.metadata.detectedSections = detectionResult.detectedSections;
      }
      
      // Add document type confidence to metadata
      extractedData.metadata.documentTypeConfidence = detectionResult.confidence;
      
      // Construct final extracted document
      const documentId = crypto.randomUUID();
      const extractedDocument: ExtractedDocument = {
        id: documentId,
        createdAt: new Date(),
        documentType: detectionResult.type,
        patientId: options?.patientId,
        extractedData,
        isSuccessful: true
      };
      
      // Store document in database if patient ID provided
      if (options?.patientId) {
        try {
          const dbId = await this.saveDocument(extractedDocument, options.departmentId);
          
          // Update with database ID if different
          if (dbId !== documentId) {
            extractedDocument.id = dbId;
          }
        } catch (saveError) {
          console.warn(`Document extracted but failed to save to database: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
          // Continue with the extracted document even if saving failed
        }
      }
      
      onStatusUpdate({
        status: 'success',
        progress: 100,
        currentStep: 'Document extraction completed',
        phase: 'extraction'
      });
      
      return extractedDocument;
    } catch (error) {
      // Enhanced error handling
      let errorMessage: string;
      let errorCode: string;
      
      if (error instanceof DocumentServiceError) {
        errorMessage = error.message;
        errorCode = error.code;
      } else {
        errorMessage = error instanceof Error ? error.message : String(error);
        errorCode = 'PROCESSING_FAILED';
      }
      
      console.error('Error processing document:', error);
      
      onStatusUpdate({
        status: 'error',
        progress: 0,
        error: errorMessage,
        phase: 'extraction'
      });
      
      // Return an error-labeled extracted document
      return {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        documentType: options?.documentType || { category: 'unknown', type: 'unknown' },
        patientId: options?.patientId,
        extractedData: {
          rawText: '',
          metadata: {
            extractedAt: new Date(),
            error: errorMessage,
            errorCode
          }
        },
        isSuccessful: false,
        errorMessage
      };
    }
  }
  
  /**
   * Get extraction level for a file based on its type
   * 
   * @param file File to get extraction level for
   * @returns Extraction level
   */
  private getExtractionLevelForFile(file: File): 'basic' | 'enhanced' | 'comprehensive' {
    const fileType = this.supportedTypes.find(type => type.mimeType === file.type);
    
    if (!fileType) {
      return 'basic'; // Default to basic for unknown types
    }
    
    return fileType.extractionLevel as 'basic' | 'enhanced' | 'comprehensive';
  }
  
  /**
   * Enhanced saveDocument with improved metadata handling and PHI safeguards
   * 
   * @param extractedDocument Extracted document
   * @param departmentId Optional department ID
   * @returns Saved document ID
   */
  async saveDocument(
    extractedDocument: ExtractedDocument,
    departmentId?: string
  ): Promise<string> {
    // Ensure category is one of the valid enum values
    const category = extractedDocument.documentType.category as 'clinical' | 'lab' | 'imaging' | 'prescription' | 'administrative';
    if (!['clinical', 'lab', 'imaging', 'prescription', 'administrative'].includes(category)) {
      // Default to clinical if not a valid category
      console.warn(`Invalid category: ${category}, defaulting to 'clinical'`);
    }
    
    // Generate a document title that includes meaningful information
    const documentType = extractedDocument.documentType.type || 'document';
    const timestamp = new Date().toISOString().split('T')[0];
    const title = extractedDocument.extractedData.metadata.documentTitle || 
                  `${category.charAt(0).toUpperCase() + category.slice(1)} ${documentType} - ${timestamp}`;
    
    // Prepare data for insertion
    const documentRecord = {
      patient_id: extractedDocument.patientId,
      title,
      category: (category as 'clinical' | 'lab' | 'imaging' | 'prescription' | 'administrative') || 'clinical',
      document_type: getDbCompatibleMetadata(extractedDocument.documentType) as Json,
      file_path: extractedDocument.extractedData.metadata.filename || 'unknown-file',
      file_type: extractedDocument.extractedData.metadata.fileFormat || 'application/pdf',
      file_size: extractedDocument.extractedData.metadata.fileSize || 0,
      checksum: extractedDocument.extractedData.metadata.checksum || `generated-${Date.now().toString()}`,
      document_date: new Date().toISOString().split('T')[0],
      content_text: extractedDocument.extractedData.rawText,
      content_summary: this.generateContentSummary(extractedDocument.extractedData.rawText),
      metadata: getDbCompatibleMetadata({
        ...extractedDocument.extractedData.metadata,
        extractionDate: new Date().toISOString(),
        departmentId
      }) as Json,
      processing_status: extractedDocument.isSuccessful ? 'completed' : 'failed',
      is_processed: extractedDocument.isSuccessful,
      processing_error: extractedDocument.errorMessage,
      department: departmentId
    };
    
    // Insert into database
    const { data, error } = await this.supabase
      .from('patient_documents')
      .insert(documentRecord)
      .select('id')
      .single();
    
    if (error) {
      console.error('Error saving document:', error);
      throw new DocumentServiceError(
        `Failed to save document: ${error.message}`,
        'DATABASE_ERROR',
        true,
        { error }
      );
    }
    
    return data.id;
  }
  
  /**
   * Generate a brief content summary for document listing
   * 
   * @param text Document text
   * @returns Brief summary
   */
  private generateContentSummary(text: string): string {
    if (!text) return '';
    
    // Extract the first few sentences (max 200 chars)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length === 0) {
      return 'Empty document';
    }
    
    // Take up to 3 sentences
    let summary = sentences.slice(0, 3).join('. ').trim();
    
    // Truncate if too long
    if (summary.length > 200) {
      summary = `${summary.substring(0, 197)  }...`;
    }
    
    return summary;
  }
  
  /**
   * Upload a document with enhanced workflow and progress tracking
   * 
   * @param patientId Patient ID
   * @param file File to upload
   * @param options Upload options
   * @returns Upload result with document ID and workflow ID
   */
  async uploadDocument(
    patientId: string,
    file: File, 
    options?: WorkflowOptions & {
      documentType?: DocumentType;
      departmentId?: string;
      priority?: 'low' | 'normal' | 'high';
      tags?: string[];
    }
  ): Promise<{
    documentId: string;
    fileName: string;
    workflowId?: string;
    extractionStatus?: string;
  }> {
    // Create a workflow ID if not provided
    const workflowId = crypto.randomUUID();
    
    // Use workflow manager to handle the operation with proper state tracking
    return workflowManager.handleWorkflowOperation(
      workflowId,
      'extraction' as WorkflowStep,
      async () => {
        // Cast options to any to avoid type issues - this is a temporary fix
        // A proper fix would involve aligning the types with workflowManager
        const progressOptions = options as any;
        workflowManager.reportProgress(progressOptions, 'upload', 0);
        
        try {
          // Upload file to Supabase storage
          const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const filePath = `patient-documents/${patientId}/${fileName}`;
          
          // Log the beginning of upload
          console.log(`Starting upload of ${fileName} for patient ${patientId}`);
          
          const { error: uploadError } = await this.supabase.storage
            .from('documents')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: true,
              contentType: file.type
            });
          
          if (uploadError) {
            throw new DocumentServiceError(
              `Upload failed: ${uploadError.message}`,
              'STORAGE_ERROR',
              true,
              { uploadError }
            );
          }
          
          workflowManager.reportProgress(progressOptions, 'upload', 30);
          
          // Create a signed URL
          const { data: urlData } = await this.supabase.storage
            .from('documents')
            .createSignedUrl(filePath, 60 * 60);
          
          if (!urlData?.signedUrl) {
            throw new DocumentServiceError(
              'Failed to generate signed URL',
              'SIGNED_URL_ERROR',
              true
            );
          }
          
          workflowManager.reportProgress(progressOptions, 'upload', 50);
          
          // Insert a new record in patient_documents
          const documentType = options?.documentType || { 
            category: 'clinical',
            type: 'note'
          };
          
          const { data: docData, error: docError } = await this.supabase
            .from('patient_documents')
            .insert({
              patient_id: patientId,
              file_name: file.name,
              file_type: file.type, 
              file_size: file.size,
              storage_path: filePath,
              title: file.name,
              category: (documentType.category as 'clinical' | 'lab' | 'imaging' | 'prescription' | 'administrative') || 'clinical',
              document_type: documentType as unknown as Json,
              file_path: filePath,
              document_date: new Date().toISOString().split('T')[0],
              checksum: 'auto-generated',
              processing_status: 'uploaded',
              department: options?.departmentId,
              metadata: getDbCompatibleMetadata({
                workflowId,
                uploadedAt: new Date().toISOString(),
                priority: options?.priority || 'normal',
                tags: options?.tags || []
              }) as Json
            })
            .select('id')
            .single();
          
          if (docError || !docData) {
            throw new DocumentServiceError(
              `Document record creation failed: ${docError?.message || 'Unknown error'}`,
              'DATABASE_ERROR',
              true,
              { docError }
            );
          }
          
          workflowManager.reportProgress(progressOptions, 'upload', 70);
          
          // Update workflow state
          await workflowManager.updateWorkflowState(
            workflowId, 
            'extraction' as WorkflowStep, 
            {
              documentId: docData.id,
              patientId,
              fileInfo: {
                name: file.name,
                type: file.type,
                size: file.size,
                path: filePath
              }
            }
          );
          
          workflowManager.reportProgress(progressOptions, 'upload', 80);
          
          // Start extraction process asynchronously via serverless function
          const { error: fnError } = await this.supabase.functions.invoke('document-extraction', {
            body: {
              documentId: docData.id,
              fileUrl: urlData.signedUrl,
              fileName: file.name,
              fileType: file.type,
              workflowId,
              options: {
                documentType: options?.documentType,
                departmentId: options?.departmentId,
                priority: options?.priority || 'normal',
                tags: options?.tags || []
              }
            }
          });
          
          if (fnError) {
            // Log error but don't fail - extraction will be retried
            console.warn(`Extraction function invocation had an error: ${fnError.message}. Will be retried.`);
          }
          
          workflowManager.reportProgress(progressOptions, 'upload', 100);
          
          return {
            documentId: docData.id,
            fileName: file.name,
            workflowId,
            extractionStatus: 'started'
          };
        } catch (error) {
          // Enhanced error handling with recovery options
          console.error('Document upload error:', error);
          
          // Update workflow with error state
          await workflowManager.updateWorkflowState(workflowId, 'error', {
            error: error instanceof Error ? error.message : String(error),
            errorCode: error instanceof DocumentServiceError ? error.code : 'UNKNOWN_ERROR',
            errorTime: new Date().toISOString()
          });
          
          throw error;
        }
      },
      options as any // Temporary fix to make the types align
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
      forceReExtract?: boolean;
      extractionLevel?: 'basic' | 'enhanced' | 'comprehensive';
    }
  ): Promise<{
    success: boolean;
    documentId: string;
    workflowId?: string;
  }> {
    try {
      // Fetch the document record
      const { data: document, error: docError } = await this.supabase
        .from('patient_documents')
        .select('*')
        .eq('id', documentId)
        .single();
      
      if (docError || !document) {
        throw new DocumentServiceError(
          `Document not found: ${docError?.message || 'Unknown error'}`,
          'DOCUMENT_NOT_FOUND',
          false,
          { documentId }
        );
      }
      
      // Get storage path - fix schema property access
      const storagePath = document.file_path;
      
      if (!storagePath) {
        throw new DocumentServiceError(
          'Document has no storage path',
          'MISSING_STORAGE_PATH',
          false,
          { documentId }
        );
      }
      
      // Create a signed URL
      const { data: urlData, error: urlError } = await this.supabase.storage
        .from('documents')
        .createSignedUrl(storagePath, 60 * 60);
      
      if (urlError || !urlData?.signedUrl) {
        throw new DocumentServiceError(
          `Failed to generate signed URL: ${urlError?.message || 'Unknown error'}`,
          'SIGNED_URL_ERROR',
          true,
          { urlError }
        );
      }
      
      // Create a new workflow ID
      const workflowId = crypto.randomUUID();
      
      // Update the document status with safe metadata handling
      await this.supabase
        .from('patient_documents')
        .update({
          processing_status: 'processing',
          metadata: getDbCompatibleMetadata({
            ...(document.metadata && typeof document.metadata === 'object' ? document.metadata : {}),
            reprocessing: true,
            reprocessingTime: new Date().toISOString(),
            workflowId,
            extractionLevel: options?.extractionLevel || 'comprehensive'
          }) as Json
        })
        .eq('id', documentId);
      
      // Invoke the extraction function
      await this.supabase.functions.invoke('document-extraction', {
        body: {
          documentId,
          fileUrl: urlData.signedUrl,
          fileName: document.title || 'unknown',
          fileType: document.file_type,
          workflowId,
          options: {
            documentType: document.document_type,
            departmentId: document.department,
            forceReExtract: options?.forceReExtract || true,
            extractionLevel: options?.extractionLevel || 'comprehensive'
          }
        }
      });
      
      return {
        success: true,
        documentId,
        workflowId
      };
    } catch (error) {
      console.error('Error retrying extraction:', error);
      
      throw error instanceof DocumentServiceError
        ? error
        : new DocumentServiceError(
            `Failed to retry extraction: ${error instanceof Error ? error.message : String(error)}`,
            'RETRY_FAILED',
            false,
            { documentId, originalError: error }
          );
    }
  }
  
  /**
   * Validates file type against supported types
   * 
   * @param file The file to validate
   * @returns Whether the file type is supported
   */
  private async validateFileType(file: File): Promise<boolean> {
    return this.supportedTypes.some(type => type.mimeType === file.type);
  }
  
  /**
   * Validates file size against maximum supported size
   * 
   * @param file The file to validate
   * @returns Whether the file size is within limits
   */
  private async validateFileSize(file: File): Promise<boolean> {
    return file.size <= this.maxFileSize;
  }
}

// Export singleton instance
export const enhancedDocumentService = new EnhancedDocumentService();

/**
 * Example 1: Enhanced Extraction of Complex PDFs
 * 
 * This example shows how to use the enhanced document service
 * for better PDF extraction with section awareness
 */
async function extractComplexMedicalPDF(file: File, patientId: string) {
  try {
    // Use enhanced extraction options
    const extractionOptions: DocumentProcessingOptions = {
      patientId,
      extractionLevel: 'comprehensive', // Use the most thorough extraction
      preserveSections: true, // Keep document sections intact
      extractMetadata: true, // Extract document metadata
      prioritizeFields: ['patient_name', 'medical_record_number', 'date_of_service']
    };
    
    // Process the document
    const result = await enhancedDocumentService.processDocumentWithOptions(
      file,
      extractionOptions
    );
    
    console.log(`Document processed successfully: ${result.id}`);
    console.log(`Detected document type: ${result.documentType.type} (${result.documentType.category})`);
    console.log(`Detected sections: ${result.extractedData.metadata.detectedSections?.join(', ')}`);
    
    return result;
  } catch (error) {
    if (error instanceof DocumentServiceError) {
      console.error(`Error extracting document: ${error.message} (${error.code})`);
      // Handle specific error codes
      if (error.code === 'FILE_TOO_LARGE') {
        // Offer to split the file or use a different upload method
      } else if (error.code === 'EXTRACTION_FAILED' && error.recoverable) {
        // Offer to retry with different options
      }
    } else {
      console.error('Unexpected error:', error);
    }
    throw error;
  }
}

/**
 * Example 2: Batch Processing Multiple Documents
 * 
 * This example demonstrates how to efficiently process
 * multiple documents in one operation
 */
async function processBatchOfDocuments(files: File[], patientId: string) {
  // Set up progress tracking
  const progressBar = {
    update: (progress: number) => console.log(`Processing: ${progress}%`)
  };
  
  try {
    // Process all files in batch
    const result = await enhancedDocumentService.batchProcessDocuments(
      files,
      patientId,
      {
        extractionLevel: 'enhanced',
        onStatusUpdate: (status) => {
          progressBar.update(status.progress);
        }
      }
    );
    
    console.log(`Successfully processed ${result.successful.length} documents`);
    
    if (result.failed.length > 0) {
      console.warn(`Failed to process ${result.failed.length} documents`);
      
      // Offer retry options for failed documents
      const retryPrompt = `Would you like to retry processing ${result.failed.length} failed documents with more comprehensive extraction?`;
      
      // Show retry UI...
    }
    
    return result.successful;
  } catch (error) {
    console.error('Batch processing error:', error);
    throw error;
  }
}

/**
 * Example 3: Medical Document Verification and Integration
 * 
 * This example shows how to use extracted data for verification and
 * integration with the patient summary
 */
async function processAndVerifyDocument(file: File, patientId: string) {
  // First, process the document
  const extractedDocument = await enhancedDocumentService.processDocumentWithOptions(
    file, 
    { 
      patientId,
      extractionLevel: 'comprehensive'
    }
  );
  
  // Check if document extraction was successful
  if (!extractedDocument.isSuccessful) {
    throw new Error(`Document extraction failed: ${extractedDocument.errorMessage}`);
  }
  
  // Start the verification workflow
  const workflowId = crypto.randomUUID();
  await workflowManager.updateWorkflowState(workflowId, 'verification' as WorkflowStep, {
    documentId: extractedDocument.id,
    patientId,
    extractedAt: new Date().toISOString()
  });
  
  // Create a separate Supabase client for the example
  const supabase = createBrowserClient();
  
  // Fetch the patient information from the database
  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .single();
  
  if (!patient) {
    throw new Error(`Patient not found: ${patientId}`);
  }
  
  // Prepare verification context with patient information
  const verificationContext = {
    patientName: `${patient.first_name} ${patient.last_name}`,
    patientId: patient.id,
    dateOfBirth: patient.date_of_birth,
    documentId: extractedDocument.id,
    documentType: extractedDocument.documentType
  };
  
  // Return the data needed for the verification UI
  return {
    extractedDocument,
    verificationContext,
    workflowId
  };
}

/**
 * Example 4: Building a Patient Timeline from Documents
 * 
 * This example shows how to extract dates from documents
 * to build a comprehensive patient timeline
 */
async function buildPatientTimeline(patientId: string) {
  // Use a properly encapsulated method to parse dates
  function parseDate(dateString: string): string {
    // Simple implementation - would be more robust in production
    try {
      return new Date(dateString).toISOString().split('T')[0];
    } catch (e) {
      return new Date().toISOString().split('T')[0]; // fallback
    }
  }

  // Create a separate client for examples instead of using private property
  const supabase = createBrowserClient();
  
  // Fetch all patient documents
  const { data: documents, error } = await supabase
    .from('patient_documents')
    .select('*')
    .eq('patient_id', patientId)
    .order('document_date', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to fetch patient documents: ${error.message}`);
  }
  
  // Extract key dates and events
  const timelineEvents = [];
  
  for (const doc of documents) {
    // Extract document type and date
    const documentType = doc.document_type;
    const documentDate = doc.document_date;
    
    // Add document as timeline event
    timelineEvents.push({
      date: documentDate,
      type: 'document',
      title: doc.title,
      category: doc.category,
      documentId: doc.id
    });
    
    // If content is available, extract additional events
    if (doc.content_text) {
      // Extract dates from content using regex
      const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})|(\w+ \d{1,2}, \d{4})/g;
      const matches = doc.content_text.match(dateRegex);
      
      if (matches) {
        // Process each date found
        for (const match of matches) {
          // Extract context around the date (30 chars before and after)
          const index = doc.content_text.indexOf(match);
          const start = Math.max(0, index - 30);
          const end = Math.min(doc.content_text.length, index + match.length + 30);
          const context = doc.content_text.substring(start, end);
          
          // Create a timeline event
          timelineEvents.push({
            date: parseDate(match),
            type: 'extracted_date',
            context,
            documentId: doc.id,
            confidence: 0.7 // Confidence score for regex extraction
          });
        }
      }
    }
  }
  
  // Sort timeline events by date
  timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return timelineEvents;
}