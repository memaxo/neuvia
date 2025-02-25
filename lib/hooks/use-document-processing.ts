import { useState, useCallback, useMemo } from 'react';
import { DocumentProcessingService } from '@/lib/processing/document-processing-service';
import type { 
  ProcessingStatus, 
  ExtractedDocument, 
  DocumentType 
} from '@/lib/processing/types';

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
  
  // Create the processing service
  const processingService = useMemo(() => new DocumentProcessingService(), []);
  
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
        progress: 0,
        currentStep: 'Starting document extraction',
        phase: 'extraction'
      });
      
      // Process the document
      const result = await processingService.processDocument(
        file,
        patientId,
        {
          documentType,
          onStatusUpdate: (newStatus) => setStatus(newStatus)
        }
      );
      
      // Update state with the result
      setExtractedDocument(result);
      
      // Update final status if needed
      if (status.status !== 'success') {
        setStatus({
          status: result.isSuccessful ? 'success' : 'error',
          progress: 100,
          currentStep: result.isSuccessful ? 'Document processed successfully' : 'Failed to process document',
          error: result.isSuccessful ? undefined : result.errorMessage,
          phase: 'extraction'
        });
      }
      
      return result;
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      setStatus({
        status: 'error',
        progress: 0,
        currentStep: 'Error processing document',
        error: errorMessage,
        phase: 'extraction'
      });
      
      console.error('Error in useDocumentProcessing:', error);
      return null;
    }
  }, [processingService, status.status]);
  
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
    reset,
    // Expose the service for direct access to its methods if needed
    processingService
  };
} 