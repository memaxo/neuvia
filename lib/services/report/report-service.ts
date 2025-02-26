/**
 * Unified Report Service
 * 
 * Single entry point for report generation across the application
 */
import { createBrowserClient } from '@/lib/supabase/clients';
import type { 
  ReportData, 
  ReportFormat, 
  ReportGenerationParams, 
  ReportOptions, 
  ResearchResult 
} from '@/lib/processing/types';
import { perplexityService } from '@/lib/services/perplexity/perplexity-service';

/**
 * Report generation service
 */
export class ReportService {
  private supabase = createBrowserClient();
  
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
      
      // 1. First perform research if needed and not already provided
      let researchData: ResearchResult | null = null;
      
      if (params.researchQuery && !params.researchData) {
        options?.onProgress?.('research', 10);
        
        // Perform the research
        researchData = await perplexityService.performDeepResearch(
          params.researchQuery,
          {
            depth: params.researchDepth || 'standard',
            sourcesLimit: params.sourcesLimit || 5,
            includeSourceContent: params.includeSourceContent !== false,
            researchType: params.type === 'medical-diagnosis' ? 'medical-diagnosis' : 'standard',
            contextData: params.contextData,
            onProgress: (progress) => {
              options?.onProgress?.('research', progress);
            },
            isMedicalDiagnosis: params.type === 'medical-diagnosis',
            patientData: params.contextData?.patientData,
          }
        );
      } else if (params.researchData) {
        // Use provided research data
        researchData = params.researchData;
        options?.onProgress?.('research', 100);
      }
      
      options?.onProgress?.('generation', 50);
      
      // 2. Format report based on type and provided/researched data
      const reportContent = await this.formatReport(
        params.type,
        researchData?.summary || researchData?.text || '',
        params.contextData,
        researchData?.sources || []
      );
      
      options?.onProgress?.('generation', 75);
      
      // 3. Create the report data object
      const reportData: ReportData = {
        content: reportContent,
        sources: researchData?.sources || [],
        patientId: params.patientId,
        generatedAt: new Date(),
        metadata: {
          modelName: 'sonar-deep-research',
          confidence: researchData?.confidence || 0.8,
          generationTime: Date.now() - startTime,
          reportType: params.type,
          contextData: params.contextData
        },
        sections: this.extractSections(reportContent)
      };
      
      options?.onProgress?.('generation', 90);
      
      // 4. Save the report to the database if requested
      if (params.saveToDatabase) {
        await this.saveReport(reportData);
      }
      
      options?.onProgress?.('complete', 100);
      
      return reportData;
    } catch (error) {
      console.error('[ReportService] Error generating report:', error);
      throw new Error(`Report generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Generate a medical diagnosis report directly without research
   * 
   * @param patientData Patient data extracted from document
   * @param userQuery User query about the patient data
   * @param options Report options
   * @returns Generated report data
   */
  async generateMedicalDiagnosisReport(
    patientData: string,
    userQuery: string,
    options?: ReportOptions
  ): Promise<ReportData> {
    return this.generateReport(
      {
        type: 'medical-diagnosis',
        patientId: options?.patientId || '',
        researchQuery: userQuery,
        contextData: {
          patientData
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
    const { data, error } = await this.supabase.from('reports').insert({
      patient_id: report.patientId,
      content: report.content,
      type: report.metadata.reportType || 'standard',
      status: 'completed',
      metadata: {
        sources: report.sources,
        generatedAt: report.generatedAt,
        modelName: report.metadata.modelName,
        confidence: report.metadata.confidence,
        generationTime: report.metadata.generationTime,
        contextData: report.metadata.contextData
      }
    }).select('id').single();
    
    if (error) {
      throw new Error(`Failed to save report: ${error.message}`);
    }
    
    return data.id;
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
}

// Export singleton instance
export const reportService = new ReportService(); 