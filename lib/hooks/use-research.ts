import { useState, useCallback, useMemo } from 'react';
import { DocumentProcessingService } from '@/lib/processing/document-processing-service';
import type { 
  VerifiedDocument, 
  ResearchResult, 
  ResearchOptions,
  ProcessingStatus,
  ResearchDocument
} from '@/lib/processing/types/index';

/**
 * Hook for deep research operations
 */
export function useResearch(verifiedDocument: VerifiedDocument | null) {
  // State for research results
  const [researchResults, setResearchResults] = useState<ResearchResult[]>([]);
  
  // State for research status
  const [status, setStatus] = useState<ProcessingStatus>({
    status: 'idle',
    progress: 0,
    phase: 'research'
  });
  
  // State for research document
  const [researchDocument, setResearchDocument] = useState<ResearchDocument | null>(null);
  
  // Create the processing service
  const processingService = useMemo(() => new DocumentProcessingService(), []);
  
  /**
   * Perform deep research
   */
  const performResearch = useCallback(async (
    query: string,
    options?: Omit<ResearchOptions, 'onProgress'>
  ) => {
    if (!verifiedDocument) {
      setStatus({
        status: 'error',
        progress: 0,
        phase: 'research',
        error: 'No verified document available'
      });
      return null;
    }
    
    try {
      // Update status
      setStatus({
        status: 'processing',
        progress: 0,
        phase: 'research',
        currentStep: 'Starting research'
      });
      
      // Perform the research
      const result = await processingService.performResearch(
        query,
        verifiedDocument,
        {
          ...options,
          onProgress: (progress: number) => {
            setStatus({
              status: 'processing',
              progress,
              phase: 'research',
              currentStep: `Researching (${progress}%)`
            });
          }
        }
      );
      
      // Update state with results
      setResearchResults(prevResults => [...prevResults, result]);
      
      // Create research document
      const newResearchDocument: ResearchDocument = {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        documentType: verifiedDocument.documentType,
        patientId: verifiedDocument.patientId,
        verifiedDocument,
        researchResults: [...researchResults, result],
        queries: [...researchResults.map(r => r.query), query]
      };
      
      setResearchDocument(newResearchDocument);
      
      // Update status
      setStatus({
        status: 'success',
        progress: 100,
        phase: 'research',
        currentStep: 'Research completed'
      });
      
      return result;
    } catch (error) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      setStatus({
        status: 'error',
        progress: 0,
        phase: 'research',
        error: errorMessage,
        currentStep: 'Research failed'
      });
      
      console.error('Error in useResearch:', error);
      return null;
    }
  }, [verifiedDocument, researchResults, processingService]);
  
  /**
   * Clear research results
   */
  const clearResults = useCallback(() => {
    setResearchResults([]);
    setStatus({
      status: 'idle',
      progress: 0,
      phase: 'research'
    });
    setResearchDocument(null);
  }, []);
  
  return {
    researchResults,
    status,
    researchDocument,
    performResearch,
    clearResults,
    // Expose the service for direct access
    processingService
  };
} 