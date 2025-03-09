/**
 * Section Detection Utility
 *
 * Centralizes logic for detecting and working with document sections
 */

/**
 * Utility class for detecting sections in document text
 */
export class SectionDetector {
  /**
   * Medical document section patterns
   */
  private static readonly medicalSectionPatterns = [
    {
      name: 'patient_information',
      patterns: ['patient information', 'demographics', 'patient data'],
    },
    {
      name: 'chief_complaint',
      patterns: ['chief complaint', 'presenting complaint', 'reason for visit'],
    },
    {
      name: 'history_of_present_illness',
      patterns: ['history of present illness', 'hpi', 'present illness'],
    },
    {
      name: 'past_medical_history',
      patterns: ['past medical history', 'pmh', 'medical history'],
    },
    {
      name: 'medications',
      patterns: ['medications', 'current medications', 'meds', 'prescription'],
    },
    {
      name: 'allergies',
      patterns: ['allergies', 'drug allergies', 'medication allergies'],
    },
    {
      name: 'review_of_systems',
      patterns: ['review of systems', 'ros', 'systems review'],
    },
    {
      name: 'physical_examination',
      patterns: [
        'physical examination',
        'physical exam',
        'examination',
        'exam',
      ],
    },
    { name: 'assessment', patterns: ['assessment', 'impression', 'diagnosis'] },
    { name: 'plan', patterns: ['plan', 'treatment plan', 'recommendations'] },
    {
      name: 'laboratory_results',
      patterns: ['laboratory', 'lab results', 'laboratory studies'],
    },
    {
      name: 'imaging_results',
      patterns: ['imaging', 'radiology', 'x-ray', 'ct scan', 'mri'],
    },
    {
      name: 'procedures',
      patterns: ['procedures', 'interventions', 'operations'],
    },
  ];

  /**
   * Detect sections in a document
   *
   * @param text Document text
   * @returns Array of section names found in the text
   */
  static detectSections(text: string): string[] {
    const detectedSections: string[] = [];

    // Look for common medical document section headers
    for (const section of this.medicalSectionPatterns) {
      for (const pattern of section.patterns) {
        // Look for the pattern surrounded by whitespace or at the beginning of a line
        const regex = new RegExp(`(^|\\s)(${pattern})(:|\\s|$)`, 'i');
        if (regex.test(text)) {
          detectedSections.push(section.name);
          break; // Found this section, no need to check other patterns
        }
      }
    }

    return detectedSections;
  }

  /**
   * Split text into sections
   *
   * @param text Document text
   * @returns Array of sections with content
   */
  static splitTextBySections(
    text: string
  ): Array<{ section: string; content: string }> {
    const sections: Array<{ section: string; content: string }> = [];
    let currentContent = '';
    let currentSection = 'unknown';

    // Split text into lines for processing
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line is a section header
      let newSectionFound = false;

      for (const section of this.medicalSectionPatterns) {
        for (const pattern of section.patterns) {
          // Look for the pattern surrounded by whitespace or at the beginning of a line
          const regex = new RegExp(`(^|\\s)(${pattern})(:|\\s|$)`, 'i');
          if (regex.test(line)) {
            // If we were already building a section, save it
            if (currentContent.trim()) {
              sections.push({
                section: currentSection,
                content: currentContent.trim(),
              });
            }

            // Start a new section
            currentSection = section.name;
            currentContent = `${line}\n`; // Include the header in the content
            newSectionFound = true;
            break;
          }
        }
        if (newSectionFound) break;
      }

      // If not a new section, add to current content
      if (!newSectionFound) {
        currentContent += `${line}\n`;
      }
    }

    // Add the last section if not empty
    if (currentContent.trim()) {
      sections.push({
        section: currentSection,
        content: currentContent.trim(),
      });
    }

    return sections;
  }

  /**
   * Detect section type from paragraph text
   *
   * @param text Paragraph or section text to analyze
   * @returns Identified section type or null
   */
  static detectSectionType(text: string): string | null {
    if (!text || text.trim().length === 0) {
      return null;
    }
    
    // Common section markers in medical documents
    const sectionPatterns = [
      { type: 'header', pattern: /^#+ |^TITLE:|^title:/i },
      { type: 'patient_info', pattern: /^(?:patient|personal|demographic|identification) (?:information|data|details)/i },
      { type: 'medical_history', pattern: /^(?:medical|clinical|health) (?:history|record)/i },
      { type: 'medications', pattern: /^(?:current )?(?:medication|drug|prescription)s?/i },
      { type: 'allergies', pattern: /^(?:drug |known |medication )?allerg(?:y|ies)/i },
      { type: 'vital_signs', pattern: /^(?:vital|physical) (?:signs|measurements)/i },
      { type: 'assessment', pattern: /^(?:assessment|diagnosis|impression)/i },
      { type: 'plan', pattern: /^(?:plan|treatment|recommendation|intervention)/i },
      { type: 'lab_results', pattern: /^(?:lab(?:oratory)?|test) (?:results|studies|findings)/i },
      { type: 'imaging', pattern: /^(?:imaging|radiology|xray|x-ray|ct|mri|ultrasound) (?:results|studies|findings)/i },
      { type: 'summary', pattern: /^(?:summary|conclusion|impression)/i },
      { type: 'footer', pattern: /^(?:footer|end of document|copyright|prepared by)/i }
    ];
    
    // Check if text matches any section pattern
    for (const { type, pattern } of sectionPatterns) {
      if (pattern.test(text.trim().substring(0, 30))) {
        return type;
      }
    }
    
    // Check for list items or bullet points
    if (/^(?:\s*[-•*]\s|\s*\d+\.\s)/.test(text.trim())) {
      return 'list_item';
    }
    
    return 'body_text';
  }

  /**
   * Helper method to detect table markers in text
   *
   * @param text The extracted text to analyze
   * @returns Boolean indicating if tables are likely present
   */
  static detectTableMarkers(text: string): boolean {
    // Look for explicit table markers
    const tableMarkers = [
      /table \d+/i,
      /\btable\b/i,
      /\btables\b/i,
      /\bfigure \d+\b/i,
      // Patterns suggesting tabular data
      /\|\s*\w+\s*\|/,
      /\+[-+]+\+/,
      /\+={2,}\+/,
      // Column headers
      /\b(column|col\.?)\s+\d+\b/i
    ];
    
    // Check for table markers
    for (const marker of tableMarkers) {
      if (marker.test(text)) {
        return true;
      }
    }
    
    // Check for consistent spacing patterns that might indicate tables
    const lines = text.split('\n');
    let potentialTableRows = 0;
    
    for (let i = 0; i < lines.length; i++) {
      // Look for lines with multiple spaces in sequence, which often indicates column alignment
      if (/\S+\s{2,}\S+\s{2,}\S+/.test(lines[i])) {
        potentialTableRows++;
        // If we find 3+ consecutive rows with this pattern, it's likely a table
        if (potentialTableRows >= 3) {
          return true;
        }
      } else {
        potentialTableRows = 0;
      }
    }
    
    return false;
  }
}