// lib/services/patient/formatting/patient-summary-formatting-service.ts

import logger from '@/lib/logger'
import { ValidationError } from '@/lib/errors/verification-errors'
import type { PatientSummary } from '@/lib/types/patient'
import { PatientSummaryParser, type PatientSummaryData } from './markdown-parser'

/**
 * Service for formatting patient summaries
 * 
 * This service handles conversion between different formats
 * and extracting structured data from summaries.
 */
export class PatientSummaryFormattingService {
  private readonly logger = logger.withMetadata({ module: 'PatientSummaryFormattingService' });

  /**
   * Convert a patient summary to markdown format
   * 
   * @param summary Patient summary to convert
   * @returns Markdown formatted string
   */
  generateMarkdown(summary: PatientSummary): string {
    try {
      this.logger.info('Generating markdown from patient summary');
      
      // Validate input
      if (!summary) {
        throw new ValidationError({
          message: 'Valid patient summary is required',
          code: 'INVALID_SUMMARY'
        });
      }
      
      // Extract data for markdown generation
      const structuredData = this.extractStructuredDataFromSummary(summary);
      
      // Use existing PatientSummaryParser to generate markdown
      return PatientSummaryParser.generateMarkdown(structuredData);
    } catch (error) {
      this.logger.error('Failed to generate markdown from summary', {}, error);
      
      // Re-throw if it's already a ValidationError
      if (error instanceof ValidationError) {
        throw error;
      }
      
      // Default to basic markdown generation if error occurs
      return this.fallbackMarkdownGeneration(summary);
    }
  }
  
  /**
   * Extract structured data from a markdown summary
   * 
   * @param markdown Markdown summary text
   * @returns Structured patient data
   */
  extractStructuredData(markdown: string): PatientSummaryData {
    try {
      this.logger.info('Extracting structured data from markdown');
      
      // Validate input
      if (!markdown || markdown.trim() === '') {
        throw new ValidationError({
          message: 'Valid markdown content is required',
          code: 'INVALID_MARKDOWN'
        });
      }
      
      // Use existing PatientSummaryParser to extract data
      return PatientSummaryParser.extractStructuredData(markdown);
    } catch (error) {
      this.logger.error('Failed to extract structured data from markdown', {}, error);
      
      // Re-throw if it's already a ValidationError
      if (error instanceof ValidationError) {
        throw error;
      }
      
      // Return empty structure if error occurs
      return {
        demographics: {
          name: 'Unknown',
          dateOfBirth: undefined,
          gender: undefined,
          mrn: undefined
        },
        medicalHistory: [],
        allergies: [],
        medications: [],
        vitalSigns: [],
        assessment: '',
        plan: '',
        conditions: [],
        procedures: [],
        labResults: [],
        imagingResults: [],
        recommendations: []
      };
    }
  }
  
  /**
   * Generate HTML from a patient summary
   * 
   * @param summary Patient summary to convert
   * @returns HTML formatted string
   */
  generateHtml(summary: PatientSummary): string {
    try {
      this.logger.info('Generating HTML from patient summary');
      
      // Generate markdown first
      const markdown = this.generateMarkdown(summary);
      
      // Convert markdown to HTML
      const html = this.convertMarkdownToHtml(markdown);
      
      return html;
    } catch (error) {
      this.logger.error('Failed to generate HTML from summary', {}, error);
      
      // Generate basic HTML if error occurs
      return `<html><body><h1>Patient Summary</h1><p>Error generating formatted summary.</p></body></html>`;
    }
  }
  
