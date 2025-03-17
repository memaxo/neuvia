/**
 * @fileoverview Report Formatting Service
 * 
 * Focuses exclusively on report formatting logic without workflow orchestration.
 * Responsible for converting report data into various output formats.
 */

import { ApplicationError } from '@/lib/errors'
import logger from '@/lib/logger'
import type { ReportData } from '@/lib/types/report'
import { getFormatterForType } from './formatters/report-formatter'

// Custom error type for report formatting
export class ReportFormattingError extends ApplicationError {
  constructor(message: string, cause?: unknown) {
    super({
      message,
      code: 'REPORT_FORMATTING_ERROR',
      cause
    })
  }
}

// Create module-specific logger
const moduleLogger = logger.withMetadata({ module: 'ReportFormattingService' })

/**
 * Report Formatting Service
 * 
 * Responsible for converting report data to various output formats
 * without handling workflow orchestration or persistence.
 */
export class ReportFormattingService {
  /**
   * Format report output in the specified format
   *
   * @param reportData Report data
   * @param format Output format
   * @param formatOptions Optional format-specific options
   * @returns Formatted report content
   */
  async formatOutput(
    reportData: ReportData,
    format: string = 'markdown',
    formatOptions: Record<string, unknown> = {}
  ): Promise<string> {
    moduleLogger.info('Formatting report output', {
      format,
      formatOptions
    });

    try {
      // Gather the sections sorted by order
      const sectionsObj = reportData.report.sections
      const sortedEntries = Object.entries(sectionsObj).sort(([, a], [, b]) => a.order - b.order)

      // Check if we have a supported formatter for this format
      const formatter = getFormatterForType(reportData.report.reportType.toString());
      const supportedFormats = formatter.getSupportedFormats();
      
      if (!supportedFormats.includes(format)) {
        moduleLogger.warn(`Format ${format} not directly supported, falling back to best match`, {
          requestedFormat: format,
          supportedFormats
        });
      }

      // Get format-specific options with defaults
      const mergedOptions = {
        ...formatter.getFormatOptions(format),
        ...formatOptions
      };

      // Process based on format
      if (format === 'markdown' || format === 'md') {
        let mdContent = `# ${reportData.report.title}\n\n`
        
        for (const [, section] of sortedEntries) {
          mdContent += `## ${section.title}\n\n${section.content}\n\n`
        }
        
        // Include sources if specified in options
        if (reportData.sourceDocuments?.length &&
            (mergedOptions.includeSources === undefined || mergedOptions.includeSources === true)) {
          mdContent += '## Sources\n\n'
          reportData.sourceDocuments.forEach((src, i) => {
            mdContent += `${i + 1}. ${src.title ?? 'Unknown Source'}: ${src.citation ?? ''}\n`
          })
        }
        
        // Include footer
        mdContent += '\n\n---\n\n'
        mdContent += `Generated at: ${new Date(reportData.report.metadata.generatedAt).toLocaleString()}\n`
        mdContent += `Report ID: ${reportData.report.id}\n`
        
        return mdContent;
      }

      if (format === 'html') {
        // Get markdown first, then convert to HTML
        const markdownVersion = await this.formatOutput(
          reportData,
          'markdown',
          {
            ...mergedOptions
          }
        );
        
        // Convert to HTML with format options
        const html = await this.convertMarkdownToHtml(
          markdownVersion,
          mergedOptions as {
            includeStyles?: boolean;
            responsiveDesign?: boolean;
            tableOfContents?: boolean;
          }
        );
        
        return html;
      }

      if (format === 'text' || format === 'txt') {
        const plainTextWidth = typeof mergedOptions.plainTextWidth === 'number'
          ? mergedOptions.plainTextWidth
          : 80;
          
        let textContent = `${reportData.report.title}\n\n`;
        
        for (const [, section] of sortedEntries) {
          textContent += `${section.title.toUpperCase()}\n${'='.repeat(Math.min(section.title.length, plainTextWidth))}\n\n${section.content}\n\n`
        }
        
        // Include sources if specified in options
        if (reportData.sourceDocuments?.length &&
            (mergedOptions.includeSources === undefined || mergedOptions.includeSources === true)) {
          textContent += 'SOURCES\n=======\n\n'
          reportData.sourceDocuments.forEach((src, i) => {
            textContent += `${i + 1}. ${src.title ?? 'Unknown Source'}: ${src.citation ?? ''}\n`
          })
        }
        
        // Include footer
        textContent += '\n\n' + '-'.repeat(Math.min(plainTextWidth, 80)) + '\n\n'
        textContent += `Generated at: ${new Date(reportData.report.metadata.generatedAt).toLocaleString()}\n`
        textContent += `Report ID: ${reportData.report.id}\n`
        
        return textContent;
      }

      // Support for PDF generation (placeholder)
      if (format === 'pdf') {
        // In a real implementation this would use a PDF generation library
        // Here we'll create a placeholder with a message
        const htmlVersion = await this.formatOutput(
          reportData,
          'html',
          mergedOptions
        );
        
        // Simulate PDF conversion
        const pdfPlaceholder = `PDF_CONTENT
    ===== PDF CONVERSION PLACEHOLDER =====
    Report: ${reportData.report.title}
    Generated: ${new Date().toISOString()}
    Options: ${JSON.stringify(mergedOptions)}
    Content Length: ${htmlVersion.length} bytes
    ===================================
    `;
        
        return pdfPlaceholder;
      }

      // Support for DOCX generation (placeholder)
      if (format === 'docx') {
        // In a real implementation this would use a DOCX generation library
        // Here we'll create a placeholder with a message
        const markdownVersion = await this.formatOutput(
          reportData,
          'markdown',
          mergedOptions
        );
        
        // Simulate DOCX conversion
        const docxPlaceholder = `DOCX_CONTENT
    ===== DOCX CONVERSION PLACEHOLDER =====
    Report: ${reportData.report.title}
    Generated: ${new Date().toISOString()}
    Options: ${JSON.stringify(mergedOptions)}
    Content Length: ${markdownVersion.length} bytes
    ===================================
    `;
        
        return docxPlaceholder;
      }

      // Support for JSON format
      if (format === 'json') {
        const jsonOutput = {
          title: reportData.report.title,
          id: reportData.report.id,
          timestamp: reportData.report.metadata.generatedAt,
          patient: reportData.patient,
          sections: Object.entries(reportData.report.sections).map(([key, section]) => ({
            id: key,
            title: section.title,
            content: section.content,
            order: section.order
          })),
          sources: reportData.sourceDocuments,
          metadata: {
            ...reportData.report.metadata,
            formatOptions: mergedOptions
          }
        };
        
        return JSON.stringify(jsonOutput, null, 2);
      }

      throw new ReportFormattingError(`Unsupported report format: ${format}`, {
        requestedFormat: format,
        supportedFormats
      })
    } catch (error: unknown) {
      moduleLogger.error('Format conversion failed', {
        error,
        format,
        reportId: reportData.report.id
      });

      // If it's already our custom error, just rethrow
      if (error instanceof ReportFormattingError) {
        throw error;
      }

      throw new ReportFormattingError(`Failed to format report as ${format}`, error);
    }
  }

