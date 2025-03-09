/**
 * Structured patient summary data interface
 */
export interface PatientSummaryData {
  demographics?: {
    name?: string;
    age?: string;
    gender?: string;
    dob?: string;
    mrn?: string;
    [key: string]: string | undefined;
  };
  medicalHistory?: string[];
  allergies?: string[];
  medications?: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    route?: string;
  }>;
  vitalSigns?: Array<{
    name: string;
    value: string;
    unit?: string;
    date?: string;
  }>;
  assessment?: string;
  plan?: string;
  conditions?: string[];
  procedures?: string[];
  labResults?: Array<{
    test: string;
    result: string;
    referenceRange?: string;
    date?: string;
  }>;
  imagingResults?: string[];
  recommendations?: string[];
}

/**
 * Parser for extracting structured data from markdown-formatted patient summaries
 */
export class PatientSummaryParser {
  /**
   * Extract structured data from markdown patient summary
   *
   * @param markdownText Markdown-formatted patient summary
   * @returns Structured patient summary data
   */
  static extractStructuredData(markdownText: string): PatientSummaryData {
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
    
    try {
      // Extract demographics
      this.extractDemographics(markdownText, structuredData);
      
      // Extract medical history
      this.extractMedicalHistory(markdownText, structuredData);
      
      // Extract allergies
      this.extractAllergies(markdownText, structuredData);
      
      // Extract medications
      this.extractMedications(markdownText, structuredData);
      
      // Extract vital signs
      this.extractVitalSigns(markdownText, structuredData);
      
      // Extract assessment and plan
      this.extractAssessmentAndPlan(markdownText, structuredData);
      
      // Extract conditions
      this.extractConditions(markdownText, structuredData);
      
      // Extract procedures
      this.extractProcedures(markdownText, structuredData);
      
      // Extract lab results
      this.extractLabResults(markdownText, structuredData);
      
      // Extract imaging results
      this.extractImagingResults(markdownText, structuredData);
      
      // Extract recommendations
      this.extractRecommendations(markdownText, structuredData);
      
    } catch (error) {
      // Log the error but don't block returning partial data
      console.error('Error extracting structured data:', error);
    }
    
    return structuredData;
  }
  
