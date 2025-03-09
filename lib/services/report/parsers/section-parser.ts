import type { ReportSections } from '@/lib/types/report';

/**
 * Section parser utility class
 * Provides robust section extraction from formatted report content
 */
export class SectionParser {
  /**
   * Extract sections with improved robustness
   * Processes line by line rather than using regex
   *
   * @param content Markdown-formatted report content
   * @returns Structured report sections
   */
  static extractSections(content: string): ReportSections {
    const sections: ReportSections = {};
    
    // Process line by line rather than using regex
    const lines = content.split('\n');
    let currentSection: { title: string; content: string[] } | null = null;
    let index = 0;
    
    for (const line of lines) {
      // Match section headers (## Title)
      const headerMatch = line.match(/^##\s+(.+)$/);
      
      if (headerMatch) {
        // Save previous section if exists
        if (currentSection) {
          const key = this.normalizeSectionKey(currentSection.title);
          sections[key] = {
            title: currentSection.title,
            content: currentSection.content.join('\n').trim(),
            order: index++,
            editable: true,
          };
        }
        
        // Start new section
        currentSection = {
          title: headerMatch[1].trim(),
          content: []
        };
      } else if (currentSection) {
        // Add line to current section
        currentSection.content.push(line);
      }
    }
    
    // Add the final section
    if (currentSection) {
      const key = this.normalizeSectionKey(currentSection.title);
      sections[key] = {
        title: currentSection.title,
        content: currentSection.content.join('\n').trim(),
        order: index,
        editable: true,
      };
    }
    
    // Fallback if no sections found
    if (Object.keys(sections).length === 0) {
      sections.content = {
        title: 'Content',
        content: content.trim(),
        order: 0,
        editable: true,
      };
    }
    
    return sections;
  }
  
  /**
   * Normalize section key (lowercase, replace spaces with underscores)
   *
   * @param title Section title
   * @returns Normalized key for the section
   */
  private static normalizeSectionKey(title: string): string {
    return title.toLowerCase().replace(/\s+/g, '_');
  }
}