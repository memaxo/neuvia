'use client';

import { useState, useEffect } from 'react';
import { VerificationPanel } from '@/components/verification/VerificationPanel';
import { 
  type VerifiedDocument, 
  type ExtractedDocument,
  toCompatibleExtractedDocument,
  ensureISOString
} from '@/lib/processing/types/verification';
import type { ExtractedData } from '@/lib/processing/types';

interface VerificationAdapterProps {
  /**
   * Document ID
   */
  documentId: string;
  
  /**
   * Workflow ID
   */
  workflowId: string;
  
  /**
   * Patient ID
   */
  patientId?: string;
  
  /**
   * Department ID
   */
  departmentId?: string;
  
  /**
   * Pre-extracted document (optional)
   */
  extractedDocument?: ExtractedDocument;
  
  /**
   * Alternative raw extracted data (optional)
   */
  extractedData?: ExtractedData;
  
  /**
   * Original text for reference
   */
  originalText?: string;
  
  /**
   * On verification complete callback
   */
  onComplete?: (verifiedDocument: VerifiedDocument) => void;
  
  /**
   * On cancel callback
   */
  onCancel?: () => void;
}

/**
 * Adapter component that integrates the unified verification panel 
 * with the chat interface
 */
export function VerificationAdapter({
  documentId,
  workflowId,
  patientId,
  departmentId,
  extractedDocument,
  extractedData,
  originalText,
  onComplete,
  onCancel
}: VerificationAdapterProps) {
  // If we have raw extracted data but no document, convert it
  const [convertedDocument, setConvertedDocument] = useState<ExtractedDocument | undefined>(undefined);
  
  useEffect(() => {
    if (extractedData && !extractedDocument && !convertedDocument) {
      // Create a simple extracted document structure from the raw data
      const doc: ExtractedDocument = {
        id: documentId,
        patientId,
        documentType: {
          category: 'clinical',
          type: 'report'
        },
        extractedData: {
          ...extractedData,
          rawText: originalText || extractedData.rawText || '',
          metadata: {
            ...extractedData.metadata,
            extractedAt: ensureISOString(new Date())
          }
        },
        isSuccessful: true,
        createdAt: ensureISOString(new Date())
      };
      
      setConvertedDocument(doc);
    }
  }, [extractedData, extractedDocument, convertedDocument, documentId, patientId, originalText]);
  
  return (
    <div className="bg-card rounded-lg border shadow-sm">
      <VerificationPanel
        departmentId={departmentId}
        documentId={documentId}
        extractedDocument={extractedDocument || convertedDocument}
        isEmbedded={true}
        onCancel={onCancel}
        onVerificationComplete={onComplete}
        patientId={patientId}
        workflowId={workflowId}
      />
    </div>
  );
} 