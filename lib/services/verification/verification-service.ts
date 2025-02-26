/**
 * Unified Verification Service
 * 
 * Provides centralized verification functionality across the application
 */
import { createBrowserClient } from '@/lib/supabase/clients';
import type { 
  ExtractedDocument, 
  VerificationItem, 
  VerificationStatus, 
  VerifiedDocument,
  WorkflowStep,
  dateToISOString,
  getDbCompatibleMetadata,
} from '@/lib/processing/types/verification';
import type { Json } from '@/lib/supabase';

/**
 * Verification service options
 */
export interface VerificationOptions {
  /**
   * User ID performing verification
   */
  userId?: string;
  
  /**
   * Progress callback
   */
  onProgress?: (progress: number) => void;
  
  /**
   * Success callback
   */
  onSuccess?: (verifiedDocument: VerifiedDocument) => void;
  
  /**
   * Error callback
   */
  onError?: (error: string) => void;
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
   * 
   * @param workflowId Workflow ID
   * @param verificationItems Verification items
   * @param status Verification status
   * @param extractedDocument Original extracted document
   * @param options Verification options
   * @returns Verified document
   */
  async saveVerificationResults(
    workflowId: string,
    verificationItems: VerificationItem[],
    status: VerificationStatus,
    extractedDocument: ExtractedDocument,
    options?: VerificationOptions
  ): Promise<VerifiedDocument> {
    try {
      options?.onProgress?.(0);
      
      // Verify required fields
      const requiredItems = verificationItems.filter(item => item.isRequired);
      const unverifiedRequiredItems = requiredItems.filter(item => !item.isVerified);
      
      if (unverifiedRequiredItems.length > 0) {
        throw new Error(`Required fields are not verified: ${unverifiedRequiredItems.map(i => i.label).join(', ')}`);
      }
      
      options?.onProgress?.(20);
      
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
      
      options?.onProgress?.(50);
      
      // Save to patient_summaries table
      const verifiedData = this.assembleVerifiedData(verificationItems);
      
      // Format metadata for database compatibility
      const metadataJson: Json = {
        extractedDocumentId: extractedDocument.id,
        workflowId,
        verificationItems,
        originalData: extractedDocument.extractedData,
        verifiedData
      };
      
      // Create or update patient summary
      const { data, error } = await this.supabase
        .from('patient_summaries')
        .insert({
          id: verifiedDocument.id,
          patient_id: verifiedDocument.patientId,
          summary: {
            // Patient info category from verification items
            patientInfo: this.extractCategoryData(verificationItems, 'patient'),
            // Medical history from verification items
            medicalHistory: this.extractCategoryData(verificationItems, 'history'),
            // Current conditions from verification items
            currentConditions: this.extractCategoryData(verificationItems, 'condition'),
            // Medications from verification items
            medications: this.extractCategoryData(verificationItems, 'medication'),
            // Recent findings from verification items
            recentFindings: this.extractCategoryData(verificationItems, 'finding'),
            // Treatment plans from verification items
            treatmentPlans: this.extractCategoryData(verificationItems, 'treatment'),
            // Lab results from verification items
            labResults: this.extractCategoryData(verificationItems, 'lab'),
            // Imaging results from verification items
            imagingResults: this.extractCategoryData(verificationItems, 'imaging'),
            // Recommendations from verification items
            recommendations: this.extractCategoryData(verificationItems, 'recommendation'),
            // Additional metadata
            metadata: metadataJson
          },
          document_count: 1, // Just one document was processed
          verified_at: status.verifiedAt,
          verified_by: status.verifiedBy || options?.userId,
          // Required fields
          created_by: status.verifiedBy || options?.userId || 'system',
          last_modified_by: status.verifiedBy || options?.userId || 'system'
        })
        .select('id')
        .single();
      
      if (error) {
        throw new Error(`Failed to save verified document: ${error.message}`);
      }
      
      options?.onProgress?.(80);
      
      // Update workflow state
      await this.supabase
        .from('workflow_states')
        .update({
          current_step: 'verification' as WorkflowStep,
          metadata: {
            status: 'verified',
            verifiedDocumentId: verifiedDocument.id,
            completedAt: new Date().toISOString()
          }
        })
        .eq('id', workflowId);
      
      options?.onProgress?.(100);
      
      // Call success callback
      options?.onSuccess?.(verifiedDocument);
      
      return verifiedDocument;
    } catch (error) {
      console.error('[VerificationService] Error saving verification results:', error);
      
      // Call error callback
      options?.onError?.(error instanceof Error ? error.message : String(error));
      
      throw error;
    }
  }
  
  /**
   * Extract category data from verification items
   * 
   * @param items Verification items
   * @param category Category to extract
   * @returns Extracted category data
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
   * @returns Assembled data
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
   * Format value based on field type
   * 
   * @param value Field value
   * @param fieldType Field type
   * @returns Formatted value
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
   * Extract value using pattern
   * 
   * @param text Text to extract from
   * @param pattern Pattern to use
   * @returns Extracted value
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
   * Get extraction patterns by document type
   * 
   * @param category Document category
   * @param type Document type
   * @returns Extraction patterns
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
}

// Export singleton instance
export const verificationService = new VerificationService(); 