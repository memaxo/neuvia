/**
 * Unified Document Processing Service
 * 
 * Single entry point for all document processing operations across the application.
 * This service consolidates functionality for:
 * - DataExtractor (text extraction from various file formats)
 * - DocumentExtraction (document processing)
 * - DocumentProcessingService (workflow logic removed to unify in one place)
 */
import { createBrowserClient } from '@/lib/supabase/clients';
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { perplexityService } from '@/lib/services/perplexity/perplexity-service';
import { verificationService } from '@/lib/services/verification/verification-service';
import { getDbCompatibleMetadata } from '@/lib/processing/types/verification';
import { workflowManager } from '@/lib/utils/workflow-manager';
import { LLMChain } from "@langchain/core/chains";
import { PromptTemplate } from "@langchain/core/prompts";
import { langChainCore } from '@/lib/langchain/core';
import { createWorkflowCallbacks, runWithWorkflow } from "@/lib/utils/langchain";

// Import types from specific modules
import type { DocumentType, ProcessingStatus } from '@/lib/processing/types/base';
import type { ExtractedData, ExtractedDocument } from '@/lib/processing/types/extraction';
import type { WorkflowStep, ChatWorkflowStep } from '@/lib/processing/types/workflow';
import type { 
  VerificationItem,
  VerificationStatus,
  VerifiedDocument
} from '@/lib/processing/types/verification';
import type { ResearchResult, ResearchOptions } from '@/lib/processing/types/research';
import type { ReportData, ReportOptions } from '@/lib/processing/types/report';
import type { WorkflowOptions } from '@/lib/utils/workflow-manager';
import type { Json } from '@/lib/supabase';

// Define valid document categories to match the database enum
type DocumentCategory = 'clinical' | 'lab' | 'imaging' | 'prescription' | 'administrative';

/**
 * Document processing options
 */
interface DocumentProcessingOptions {
  /**
   * Document type categorization
   */
  documentType?: DocumentType;

  /**
   * Callback for status updates during processing
   */
  onStatusUpdate?: (status: ProcessingStatus) => void;

  /**
   * Additional metadata for the document
   */
  metadata?: Record<string, any>;

  /**
   * Whether this is a patient document
   */
  isPatientDocument?: boolean;

  /**
   * Patient ID if this is a patient document
   */
  patientId?: string;

  /**
   * Department ID if relevant
   */
  departmentId?: string;
}

/**
 * Document service options
 */
export interface DocumentServiceOptions extends WorkflowOptions {
  /**
   * Callback for progress updates
   */
  onProgress?: (progress: number) => void;
}

/**
 * Document Upload Result
 */
export interface DocumentUploadResult {
  /**
   * Document ID
   */
  documentId: string;

  /**
   * File name
   */
  fileName: string;
}

/**
 * Unified Document Processing Service
 * Handles all document processing operations through a standardized interface
 */
export class DocumentService {
  private supabase = createBrowserClient();

  /**
   * Max file size for document extraction (10MB)
   */
  private readonly maxFileSize = 10 * 1024 * 1024;

