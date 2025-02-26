/**
 * Unified Document Processing Service
 * 
 * Single entry point for all document processing operations across the application.
 * This service consolidates functionality from:
 * - DataExtractor (text extraction from various file formats)
 * - DocumentExtraction (document processing)
 * - DocumentProcessingService (workflow management)
 */
import { createBrowserClient } from '@/lib/supabase/clients';
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { randomUUID } from 'crypto';
import { perplexityService } from '@/lib/services/perplexity/perplexity-service';
import { createStreamableValue } from "ai/rsc";
import { MultiFileLoader } from "langchain/document_loaders/fs/multi_file";
import { verificationService } from '@/lib/services/verification/verification-service';

// Import types for use within this file
import type { 
  DocumentType, 
  ExtractedData, 
  ExtractedDocument,
  ProcessingStatus, 
  WorkflowStep,
  WorkflowState,
  VerificationItem,
  VerificationStatus,
  VerifiedDocument,
  ResearchResult,
  ResearchOptions,
  ReportData,
  ReportOptions
} from '@/lib/processing/types/index';

/**
 * Document processing options
 */
export interface DocumentProcessingOptions {
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
export interface DocumentServiceOptions {
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
   * Workflow ID
   */
  workflowId: string;
  
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
   * Stream document extraction for real-time UI updates
   * 
   * @param file File to extract from
   * @returns Streamable extraction data
   */
  async streamExtraction(file: File): Promise<{ streamData: { text: Promise<string> } }> {
    // Validate file
    if (!this.supportedTypes.includes(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    if (file.size > this.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`);
    }

    return {
      streamData: {
        text: this.extractText(file)
      }
    };
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
   * Process a document for extraction, previously in document-extraction.ts
   * This is a compatibility method for the old API that now forwards to processDocument
   * 
   * @param file Document file to process
   * @param patientId Optional patient ID
   * @param documentType Optional document type
   * @param onStatusUpdate Optional status update callback
   * @returns Processing result
   */
  async processDocument(
    file: File,
    patientId?: string,
    documentType?: DocumentType,
    onStatusUpdate?: (status: ProcessingStatus) => void,
  ): Promise<{ extractedDocument: ExtractedDocument; workflowId: string }> {
    return this.processDocumentWithOptions(file, {
      patientId,
      documentType,
      onStatusUpdate,
      isPatientDocument: !!patientId
    });
  }

  /**
   * Process document with options
   * 
   * @param file Document file to process
   * @param options Processing options
   * @returns Processing result
   */
  async processDocumentWithOptions(
    file: File,
    options?: DocumentProcessingOptions
  ): Promise<{ extractedDocument: ExtractedDocument; workflowId: string }> {
    // Create a workflow ID for tracking
    const workflowId = crypto.randomUUID();
    let workflowCreated = false;
    
    try {
      // Update status if callback provided
      options?.onStatusUpdate?.({
        status: 'processing',
        progress: 0,
        currentStep: 'Starting document processing',
        phase: 'initialization'
      });
      
      // Create workflow record
      await this.createWorkflow(workflowId, options);
      workflowCreated = true;
      
      // Update status
      options?.onStatusUpdate?.({
        status: 'processing',
        progress: 10,
        currentStep: 'Extracting text from document',
        phase: 'extraction'
      });
      
      // Extract text using the extraction method
      const rawText = await this.extractText(file, (status) => {
        // Pass through the status update with adjusted progress
        options?.onStatusUpdate?.({
          ...status,
          progress: 10 + (status.progress * 0.4), // Scale to 10-50% range
          phase: 'extraction'
        });
      });
      
      // Update status
      options?.onStatusUpdate?.({
        status: 'processing',
        progress: 50,
        currentStep: 'Analyzing document content',
        phase: 'analysis'
      });
      
      // Determine document type if not provided
      const documentType = options?.documentType || await this.detectDocumentType(rawText);
      
      // Update workflow state
      await this.updateWorkflowState(workflowId, {
        progress: 75,
        currentStep: 'Processing extracted content',
        documentType
      });
      
      // Process the document with the extracted text
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
      
      // Create the extracted document
      const extractedDocument: ExtractedDocument = {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        documentType,
        patientId: options?.patientId,
        extractedData,
        isSuccessful: true
      };
      
      // Update workflow state with extracted data
      await this.updateWorkflowState(workflowId, {
        progress: 100,
        currentStep: 'Document extraction completed',
        extractedDocument: JSON.parse(JSON.stringify(extractedDocument))
      });
      
      // Move workflow to verification stage
      await this.updateWorkflowStep(workflowId, 'verification' as WorkflowStep);
      
      // Update status
      options?.onStatusUpdate?.({
        status: 'success',
        progress: 100,
        currentStep: 'Document extraction completed',
        phase: 'extraction'
      });
      
      // Return the extracted document and workflow ID
      return { extractedDocument, workflowId };
    } catch (error) {
      console.error('Error processing document:', error);
      
      // Update status with error
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      options?.onStatusUpdate?.({
        status: 'error',
        progress: 0,
        error: errorMessage,
        phase: 'extraction'
      });
      
      // Update workflow state with error if it was created
      if (workflowCreated) {
        await this.updateWorkflowState(workflowId, {
          error: errorMessage,
          progress: 0
        });
        await this.updateWorkflowStep(workflowId, 'idle' as WorkflowStep);
      }
      
      // Return a document with error information
      const extractedDocument: ExtractedDocument = {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        documentType: options?.documentType || {
          category: 'unknown',
          type: 'unknown'
        },
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
      
      return { extractedDocument, workflowId };
    }
  }

  /**
   * Detect document type from content
   * 
   * @param content Document content
   * @returns Detected document type
   */
  private async detectDocumentType(content: string): Promise<DocumentType> {
    // In a real implementation, this would use ML/AI to detect document type
    // For now, we'll return a default type
    return {
      category: 'clinical',
      type: 'note'
    };
  }
  
  /**
   * Create a new workflow for tracking document processing
   * 
   * @param workflowId ID for the workflow
   * @param options Processing options
   */
  private async createWorkflow(
    workflowId: string,
    options?: DocumentProcessingOptions
  ): Promise<void> {
    const userResponse = await this.supabase.auth.getUser();
    const userId = userResponse.data.user?.id;
    
    await this.supabase.from('workflow_states').insert({
      id: workflowId, // Note: This may need adjustment based on database constraints
      user_id: userId,
      current_step: 'extraction',
      metadata: {
        patient_id: options?.patientId,
        department_id: options?.departmentId,
        document_type: options?.documentType,
        status: 'processing',
        progress: 0,
        startedAt: new Date().toISOString(),
      }
    });
  }
  
  /**
   * Update workflow state
   * 
   * @param workflowId Workflow ID
   * @param state State update
   */
  private async updateWorkflowState(
    workflowId: string,
    state: Partial<WorkflowState>
  ): Promise<void> {
    // Get current workflow state
    const { data: workflow } = await this.supabase
      .from('workflow_states')
      .select('metadata')
      .eq('id', workflowId)
      .single();
    
    // Merge existing metadata with new state values
    const updatedMetadata = {
      ...(workflow?.metadata || {}),
      ...state,
      lastUpdated: new Date().toISOString()
    };
      
    // Update the workflow state metadata
    await this.supabase
      .from('workflow_states')
      .update({
        metadata: updatedMetadata
      })
      .eq('id', workflowId);
  }
  
  /**
   * Update workflow step
   * 
   * @param workflowId Workflow ID
   * @param step New workflow step
   */
  private async updateWorkflowStep(
    workflowId: string,
    step: WorkflowStep
  ): Promise<void> {
    await this.supabase.from('workflow_states').update({
      current_step: step
    }).eq('id', workflowId);
  }
  
  /**
   * Generate verification items from an extracted document
   * Delegates to the verificationService
   * 
   * @param document The extracted document
   * @returns Generated verification items
   */
  generateVerificationItems(document: ExtractedDocument): VerificationItem[] {
    return verificationService.generateVerificationItems(document);
  }
  
  /**
   * Assemble verified data from verification items
   * Delegates to the verificationService
   * 
   * @param items Verification items with potential corrections
   * @returns Verified data structure
   */
  assembleVerifiedData(items: VerificationItem[]): Record<string, any> {
    return verificationService.assembleVerifiedData(items);
  }
  
  /**
   * Create a verified document from an extracted document and verification items
   * Delegates to the verificationService
   * 
   * @param document The extracted document
   * @param items Verification items
   * @param status Overall verification status
   * @returns Verified document
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
   * Save document to database
   * 
   * @param extractedDocument Extracted document
   * @returns Saved document ID
   */
  async saveDocument(extractedDocument: ExtractedDocument): Promise<string> {
    const { data, error } = await this.supabase.from('patient_documents').insert({
      id: extractedDocument.id,
      patient_id: extractedDocument.patientId,
      title: `Document ${extractedDocument.documentType.category} - ${extractedDocument.documentType.type}`,
      category: extractedDocument.documentType.category as any,
      document_type: extractedDocument.documentType,
      content_text: extractedDocument.extractedData.rawText,
      metadata: extractedDocument.extractedData.metadata,
      is_processed: extractedDocument.isSuccessful,
      processing_error: extractedDocument.errorMessage,
      // Required fields based on schema
      checksum: 'auto-generated', // This should be properly calculated
      file_path: 'auto-generated', // This should be properly set
      file_size: 0, // This should be properly calculated
      file_type: 'text/plain', // This should be properly determined
      document_date: new Date().toISOString().split('T')[0], // This should be properly set
      processing_status: extractedDocument.isSuccessful ? 'completed' : 'failed'
    }).select('id').single();
    
    if (error) {
      throw new Error(`Failed to save document: ${error.message}`);
    }
    
    return data.id;
  }

  /**
   * Upload document for a patient
   * 
   * @param patientId Patient ID
   * @param file File to upload
   * @param options Options
   * @returns Upload result
   */
  async uploadDocument(
    patientId: string,
    file: File, 
    options?: DocumentServiceOptions
  ): Promise<DocumentUploadResult> {
    try {
      options?.onProgress?.(0);
      
      // Upload file to storage
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `patient-documents/${patientId}/${fileName}`;
      
      const { error: uploadError } = await this.supabase.storage
        .from('documents')
        .upload(filePath, file);
      
      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
      
      options?.onProgress?.(50);
      
      // Get file URL
      const { data: urlData } = await this.supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 60 * 60); // 1 hour expiry
      
      if (!urlData?.signedUrl) {
        throw new Error('Failed to generate signed URL');
      }
      
      options?.onProgress?.(70);
      
      // Create document record
      const { data: docData, error: docError } = await this.supabase
        .from('patient_documents')
        .insert({
          patient_id: patientId,
          file_name: file.name,
          file_type: file.type, 
          file_size: file.size,
          storage_path: filePath,
          title: file.name,
          category: 'clinical', // Default category
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
      
      options?.onProgress?.(80);
      
      // Create workflow state
      const { data: workflowData, error: workflowError } = await this.supabase
        .from('workflow_states')
        .insert({
          document_id: docData.id,
          patient_id: patientId,
          current_step: 'uploading',
          metadata: {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size
          },
          created_by: 'system', // Should be dynamic based on the current user
          last_modified_by: 'system' // Should be dynamic based on the current user
        })
        .select('id')
        .single();
      
      if (workflowError || !workflowData) {
        throw new Error(`Workflow creation failed: ${workflowError?.message || 'Unknown error'}`);
      }
      
      options?.onProgress?.(90);
      
      // Start extraction process
      await this.supabase.functions.invoke('document-extraction', {
        body: {
          documentId: docData.id,
          workflowId: workflowData.id,
          fileUrl: urlData.signedUrl,
          fileName: file.name,
          fileType: file.type
        }
      });
      
      options?.onProgress?.(100);
      
      return {
        documentId: docData.id,
        workflowId: workflowData.id,
        fileName: file.name
      };
    } catch (error) {
      console.error('[DocumentService] Upload failed:', error);
      throw error;
    }
  }
  
  /**
   * Get patient documents
   * 
   * @param patientId Patient ID
   * @returns Patient documents
   */
  async getPatientDocuments(patientId: string) {
    try {
      const { data, error } = await this.supabase
        .from('patient_documents')
        .select(`
          id,
          file_name,
          file_type,
          file_size,
          processing_status,
          created_at,
          workflow_states (
            id,
            current_step,
            metadata
          )
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new Error(`Failed to get patient documents: ${error.message}`);
      }
      
      return data || [];
    } catch (error) {
      console.error('[DocumentService] Get patient documents failed:', error);
      throw error;
    }
  }
  
  /**
   * Get workflow state
   * 
   * @param workflowId Workflow ID
   */
  async getWorkflowState(workflowId: string) {
    try {
      const { data, error } = await this.supabase
        .from('workflow_states')
        .select('*')
        .eq('id', workflowId)
        .single();
      
      if (error) {
        throw new Error(`Failed to get workflow state: ${error.message}`);
      }
      
      return data;
    } catch (error) {
      console.error('[DocumentService] Get workflow state failed:', error);
      throw error;
    }
  }

  /**
   * Helper method to update workflow state metadata for DocumentProcessingService compatibility
   */
  private async updateWorkflowStateCompat(workflowId: string, metadataUpdate: Record<string, any>): Promise<void> {
    try {
      const { data: workflowStates, error: fetchError } = await this.supabase
        .from('workflow_states')
        .select('metadata')
        .eq('metadata->workflowId', workflowId);
        
      if (fetchError) throw new Error(`Failed to fetch workflow state: ${fetchError.message}`);
      if (!workflowStates || workflowStates.length === 0) throw new Error(`Workflow state not found for ID: ${workflowId}`);
      
      const currentState = workflowStates[0];
      
      // Merge the current metadata with the update
      const updatedMetadata = {
        ...(currentState.metadata as object || {}),
        ...metadataUpdate,
        lastUpdated: new Date().toISOString()
      };
      
      const { error: updateError } = await this.supabase
        .from('workflow_states')
        .update({ metadata: updatedMetadata })
        .eq('metadata->workflowId', workflowId);
        
      if (updateError) throw new Error(`Failed to update workflow state: ${updateError.message}`);
    } catch (error) {
      console.error('Error updating workflow state:', error);
    }
  }
  
  /**
   * Helper method to update workflow step for DocumentProcessingService compatibility
   */
  private async updateWorkflowStepCompat(workflowId: string, step: WorkflowStep): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('workflow_states')
        .update({ current_step: step })
        .eq('metadata->workflowId', workflowId);
        
      if (error) throw new Error(`Failed to update workflow step: ${error.message}`);
    } catch (error) {
      console.error('Error updating workflow step:', error);
    }
  }
  
