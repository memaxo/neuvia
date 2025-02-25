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
import { createBrowserClient } from '@/lib/supabase/clients';
import { randomUUID } from 'crypto';
import type { Database } from '@/lib/supabase';

// Get the workflow step type from Database
type WorkflowStep = Database['public']['Enums']['workflow_step'];

// Local interfaces to extend the types from index
interface DocumentReference {
  id: string;
  type: string;
  title: string;
  processedAt: Date;
  referencedSection?: string;
  page?: number;
  metadata?: Record<string, any>;
  citationId?: string;
}

interface ExtendedReportData extends ReportData {
  documentReferences: DocumentReference[];
}

/**
 * Service for document processing operations throughout the application.
 * Provides a unified interface for extraction, verification, research, and report generation.
 */
export class DocumentProcessingService {
  private dataExtractor = new DataExtractor();
  private researchProvider = new FirecrawlResearchProvider();
  private supabase = createBrowserClient();
  
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
  ): Promise<{ extractedDocument: ExtractedDocument; workflowId: string }> {
    // Create a workflow ID
    const workflowId = randomUUID();
    let workflowCreated = false;
    
    try {
      // Get current user
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Create workflow state
      const { data: workflowState, error: workflowError } = await this.supabase
        .from('workflow_states')
        .insert({
          current_step: 'extracting' as WorkflowStep,
          user_id: user.id,
          metadata: {
            patientId,
            documentName: file.name,
            documentSize: file.size,
            startedAt: new Date().toISOString(),
            processingPhase: 'extraction',
            workflowId // Store workflowId in metadata since we can't add it directly to the table
          }
        })
        .select('*')
        .single();
        
      if (workflowError) throw new Error(`Failed to create workflow state: ${workflowError.message}`);
      workflowCreated = true;
      
      // Update status
      options?.onStatusUpdate?.({
        status: 'processing',
        progress: 0,
        currentStep: 'Starting document extraction',
        phase: 'extraction'
      });
      
      // Update workflow state
      await this.updateWorkflowState(workflowId, {
        progress: 0,
        currentStep: 'Starting document extraction'
      });
      
      // Extract text using the DataExtractor
      const { streamData } = await this.dataExtractor.streamExtraction(file);
      const rawText = await streamData.text;
      
      // Update status and workflow state
      options?.onStatusUpdate?.({
        status: 'processing',
        progress: 50,
        currentStep: 'Processing extracted text',
        phase: 'extraction'
      });
      
      await this.updateWorkflowState(workflowId, {
        progress: 50,
        currentStep: 'Processing extracted text'
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
            pageNumber: 1
          }
        ]
      };
      
      // Create the extracted document
      const extractedDocument: ExtractedDocument = {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        documentType,
        patientId,
        extractedData,
        isSuccessful: true
      };
      
      // Update workflow state with extracted data
      await this.updateWorkflowState(workflowId, {
        progress: 100,
        currentStep: 'Document extraction completed',
        extractedDocument: JSON.parse(JSON.stringify(extractedDocument)) // Ensure serializable
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
          category: 'clinical',
          type: 'chat_upload'
        },
        patientId,
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
   * Helper method to update workflow state metadata
   */
  private async updateWorkflowState(workflowId: string, metadataUpdate: Record<string, any>): Promise<void> {
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
   * Helper method to update workflow step
   */
  private async updateWorkflowStep(workflowId: string, step: WorkflowStep): Promise<void> {
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
   * @param workflowId The workflow ID 
   * @param document The extracted document to verify
   */
  async startVerification(workflowId: string, document: ExtractedDocument): Promise<VerificationItem[]> {
    try {
      // Generate verification items
      const items = this.generateVerificationItems(document);
      
      // Update workflow state
      await this.updateWorkflowState(workflowId, {
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
   * @param workflowId The workflow ID
   * @param items The verification items with their status
   * @param status Overall verification status
   */
  async saveVerificationResults(
    workflowId: string, 
    items: VerificationItem[], 
    status: VerificationStatus,
    document: ExtractedDocument
  ): Promise<VerifiedDocument> {
    try {
      // Create verified document
      const verifiedDocument = this.createVerifiedDocument(document, items, status);
      
      // Update workflow state
      await this.updateWorkflowState(workflowId, {
        processingPhase: 'verification_complete',
        verificationCompleted: new Date().toISOString(),
        verificationStatus: status,
        verifiedDocument: JSON.parse(JSON.stringify(verifiedDocument)) // Ensure serializable
      });
      
      // Move to next step if verified
      if (status.isVerified) {
        await this.updateWorkflowStep(workflowId, 'report_generation' as WorkflowStep);
      }
      
      return verifiedDocument;
    } catch (error) {
      console.error('Error saving verification results:', error);
      throw error;
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
   * Calculate average confidence score from verification items
   * @param items Verification items
   * @returns Average confidence score
   */
  private calculateVerificationMetrics(items: VerificationItem[]): { 
    verificationConfidence: number; 
    correctionCount: number;
  } {
    if (!items || items.length === 0) {
      return { verificationConfidence: 0, correctionCount: 0 };
    }
    
    // Calculate total confidence
    const totalConfidence = items.reduce((sum, item) => sum + item.confidence, 0);
    
    // Count corrections
    const correctionCount = items.reduce((count, item) => {
      return count + (item.corrections && Object.keys(item.corrections).length > 0 ? 1 : 0);
    }, 0);
    
    return { 
      verificationConfidence: totalConfidence / items.length,
      correctionCount
    };
  }

  /**
   * Create document references from an extracted document
   * @param document The verified document
   * @returns Array of document references
   */
  private createDocumentReferences(document: VerifiedDocument): DocumentReference[] {
    const references: DocumentReference[] = [];
    
    // Get the original extracted document
    const { extractedDocument } = document;
    
    // Create a reference for the main document
    const mainReference: DocumentReference = {
      id: extractedDocument.id,
      type: `${extractedDocument.documentType.category}-${extractedDocument.documentType.type}`,
      title: extractedDocument.extractedData.metadata?.filename || 'Unknown Document',
      processedAt: extractedDocument.createdAt,
      citationId: 'Doc-1',
      metadata: {
        fileFormat: extractedDocument.extractedData.metadata?.fileFormat,
        fileSize: extractedDocument.extractedData.metadata?.fileSize,
        extractedAt: extractedDocument.extractedData.metadata?.extractedAt
      }
    };
    
    references.push(mainReference);
    
    // If the document has chunks with page numbers, create references for each page
    if (extractedDocument.extractedData.chunks && extractedDocument.extractedData.chunks.length > 1) {
      extractedDocument.extractedData.chunks.forEach((chunk, index) => {
        if (chunk.pageNumber) {
          references.push({
            id: `${extractedDocument.id}-page-${chunk.pageNumber}`,
            type: `${extractedDocument.documentType.category}-${extractedDocument.documentType.type}`,
            title: `${extractedDocument.extractedData.metadata?.filename || 'Unknown Document'} - Page ${chunk.pageNumber}`,
            processedAt: extractedDocument.createdAt,
            page: chunk.pageNumber,
            citationId: `Doc-1-p${chunk.pageNumber}`
          });
        }
      });
    }
    
    return references;
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
  ): Promise<ExtendedReportData> {
    // Update progress for generation phase
    options?.onProgress?.('generation', 0);
    
    try {
      // Get the verified data
      const verifiedData = document.verifiedData;
      
      // Calculate verification metrics
      const { verificationConfidence, correctionCount } = this.calculateVerificationMetrics(document.verificationItems);
      
      // Create verification metadata
      const verificationMetadata = {
        verifiedAt: document.verificationStatus.verifiedAt,
        verifiedBy: document.verificationStatus.verifiedBy || 'system',
        verificationConfidence,
        verifiedItemCount: document.verificationItems.length,
        correctionCount
      };
      
      // Simulate generation process (this would be replaced with actual API call)
      for (let i = 10; i <= 90; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 300));
        options?.onProgress?.('generation', i);
      }
      
      // Generate report content using verified data
      // In a real implementation, this would use an AI model or template engine
      // that incorporates the verified data
      
      // Extract key patient information for the report
      const patientInfo = verifiedData.patientInfo || {};
      const patientName = patientInfo.name || 'Unknown Patient';
      const patientAge = patientInfo.age || 'Unknown';
      const patientGender = patientInfo.gender || 'Unspecified';
      
      // Extract medical information
      const medicalInfo = verifiedData.medicalInfo || {};
      const diagnosis = medicalInfo.diagnosis || 'Pending diagnosis';
      const symptoms = medicalInfo.symptoms || 'No symptoms recorded';
      
      // Generate report content using templates and verified data
      const reportContent = `# Medical Report for ${patientName}

## Patient Information
- Name: ${patientName}
- Age: ${patientAge}
- Gender: ${patientGender}
- Patient ID: ${document.patientId || 'Unknown'}

## Medical Information
- Diagnosis: ${diagnosis}
- Symptoms: ${symptoms}

## Findings
${medicalInfo.findings || 'No findings recorded'}

## Recommendations
${medicalInfo.recommendations || 'Follow-up recommended in 2 weeks.'}

## Research Summary
${researchResults.map(r => r.summary || 'No research summary available').join('\n\n')}
`;
      
      // Create report sections from verified data
      const reportSections = {
        patientInfo: `Name: ${patientName}, Age: ${patientAge}, Gender: ${patientGender}`,
        diagnosis,
        symptoms,
        findings: medicalInfo.findings || 'No findings recorded',
        recommendations: medicalInfo.recommendations || 'Follow-up recommended in 2 weeks.'
      };
      
      // Generate the report data object
      const documentReferences = this.createDocumentReferences(document);
      const reportData: ExtendedReportData = {
        content: reportContent,
        sources: researchResults.flatMap(r => r.sources || []),
        documentReferences,
        patientId: document.patientId || 'unknown',
        generatedAt: new Date(),
        metadata: {
          modelName: "GPT-4",
          confidence: 0.92,
          generationTime: 3.5,
          verification: verificationMetadata
        },
        sections: reportSections,
        verifiedData // Include the verified data in the report
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
    } catch (error) {
      console.error('Error generating report:', error);
      throw new Error(`Report generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Format a report into the specified format
   * @param report The report data
   * @param format Desired format
   * @param onProgress Progress callback
   */
  async formatReport(
    report: ExtendedReportData,
    format: 'markdown' | 'html' | 'pdf',
    onProgress?: (progress: number) => void
  ): Promise<string> {
    // Start progress
    onProgress?.(0);
    
    // Simulate processing time
    for (let i = 10; i <= 90; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      onProgress?.(i);
    }
    
    // Format document references based on the output format
    let referencesFormatted = '';
    
    if (report.documentReferences && report.documentReferences.length > 0) {
      switch (format) {
        case 'html':
          referencesFormatted = '<h2>Document References</h2><ol>';
          report.documentReferences.forEach((ref: DocumentReference) => {
            referencesFormatted += `<li id="${ref.citationId}"><strong>${ref.title}</strong>${ref.page ? `, Page ${ref.page}` : ''} (${ref.type})</li>`;
          });
          referencesFormatted += '</ol>';
          break;
        case 'pdf':
          referencesFormatted = '## Document References\n';
          report.documentReferences.forEach((ref: DocumentReference, idx: number) => {
            referencesFormatted += `${idx + 1}. ${ref.title}${ref.page ? `, Page ${ref.page}` : ''} (${ref.type})\n`;
          });
          break;
        case 'markdown':
        default:
          referencesFormatted = '## Document References\n';
          report.documentReferences.forEach((ref: DocumentReference) => {
            referencesFormatted += `[${ref.citationId}] ${ref.title}${ref.page ? `, Page ${ref.page}` : ''} (${ref.type})\n`;
          });
          break;
      }
    }
    
    // Mock implementation based on format
    let formattedReport: string;
    
    switch (format) {
      case 'html':
        formattedReport = `
<html>
<head>
  <title>Medical Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; }
    h2 { color: #444; margin-top: 20px; }
    .section { margin-bottom: 20px; }
    .citation { font-size: 0.8em; vertical-align: super; }
  </style>
</head>
<body>
  <h1>Medical Report</h1>
  
  <div class="section">
    <h2>Patient Information</h2>
    <p>${report.sections?.patientInfo || ''}</p>
  </div>
  
  <div class="section">
    <h2>Diagnosis</h2>
    <p>${report.sections?.diagnosis || ''} <a href="#Doc-1" class="citation">[Doc-1]</a></p>
  </div>
  
  <div class="section">
    <h2>Symptoms</h2>
    <p>${report.sections?.symptoms || ''} <a href="#Doc-1" class="citation">[Doc-1]</a></p>
  </div>
  
  <div class="section">
    <h2>Findings</h2>
    <p>${report.sections?.findings || ''} <a href="#Doc-1" class="citation">[Doc-1]</a></p>
  </div>
  
  <div class="section">
    <h2>Recommendations</h2>
    <p>${report.sections?.recommendations || ''} <a href="#Doc-1" class="citation">[Doc-1]</a></p>
  </div>
  
  ${referencesFormatted}
</body>
</html>`;
        break;
      case 'pdf':
        // In a real implementation, this would generate a PDF
        formattedReport = `PDF content would go here. Contains: 
# Medical Report

## Patient Information
${report.sections?.patientInfo || ''}

## Diagnosis
${report.sections?.diagnosis || ''} [1]

## Symptoms
${report.sections?.symptoms || ''} [1]

## Findings
${report.sections?.findings || ''} [1]

## Recommendations
${report.sections?.recommendations || ''} [1]

${referencesFormatted}`;
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

  /**
   * Generate a report directly from a verified document without research
   * @param workflowId The workflow ID
   * @param document The verified document
   * @param options Report generation options
   */
  async generateReportFromVerification(
    workflowId: string,
    document: VerifiedDocument,
    options?: ReportOptions
  ): Promise<ExtendedReportData> {
    try {
      // Create minimal research result
      const minimalResearchResult: ResearchResult = {
        query: 'Direct verification report',
        sources: [],
        summary: 'Report generated directly from verified data',
        timestamp: new Date(),
        confidence: 1.0,
        keyFindings: ['Generated directly from verified document without research']
      };
      
      // Update workflow state
      await this.updateWorkflowState(workflowId, {
        processingPhase: 'report_generation',
        reportGenerationStarted: new Date().toISOString()
      });
      
      // Generate report using verified document
      const reportData = await this.generateReport(
        document, 
        [minimalResearchResult],
        options
      );
      
      // Update workflow state with report data
      await this.updateWorkflowState(workflowId, {
        processingPhase: 'report_generation_complete',
        reportGeneratedAt: new Date().toISOString(),
        reportData: JSON.parse(JSON.stringify(reportData)) // Ensure serializable
      });
      
      // Move to next step
      await this.updateWorkflowStep(workflowId, 'report_formatting' as WorkflowStep);
      
      return reportData;
    } catch (error) {
      console.error('Error generating report from verification:', error);
      throw error;
    }
  }
} 