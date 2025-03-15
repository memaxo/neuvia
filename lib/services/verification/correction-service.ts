import { apiClient } from '@/lib/api/client/api-client'
import logger from '@/lib/logger'
import { normalizeError, ValidationError } from '@/lib/errors'
import type {
  VerificationServiceResult,
  SubmitCorrectionOptions,
  ProcessCorrectionOptions,
  CorrectionData
} from '@/lib/types/verification'

/**
 * CorrectionService
 * Handles user corrections for verified content including:
 * - Submission of corrections
 * - Processing corrections to update patient summaries
 * - Managing correction history and metadata
 * - Validation of correction data
 */
export class CorrectionService {
  /**
   * Generate a unique correction ID
   * @returns A unique ID for the correction
   */
  private generateCorrectionId(): string {
    // Create a unique ID for this correction
    return crypto.randomUUID();
  }

  /**
   * Validate correction data
   * @param correction The correction data to validate
   * @returns True if valid, false otherwise
   */
  private validateCorrectionData(correction: CorrectionData): boolean {
    if (!correction) return false;
    if (!correction.correctedFields || Object.keys(correction.correctedFields).length === 0) return false;
    return true;
  }

  /**
   * Create a structured correction entry for the history
   * @param correction The correction data
   * @param userId The user who made the correction
   * @returns A structured correction entry
   */
  private createCorrectionEntry(
    correction: CorrectionData,
    userId: string
  ): Record<string, unknown> {
    const correctionId = this.generateCorrectionId();
    return {
      id: correctionId,
      timestamp: new Date().toISOString(),
      userId: userId || correction.userId || 'system',
      fields: correction.correctedFields,
      comments: correction.userComments || '',
      versionId: correction.versionId
    };
  }
  
  /**
   * Prepare correction data for workflow processing
   * This method extracts the domain logic from the workflow file
   * 
   * @param options The correction options
   * @returns Processed correction data with IDs and prepared content
   */
  async prepareCorrectionData(options: {
    workflowId: string;
    verificationId: string;
    correction: CorrectionData;
    currentSummary?: string;
  }): Promise<{
    correctionId: string;
    versionId: string;
    summaryId: string;
    newSummary: string;
    metadata: Record<string, any>;
  }> {
    const moduleLogger = logger.withMetadata({
      module: 'CorrectionService',
      method: 'prepareCorrectionData',
      workflowId: options.workflowId,
      verificationId: options.verificationId
    });
    
    try {
      // Generate required IDs
      const correctionId = this.generateCorrectionId();
      const versionId = options.correction.versionId || this.generateCorrectionId();
      const summaryId = this.generateCorrectionId(); // New summary version ID
      
      // Apply corrections to the current summary
      const newSummary = options.currentSummary 
        ? this.applyCorrectionsToSummary(options.currentSummary, options.correction)
        : '';
      
      // Build metadata for the correction
      const metadata = {
        correctionId,
        versionId,
        previousVersionId: options.correction.versionId,
        timestamp: new Date().toISOString(),
        userId: options.correction.userId,
        fieldCount: Object.keys(options.correction.correctedFields || {}).length,
        hasUserComments: !!options.correction.userComments
      };
      
      moduleLogger.info('Correction data prepared for workflow', {
        correctionId,
        summaryId,
        fieldCount: metadata.fieldCount
      });
      
      return {
        correctionId,
        versionId,
        summaryId,
        newSummary,
        metadata
      };
    } catch (error) {
      moduleLogger.error('Failed to prepare correction data', {
        error: normalizeError(error)
      });
      
      // Provide fallback data in case of error
      return {
        correctionId: this.generateCorrectionId(),
        versionId: options.correction.versionId || this.generateCorrectionId(),
        summaryId: this.generateCorrectionId(),
        newSummary: options.currentSummary || '',
        metadata: {
          timestamp: new Date().toISOString(),
          userId: options.correction.userId
        }
      };
    }
  }