  /**
   * Start verification process for a document
   * For compatibility with DocumentProcessingService
   * 
   * @param workflowId The workflow ID 
   * @param document The extracted document to verify
   * @returns Generated verification items
   */
  async startVerification(workflowId: string, document: ExtractedDocument): Promise<VerificationItem[]> {
    try {
      // Generate verification items using the verification service
      const items = verificationService.generateVerificationItems(document);
      
      // Update workflow state
      await this.updateWorkflowStateCompat(workflowId, {
        processingPhase: 'verification',
        verificationStarted: new Date().toISOString(),
        verificationItems: items
      });
      
      return items;
    } catch (error) {
      console.error('Error starting verification:', error);
      throw error;
    }
  }
  
  /**
   * Save verification results
   * Delegates to the verification service while handling workflow updates
   * 
   * @param workflowId The workflow ID
   * @param items The verification items with their status
   * @param status Overall verification status
   * @param document The extracted document
   * @returns The verified document
   */
  async saveVerificationResults(
    workflowId: string, 
    items: VerificationItem[], 
    status: VerificationStatus,
    document: ExtractedDocument
  ): Promise<VerifiedDocument> {
    try {
      // Create verified document using the verification service
      const verifiedDocument = await verificationService.saveVerificationResults(
        workflowId,
        items,
        status,
        document,
        {
          onProgress: (progress) => {
            // Update workflow state with progress if needed
            this.updateWorkflowStateCompat(workflowId, {
              verificationProgress: progress
            }).catch(console.error);
          }
        }
      );
      
      // Update workflow state
      await this.updateWorkflowStateCompat(workflowId, {
        processingPhase: 'verification_complete',
        verificationCompleted: new Date().toISOString(),
        verificationStatus: status,
        verifiedDocument: JSON.parse(JSON.stringify(verifiedDocument)) // Ensure serializable
      });
      
      // Move to next step if verified
      if (status.isVerified) {
        await this.updateWorkflowStepCompat(workflowId, 'report_generation' as WorkflowStep);
      }
      
      return verifiedDocument;
    } catch (error) {
      console.error('Error saving verification results:', error);
      throw error;
    }
  }

