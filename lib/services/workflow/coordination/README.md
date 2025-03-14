# Workflow Coordination System

## Overview

The Workflow Coordination System provides a robust mechanism for orchestrating multi-step, cross-domain workflows in the Neuvia application. It's designed to maintain clear separation of concerns while enabling complex business processes to be executed reliably.

## Key Design Principles

1. **Separation of Concerns**
   - Domain modules focus on single-step logic
   - Coordination layer handles workflow sequencing and transitions
   - Intent parsing is delegated to specialized components

2. **Intent-Driven Architecture**
   - Workflows progress based on outcomes and explicit next actions
   - No boolean flags for auto-chaining (autoVerify, autoGenerateReport)
   - Actions are determined by processing outcomes

3. **Explicit State Transitions**
   - Each workflow step returns its outcome and suggested next actions
   - The coordinator decides whether to execute the next step
   - No implicit chaining between domain modules

## Key Components

### WorkflowCoordinator

The central orchestration component that:
- Routes requests to domain-specific modules
- Receives outcomes and processes next actions
- Handles cross-domain transitions
- Manages progress tracking and error recovery

```typescript
// New intent-driven approach
const result = await workflowCoordinator.processDocumentFlow(
  workflowId,
  file,
  {
    userId: 'user123',
    patientId: 'patient456'
  }
);
```

### ChatIntentParser

A dedicated component for parsing user messages into structured intents:
- Extracts corrections from natural language
- Identifies confirmation/rejection patterns
- Determines research queries
- Provides confidence scores for intents

```typescript
const intent = chatIntentParser.parseIntent(
  "The patient name should be John Doe and the date is incorrect",
  "verification_in_progress"
);
```

### Domain Workflow Modules

Each domain module focuses on a specific aspect of the workflow:
- **DocumentWorkflow**: Handles uploads and content extraction
- **VerificationWorkflow**: Manages data verification and correction
- **ReportWorkflow**: Handles report generation and formatting
- **ResearchWorkflow**: Manages research queries and responses

## Intent-Based Flow Control

Rather than using boolean flags for auto-progression (which leads to complex interdependencies), the new system uses explicit intents:

```typescript
// Old approach with boolean flags (AVOID)
await documentWorkflow.processUpload(workflowId, file, {
  autoExtract: true,
  autoVerify: true,
  autoGenerateReport: true
});

// New approach with explicit outcomes (RECOMMENDED)
const uploadResult = await workflowCoordinator.uploadDocument(workflowId, file, options);
if (uploadResult.nextAction === WorkflowNextAction.EXTRACT_DOCUMENT) {
  const extractResult = await workflowCoordinator.extractDocument(
    workflowId, 
    uploadResult.data.documentId, 
    options
  );
}
```

## Chat Integration

The system handles user inputs through chat by:
1. Parsing messages to detect intents (confirm, correct, etc.)
2. Mapping intents to appropriate workflow actions
3. Generating confirmation/guidance messages to the user

```typescript
// Parse chat message and take appropriate action
const intent = await workflowCoordinator.processChatIntent(
  workflowId,
  chatId,
  "The patient name is incorrect, it should be John Smith",
  { userId: 'user123' }
);

// Handle the intent result
if (intent.nextAction === WorkflowNextAction.NONE) {
  // Stay in current workflow state
} else if (intent.nextAction === WorkflowNextAction.GENERATE_REPORT) {
  // Proceed to report generation
}
```

## Migrating to Intent-Driven Flows

### Step 1: Use Individual Domain Actions
Instead of calling domain methods directly with boolean flags, use the coordinator's individual methods:
```typescript
// Before
await documentWorkflow.processUpload(workflowId, file, {
  autoExtract: true
});

// After
await workflowCoordinator.uploadDocument(workflowId, file, options);
```

### Step 2: Enable Flow Coordination Flag
For complete end-to-end processing, use the flow coordination flag:
```typescript
const result = await workflowCoordinator.processDocumentToCompletion(
  workflowId,
  file,
  {
    userId: 'user123',
    useFlowCoordination: true // Enable new approach
  }
);
```

### Step 3: Process Chat Intents
For chat workflows, use the intent parsing system:
```typescript
// Get structured intent from user message
const intentResult = await workflowCoordinator.processChatIntent(
  workflowId,
  chatId,
  userMessage,
  { userId: 'user123' }
);

// Handle structured intent
if (intentResult.nextAction === WorkflowNextAction.GENERATE_REPORT) {
  await workflowCoordinator.generateReport(workflowId, {
    userId: 'user123',
    documentId: intentResult.data.documentId
  });
}
```