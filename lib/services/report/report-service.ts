/**
 * Unified Report Service
 * 
 * Single entry point for report generation across the application
 */
import { createBrowserClient } from '@/lib/supabase/clients';
import { workflowManager } from '@/lib/utils/workflow-manager';
import { createWorkflowCallbacks, runWithWorkflow } from "@/lib/utils/langchain";
import { langChainCore } from '@/lib/langchain/core'; 
import type { WorkflowStep } from '@/lib/processing/types/workflow';
import type { 
  ReportData, 
  ReportFormat, 
  ReportGenerationParams
} from '@/lib/processing/types/report';
import type { ResearchResult } from '@/lib/processing/types/research';
import type { WorkflowOptions } from '@/lib/utils/workflow-manager';

/**
 * Report options with additional fields for Langchain integration
 */
export interface ExtendedReportOptions extends WorkflowOptions {
  /**
   * Report type
   */
  type?: string;
  
  /**
   * Context data
   */
  contextData?: Record<string, any>;
  
  /**
   * Whether to save the report to the database
   */
  saveToDatabase?: boolean;
  
  /**
   * Progress callback with phase information
   */
  onProgress?: (phase: string, progress: number) => void;
}

/**
 * Report generation service
 */
export class ReportService {
  private supabase = createBrowserClient();
  
