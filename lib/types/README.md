# Neuvia Type System

This directory contains the canonical type definitions for the Neuvia application. All types should be imported from these files to ensure consistency across the application.

## Core Type Files

- `base.ts` - Core utility types like `UUID`, `Timestamp`, and base entities
- `document.ts` - Document-related types 
- `workflow.ts` - Workflow and state management types
- `verification.ts` - Verification-related types
- `chat.ts` - Chat and message types
- `report.ts` - Report generation types
- `api.ts` - API request/response types
- `index.ts` - Barrel exports for all types

## Import Pattern

Import types from the barrel file for ease of use:

```typescript
import { UUID, DocumentType, WorkflowStep } from '@/lib/types';
```

For specific imports that aren't in the barrel file:

```typescript
import { SomeSpecificType } from '@/lib/types/specific-file';
```

## Type Naming Conventions

- Use **PascalCase** for interfaces, types, and enums
- Use **UPPERCASE** for enum values
- Use **camelCase** for properties, parameters, and functions
- Add proper JSDoc comments to all exported types

## Contributing

When adding new types:
1. Place them in the appropriate file based on domain
2. Follow the naming and documentation conventions
3. Add exports to the barrel file if they should be publicly available
4. Use existing types like `UUID` and `Timestamp` for consistency

See the full TypeScript style guide in `/docs/typescript/style-guide.md`.