  /**
   * Convert markdown to HTML
   * 
   * @param markdown Markdown content
   * @returns HTML content
   */
  private convertMarkdownToHtml(markdown: string): string {
    try {
      // Create HTML document
      let html = '<!DOCTYPE html>\n<html>\n<head>\n';
      html += '<meta charset="UTF-8">\n';
      html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
      html += '<title>Patient Summary</title>\n';
      html += '<style>\n';
      html += 'body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }\n';
      html += 'h1, h2, h3 { color: #2c3e50; }\n';
      html += 'h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }\n';
      html += 'h2 { border-bottom: 1px solid #eee; padding-bottom: 5px; }\n';
      html += 'ul { padding-left: 20px; }\n';
      html += '.updated { background-color: #e8f4f8; padding: 2px; }\n';
      html += '</style>\n';
      html += '</head>\n<body>\n';
      
      // Convert markdown to HTML
      const htmlContent = markdown
        .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
        .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
        .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\*\*\[Updated\]\*\*/g, '<span class="updated">[Updated]</span>');
      
      // Handle lists - this is a simplistic approach
      const listItems = htmlContent.split('\n').map(line => {
        if (line.trim().startsWith('- ')) {
          return `<li>${line.trim().substring(2)}</li>`;
        }
        return line;
      });
      
      // Join lines, wrap list items
      let processedContent = '';
      let inList = false;
      
      for (const line of listItems) {
        if (line.startsWith('<li>')) {
          if (!inList) {
            processedContent += '<ul>\n';
            inList = true;
          }
          processedContent += line + '\n';
        } else {
          if (inList) {
            processedContent += '</ul>\n';
            inList = false;
          }
          processedContent += line + '\n';
        }
      }
      
      if (inList) {
        processedContent += '</ul>\n';
      }
      
      html += `<p>${processedContent}</p>\n`;
      html += '</body>\n</html>';
      
      return html;
    } catch (error) {
      this.logger.error('Error converting markdown to HTML', {}, error);
      return `<html><body><pre>${markdown}</pre></body></html>`;
    }
  }
  
  /**
   * Fallback markdown generation when normal generation fails
   * 
   * @param summary Patient summary
   * @returns Basic markdown representation
   */
  private fallbackMarkdownGeneration(summary: PatientSummary): string {
    try {
      let markdown = '# Patient Summary\n\n';
      
      // Add each section
      if (summary.patientInfo) {
        markdown += `## ${summary.patientInfo.title}\n\n${summary.patientInfo.content}\n\n`;
      }
      
      if (summary.medicalHistory) {
        markdown += `## ${summary.medicalHistory.title}\n\n${summary.medicalHistory.content}\n\n`;
      }
      
      if (summary.currentConditions) {
        markdown += `## ${summary.currentConditions.title}\n\n${summary.currentConditions.content}\n\n`;
      }
      
      if (summary.medications) {
        markdown += `## ${summary.medications.title}\n\n${summary.medications.content}\n\n`;
      }
      
      if (summary.recentFindings) {
        markdown += `## ${summary.recentFindings.title}\n\n${summary.recentFindings.content}\n\n`;
      }
      
      if (summary.treatmentPlans) {
        markdown += `## ${summary.treatmentPlans.title}\n\n${summary.treatmentPlans.content}\n\n`;
      }
      
      if (summary.labResults) {
        markdown += `## ${summary.labResults.title}\n\n${summary.labResults.content}\n\n`;
      }
      
      if (summary.imagingResults) {
        markdown += `## ${summary.imagingResults.title}\n\n${summary.imagingResults.content}\n\n`;
      }
      
      if (summary.recommendations) {
        markdown += `## ${summary.recommendations.title}\n\n${summary.recommendations.content}\n\n`;
      }
      
      return markdown;
    } catch (error) {
      this.logger.error('Fatal error in fallback markdown generation', {}, error);
      return '# Patient Summary\n\nError generating patient summary content.';
    }
  }
  
  /**
   * Extract structured data from a patient summary
   * 
   * @param summary Patient summary
   * @returns Structured patient data
   */
  private extractStructuredDataFromSummary(summary: PatientSummary): PatientSummaryData {
    const structuredData: PatientSummaryData = {
      demographics: {},
      medicalHistory: [],
      allergies: [],
      medications: [],
      vitalSigns: [],
      assessment: '',
      plan: '',
      conditions: [],
      procedures: [],
      labResults: [],
      imagingResults: [],
      recommendations: []
    };
    
    // Extract demographics from patient info section
    if (summary.patientInfo?.content) {
      const lines = summary.patientInfo.content.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines
        if (!trimmedLine) continue;
        
        // Look for patterns like "Name: John Doe"
        const match = trimmedLine.match(/^(?:[-*•])?\s*(?:Patient\s+)?(\w+):\s*(.+)$/i);
        if (match) {
          const field = match[1].toLowerCase();
          const value = match[2].trim();
          
          if (field === 'name' || field === 'patient' || field === 'patient name') {
            structuredData.demographics.name = value;
          } else if (field === 'dob' || field === 'date of birth') {
            structuredData.demographics.dateOfBirth = value;
          } else if (field === 'gender' || field === 'sex') {
            structuredData.demographics.gender = value;
          } else if (field === 'mrn' || field === 'medical record number') {
            structuredData.demographics.mrn = value;
          }
        }
      }
    }
    
    // Extract medical history
    if (summary.medicalHistory?.content) {
      const lines = summary.medicalHistory.content.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
          structuredData.medicalHistory.push(trimmedLine.substring(1).trim());
        } else if (trimmedLine && !trimmedLine.match(/^no\s+information\s+available/i)) {
          // Add non-empty lines that don't match "No information available"
          structuredData.medicalHistory.push(trimmedLine);
        }
      }
    }
    
    // Extract current conditions
    if (summary.currentConditions?.content) {
      const lines = summary.currentConditions.content.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
          structuredData.conditions.push(trimmedLine.substring(1).trim());
        } else if (trimmedLine && !trimmedLine.match(/^no\s+information\s+available/i)) {
          structuredData.conditions.push(trimmedLine);
        }
      }
    }
    
    // Extract medications
    if (summary.medications?.content) {
      const lines = summary.medications.content.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
          const medicationText = trimmedLine.substring(1).trim();
          
          // Try to parse dose and frequency
          const parts = medicationText.split(/,\s*/);
          if (parts.length > 0) {
            const medicationName = parts[0].trim();
            let dosage = '';
            let frequency = '';
            
            // Check remaining parts for dosage and frequency
            for (let i = 1; i < parts.length; i++) {
              const part = parts[i].trim();
              if (part.match(/\d+\s*(?:mg|mcg|g|ml|units)/i)) {
                dosage = part;
              } else if (part.match(/daily|bid|tid|qid|weekly|monthly|every|once|twice/i)) {
                frequency = part;
              }
            }
            
            structuredData.medications.push({
              name: medicationName,
              dosage,
              frequency
            });
          } else {
            structuredData.medications.push({
              name: medicationText
            });
          }
        }
      }
    }
    
    // Extract allergies
    // This would typically come from a dedicated allergies section, but we'll look in medical history
    if (summary.medicalHistory?.content) {
      const allergyLines = summary.medicalHistory.content.match(/allergies?:?\s*(.*?)(?:\n|$)/i);
      if (allergyLines) {
        const allergyText = allergyLines[1].trim();
        if (allergyText) {
          // Split on commas or bullet points
          const allergies = allergyText.split(/[,•]/).map(a => a.trim()).filter(Boolean);
          structuredData.allergies = allergies;
        }
      }
    }
    
    // Extract assessment
    if (summary.recentFindings?.content) {
      structuredData.assessment = summary.recentFindings.content;
    }
    
    // Extract plan
    if (summary.treatmentPlans?.content) {
      structuredData.plan = summary.treatmentPlans.content;
    }
    
    // Extract lab results
    if (summary.labResults?.content) {
      const lines = summary.labResults.content.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
          const labText = trimmedLine.substring(1).trim();
          
          // Try to parse test name and result
          const labMatch = labText.match(/^(.*?):\s*(.*)$/);
          if (labMatch) {
            structuredData.labResults.push({
              test: labMatch[1].trim(),
              result: labMatch[2].trim()
            });
          } else {
            structuredData.labResults.push({
              test: 'Lab result',
              result: labText
            });
          }
        }
      }
    }
    
    // Extract imaging results
    if (summary.imagingResults?.content) {
      const lines = summary.imagingResults.content.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
          structuredData.imagingResults.push(trimmedLine.substring(1).trim());
        } else if (trimmedLine && !trimmedLine.match(/^no\s+information\s+available/i)) {
          structuredData.imagingResults.push(trimmedLine);
        }
      }
    }
    
    // Extract recommendations
    if (summary.recommendations?.content) {
      const lines = summary.recommendations.content.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
          structuredData.recommendations.push(trimmedLine.substring(1).trim());
        } else if (trimmedLine && !trimmedLine.match(/^no\s+information\s+available/i)) {
          structuredData.recommendations.push(trimmedLine);
        }
      }
    }
    
    return structuredData;
  }
}

// Create singleton instance
export const patientSummaryFormattingService = new PatientSummaryFormattingService();