  /**
   * Supported document types for extraction
   */
  private readonly supportedTypes = [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  /**
   * Extract text from a document file
   * 
   * @param file File to extract text from
   * @param onStatusUpdate Optional status update callback
   * @returns Extracted text
   */
  async extractText(file: File, onStatusUpdate?: (status: ProcessingStatus) => void): Promise<string> {
    try {
      const fileType = file.type;
      let text = '';

      onStatusUpdate?.({
        status: 'processing',
        progress: 10,
        currentStep: 'Starting document extraction'
      });

      // Validate file
      if (!this.supportedTypes.includes(fileType)) {
        throw new Error(`Unsupported file type: ${fileType}`);
      }

      if (file.size > this.maxFileSize) {
        throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`);
      }

      // Create a blob from the file for processing
      const blob = new Blob([await file.arrayBuffer()], { type: fileType });

      switch (fileType) {
        case 'application/pdf': {
          onStatusUpdate?.({
            status: 'processing',
            progress: 30,
            currentStep: 'Processing PDF document'
          });
          const loader = new WebPDFLoader(blob, {
            splitPages: false,
            parsedItemSeparator: " "
          });
          const docs = await loader.load();
          text = docs.map(doc => doc.pageContent).join('\n');
          break;
        }
        case 'text/plain': {
          onStatusUpdate?.({
            status: 'processing',
            progress: 30,
            currentStep: 'Processing text document'
          });
          const textContent = await file.text();
          const loader = new TextLoader(new Blob([textContent], { type: 'text/plain' }));
          const docs = await loader.load();
          text = docs[0].pageContent;
          break;
        }
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
          onStatusUpdate?.({
            status: 'processing',
            progress: 30,
            currentStep: 'Processing Word document'
          });
          const loader = new DocxLoader(blob, {
            type: fileType === 'application/msword' ? 'doc' : 'docx'
          });
          const docs = await loader.load();
          text = docs[0].pageContent;
          break;
        }
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      onStatusUpdate?.({
        status: 'success',
        progress: 100,
        currentStep: 'Document extraction completed'
      });

      return text;
    } catch (error) {
      console.error('Error extracting text:', error);
      onStatusUpdate?.({
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Failed to extract text'
      });
      throw error;
    }
  }

  /**
   * Validate file type against supported types
   * 
   * @param file File to validate
   * @returns Whether the file type is supported
   */
  async validateFileType(file: File): Promise<boolean> {
    return this.supportedTypes.includes(file.type);
  }

  /**
   * Validate file size against maximum allowed size
   * 
   * @param file File to validate
   * @param maxSizeMB Maximum allowed size in MB
   * @returns Whether the file size is acceptable
   */
  async validateFileSize(file: File, maxSizeMB: number = 10): Promise<boolean> {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
  }

  /**
   * Legacy wrapper: Process a document for extraction (compatibility).
   * Now simply calls processDocumentWithOptions with minimal workflow logic removed.
   * 
   * @param file Document file to process
   * @param patientId Optional patient ID
   * @param documentType Optional document type
   * @param onStatusUpdate Optional status update callback
   * @returns ExtractedDocument
   */
  async processDocument(
    file: File,
    patientId?: string,
    documentType?: DocumentType,
    onStatusUpdate?: (status: ProcessingStatus) => void,
  ): Promise<ExtractedDocument> {
    const result = await this.processDocumentWithOptions(file, {
      patientId,
      documentType,
      onStatusUpdate,
      isPatientDocument: !!patientId
    });
    return result;
  }

  /**
   * Unified method to handle text extraction, type detection, and building an ExtractedDocument
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
      // Extract text
      onStatusUpdate({
        status: 'processing',
        progress: 10,
        currentStep: 'Extracting text from document',
        phase: 'extraction'
      });

      const rawText = await this.extractText(file, (status) => {
        // Map the progress to 10-50% range
        onStatusUpdate({
          ...status,
          progress: 10 + status.progress * 0.4,
          phase: 'extraction'
        });
      });

      // Document type detection (fallback if not provided)
      const documentType = options?.documentType || await this.detectDocumentType(rawText);

      onStatusUpdate({
        status: 'processing',
        progress: 50,
        currentStep: 'Analyzing document content',
        phase: 'analysis'
      });

      // Build extracted data
      const extractedData: ExtractedData = {
        rawText,
        metadata: {
          docType: `${documentType.category}-${documentType.type}`,
          extractedAt: new Date(),
          filename: file.name,
          fileFormat: file.type,
          fileSize: file.size,
          ...options?.metadata
        },
        chunks: [
          {
            content: rawText,
            pageNumber: 1
          }
        ]
      };

      // Construct final extracted document
      const extractedDocument: ExtractedDocument = {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        documentType,
        patientId: options?.patientId,
        extractedData,
        isSuccessful: true
      };

      onStatusUpdate({
        status: 'success',
        progress: 100,
        currentStep: 'Document extraction completed',
        phase: 'extraction'
      });

      return extractedDocument;
    } catch (error) {
      console.error('Error processing document:', error);
      // Return an error-labeled extracted document
      const errorMessage = error instanceof Error ? error.message : String(error);
      onStatusUpdate({
        status: 'error',
        progress: 0,
        error: errorMessage,
        phase: 'extraction'
      });

      return {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        documentType: options?.documentType || { category: 'unknown', type: 'unknown' },
        patientId: options?.patientId,
        extractedData: {
          rawText: '',
          metadata: {
            extractedAt: new Date(),
            error: errorMessage
          }
        },
        isSuccessful: false,
        errorMessage
      };
    }
  }

  /**
   * Detect document type from content (stubbed out with default)
   * @param content Document content
   * @returns Detected document type
   */
  private async detectDocumentType(content: string): Promise<DocumentType> {
    // In real usage, this might do advanced classification. For now, we stub.
    return {
      category: 'clinical',
      type: 'note'
    };
  }

  /**
   * Save an extracted document to the database
   */
  async saveDocument(extractedDocument: ExtractedDocument): Promise<string> {
    // Ensure category is one of the valid enum values
    const category = extractedDocument.documentType.category as DocumentCategory;
    if (!['clinical', 'lab', 'imaging', 'prescription', 'administrative'].includes(category)) {
      // Default to clinical if not a valid category
      console.warn(`Invalid category: ${category}, defaulting to 'clinical'`);
    }

    const { data, error } = await this.supabase.from('patient_documents').insert({
      patient_id: extractedDocument.patientId,
      title: `Document ${extractedDocument.documentType.category} - ${extractedDocument.documentType.type}`,
      category: (category as DocumentCategory) || 'clinical',
      document_type: getDbCompatibleMetadata(extractedDocument.documentType) as Json,
      file_path: extractedDocument.extractedData.metadata.filename || 'unknown-file',
      file_type: extractedDocument.extractedData.metadata.fileFormat || 'application/pdf',
      file_size: extractedDocument.extractedData.metadata.fileSize || 0,
      checksum: `generated-${Date.now().toString()}`,
      document_date: new Date().toISOString().split('T')[0],
      content_text: extractedDocument.extractedData.rawText,
      metadata: getDbCompatibleMetadata(extractedDocument.extractedData.metadata) as Json,
      processing_status: extractedDocument.isSuccessful ? 'completed' : 'failed',
      is_processed: extractedDocument.isSuccessful,
      processing_error: extractedDocument.errorMessage
    }).select('id').single();
    
    if (error) {
      console.error('Error saving document:', error);
      throw new Error(`Failed to save document: ${error.message}`);
    }
    
    return data.id;
  }

  /**
   * Upload a file for a patient, storing in Supabase, then optionally invoke a serverless function
   * Uses workflow manager for progress updates and state management.
   */
  async uploadDocument(
    patientId: string,
    file: File, 
    options?: DocumentServiceOptions
  ): Promise<DocumentUploadResult> {
    // Use workflow manager to handle the operation
    return workflowManager.handleWorkflowOperation<DocumentUploadResult>(
      null, // No workflow ID for this operation
      'extraction' as WorkflowStep, // Current step (using extraction as the main workflow step)
      async () => {
        workflowManager.reportProgress(options, 'upload', 0);

        // Upload file to Supabase storage
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = `patient-documents/${patientId}/${fileName}`;

        const { error: uploadError } = await this.supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        workflowManager.reportProgress(options, 'upload', 50);

        // Create a signed URL
        const { data: urlData } = await this.supabase.storage
          .from('documents')
          .createSignedUrl(filePath, 60 * 60);

        if (!urlData?.signedUrl) {
          throw new Error('Failed to generate signed URL');
        }

        workflowManager.reportProgress(options, 'upload', 70);

        // Insert a new record in patient_documents (bare-bones, no workflow references)
        const { data: docData, error: docError } = await this.supabase
          .from('patient_documents')
          .insert({
            patient_id: patientId,
            file_name: file.name,
            file_type: file.type, 
            file_size: file.size,
            storage_path: filePath,
            title: file.name,
            category: 'clinical', // default
            document_type: { 
              category: 'clinical',
              type: 'note'
            },
            file_path: filePath,
            document_date: new Date().toISOString().split('T')[0],
            checksum: 'auto-generated',
            processing_status: 'uploaded'
          })
          .select('id')
          .single();

        if (docError || !docData) {
          throw new Error(`Document record creation failed: ${docError?.message || 'Unknown error'}`);
        }

        workflowManager.reportProgress(options, 'upload', 80);

        // Optionally invoke a serverless function if needed
        await this.supabase.functions.invoke('document-extraction', {
          body: {
            documentId: docData.id,
            fileUrl: urlData.signedUrl,
            fileName: file.name,
            fileType: file.type
          }
        });

        workflowManager.reportProgress(options, 'upload', 100);

        return {
          documentId: docData.id,
          fileName: file.name
        };
      },
      options
    );
  }

  /**
   * Generate verification items from an extracted document (delegates to verificationService)
   * 
   * @deprecated This method will be removed as we transition to summary-based verification.
   * Use patientSummaryService for verification instead.
   */
  generateVerificationItems(document: ExtractedDocument): VerificationItem[] {
    return verificationService.generateVerificationItems(document);
  }

  /**
   * Create a verified document from an extracted document
   * 
   * @deprecated This method will be removed as we transition to summary-based verification.
   * Use patientSummaryService for verification instead.
   */
  createVerifiedDocument(
    document: ExtractedDocument,
    items: VerificationItem[],
    status: VerificationStatus
  ): VerifiedDocument {
    return {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      documentType: document.documentType,
      patientId: document.patientId,
      extractedDocumentId: document.id,
      verificationItems: items,
      originalData: document.extractedData.rawText,
      verifiedData: verificationService.assembleVerifiedData(items),
      verificationStatus: status,
      _uiState: {
        isUIVerificationComplete: true,
        uiVerifiedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Save an extracted document to DB as "patient_documents" record
   * and produce a verified document if needed.
   * Uses workflow manager for state management.
   * 
   * @deprecated This method will be removed as we transition to summary-based verification.
   * Use patientSummaryService.verifySummary for verification instead.
   */
  async saveVerificationResults(
    items: VerificationItem[], 
    status: VerificationStatus,
    document: ExtractedDocument
  ): Promise<VerifiedDocument> {
    return workflowManager.handleWorkflowOperation<VerifiedDocument>(
      null, // No workflow ID
      'verification', // Current step
      async () => {
        // Use verificationService to store results with simplified signature
        return verificationService.saveVerificationResults(
          '', // workflowId no longer used
          items,
          status,
          document
        );
      }
    );
  }

  /**
   * Perform additional research on a query, using perplexityService
   * Uses workflow manager for state management.
   */
  async performResearch(
    query: string,
    verifiedDocument: VerifiedDocument,
    options?: ResearchOptions & { provider?: string }
  ): Promise<ResearchResult> {
    return workflowManager.handleWorkflowOperation<ResearchResult>(
      null, // No workflow ID
      'research', // Current step
      async () => {
        workflowManager.reportProgress(options, 'research', 0);
        try {
          const result = await perplexityService.performDeepResearch(query, {
            ...options,
            patientData: JSON.stringify(verifiedDocument.verifiedData)
          });
          return result;
        } catch (error) {
          console.error("Research error:", error);
          return {
            text: `Research failed: ${error instanceof Error ? error.message : String(error)}`,
            sources: [],
            summary: `Research failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
      options
    );
  }

  /**
   * Perform medical diagnosis using perplexityService
   * Uses workflow manager for state management.
   */
  public async performMedicalDiagnosis(
    documentId: string,
    additionalContext?: string,
    options?: ResearchOptions
  ): Promise<ResearchResult> {
    return workflowManager.handleWorkflowOperation<ResearchResult>(
      null, // No workflow ID
      'research' as WorkflowStep, // Use research as the step for diagnosis
      async () => {
        // Build request to use the consolidated perplexity endpoint
        const response = await fetch('/api/perplexity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId,
            query: additionalContext,
            options: {
              ...options,
              isMedicalDiagnosis: true,
              depth: options?.depth || 'comprehensive'
            }
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Medical diagnosis failed: ${error.error || 'Unknown error'}`);
        }

        const result = await response.json();
        return result;
      }
    );
  }

  /**
   * Process document using Langchain for improved classification and extraction
   */
  async processDocumentWithLangchain(
    file: File,
    options?: DocumentProcessingOptions
  ): Promise<ExtractedDocument> {
    return runWithWorkflow(
      'extraction' as WorkflowStep,
      async () => {
        // Extract text first (using existing method)
        const rawText = await this.extractText(file, options?.onStatusUpdate);
        
        // Create a document classification chain
        const llm = langChainCore.createChatOpenAI({
          temperature: 0.2,
          callbacks: createWorkflowCallbacks(
            null, 
            'extraction',
            { onProgress: progress => {
              options?.onStatusUpdate?.({
                status: 'processing',
                progress,
                phase: 'extraction'
              });
            }}
          )
        });
        
        const classificationPrompt = PromptTemplate.fromTemplate(
          `Classify this medical document based on content:\n\n{text}\n\n` +
          `Respond with a JSON object in this format:\n` +
          `{\n  "category": "clinical|lab|imaging|prescription|administrative",\n` +
          `  "type": "note|report|letter|result|scan|prescription",\n` +
          `  "confidence": 0.1-1.0\n}`
        );
        
        const classificationChain = new LLMChain({
          llm,
          prompt: classificationPrompt,
        });
        
        const { text: classificationResult } = await classificationChain.call({
          text: rawText.substring(0, 2000) // First 2000 chars for classification
        });
        
        // Parse the classification result
        const documentType = this.parseDocumentType(classificationResult) || {
          category: options?.documentType?.category || "clinical",
          type: options?.documentType?.type || "note"
        };
        
        // Build extracted document (similar to existing code)
        const extractedData: ExtractedData = {
          rawText,
          metadata: {
            docType: `${documentType.category}-${documentType.type}`,
            extractedAt: new Date(),
            filename: file.name,
            fileFormat: file.type,
            fileSize: file.size,
            ...options?.metadata,
            extractionMethod: 'langchain'
          },
          chunks: [
            {
              content: rawText,
              pageNumber: 1
            }
          ]
        };
        
        // Construct final extracted document
        const extractedDocument: ExtractedDocument = {
          id: crypto.randomUUID(),
          createdAt: new Date(),
          documentType,
          patientId: options?.patientId,
          extractedData,
          isSuccessful: true
        };
        
        return extractedDocument;
      },
      {
        onProgress: (progress: number) => {
          options?.onStatusUpdate?.({
            status: 'processing',
            progress,
            phase: 'extraction'
          });
        },
        onError: (error: unknown) => {
          options?.onStatusUpdate?.({
            status: 'error',
            progress: 0,
            error: error instanceof Error ? error.message : String(error),
            phase: 'extraction'
          });
        }
      }
    );
  }
  
  /**
   * Helper method to parse document type from LLM JSON output
   */
  private parseDocumentType(text: string): DocumentType | null {
    try {
      const result = JSON.parse(text);
      
      if (result.category && result.type) {
        return {
          category: result.category,
          type: result.type,
          metadata: {
            confidence: result.confidence || 0.7
          }
        };
      }
    } catch (error) {
      console.error('Error parsing document type:', error);
    }
    
    return null;
  }
}

// Export singleton instance
export const documentService = new DocumentService(); 