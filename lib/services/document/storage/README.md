# Document Storage Services

This directory contains modular services for document storage, designed to work with LangGraph.js. Each service is focused on a specific aspect of storage functionality, ensuring clear separation of concerns and making them more composable and maintainable.

## Services Overview

### Document Database Service

`DocumentDatabaseService` handles core database operations for document storage. It provides direct access to the database without business logic, focusing on CRUD operations.

```typescript
import { DocumentDatabaseService } from '@/lib/services/document/storage'

const dbService = new DocumentDatabaseService()
const documentId = await dbService.insertDocument(documentRecord)
const document = await dbService.getDocumentById(documentId)
const documents = await dbService.getDocumentsByPatientId(patientId, { 
  limit: 10, 
  sortBy: 'created_at',
  sortDirection: 'desc' 
})
```

### Document Metadata Service

`DocumentMetadataService` focuses on preparing, validating, and handling document metadata. It validates categories, generates titles, and prepares metadata for storage.

```typescript
import { DocumentMetadataService } from '@/lib/services/document/storage'

const metadataService = new DocumentMetadataService()
const validCategory = metadataService.validateDocumentCategory(documentType.category)
const title = metadataService.generateDocumentTitle(documentType, existingTitle)
const metadata = metadataService.prepareDocumentMetadata(extractedDocument, departmentId)
```

### Document Formatter Service

`DocumentFormatterService` handles formatting and conversion of document content and types. It generates document summaries and converts raw database documents to typed documents.

```typescript
import { DocumentFormatterService } from '@/lib/services/document/storage'

const formatterService = new DocumentFormatterService()
const summary = formatterService.generateContentSummary(documentText)
const typedDocument = formatterService.convertToTypedDocument(document)
const typedDocuments = formatterService.convertBatchToTypedDocuments(documents)
```

### Document Status Service

`DocumentStatusService` manages document status updates and tracking. It provides a focused API for updating and retrieving document statuses.

```typescript
import { DocumentStatusService } from '@/lib/services/document/storage'

const statusService = new DocumentStatusService()
await statusService.updateDocumentStatus(documentId, 'processing')
await statusService.updateDocumentStatus(documentId, 'completed', { 
  isProcessed: true,
  metadata: { processedBy: 'system' }
})
const currentStatus = await statusService.getDocumentStatus(documentId)
```

## Utility Types and Error Classes

- `types.ts` - Contains type definitions for document status, query options, etc.
- `errors.ts` - Defines error classes for different storage operations

## Usage with LangGraph.js

These services are designed to be used with LangGraph.js nodes. They contain no workflow orchestration logic, progress tracking, or event emission, focusing solely on their core storage responsibilities.

Example integration with a LangGraph.js node:

```typescript
import { DocumentFormatterService, DocumentDatabaseService } from '@/lib/services/document/storage'
import type { WorkflowState } from '@/workflow/state/workflow-state'

const dbService = new DocumentDatabaseService()
const formatterService = new DocumentFormatterService()

export const documentRetrievalNode = async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
  try {
    const document = await dbService.getDocumentById(state.documentId)
    
    if (!document) {
      return {
        error: 'Document not found'
      }
    }
    
    const typedDocument = formatterService.convertToTypedDocument(document)
    
    return {
      document: typedDocument,
      documentContent: typedDocument.content_text,
      documentMetadata: typedDocument.metadata
    }
  } catch (error) {
    throw new Error(`Document retrieval failed: ${error.message}`)
  }
}
```

## Legacy Compatibility

The old monolithic `DocumentStorageService` has been preserved as a compatibility layer that delegates to these new modular services. It's marked as deprecated and should be replaced with direct use of the modular services.