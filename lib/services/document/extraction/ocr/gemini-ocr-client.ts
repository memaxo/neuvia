/**
 * Gemini OCR Client
 *
 * Handles communication with Google's Gemini API for OCR extraction
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import logger from "@/lib/logger";
import { ExternalServiceError } from "@/lib/errors";
import { ValidationError } from "@/lib/errors/verification-errors";
import { getDefaultConfig } from "@/lib/langchain/config";

// Define the response schema for OCR
export const OCRPageSchema = z.object({
  page_number: z.number().int(),
  text: z.string(),
  tables: z.array(z.array(z.string())).optional(),
  metadata: z.object({
    patient_name: z.string().optional(),
    document_date: z.string().optional(),
    doctor_name: z.string().optional(),
    document_type: z.string().optional(),
    section_types: z.array(z.string()).optional(),
    processing_time_ms: z.number().optional(),
    processing_tokens: z.number().optional(),
    text_quality: z.number().optional(),
    analysis: z.record(z.any()).optional(),
    error: z.string().optional(),
    error_code: z.string().optional(),
    error_type: z.string().optional(),
    batch_recovery: z.boolean().optional(),
  }).optional()
});

export const OCRDocumentSchema = z.object({
  pages: z.array(OCRPageSchema),
  metadata: z.object({
    document_structure: z.string().optional(),
    confidence: z.number().optional(),
    processing_time: z.number().optional(),
    document_type: z.string().optional(),
    extraction_method: z.string().default("gemini-ocr"),
    page_count: z.number().optional(),
    average_time_per_page: z.number().optional(),
    file_type: z.string().optional(),
    file_size: z.number().optional(),
  }).optional()
});

export type OCRPage = z.infer<typeof OCRPageSchema>;
export type OCRDocument = z.infer<typeof OCRDocumentSchema>;

// Interface for progress tracking
interface ProcessingProgress {
  overall: number;       // Overall document progress (0-100)
  page?: number;         // Current page number
  pageProgress?: number; // Progress within the current page (0-100)
  stage?: string;        // Current processing stage description
}

interface GeminiOCROptions {
  // Document parsing options
  splitPages?: boolean;
  extractTables?: boolean;
  detectSections?: boolean;
  preserveLayout?: boolean;
  maxPageLength?: number;
  
  // Performance options
  tokenLimit?: number;       // Max tokens to process (default: 10240)
  useCache?: boolean;        // Whether to use caching for pages (default: true)
  cacheKey?: string;         // Optional key for caching results
  
  // Processing control
  chunkSize?: number;        // Size of text chunks for large pages
  chunkOverlap?: number;     // Overlap between chunks
  temperature?: number;      // Model temperature (lower = more deterministic)
  
  // Progress reporting
  progressCallback?: (progress: ProcessingProgress) => void;  // Callback for progress updates
}

/**
 * Gemini OCR Client
 * Handles document processing using Google's Gemini multimodal models
 */
export class GeminiOCRClient {
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName: string;
  private readonly logger: any;
  private readonly cache: Map<string, OCRPage> = new Map();
  private readonly documentCache: Map<string, OCRDocument> = new Map();

  constructor(config = getDefaultConfig()) {
    const apiKey = config.gemini.apiKey;
    this.modelName = config.gemini.model || "gemini-2.0-flash-lite";
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.logger = (logger).withMetadata({
      module: 'GeminiOCRClient',
    });
  }
  
