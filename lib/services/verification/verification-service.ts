/**
 * Unified Verification Service
 * 
 * Provides centralized verification functionality across the application
 */
import { createBrowserClient } from '@/lib/supabase/clients';
import { workflowManager } from '@/lib/utils/workflow-manager';
import type { WorkflowStep } from '@/lib/processing/types/workflow';
import type { ExtractedDocument } from '@/lib/processing/types/extraction';
import type { 
  VerificationItem, 
  VerificationStatus, 
  VerifiedDocument,
} from '@/lib/processing/types/verification';
import { getDbCompatibleMetadata } from '@/lib/processing/types/verification';
import type { WorkflowOptions } from '@/lib/utils/workflow-manager';
import type { Json } from '@/lib/supabase';
import { patientSummaryService } from '@/lib/services/patient/patient-summary-service';

/**
 * Verification service options
 */
export interface VerificationOptions extends WorkflowOptions {
  /**
   * User ID performing verification
   */
  userId?: string;
}

/**
 * Unified Verification Service
 */
export class VerificationService {
  private supabase = createBrowserClient();
  
  /**
   * Generate verification items from an extracted document
   * 
   * @param extractedDocument Extracted document
   * @returns Generated verification items
   * @deprecated This method will be removed as we transition to summary-based verification.
   * Future implementations should use PatientSummaryService for verification.
   */
  generateVerificationItems(
    extractedDocument: ExtractedDocument
  ): VerificationItem[] {
    const items: VerificationItem[] = [];
    
    try {
      // Extract document type
      const docType = extractedDocument.documentType;
      
      // Get raw text
      const rawText = extractedDocument.extractedData.rawText;
      
      // Extract field patterns based on document type
      const patterns = this.getPatternsByDocType(docType.category, docType.type);
      
      // Process patterns
      for (const pattern of patterns) {
        const value = this.extractValueByPattern(rawText, pattern);
        
        if (value) {
          items.push({
            id: crypto.randomUUID(),
            label: pattern.label,
            value,
            originalValue: value,
            isVerified: false,
            fieldType: pattern.fieldType || 'text',
            confidence: pattern.confidence || 0.75,
            category: pattern.category || 'general',
            fieldName: pattern.fieldName,
            isRequired: pattern.isRequired || false,
            section: pattern.category || 'general',
            key: pattern.fieldName,
          });
        }
      }
      
      // If we couldn't identify specific fields, create a general text item
      if (items.length === 0) {
        items.push({
          id: crypto.randomUUID(),
          label: 'Document Content',
          value: rawText,
          originalValue: rawText,
          isVerified: false,
          fieldType: 'text',
          confidence: 0.5,
          category: 'content',
          fieldName: 'content',
          isRequired: true,
          section: 'content',
          key: 'content',
        });
      }
    } catch (error) {
      console.error('[VerificationService] Error generating verification items:', error);
    }
    
    return items;
  }
  
