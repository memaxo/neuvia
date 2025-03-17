// lib/services/patient/core/patient-summary-core-service.ts

import logger from '@/lib/logger'
import { normalizeError, ExternalServiceError, SystemError } from '@/lib/errors'
import { ValidationError } from '@/lib/errors/verification-errors'
import type { DocumentExtraction, PatientSummary, PatientSummarySection } from '@/lib/types/patient'
import { langChainCore } from '@/lib/langchain/core'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from '@langchain/core/prompts'
import { RunnableSequence } from '@langchain/core/runnables'
import type { RunnableConfig } from '@langchain/core/runnables'
import { withRetry } from '@/lib/utils/retry'
import { createWorkflowCallbacks, runWithWorkflow } from '@/lib/utils/langchain'
import type { WorkflowStep } from '@/lib/types/workflow'

/**
 * Core service for patient summary generation
 * 
 * This service focuses on generating and updating patient summaries
 * without handling storage, verification, or formatting concerns.
 */
export class PatientSummaryCoreService {
  private readonly logger = logger;

  /**
   * Generate a patient summary from multiple document extractions
   * 
   * @param patientId Patient ID
   * @param extractions Array of document extractions
   * @param options Optional processing options
   * @returns Patient summary
   */
  async generateSummary(
    patientId: string,
    extractions: DocumentExtraction[],
    options?: {
      workflowId?: string;
      onProgress?: (progress: number) => void;
      temperature?: number;
    }
  ): Promise<PatientSummary> {
    const moduleLogger = this.logger;
    const logMetadata = {
      method: 'generateSummary',
      patientId,
      documentCount: extractions.length
    };
    
    try {
      moduleLogger.info('Generating patient summary from document extractions', logMetadata);
      
      // Validate inputs
      if (!patientId?.trim()) {
        throw new ValidationError({
          message: 'Valid patient ID is required',
          code: 'INVALID_PATIENT_ID'
        });
      }
      
      if (!Array.isArray(extractions) || extractions.length === 0) {
        throw new ValidationError({
          message: 'At least one document extraction is required',
          code: 'INVALID_EXTRACTIONS',
          data: { extractionsCount: extractions?.length || 0 }
        });
      }
      
      // Set up callback handlers for progress tracking if needed
      const callbackHandlers = options?.workflowId || options?.onProgress
        ? createWorkflowCallbacks(
            options.workflowId || null,
            'summary_generation' as WorkflowStep,
            { onProgress: options.onProgress }
          )
        : [];
      
      // Create LLM model (always use o3-mini as specified)
      const llm = langChainCore.createChatOpenAI({
        model: 'o3-mini',
        temperature: options?.temperature ?? 0.1,
        callbacks: callbackHandlers
      });
      
      // Prepare extraction content for prompt
      const extractionContent = extractions.map((ext, index) => {
        const sectionTexts = Object.entries(ext.sections || {})
          .map(([key, section]) => {
            const items = section.items.map(item => item.text).join('\n- ');
            return `${key}:\n- ${items}`;
          })
          .join('\n\n');
        return `Document ${index + 1} (${ext.documentType.type}):\n${sectionTexts || 'No content available.'}`;
      }).join('\n\n');
      
      // Create prompt for summary generation
      const summaryPrompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(
          `You are a clinical documentation specialist with expertise in creating comprehensive patient summaries from medical documents.
          
          Create a structured patient summary from the provided medical document extractions.
          
          Your summary should include these sections:
          1. Patient Information (name, DOB, gender, MRN if available)
          2. Medical History
          3. Current Conditions
          4. Medications (include dosage and frequency if available)
          5. Allergies
          6. Recent Findings
          7. Treatment Plans
          8. Laboratory Results
          9. Imaging Results
          10. Recommendations
          
          Guidelines:
          - Focus on clinically relevant information and merge info from all documents
          - Prioritize recent information over older data
          - Eliminate redundancies across documents
          - Maintain medical accuracy
          - Format medications and allergies as bullet lists
          - For any section where information is not available, include the section but state "No information available"
          - Be thorough but concise`
        ),
        HumanMessagePromptTemplate.fromTemplate(
          `Patient ID: {patientId}
          
          Document Extractions:
          
          {extractionContent}`
        )
      ]);
      
