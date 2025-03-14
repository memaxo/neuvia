import type { ResearchSource } from '@/lib/types/research';

/**
 * Report formatter interface
 * Defines the contract for all report formatters
 */
export interface ReportFormatter {
  /**
   * Format report content into a standardized format
   *
   * @param content The raw content to format
   * @param contextData Optional context data for enrichment
   * @param sources Optional sources to include in the report
   * @returns Formatted report content as string
   */
  format(content: string, contextData?: Record<string, unknown>, sources?: ResearchSource[]): string;
  
  /**
   * Get section names used in this formatter
   * Helps with section identification
   *
   * @returns Array of section names
   */
  getSectionNames(): string[];
  
  /**
   * Get supported output formats
   * Helps with format selection as part of workflow state
   *
   * @returns Array of supported format names
   */
  getSupportedFormats(): string[];
  
  /**
   * Get format-specific options schema
   * Helps validate format options as part of workflow state
   *
   * @param format The format to get options for
   * @returns Record of format-specific options with default values
   */
  getFormatOptions(format: string): Record<string, unknown>;
}

/**
 * Medical diagnosis report formatter implementation
 */
export class MedicalDiagnosisFormatter implements ReportFormatter {
  format(content: string, contextData?: Record<string, unknown>, sources: ResearchSource[] = []): string {
    let report = '# Medical Diagnosis Report\n\n';
    if (contextData && typeof contextData.patient === 'object' && contextData.patient !== null) {
      const patientObj = contextData.patient as Record<string, unknown>;
      const fName = typeof patientObj.firstName === 'string' ? patientObj.firstName : '';
      const lName = typeof patientObj.lastName === 'string' ? patientObj.lastName : '';
      const dob = typeof patientObj.dateOfBirth === 'string' ? patientObj.dateOfBirth : 'Unknown';
      const mrn = typeof patientObj.mrn === 'string' ? patientObj.mrn : 'Unknown';
      report += '## Patient Information\n\n';
      report += `**Name**: ${fName} ${lName}\n`;
      report += `**DOB**: ${dob}\n`;
      report += `**MRN**: ${mrn}\n\n`;
    }

    report += '## Diagnosis\n\n';
    report += `${content}\n\n`;

    if (contextData && contextData.recommendations !== undefined) {
      report += '## Recommendations\n\n';
      // If it's an object, JSON.stringify it
      if (typeof contextData.recommendations === 'object' && contextData.recommendations !== null) {
        report += `${JSON.stringify(contextData.recommendations, null, 2)}\n\n`;
      } else {
        report += `${String(contextData.recommendations)}\n\n`;
      }
    }

    if (sources.length > 0) {
      report += '## Sources\n\n';
      sources.forEach((source, idx) => {
        report += `${idx + 1}. ${source.title ?? 'Unknown Source'}: ${source.url}\n`;
      });
    }
    return report;
  }
  
  getSectionNames(): string[] {
    return ['Patient Information', 'Diagnosis', 'Recommendations', 'Sources'];
  }
  
  getSupportedFormats(): string[] {
    return ['markdown', 'html', 'pdf', 'text'];
  }
  
  getFormatOptions(format: string): Record<string, unknown> {
    const baseOptions = {
      includeCitations: true,
      includeAppendices: false
    };
    
    switch (format) {
      case 'html':
        return {
          ...baseOptions,
          includeStyles: true,
          responsiveDesign: true,
          tableOfContents: true
        };
      case 'pdf':
        return {
          ...baseOptions,
          pageSize: 'letter',
          includeCoverPage: true,
          includeFooters: true,
          includePageNumbers: true
        };
      case 'text':
        return {
          ...baseOptions,
          plainTextWidth: 80,
          useAsciiArt: false
        };
      case 'markdown':
      default:
        return baseOptions;
    }
  }
}

/**
 * Research report formatter implementation
 */
