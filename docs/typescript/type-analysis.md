# TypeScript Type System Analysis

## Core Type Areas and Relationships

### Database/Supabase Types
**Primary File:** `/lib/supabase/types.ts`
- **Key Types:** `TypedSupabaseClient`, `Database`, `Tables<T>`, `TableRow<T>`, `TableInsert<T>`, `TableUpdate<T>`
- **Base Types:** `UUID`, `Timestamp`, `BaseEntity`, `OwnedEntity`
- **Enums:** `DocumentCategory`, `DbWorkflowStep`, `AccessLevel`, `MedicalRole`, `PatientStatus`, `Continent`
- **Utility Functions:** `toDate()`, `toISOString()`

**Relationships:**
- Acts as the foundation for database-related types throughout the application
- Exports database table types, enums, and helper utilities
- Defines common types like `UUID` and `Timestamp` used across the codebase

### Document Types
**Primary Files:** 
- `/lib/types/document.ts`
- `/lib/processing/types/document.ts`
- `/lib/processing/types/extraction.ts`
- `/lib/schemas/document-types.ts`

**Key Types:**
- `DocumentType`, `DocumentMetadata`, `DocumentChunkType`, `ExtractedDocument`
- `PatientDocument`, `PatientDocumentInsert`, `DocumentChunk`, `DocumentChunkInsert`
- `DocumentLifecycleStage`, `ProcessingStatus`, `ExtractedData`

**Relationships:**
- Imports database types from `@/lib/supabase/types`
- Imports workflow types from `@/lib/workflow/types`
- Defines comprehensive document-related types with Zod schemas for validation
- Has some deprecated workflow types that reference `@/lib/workflow/types`

### Workflow Types
**Primary File:** `/lib/workflow/types.ts`

**Key Types:**
- `WorkflowStep`, `WorkflowTransition`, `ProcessingPhase`, `WorkflowState`
- `VerificationStatusType`, `CorrectionEntry`, `VerificationMetadata`, `MessageMetadata`
- `WorkflowOptions`, `VerificationWorkflowOptions`

**Key Features:**
- Defines state machine transitions with `ALLOWED_TRANSITIONS`
- Type guard utilities for message types and verification status
- Defines canonical message metadata structure
- Legacy support through type aliases and compatibility functions

**Relationships:**
- Imports base types from `@/lib/supabase/types`
- Referenced by document, verification, chat, and API types
- Core types for the application's state management

### Verification Types
**Primary File:** `/lib/processing/types/verification/index.ts`

**Key Types:**
- `VerificationItem`, `VerificationStatus`, `VersionHistoryEntry`
- `VerificationOptions`, `VerificationResult`, `VerificationMessage`
- `BaseVerifiedDocument`, `VerifiedDocument`

**Relationships:**
- Imports from `@/lib/supabase/types` for base types
- Imports from `@/lib/workflow/types` for canonical workflow types
- Imports from `@/lib/processing/types/base` and `@/lib/processing/types/extraction`
- Contains numerous helpers for consistent verification operations

### Chat Types
**Primary File:** `/lib/chat/types.ts`

**Key Types:**
- `ChatMessage`, `ChatMessageType` (enum), `MessageType` (legacy)
- `ChatSessionState`, `ChatContextMethods`, `ChatContextValue`
- `ExtendedChatContextType`, `VerificationState`, `WorkflowState`
- `ChatState`, `ChatAction`

**Key Features:**
- Type guards for message types with factory function
- Message creation utilities
- Exhaustive workflow step constants
- Comprehensive state management types

**Relationships:**
- Imports types from AI SDK (`Message as AIMessage`)
- Re-exports and aliases workflow types
- Imports from verification types
- Imports hooks and store types

### API Types
**Primary File:** `/lib/api/types.ts`

**Key Types:**
- `ApiRequest<TBody>`, `ApiResponse<TData>`, `ApiErrorResponse`
- Namespaces: `VerificationApi`, `ResearchApi`, `EmailApi`, `SecurityApi`, `AuthApi`

