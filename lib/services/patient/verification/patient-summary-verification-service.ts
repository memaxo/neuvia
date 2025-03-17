// lib/services/patient/verification/patient-summary-verification-service.ts

import logger from '@/lib/logger'
import { normalizeError, ExternalServiceError, SystemError } from '@/lib/errors'
import { ValidationError } from '@/lib/errors/verification-errors'
import type { PatientSummary, VerifiedPatientSummary } from '@/lib/types/patient'
import { VerificationStatus, VerificationItem } from '@/lib/types/verification'
import { createBrowserClient } from '@/lib/supabase/clients'
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from '@langchain/core/prompts'
import { RunnableSequence } from '@langchain/core/runnables'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { langChainCore } from '@/lib/langchain/core'
import type { RunnableConfig } from '@langchain/core/runnables'
import { withRetry } from '@/lib/utils/retry'
import { createWorkflowCallbacks, runWithWorkflow } from '@/lib/utils/langchain'
import type { WorkflowStep } from '@/lib/types/workflow'
import type { Database } from '@/lib/types/database'

/**
 * Service for patient summary verification and correction
 */
export class PatientSummaryVerificationService {
  private readonly logger = logger as any; // Type assertion for withMetadata method
  private readonly supabase = createBrowserClient();

  /**
   * Process a correction to update a patient summary
   * 
   * @param summary Existing patient summary
   * @param correction User correction text
   * @param options Optional processing options
   * @returns Updated patient summary
   */
  async processCorrection(
    summary: PatientSummary,
    correction: string,
    options?: {
      workflowId?: string;
      onProgress?: (progress: number) => void;
      temperature?: number;
      userId?: string;
    }
  ): Promise<PatientSummary> {
    const moduleLogger = this.logger.withMetadata({
      method: 'processCorrection',
      correctionLength: correction?.length,
      workflowId: options?.workflowId
    });
    
    try {
      moduleLogger.info('Processing correction for patient summary');
      
      // Validate inputs
      if (!summary) {
        throw new ValidationError({
          message: 'Valid patient summary is required',
          code: 'INVALID_SUMMARY'
        });
      }
      
      if (!correction || correction.trim() === '') {
        throw new ValidationError({
          message: 'Correction text is required',
          code: 'EMPTY_CORRECTION'
        });
      }
      
      // Set up callback handlers for progress tracking if needed
      const callbackHandlers = options?.workflowId || options?.onProgress
        ? createWorkflowCallbacks(
            options.workflowId || null,
            'correction' as WorkflowStep,
            { onProgress: options.onProgress }
          )
        : [];
      
      // Create LLM model (always use o3-mini as specified)
      const llm = langChainCore.createChatOpenAI({
        model: 'o3-mini', // Changed from modelName to model
        temperature: options?.temperature ?? 0.1,
        callbacks: callbackHandlers
      });
      
      // Serialize existing summary for the prompt
      const summaryText = this.serializeSummary(summary);
      
      // Create prompt for applying corrections
      const correctionPrompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(
          `You are a clinical documentation specialist updating a patient summary based on user feedback.
          
          Apply the user's correction to the existing patient summary.
          
          Return the complete updated summary in clean, well-structured markdown, incorporating all the changes.
          
          Guidelines:
          - Maintain the same markdown structure as the original summary
          - Only make changes that align with the user's correction
          - Be precise in implementing the exact correction requested
          - Keep all unrelated information intact
          - Add a note at the end of modified sections: **[Updated]**
          - Ensure all medical information is presented accurately
          - Use ## for section headings`
        ),
        HumanMessagePromptTemplate.fromTemplate(
          `Current Patient Summary:
          
          {summaryText}
          
          User Correction:
          
          {correction}
          
          Please update the summary to incorporate this correction.`
        )
      ]);
      
      // Create sequence for correction processing
      const correctionSequence = RunnableSequence.from([
        correctionPrompt,
        llm,
        new StringOutputParser()
      ]);
      
      // Create runnable config
      const runnableConfig: RunnableConfig = {
        runName: 'Patient Summary Correction',
        metadata: { 
          correctionLength: correction.length,
          workflowId: options?.workflowId 
        }
      };
      