  /**
   * Extract demographics section from markdown text
   */
  private static extractDemographics(
    markdownText: string,
    data: PatientSummaryData
  ): void {
    const patientInfoMatch = markdownText.match(/## Patient Information\s+([\s\S]*?)(?=\n## |$)/i) ||
                        markdownText.match(/## Patient Demographics\s+([\s\S]*?)(?=\n## |$)/i);
                        
    if (patientInfoMatch && patientInfoMatch[1]) {
      const demographicsText = patientInfoMatch[1];
      
      // Extract name
      const nameMatch = demographicsText.match(/\*\*Name:\*\*\s*(.*?)(?:\n|$)/i);
      if (nameMatch && nameMatch[1]) {
        data.demographics!.name = nameMatch[1].trim();
      }
      
      // Extract age
      const ageMatch = demographicsText.match(/\*\*Age:\*\*\s*(.*?)(?:\n|$)/i);
      if (ageMatch && ageMatch[1]) {
        data.demographics!.age = ageMatch[1].trim();
      }
      
      // Extract gender
      const genderMatch = demographicsText.match(/\*\*Gender:\*\*\s*(.*?)(?:\n|$)/i);
      if (genderMatch && genderMatch[1]) {
        data.demographics!.gender = genderMatch[1].trim();
      }
      
      // Extract date of birth
      const dobMatch = demographicsText.match(/\*\*DOB:\*\*\s*(.*?)(?:\n|$)/i) ||
                       demographicsText.match(/\*\*Date of Birth:\*\*\s*(.*?)(?:\n|$)/i);
      if (dobMatch && dobMatch[1]) {
        data.demographics!.dob = dobMatch[1].trim();
      }
      
      // Extract MRN
      const mrnMatch = demographicsText.match(/\*\*MRN:\*\*\s*(.*?)(?:\n|$)/i) ||
                       demographicsText.match(/\*\*Medical Record Number:\*\*\s*(.*?)(?:\n|$)/i);
      if (mrnMatch && mrnMatch[1]) {
        data.demographics!.mrn = mrnMatch[1].trim();
      }
    }
  }
  
  /**
   * Extract medical history section from markdown text
   */
  private static extractMedicalHistory(
    markdownText: string,
    data: PatientSummaryData
  ): void {
    const medicalHistoryMatch = markdownText.match(/## Medical History\s+([\s\S]*?)(?=\n## |$)/i);
    if (medicalHistoryMatch && medicalHistoryMatch[1]) {
      const historyText = medicalHistoryMatch[1];
      
      // Extract bullet points
      const bulletItems = historyText.match(/[-*•]\s*(.*?)(?:\n|$)/g);
      if (bulletItems) {
        data.medicalHistory = bulletItems.map(item =>
          item.replace(/^[-*•]\s*/, '').trim()
        ).filter(item => item.length > 0);
      } else {
        // If no bullet points, add the entire section
        data.medicalHistory = [historyText.trim()];
      }
    }
  }
  
  /**
   * Extract allergies section from markdown text
   */
  private static extractAllergies(
    markdownText: string,
    data: PatientSummaryData
  ): void {
    const allergiesMatch = markdownText.match(/## Allergies\s+([\s\S]*?)(?=\n## |$)/i);
    if (allergiesMatch && allergiesMatch[1]) {
      const allergiesText = allergiesMatch[1];
      
      // Extract bullet points
      const bulletItems = allergiesText.match(/[-*•]\s*(.*?)(?:\n|$)/g);
      if (bulletItems) {
        data.allergies = bulletItems.map(item =>
          item.replace(/^[-*•]\s*/, '').trim()
        ).filter(item => item.length > 0);
      } else {
        // If no bullet points, add the entire section
        data.allergies = [allergiesText.trim()];
      }
    }
  }
  
  /**
   * Extract medications section from markdown text
   */
  private static extractMedications(
    markdownText: string,
    data: PatientSummaryData
  ): void {
    const medicationsMatch = markdownText.match(/## Medications\s+([\s\S]*?)(?=\n## |$)/i);
    if (medicationsMatch && medicationsMatch[1]) {
      const medicationsText = medicationsMatch[1];
      
      // Extract bullet points
      const bulletItems = medicationsText.match(/[-*•]\s*(.*?)(?:\n|$)/g);
      if (bulletItems) {
        data.medications = bulletItems.map(item => {
          const medicationText = item.replace(/^[-*•]\s*/, '').trim();
          
          // Try to parse structured medication information
          const parts = medicationText.split(/,\s*/);
          const medication: { name: string; dosage?: string; frequency?: string; route?: string } = {
            name: parts[0]
          };
          
          // Look for dosage, frequency, and route in other parts
          parts.slice(1).forEach(part => {
            if (/mg|mcg|g|ml|units/i.test(part)) {
              medication.dosage = part.trim();
            } else if (/daily|bid|tid|qid|weekly|monthly|every|once|twice/i.test(part)) {
              medication.frequency = part.trim();
            } else if (/oral|iv|subcutaneous|intramuscular|topical|inhaled/i.test(part)) {
              medication.route = part.trim();
            }
          });
          
          return medication;
        });
      }
    }
  }
  
  /**
   * Extract vital signs section from markdown text
   */
  private static extractVitalSigns(
    markdownText: string,
    data: PatientSummaryData
  ): void {
    const vitalsMatch = markdownText.match(/## Vital Signs\s+([\s\S]*?)(?=\n## |$)/i);
    if (vitalsMatch && vitalsMatch[1]) {
      const vitalsText = vitalsMatch[1];
      
      // Extract common vital signs
      const bpMatch = vitalsText.match(/BP[:\s]+(\d+\/\d+)/i);
      if (bpMatch) {
        data.vitalSigns!.push({
          name: 'Blood Pressure',
          value: bpMatch[1],
          unit: 'mmHg'
        });
      }
      
      const hrMatch = vitalsText.match(/HR[:\s]+(\d+)/i) || vitalsText.match(/Pulse[:\s]+(\d+)/i);
      if (hrMatch) {
        data.vitalSigns!.push({
          name: 'Heart Rate',
          value: hrMatch[1],
          unit: 'bpm'
        });
      }
      
      const tempMatch = vitalsText.match(/Temp[erature]*[:\s]+([\d\.]+)/i);
      if (tempMatch) {
        data.vitalSigns!.push({
          name: 'Temperature',
          value: tempMatch[1],
          unit: vitalsText.includes('F') ? '°F' : '°C'
        });
      }
      
      const rrMatch = vitalsText.match(/RR[:\s]+(\d+)/i) || vitalsText.match(/Respiratory Rate[:\s]+(\d+)/i);
      if (rrMatch) {
        data.vitalSigns!.push({
          name: 'Respiratory Rate',
          value: rrMatch[1],
          unit: 'breaths/min'
        });
      }
      
      const o2Match = vitalsText.match(/O2[:\s]+([\d\.]+)/i) || vitalsText.match(/SpO2[:\s]+([\d\.]+)/i);
      if (o2Match) {
        data.vitalSigns!.push({
          name: 'Oxygen Saturation',
          value: o2Match[1],
          unit: '%'
        });
      }
    }
  }
  
  /**
   * Extract assessment and plan sections from markdown text
   */
  private static extractAssessmentAndPlan(
    markdownText: string,
    data: PatientSummaryData
  ): void {
    // Extract assessment
    const assessmentMatch = markdownText.match(/## Assessment\s+([\s\S]*?)(?=\n## |$)/i);
    if (assessmentMatch && assessmentMatch[1]) {
      data.assessment = assessmentMatch[1].trim();
    }
    
    // Extract plan
    const planMatch = markdownText.match(/## (?:Treatment )?Plan\s+([\s\S]*?)(?=\n## |$)/i);
    if (planMatch && planMatch[1]) {
      data.plan = planMatch[1].trim();
    }
  }
  
  /**
   * Extract current conditions section from markdown text
   */
  private static extractConditions(
    markdownText: string,
    data: PatientSummaryData
  ): void {
    const conditionsMatch = markdownText.match(/## Current Conditions\s+([\s\S]*?)(?=\n## |$)/i);
    if (conditionsMatch && conditionsMatch[1]) {
      const conditionsText = conditionsMatch[1];
      
      // Extract bullet points
      const bulletItems = conditionsText.match(/[-*•]\s*(.*?)(?:\n|$)/g);
      if (bulletItems) {
        data.conditions = bulletItems.map(item =>
          item.replace(/^[-*•]\s*/, '').trim()
        ).filter(item => item.length > 0);
      }
    }
  }
  
  /**
   * Extract procedures section from markdown text
   */
  private static extractProcedures(
    markdownText: string,
    data: PatientSummaryData
  ): void {
    const proceduresMatch = markdownText.match(/## Procedures\s+([\s\S]*?)(?=\n## |$)/i);
    if (proceduresMatch && proceduresMatch[1]) {
      const proceduresText = proceduresMatch[1];
      
      // Extract bullet points
      const bulletItems = proceduresText.match(/[-*•]\s*(.*?)(?:\n|$)/g);
      if (bulletItems) {
        data.procedures = bulletItems.map(item =>
          item.replace(/^[-*•]\s*/, '').trim()
        ).filter(item => item.length > 0);
      }
    }
  }
  
  /**
   * Extract lab results section from markdown text
   */
  private static extractLabResults(
    markdownText: string,
    data: PatientSummaryData
  ): void {
    const labResultsMatch = markdownText.match(/## Laboratory Results\s+([\s\S]*?)(?=\n## |$)/i);
    if (labResultsMatch && labResultsMatch[1]) {
      const labText = labResultsMatch[1];
      
      // Extract bullet points
      const bulletItems = labText.match(/[-*•]\s*(.*?)(?:\n|$)/g);
      if (bulletItems) {
        data.labResults = bulletItems.map(item => {
          const labItemText = item.replace(/^[-*•]\s*/, '').trim();
          
          // Try to parse structured lab result information
          const testMatch = labItemText.match(/^(.*?):\s*(.*?)(?:\s*\(.*?\))?$/);
          if (testMatch) {
            return {
              test: testMatch[1].trim(),
              result: testMatch[2].trim(),
              referenceRange: labItemText.match(/\((.*?)\)/) ? labItemText.match(/\((.*?)\)/)![1] : undefined
            };
          }
          
          return {
            test: 'Unknown',
            result: labItemText
          };
        });
      }
    }
  }
  
  /**
   * Extract imaging results section from markdown text
   */
  private static extractImagingResults(
    markdownText: string,
    data: PatientSummaryData
  ): void {
    const imagingMatch = markdownText.match(/## Imaging Results\s+([\s\S]*?)(?=\n## |$)/i);
    if (imagingMatch && imagingMatch[1]) {
      const imagingText = imagingMatch[1];
      
      // Extract bullet points
      const bulletItems = imagingText.match(/[-*•]\s*(.*?)(?:\n|$)/g);
      if (bulletItems) {
        data.imagingResults = bulletItems.map(item =>
          item.replace(/^[-*•]\s*/, '').trim()
        ).filter(item => item.length > 0);
      } else {
        // If no bullet points, add the entire section
        data.imagingResults = [imagingText.trim()];
      }
    }
  }
  
  /**
   * Extract recommendations section from markdown text
   */
  private static extractRecommendations(
    markdownText: string,
    data: PatientSummaryData
  ): void {
    const recommendationsMatch = markdownText.match(/## Recommendations\s+([\s\S]*?)(?=\n## |$)/i);
    if (recommendationsMatch && recommendationsMatch[1]) {
      const recommendationsText = recommendationsMatch[1];
      
      // Extract bullet points
      const bulletItems = recommendationsText.match(/[-*•]\s*(.*?)(?:\n|$)/g);
      if (bulletItems) {
        data.recommendations = bulletItems.map(item =>
          item.replace(/^[-*•]\s*/, '').trim()
        ).filter(item => item.length > 0);
      } else {
        // If no bullet points, add the entire section
        data.recommendations = [recommendationsText.trim()];
      }
    }
  }

  /**
   * Generate a markdown representation of patient summary
   *
   * @param data Structured patient summary data
   * @returns Markdown-formatted patient summary
   */
  static generateMarkdown(data: PatientSummaryData): string {
    let markdown = '# Patient Summary\n\n';
    
    // Demographics section
    if (data.demographics && Object.keys(data.demographics).length > 0) {
      markdown += '## Patient Information\n\n';
      for (const [key, value] of Object.entries(data.demographics)) {
        if (value) {
          const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
          markdown += `**${formattedKey}:** ${value}\n`;
        }
      }
      markdown += '\n';
    }
    
    // Medical history section
    if (data.medicalHistory && data.medicalHistory.length > 0) {
      markdown += '## Medical History\n\n';
      data.medicalHistory.forEach(item => {
        markdown += `- ${item}\n`;
      });
      markdown += '\n';
    }
    
    // Current conditions section
    if (data.conditions && data.conditions.length > 0) {
      markdown += '## Current Conditions\n\n';
      data.conditions.forEach(condition => {
        markdown += `- ${condition}\n`;
      });
      markdown += '\n';
    }
    
    // Medications section
    if (data.medications && data.medications.length > 0) {
      markdown += '## Medications\n\n';
      data.medications.forEach(med => {
        let medText = med.name;
        if (med.dosage) medText += `, ${med.dosage}`;
        if (med.frequency) medText += `, ${med.frequency}`;
        if (med.route) medText += `, ${med.route}`;
        markdown += `- ${medText}\n`;
      });
      markdown += '\n';
    }
    
    // Allergies section
    if (data.allergies && data.allergies.length > 0) {
      markdown += '## Allergies\n\n';
      data.allergies.forEach(allergy => {
        markdown += `- ${allergy}\n`;
      });
      markdown += '\n';
    }
    
    // Vital signs section
    if (data.vitalSigns && data.vitalSigns.length > 0) {
      markdown += '## Vital Signs\n\n';
      data.vitalSigns.forEach(vital => {
        let vitalText = `${vital.name}: ${vital.value}`;
        if (vital.unit) vitalText += ` ${vital.unit}`;
        if (vital.date) vitalText += ` (${vital.date})`;
        markdown += `- ${vitalText}\n`;
      });
      markdown += '\n';
    }
    
    // Assessment section
    if (data.assessment) {
      markdown += '## Assessment\n\n';
      markdown += `${data.assessment}\n\n`;
    }
    
    // Plan section
    if (data.plan) {
      markdown += '## Plan\n\n';
      markdown += `${data.plan}\n\n`;
    }
    
    // Lab results section
    if (data.labResults && data.labResults.length > 0) {
      markdown += '## Laboratory Results\n\n';
      data.labResults.forEach(lab => {
        let labText = `${lab.test}: ${lab.result}`;
        if (lab.referenceRange) labText += ` (${lab.referenceRange})`;
        if (lab.date) labText += ` - ${lab.date}`;
        markdown += `- ${labText}\n`;
      });
      markdown += '\n';
    }
    
    // Imaging results section
    if (data.imagingResults && data.imagingResults.length > 0) {
      markdown += '## Imaging Results\n\n';
      data.imagingResults.forEach(imaging => {
        markdown += `- ${imaging}\n`;
      });
      markdown += '\n';
    }
    
    // Recommendations section
    if (data.recommendations && data.recommendations.length > 0) {
      markdown += '## Recommendations\n\n';
      data.recommendations.forEach(rec => {
        markdown += `- ${rec}\n`;
      });
      markdown += '\n';
    }
    
    return markdown;
  }
}