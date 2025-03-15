# Phase 2 - Domain Logic Extraction Plan
## Workflow Coordinator Refactoring

### Methods to Refactor
1. **processDocumentFlow** - Move business logic to documentService
2. **processChatIntent** - Move business logic to chatService
3. **uploadDocument** - Move business logic to documentService
4. **extractDocument** - Move business logic to documentService
5. **verifyDocument** - Move business logic to verificationService
6. **completeVerification** - Move business logic to verificationService
7. **processVerificationCorrection** - Move business logic to verificationService
8. **generateReport** - Move business logic to reportService
9. **completeWorkflow** - Keep (this is workflow coordination)

### Event Handlers to Refactor
1. **handleDocumentProcessed** - Move business logic to documentService
2. **handleVerificationCompleted** - Move business logic to verificationService
3. **handleResearchCompleted** - Move business logic to researchService
4. **handleReportGenerated** - Move business logic to reportService

## Verification Workflow Refactoring

1. **completeVerification** - Remove direct reportService import (lines 400-407)
   - Pass reportId generation to verification service

## Chat Intent Parser Refactoring

1. Move file from workflow/coordination to services/chat directory
2. Update imports accordingly

## Implementation Approach

1. Start with moving chat-intent-parser as it's a clean self-contained move
2. Next tackle verification-workflow's business logic leak
3. Finally address workflow-coordinator methods by creating new service methods
