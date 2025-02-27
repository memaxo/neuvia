import { useState, useCallback, useMemo } from 'react';
import { ReportService } from '@/lib/services/report/report-service';
import { perplexityService } from '@/lib/services/perplexity/perplexity-service';

// Import types from their specific files until the index exports are recognized
import type { ReportData, ReportFormat, ReportOptions, ReportDocument } from '@/lib/processing/types/report';
import type { ProcessingStatus, DocumentType } from '@/lib/processing/types/base';
import type { ResearchDocument, ResearchResult } from '@/lib/processing/types/research';
import type { VerifiedDocument } from '@/lib/processing/types/verification';

/**
 * Hook for report generation operations
 */
export function useReport(documentInput: ResearchDocument | VerifiedDocument | null) {
  // State for report data
  const [reportData, setReportData] = useState<ReportData | null>(null);
  
  // State for report processing status
  const [status, setStatus] = useState<ProcessingStatus>({
    status: 'pending',
    progress: 0,
    phase: 'reporting'
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
  
  // Create the report service
  const reportService = useMemo(() => new ReportService(), []);
  
  /**
   * Generate a report from research or verified document
   */
  const generateReport = useCallback(async (options?: Omit<ReportOptions, 'onProgress'>) => {
    if (!documentInput) {
      setStatus({
        status: 'error',
        progress: 0,
        phase: 'reporting',
        error: 'No document available'
      });
      return null;
    }
    
    try {
      // Update status
      setStatus({
        status: 'processing',
        progress: 0,
        phase: 'reporting',
        currentStep: 'Starting report generation'
      });
      
      // First, create a ResearchResult object if it doesn't exist
      let researchResult: ResearchResult;
      
      // If this is a verified document, we need to do the research first
      if (isVerifiedDocument) {
        // For verified documents, we need to perform research first
        const verifiedDocument = documentInput as VerifiedDocument;
        
        setStatus({
          status: 'processing',
          progress: 10,
          phase: 'analysis',
          currentStep: 'Performing research on verified data'
        });
        
        // Extract patient data from verified document
        const patientData = Object.entries(verifiedDocument.verifiedData || {})
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');
        
        // Use Perplexity to research the verified data
        researchResult = await perplexityService.performDeepResearch(
          `Analyze the patient data: ${verifiedDocument.documentType}`, 
          {
            patientData,
            onProgress: (progress) => {
              setStatus({
                status: 'processing',
                progress: Math.floor(progress * 0.6), // First 60% for research
                phase: 'analysis',
                currentStep: `Performing research (${progress}%)`
              });
            }
          }
        );
      } else {
        // For research documents, use the existing research results
        const researchDocument = documentInput as ResearchDocument;
        
        if (!researchDocument.researchResults || researchDocument.researchResults.length === 0) {
          throw new Error('Research document has no research results');
        }
        
        researchResult = researchDocument.researchResults[0];
      }
      
      // Now generate the report using the report service
      setStatus({
        status: 'processing',
        progress: 60,
        phase: 'reporting',
        currentStep: 'Generating report'
      });
      
      // Use the ReportService to generate the report
      const result = await reportService.generateReport(
        {
          type: isVerifiedDocument 
            ? 'diagnostic' 
            : (documentInput as ResearchDocument).documentType.type === 'medical'
              ? 'medical-diagnosis'
              : 'research',
          patientId: documentInput.patientId || '',
          researchData: researchResult,
          contextData: isVerifiedDocument
            ? { verifiedDocument: documentInput }
            : { researchDocument: documentInput },
          saveToDatabase: options?.saveToDatabase !== false
        },
        {
          ...options,
          onProgress: (phase, progress) => {
            setStatus({
              status: 'processing',
              // Scale progress to the remaining 40% (60-100%)
              progress: 60 + Math.floor(progress * 0.4),
              phase: 'reporting',
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
        documentType: isVerifiedDocument 
          ? (documentInput as VerifiedDocument).documentType
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
        phase: 'reporting',
        currentStep: 'Report generated'
      });
      
      return result;
    } catch (error) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      setStatus({
        status: 'error',
        progress: 0,
        phase: 'reporting',
        error: errorMessage,
        currentStep: 'Report generation failed'
      });
      
      console.error('Error in useReport:', error);
      return null;
    }
  }, [documentInput, isVerifiedDocument, reportFormat, reportService]);
  
  /**
   * Format the report into the specified format
   */
  const formatReport = useCallback(async (format: ReportFormat = reportFormat) => {
    if (!reportData) {
      setStatus({
        status: 'error',
        progress: 0,
        phase: 'reporting',
        error: 'No report data available'
      });
      return null;
    }
    
    try {
      // Update status
      setStatus({
        status: 'processing',
        progress: 0,
        phase: 'reporting',
        currentStep: `Starting ${format} formatting`
      });
      
      setReportFormat(format);
      
      // Format logic is delegated to reportService and not duplicated here
      let formattedContent = reportData.content;
      
      // For HTML format, convert markdown to HTML
      if (format === 'html' && reportData.content) {
        // Use reportService to handle this conversion if it has this functionality
        // For now, this is a simplified approach
        formattedContent = `<html><body>${reportData.content.replace(/\n/g, '<br>')}</body></html>`;
      }
      
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
        phase: 'reporting',
        currentStep: `Report formatted to ${format}`
      });
      
      return formattedContent;
    } catch (error) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      setStatus({
        status: 'error',
        progress: 0,
        phase: 'reporting',
        error: errorMessage,
        currentStep: 'Report formatting failed'
      });
      
      console.error('Error formatting report:', error);
      return null;
    }
  }, [reportData, reportFormat, reportDocument]);
  
  /**
   * Reset report state
   */
  const reset = useCallback(() => {
    setReportData(null);
    setFormattedReport(null);
    setReportDocument(null);
    setStatus({
      status: 'pending',
      progress: 0,
      phase: 'reporting'
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
    reportService,
    // Expose input type
    isVerifiedDocument
  };
}