/**
 * Verification Type Schemas
 *
 * Zod schemas and type definitions for the verification workflow
 */
import { z } from 'zod'
import type { UUID } from '@/lib/types/base'
import { zodErrorToValidationError } from '@/lib/errors'

/**
 * Verification status schema
 */
export const VerificationStatusSchema = z.enum([
  'pending',
  'verified',
  'rejected',
  'needs_correction'
])

export type VerificationStatus = z.infer<typeof VerificationStatusSchema>

/**
 * Verification item schema
 */
export const VerificationItemSchema = z.object({
  /**
   * Item ID
   */
  id: z.string(),
  
  /**
   * Item title/label
   */
  title: z.string(),
  
  /**
   * Item content to verify
   */
  content: z.string(),
  
  /**
   * Verification status
   */
  status: VerificationStatusSchema,
  
  /**
   * User correction (if any)
   */
  correction: z.string().optional(),
  
  /**
   * Reason for rejection/correction
   */
  reason: z.string().optional(),
  
  /**
   * Who verified this item
   */
  verifiedBy: z.string().uuid().optional(),
  
  /**
   * When it was verified
   */
  verifiedAt: z.date().or(z.string().datetime()).optional(),
  
  /**
   * Additional metadata
   */
  metadata: z.record(z.unknown()).optional()
})

export type VerificationItem = z.infer<typeof VerificationItemSchema>

/**
 * Verification metadata schema
 */
export const VerificationMetadataSchema = z.object({
  /**
   * Verification status
   */
  verificationStatus: VerificationStatusSchema,
  
  /**
   * ID of the original summary
   */
  originalSummaryId: z.string().optional(),
  
  /**
   * ID of the current version
   */
  currentVersionId: z.string().optional(),
  
  /**
   * Number of corrections made
   */
  correctionCount: z.number().int().nonnegative().default(0),
  
  /**
   * Corrections history
   */
  corrections: z.array(z.object({
    id: z.string(),
    timestamp: z.date().or(z.string().datetime()),
    content: z.string()
  })).optional(),
  
  /**
   * Document ID being verified
   */
  documentId: z.string().uuid().optional(),
  
  /**
   * Patient ID (if applicable)
   */
  patientId: z.string().uuid().optional()
})

export type VerificationMetadata = z.infer<typeof VerificationMetadataSchema>

/**
 * Verification options schema
 */
export const VerificationOptionsSchema = z.object({
  /**
   * Verification title
   */
  title: z.string().optional(),
  
  /**
   * Patient ID (if applicable)
   */
  patientId: z.string().uuid().optional(),
  
  /**
   * Document ID (if applicable)
   */
  documentId: z.string().uuid().optional(),
  
  /**
   * Items to verify
   */
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      content: z.string()
    })
  ).optional(),
  
  /**
   * Additional options
   */
  options: z.record(z.unknown()).optional()
})

export type VerificationOptions = z.infer<typeof VerificationOptionsSchema>

/**
 * Verification result schema
 */
export const VerificationResultSchema = z.object({
  /**
   * Whether verification passed
   */
  isVerified: z.boolean(),
  
  /**
   * Items with verification status
   */
  items: z.array(VerificationItemSchema),
  
  /**
   * Rejection reason (if not verified)
   */
  rejectionReason: z.string().optional(),
  
  /**
   * Verification metadata
   */
  metadata: VerificationMetadataSchema.optional()
})

export type VerificationResult = z.infer<typeof VerificationResultSchema>

/**
 * Correction submission schema
 */
export const CorrectionSubmissionSchema = z.object({
  /**
   * Verification ID
   */
  verificationId: z.string().uuid(),
  
  /**
   * Items with corrections
   */
  items: z.array(z.object({
    id: z.string(),
    correction: z.string(),
    reason: z.string().optional()
  }))
})

export type CorrectionSubmission = z.infer<typeof CorrectionSubmissionSchema>

/**
 * Validate verification request data
 * 
 * @param data Unknown data to validate
 * @returns Validated VerificationOptions
 */
export function validateVerificationRequest(data: unknown): VerificationOptions {
  try {
    return VerificationOptionsSchema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw zodErrorToValidationError(error, 'Invalid verification request')
    }
    throw error
  }
}

/**
 * Validate verification item data
 * 
 * @param data Unknown data to validate
 * @returns Validated VerificationItem
 */
export function validateVerificationItem(data: unknown): VerificationItem {
  try {
    return VerificationItemSchema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw zodErrorToValidationError(error, 'Invalid verification item')
    }
    throw error
  }
}

/**
 * Validate verification result data
 * 
 * @param data Unknown data to validate
 * @returns Validated VerificationResult
 */
export function validateVerificationResult(data: unknown): VerificationResult {
  try {
    return VerificationResultSchema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw zodErrorToValidationError(error, 'Invalid verification result')
    }
    throw error
  }
}