      // Create sequence for summary generation
      const summarySequence = RunnableSequence.from([
        summaryPrompt,
        llm,
        new StringOutputParser()
      ]);
      
      // Create runnable config
      const runnableConfig: RunnableConfig = {
        runName: 'Patient Summary Generation',
        metadata: { 
          patientId, 
          documentCount: extractions.length,
          workflowId: options?.workflowId 
        }
      };
      
      // Use workflow tracking if workflow ID provided
      const workflowId = options?.workflowId;
      const generatedSummary = await runWithWorkflow<string>(
        'summary_generation' as WorkflowStep,
        async () => {
          // Use withRetry for resilience
          return await withRetry(
            async () => summarySequence.invoke(
              { 
                patientId, 
                extractionContent 
              },
              runnableConfig
            ),
            {
              maxRetries: 2,
              baseDelay: 1000,
              retryCondition: (error) => {
                // Don't retry validation errors
                if (error instanceof ValidationError) {
                  return false;
                }
                return true;
              }
            }
          );
        },
        {
          onProgress: options?.onProgress,
          workflowId: workflowId || undefined
        }
      );
      
      // Parse sections from the generated text
      const sections = this.parseSummaryIntoSections(generatedSummary);
      
      // Create the summary object
      const now = new Date().toISOString();
      const summary: PatientSummary = {
        patientInfo: sections.patientInfo ?? this.createEmptySection('Patient Information'),
        medicalHistory: sections.medicalHistory ?? this.createEmptySection('Medical History'),
        currentConditions: sections.currentConditions ?? this.createEmptySection('Current Conditions'),
        medications: sections.medications ?? this.createEmptySection('Medications'),
        recentFindings: sections.recentFindings ?? this.createEmptySection('Recent Findings'),
        treatmentPlans: sections.treatmentPlans ?? this.createEmptySection('Treatment Plans'),
        labResults: sections.labResults ?? this.createEmptySection('Laboratory Results'),
        imagingResults: sections.imagingResults ?? this.createEmptySection('Imaging Results'),
        recommendations: sections.recommendations ?? this.createEmptySection('Recommendations'),
        metadata: {
          generatedAt: now,
          documentCount: extractions.length,
          documents: extractions.map((extraction) => ({
            id: extraction.documentId,
            type: extraction.documentType,
            title: `Document ${extraction.documentId}`,
            date: extraction.documentDate,
          })),
        },
      };
      
      moduleLogger.info('Successfully generated patient summary', {
        sectionCount: Object.keys(sections).length
      });
      
