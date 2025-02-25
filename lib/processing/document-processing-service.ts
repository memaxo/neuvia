import { DataExtractor } from './data-extractor';
import type {
  DocumentType,
  ExtractedData,
  ExtractedDocument,
  ProcessingStatus,
  VerificationItem,
  VerifiedDocument,
  VerificationStatus,
  ResearchResult,
  ResearchOptions,
  ReportData,
  ReportOptions
} from './types/index';
import { FirecrawlResearchProvider } from './research/firecrawl-provider';

/**
 * Service for document processing operations throughout the application.
 * Provides a unified interface for extraction, verification, research, and report generation.
 */
export class DocumentProcessingService {
  private dataExtractor = new DataExtractor();
  private researchProvider = new FirecrawlResearchProvider();
  
  /**
   * Process a document for extraction
   * @param file The file to process
   * @param patientId The patient ID associated with the document
   * @param options Processing options
   */
  async processDocument(
    file: File,
    patientId: string,
    options?: {
      documentType?: DocumentType;
      onStatusUpdate?: (status: ProcessingStatus) => void;
    }
  ): Promise<ExtractedDocument> {
    try {
      // Update status
      options?.onStatusUpdate?.({
        status: 'processing',
        progress: 0,
        currentStep: 'Starting document extraction',
        phase: 'extraction'
      });
      
      // Extract text using the DataExtractor
      const { streamData } = await this.dataExtractor.streamExtraction(file);
      const rawText = await streamData.text;
      
      // Update status
      options?.onStatusUpdate?.({
        status: 'processing',
        progress: 50,
        currentStep: 'Processing extracted text',
        phase: 'extraction'
      });
      
      // Create document type if not provided
      const documentType: DocumentType = options?.documentType || {
        category: 'clinical',
        type: 'chat_upload'
      };
      
      // Process the document with the extracted text
      const extractedData: ExtractedData = {
        rawText,
        metadata: {
          docType: `${documentType.category}-${documentType.type}`,
          extractedAt: new Date(),
          filename: file.name,
          fileFormat: file.type,
          fileSize: file.size
        },
        chunks: [
          {
            content: rawText,
          }
        ]
      };
      
      // Update status
      options?.onStatusUpdate?.({
        status: 'success',
        progress: 100,
        currentStep: 'Document extraction completed',
        phase: 'extraction'
      });
      
      // Return the extracted document
      return {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        documentType,
        patientId,
        extractedData,
        isSuccessful: true
      };
      
    } catch (error) {
      // Update status with error
      options?.onStatusUpdate?.({
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : String(error),
        phase: 'extraction'
      });
      
      // Return a document with error information
      return {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        documentType: options?.documentType || {
          category: 'clinical',
          type: 'chat_upload'
        },
        patientId,
        extractedData: {
          rawText: '',
          metadata: {
            extractedAt: new Date(),
            error: error instanceof Error ? error.message : String(error)
          }
        },
        isSuccessful: false,
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Generate verification items from extracted data
   * @param document The extracted document
   */
  generateVerificationItems(document: ExtractedDocument): VerificationItem[] {
    const items: VerificationItem[] = [];
    const { extractedData } = document;
    
    // Helper function to process values and add as verification items
    function addItems(section: string, value: any) {
      if (Array.isArray(value)) {
        value.forEach((item, idx) => {
          items.push({
            id: `${section}-${idx}`,
            section,
            key: `${section}-${idx}`,
            value: item,
            confidence: item.confidence || 0.7, // Default confidence if not specified
            isVerified: false,
          });
        });
      } else if (typeof value === "object" && value !== null) {
        items.push({
          id: `${section}-0`,
          section,
          key: section,
          value,
          confidence: value.confidence || 0.7, // Default confidence
          isVerified: false,
        });
      }
    }
    
    // Process each section of the extracted data
    Object.entries(extractedData).forEach(([sectionKey, sectionValue]) => {
      if (sectionKey !== 'rawText' && sectionKey !== 'metadata' && sectionKey !== 'chunks') {
        addItems(sectionKey, sectionValue);
      }
    });
    
    // If no structured data was found, create items from chunks
    if (items.length === 0 && extractedData.chunks && extractedData.chunks.length > 0) {
      extractedData.chunks.forEach((chunk, index) => {
        items.push({
          id: `chunk-${index}`,
          section: 'content',
          key: `chunk-${index}`,
          value: { content: chunk.content, pageNumber: chunk.pageNumber },
          confidence: 0.7,
          isVerified: false
        });
      });
    }
    
    return items;
  }
  
  /**
   * Assemble verified data from verification items
   * @param items Verification items with potential corrections
   */
  assembleVerifiedData(items: VerificationItem[]): Record<string, any> {
    // Group items by their section
    const grouped: Record<string, any> = {};
    
    items.forEach((item) => {
      // Apply corrections if any
      const correctedValue = item.corrections
        ? { ...item.value, ...item.corrections }
        : item.value;
        
      // Create a section array if it doesn't exist
      if (!grouped[item.section]) {
        grouped[item.section] = [];
      }
      
      // Add the value to the section
      grouped[item.section].push(correctedValue);
    });
    
    // Convert single-item arrays to objects if appropriate
    Object.keys(grouped).forEach((section) => {
      if (grouped[section].length === 1) {
        grouped[section] = grouped[section][0];
      }
    });
    
    return grouped;
  }
  
  /**
   * Create a verified document from an extracted document and verification items
   * @param document The extracted document
   * @param items Verification items
   * @param status Overall verification status
   */
  createVerifiedDocument(
    document: ExtractedDocument, 
    items: VerificationItem[],
    status: VerificationStatus
  ): VerifiedDocument {
    return {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      documentType: document.documentType,
      patientId: document.patientId,
      extractedDocument: document,
      verificationItems: items,
      verifiedData: this.assembleVerifiedData(items),
      verificationStatus: status
    };
  }
  
  /**
   * Perform deep research based on verified data
   * @param query Research query
   * @param verifiedDocument Verified document with data
   * @param options Research options
   */
  async performResearch(
    query: string,
    verifiedDocument: VerifiedDocument,
    options?: ResearchOptions
  ): Promise<ResearchResult> {
    // Update progress at the start
    options?.onProgress?.(0);
    
    try {
      // Perform research using the research provider
      const result = await this.researchProvider.performResearch(query, {
        ...options,
        // Pass along the patient ID for contextual research if available
        patientId: verifiedDocument.patientId,
      });
      
      return result;
    } catch (error) {
      console.error("Research error:", error);
      
      // Return a minimal result with error information
      return {
        query,
        sources: [],
        summary: `Research failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        confidence: 0,
      };
    }
  }
  
  /**
   * Generate a report based on research results
   * @param document The verified document
   * @param researchResults Research results to include in the report
   * @param options Report generation options
   */
  async generateReport(
    document: VerifiedDocument,
    researchResults: ResearchResult[],
    options?: ReportOptions
  ): Promise<ReportData> {
    // This is a placeholder implementation - would be replaced with actual API call
    
    // Update progress for generation phase
    options?.onProgress?.('generation', 0);
    
    // Simulate generation process
    for (let i = 10; i <= 90; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 300));
      options?.onProgress?.('generation', i);
    }
    
    // Mock report generation
    const reportData: ReportData = {
      content: `# Medical Report\n\n## Findings\nPatient shows signs of...\n\n## Recommendations\nFollow-up recommended in 2 weeks.`,
      sources: researchResults.flatMap(r => r.sources),
      patientId: document.patientId || 'unknown',
      generatedAt: new Date(),
      metadata: {
        modelName: "GPT-4",
        confidence: 0.92,
        generationTime: 3.5
      },
      sections: {
        findings: "Patient shows signs of...",
        recommendations: "Follow-up recommended in 2 weeks."
      }
    };
    
    // Complete the generation progress
    options?.onProgress?.('generation', 100);
    
    // If formatting is needed, simulate that process
    if (options?.format && options.format !== 'markdown') {
      for (let i = 10; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        options.onProgress?.('formatting', i);
      }
    }
    
    return reportData;
  }
  
  /**
   * Format a report into the specified format
   * @param report The report data
   * @param format Desired format
   * @param onProgress Progress callback
   */
  async formatReport(
    report: ReportData,
    format: 'markdown' | 'html' | 'pdf',
    onProgress?: (progress: number) => void
  ): Promise<string> {
    // This is a placeholder implementation - would be replaced with actual formatting
    
    // Start progress
    onProgress?.(0);
    
    // Simulate processing time
    for (let i = 10; i <= 90; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      onProgress?.(i);
    }
    
    // Mock implementation based on format
    let formattedReport: string;
    
    switch (format) {
      case 'html':
        formattedReport = `<html><body><h1>Medical Report</h1><h2>Findings</h2><p>${report.sections?.findings || ''}</p><h2>Recommendations</h2><p>${report.sections?.recommendations || ''}</p></body></html>`;
        break;
      case 'pdf':
        // In a real implementation, this would generate a PDF
        formattedReport = `PDF content would go here. Contains: ${report.content}`;
        break;
      case 'markdown':
      default:
        formattedReport = report.content;
        break;
    }
    
    // Complete progress
    onProgress?.(100);
    
    return formattedReport;
  }
} 