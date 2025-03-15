# Phase 3 Migration Plan

## Files to Remove

These files contain duplicated logic that exists in service files. Their functionality should be merged into domain service files.

1. `/lib/services/workflow/domain/chat-workflow.ts` - Replace with direct API on chatService
2. `/lib/services/workflow/domain/report-workflow.ts` - Replace with direct API on reportService
3. `/lib/services/workflow/domain/research-workflow.ts` - Replace with direct API on researchService

## Files to Keep but Simplify

1. `/lib/services/workflow/domain/document-workflow.ts` - Keep but simplify
2. `/lib/services/workflow/domain/verification-workflow.ts` - Keep but further simplify

## Workflow Coordinator Refactoring

1. We've already moved the `delegateIntentProcessing` method from workflow coordinator to chat service
2. Need to identify and move additional domain logic

## Implementation Steps

1. Create compatibility layers for files being removed
2. Move specific business logic methods from workflow-coordinator.ts to appropriate services:
   - `processDocumentFlow` → documentService
   - `processChatIntent` → chatService
   - `uploadDocument` → documentService
   - `verifyDocument` → verificationService 
   - `completeVerification` → verificationService
   - `processVerificationCorrection` → verificationService
   - `generateReport` → reportService

3. Simplify any remaining domain workflow files to focus only on state transitions
4. Ensure all event handlers in workflow-coordinator delegate to services instead of containing business logic

## Migration Approach

1. Create compatibility layers first (re-export from new locations)
2. Move one domain of functionality at a time (Chat → Document → Verification → Report)
3. Test after each domain is moved
4. Clean up removed files only after confirming all functionality works through services