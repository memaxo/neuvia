import { useState, useCallback } from 'react';
import { documentService } from '@/lib/services/document/document-service';
import type { ProcessingStatus, DocumentType } from '@/lib/processing/types/base';
import type { ExtractedDocument } from '@/lib/processing/types/extraction';

/**
 * Hook for document processing operations
 */
export function useDocumentProcessing() {
  // State for the extracted document
  const [extractedDocument, setExtractedDocument] = useState<ExtractedDocument | null>(null);

  // State for processing status
  const [status, setStatus] = useState<ProcessingStatus>({
    status: 'idle',
    progress: 0
  });

  /**
   * Process a document
   */
  const processDocument = useCallback(async (
    file: File, 
    patientId: string,
    documentType?: DocumentType
  ) => {
    try {
      // Update status to processing
      setStatus({
        status: 'processing',
        progress: 0
      });

      // Call the unified document service
      const result = await documentService.processDocument(
        file,
        patientId,
        documentType,
        (newStatus) => setStatus(newStatus)
      );

      // Update state with the result
      setExtractedDocument(result);

      // Update final status if needed
      if (result.isSuccessful) {
        setStatus({
          status: 'success',
          progress: 100
        });
      } else {
        setStatus({
          status: 'error',
          progress: 0,
          error: result.errorMessage
        });
      }

      return result;
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);

      setStatus({
        status: 'error',
        progress: 0,
        error: errorMessage
      });

      console.error('Error in useDocumentProcessing:', error);
      return null;
    }
  }, []);

  /**
   * Reset the document processing state
   */
  const reset = useCallback(() => {
    setExtractedDocument(null);
    setStatus({
      status: 'idle',
      progress: 0
    });
  }, []);

  return {
    extractedDocument,
    status,
    processDocument,
    reset
  };
} 