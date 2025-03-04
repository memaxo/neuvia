# TypeScript Style Guide

## Naming Conventions

### Types and Interfaces
- Use **PascalCase** for interfaces, types, classes, and enums
- Use **camelCase** for properties, methods, and variables
- Use **UPPERCASE** for enum values

```typescript
// Good examples
interface DocumentType { ... }
type ProcessingStatus = { ... }
enum WorkflowStep { IDLE = 'idle', PROCESSING = 'processing' }

// Bad examples
interface documentType { ... }
type processing_status = { ... }
enum workflowStep { idle = 'idle', processing = 'processing' }
```

### File Organization
- Use domain-driven organization
- Place canonical type definitions in `/lib/types/{domain}.ts`
- Place Zod schemas in `/lib/schemas/{domain}.ts`
- Use barrel exports in `/lib/types/index.ts`

### Naming Patterns
- Use `{Domain}Type` for main domain objects (e.g., `DocumentType`)
- Use `{Domain}Schema` for Zod schemas (e.g., `DocumentTypeSchema`)
- Use `Base{Domain}` for abstract base types (e.g., `BaseEntity`)
- Use `Db{Domain}` for database representations (e.g., `DbDocument`)
- Use `is{Type}` for type guards (e.g., `isDocumentType`)
- Use `to{Type}` for type converters (e.g., `toDocument`)

## Type Safety

### Avoid Any
Avoid using `any` type - use `unknown` with type guards instead:

```typescript
// Bad
function processData(data: any): any {
  return data.someProperty;
}

// Good
function processData(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'someProperty' in data) {
    return String(data.someProperty);
  }
  throw new Error('Invalid data format');
}
```

### Use Discriminated Unions
Use discriminated unions for type safety:

```typescript
// Bad
type Message = {
  type?: string;
  content?: string;
  error?: string;
};

// Good
type TextMessage = {
  type: 'text';
  content: string;
};

type ErrorMessage = {
  type: 'error';
  error: string;
};

type Message = TextMessage | ErrorMessage;
```

### Type Guards
Use consistent type guard patterns:

```typescript
// For simple checks
function isTextMessage(message: Message): message is TextMessage {
  return message.type === 'text';
}

// For complex types, use factory pattern
function createTypeGuard<T extends { type: string }>(type: string) {
  return (value: any): value is T => value?.type === type;
}

const isErrorMessage = createTypeGuard<ErrorMessage>('error');
```

## Documentation

### JSDoc Comments
Add JSDoc comments to all exported types and interfaces:

```typescript
/**
 * Represents a document type in the system
 * @property category - The category of the document
 * @property type - The specific document type
 * @property subtype - Optional subtype for further classification
 */
export interface DocumentType {
  category: string;
  type: string;
  subtype?: string;
}
```

### Examples in Documentation
Include examples in JSDoc for complex types:

```typescript
/**
 * Configuration options for document processing
 * @example
 * ```ts
 * const options: ProcessingOptions = {
 *   extractText: true,
 *   detectLanguage: true,
 *   confidenceThreshold: 0.8
 * };
 * ```
 */
export interface ProcessingOptions {
  // ...
}
```

## Import/Export Patterns

### Canonical Imports
Import types from their canonical source:

```typescript
// Good
import { DocumentType } from '@/lib/types/document';

// Bad
import { DocumentType } from '@/lib/processing/types/document';
```

### Re-exports
Use barrel exports for domain-specific types:

```typescript
// /lib/types/index.ts
export * from './document';
export * from './workflow';
export * from './verification';
```

### Grouped Imports
Group imports by source:

```typescript
// External imports first
import { z } from 'zod';

// Absolute imports from project
import { BaseEntity } from '@/lib/supabase/types';
import { WorkflowStep } from '@/lib/types/workflow';

// Relative imports last
import { processDocument } from './processor';
```

## Schema Validation

### Zod Schemas
Define Zod schemas for runtime validation:

```typescript
export const DocumentTypeSchema = z.object({
  category: z.string(),
  type: z.string(),
  subtype: z.string().optional(),
});

export type DocumentType = z.infer<typeof DocumentTypeSchema>;
```

### Validation Functions
Create consistent validation helper functions:

```typescript
export function validateDocumentType(data: unknown): DocumentType {
  return DocumentTypeSchema.parse(data);
}

export function parseDocumentType(data: unknown): 
  { success: true; data: DocumentType } | 
  { success: false; error: z.ZodError } {
  return DocumentTypeSchema.safeParse(data);
}
```

## Database Integration

### Database Type Adapters
Create adapters between database and application types:

```typescript
export interface DbDocument {
  id: string;
  created_at: string;
  document_type: string;
  // ...snake_case fields
}

export interface Document {
  id: string;
  createdAt: string;
  documentType: string;
  // ...camelCase fields
}

export function toDocument(dbDoc: DbDocument): Document {
  return {
    id: dbDoc.id,
    createdAt: dbDoc.created_at,
    documentType: dbDoc.document_type,
    // ...convert other fields
  };
}
```

## Deprecation Strategy

### Marking Deprecated Types
Use JSDoc tags for deprecation:

```typescript
/**
 * @deprecated Use DocumentType from '@/lib/types/document' instead
 */
export interface LegacyDocumentType {
  // ...
}
```

### Migration Path
Provide clear migration path in comments:

```typescript
/**
 * @deprecated Use WorkflowStep from '@/lib/types/workflow' instead
 * Migration path:
 * 1. Import from new location
 * 2. Replace any string literals with enum values
 * 3. Update type guards if needed
 */
export type MessageType = string;
```