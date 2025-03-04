/**
 * @fileoverview OpenAPI path definitions for verification-related endpoints,
 * aligned with the canonical types from `lib/types/verification.ts`.
 * 
 * Property names and status values must match "pending", "inProgress",
 * "completed", or "failed" exactly, along with the updated VerificationItem.
 */

import { OpenAPIV3 } from 'openapi-types'

/**
 * Updated verification schemas following the new canonical definitions.
 * Where possible, examples and descriptions have been aligned with
 * the documented interface in `lib/types/verification.ts`.
 */
export const verificationSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  /**
   * VerificationStatus schema referencing the four states
   */
  VerificationStatus: {
    type: 'string',
    enum: ['pending', 'inProgress', 'completed', 'failed'],
    description: 'Overall verification status of the content',
    example: 'inProgress',
  },

  /**
   * CorrectionEntry used within verification metadata
   */
  CorrectionEntry: {
    type: 'object',
    required: ['id', 'text', 'timestamp'],
    properties: {
      id: {
        type: 'string',
        description: 'Unique identifier for this correction',
      },
      text: {
        type: 'string',
        description: 'The text of the correction',
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'When the correction was submitted',
      },
      userId: {
        type: 'string',
        description: 'Who made the correction (if applicable)',
      },
    },
    example: {
      id: 'corr-123',
      text: 'Patient name should be updated to John Smith',
      timestamp: '2025-03-01T12:34:56.000Z',
      userId: 'user-123',
    },
  },

  /**
   * VersionHistoryEntry used within a VerificationItem's changeHistory
   */
  VersionHistoryEntry: {
    type: 'object',
    required: ['id', 'content', 'timestamp'],
    properties: {
      id: {
        type: 'string',
        description: 'Unique version ID',
      },
      content: {
        type: 'string',
        description: 'The version of content at this point',
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'Timestamp of creation',
      },
      userId: {
        type: 'string',
        description: 'Which user (if any) made this version',
      },
      reason: {
        type: 'string',
        description: 'Optional reason for the change',
      },
    },
    example: {
      id: 'ver-abc',
      content: 'Original content about medication X',
      timestamp: '2025-03-01T10:00:00.000Z',
      userId: 'user-abc',
      reason: 'Initial extraction',
    },
  },

  /**
   * VerificationItem: updated canonical shape
   */
  VerificationItem: {
    type: 'object',
    required: [
      'id',
      'title',
      'originalContent',
      'currentContent',
      'isVerified',
      'isModified',
      'changeHistory',
    ],
    properties: {
      id: {
        type: 'string',
        description: 'Unique identifier for this verification item',
      },
      title: {
        type: 'string',
        description: 'Title or label describing the item',
      },
      description: {
        type: 'string',
        description: 'Optional descriptive text about what needs verification',
      },
      originalContent: {
        type: 'string',
        description: 'The unmodified content extracted from the source',
      },
      currentContent: {
        type: 'string',
        description: 'The user-corrected or current content',
      },
      isVerified: {
        type: 'boolean',
        description: 'Whether the user has verified this item',
      },
      isModified: {
        type: 'boolean',
        description: 'Whether this item differs from its originalContent',
      },
      changeHistory: {
        type: 'array',
        items: { $ref: '#/components/schemas/VersionHistoryEntry' },
        description: 'History of changes to this item',
      },
      metadata: {
        type: 'object',
        additionalProperties: true,
        description: 'Arbitrary metadata (confidence, location, etc.)',
      },
    },
    example: {
      id: 'item-001',
      title: 'Patient Name',
      description: 'Verify the patient name is correct',
      originalContent: 'Jon Smythe',
      currentContent: 'John Smith',
      isVerified: false,
      isModified: true,
      changeHistory: [
        {
          id: 'ver-01',
          content: 'Jon Smythe',
          timestamp: '2025-03-01T09:00:00Z',
        },
      ],
      metadata: {
        confidence: 0.7,
      },
    },
  },

  /**
   * VerificationMetadata: top-level metadata about the verification process
   */
  VerificationMetadata: {
    type: 'object',
    required: [
      'verificationStatus',
      'originalSummaryId',
      'currentVersionId',
      'correctionCount',
      'corrections',
    ],
    properties: {
      verificationStatus: {
        $ref: '#/components/schemas/VerificationStatus',
      },
      originalSummaryId: {
        type: 'string',
        description: 'ID of the original summary/document being verified',
      },
      currentVersionId: {
        type: 'string',
        description: 'ID of the current version under verification',
      },
      correctionCount: {
        type: 'integer',
        minimum: 0,
        description: 'How many corrections have been applied so far',
      },
      verifiedAt: {
        type: 'string',
        format: 'date-time',
        description: 'When the content was fully verified (if completed)',
      },
      verifiedBy: {
        type: 'string',
        description: 'Who verified the content (if known)',
      },
      corrections: {
        type: 'array',
        items: { $ref: '#/components/schemas/CorrectionEntry' },
        description: 'List of correction entries that have been applied',
      },
      extractedData: {
        type: 'object',
        description: 'Raw or structured data extracted for verification',
        additionalProperties: true,
      },
      startedAt: {
        type: 'string',
        format: 'date-time',
        description: 'When verification began',
      },
      lastUpdated: {
        type: 'string',
        format: 'date-time',
        description: 'When verification metadata was last updated',
      },
      confidenceScore: {
        type: 'number',
        description: 'Optional overall confidence measure (0-1)',
      },
      rejectionReason: {
        type: 'string',
        description: 'If failed, why verification was rejected',
      },
    },
    example: {
      verificationStatus: 'inProgress',
      originalSummaryId: 'sum-123',
      currentVersionId: 'sum-456',
      correctionCount: 2,
      corrections: [
        {
          id: 'corr-001',
          text: 'Change name from Smythe to Smith',
          timestamp: '2025-03-01T11:15:00Z',
        },
      ],
      startedAt: '2025-03-01T10:00:00Z',
      lastUpdated: '2025-03-01T11:30:00Z',
    },
  },

  /**
   * VerificationResult: the final outcome of a verification workflow
   */
  VerificationResult: {
    type: 'object',
    required: ['isCompleted', 'isApproved', 'items', 'completedAt', 'verificationMetadata'],
    properties: {
      isCompleted: {
        type: 'boolean',
        description: 'Whether the verification process has ended',
      },
      isApproved: {
        type: 'boolean',
        description: 'Whether the content was accepted (true) or rejected (false)',
      },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/VerificationItem' },
        description: 'All items that were verified in this session',
      },
      completedAt: {
        type: 'string',
        format: 'date-time',
        description: 'When verification was completed',
      },
      completedBy: {
        type: 'string',
        description: 'User who completed the process (if any)',
      },
      verificationTime: {
        type: 'integer',
        minimum: 0,
        description: 'Total time spent on verification (in ms)',
      },
      changeSummary: {
        type: 'object',
        properties: {
          totalItems: { type: 'integer', minimum: 0 },
          modifiedItems: { type: 'integer', minimum: 0 },
          approvedWithoutChanges: { type: 'integer', minimum: 0 },
          failedItems: { type: 'integer', minimum: 0 },
        },
        description: 'Short summary of changes made during verification',
      },
      rejectionReason: {
        type: 'string',
        description: 'If not approved, a reason for the rejection',
      },
      verificationMetadata: {
        $ref: '#/components/schemas/VerificationMetadata',
      },
    },
    example: {
      isCompleted: true,
      isApproved: false,
      items: [],
      completedAt: '2025-03-02T09:00:00Z',
      completedBy: 'user-456',
      verificationMetadata: {
        verificationStatus: 'failed',
        originalSummaryId: 'sum-123',
        currentVersionId: 'sum-456',
        correctionCount: 3,
        corrections: [],
      },
    },
  },
}