export class ResearchFormatter implements ReportFormatter {
  format(content: string, contextData?: Record<string, unknown>, sources: ResearchSource[] = []): string {
    let report = '# Research Report\n\n';
    if (contextData && contextData.query !== undefined) {
      report += '## Research Query\n\n';
      // If it's an object, JSON.stringify
      if (typeof contextData.query === 'object' && contextData.query !== null) {
        report += `${JSON.stringify(contextData.query, null, 2)}\n\n`;
      } else {
        report += `${String(contextData.query)}\n\n`;
      }
    }

    report += '## Findings\n\n';
    report += `${content}\n\n`;

    if (contextData && contextData.keyPoints !== undefined && Array.isArray(contextData.keyPoints)) {
      report += '## Key Points\n\n';
      (contextData.keyPoints as Array<unknown>).forEach((point: unknown, i: number) => {
        report += `${i + 1}. ${String(point)}\n`;
      });
      report += '\n';
    }

    if (sources.length > 0) {
      report += '## Sources\n\n';
      sources.forEach((source, idx) => {
        report += `${idx + 1}. ${source.title ?? 'Unknown Source'}: ${source.url}\n`;
      });
    }
    return report;
  }
  
  getSectionNames(): string[] {
    return ['Research Query', 'Findings', 'Key Points', 'Sources'];
  }
  
  getSupportedFormats(): string[] {
    return ['markdown', 'html', 'pdf', 'text', 'docx', 'json'];
  }
  
  getFormatOptions(format: string): Record<string, unknown> {
    const baseOptions = {
      includeCitations: true,
      includeReferences: true
    };
    
    switch (format) {
      case 'html':
        return {
          ...baseOptions,
          includeStyles: true,
          responsiveDesign: true,
          tableOfContents: true,
          citationStyle: 'IEEE'
        };
      case 'pdf':
        return {
          ...baseOptions,
          pageSize: 'letter',
          includeCoverPage: true,
          includeFooters: true,
          includePageNumbers: true,
          citationStyle: 'IEEE'
        };
      case 'docx':
        return {
          ...baseOptions,
          styles: 'academic',
          citationStyle: 'IEEE',
          includeMetadata: true
        };
      case 'json':
        return {
          ...baseOptions,
          structuredSections: true,
          includeMetadata: true,
          formatVersion: '1.0'
        };
      case 'text':
        return {
          ...baseOptions,
          plainTextWidth: 80
        };
      case 'markdown':
      default:
        return baseOptions;
    }
  }
}

/**
 * Standard report formatter implementation
 * Used as a fallback for unknown report types
 */
export class StandardFormatter implements ReportFormatter {
  format(content: string, _contextData?: Record<string, unknown>, sources: ResearchSource[] = []): string {
    let report = '# Report\n\n';
    report += '## Content\n\n';
    report += `${content}\n\n`;

    if (sources.length > 0) {
      report += '## Sources\n\n';
      sources.forEach((source, idx) => {
        report += `${idx + 1}. ${source.title ?? 'Unknown Source'}: ${source.url}\n`;
      });
    }
    return report;
  }
  
  getSectionNames(): string[] {
    return ['Content', 'Sources'];
  }
  
  getSupportedFormats(): string[] {
    return ['markdown', 'html', 'text'];
  }
  
  getFormatOptions(format: string): Record<string, unknown> {
    const baseOptions = {
      includeSources: true
    };
    
    switch (format) {
      case 'html':
        return {
          ...baseOptions,
          includeStyles: true
        };
      case 'text':
        return {
          ...baseOptions,
          plainTextWidth: 80
        };
      case 'markdown':
      default:
        return baseOptions;
    }
  }
}

/**
 * Factory function to get the appropriate formatter based on report type
 *
 * @param type Report type
 * @returns The appropriate formatter
 */
export function getFormatterForType(type: string): ReportFormatter {
  switch (type.toLowerCase()) {
    case 'medical-diagnosis':
      return new MedicalDiagnosisFormatter();
    case 'research':
      return new ResearchFormatter();
    default:
      return new StandardFormatter();
  }
}