  /**
   * Save verification results
   * Uses workflow manager for state management and progress reporting.
   * 
   * @param workflowId Workflow ID
   * @param verificationItems Verification items
   * @param status Verification status
   * @param extractedDocument Original extracted document
   * @param options Verification options
   * @returns Verified document
   * @deprecated This method will be removed as we transition to summary-based verification.
   * Use patientSummaryService.verifySummary() instead.
   */
  async saveVerificationResults(
    workflowId: string,
    verificationItems: VerificationItem[],
    status: VerificationStatus,
    extractedDocument: ExtractedDocument,
    options?: VerificationOptions
  ): Promise<VerifiedDocument> {
    return workflowManager.handleWorkflowOperation<VerifiedDocument>(
      workflowId || null,
      'verification' as WorkflowStep,
      async () => {
        try {
          workflowManager.reportProgress(options, 'verification', 0);
          
          // Verify required fields
          const requiredItems = verificationItems.filter(item => item.isRequired);
          const unverifiedRequiredItems = requiredItems.filter(item => !item.isVerified);
          
          if (unverifiedRequiredItems.length > 0) {
            throw new Error(`Required fields are not verified: ${unverifiedRequiredItems.map(i => i.label).join(', ')}`);
          }
          
          workflowManager.reportProgress(options, 'verification', 20);
          
          // Create verified document from extracted document
          const verifiedDocument: VerifiedDocument = {
            id: crypto.randomUUID(),
            extractedDocumentId: extractedDocument.id,
            createdAt: new Date().toISOString(),
            verificationStatus: status,
            verificationItems,
            patientId: extractedDocument.patientId,
            documentType: extractedDocument.documentType,
            verifiedData: this.assembleVerifiedData(verificationItems),
            originalData: extractedDocument.extractedData
          };
          
          workflowManager.reportProgress(options, 'verification', 50);
          
          // Save to patient_summaries table using simplified approach without direct ID insertion
          try {
            const verifiedData = this.assembleVerifiedData(verificationItems);
            
            // Save metadata
            const metadataJson = getDbCompatibleMetadata({
              documentId: extractedDocument.id,
              workflowId,
              extractedAt: new Date().toISOString(),
              verificationItems
            }) as Json;
            
            // Create record in patient_summaries table
            const { error } = await this.supabase
              .from('patient_summaries')
              .upsert({
                id: verifiedDocument.id, // Explicitly set ID for upsert
                patient_id: extractedDocument.patientId as string,
                document_count: 1,
                verified_at: status.verifiedAt || new Date().toISOString(),
                verified_by: status.verifiedBy || options?.userId || 'system',
                created_by: status.verifiedBy || options?.userId || 'system',
                last_modified_by: status.verifiedBy || options?.userId || 'system',
                summary: getDbCompatibleMetadata({
                  patientInfo: this.extractCategoryData(verificationItems, 'patient'),
                  metadata: metadataJson,
                  verifiedData
                }) as Json
              }, {
                onConflict: 'id'
              });
            
            if (error) {
              console.error('Error saving to patient_summaries:', error);
              throw new Error(`Failed to save verification: ${error.message}`);
            }
            
            // We no longer integrate with the patient summary service here
            // This is now handled through a separate flow where summaries are verified directly
          } catch (dbError) {
            console.error('Database error:', dbError);
            // Continue even if summary saving fails
          }
          
          workflowManager.reportProgress(options, 'verification', 80);
          
          // Update workflow state if needed
          if (workflowId) {
            await workflowManager.updateWorkflowState(workflowId, 'verification', {
              status: 'verified',
              verifiedDocumentId: verifiedDocument.id,
              completedAt: new Date().toISOString()
            });
          }
          
          workflowManager.reportProgress(options, 'verification', 100);
          
          // Report success
          workflowManager.reportSuccess(options, verifiedDocument);
          
          return verifiedDocument;
        } catch (error) {
          console.error('[VerificationService] Error saving verification results:', error);
          
          // Report error
          workflowManager.reportError(options, error);
          
          throw error;
        }
      },
      options
    );
  }
  
  /**
   * Extract category data from verification items
   * 
   * @param items Verification items
   * @param category Category to extract
   * @returns Extracted category data
   * @deprecated This method will be removed as we transition to summary-based verification.
   */
  private extractCategoryData(items: VerificationItem[], category: string): Record<string, any> {
    const result: Record<string, any> = {};
    
    // Find items for the specified category
    const categoryItems = items.filter(item => 
      item.category === category && 
      item.isVerified && 
      item.fieldName
    );
    
    // Build result object
    for (const item of categoryItems) {
      if (item.fieldName) {
        result[item.fieldName] = this.formatValueByType(item.value, item.fieldType);
      }
    }
    
    return result;
  }
  
