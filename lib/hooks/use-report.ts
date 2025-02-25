import { useState, useCallback, useMemo } from 'react';
import { DocumentProcessingService } from '@/lib/processing/document-processing-service';
import type { 
  ResearchDocument, 
  ReportData, 
  ReportOptions, 
  ProcessingStatus, 
  ReportFormat,
  ReportDocument
} from '@/lib/processing/types/index';

/**
 * Hook for report generation operations
 */
export function useReport(researchDocument: ResearchDocument | null) {
  // State for report data
  const [reportData, setReportData] = useState<ReportData | null>(null);
  
  // State for report processing status
  const [status, setStatus] = useState<ProcessingStatus>({
    status: 'idle',
    progress: 0,
    phase: 'report'
  });
  
  // State for the formatted report
  const [formattedReport, setFormattedReport] = useState<string | null>(null);
  
  // State for report format
  const [reportFormat, setReportFormat] = useState<ReportFormat>('markdown');
  
  // State for report document
  const [reportDocument, setReportDocument] = useState<ReportDocument | null>(null);
  
  // Create the processing service
  const processingService = useMemo(() => new DocumentProcessingService(), []);
  
  /**
   * Generate a report
   */
  const generateReport = useCallback(async (options?: Omit<ReportOptions, 'onProgress'>) => {
    if (!researchDocument) {
      setStatus({
        status: 'error',
        progress: 0,
        phase: 'report',
        error: 'No research document available'
      });
      return null;
    }
    
    try {
      // Update status
      setStatus({
        status: 'processing',
        progress: 0,
        phase: 'report',
        currentStep: 'Starting report generation'
      });
      
      // Generate the report
      const result = await processingService.generateReport(
        researchDocument,
        {
          ...options,
          onProgress: (progress: number) => {
            setStatus({
              status: 'processing',
              progress,
              phase: 'report',
              currentStep: `Generating report (${progress}%)`
            });
          }
        }
      );
      
      // Update state with result
      setReportData(result);
      
      // Create report document
      const newReportDocument: ReportDocument = {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        documentType: researchDocument.documentType,
        patientId: researchDocument.patientId,
        researchDocument,
        reportData: result,
        format: reportFormat,
        formattedContent: null // Will be set after formatting
      };
      
      setReportDocument(newReportDocument);
      
      // Update status
      setStatus({
        status: 'success',
        progress: 100,
        phase: 'report',
        currentStep: 'Report generated'
      });
      
      return result;
    } catch (error) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      setStatus({
        status: 'error',
        progress: 0,
        phase: 'report',
        error: errorMessage,
        currentStep: 'Report generation failed'
      });
      
      console.error('Error in useReport:', error);
      return null;
    }
  }, [researchDocument, reportFormat, processingService]);
  
  /**
   * Format the report into the specified format
   */
  const formatReport = useCallback(async (format: ReportFormat = reportFormat) => {
    if (!reportData) {
      setStatus({
        status: 'error',
        progress: 0,
        phase: 'format',
        error: 'No report data available'
      });
      return null;
    }
    
    try {
      // Update status
      setStatus({
        status: 'processing',
        progress: 0,
        phase: 'format',
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
            phase: 'format',
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
          format,
          formattedContent
        };
        
        setReportDocument(updatedReportDocument);
      }
      
      // Update status
      setStatus({
        status: 'success',
        progress: 100,
        phase: 'format',
        currentStep: `Report formatted to ${format}`
      });
      
      return formattedContent;
    } catch (error) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      setStatus({
        status: 'error',
        progress: 0,
        phase: 'format',
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
      phase: 'report'
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
    processingService
  };
}