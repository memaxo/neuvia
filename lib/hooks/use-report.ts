import { useState, useCallback, useMemo } from 'react';
import { DocumentProcessingService } from '@/lib/processing/document-processing-service';
import type { 
  ResearchDocument,
  VerifiedDocument, 
  ReportData, 
  ReportOptions, 
  ProcessingStatus, 
  ReportFormat,
  ReportDocument,
  ResearchResult
} from '@/lib/processing/types/index';

/**
 * Hook for report generation operations
 */
export function useReport(documentInput: ResearchDocument | VerifiedDocument | null) {
  // State for report data
  const [reportData, setReportData] = useState<ReportData | null>(null);
  
  // State for report processing status
  const [status, setStatus] = useState<ProcessingStatus>({
    status: 'idle',
    progress: 0,
    phase: 'generation'
  });
  
  // State for the formatted report
  const [formattedReport, setFormattedReport] = useState<string | null>(null);
  
  // State for report format
  const [reportFormat, setReportFormat] = useState<ReportFormat>('markdown');
  
  // State for report document
  const [reportDocument, setReportDocument] = useState<ReportDocument | null>(null);
  
  // Determine document type
  const isVerifiedDocument = useMemo(() => {
    return documentInput && 'verifiedData' in documentInput;
  }, [documentInput]);
  
  // Create the processing service
  const processingService = useMemo(() => new DocumentProcessingService(), []);
  
  /**
   * Generate a report from research or verified document
   */
  const generateReport = useCallback(async (options?: Omit<ReportOptions, 'onProgress'>) => {
    if (!documentInput) {
      setStatus({
        status: 'error',
        progress: 0,
        phase: 'generation',
        error: 'No document available'
      });
      return null;
    }
    
    try {
      // Update status
      setStatus({
        status: 'processing',
        progress: 0,
        phase: 'generation',
        currentStep: 'Starting report generation'
      });
      
      let result: ReportData;
      
      // Handle different document types
      if (isVerifiedDocument) {
        // For verified document, use it directly
        const verifiedDocument = documentInput as VerifiedDocument;
        
        // Use empty research results if not available
        const emptyResearch: ResearchResult[] = [{
          query: 'Direct verification-to-report',
          sources: [],
          summary: 'Direct report generation from verified data',
          timestamp: new Date(),
          confidence: 1.0,
          keyFindings: ['Generated directly from verified data']
        }];
        
        // Generate report from verified document
        result = await processingService.generateReport(
          verifiedDocument,
          emptyResearch,
          {
            ...options,
            onProgress: (phase, progress) => {
              setStatus({
                status: 'processing',
                progress,
                phase: 'generation',
                currentStep: `Generating report (${progress}%)`
              });
            }
          }
        );
      } else {
        // For research document, use previous implementation
        const researchDocument = documentInput as ResearchDocument;
        
        // Generate the report
        result = await processingService.generateReport(
          researchDocument.verifiedDocument, // Use the verified document inside research document
          researchDocument.researchResults || [], // Use the research results
          {
            ...options,
            onProgress: (phase, progress) => {
              setStatus({
                status: 'processing',
                progress,
                phase: 'generation',
                currentStep: `Generating report (${progress}%)`
              });
            }
          }
        );
      }
      
      // Update state with result
      setReportData(result);
      
      // Create report document
      const newReportDocument: ReportDocument = {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        documentType: isVerifiedDocument 
          ? (documentInput as VerifiedDocument).extractedDocument.documentType
          : (documentInput as ResearchDocument).documentType,
        patientId: documentInput.patientId,
        researchDocument: isVerifiedDocument 
          ? {} as ResearchDocument // Empty research document for direct verification
          : (documentInput as ResearchDocument),
        reportData: result,
        format: reportFormat
      };
      
      setReportDocument(newReportDocument);
      
      // Update status
      setStatus({
        status: 'success',
        progress: 100,
        phase: 'generation',
        currentStep: 'Report generated'
      });
      
      return result;
    } catch (error) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      setStatus({
        status: 'error',
        progress: 0,
        phase: 'generation',
        error: errorMessage,
        currentStep: 'Report generation failed'
      });
      
      console.error('Error in useReport:', error);
      return null;
    }
  }, [documentInput, isVerifiedDocument, reportFormat, processingService]);
  
  /**
   * Format the report into the specified format
   */
  const formatReport = useCallback(async (format: ReportFormat = reportFormat) => {
    if (!reportData) {
      setStatus({
        status: 'error',
        progress: 0,
        phase: 'formatting',
        error: 'No report data available'
      });
      return null;
    }
    
    try {
      // Update status
      setStatus({
        status: 'processing',
        progress: 0,
        phase: 'formatting',
        currentStep: `Starting ${format} formatting`
      });
      
      setReportFormat(format);
      
      // Format the report
      const formattedContent = await processingService.formatReport(
        reportData,
        format,
        (progress: number) => {
          setStatus({
            status: 'processing',
            progress,
            phase: 'formatting',
            currentStep: `Formatting to ${format} (${progress}%)`
          });
        }
      );
      
      // Update formatted report state
      setFormattedReport(formattedContent);
      
      // Update report document with formatted content
      if (reportDocument) {
        const updatedReportDocument: ReportDocument = {
          ...reportDocument,
          format
        };
        
        setReportDocument(updatedReportDocument);
      }
      
      // Update status
      setStatus({
        status: 'success',
        progress: 100,
        phase: 'formatting',
        currentStep: `Report formatted to ${format}`
      });
      
      return formattedContent;
    } catch (error) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      setStatus({
        status: 'error',
        progress: 0,
        phase: 'formatting',
        error: errorMessage,
        currentStep: 'Report formatting failed'
      });
      
      console.error('Error formatting report:', error);
      return null;
    }
  }, [reportData, reportFormat, reportDocument, processingService]);
  
  /**
   * Reset report state
   */
  const reset = useCallback(() => {
    setReportData(null);
    setFormattedReport(null);
    setReportDocument(null);
    setStatus({
      status: 'idle',
      progress: 0,
      phase: 'generation'
    });
  }, []);
  
  return {
    reportData,
    status,
    reportFormat,
    formattedReport,
    reportDocument,
    generateReport,
    formatReport,
    reset,
    // Expose the service for direct access
    processingService,
    // Expose input type
    isVerifiedDocument
  };
}