  /**
   * Assemble verified data from verification items
   * 
   * @param verificationItems Verification items
   * @returns Assembled verified data
   * @deprecated This method will be removed as we transition to summary-based verification.
   */
  assembleVerifiedData(verificationItems: VerificationItem[]): Record<string, any> {
    const data: Record<string, any> = {};
    
    // Group by category
    const categories = new Set(verificationItems.map(item => item.category));
    
    // Process each category
    for (const category of categories) {
      const categoryItems = verificationItems.filter(item => item.category === category);
      
      // Check if we need to create a nested object or a field
      if (category === 'general' || category === 'content') {
        // Add directly to the root
        for (const item of categoryItems) {
          if (item.fieldName) {
            data[item.fieldName] = this.formatValueByType(item.value, item.fieldType);
          }
        }
      } else {
        // Create nested category object
        const categoryData: Record<string, any> = {};
        
        for (const item of categoryItems) {
          if (item.fieldName) {
            categoryData[item.fieldName] = this.formatValueByType(item.value, item.fieldType);
          }
        }
        
        if (Object.keys(categoryData).length > 0) {
          data[category] = categoryData;
        }
      }
    }
    
    return data;
  }
  
  /**
   * Format value by type
   * 
   * @param value Value to format
   * @param fieldType Field type
   * @returns Formatted value
   * @deprecated This method will be removed as we transition to summary-based verification.
   */
  private formatValueByType(value: string, fieldType?: string): any {
    switch (fieldType) {
      case 'number':
        return parseFloat(value);
        
      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
        
      case 'date':
        try {
          // Store date as ISO string for database compatibility
          return new Date(value).toISOString();
        } catch (e) {
          return value;
        }
        
      case 'json':
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
        
      case 'text':
      default:
        return value;
    }
  }
  
  /**
   * Extract value by pattern
   * 
   * @param text Text to extract from
   * @param pattern Pattern to match
   * @returns Extracted value
   * @deprecated This method will be removed as we transition to summary-based verification.
   */
  private extractValueByPattern(
    text: string,
    pattern: {
      label: string;
      regex: string | RegExp;
      group?: number;
      fieldType?: string;
      fieldName: string;
      category?: string;
      isRequired?: boolean;
      confidence?: number;
    }
  ): string | null {
    try {
      const regex = typeof pattern.regex === 'string' 
        ? new RegExp(pattern.regex, 'i')
        : pattern.regex;
      
      const match = text.match(regex);
      
      if (match) {
        const group = pattern.group || 1;
        return match[group]?.trim() || null;
      }
    } catch (error) {
      console.error(`[VerificationService] Error extracting ${pattern.label}:`, error);
    }
    
    return null;
  }
  