  /**
   * Convert markdown content to HTML with formatting options
   *
   * @param markdown Markdown content to convert
   * @param options Formatting options
   * @returns HTML content
   */
  private async convertMarkdownToHtml(
    markdown: string,
    options: {
      includeStyles?: boolean;
      responsiveDesign?: boolean;
      tableOfContents?: boolean;
    } = {}
  ): Promise<string> {
    try {
      // Default options
      const {
        includeStyles = true,
        responsiveDesign = true,
        tableOfContents = false
      } = options;
      
      // Start building HTML
      let html = '<!DOCTYPE html>\n<html>\n<head>\n';
      html += '<meta charset="UTF-8">\n';
      html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
      html += '<title>Medical Report</title>\n';
      
      // Add styles if enabled
      if (includeStyles) {
        html += '<style>\n';
        
        // Base styles
        html += 'body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }\n';
        html += 'h1, h2, h3 { color: #2c3e50; }\n';
        html += 'h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }\n';
        html += 'h2 { border-bottom: 1px solid #eee; padding-bottom: 5px; }\n';
        html += 'pre { background-color: #f8f8f8; padding: 10px; border-radius: 5px; overflow-x: auto; }\n';
        html += 'blockquote { border-left: 4px solid #ccc; padding-left: 15px; color: #777; }\n';
        html += 'table { border-collapse: collapse; width: 100%; }\n';
        html += 'th, td { padding: 8px; border: 1px solid #ddd; }\n';
        html += 'th { background-color: #f2f2f2; }\n';
        html += 'tr:nth-child(even) { background-color: #f9f9f9; }\n';
        
        // Responsive design if enabled
        if (responsiveDesign) {
          html += '@media (min-width: 768px) { body { max-width: 800px; margin: 0 auto; padding: 20px; } }\n';
          html += '@media (max-width: 767px) { body { padding: 15px; } table { display: block; overflow-x: auto; } }\n';
        } else {
          // Fixed layout
          html += 'body { max-width: 800px; margin: 0 auto; padding: 20px; }\n';
        }
        
        // Table of contents styles if enabled
        if (tableOfContents) {
          html += '.toc { background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin-bottom: 20px; }\n';
          html += '.toc ul { padding-left: 20px; }\n';
          html += '.toc a { text-decoration: none; color: #2c3e50; }\n';
          html += '.toc a:hover { text-decoration: underline; }\n';
        }
        
        html += '</style>\n';
      }
      
      html += '</head>\n<body>\n';
      
      // Generate table of contents if enabled
      if (tableOfContents) {
        html += '<div class="toc">\n';
        html += '<h2>Table of Contents</h2>\n';
        html += '<ul>\n';
        
        // Extract headings
        const headings = markdown.match(/^#{1,3} (.+)$/gm) || [];
        headings.forEach((heading, index) => {
          const level = (heading.match(/^#+/) || [''])[0].length;
          const text = heading.replace(/^#+\s+/, '');
          const anchor = `section-${index}`;
          
          const indent = '  '.repeat(level - 1);
          html += `${indent}<li><a href="#${anchor}">${text}</a></li>\n`;
        });
        
        html += '</ul>\n';
        html += '</div>\n';
        
        // Add anchors to headings in content
        let headingIndex = 0;
        markdown = markdown.replace(/^(#{1,3} .+)$/gm, (match) => {
          const anchor = `section-${headingIndex++}`;
          return `<a id="${anchor}"></a>\n${match}`;
        });
      }
      
      // Convert markdown to HTML
      const content = markdown
        .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
        .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
        .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^- (.*?)$/gm, '<li>$1</li>')
        .replace(/^(\d+)\. (.*?)$/gm, '<li>$2</li>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
        .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">')
        .replace(/\n\n/g, '</p><p>');
      
      html += `<p>${content}</p>\n`;
      html += '</body>\n</html>';
      
      return html;
    } catch (error: unknown) {
      moduleLogger.error('Failed to convert markdown to HTML', { error });
      throw new ReportFormattingError('Failed to convert markdown to HTML', error);
    }
  }
}

// Create a singleton instance
export const reportFormattingService = new ReportFormattingService()