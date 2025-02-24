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

export interface PatientSummarySection {
  title: string;
  content: string;
  sources: Array<{
    documentId: string;
    documentType: DocumentType;
    confidence: number;
  }>;
}

export interface PatientSummary {
  patientInfo: PatientSummarySection;
  medicalHistory: PatientSummarySection;
  currentConditions: PatientSummarySection;
  medications: PatientSummarySection;
  recentFindings: PatientSummarySection;
  treatmentPlans: PatientSummarySection;
  labResults: PatientSummarySection;
  imagingResults: PatientSummarySection;
  recommendations: PatientSummarySection;
  metadata: {
    generatedAt: string;
    documentCount: number;
    documents: Array<{
      id: string;
      type: DocumentType;
      title: string;
      date: string;
    }>;
  };
}

export type DocumentCategory = 'clinical' | 'lab' | 'imaging' | 'prescription' | 'administrative';

export interface DocumentType {
  category: DocumentCategory;
  type: string;
  subtype?: string;
  metadata?: Record<string, unknown>;
}

export interface ProcessingStatus {
  status: 'processing' | 'completed' | 'error';
  progress: number;
  currentStep?: string;
  error?: string;
}

export interface VerificationItem {
  id: string;
  section: string;
  key: string;
  value: any;
  confidence: number;
  isVerified: boolean;
  correction?: string;
}

export interface ProcessingResult {
  extractedData: ExtractedData;
  summary: string;
  confidence: number;
  documentId: string;
  documentType: DocumentType;
}

export interface DocumentMetadata {
  id: string;
  patientId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  processingStatus: ProcessingStatus;
  storagePath: string;
  category: DocumentCategory;
  documentType: DocumentType;
} 