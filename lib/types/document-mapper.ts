/**
 * @fileoverview Mapper for converting between domain document entities and database representations.
 */
import { BaseEntityMapper } from './mapper-base';
import type {
  Document,
  DocumentType,
  DocumentMetadata,
  ExtractedDocument,
  DocumentChunk,
  DocumentLifecycleStage,
 DocumentProcessingStatus } from './document';
import type {
  DbDocument,
  DbDocumentType,
  DbExtractedDocument,
  DbDocumentChunk,
} from './db-adapters';

/**
 * Mapper for document type conversions
 */
export class DocumentTypeMapper extends BaseEntityMapper<DocumentType, DbDocumentType> {
  /**
   * Convert document type from database to domain format
   */
  toDomain(dbDocType: DbDocumentType): DocumentType {
    return {
      category: dbDocType.category as DocumentType['category'],
      type: dbDocType.type,
      subtype: dbDocType.subtype,
      metadata: dbDocType.metadata,
    };
  }

  /**
   * Convert document type from domain to database format
   */
  toDatabase(docType: DocumentType): DbDocumentType {
    return {
      category: docType.category,
      type: docType.type,
      subtype: docType.subtype,
      metadata: docType.metadata,
    };
  }
}

/**
 * Mapper for document entity conversions
 */
export class DocumentMapper extends BaseEntityMapper<Document, DbDocument> {
  private readonly documentTypeMapper = new DocumentTypeMapper();

  /**
   * Convert document from database to domain format
   */
  toDomain(dbDoc: DbDocument): Document {
    return {
      id: dbDoc.id,
      createdAt: dbDoc.created_at,
      updatedAt: dbDoc.updated_at,
      fileName: dbDoc.file_name,
      fileSize: dbDoc.file_size,
      fileType: dbDoc.file_type,
      documentType: this.documentTypeMapper.toDomain(dbDoc.document_type),
      lifecycleStage: dbDoc.lifecycle_stage as DocumentLifecycleStage,
      patientId: dbDoc.patient_id,
      departmentId: dbDoc.department_id,
      metadata: dbDoc.metadata,
    };
  }

  /**
   * Convert document from domain to database format
   */
  toDatabase(doc: Document): DbDocument {
    return {
      id: doc.id,
      created_at: doc.createdAt,
      updated_at: doc.updatedAt,
      file_name: doc.fileName,
      file_size: doc.fileSize,
      file_type: doc.fileType,
      document_type: this.documentTypeMapper.toDatabase(doc.documentType),
      lifecycle_stage: doc.lifecycleStage,
      patient_id: doc.patientId,
      department_id: doc.departmentId,
      metadata: doc.metadata,
    };
  }
}

/**
 * Mapper for extracted document entity conversions
 */
export class ExtractedDocumentMapper extends BaseEntityMapper<ExtractedDocument, DbExtractedDocument> {
  private readonly documentMapper = new DocumentMapper();
  private readonly documentTypeMapper = new DocumentTypeMapper();

  /**
   * Convert extracted document from database to domain format
   */
  toDomain(dbDoc: DbExtractedDocument): ExtractedDocument {
    // Create a DbDocument from DbExtractedDocument to pass to documentMapper
    const dbDocBase: DbDocument = {
      id: dbDoc.id,
      created_at: dbDoc.created_at,
      updated_at: dbDoc.updated_at,
      file_name: dbDoc.file_name,
      file_size: dbDoc.file_size,
      file_type: dbDoc.file_type,
      document_type: dbDoc.document_type,
      lifecycle_stage: dbDoc.lifecycle_stage,
      patient_id: dbDoc.patient_id,
      department_id: dbDoc.department_id,
      metadata: {},
    };
    
    const baseDoc = this.documentMapper.toDomain(dbDocBase);

    return {
      ...baseDoc,
      extractedData: {
        rawText: dbDoc.extracted_data.raw_text,
        metadata: dbDoc.extracted_data.metadata as DocumentMetadata,
        chunks: dbDoc.extracted_data.chunks?.map((chunk) => ({
          content: chunk.content,
          pageNumber: chunk.page_number,
          metadata: chunk.metadata,
        })),
      },
      isProcessed: dbDoc.is_processed,
      processingError: dbDoc.processing_error,
      processingStatus: dbDoc.processing_status as DocumentProcessingStatus,
      confidence: dbDoc.confidence,
    };
  }

  /**
   * Convert extracted document from domain to database format
   */
  toDatabase(doc: ExtractedDocument): DbExtractedDocument {
    const baseDoc = this.documentMapper.toDatabase(doc);

    return {
      ...baseDoc,
      document_type: this.documentTypeMapper.toDatabase(doc.documentType),
      extracted_data: {
        raw_text: doc.extractedData.rawText,
        metadata: doc.extractedData.metadata as Record<string, unknown>,
        chunks: doc.extractedData.chunks?.map((chunk) => ({
          content: chunk.content,
          page_number: chunk.pageNumber,
          metadata: chunk.metadata,
        })),
      },
      is_processed: doc.isProcessed,
      processing_error: doc.processingError,
      processing_status: doc.processingStatus,
      confidence: doc.confidence,
    };
  }
}

/**
 * Mapper for document chunk entity conversions
 */
export class DocumentChunkMapper extends BaseEntityMapper<DocumentChunk, DbDocumentChunk> {
  /**
   * Convert document chunk from database to domain format
   */
  toDomain(dbChunk: DbDocumentChunk): DocumentChunk {
    return {
      id: dbChunk.id,
      documentId: dbChunk.document_id,
      content: dbChunk.content,
      chunkIndex: dbChunk.chunk_index,
      pageNumber: dbChunk.page_number,
      tokenCount: dbChunk.token_count,
      metadata: dbChunk.metadata,
      heading: dbChunk.heading,
      importanceScore: dbChunk.importance_score,
    };
  }

  /**
   * Convert document chunk from domain to database format
   */
  toDatabase(chunk: DocumentChunk): DbDocumentChunk {
    return {
      id: chunk.id,
      document_id: chunk.documentId,
      content: chunk.content,
      chunk_index: chunk.chunkIndex,
      page_number: chunk.pageNumber,
      token_count: chunk.tokenCount,
      metadata: chunk.metadata,
      heading: chunk.heading,
      importance_score: chunk.importanceScore,
    };
  }
}

// Export singleton instances for convenience
export const documentTypeMapper = new DocumentTypeMapper();
export const documentMapper = new DocumentMapper();
export const extractedDocumentMapper = new ExtractedDocumentMapper();
export const documentChunkMapper = new DocumentChunkMapper();