/**
 * @fileoverview Zod schemas for runtime validation of verification logic.
 *
 * These schemas derive from the canonical verification types in
 * `lib/types/verification.ts`. We unify the actual domain interfaces
 * with Zod-based runtime checks for API endpoints.
 */
import { z } from 'zod'
import {
  VerificationStatus,
  VerificationItem,
  VerificationMetadata,
  VerificationResult,
  VerificationOptions,
  CorrectionSubmission,
} from '@/lib/types/verification'

/**
 * Zod-based enum schema for verification status, mapping to the
 * canonical VerificationStatus enum.
 */
export const VerificationStatusSchema = z.nativeEnum(VerificationStatus)

/**
 * Zod schema matching the canonical VerificationItem interface.
 */
export const VerificationItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  originalContent: z.string(),
  currentContent: z.string(),
  isVerified: z.boolean(),
  isModified: z.boolean(),
  changeHistory: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      timestamp: z.string().datetime(),
      userId: z.string().uuid().optional(),
      reason: z.string().optional(),
    })
  ),
  metadata: z.record(z.unknown()).optional(),
})

/**
 * Zod schema for CorrectionEntry used in VerificationMetadata.
 */
const CorrectionEntrySchema = z.object({
  id: z.string(),
  text: z.string(),
  timestamp: z.string().datetime(),
  userId: z.string().uuid().optional(),
})

/**
 * Zod schema matching the canonical VerificationMetadata interface.
 */
export const VerificationMetadataSchema = z.object({
  verificationStatus: VerificationStatusSchema,
  originalSummaryId: z.string(),
  currentVersionId: z.string(),
  correctionCount: z.number().int().nonnegative(),
  verifiedAt: z.string().datetime().optional(),
  verifiedBy: z.string().uuid().optional(),
  corrections: z.array(CorrectionEntrySchema),
  extractedData: z.unknown().optional(),
  startedAt: z.string().datetime().optional(),
  lastUpdated: z.string().datetime().optional(),
  confidenceScore: z.number().optional(),
  rejectionReason: z.string().optional(),
})

/**
 * Zod schema matching the canonical VerificationResult interface.
 */
export const VerificationResultSchema = z.object({
  isCompleted: z.boolean(),
  isApproved: z.boolean(),
  items: z.array(VerificationItemSchema),
  completedAt: z.string().datetime(),
  completedBy: z.string().uuid().optional(),
  verificationTime: z.number().optional(),
  changeSummary: z
    .object({
      totalItems: z.number().int().nonnegative(),
      modifiedItems: z.number().int().nonnegative(),
      approvedWithoutChanges: z.number().int().nonnegative(),
      failedItems: z.number().int().nonnegative(),
    })
    .optional(),
  rejectionReason: z.string().optional(),
  verificationMetadata: VerificationMetadataSchema,
})

/**
 * Zod schema matching the canonical VerificationOptions interface.
 */
export const VerificationOptionsSchema = z.object({
  isRequired: z.boolean(),
  timeoutMs: z.number().int().nonnegative().optional(),
  autoApproveOnTimeout: z.boolean().optional(),
  userId: z.string().uuid().optional(),
  confidenceThreshold: z.number().optional(),
  mode: z.enum(['full', 'selective', 'batch', 'automated']).optional(),
  metadata: z.record(z.unknown()).optional(),
  items: z.array(VerificationItemSchema).optional(),
  persistenceMode: z.enum(['immediate', 'onComplete', 'onApproval', 'manual']).optional(),
  onVerificationComplete: z.any().optional(), // callback is non-serializable; optional
})

/**
 * Zod schema matching the canonical CorrectionSubmission interface.
 */
export const CorrectionSubmissionSchema = z.object({
  verificationId: z.string().uuid(),
  items: z.array(
    z.object({
      id: z.string(),
      correction: z.string(),
      reason: z.string().optional(),
    })
  ),
})

/**
 * Additional convenience validators referencing these schemas,
 * so the application can parse API requests with zod.
 */
export function validateVerificationItem(data: unknown): VerificationItem {
  return VerificationItemSchema.parse(data)
}
export function validateVerificationMetadata(data: unknown): VerificationMetadata {
  return VerificationMetadataSchema.parse(data)
}
export function validateVerificationResult(data: unknown): VerificationResult {
  return VerificationResultSchema.parse(data)
}
export function validateVerificationOptions(data: unknown): VerificationOptions {
  return VerificationOptionsSchema.parse(data)
}
export function validateCorrectionSubmission(data: unknown): CorrectionSubmission {
  return CorrectionSubmissionSchema.parse(data)
}