  /**
   * Generate a report based on provided parameters
   * Uses workflow manager for state management.
   * 
   * @param params Report generation parameters
   * @param options Report options including callbacks
   * @returns Generated report data
   */
  async generateReport(
    params: ReportGenerationParams,
    options?: ExtendedReportOptions
  ): Promise<ReportData> {
    return workflowManager.handleWorkflowOperation<ReportData>(
      null, // No workflow ID for this operation
      'report_generation' as WorkflowStep,
      async () => {
        // Track start time for performance measurement
        const startTime = Date.now();
        
        // Initial progress update
        if (options?.onProgress) {
          options.onProgress('initialization', 0);
        }
        
        // IMPORTANT: This service now expects research data to be provided
        // and does not perform research itself
        if (!params.researchData) {
          throw new Error('Research data must be provided to generate a report');
        }
        
        if (options?.onProgress) {
          options.onProgress('generation', 30);
        }
        
        // Format report based on type and provided research data
        const reportContent = await this.formatReport(
          params.type,
          params.researchData.text || '',
          params.contextData,
          params.researchData.sources || []
        );
        
        if (options?.onProgress) {
          options.onProgress('generation', 75);
        }
        
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
            contextData: params.contextData
          },
          sections: this.extractSections(reportContent)
        };
        
        if (options?.onProgress) {
          options.onProgress('generation', 90);
        }
        
        // Save the report to the database if requested
        if (params.saveToDatabase) {
          await this.saveReport(reportData);
        }
        
        if (options?.onProgress) {
          options.onProgress('complete', 100);
        }
        
        return reportData;
      },
      // Pass a compatible workflow options object
      {
        onSuccess: options?.onSuccess as any,
        onError: options?.onError as any
      }
    );
  }
  
  /**
   * Generate a medical diagnosis report from existing research data
   * Uses workflow manager for state management.
   * 
   * @param researchData Research data from previous API call
   * @param patientId Patient ID
   * @param options Report options
   * @returns Generated report data
   */
  async generateMedicalDiagnosisReport(
    researchData: ResearchResult,
    patientId: string,
    options?: ExtendedReportOptions
  ): Promise<ReportData> {
    return this.generateReport(
      {
        type: 'medical-diagnosis',
        patientId,
        researchData,
        contextData: {
          patientData: researchData.patientData
        },
        saveToDatabase: options?.saveToDatabase !== false
      },
      options
    );
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
    if (!content.includes('## Findings') && !content.includes('## Assessment')) {
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
   * Save a report to the database
   * 
   * @param report Report data to save
   * @returns Saved report ID
   */
  private async saveReport(report: ReportData): Promise<string> {
    try {
      // Get the current user ID from Supabase
      const { data: { user } } = await this.supabase.auth.getUser();
      const userId = user?.id;
      
      if (!userId) {
        throw new Error('User must be authenticated to save reports');
      }
      
      // Prepare a valid report record that matches the database schema
      const reportRecord = {
        patient_id: report.patientId,
        title: report.metadata.title || `${report.metadata.reportType || 'diagnostic'} Report`,
        type: report.metadata.reportType === 'medical-diagnosis' ? 'diagnostic' : 
              report.metadata.reportType === 'research' ? 'analytics' : 'diagnostic',
        status: 'completed',
        department_id: report.metadata.departmentId || '00000000-0000-0000-0000-000000000000', // Default placeholder
        created_by: userId,
        updated_by: userId,
        
        // Convert content from markdown to JSON if needed
        content: typeof report.content === 'string' 
          ? JSON.stringify({ markdown: report.content }) 
          : report.content,
        
        // Required metadata with strict structure
        metadata: {
          patientInfo: {
            symptoms: [],
            medicalHistory: [],
            currentMedications: [],
            allergies: [],
            vitalSigns: {}
          }
        },
        
        // Optional fields that might come from research
        summary: report.sections?.summary || '',
        findings: report.sections?.findings 
          ? JSON.parse(`[{"description": "${report.sections.findings}", "category": "general", "severity": "medium"}]`) 
          : null,
        recommendations: report.sections?.recommendations 
          ? JSON.parse(`[{"recommendation": "${report.sections.recommendations}", "priority": "medium"}]`)
          : null,
        
        // Quality metrics
        confidence_score: report.metadata.confidence || 0.8,
        
        // Supporting documentation
        source_documents: report.sources && report.sources.length > 0 
          ? report.sources.map(s => ({
              title: s.title || 'Unnamed Source',
              url: s.url,
              description: s.description || '',
            }))
          : null
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
      throw new Error(`Failed to save report: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Extract sections from report content
   * 
   * @param content Report content
   * @returns Extracted sections
   */
  private extractSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    
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
  
  /**
   * Generate report using Langchain for improved structure and insights
   */
  async generateReportWithLangchain(
    researchData: ResearchResult,
    patientId: string,
    options?: ExtendedReportOptions
  ): Promise<ReportData> {
    return runWithWorkflow(
      'report_generation' as WorkflowStep,
      async () => {
        // Track start time for performance measurement
        const startTime = Date.now();
        
        // Create model with callbacks
        const llm = langChainCore.createChatOpenAI({
          temperature: 0.4,
          callbacks: createWorkflowCallbacks(
            null,
            'report_generation',
            { onProgress: (progress: number) => {
              options?.onProgress?.('generation', progress);
            }}
          )
        });
        
        // First, generate analysis from research data
        const analysisPrompt = await langChainCore.createPromptTemplate(
          `Analyze the following research data and extract key insights:\n\n{researchText}\n\n` +
          `Provide a structured analysis with sections for findings, diagnoses, and recommendations.`,
          ['researchText']
        );
        
        const analysisPromptFormatted = await analysisPrompt.format({
          researchText: researchData.text
        });
        
        const analysisResponse = await llm.invoke(analysisPromptFormatted);
        const analysis = String(analysisResponse.content);
        
        // Then, format the analysis into a report
        const formatPrompt = await langChainCore.createPromptTemplate(
          `Format the following analysis into a professional medical report:\n\n{analysis}\n\n` +
          `Include the following sections:\n- Summary\n- Findings\n- Diagnoses\n- Recommendations\n- References`,
          ['analysis']
        );
        
        const formatPromptFormatted = await formatPrompt.format({
          analysis
        });
        
        const formatResponse = await llm.invoke(formatPromptFormatted);
        const formattedReport = String(formatResponse.content);
        
        // Extract sections from the formatted report
        const sections = this.extractSections(formattedReport);
        
        // Create the report data object
        const reportData: ReportData = {
          content: formattedReport,
          sources: researchData.sources || [],
          patientId,
          generatedAt: new Date(),
          metadata: {
            modelName: 'o3-mini',
            confidence: 0.85,
            generationTime: Date.now() - startTime,
            reportType: options?.type || 'medical-diagnosis',
            contextData: options?.contextData
          },
          sections
        };
        
        // Save the report if requested
        if (options?.saveToDatabase !== false) {
          await this.saveReport(reportData);
        }
        
        return reportData;
      },
      {
        onProgress: (progress: number) => {
          options?.onProgress?.('generation', progress);
        },
        onError: options?.onError
      }
    );
  }
}

// Export singleton instance
export const reportService = new ReportService(); 