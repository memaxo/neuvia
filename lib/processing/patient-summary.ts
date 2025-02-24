import { google } from '@ai-sdk/google';
import { PromptTemplate } from '@langchain/core/prompts';
import { generateText } from 'ai';

import { createClient } from '../supabase/server';

import type { ExtractedData, PatientSummary, PatientSummarySection, DocumentType } from './types';

export class PatientSummaryGenerator {
  private model: ReturnType<typeof google>;
  private supabase: ReturnType<typeof createClient>;
  private summaryPromptTemplate: PromptTemplate;

  constructor() {
    this.model = google('gemini-2.0-flash-exp');
    this.supabase = createClient();

    this.summaryPromptTemplate = new PromptTemplate({
      template: `Generate a comprehensive medical summary section from the following extracted information. Focus on {sectionType} and ensure all critical information is included. Format the response in markdown.\n\nExtracted Data: {data}\n\nSummary Section:`,
      inputVariables: ['sectionType', 'data']
    });
  }

  private async generateSectionSummary(
    sectionType: string,
    extractedDataList: Array<{
      data: ExtractedData;
      documentId: string;
      documentType: DocumentType;
      confidence: number;
    }>
  ): Promise<PatientSummarySection> {
    try {
      const relevantData = extractedDataList.map(item => ({
        ...item.data,
        documentType: item.documentType,
        confidence: item.confidence
      }));

      const prompt = await this.summaryPromptTemplate.format({
        sectionType,
        data: JSON.stringify(relevantData, null, 2)
      });

      const result = await generateText({
        model: this.model,
        prompt,
        maxTokens: 2048,
        temperature: 0.3
      });

      return {
        title: sectionType,
        content: result.text,
        sources: extractedDataList.map(({ documentId, documentType, confidence }) => ({
          documentId,
          documentType,
          confidence
        }))
      };
    } catch (error) {
      console.error(`Error generating ${sectionType} summary:`, error);
      throw new Error(`Failed to generate ${sectionType} summary`);
    }
  }

  async generatePatientSummary(
    patientId: string,
    extractedDataList: Array<{
      data: ExtractedData;
      documentId: string;
      documentType: DocumentType;
      confidence: number;
    }>
  ): Promise<PatientSummary> {
    try {
      // Generate summaries for each section in parallel
      const [
        patientInfo,
        medicalHistory,
        currentConditions,
        medications,
        recentFindings,
        treatmentPlans,
        labResults,
        imagingResults,
        recommendations
      ] = await Promise.all([
        this.generateSectionSummary('Patient Information', extractedDataList),
        this.generateSectionSummary('Medical History', extractedDataList),
        this.generateSectionSummary('Current Conditions', extractedDataList),
        this.generateSectionSummary('Medications', extractedDataList),
        this.generateSectionSummary('Recent Findings', extractedDataList),
        this.generateSectionSummary('Treatment Plans', extractedDataList),
        this.generateSectionSummary('Laboratory Results', extractedDataList),
        this.generateSectionSummary('Imaging Results', extractedDataList),
        this.generateSectionSummary('Recommendations', extractedDataList)
      ]);

      const summary: PatientSummary = {
        patientInfo,
        medicalHistory,
        currentConditions,
        medications,
        recentFindings,
        treatmentPlans,
        labResults,
        imagingResults,
        recommendations,
        metadata: {
          generatedAt: new Date().toISOString(),
          documentCount: extractedDataList.length,
          documents: extractedDataList.map(({ documentId, documentType }) => ({
            id: documentId,
            type: documentType,
            title: `Document ${documentId}`, // You might want to get actual titles from Supabase
            date: new Date().toISOString()
          }))
        }
      };

      // Store the summary in Supabase
      await this.storeSummary(patientId, summary);

      return summary;
    } catch (error) {
      console.error('Error generating patient summary:', error);
      throw new Error('Failed to generate patient summary');
    }
  }

  private async storeSummary(patientId: string, summary: PatientSummary): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('patient_summaries')
        .upsert({
          patient_id: patientId,
          summary,
          generated_at: summary.metadata.generatedAt,
          document_count: summary.metadata.documentCount
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error storing patient summary:', error);
      throw new Error('Failed to store patient summary');
    }
  }

  generateMarkdown(summary: PatientSummary): string {
    const sections = [
      { title: '🧑‍⚕️ Patient Information', content: summary.patientInfo.content },
      { title: '📋 Medical History', content: summary.medicalHistory.content },
      { title: '🏥 Current Conditions', content: summary.currentConditions.content },
      { title: '💊 Medications', content: summary.medications.content },
      { title: '🔍 Recent Findings', content: summary.recentFindings.content },
      { title: '📝 Treatment Plans', content: summary.treatmentPlans.content },
      { title: '🧪 Laboratory Results', content: summary.labResults.content },
      { title: '🔬 Imaging Results', content: summary.imagingResults.content },
      { title: '📋 Recommendations', content: summary.recommendations.content }
    ];

    const metadata = `
---
Generated: ${new Date(summary.metadata.generatedAt).toLocaleString()}
Documents Analyzed: ${summary.metadata.documentCount}
---
`;

    const sourcesList = summary.metadata.documents.map(doc => 
      `- ${doc.type.category} - ${doc.type.type} (${new Date(doc.date).toLocaleDateString()})`
    ).join('\n');

    const markdownContent = sections
      .map(section => `## ${section.title}\n\n${section.content}\n`)
      .join('\n');

    return `# Patient Summary\n\n${metadata}\n## Sources\n\n${sourcesList}\n\n${markdownContent}`;
  }
} 