  /**
   * Get patterns by document type
   * 
   * @param category Document category
   * @param type Document type
   * @returns Patterns for the document type
   * @deprecated This method will be removed as we transition to summary-based verification.
   */
  private getPatternsByDocType(
    category: string,
    type: string
  ): Array<{
    label: string;
    regex: string | RegExp;
    group?: number;
    fieldType?: string;
    fieldName: string;
    category?: string;
    isRequired?: boolean;
    confidence?: number;
  }> {
    // In a real implementation, this could be loaded from a database
    // or a configuration file based on the document type
    
    // For now, we'll include a basic set of patterns for common fields
    const commonPatterns = [
      {
        label: 'Patient Name',
        regex: /patient:?\s*([^\n,]+)/i,
        fieldType: 'text',
        fieldName: 'patientName',
        category: 'patient',
        isRequired: true,
        confidence: 0.85
      },
      {
        label: 'Patient ID',
        regex: /(?:patient|record|id)\s*(?:\#|number|id)?\s*:?\s*([A-Z0-9-]+)/i,
        fieldType: 'text',
        fieldName: 'patientId',
        category: 'patient',
        isRequired: false,
        confidence: 0.8
      },
      {
        label: 'Date of Birth',
        regex: /(?:dob|date\s+of\s+birth):?\s*([\d\/\-\.]+)/i,
        fieldType: 'date',
        fieldName: 'dateOfBirth',
        category: 'patient',
        isRequired: false,
        confidence: 0.9
      },
      {
        label: 'Diagnosis',
        regex: /(?:diagnosis|assessment):?\s*([^\n]+)/i,
        fieldType: 'text',
        fieldName: 'diagnosis',
        category: 'medical',
        isRequired: false,
        confidence: 0.75
      }
    ];
    
    // Based on category and type, select the appropriate patterns
    switch (category) {
      case 'clinical':
        return [
          ...commonPatterns,
          {
            label: 'Visit Date',
            regex: /(?:visit|encounter|appointment)\s+date:?\s*([\d\/\-\.]+)/i,
            fieldType: 'date',
            fieldName: 'visitDate',
            category: 'encounter',
            isRequired: false,
            confidence: 0.8
          },
          {
            label: 'Provider',
            regex: /(?:provider|doctor|physician):?\s*([^\n]+)/i,
            fieldType: 'text',
            fieldName: 'provider',
            category: 'encounter',
            isRequired: false,
            confidence: 0.7
          },
          {
            label: 'Chief Complaint',
            regex: /(?:chief\s+complaint|reason\s+for\s+visit):?\s*([^\n]+)/i,
            fieldType: 'text',
            fieldName: 'chiefComplaint',
            category: 'medical',
            isRequired: false,
            confidence: 0.8
          }
        ];
        
      case 'lab':
        return [
          ...commonPatterns,
          {
            label: 'Collection Date',
            regex: /(?:collected|collection|drawn):?\s*(?:on|date)?:?\s*([\d\/\-\.]+)/i,
            fieldType: 'date',
            fieldName: 'collectionDate',
            category: 'lab',
            isRequired: false,
            confidence: 0.85
          },
          {
            label: 'Test Name',
            regex: /(?:test|procedure):?\s*([^\n]+)/i,
            fieldType: 'text',
            fieldName: 'testName',
            category: 'lab',
            isRequired: false,
            confidence: 0.8
          },
          {
            label: 'Result',
            regex: /(?:result|value):?\s*([^\n]+)/i,
            fieldType: 'text',
            fieldName: 'result',
            category: 'lab',
            isRequired: false,
            confidence: 0.75
          }
        ];
        
      default:
        return commonPatterns;
    }
  }
  
  /**
   * Update patient summary with verification
   * 
   * @param patientId Patient ID
   * @param verificationItems Verification items
   * @param status Verification status
   * @deprecated Use patientSummaryService.verifySummary method directly
   */
  private async updatePatientSummaryWithVerification(
    patientId: string,
    verificationItems: VerificationItem[],
    status: VerificationStatus
  ): Promise<void> {
    console.warn('Method deprecated: should use direct summary verification instead');
    // Implementation remains for backwards compatibility
    try {
      // Call the patient summary service to merge verification data
      const result = await patientSummaryService.mergeVerificationData(
        patientId,
        verificationItems,
        status
      );
      
      if (result) {
        console.log(`Successfully updated patient summary with verification data for patient ${patientId}`);
      } else {
        // This is not an error case - it just means there was no existing summary to update
        console.log(`No existing patient summary found to update for patient ${patientId}`);
      }
    } catch (error) {
      console.error(`Error updating patient summary with verification data for patient ${patientId}:`, error);
      // This is non-critical, so we don't re-throw
    }
  }
  
  /**
   * Verify a patient summary
   * This is the new, recommended approach for verification.
   * 
   * @param patientId Patient ID
   * @param userId User ID
   * @param status Verification status
   * @param comments Optional comments
   * @returns Success flag
   */
  async verifySummary(
    patientId: string,
    userId: string,
    status: 'verified' | 'rejected' = 'verified',
    comments?: string
  ): Promise<boolean> {
    try {
      // Use the patient summary service directly
      const result = await patientSummaryService.verifySummary(
        patientId,
        userId,
        status,
        comments
      );
      
      return !!result;
    } catch (error) {
      console.error(`Error verifying summary for patient ${patientId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const verificationService = new VerificationService(); 