      // Use workflow tracking if workflow ID provided
      const workflowId = options?.workflowId;
      const updatedSummaryText = await runWithWorkflow<string>(
        'correction' as WorkflowStep,
        async () => {
          // Use withRetry for resilience
          return await withRetry(
            async () => correctionSequence.invoke(
              { 
                summaryText, 
                correction 
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
      
      // Parse sections from the corrected text
      const updatedSections = this.parseSummaryIntoSections(updatedSummaryText);
      
      // Create the updated summary object
      const now = new Date().toISOString();
      
      // Track the correction in verification history if not already present
      const verificationInfo = summary.metadata.verificationInfo || {
        status: VerificationStatus.inProgress, // Fixed enum value
        corrections: [],
        verificationStartedAt: now
      };
      
      // Add correction to history using type assertion for corrections array
      const typedVerificationInfo = verificationInfo as any;
      typedVerificationInfo.corrections = [
        ...(typedVerificationInfo.corrections || []),
        {
          id: crypto.randomUUID(),
          timestamp: now,
          userId: options?.userId || 'system',
          text: correction
        }
      ];
      
      const correctedSummary: PatientSummary = {
        ...summary,
        // Update sections with corrected content
        patientInfo: updatedSections.patientInfo ?? summary.patientInfo,
        medicalHistory: updatedSections.medicalHistory ?? summary.medicalHistory,
        currentConditions: updatedSections.currentConditions ?? summary.currentConditions,
        medications: updatedSections.medications ?? summary.medications,
        recentFindings: updatedSections.recentFindings ?? summary.recentFindings,
        treatmentPlans: updatedSections.treatmentPlans ?? summary.treatmentPlans,
        labResults: updatedSections.labResults ?? summary.labResults,
        imagingResults: updatedSections.imagingResults ?? summary.imagingResults,
        recommendations: updatedSections.recommendations ?? summary.recommendations,
        metadata: {
          ...summary.metadata,
          lastUpdated: now, // Changed from updatedAt to lastUpdated
          verificationInfo: typedVerificationInfo
        } as any
      };
      
      moduleLogger.info('Successfully applied correction to patient summary');
      
      // Store correction in database if patient ID is available
      const patientId = (summary.metadata as any).patientId;
      if (patientId) {
        await this.storeCorrection(
          patientId, 
          correction, 
          options?.userId || 'system'
        );
      }
      
      return correctedSummary;
    } catch (error) {
      moduleLogger.error('Failed to process correction', {}, error);
      
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
        message: `Failed to process correction: ${normError.message}`,
        code: 'CORRECTION_FAILED',
        data: { correctionLength: correction?.length },
        cause: error
      });
    }
  }
  
  /**
   * Check if a user message is confirming verification
   * 
   * @param message User message text
   * @param options Optional processing options
   * @returns Verification status (VERIFIED, NEEDS_CORRECTION, UNCLEAR)
   */
  async checkVerificationStatus(
    message: string,
    options?: {
      workflowId?: string;
    }
  ): Promise<'VERIFIED' | 'NEEDS_CORRECTION' | 'UNCLEAR'> {
    const moduleLogger = this.logger.withMetadata({
      method: 'checkVerificationStatus',
      messageLength: message?.length,
      workflowId: options?.workflowId
    });
    
    try {
      moduleLogger.info('Checking verification status from user message');
      
      // Validate input
      if (!message || message.trim() === '') {
        throw new ValidationError({
          message: 'User message is required',
          code: 'EMPTY_MESSAGE'
        });
      }
      
      // Set up callback handlers if needed
      const callbackHandlers = options?.workflowId
        ? createWorkflowCallbacks(options.workflowId, 'verification' as WorkflowStep)
        : [];
      
      // Create LLM model (use O3-mini for classification tasks)
      const llm = langChainCore.createChatOpenAI({
        model: 'o3-mini', // Changed from modelName to model
        temperature: 0, // Use zero temperature for classification
        callbacks: callbackHandlers
      });
      
      // Create prompt for verification check
      const verificationPrompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(
          `You are a medical verification assistant that determines if a patient summary is ready for report generation.
          
          Analyze the user's message to determine if they are confirming the summary is correct.
          
          If the user is confirming (with words like "confirm", "looks good", "correct", "approve", etc.), respond with "VERIFIED".
          If the user is providing corrections or asking questions, respond with "NEEDS_CORRECTION".
          If you're unsure about the user's intent, respond with "UNCLEAR".
          
          Only output one of these three values: "VERIFIED", "NEEDS_CORRECTION", or "UNCLEAR".`
        ),
        HumanMessagePromptTemplate.fromTemplate('{message}')
      ]);
      
      // Create sequence for verification check
      const verificationSequence = RunnableSequence.from([
        verificationPrompt,
        llm,
        new StringOutputParser()
      ]);
      
      // Create runnable config
      const runnableConfig: RunnableConfig = {
        runName: 'Verification Status Check',
        metadata: { 
          messageLength: message.length,
          workflowId: options?.workflowId 
        }
      };
      
      // Perform verification check with retry
      const result = await withRetry(
        async () => verificationSequence.invoke({ message }, runnableConfig),
        {
          maxRetries: 1,
          baseDelay: 500
        }
      );
      
      if (!result) {
        moduleLogger.warn('Empty verification check result');
        return 'UNCLEAR';
      }
      
      // Parse the result
      const decision = result.trim().toUpperCase();
      
      // Quick check for common confirmation patterns if model fails
      if (decision !== 'VERIFIED' && 
          decision !== 'NEEDS_CORRECTION' && 
          decision !== 'UNCLEAR') {
        
        // Fallback pattern matching
        const confirmationRegex = /\b(confirm|approved|looks good|correct|yes|verified)\b/i;
        const correctionRegex = /\b(missing|wrong|incorrect|not right|fix|change|mistake|error)\b/i;
        
        if (confirmationRegex.test(message.toLowerCase())) {
          moduleLogger.info('Using regex fallback: detected confirmation pattern');
          return 'VERIFIED';
        }
        
        if (correctionRegex.test(message.toLowerCase())) {
          moduleLogger.info('Using regex fallback: detected correction pattern');
          return 'NEEDS_CORRECTION';
        }
        
        moduleLogger.warn('Model returned unexpected verification status, defaulting to UNCLEAR', {
          actualResponse: decision
        });
        
        return 'UNCLEAR';
      }
      
      moduleLogger.info('Verification check completed', { decision });
      return decision as 'VERIFIED' | 'NEEDS_CORRECTION' | 'UNCLEAR';
    } catch (error) {
      moduleLogger.error('Failed to check verification status', {}, error);
      
      // Default to UNCLEAR on error
      return 'UNCLEAR';
    }
  }
  
  /**
   * Mark a patient summary as verified
   * 
   * @param patientId Patient ID
   * @param verifiedBy User ID who verified
   * @param status Verification status
   * @param comments Optional verification comments
   * @returns Verified patient summary
   */
  async verifySummary(
    patientId: string,
    verifiedBy: string,
    status: 'verified' | 'rejected' = 'verified',
    comments?: string
  ): Promise<PatientSummary | null> {
    const moduleLogger = this.logger.withMetadata({
      method: 'verifySummary',
      patientId,
      verifiedBy,
      status
    });
    
    try {
      moduleLogger.info('Verifying patient summary');
      
      // Validate inputs
      if (!patientId || patientId.trim() === '') {
        throw new ValidationError({
          message: 'Valid patient ID is required',
          code: 'INVALID_PATIENT_ID'
        });
      }
      
      // Get the current time
      const verifiedAt = new Date().toISOString();
      
      // Fetch the existing summary
      const { data: existingSummary, error } = await this.supabase
        .from('patient_summaries')
        .select('summary, id')
        .eq('patient_id', patientId)
        .single();

      if (error || existingSummary === undefined || existingSummary === null) {
        moduleLogger.warn(`No existing summary found for patient ${patientId}`);
        return null;
      }

      // Parse the existing summary
      const summary = existingSummary.summary as unknown as PatientSummary;

      // Define custom verification status enum values for rejected status
      const verificationStatusEnum = {
        ...VerificationStatus,
        rejected: 'failed' // Map rejected to an existing value
      };

      // Create updated summary with verification info
      const updatedSummary = {
        ...summary,
        metadata: {
          ...summary.metadata,
          // Add verification info
          verificationInfo: {
            status: status === 'verified' ? VerificationStatus.completed : verificationStatusEnum.rejected,
            verifiedAt,
            verifiedBy,
            comments: comments || undefined
          }
        }
      };

      // Update the record with verification data
      const { error: updateError } = await this.supabase
        .from('patient_summaries')
        .update({
          verified_at: verifiedAt,
          verified_by: verifiedBy,
          summary: updatedSummary as any,
          last_modified_by: verifiedBy,
        })
        .eq('id', existingSummary.id);

      if (updateError) {
        throw new SystemError({
          message: `Failed to update verification status: ${updateError.message}`,
          code: 'VERIFICATION_UPDATE_FAILED',
          data: { patientId },
          cause: updateError
        });
      }

      moduleLogger.info('Successfully verified patient summary', {
        patientId,
        status
      });
      
      return updatedSummary;
    } catch (error) {
      moduleLogger.error('Failed to verify summary', {}, error);
      
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
        message: `Failed to verify summary: ${normError.message}`,
        code: 'VERIFICATION_FAILED',
        data: { patientId, verifiedBy, status },
        cause: error
      });
    }
  }
  
  /**
   * Get the verification status of a patient summary
   * 
   * @param patientId Patient ID
   * @returns Verification status or null if summary doesn't exist
   */
  async getSummaryVerificationStatus(patientId: string): Promise<{
    verifiedAt: string;
    verifiedBy: string;
    status: string;
  } | null> {
    try {
      const moduleLogger = this.logger.withMetadata({
        method: 'getSummaryVerificationStatus',
        patientId
      });
      
      moduleLogger.info('Getting verification status for patient summary');
      
      // Validate inputs
      if (!patientId || patientId.trim() === '') {
        throw new ValidationError({
          message: 'Valid patient ID is required',
          code: 'INVALID_PATIENT_ID'
        });
      }

      // Fetch verification status
      const { data, error } = await this.supabase
        .from('patient_summaries')
        .select('verified_at, verified_by, summary')
        .eq('patient_id', patientId)
        .single();

      if (error || data === undefined || data === null || data.verified_at === undefined || data.verified_at === null) {
        return null;
      }

      // Get the verification status from the summary metadata if available
      const summary = data.summary as unknown as PatientSummary & {
        metadata: { verificationInfo?: { status: string } }
      };

      // Default to 'verified' if no specific status is saved
      const status = summary?.metadata?.verificationInfo?.status ?? 'verified';

      return {
        verifiedAt: data.verified_at,
        verifiedBy: data.verified_by ?? 'unknown',
        status,
      };
    } catch (error) {
      this.logger.error(
        `Error getting verification status for patient ${patientId}`,
        { patientId },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }
  
  /**
   * Store a correction in the database
   * 
   * @param patientId Patient ID
   * @param correction Correction text
   * @param userId User who made the correction
   */
  private async storeCorrection(
    patientId: string,
    correction: string,
    userId: string
  ): Promise<void> {
    try {
      await (this.supabase
        .from('patient_summary_corrections' as any)
        .insert({
          patient_id: patientId,
          correction_text: correction,
          created_by: userId,
          created_at: new Date().toISOString()
        }));
      
      this.logger.debug('Stored correction in database', {
        patientId,
        userId
      });
    } catch (error) {
      this.logger.warn('Failed to store correction in database', {
        patientId, 
        userId
      }, error);
      // Don't throw, non-critical
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
          sources: [], // We don't have direct sources in the verification phase
        };
      }
    });

    return sections;
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

// Interface for section data
interface PatientSummarySection {
  title: string;
  content: string;
  sources: Array<any>; // Simplified for the verification service
}

// Create singleton instance
export const patientSummaryVerificationService = new PatientSummaryVerificationService();