**Key Features:**
- Standardized request/response types
- Namespace organization for API domains
- Type-safe request/response definitions

**Relationships:**
- Imports document types from `@/lib/schemas/document-types`
- Imports verification types from `@/lib/processing/types/verification`
- Imports chat types from `@/lib/chat/types`

## Inheritance and Dependency Relationships

### Key Inheritance Relationships:
1. **Base Entity Hierarchy**:
   - `BaseEntity` → `OwnedEntity` (in supabase/types.ts)

2. **Document Type Hierarchy**:
   - `DocumentBase` → `ExtractedDocument`
   - `DocumentBase` → `ReportDocument`
   - `DocumentBase` → `ResearchDocument`

3. **Message Type Evolution**:
   - `AIMessage` → `ChatMessage` (extends AI SDK type)

4. **Type Extension Patterns**:
   - `WorkflowStep` extends `DbWorkflowStep` from database
   - `VerificationOptions` extends `BaseVerificationOptions`
   - `WorkflowResult` → `ExtendedWorkflowResult`

### Key Dependency Relationships:
1. **Type Foundation**:
   - `supabase/types.ts` → provides base types (`UUID`, `Timestamp`, etc.)
   - `workflow/types.ts` → provides core workflow types

2. **Cross-Domain Dependencies**:
   - Verification depends on Workflow
   - Chat depends on Workflow and Verification
   - API depends on domain-specific types
   - Document types depend on Workflow types

## Overlapping/Duplicated Type Definitions

1. **ProcessingStatus Type Duplication**:
   - Defined in `/lib/types/document.ts` (line 406)
   - Similar definition in `/lib/chat/types.ts` (line 812)
   - Should be consolidated into a single source of truth

2. **Multiple Document Type Definitions**:
   - Split between `/lib/types/document.ts` and `/lib/processing/types/document.ts`
   - Also appears in `/lib/schemas/document-types.ts`
   - Should be consolidated

3. **Workflow Type Duplication**:
   - `WorkflowStep` appears in both workflow/types.ts and verification/index.ts (line 588)
   - Verification file has a deprecated duplicate that should be removed

4. **Date/Time Handling Utilities**:
   - `toDate()` and `toISOString()` in supabase/types.ts
   - Similar functions in verification/index.ts: `dateToISOString()`, `isoStringToDate()`
   - These should be consolidated

5. **MessageType Definitions**:
   - Both a type and an enum (`ChatMessageType`) exist in chat/types.ts
   - Legacy type marked as deprecated, but still used

## Inconsistent Naming Patterns

1. **Casing Inconsistencies**:
   - Most types use PascalCase
   - Some constants use UPPER_SNAKE_CASE
   - Some database-derived types don't follow consistent patterns

2. **Prefix/Suffix Patterns**:
   - Inconsistent use of `Base` prefix: `BaseEntity`, `BaseVerificationItem`, `DocumentBase`
   - Inconsistent use of type suffixes: `Type` vs no suffix

3. **Module Naming**:
   - Different patterns for module organization:
     - `/lib/types/{domain}.ts`
     - `/lib/processing/types/{domain}.ts`
     - `/lib/{domain}/types.ts`

4. **Interface vs Type Aliases**:
   - Inconsistent use of `interface` vs `type` for similar concepts
   - Some files predominantly use one over the other

## Type Safety Concerns

1. **Excessive use of `any` in critical interfaces**:
   - `/lib/workflow/types.ts` has `MessageMetadata` with index signature `[key: string]: any`
   - `/lib/processing/types/verification/index.ts` uses `Record<string, any>` in multiple places
   - `/lib/types/document.ts` has `metadata: z.record(z.any()).optional()`

2. **Deprecated but not yet replaced types**:
   - `/lib/processing/types/verification/index.ts` has many deprecated types still in use
   - `/lib/chat/types.ts` has `Message` interface marked as deprecated but still referenced

3. **Inconsistent type guards**:
   - `/lib/chat/types.ts` has overlapping type guard functions with different implementations:
     - `isMessageOfType`
     - `createMessageTypeGuard`
     - Direct boolean property checks