  /**
   * Submit a correction to the verification process.
   * This method handles:
   * - Validation of correction data
   * - Creating a structured correction entry
   * - Submitting the correction to the API
   * - Managing the response and error handling
   */
  async submitCorrection(options: SubmitCorrectionOptions): Promise<
    VerificationServiceResult<{
      summaryId: string
      summary: string
      structuredData?: Record<string, any>
      correctionCount?: number
      correctionId?: string
    }>
  > {
    const moduleLogger = logger.withMetadata({
      module: 'CorrectionService',
      method: 'submitCorrection',
      workflowId: options.workflowId,
      messageId: options.messageId,
    })

    try {
      moduleLogger.info('Submitting correction', { workflowId: options.workflowId })

      // Validate the correction data
      if (!options.correction) {
        throw new CorrectionError({
          message: 'Correction data is required',
          code: 'CORRECTION_DATA_MISSING'
        });
      }

      // Generate a correctionId for tracking
      const correctionId = this.generateCorrectionId();
      
      // Call the API through the client
      const result = await apiClient.verification.submitCorrection({
        correction: options.correction,
        currentSummary: options.currentSummary,
        workflowId: options.workflowId,
        messageId: options.messageId,
        correctionId, // Include the generated ID
      })

      // Handle the API response
      if (!result.success || !result.data?.summaryId) {
        throw new CorrectionError({
          message: 'Failed to submit correction',
          code: 'CORRECTION_SUBMISSION_FAILED',
          data: { originalResult: result },
        })
      }

      moduleLogger.info('Correction submitted successfully', {
        summaryId: result.data.summaryId,
        correctionId
      })

      return {
        success: true,
        data: {
          summaryId: result.data.summaryId,
          summary: result.data.summary,
          structuredData: result.data.structuredData,
          correctionCount: result.data.correctionCount,
          correctionId
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      const normalizedError = normalizeError(error)
      moduleLogger.error('Failed to submit correction', {}, normalizedError)
      return {
        success: false,
        data: {
          summaryId: '',
          summary: '',
        },
        error: {
          message: normalizedError.message || 'Failed to submit correction',
          code: normalizedError.code || 'CORRECTION_SUBMISSION_FAILED',
          details: normalizedError.data || {},
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Process a correction to update the patient summary.
   * This method handles:
   * - Retrieving the verification workflow context
   * - Creating structured correction data
   * - Delegating to the workflow engine for state transitions
   * - Applying the correction to the patient summary
   * - Tracking correction history
   * - Managing fallback paths when workflow engine fails
   */
  async processCorrection(options: ProcessCorrectionOptions): Promise<
    VerificationServiceResult<{
      summaryId: string
      summary: string
      structuredData?: Record<string, any>
      correctionCount?: number
    }>
  > {
    const moduleLogger = logger.withMetadata({
      module: 'CorrectionService',
      method: 'processCorrection',
      workflowId: options.workflowId,
      messageId: options.messageId,
    })

    try {
      moduleLogger.info('Processing correction', { workflowId: options.workflowId })

      // Validate required inputs
      if (!options.workflowId) {
        throw new ValidationError({
          message: 'Workflow ID is required',
          code: 'WORKFLOW_ID_MISSING'
        });
      }

      if (!options.currentSummary) {
        throw new ValidationError({
          message: 'Current summary is required',
          code: 'CURRENT_SUMMARY_MISSING'
        });
      }

      if (!options.correction) {
        throw new ValidationError({
          message: 'Correction data is required',
          code: 'CORRECTION_DATA_MISSING'
        });
      }

      // Try workflow engine approach first
      try {
        // Import verification workflow to avoid circular dependencies
        const { verificationWorkflow } = await import('@/lib/services/workflow/domain/verification-workflow');
        
        // Get verification ID and context from workflow state
        const { workflowEngine } = await import('@/lib/services/workflow/coordination/workflow-engine');
        const workflowResult = await workflowEngine.getWorkflow(options.workflowId as string);
        
        if (workflowResult.isSuccess()) {
          const workflow = workflowResult.value;
          const verificationId = workflow.context.verificationId;
          
          // Create structured correction data with metadata
          const correctionData: CorrectionData = {
            userId: options.userId || 'system',
            correctedFields: {
              summary: options.currentSummary,
              correction: options.correction
            },
            userComments: options.correction,
            // Use existing version ID or generate a new one
            versionId: options.versionId || this.generateCorrectionId()
          };
          
          // Process the correction using workflow engine
          const correctionResult = await verificationWorkflow.processCorrection(
            options.workflowId as string,
            verificationId,
            correctionData
          );
          
          if (correctionResult.isSuccess()) {
            moduleLogger.info('Correction processed successfully via workflow engine', {
              summaryId: correctionResult.value.summaryId,
              verificationId,
              correctionCount: correctionResult.value.data?.correctionCount
            });
            
            return {
              success: true,
              data: {
                summaryId: correctionResult.value.summaryId || '',
                summary: correctionResult.value.data?.currentSummary || options.currentSummary,
                structuredData: correctionResult.value.data?.structuredData,
                correctionCount: correctionResult.value.data?.correctionCount
              },
              timestamp: new Date().toISOString(),
            };
          }
          
          // If workflow action failed, log the specific failure
          moduleLogger.warn('Workflow engine correction failed', {
            error: correctionResult.error.message,
            code: correctionResult.error.code,
            workflowId: options.workflowId
          });
        }
        
        // Fall back to API client if workflow engine approach fails
        moduleLogger.info('Falling back to API client for correction processing', {
          workflowId: options.workflowId,
          reason: 'Workflow engine approach failed'
        });
      } catch (engineError) {
        moduleLogger.warn('Error using workflow engine for correction', {
          error: engineError instanceof Error ? engineError.message : String(engineError),
          workflowId: options.workflowId
        });
      }

      // Call the API through the client (fallback approach)
      const result = await apiClient.verification.processCorrection({
        correction: options.correction,
        currentSummary: options.currentSummary,
        workflowId: options.workflowId,
        messageId: options.messageId,
        userId: options.userId,
        versionId: options.versionId
      })

      // Handle the API response
      if (!result.success || !result.data?.summaryId) {
        throw new CorrectionError({
          message: 'Failed to process correction',
          code: 'CORRECTION_PROCESSING_FAILED',
          data: { originalResult: result },
        })
      }

      moduleLogger.info('Correction processed successfully via API client', {
        summaryId: result.data.summaryId,
      })

      return {
        success: true,
        data: {
          summaryId: result.data.summaryId,
          summary: result.data.summary,
          structuredData: result.data.structuredData,
          correctionCount: result.data.correctionCount,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      const normalized = normalizeError(error)
      moduleLogger.error('Failed to process correction', {}, normalized)
      return {
        success: false,
        data: { summaryId: '', summary: '' },
        error: {
          message: normalized.message ?? 'Correction processing failed',
          code: normalized.code ?? 'CORRECTION_FAILED',
          details: normalized.data,
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Apply corrections to a document summary
   * This implements the business logic for applying correction fields to a summary
   * 
   * @param summary The current summary text
   * @param correction The correction data to apply
   * @returns The updated summary with corrections applied
   */
  applyCorrectionsToSummary(
    summary: string,
    correction: CorrectionData
  ): string {
    if (!summary || !correction || !correction.correctedFields) {
      return summary;
    }

    let updatedSummary = summary;
    
    // Apply different types of corrections based on structure
    if (correction.correctedFields.replacements) {
      const replacements = correction.correctedFields.replacements as Array<{
        original: string;
        replacement: string;
      }>;
      
      for (const item of replacements) {
        updatedSummary = updatedSummary.replace(item.original, item.replacement);
      }
    }
    
    // If there's a direct summary correction, use it
    if (correction.correctedFields.summary) {
      updatedSummary = correction.correctedFields.summary as string;
    }
    
    // If there are section-specific corrections
    if (correction.correctedFields.sections) {
      const sections = correction.correctedFields.sections as Record<string, string>;
      
      // This would need to parse the summary into sections and update them
      // Implementation depends on the specific format of the summary
      // Simplified example:
      for (const [sectionName, newContent] of Object.entries(sections)) {
        const sectionRegex = new RegExp(`(## ${sectionName}\\s*?\\n)([\\s\\S]*?)(?=\\n## |$)`, 'i');
        updatedSummary = updatedSummary.replace(sectionRegex, `$1${newContent}\n`);
      }
    }
    
    return updatedSummary;
  }
}

export const correctionService = new CorrectionService();

/**
 * Error class for correction-related errors
 */
export class CorrectionError extends Error {
  code?: string;
  data?: Record<string, any>;
  
  constructor({
    message,
    code,
    data
  }: {
    message: string;
    code?: string;
    data?: Record<string, any>;
  }) {
    super(message);
    this.name = 'CorrectionError';
    this.code = code;
    this.data = data;
  }
}