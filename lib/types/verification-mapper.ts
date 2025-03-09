/**
 * @fileoverview Mapper for converting between domain verification entities and database representations.
 */
import { BaseEntityMapper, EnumMapper } from './mapper-base';
import type { Database } from './database';
import type {
  VerificationMetadata,
  VerificationItem,
  VerifiedDocument,
  ExtendedVerificationItem,
} from './verification';
import { VerificationStatus } from './verification';
import type {
  DbVerificationMetadata,
  DbVerificationItem,
  DbVerifiedDocument,
} from './db-adapters';
import { documentTypeMapper } from './document-mapper';

/**
 * Mapper for verification status enum
 */
export class VerificationStatusMapper extends EnumMapper<VerificationStatus, Database['public']['Enums']['workflow_step']> {
  protected readonly defaultDomainValue = VerificationStatus.pending;
  protected readonly defaultDbValue = 'verification_pending' as Database['public']['Enums']['workflow_step'];

  protected readonly domainToDbMap = new Map<VerificationStatus, Database['public']['Enums']['workflow_step']>([
    [VerificationStatus.inProgress, 'verification_in_progress'],
    [VerificationStatus.completed, 'verification_completed'],
    [VerificationStatus.failed, 'verification_failed'],
    [VerificationStatus.pending, 'verification_pending'],
  ]);

  protected readonly dbToDomainMap = new Map<Database['public']['Enums']['workflow_step'], VerificationStatus>(
    Array.from(this.domainToDbMap.entries()).map(([k, v]) => [v, k])
  );
}

/**
 * Mapper for verification metadata
 */
export class VerificationMetadataMapper extends BaseEntityMapper<VerificationMetadata, DbVerificationMetadata> {
  toDomain(dbMeta: DbVerificationMetadata): VerificationMetadata {
    // Map the corrections array to match the expected format
    const corrections = dbMeta.corrections.map((c) => ({
      id: c.id,
      text: c.text,
      timestamp: c.timestamp,
      userId: c.user_id,
    }));

    // Create a partial object with only the properties defined in VerificationMetadata
    const metadata: Partial<VerificationMetadata> = {
      verification_status: dbMeta.verification_status as VerificationStatus,
      originalSummaryId: dbMeta.original_summary_id,
      currentVersionId: dbMeta.current_version_id,
      correctionCount: dbMeta.correction_count,
      verifiedAt: dbMeta.verified_at,
      verifiedBy: dbMeta.verified_by,
      corrections,
      extractedData: dbMeta.extracted_data,
      startedAt: dbMeta.started_at,
      lastUpdated: dbMeta.last_updated,
      confidenceScore: dbMeta.confidence_score,
      rejectionReason: dbMeta.rejection_reason,
    };

    return metadata as VerificationMetadata;
  }

  toDatabase(meta: VerificationMetadata): DbVerificationMetadata {
    // Map the corrections array to match the database format
    const corrections = Array.isArray(meta.corrections) ?
      meta.corrections.map((c) => {
        // Convert timestamp to string safely
        const timestamp = String(c.timestamp ?? '');
        
        return {
          id: c.id,
          text: c.text,
          timestamp,
          user_id: c.userId,
        };
      }) : [];

    return {
      verification_status: meta.verification_status,
      original_summary_id: meta.originalSummaryId ?? '',
      current_version_id: meta.currentVersionId ?? '',
      correction_count: meta.correctionCount,
      verified_at: meta.verifiedAt,
      verified_by: meta.verifiedBy,
      corrections,
      extracted_data: meta.extractedData,
      started_at: meta.startedAt,
      last_updated: meta.lastUpdated,
      confidence_score: meta.confidenceScore,
      rejection_reason: meta.rejectionReason,
      patient_id: undefined,
    };
  }
}

/**
 * Mapper for verification item
 */
