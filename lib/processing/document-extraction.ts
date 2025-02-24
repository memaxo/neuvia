import { google } from "@ai-sdk/google";
import { PromptTemplate } from "@langchain/core/prompts";
import { generateText } from "ai";
import { createClient } from "../supabase/server";

export interface DocumentCategory {
  category: string;
  type: string;
  subtype?: string;
  metadata?: Record<string, unknown>;
}

export interface ExtractedData {
  patientInfo?: {
    name?: string;
    dateOfBirth?: string;
    gender?: string;
    [key: string]: any;
  };
  medicalHistory?: {
    conditions?: string[];
    medications?: string[];
    allergies?: string[];
    [key: string]: any;
  };
  diagnosis?: {
    primary?: string;
    secondary?: string[];
    [key: string]: any;
  };
  treatment?: {
    plan?: string;
    medications?: string[];
    procedures?: string[];
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ProcessingStatus {
  status: "processing" | "completed" | "error";
  progress: number;
  currentStep?: string;
  error?: string;
}

export interface DocumentType {
  category: string;
  type: string;
  subtype?: string;
  metadata?: Record<string, unknown>;
}

export interface ProcessingResult {
  extractedData: ExtractedData;
  summary: string;
  confidence: number;
  documentId?: string;
  documentType?: DocumentType;
}

/**
 * A unified class for handling doc extraction, summarization,
 * uploading to storage, and record creation if needed.
 */
export class DocumentExtraction {
  private model = google("gemini-2.0-flash-exp");
  private supabase = createClient();

  // Prompt for extracting structured data as valid JSON
  private extractionPrompt = new PromptTemplate({
    template: `
You are given a medical document for analysis. Return ONLY valid JSON with the following top-level keys:
"patientInfo", "medicalHistory", "diagnosis", "treatment".
- patientInfo includes: { "name", "dateOfBirth", "gender", ...}
- medicalHistory includes: { "conditions", "medications", "allergies", ...}
- diagnosis includes: { "primary", "secondary", ... }
- treatment includes: { "plan", "medications", "procedures", ... }

If data for any key is missing, provide an empty object or empty array. No extra text or explanation, ONLY valid JSON.

Document Type: {documentType}
Document Content:
{text}

Reply with valid JSON:
`,
    inputVariables: ["text", "documentType"],
  });

  constructor() {}

  /**
   * Extract data from the text of a medical document using the Gemini model,
   * returning a structured JSON object.
   */
  public async extractData(
    text: string,
    documentType: DocumentType
  ): Promise<ExtractedData> {
    try {
      const prompt = await this.extractionPrompt.format({
        text,
        documentType: `${documentType.category} - ${documentType.type}`,
      });

      const result = await generateText({
        model: this.model,
        prompt,
        maxTokens: 2048,
        temperature: 0.3,
        topP: 0.2,
      });

      let parsed: ExtractedData = {};
      try {
        parsed = JSON.parse(result.text);
      } catch (jsonError) {
        // If JSON parse fails, create fallback
        console.error("Failed to parse JSON from LLM:", jsonError);
        throw new Error(
          "Invalid JSON returned by the model. Please try again or refine the prompt."
        );
      }

      return parsed;
    } catch (error) {
      console.error("Error extracting data:", error);
      throw new Error("Failed to extract data from document");
    }
  }

  /**
   * Summarize the entire document.
   */
  public async summarizeDocument(
    text: string,
    documentType: DocumentType
  ): Promise<string> {
    try {
      const summaryPrompt = `
You are given a ${documentType.category} - ${documentType.type} medical document. Summarize the key points succinctly.
Do not include extra disclaimers. This is a summary for internal medical review:
${text}
`;
      const result = await generateText({
        model: this.model,
        prompt: summaryPrompt,
        maxTokens: 2048,
        temperature: 0.5,
        topP: 0.3,
      });
      return result.text.trim();
    } catch (error) {
      console.error("Error summarizing document:", error);
      throw new Error("Failed to summarize document");
    }
  }

  /**
   * If you'd like to upload the file to Supabase storage for record-keeping.
   */
  public async uploadToStorage(
    file: File,
    patientId: string,
    documentType: DocumentType
  ): Promise<string> {
    const timestamp = new Date().toISOString();
    const fileExt = file.name.split(".").pop() || "dat";
    const filePath = `patients/${patientId}/${documentType.category}/${timestamp}-${file.name}`;

    const { data, error } = await this.supabase.storage
      .from("medical-documents")
      .upload(filePath, file);

    if (error) {
      console.error("Error uploading to storage:", error);
      throw error;
    }
    return filePath;
  }

  /**
   * If you'd like to create a record in DB referencing the extracted data.
   */
  public async createDocumentRecord(
    patientId: string,
    file: File,
    storagePath: string,
    extractedData: ExtractedData,
    documentType: DocumentType
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from("patient_documents")
      .insert({
        patient_id: patientId,
        category: documentType.category,
        document_type: {
          type: documentType.type,
          subtype: documentType.subtype,
          metadata: documentType.metadata,
        },
        title: file.name,
        file_type: file.type,
        file_size: file.size,
        file_path: storagePath,
        document_date: new Date().toISOString(),
        content_text: await file.text(),
        extracted_data: extractedData,
        processing_status: "completed",
        is_processed: true,
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }
}

/**
 * The main entry point for handling a single file. This calls the DocumentExtraction class
 * to unify extraction, summarization, and optionally storage.
 */
export async function processDocument(
  file: File,
  patientId: string,
  documentType: DocumentType,
  onStatusUpdate?: (status: ProcessingStatus) => void
): Promise<ProcessingResult> {
  const extraction = new DocumentExtraction();

  // Step 1: Update status
  onStatusUpdate?.({
    status: "processing",
    progress: 10,
    currentStep: "Reading file content",
  });

  const text = await file.text();

  // Step 2: Extract structured data
  onStatusUpdate?.({
    status: "processing",
    progress: 40,
    currentStep: "Extracting structured data",
  });

  const extractedData = await extraction.extractData(text, documentType);

  // Step 3: Summarize
  onStatusUpdate?.({
    status: "processing",
    progress: 70,
    currentStep: "Generating summary",
  });

  const summary = await extraction.summarizeDocument(text, documentType);

  // Step 4: (Optional) Upload the file to storage
  let storagePath = "";
  let documentId = "";
  try {
    onStatusUpdate?.({
      status: "processing",
      progress: 80,
      currentStep: "Uploading and creating document record",
    });

    storagePath = await extraction.uploadToStorage(file, patientId, documentType);
    documentId = await extraction.createDocumentRecord(
      patientId,
      file,
      storagePath,
      extractedData,
      documentType
    );
  } catch (err) {
    // Not necessarily an error if storage or record creation is optional
    console.warn("Error uploading or creating record:", err);
  }

  onStatusUpdate?.({
    status: "completed",
    progress: 100,
    currentStep: "Done",
  });

  return {
    extractedData,
    summary,
    confidence: 0.85, // Example confidence
    documentId,
    documentType,
  };
}