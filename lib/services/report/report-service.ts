import { langChainCore } from '@/lib/langchain/core'
import type {
  DocumentType,
  ProcessingStatus
} from '@/lib/processing/types/base'
import type {
  ReportData,
  ReportDocument,
  ReportFormat,
  ReportGenerationParams,
  ReportOptions,
  ReportSections
} from '@/lib/types/report'
import type { ResearchDocument } from '@/lib/processing/types/research'
import type { ResearchResult } from '@/lib/processing/types/research'
import type { VerifiedDocument } from '@/lib/processing/types/verification'
import { createBrowserClient } from '@/lib/supabase/clients'
import { createWorkflowCallbacks, runWithWorkflow } from '@/lib/utils/langchain'
import { perplexityService } from '@/lib/services/perplexity/perplexity-service'

/**
 * Unified Report Service
 *
 * Single entry point for report generation across the application
 */
export class ReportService {
  private supabase = createBrowserClient()

  /**
   * Generate a report based on a research document or verified document
   *
   * @param documentInput Research document or verified document
   * @param options Report generation options
   * @returns Generated report data
   */
  async generateReportFromDocument(
    documentInput: ResearchDocument | VerifiedDocument,
    options?: ReportOptions
  ): Promise<ReportData> {
    // Track status
    let statusCallback = options?.onProgress;
    const updateStatus = (phase: string, progress: number, currentStep?: string) => {
      statusCallback?.(phase as any, progress);
    };
    
    try {
      // Update status
      updateStatus('initialization', 0, 'Starting report generation');
      
      // Determine document type
      const isVerifiedDocument = 'verifiedData' in documentInput;
      
      // First, create a ResearchResult object if it doesn't exist
      let researchResult: ResearchResult;
      
      // If this is a verified document, we need to do the research first
      if (isVerifiedDocument) {
        // For verified documents, we need to perform research first
        const verifiedDocument = documentInput as VerifiedDocument;
        
        updateStatus('research', 10, 'Performing research on verified data');
        
        // Extract patient data from verified document
        const patientData = Object.entries(
          verifiedDocument.verifiedData || {}
        )
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');
        
        // Use Perplexity to research the verified data
        researchResult = await perplexityService.performDeepResearch(
          `Analyze the patient data: ${verifiedDocument.documentType}`,
          {
            patientData,
            onProgress: (progress) => {
              updateStatus('research', Math.floor(progress * 0.6), // First 60% for research
                `Performing research (${progress}%)`);
            },
          }
        );
      } else {
        // For research documents, use the existing research results
        const researchDocument = documentInput as ResearchDocument;
        
        if (
          !researchDocument.researchResults ||
          researchDocument.researchResults.length === 0
        ) {
          throw new Error('Research document has no research results');
        }
        
        researchResult = researchDocument.researchResults[0];
      }
      
      // Now generate the report
      updateStatus('generation', 60, 'Generating report');
      
      const reportType = isVerifiedDocument
        ? 'medical-diagnosis'
        : (documentInput as ResearchDocument).documentType?.type === 'medical'
          ? 'medical-diagnosis'
          : 'research';
      
      const result = await this.generateReport(
        {
          type: reportType,
          patientId: documentInput.patientId || '',
          researchData: researchResult,
          contextData: isVerifiedDocument
            ? { verifiedDocument: documentInput }
            : { researchDocument: documentInput },
          saveToDatabase: options?.saveToDatabase !== false,
        },
        {
          onProgress: (phase, progress) => {
            updateStatus(
              'generation',
              // Scale progress to the remaining 40% (60-100%)
              60 + Math.floor(progress * 0.4),
              `Generating report (${progress}%)`
            );
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }
      );
      
      // Update status
      updateStatus('complete', 100, 'Report generated');
      
      // Create and return report document if needed
      if (options?.createReportDocument) {
        const reportDocument: ReportDocument = {
          id: crypto.randomUUID(),
          createdAt: new Date(),
          documentType: isVerifiedDocument
            ? (documentInput as VerifiedDocument).documentType
            : (documentInput as ResearchDocument).documentType,
          patientId: documentInput.patientId || '',
          researchDocument: isVerifiedDocument
            ? {} as ResearchDocument
            : documentInput as ResearchDocument,
          reportData: result,
          format: options.reportFormat || 'markdown'
        };
        
        return result;
      }
      
      return result;
    } catch (error) {
      // Handle errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      
      // Call error callback if provided
      options?.onError?.(errorMessage);
      
      console.error('Error generating report:', error);
      throw error;
    }
  }

  /**
   * Generate a report based on provided parameters
   *
   * @param params Report generation parameters
   * @param options Report options including callbacks
   * @returns Generated report data
   */
  async generateReport(
    params: ReportGenerationParams,
    options?: ReportOptions
  ): Promise<ReportData> {
    try {
      // Track start time for performance measurement
      const startTime = Date.now();
      
      // Initial progress update
      options?.onProgress?.('initialization', 0);
      
      // IMPORTANT: This service now expects research data to be provided
      // and does not perform research itself
      if (!params.researchData) {
        throw new Error('Research data must be provided to generate a report');
      }
      
      options?.onProgress?.('generation', 30);
      
      // Format report based on type and provided research data
      const reportContent = await this.formatReport(
        params.type,
        params.researchData.text || '',
        params.contextData,
        params.researchData.sources || []
      );
      
      options?.onProgress?.('generation', 75);
      
      // Create the report data object
      const reportData: ReportData = {
        content: reportContent,
        sources: params.researchData.sources || [],
        patientId: params.patientId,
        generatedAt: new Date(),
        metadata: {
          modelName: params.researchData.modelName || 'unknown',
          confidence: params.researchData.confidence || 0.8,
          generationTime: Date.now() - startTime,
          reportType: params.type,
          contextData: params.contextData,
        },
        sections: this.extractSections(reportContent),
      };
      
      options?.onProgress?.('generation', 90);
      
      // Save the report to the database if requested
      if (params.saveToDatabase) {
        await this.saveReport(reportData);
      }
      
      options?.onProgress?.('complete', 100);
      
      // Call success callback if provided
      options?.onSuccess?.(reportData);
      
      return reportData;
    } catch (error) {
      // Handle errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      
      // Call error callback if provided
      options?.onError?.(errorMessage);
      
      console.error('Error generating report:', error);
      throw error;
    }
  }

  /**
   * Generate a medical diagnosis report from existing research data
   *
   * @param researchData Research data from previous API call
   * @param patientId Patient ID
   * @param options Report options
   * @returns Generated report data
   */
  async generateMedicalDiagnosisReport(
    researchData: ResearchResult,
    patientId: string,
    options?: ReportOptions
  ): Promise<ReportData> {
    return this.generateReport(
      {
        type: 'medical-diagnosis',
        patientId,
        researchData,
        contextData: {
          patientData: researchData.patientData,
        },
        saveToDatabase: options?.saveToDatabase !== false,
      },
      options
    );
  }

  /**
   * Format a report to the specified format
   *
   * @param reportData Report data to format
   * @param format Desired format
   * @returns Formatted report content
   */
  async formatReportOutput(
    reportData: ReportData,
    format: ReportFormat = 'markdown'
  ): Promise<string> {
    if (!reportData) {
      throw new Error('No report data available for formatting');
    }
    
    try {
      // Format report based on desired output format
      let formattedContent = reportData.content;
      
      switch (format) {
        case 'html':
          // Convert markdown to HTML
          formattedContent = await this.convertMarkdownToHtml(reportData.content);
          break;
          
        case 'pdf':
          // For PDF, we'd typically generate HTML first then convert to PDF
          // This is a placeholder for that logic
          const htmlContent = await this.convertMarkdownToHtml(reportData.content);
          formattedContent = htmlContent;
          // In a real implementation, you would convert HTML to PDF here
          break;
          
        case 'markdown':
        default:
          // No conversion needed for markdown
          break;
      }
      
      return formattedContent;
    } catch (error) {
      console.error('Error formatting report:', error);
      throw new Error(`Failed to format report: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate report using Langchain for improved structure and insights
   */
  async generateReportWithLangchain(
    researchData: ResearchResult,
    patientId: string,
    options?: ReportOptions
  ): Promise<ReportData> {
    try {
      // Track start time for performance measurement
      const startTime = Date.now();
      
      options?.onProgress?.('initialization', 10);
      
      // Create model with callbacks
      const llm = langChainCore.createChatOpenAI({
        temperature: 0.4,
        callbacks: createWorkflowCallbacks(null, 'report_generation', {
          onProgress: (progress: number) => {
            options?.onProgress?.('generation', progress);
          },
        }),
      });
      
      options?.onProgress?.('generation', 30);
      
      // First, generate analysis from research data
      const analysisPrompt = await langChainCore.createPromptTemplate(
        `Analyze the following research data and extract key insights:\n\n{researchText}\n\n` +
          `Provide a structured analysis with sections for findings, diagnoses, and recommendations.`,
        ['researchText']
      );
      
      const analysisPromptFormatted = await analysisPrompt.format({
        researchText: researchData.text,
      });
      
      const analysisResponse = await llm.invoke(analysisPromptFormatted);
      const analysis = String(analysisResponse.content);
      
      options?.onProgress?.('generation', 60);
      
      // Then, format the analysis into a report
      const formatPrompt = await langChainCore.createPromptTemplate(
        `Format the following analysis into a professional medical report:\n\n{analysis}\n\n` +
          `Include the following sections:\n- Summary\n- Findings\n- Diagnoses\n- Recommendations\n- References`,
        ['analysis']
      );
      
      const formatPromptFormatted = await formatPrompt.format({
        analysis,
      });
      
      const formatResponse = await llm.invoke(formatPromptFormatted);
      const formattedReport = String(formatResponse.content);
      
      options?.onProgress?.('generation', 80);
      
      // Extract sections from the formatted report
      const sections = this.extractSections(formattedReport);
      
      // Create the report data object
      const reportData: ReportData = {
        content: formattedReport,
        sources: researchData.sources || [],
        patientId,
        generatedAt: new Date(),
        metadata: {
          modelName: 'gpt-4',
          confidence: 0.85,
          generationTime: Date.now() - startTime,
          reportType: 'medical-diagnosis',
          contextData: options?.contextData,
        },
        sections,
      };
      
      options?.onProgress?.('generation', 90);
      
      // Save the report if requested
      if (options?.saveToDatabase !== false) {
        await this.saveReport(reportData);
      }
      
      options?.onProgress?.('complete', 100);
      
      // Call success callback if provided
      options?.onSuccess?.(reportData);
      
      return reportData;
    } catch (error) {
      // Handle errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      
      // Call error callback if provided
      options?.onError?.(errorMessage);
      
      console.error('Error generating report with Langchain:', error);
      throw error;
    }
  }

  /**
   * Format a report based on type and content
   *
   * @param type Report type
   * @param content Main report content
   * @param contextData Additional context data
   * @param sources Research sources
   * @returns Formatted report content
   */
  private async formatReport(
    type: string,
    content: string,
    contextData?: Record<string, any>,
    sources: any[] = []
  ): Promise<string> {
    // Format based on report type
    switch (type) {
      case 'medical-diagnosis':
        return this.formatMedicalDiagnosisReport(content, contextData, sources);
        
      case 'research':
        return this.formatResearchReport(content, contextData, sources);
        
      default:
        return this.formatStandardReport(content, contextData, sources);
    }
  }

  /**
   * Format a medical diagnosis report
   *
   * @param content Main report content
   * @param contextData Additional context data
   * @param sources Research sources
   * @returns Formatted medical diagnosis report
   */
  private formatMedicalDiagnosisReport(
    content: string,
    contextData?: Record<string, any>,
    sources: any[] = []
  ): string {
    // Extract patient info from context data
    const patientName = contextData?.patientName || 'Patient';
    
    // Create a properly formatted medical report
    let report = `# Medical Diagnosis Report for ${patientName}\n\n`;
    
    // Add primary content
    report += `## Summary\n\n${content}\n\n`;
    
    // Add sections if not already in the content
    if (
      !content.includes('## Findings') &&
      !content.includes('## Assessment')
    ) {
      report += `## Findings\n\nBased on the provided information, the patient presents with...\n\n`;
      report += `## Assessment\n\nThe assessment indicates...\n\n`;
      report += `## Recommendations\n\nRecommended next steps include...\n\n`;
    }
    
    // Add sources section if available
    if (sources.length > 0) {
      report += `## References\n\n`;
      sources.forEach((source, index) => {
        report += `${index + 1}. ${source.title || 'Unknown Source'} - ${source.url || 'No URL'}\n`;
      });
    }
    
    return report;
  }

  /**
   * Format a research report
   *
   * @param content Main report content
   * @param contextData Additional context data
   * @param sources Research sources
   * @returns Formatted research report
   */
  private formatResearchReport(
    content: string,
    contextData?: Record<string, any>,
    sources: any[] = []
  ): string {
    // Create a properly formatted research report
    let report = `# Research Report\n\n`;
    
    // Add query if available
    if (contextData?.query) {
      report += `**Query:** ${contextData.query}\n\n`;
    }
    
    // Add primary content
    report += `## Findings\n\n${content}\n\n`;
    
    // Add sources section if available
    if (sources.length > 0) {
      report += `## Sources\n\n`;
      sources.forEach((source, index) => {
        report += `${index + 1}. ${source.title || 'Unknown Source'} - ${source.url || 'No URL'}\n`;
        if (source.description) {
          report += `   ${source.description}\n\n`;
        }
      });
    }
    
    return report;
  }

  /**
   * Format a standard report
   *
   * @param content Main report content
   * @param contextData Additional context data
   * @param sources Research sources
   * @returns Formatted standard report
   */
  private formatStandardReport(
    content: string,
    contextData?: Record<string, any>,
    sources: any[] = []
  ): string {
    // Create a properly formatted standard report
    let report = `# Report\n\n`;
    
    // Add primary content
    report += content;
    
    // Add sources if available
    if (sources.length > 0) {
      report += `\n\n## References\n\n`;
      sources.forEach((source, index) => {
        report += `${index + 1}. ${source.title || 'Unknown Source'} - ${source.url || 'No URL'}\n`;
      });
    }
    
    return report;
  }

  /**
   * Convert markdown to HTML
   *
   * @param markdown Markdown content
   * @returns HTML content
   */
  private async convertMarkdownToHtml(markdown: string): Promise<string> {
    // This is a placeholder for a real markdown-to-html converter
    // In a production environment, you would use a library like marked or showdown
    
    const simpleHtml = markdown
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />');
    
    return `<html><body>${simpleHtml}</body></html>`;
  }

  /**
   * Save a report to the database
   *
   * @param report Report data to save
   * @returns Saved report ID
   */
  private async saveReport(report: ReportData): Promise<string> {
    try {
      // Get the current user ID from Supabase
      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      const userId = user?.id;
      
      if (!userId) {
        throw new Error('User must be authenticated to save reports');
      }
      
      // Prepare a valid report record that matches the database schema
      const reportRecord = {
        patient_id: report.patientId,
        title:
          report.metadata.title ||
          `${report.metadata.reportType || 'diagnostic'} Report`,
        type:
          report.metadata.reportType === 'medical-diagnosis'
            ? 'diagnostic'
            : report.metadata.reportType === 'research'
              ? 'analytics'
              : 'diagnostic',
        status: 'completed',
        department_id:
          report.metadata.departmentId ||
          '00000000-0000-0000-0000-000000000000', // Default placeholder
        created_by: userId,
        updated_by: userId,
        
        // Convert content from markdown to JSON if needed
        content:
          typeof report.content === 'string'
            ? JSON.stringify({ markdown: report.content })
            : report.content,
        
        // Required metadata with strict structure
        metadata: {
          patientInfo: {
            symptoms: [],
            medicalHistory: [],
            currentMedications: [],
            allergies: [],
            vitalSigns: {},
          },
        },
        
        // Optional fields that might come from research
        summary: report.sections?.summary || '',
        findings: report.sections?.findings
          ? JSON.parse(
              `[{"description": "${report.sections.findings}", "category": "general", "severity": "medium"}]`
            )
          : null,
        recommendations: report.sections?.recommendations
          ? JSON.parse(
              `[{"recommendation": "${report.sections.recommendations}", "priority": "medium"}]`
            )
          : null,
        
        // Quality metrics
        confidence_score: report.metadata.confidence || 0.8,
        
        // Supporting documentation
        source_documents:
          report.sources && report.sources.length > 0
            ? report.sources.map((s) => ({
                title: s.title || 'Unnamed Source',
                url: s.url,
                description: s.description || '',
              }))
            : null,
      };
      
      // Insert the report
      const { data, error } = await this.supabase
        .from('reports')
        .insert(reportRecord)
        .select('id')
        .single();
      
      if (error) {
        throw new Error(`Failed to save report: ${error.message}`);
      }
      
      return data.id;
    } catch (error) {
      console.error('[ReportService] Error saving report:', error);
      throw new Error(
        `Failed to save report: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Extract sections from report content
   *
   * @param content Report content
   * @returns Extracted sections
   */
  private extractSections(content: string): ReportSections {
    const sections: ReportSections = {};
    
    // Extract sections based on markdown headers
    const sectionRegex = /## ([^\n]+)\n\n([^#]+)(?=\n## |$)/g;
    let match;
    
    while ((match = sectionRegex.exec(content)) !== null) {
      const sectionName = match[1].trim().toLowerCase().replace(/\s+/g, '_');
      const sectionContent = match[2].trim();
      sections[sectionName] = sectionContent;
    }
    
    // Extract summary from first paragraph if no sections found
    if (Object.keys(sections).length === 0) {
      const firstParagraph = content.split('\n\n')[0];
      if (firstParagraph) {
        sections.summary = firstParagraph;
      }
    }
    
    return sections;
  }
}

// Export singleton instance
export const reportService = new ReportService();