      return summary;
    } catch (error) {
      moduleLogger.error('Failed to generate patient summary', {}, error);
      
      // For normalized error handling
      const normError = normalizeError(error);
      
      // Rethrow if already an ApplicationError
      if (error instanceof ValidationError || 
          error instanceof ExternalServiceError ||
          error instanceof SystemError) {
        throw error;
      }
      
      // Wrap other errors
      throw new SystemError({
        message: `Failed to generate patient summary: ${normError.message}`,
        code: 'SUMMARY_GENERATION_FAILED',
        data: { patientId, documentCount: extractions.length },
        cause: error
      });
    }
  }
  
  /**
   * Update an existing summary with new document extractions
   * 
   * @param existingSummary Existing patient summary
   * @param newExtractions New document extractions to incorporate
   * @param options Optional processing options
   * @returns Updated patient summary
   */
  async updateSummary(
    existingSummary: PatientSummary,
    newExtractions: DocumentExtraction[],
    options?: {
      workflowId?: string;
      onProgress?: (progress: number) => void;
      temperature?: number;
    }
  ): Promise<PatientSummary> {
    const moduleLogger = this.logger;
    const logMetadata = {
      method: 'updateSummary',
      documentCount: newExtractions.length
    };
    
    try {
      moduleLogger.info('Updating patient summary with new document extractions', logMetadata);
      
      // Validate inputs
      if (!existingSummary) {
        throw new ValidationError({
          message: 'Existing summary is required',
          code: 'INVALID_SUMMARY'
        });
      }
      
      if (!Array.isArray(newExtractions) || newExtractions.length === 0) {
        throw new ValidationError({
          message: 'At least one new document extraction is required',
          code: 'INVALID_EXTRACTIONS',
          data: { extractionsCount: newExtractions?.length || 0 }
        });
      }
      
      // Set up callback handlers for progress tracking if needed
      const callbackHandlers = options?.workflowId || options?.onProgress
        ? createWorkflowCallbacks(
            options.workflowId || null,
            'summary_update' as WorkflowStep,
            { onProgress: options.onProgress }
          )
        : [];
      
      // Create LLM model (always use o3-mini as specified)
      const llm = langChainCore.createChatOpenAI({
        model: 'o3-mini',
        temperature: options?.temperature ?? 0.1,
        callbacks: callbackHandlers
      });
      
      // Serialize existing summary for the prompt
      const existingSummaryText = this.serializeSummary(existingSummary);
      
      // Prepare new extraction content for prompt
      const newExtractionContent = newExtractions.map((ext, index) => {
        const sectionTexts = Object.entries(ext.sections || {})
          .map(([key, section]) => {
            const items = section.items.map(item => item.text).join('\n- ');
            return `${key}:\n- ${items}`;
          })
          .join('\n\n');
        return `New Document ${index + 1} (${ext.documentType.type}):\n${sectionTexts || 'No content available.'}`;
      }).join('\n\n');
      
      // Create prompt for summary updating
      const updatePrompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(
          `You are a clinical documentation specialist updating an existing patient summary with new medical information.
          
          You will be given an existing patient summary followed by new document extractions.
          
          Update the summary to incorporate the new information while:
          - Maintaining the existing structure and sections
          - Adding new relevant information
          - Updating outdated information with newer data
          - Resolving any contradictions by preferring more recent information
          - Eliminating redundancies
          - Preserving all existing sections even if no new information is available
          
          Return the complete updated summary with all sections.`
        ),
        HumanMessagePromptTemplate.fromTemplate(
          `Existing Patient Summary:
          
          {existingSummaryText}
          
          New Document Extractions:
          
          {newExtractionContent}`
        )
      ]);
      
      // Create sequence for summary updating
      const updateSequence = RunnableSequence.from([
        updatePrompt,
        llm,
        new StringOutputParser()
      ]);
      
      // Create runnable config
      const runnableConfig: RunnableConfig = {
        runName: 'Patient Summary Update',
        metadata: { 
          documentCount: newExtractions.length,
          workflowId: options?.workflowId 
        }
      };
      
      // Use workflow tracking if workflow ID provided
      const workflowId = options?.workflowId;
      const updatedSummaryText = await runWithWorkflow<string>(
        'summary_update' as WorkflowStep,
        async () => {
          // Use withRetry for resilience
          return await withRetry(
            async () => updateSequence.invoke(
              { 
                existingSummaryText, 
                newExtractionContent 
              },
              runnableConfig
            ),
            {
              maxRetries: 2,
              baseDelay: 1000,
              retryCondition: (error) => {
                // Don't retry validation errors
                if (error instanceof ValidationError) {
                  return false;
                }
                return true;
              }
            }
          );
        },
        {
          onProgress: options?.onProgress,
          workflowId: workflowId || undefined
        }
      );
      
      // Parse sections from the updated text
      const updatedSections = this.parseSummaryIntoSections(updatedSummaryText);
      
      // Create the updated summary object, combining with existing structure
      const now = new Date().toISOString();
      
      // Get existing and new document IDs
      const existingDocIds = existingSummary.metadata.documents.map(doc => doc.id);
      const newDocIds = newExtractions.map(ext => ext.documentId);
      
      // Combine existing and new documents, avoiding duplicates
      const allDocuments = [
        ...existingSummary.metadata.documents,
        ...newExtractions
          .filter(ext => !existingDocIds.includes(ext.documentId))
          .map(ext => ({
            id: ext.documentId,
            type: ext.documentType,
            title: `Document ${ext.documentId}`,
            date: ext.documentDate,
          }))
      ];
      
      const updatedSummary: PatientSummary = {
        patientInfo: updatedSections.patientInfo ?? existingSummary.patientInfo,
        medicalHistory: updatedSections.medicalHistory ?? existingSummary.medicalHistory,
        currentConditions: updatedSections.currentConditions ?? existingSummary.currentConditions,
        medications: updatedSections.medications ?? existingSummary.medications,
        recentFindings: updatedSections.recentFindings ?? existingSummary.recentFindings,
        treatmentPlans: updatedSections.treatmentPlans ?? existingSummary.treatmentPlans,
        labResults: updatedSections.labResults ?? existingSummary.labResults,
        imagingResults: updatedSections.imagingResults ?? existingSummary.imagingResults,
        recommendations: updatedSections.recommendations ?? existingSummary.recommendations,
        metadata: {
          ...existingSummary.metadata,
          generatedAt: now,
          documentCount: allDocuments.length,
          documents: allDocuments,
          // Preserve verification info if present
          verificationInfo: existingSummary.metadata.verificationInfo
        },
      };
      
      moduleLogger.info('Successfully updated patient summary', {
        originalDocCount: existingDocIds.length,
        newDocCount: newDocIds.length,
        totalDocCount: allDocuments.length
      });
      
      return updatedSummary;
    } catch (error) {
      moduleLogger.error('Failed to update patient summary', {}, error);
      
      // For normalized error handling
      const normError = normalizeError(error);
      
      // Rethrow if already an ApplicationError
      if (error instanceof ValidationError || 
          error instanceof ExternalServiceError ||
          error instanceof SystemError) {
        throw error;
      }
      
      // Wrap other errors
      throw new SystemError({
        message: `Failed to update patient summary: ${normError.message}`,
        code: 'SUMMARY_UPDATE_FAILED',
        data: { documentCount: newExtractions.length },
        cause: error
      });
    }
  }
  
  /**
   * Parse summary text into structured sections
   * 
   * @param text Summary text to parse
   * @returns Structured sections
   */
  private parseSummaryIntoSections(text: string): Record<string, PatientSummarySection> {
    const sections: Record<string, PatientSummarySection> = {};
    const sectionMapping: Record<string, string> = {
      'Patient Information': 'patientInfo',
      'Medical History': 'medicalHistory',
      'Current Conditions': 'currentConditions',
      'Medications': 'medications',
      'Recent Findings': 'recentFindings',
      'Treatment Plans': 'treatmentPlans',
      'Laboratory Results': 'labResults',
      'Imaging Results': 'imagingResults',
      'Recommendations': 'recommendations',
    };

    // Split response by markdown headers
    const sectionMatches = text.match(/## (.+?)\n([\s\S]+?)(?=\n## |$)/g);

    if (!sectionMatches) {
      this.logger.warn('No valid sections found in summary response');
      return sections;
    }

    // Process each section
    sectionMatches.forEach((sectionText) => {
      const titleRegex = /## (.+?)\n/;
      const titleMatch = titleRegex.exec(sectionText);
      if (!titleMatch?.[1]) return;

      const title = titleMatch[1].trim();
      const content = sectionText.replace(titleMatch[0], '').trim();

      // Map to the correct section name
      const sectionKey = sectionMapping[title];
      if (sectionKey) {
        sections[sectionKey] = {
          title,
          content,
          sources: [], // We don't have direct sources in the generation phase
        };
      }
    });

    return sections;
  }
  
  /**
   * Create an empty section when a section is missing
   * 
   * @param title Section title
   * @returns Empty section
   */
  private createEmptySection(title: string): PatientSummarySection {
    return {
      title,
      content: 'No information available.',
      sources: [],
    };
  }
  
  /**
   * Serialize a summary to text format for use in prompts
   * 
   * @param summary The summary to serialize
   * @returns Serialized summary text
   */
  private serializeSummary(summary: PatientSummary): string {
    const sections = [
      this.serializeSection('Patient Information', summary.patientInfo),
      this.serializeSection('Medical History', summary.medicalHistory),
      this.serializeSection('Current Conditions', summary.currentConditions),
      this.serializeSection('Medications', summary.medications),
      this.serializeSection('Recent Findings', summary.recentFindings),
      this.serializeSection('Treatment Plans', summary.treatmentPlans),
      this.serializeSection('Laboratory Results', summary.labResults),
      this.serializeSection('Imaging Results', summary.imagingResults),
      this.serializeSection('Recommendations', summary.recommendations),
    ];
    
    return sections.join('\n\n');
  }
  
  /**
   * Serialize a single section for use in prompts
   * 
   * @param title Section title
   * @param section Section content
   * @returns Serialized section text
   */
  private serializeSection(title: string, section: PatientSummarySection): string {
    return `## ${title}\n${section.content}`;
  }
}

// Create singleton instance
export const patientSummaryCoreService = new PatientSummaryCoreService();