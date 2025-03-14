# Namespaced Metadata Structure

This document explains the namespaced metadata structure implemented for workflow state management. 

## Motivation

Previously, the workflow metadata was stored as a flat structure in a single JSONB field, which caused several issues:

1. **Name collisions**: Different domains could use the same field names for different purposes
2. **Large data**: Some fields like `extractedText` or `reportContent` would grow to multiple kilobytes
3. **Concurrency conflicts**: When merging updates, it was difficult to tell which fields belonged to which domain
4. **Debugging challenges**: Looking at a large, flat metadata object made it hard to identify ownership

## New Approach

The new approach uses:

1. **Namespaced fields**: Each domain has its own namespace (e.g., `metadata.verification.data.status`)
2. **Separate storage**: Large fields are stored in separate tables with references in metadata
3. **Versioning**: Each domain metadata section includes a version number for conflict detection

## Namespaced Structure

```typescript
interface NamespacedMetadata {
  // Common workflow fields
  workflow?: {
    progress?: number;
    phase?: string;
    error?: string | null;
    errorDetails?: Record<string, unknown>;
  };
  
  // Domain-specific namespaces
  verification?: VerificationMetadata;
  document?: DocumentMetadata;
  chat?: ChatMetadata;
  report?: ReportMetadata;
  research?: ResearchMetadata;
  
  // Extension point for future domains
  [key: string]: unknown;
}
```

Each domain has a consistent structure:

```typescript
interface CommonMetadata {
  // Metadata schema version for backward compatibility
  version: number;
  
  // Last update timestamp
  updatedAt?: string;
  
  // Transaction ID for tracking operations
  transactionId?: string;
}

interface DomainMetadata extends CommonMetadata {
  // Domain-specific data (smaller fields)
  data?: {
    // Domain-specific fields...
  };
  
  // References to separately stored large fields
  contentId?: string; // Points to a record in a separate table
}
```

## Separate Storage Tables

Large fields are stored in domain-specific tables:

- `document_extractions`: For document extracted text and analysis
- `chat_extractions`: For chat messages and extracted content
- `report_contents`: For report content with versioning
- `research_results`: For research results and citations

These tables have columns for:
- `id`: Primary key
- `workflow_id`: Reference to workflow state
- `field_name`: Which field this stores (e.g., "extractedText")
- `content`: The actual large content
- `metadata`: Additional metadata about this field
- Timestamps and indexes

## Migration Strategy

The system automatically migrates legacy metadata to the namespaced format on-the-fly when accessed. This provides backward compatibility while gradually transitioning to the new structure.

## Helper Functions

Several helper functions make working with namespaced metadata easier:

- `getDomainMetadata(metadata, domain)`: Get metadata for a specific domain
- `updateDomainMetadata(metadata, domain, newData)`: Update domain metadata preserving version
- `migrateToNamespacedMetadata(legacyMetadata, domain)`: Convert legacy format to namespaced

## Using in Domain Workflow Processors

When implementing a domain workflow processor, use these patterns:

### Reading Metadata

```typescript
// Old approach
const status = await this.getDomainMetadata(workflowId, 'status');

// New approach - looks in domain namespace automatically
const status = await this.getDomainMetadata(workflowId, 'status');

// Getting full domain metadata object
const verificationData = await this.getAllDomainMetadata(workflowId);
```

### Writing Metadata

```typescript
// Old approach
await this.updateMetadataSafely(workflowId, {
  verificationData: { status: 'completed', correctionCount: 2 }
});

// New approach - automatically goes into domain namespace
await this.updateMetadataSafely(workflowId, {
  status: 'completed',
  correctionCount: 2
});
```

For large fields, the processor automatically detects fields that should be stored separately based on the domain concurrency configuration and handles the storage automatically.

## Benefits

- **Cleaner code**: Domain-specific code only needs to know about its own fields
- **Easier debugging**: Looking at the metadata JSON clearly shows which domain owns what
- **Better concurrency**: Each domain can update its section without interfering with others
- **Improved performance**: Large fields are stored separately, reducing DB load
- **Versioning support**: Each domain tracks its own version for conflict detection