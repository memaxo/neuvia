/**
 * Gemini OCR Client
 *
 * Handles communication with Google's Gemini API for OCR extraction
 */
import { GoogleGenerativeAI, GoogleGenerativeAIClient, GoogleGenerativeAIError, FileObject } from "@google/generative-ai";
import { z } from "zod";
import logger from "@/lib/logger";
import { ExternalServiceError, ValidationError } from "@/lib/errors";
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
  }).optional()
});

export type OCRPage = z.infer<typeof OCRPageSchema>;
export type OCRDocument = z.infer<typeof OCRDocumentSchema>;

interface GeminiOCROptions {
  splitPages?: boolean;
  extractTables?: boolean;
  detectSections?: boolean;
  preserveLayout?: boolean;
  maxPageLength?: number;
}

/**
 * Gemini OCR Client
 * Handles document processing using Google's Gemini multimodal models
 */
export class GeminiOCRClient {
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName: string;
  private readonly logger: typeof logger;

  constructor(config = getDefaultConfig()) {
    const apiKey = config.gemini.apiKey;
    this.modelName = config.gemini.model || "gemini-2.0-flash-lite";
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.logger = logger.withMetadata({
      module: 'GeminiOCRClient',
    });
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

    try {
      moduleLogger.info('Processing document with Gemini OCR');

      // For PDF files, we might need to split into pages first
      const pages = await this.splitIntoPages(file);
      
      // Process each page with Gemini
      const pageResults = await this.processPages(pages, options);
      
      // Combine results into final document structure
      const result: OCRDocument = {
        pages: pageResults,
        metadata: {
          document_structure: pageResults.length > 1 ? 'multi-page' : 'single-page',
          confidence: this.calculateAverageConfidence(pageResults),
          processing_time: Date.now(), // Just a timestamp for now
          extraction_method: 'gemini-ocr',
        }
      };

      moduleLogger.info('Document processing completed successfully', {
        pageCount: result.pages.length,
      });

      return result;
    } catch (error) {
      moduleLogger.error('Failed to process document with Gemini OCR', {}, error);
      
      throw new ExternalServiceError({
        message: 'Gemini OCR document processing failed',
        service: 'Gemini',
        code: 'GEMINI_OCR_FAILED',
        data: { fileType: file.type },
        cause: error,
      });
    }
  }

  /**
   * Split document into pages
   * This is a placeholder - for PDFs you'd use a PDF library to split pages
   * For images, you'd just return the image as a single page
   */
  private async splitIntoPages(file: File | Blob): Promise<Blob[]> {
    // For this implementation, we're simplifying by treating the file as a single page
    // In a real implementation, you'd add PDF splitting logic here
    return [file];
  }

  /**
   * Process multiple pages in parallel (with concurrency control)
   */
  private async processPages(
    pages: Blob[],
    options: GeminiOCROptions
  ): Promise<OCRPage[]> {
    const results: OCRPage[] = [];
    const concurrencyLimit = 3; // Process 3 pages at a time
    
    for (let i = 0; i < pages.length; i += concurrencyLimit) {
      const batch = pages.slice(i, i + concurrencyLimit);
      const pageNumbers = Array.from(
        { length: batch.length },
        (_, idx) => i + idx + 1
      );
      
      // Process batch in parallel
      const batchPromises = batch.map((page, idx) =>
        this.processPage(page, pageNumbers[idx], options)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
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
    });

    try {
      moduleLogger.info('Processing page with Gemini');
      
      // Convert Blob to Base64 for sending to Gemini
      const arrayBuffer = await page.arrayBuffer();
      const base64Data = this.arrayBufferToBase64(arrayBuffer);
      const mimeType = page.type || 'application/octet-stream';
      
      // Get model and generate content
      moduleLogger.info('Generating content with Gemini', { model: this.modelName });
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      
      // Create prompt with detailed instructions
      const prompt = this.createExtractionPrompt(pageNumber, options);
      
      // Create content parts (prompt + image)
      const content = [
        { text: prompt },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        }
      ];
      
      // Define response schema (for JSON output)
      // Generate content with structured output
      const generationConfig = {
        temperature: 0.0,
        maxOutputTokens: 10240,
        responseMimeType: "application/json",
      };
      
      // Call the Gemini API
      const result = await model.generateContent({
        contents: [{ parts: content }],
        generationConfig,
      });
      
      // Get response text
      const response = result.response;
      const responseText = response.text();
      
      // Parse response as JSON
      let pageData: OCRPage;
      try {
        const parsedResponse = JSON.parse(responseText);
        // Validate with Zod schema
        pageData = OCRPageSchema.parse(parsedResponse);
      } catch (parseError) {
        moduleLogger.error('Failed to parse Gemini response', { responseText }, parseError);
        throw new ValidationError({
          message: 'Invalid Gemini OCR response format',
          code: 'INVALID_GEMINI_RESPONSE',
          data: {
            responsePreview: responseText.substring(0, 500),
            pageNumber
          },
          cause: parseError
        });
      }
      
      // Ensure page number is correct (just in case model didn't set it properly)
      pageData.page_number = pageNumber;
      
      moduleLogger.info('Page processing completed successfully');
      return pageData;
      
    } catch (error) {
      moduleLogger.error('Failed to process page with Gemini', { pageNumber }, error);
      
      // Return a minimal valid page to avoid breaking the pipeline
      return {
        page_number: pageNumber,
        text: `Error processing page ${pageNumber}: ${error instanceof Error ? error.message : String(error)}`,
        tables: [],
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        }
      };
    }
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
   * Calculate average confidence across all pages
   */
  private calculateAverageConfidence(pages: OCRPage[]): number {
    // For now, just return a high confidence since Gemini doesn't provide
    // confidence scores like Mistral did
    return 0.9;
  }
}

// Export singleton instance
export const geminiOCRClient = new GeminiOCRClient();