  /**
   * Gets a cache key for a page
   * @param blob Page blob
   * @param pageNum Page number
   * @param options Processing options
   * @returns Cache key or null if caching disabled
   */
  private async getCacheKey(blob: Blob, pageNum: number, options: GeminiOCROptions): Promise<string | null> {
    if (options.useCache === false) return null;
    
    // If explicit cache key is provided, use it with page number
    if (options.cacheKey) {
      return `${options.cacheKey}-page${pageNum}`;
    }
    
    // Otherwise compute hash of blob data
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Create cache key with hash and processing options
      return `${hashHex}-page${pageNum}-${options.extractTables ? 1 : 0}${options.detectSections ? 1 : 0}`;
    } catch (e) {
      // If hashing fails, don't use cache
      return null;
    }
  }
  
  /**
   * Gets a document cache key
   */
  private getDocumentCacheKey(file: File | Blob, options: GeminiOCROptions): string | null {
    if (options.useCache === false) return null;
    
    // If explicit cache key is provided, use it
    if (options.cacheKey) {
      return options.cacheKey;
    }
    
    // For files, use name and last modified as key
    if (file instanceof File) {
      return `file-${file.name}-${file.lastModified}-${options.extractTables ? 1 : 0}${options.detectSections ? 1 : 0}`;
    }
    
    // For blobs without identity, disable caching
    return null;
  }

  /**
   * Process a document file using Gemini OCR
   *
   * @param file Document file to process
   * @param options Processing options
   * @returns Structured OCR results
   */
  async processDocument(
    file: File | Blob,
    options: GeminiOCROptions = {}
  ): Promise<OCRDocument> {
    const moduleLogger = this.logger.withMetadata({
      method: 'processDocument',
      fileName: file instanceof File ? file.name : 'blob',
      fileType: file.type,
      fileSize: file.size,
    });

    // Check if we have this document in cache
    const docCacheKey = this.getDocumentCacheKey(file, options);
    if (docCacheKey && options.useCache !== false) {
      const cachedDoc = this.documentCache.get(docCacheKey);
      if (cachedDoc) {
        moduleLogger.info('Using cached document result', { cacheKey: docCacheKey });
        
        // Update progress if callback provided
        if (options.progressCallback) {
          options.progressCallback({
            overall: 100,
            stage: 'Loaded from cache'
          });
        }
        
        return cachedDoc;
      }
    }

    try {
      moduleLogger.info('Processing document with Gemini OCR');
      
      // Update progress if callback provided
      if (options.progressCallback) {
        options.progressCallback({
          overall: 5,
          stage: 'Splitting document into pages'
        });
      }

      // Get start time for performance metrics
      const startTime = Date.now();

      // For PDF files, we need to split into pages first
      const pages = await this.splitIntoPages(file);
      
      // Update progress after splitting
      if (options.progressCallback) {
        options.progressCallback({
          overall: 10,
          stage: `Preparing to process ${pages.length} pages`
        });
      }
      
      // Adaptive token limit calculation based on document size
      // For large documents, we want to keep tokens per page in check
      const recommendedTokenLimit = options.tokenLimit || 
        (pages.length > 10 ? 8192 : pages.length > 5 ? 9216 : 10240);
      
      // Merged options for processing
      const processingOptions: GeminiOCROptions = {
        ...options,
        tokenLimit: recommendedTokenLimit,
        // Pass progress callback through
        progressCallback: options.progressCallback
      };
      
      // Process each page with Gemini
      const pageResults = await this.processPages(pages, processingOptions);
      
      // Update progress before final assembly
      if (options.progressCallback) {
        options.progressCallback({
          overall: 90,
          stage: 'Assembling final document'
        });
      }
      
      // Calculate total processing time
      const totalTime = Date.now() - startTime;
      
      // Combine results into final document structure
      const result: OCRDocument = {
        pages: pageResults,
        metadata: {
          document_structure: pageResults.length > 1 ? 'multi-page' : 'single-page',
          confidence: this.calculateAverageConfidence(pageResults),
          processing_time: totalTime,
          extraction_method: 'gemini-ocr',
          page_count: pageResults.length,
          average_time_per_page: pageResults.length > 0 ? Math.round(totalTime / pageResults.length) : 0,
          file_type: file.type,
          file_size: file.size,
        }
      };

      // Store in cache if caching is enabled
      if (docCacheKey && options.useCache !== false) {
        this.documentCache.set(docCacheKey, result);
        moduleLogger.debug('Cached document result', { cacheKey: docCacheKey });
      }

      // Final progress update
      if (options.progressCallback) {
        options.progressCallback({
          overall: 100,
          stage: 'Document processing complete'
        });
      }

      moduleLogger.info('Document processing completed successfully', {
        pageCount: result.pages.length,
        processingTime: `${totalTime}ms`,
        avgTimePerPage: `${pageResults.length > 0 ? Math.round(totalTime / pageResults.length) : 0}ms`,
      });

      return result;
    } catch (error) {
      moduleLogger.error('Failed to process document with Gemini OCR', {}, error);
      
      // Update progress if callback provided
      if (options.progressCallback) {
        options.progressCallback({
          overall: 0,
          stage: 'Error processing document'
        });
      }
      
      throw new ExternalServiceError({
        message: 'Gemini OCR document processing failed',
        service: 'Gemini',
        code: 'GEMINI_OCR_FAILED',
        data: { 
          fileType: file.type,
          fileSize: file.size,
          errorMessage: error instanceof Error ? error.message : String(error)
        },
        cause: error,
      });
    }
  }

  /**
   * Split document into pages
   * For PDFs, uses PDF.js to split into individual pages
   * For images, returns the image as a single page
   */
  private async splitIntoPages(file: File | Blob): Promise<Blob[]> {
    const moduleLogger = this.logger.withMetadata({
      method: 'splitIntoPages',
      fileType: file.type,
      fileSize: file.size,
    });

    // Handle images as single page
    if (file.type.startsWith('image/')) {
      moduleLogger.debug('Image file detected, treating as single page');
      return [file];
    }

    // Handle PDFs with PDF.js
    if (file.type === 'application/pdf') {
      moduleLogger.info('PDF file detected, splitting into pages');
      try {
        // Only import PDF.js dynamically when needed
        const pdfjsLib = await import('pdfjs-dist');
        
        // Set PDF.js worker source
        const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs');
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
        
        // Load the PDF file
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const pageCount = pdf.numPages;
        moduleLogger.info(`PDF contains ${pageCount} pages`);
        
        // Extract each page as a canvas and convert to image blob
        const pages: Blob[] = [];
        
        for (let i = 1; i <= pageCount; i++) {
          const page = await pdf.getPage(i);
          
          // Calculate viewport scaling - target width of 1200px
          const viewport = page.getViewport({ scale: 1.0 });
          const scale = 1200 / viewport.width;
          const scaledViewport = page.getViewport({ scale });
          
          // Create canvas
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) {
            throw new Error('Failed to get 2D rendering context for canvas');
          }
          canvas.height = scaledViewport.height;
          canvas.width = scaledViewport.width;
          
          // Render PDF page to canvas
          await page.render({
            canvasContext: context,
            viewport: scaledViewport
          }).promise;
          
          // Convert canvas to blob
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => {
              if (b) {
                resolve(b);
              } else {
                reject(new Error('Failed to convert canvas to blob'));
              }
            }, 'image/png', 0.95);
          });
          
          pages.push(blob);
          moduleLogger.debug(`Extracted page ${i}/${pageCount}`);
          
          // Clean up to avoid memory leaks
          page.cleanup();
        }
        
        // Close PDF document
        pdf.destroy();
        
        moduleLogger.info(`Successfully split PDF into ${pages.length} pages`);
        return pages;
      } catch (error) {
        moduleLogger.error('Error splitting PDF file', {}, error);
        // If PDF splitting fails, fall back to treating it as a single blob
        moduleLogger.warn('Falling back to processing PDF as single document');
        return [file];
      }
    }
    
    // Handle other document types
    moduleLogger.debug('Non-PDF document detected, treating as single page');
    return [file];
  }

  /**
   * Process multiple pages in parallel with dynamic concurrency and progress tracking
   */
  private async processPages(
    pages: Blob[],
    options: GeminiOCROptions
  ): Promise<OCRPage[]> {
    const results: OCRPage[] = [];
    const moduleLogger = this.logger.withMetadata({
      method: 'processPages',
      pageCount: pages.length,
    });
    
    // Determine optimal concurrency based on page count and sizes
    const determineConcurrency = (pages: Blob[]): number => {
      // Base concurrency on total pages
      if (pages.length <= 3) return 1;
      if (pages.length <= 10) return 2;
      if (pages.length <= 20) return 3;
      
      // For very large documents, limit to 4 concurrent pages to avoid rate limits
      return 4;
    };
    
    // Get optimal concurrency
    const baseConcurrency = determineConcurrency(pages);
    let concurrencyLimit = baseConcurrency;
    moduleLogger.info(`Processing ${pages.length} pages with concurrency ${concurrencyLimit}`);
    
    // Dynamic batching function - allows adaptive sizing
    const processBatch = async (startIdx: number, endIdx: number): Promise<OCRPage[]> => {
      const batch = pages.slice(startIdx, endIdx);
      const pageNumbers = Array.from(
        { length: batch.length },
        (_, idx) => startIdx + idx + 1
      );
      
      const batchStartTime = Date.now();
      moduleLogger.debug(`Processing batch: pages ${startIdx+1}-${endIdx} (${batch.length} pages)`);
      
      try {
        // Process batch in parallel
        const batchPromises = batch.map((page, idx) => {
          // Add progress indicator to options
          const pageOptions = {
            ...options,
            progressCallback: options.progressCallback 
              ? (progress: ProcessingProgress) => {
                  if (options.progressCallback) {
                    options.progressCallback({
                      overall: ((startIdx + idx) + (progress.pageProgress ?? 0) / 100) / pages.length * 100,
                      page: pageNumbers[idx],
                      pageProgress: progress.pageProgress,
                      stage: progress.stage
                    });
                  }
                } 
              : undefined
          };
          
          return this.processPage(page, pageNumbers[idx], pageOptions);
        });
        
        // Wait for all pages in this batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Track processing time for adaptive concurrency
        const batchTime = Date.now() - batchStartTime;
        const avgTimePerPage = batchTime / batch.length;
        
        // Adaptive concurrency - adjust based on performance
        if (avgTimePerPage > 10000) { // If pages take > 10 seconds each
          concurrencyLimit = Math.max(1, concurrencyLimit - 1);
          moduleLogger.debug(`Pages taking too long (${avgTimePerPage.toFixed(0)}ms), reducing concurrency to ${concurrencyLimit}`);
        } else if (avgTimePerPage < 3000 && concurrencyLimit < 4) { // If pages are fast
          concurrencyLimit = Math.min(4, concurrencyLimit + 1);
          moduleLogger.debug(`Pages processing quickly (${avgTimePerPage.toFixed(0)}ms), increasing concurrency to ${concurrencyLimit}`);
        }
        
        moduleLogger.debug(`Batch completed: pages ${startIdx+1}-${endIdx} in ${batchTime}ms (avg ${avgTimePerPage.toFixed(0)}ms per page)`);
        return batchResults;
      } catch (error) {
        moduleLogger.error(`Error processing batch ${startIdx+1}-${endIdx}`, {}, error);
        // If batch fails completely, process one by one to isolate failures
        const fallbackResults: OCRPage[] = [];
        for (let i = 0; i < batch.length; i++) {
          try {
            const result = await this.processPage(batch[i], pageNumbers[i], options);
            fallbackResults.push(result);
          } catch (pageError) {
            // Create error placeholder for failed pages
            fallbackResults.push({
              page_number: pageNumbers[i],
              text: `Error processing page ${pageNumbers[i]}: ${pageError instanceof Error ? pageError.message : String(pageError)}`,
              tables: [],
              metadata: {
                error: pageError instanceof Error ? pageError.message : String(pageError),
                batch_recovery: true
              }
            });
          }
        }
        return fallbackResults;
      }
    };
    
    // Process all pages in adaptive batches
    for (let i = 0; i < pages.length;) {
      const endIdx = Math.min(i + concurrencyLimit, pages.length);
      const batchResults = await processBatch(i, endIdx);
      results.push(...batchResults);
      
      // Report progress
      const progress = (endIdx / pages.length) * 100;
      moduleLogger.debug(`Overall progress: ${progress.toFixed(0)}% (${endIdx}/${pages.length} pages)`);
      
      // Move to next batch
      i = endIdx;
    }
    
    moduleLogger.info(`Completed processing ${pages.length} pages`);
    return results;
  }

  /**
   * Process a single page with Gemini
   */
  private async processPage(
    page: Blob,
    pageNumber: number,
    options: GeminiOCROptions
  ): Promise<OCRPage> {
    const moduleLogger = this.logger.withMetadata({
      method: 'processPage',
      pageNumber,
      pageSize: page.size,
    });

    // Report initial progress
    if (options.progressCallback) {
      options.progressCallback({
        overall: 0, // Default to 0, caller can override with their calculation
        page: pageNumber,
        pageProgress: 5,
        stage: `Preparing page ${pageNumber}`
      });
    }

    // Check cache first if caching is enabled
    const cacheKey = await this.getCacheKey(page, pageNumber, options);
    if (cacheKey && options.useCache !== false) {
      const cachedPage = this.cache.get(cacheKey);
      if (cachedPage) {
        moduleLogger.info('Using cached page result', { pageNumber, cacheKey });
        
        // Report progress for cached result
        if (options.progressCallback) {
          options.progressCallback({
            overall: 100, // Cached results are complete
            page: pageNumber,
            pageProgress: 100,
            stage: `Page ${pageNumber} loaded from cache`
          });
        }
        
        return cachedPage;
      }
    }

    try {
      moduleLogger.info('Processing page with Gemini');
      
      // Report progress
      if (options.progressCallback) {
        options.progressCallback({
          overall: 20,
          page: pageNumber,
          pageProgress: 20,
          stage: `Converting page ${pageNumber} data`
        });
      }
      
      // Convert Blob to Base64 for sending to Gemini
      const arrayBuffer = await page.arrayBuffer();
      const base64Data = this.arrayBufferToBase64(arrayBuffer);
      const mimeType = page.type || 'application/octet-stream';
      
      // Estimate if the image is large and might need special handling
      const isLargeImage = page.size > 4 * 1024 * 1024; // 4MB threshold
      
      // Report progress
      if (options.progressCallback) {
        options.progressCallback({
          overall: 30,
          page: pageNumber,
          pageProgress: 30,
          stage: `Submitting page ${pageNumber} to Gemini`
        });
      }
      
      // Get model and generate content
      moduleLogger.info('Generating content with Gemini', { 
        model: this.modelName,
        imageSize: base64Data.length,
        isLargeImage
      });
      
      // Create prompt with detailed instructions
      const prompt = this.createExtractionPrompt(pageNumber, options);
      
      // Calculate token limit (adaptive based on options or document size)
      const tokenLimit = options.tokenLimit ?? (isLargeImage ? 8192 : 10240);
      
      // Define generation config for structured output
      const generationConfig = {
        temperature: options.temperature ?? 0.0,
        maxOutputTokens: tokenLimit,
        responseMimeType: "application/json",
      };
      
      // Report progress
      if (options.progressCallback) {
        options.progressCallback({
          overall: 40,
          page: pageNumber,
          pageProgress: 40,
          stage: `Gemini processing page ${pageNumber}`
        });
      }
      
      // Call the Gemini API
      const startTime = Date.now();
      
      // Get model with generation config
      const configuredModel = this.genAI.getGenerativeModel({ 
        model: this.modelName,
        generationConfig
      });
      
      // Call generateContent with proper format
      const result = await configuredModel.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: base64Data
          }
        }
      ]);
      
      const processingTime = Date.now() - startTime;
      
      // Report progress
      if (options.progressCallback) {
        options.progressCallback({
          overall: 75,
          page: pageNumber,
          pageProgress: 75,
          stage: `Parsing results from page ${pageNumber}`
        });
      }
      
      // Get response text
      const response = result.response;
      const responseText = response.text();
      
      // Parse response as JSON
      let pageData: OCRPage;
      try {
        const parsedResponse = JSON.parse(responseText);
        // Validate with Zod schema
        pageData = OCRPageSchema.parse(parsedResponse);
        
        // Add processing metadata
        if (!pageData.metadata) {
          pageData.metadata = {};
        }
        
        // Add processing time to metadata
        pageData.metadata.processing_time_ms = processingTime;
        pageData.metadata.processing_tokens = responseText.length / 4; // Rough estimate
        
        // Analyze text quality (approximate)
        const textQualityMetrics = this.analyzeTextQuality(pageData.text);
        pageData.metadata.text_quality = textQualityMetrics.qualityScore;
        pageData.metadata.analysis = textQualityMetrics;
        
      } catch (parseError) {
        moduleLogger.error('Failed to parse Gemini response', { 
          responseTextLength: responseText.length,
          responsePreview: responseText.substring(0, 500) 
        }, parseError);
        
        throw new ValidationError({
          message: 'Invalid Gemini OCR response format',
          code: 'INVALID_GEMINI_RESPONSE',
          data: {
            responsePreview: responseText.substring(0, 500),
            pageNumber,
            parseError: parseError instanceof Error ? parseError.message : String(parseError)
          },
          cause: parseError
        });
      }
      
      // Ensure page number is correct (just in case model didn't set it properly)
      pageData.page_number = pageNumber;
      
      // Report completion progress
      if (options.progressCallback) {
        options.progressCallback({
          overall: 100,
          page: pageNumber,
          pageProgress: 100,
          stage: `Page ${pageNumber} complete`
        });
      }
      
      // Store in cache if caching is enabled and we have a key
      if (cacheKey && options.useCache !== false) {
        this.cache.set(cacheKey, pageData);
        moduleLogger.debug('Cached page result', { pageNumber, cacheKey });
      }
      
      moduleLogger.info('Page processing completed successfully', {
        pageNumber,
        processingTime: `${processingTime}ms`,
        extractedTextLength: pageData.text.length,
        tablesExtracted: pageData.tables?.length || 0
      });
      
      return pageData;
      
    } catch (error) {
      moduleLogger.error('Failed to process page with Gemini', { pageNumber }, error);
      
      // Report error progress
      if (options.progressCallback) {
        options.progressCallback({
          overall: 100, // Mark as complete even though it errored
          page: pageNumber,
          pageProgress: 100,
          stage: `Error processing page ${pageNumber}`
        });
      }
      
      // Return a minimal valid page to avoid breaking the pipeline
      return {
        page_number: pageNumber,
        text: `Error processing page ${pageNumber}: ${error instanceof Error ? error.message : String(error)}`,
        tables: [],
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          error_code: error instanceof Error && 'code' in error ? (error as any).code : 'UNKNOWN_ERROR',
          error_type: error instanceof Error ? error.constructor.name : 'Unknown',
          processing_time_ms: Date.now(), // Just to maintain the schema consistency
        }
      };
    }
  }
  
  /**
   * Analyze text quality using heuristics
   * This returns an approximate quality score based on text characteristics
   */
  private analyzeTextQuality(text: string): {
    qualityScore: number;
    textLength: number;
    averageWordLength: number;
    recognizedStructure: boolean;
    emptyLines: number;
    potentialErrors: number;
  } {
    if (!text || text.length === 0) {
      return {
        qualityScore: 0,
        textLength: 0,
        averageWordLength: 0,
        recognizedStructure: false,
        emptyLines: 0,
        potentialErrors: 0
      };
    }
    
    // Basic text statistics
    const lines = text.split('\n');
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const emptyLines = lines.filter(line => line.trim().length === 0).length;
    const totalWordLength = words.reduce((sum, word) => sum + word.length, 0);
    const averageWordLength = words.length > 0 ? totalWordLength / words.length : 0;
    
    // Check for recognized structure (paragraphs, headings, etc.)
    const hasRecognizedStructure = lines.some(line => 
      line.match(/^(section|chapter|title|patient|doctor|summary|assessment|plan):/i) ||
      line.match(/^(#|##|###)/) ||
      line.match(/^[A-Z][A-Z\s]+:/)
    );
    
    // Check for potential errors (unusual characters, very short lines)
    const potentialErrors = text.match(/[^\x20-\x7E\n\r\t]/g)?.length || 0;
    const shortLines = lines.filter(line => line.trim().length > 0 && line.trim().length < 5).length;
    
    // Calculate quality score (0-1 scale)
    let qualityScore = 0.9; // Start with assumption of good quality
    
    // Deduct for empty lines (proportionally)
    if (lines.length > 0) {
      qualityScore -= (emptyLines / lines.length) * 0.2;
    }
    
    // Deduct for potential errors (proportionally)
    if (text.length > 0) {
      qualityScore -= (potentialErrors / text.length) * 10; // Weighted more heavily
    }
    
    // Deduct for short lines that might indicate OCR errors
    if (lines.length > 0) {
      qualityScore -= (shortLines / lines.length) * 0.2;
    }
    
    // Bonus for recognized structure
    if (hasRecognizedStructure) {
      qualityScore += 0.1;
    }
    
    // Normalize result between 0 and 1
    qualityScore = Math.max(0, Math.min(1, qualityScore));
    
    return {
      qualityScore,
      textLength: text.length,
      averageWordLength,
      recognizedStructure: hasRecognizedStructure,
      emptyLines,
      potentialErrors: potentialErrors + shortLines,
    };
  }

  /**
   * Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Create the extraction prompt for Gemini
   */
  private createExtractionPrompt(pageNumber: number, options: GeminiOCROptions): string {
    const tableInstructions = options.extractTables
      ? "Identify and extract any tables in the document. For each table, create a 2D array representation where each inner array is a row of cells."
      : "";
    
    const sectionInstructions = options.detectSections
      ? "Identify any section headers or document structure. Include the detected sections in the metadata.section_types array."
      : "";
    
    return `
    # Medical Document OCR Extraction

    ## Task
    Extract text and structured information from this medical document page.

    ## Page Information
    Page Number: ${pageNumber}

    ## Extraction Instructions
    1. Extract all text content from the document, preserving the original structure as much as possible.
    2. ${tableInstructions}
    3. ${sectionInstructions}
    4. Extract metadata such as patient name, document date, and doctor name if present.
    5. Preserve line breaks and paragraph structure.

    ## Output Format
    Return a JSON object with the following structure:
    {
      "page_number": ${pageNumber},
      "text": "The full extracted text from the document",
      "tables": [
        [["Header1", "Header2"], ["Cell1", "Cell2"], ...]
      ],
      "metadata": {
        "patient_name": "Name if found",
        "document_date": "Date if found",
        "doctor_name": "Doctor name if found",
        "document_type": "Type of document if identified",
        "section_types": ["Section1", "Section2", ...]
      }
    }
    
    If any field is not found in the document, omit it from the JSON or set it to null.
    Be accurate and extract as much information as possible.
    `;
  }

  /**
   * Calculate realistic confidence scores based on text quality analysis
   * Unlike the previous hard-coded 0.9, this uses actual quality metrics
   */
  private calculateAverageConfidence(pages: OCRPage[]): number {
    if (!pages || pages.length === 0) {
      return 0;
    }
    
    // Calculate average confidence from page quality metrics
    let totalConfidence = 0;
    let pagesWithMetrics = 0;
    
    for (const page of pages) {
      // Get quality metric from metadata if available
      if (page.metadata?.text_quality !== undefined) {
        totalConfidence += page.metadata.text_quality as number;
        pagesWithMetrics++;
      } 
      // Check for error pages
      else if (page.metadata?.error !== undefined) {
        // Error pages get low confidence
        totalConfidence += 0.2;
        pagesWithMetrics++;
      }
      // If no quality metrics, use heuristics based on text content
      else if (page.text) {
        const textQualityMetrics = this.analyzeTextQuality(page.text);
        totalConfidence += textQualityMetrics.qualityScore;
        pagesWithMetrics++;
      }
    }
    
    // Calculate average, default to 0.7 if no metrics available
    const averageConfidence = pagesWithMetrics > 0
      ? totalConfidence / pagesWithMetrics
      : 0.7;
    
    return averageConfidence;
  }
}

// Export singleton instance
export const geminiOCRClient = new GeminiOCRClient();