/**
 * Medical Document Patterns
 * 
 * This file contains constants and patterns used for document analysis.
 */

import { DocumentCategory } from '@/lib/types/document'
import type { DocumentType } from '@/lib/types/document'
import type { SectionPattern } from './types'

/**
 * Medical document types with their categories
 */
export const MEDICAL_DOCUMENT_TYPES: Record<string, DocumentType> = {
  PROGRESS_NOTE: { category: DocumentCategory.CLINICAL, type: 'progress_note' },
  HISTORY_AND_PHYSICAL: { category: DocumentCategory.CLINICAL, type: 'history_physical' },
  DISCHARGE_SUMMARY: { category: DocumentCategory.CLINICAL, type: 'discharge_summary' },
  OPERATIVE_REPORT: { category: DocumentCategory.CLINICAL, type: 'operative_report' },
  CONSULTATION: { category: DocumentCategory.CLINICAL, type: 'consultation' },
  PATHOLOGY_REPORT: { category: DocumentCategory.LAB, type: 'pathology_report' },
  RADIOLOGY_REPORT: { category: DocumentCategory.IMAGING, type: 'radiology_report' },
  LAB_RESULTS: { category: DocumentCategory.LAB, type: 'lab_results' },
  MEDICATION_LIST: { category: DocumentCategory.CLINICAL, type: 'medication_list' },
  IMMUNIZATION_RECORD: { category: DocumentCategory.CLINICAL, type: 'immunization_record' },
}

/**
 * Medical document section patterns
 */
export const MEDICAL_SECTION_PATTERNS: SectionPattern[] = [
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
]

/**
 * Document type detection patterns
 */
export const DOCUMENT_TYPE_PATTERNS: Record<string, RegExp[]> = {
  PROGRESS_NOTE: [/progress\s+note/i, /soap\s+note/i, /office\s+visit/i],
  HISTORY_AND_PHYSICAL: [
    /history\s+and\s+physical/i,
    /h\s*&\s*p/i,
    /admission\s+note/i,
  ],
  DISCHARGE_SUMMARY: [
    /discharge\s+summary/i,
    /discharge\s+note/i,
    /hospital\s+course/i,
  ],
  OPERATIVE_REPORT: [
    /operative\s+report/i,
    /operation\s+note/i,
    /surgical\s+procedure/i,
  ],
  CONSULTATION: [/consultation/i, /consult\s+note/i, /referred\s+for/i],
  PATHOLOGY_REPORT: [/pathology/i, /specimen/i, /histology/i, /biopsy/i],
  RADIOLOGY_REPORT: [
    /radiology/i,
    /impression:/i,
    /findings:/i,
    /x-ray/i,
    /ct\s+scan/i,
    /mri/i,
  ],
  LAB_RESULTS: [
    /laboratory/i,
    /lab\s+results/i,
    /test\s+results/i,
    /chemistry/i,
    /hematology/i,
  ],
  MEDICATION_LIST: [
    /medication\s+list/i,
    /current\s+medications/i,
    /prescriptions/i,
  ],
  IMMUNIZATION_RECORD: [/immunization/i, /vaccination/i, /vaccine/i],
}

/**
 * Important section mapping by document type
 */
export const IMPORTANT_SECTIONS_BY_DOC_TYPE: Record<string, string[]> = {
  'progress_note': ['chief_complaint', 'assessment', 'plan'],
  'discharge_summary': ['assessment', 'plan', 'medications'],
  'pathology_report': ['assessment', 'diagnosis'],
  'default': ['assessment', 'plan', 'medications', 'allergies'],
}

/**
 * Medical indicator patterns for key point extraction
 */
export const MEDICAL_INDICATOR_PATTERNS = {
  importance: /\b(?:diagnos|assess|significant|critical|recommend|prescribe)\w*\b/i,
  testResults: /\b(?:positive|negative|elevated|normal|abnormal)\b/i,
  medication: /\b(?:mg|mcg|dose|daily|prescribed|medication)\b/i,
  followup: /\b(?:follow\s*up|return|weeks|days|months|schedule)\b/i,
}