export class VerificationItemMapper extends BaseEntityMapper<VerificationItem, DbVerificationItem> {
  toDomain(dbItem: DbVerificationItem): VerificationItem {
    // First get the base fields that match VerificationItem interface
    const baseItem: VerificationItem = {
      id: dbItem.id,
      title: dbItem.title,
      description: dbItem.description,
      originalContent: dbItem.original_content ?? dbItem.content ?? '',
      currentContent: dbItem.current_content ?? dbItem.content ?? '',
      isVerified: dbItem.is_verified ?? false,
      isModified: dbItem.is_modified ?? false,
      changeHistory: (dbItem.change_history ?? []).map((history) => ({
        id: history.id,
        content: history.content,
        timestamp: history.timestamp,
        userId: history.user_id,
        reason: history.reason,
      })),
      metadata: dbItem.metadata,
    };

    return baseItem;
  }

  toDatabase(item: VerificationItem & Partial<ExtendedVerificationItem>): DbVerificationItem {
    // Build the basic fields
    const dbItem: DbVerificationItem = {
      id: item.id,
      title: item.title,
      description: item.description,
      original_content: item.originalContent,
      current_content: item.currentContent,
      is_verified: item.isVerified,
      is_modified: item.isModified,
      content: item.currentContent, // For backward compatibility
      metadata: item.metadata,
      // Add extended fields if available
      status: item.status,
      correction: item.correction,
      reason: item.reason,
      user_id: item.verifiedBy,
      verified_at: item.verifiedAt,
      // Map change history if available
      change_history: item.changeHistory?.map((history) => ({
        id: history.id,
        content: history.content,
        timestamp: history.timestamp,
        user_id: history.userId,
        reason: history.reason,
      })),
    };

    return dbItem;
  }
}

/**
 * Mapper for verified document
 */
export class VerifiedDocumentMapper extends BaseEntityMapper<VerifiedDocument, DbVerifiedDocument> {
  private readonly verificationItemMapper = new VerificationItemMapper();
  private readonly verificationMetadataMapper = new VerificationMetadataMapper();

  toDomain(dbDoc: DbVerifiedDocument): VerifiedDocument {
    const doc: Partial<VerifiedDocument> = {
      id: dbDoc.id,
      originalDocumentId: dbDoc.original_document_id,
      verifiedBy: dbDoc.verified_by,
      verifiedAt: dbDoc.verified_at,
      verificationItems: this.verificationItemMapper.toDomainList(dbDoc.verification_items),
      verificationStatus: dbDoc.verification_status as VerificationStatus,
      verificationMetadata: this.verificationMetadataMapper.toDomain(dbDoc.verification_metadata),
      documentType: documentTypeMapper.toDomain(dbDoc.document_type),
      patientId: dbDoc.patient_id,
      verifiedData: dbDoc.verified_data,
      createdAt: dbDoc.created_at,
      updatedAt: dbDoc.updated_at,
    };

    return doc as VerifiedDocument;
  }

  toDatabase(doc: VerifiedDocument): DbVerifiedDocument {
    return {
      id: doc.id,
      original_document_id: doc.originalDocumentId,
      verified_by: doc.verifiedBy,
      verified_at: doc.verifiedAt,
      verification_items: this.verificationItemMapper.toDatabaseList(doc.verificationItems),
      verification_status: doc.verificationStatus,
      verification_metadata: this.verificationMetadataMapper.toDatabase(doc.verificationMetadata),
      document_type: documentTypeMapper.toDatabase(doc.documentType),
      patient_id: doc.patientId,
      verified_data: doc.verifiedData,
      created_at: doc.createdAt,
      updated_at: doc.updatedAt,
    };
  }
}

// Export singleton instances for convenience
export const verificationStatusMapper = new VerificationStatusMapper();
export const verificationMetadataMapper = new VerificationMetadataMapper();
export const verificationItemMapper = new VerificationItemMapper();
export const verifiedDocumentMapper = new VerifiedDocumentMapper();