  /**
   * Perform research based on a query and verified document
   * For compatibility with DocumentProcessingService
   * 
   * @param query Research query
   * @param verifiedDocument The verified document
   * @param options Research options
   * @returns Research result
   */
  async performResearch(
    query: string,
    verifiedDocument: VerifiedDocument,
    options?: ResearchOptions & {
      provider?: string;
    }
  ): Promise<ResearchResult> {
    // Update progress at the start
    options?.onProgress?.(0);
    
    try {
      // Use perplexity service for research
      const result = await perplexityService.performDeepResearch(query, {
        ...options,
        patientData: JSON.stringify(verifiedDocument.verifiedData)
      });
      
      return result;
    } catch (error) {
      console.error("Research error:", error);
      
      // Return a minimal result with error information
      return {
        text: `Research failed: ${error instanceof Error ? error.message : String(error)}`,
        sources: [],
        summary: `Research failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Perform medical diagnosis based on extracted patient document
   * For compatibility with DocumentProcessingService
   * 
   * @param documentId The extracted document ID to analyze
   * @param additionalContext Additional context or specific questions for the diagnosis
   * @param options Research options
   * @returns Research results with diagnostic information
   */
  public async performMedicalDiagnosis(
    documentId: string,
    additionalContext?: string,
    options?: ResearchOptions
  ): Promise<ResearchResult> {
    // Get the document
    const { data: document, error: documentError } = await this.supabase
      .from('patient_documents')
      .select('*')
      .eq('id', documentId)
      .single();
    
    if (documentError || !document) {
      throw new Error(`Document with ID ${documentId} not found: ${documentError?.message || ''}`);
    }
    
    // Get document content
    const patientData = document.content_text || '';
    
    if (!patientData) {
      throw new Error(`No content found for document ID ${documentId}`);
    }
    
    // Use perplexity service to perform medical diagnosis
    return perplexityService.performMedicalDiagnosis(
      additionalContext || 'Provide a comprehensive differential diagnosis based on the patient data',
      patientData,
      options
    );
  }
}

// Export singleton instance for global use
export const documentService = new DocumentService(); 