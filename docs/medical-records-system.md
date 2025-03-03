# Neuvia Medical Records Analysis System

This document provides a comprehensive overview of the Neuvia medical records analysis system, including its architecture, workflow, components, and user experience.

## System Overview

Neuvia is a specialized medical records analysis system designed to transform raw patient data and documents into formal, structured medical reports through a multi-step AI-powered workflow with human-in-the-loop verification. The system combines advanced document processing, AI extraction, human verification, and report generation into a seamless experience.

### Core Functionality

The system's primary purpose is to:

1. **Process Medical Documents**: Ingest and analyze various medical document formats
2. **Extract Patient Information**: Extract key clinical data using AI
3. **Verify Accuracy**: Enable clinicians to verify and correct extracted information
4. **Generate Reports**: Create standardized medical reports based on verified data
5. **Provide Interactive Analysis**: Allow follow-up questions and exploration of patient data

## System Architecture

### Technical Stack

- **Frontend**: React with Next.js App Router (v15) (`app/` directory)
- **State Management**: Zustand (recently migrated from Context API) (`stores/chat-store.tsx`)
- **Styling**: Tailwind CSS with custom color palette (`tailwind.config.ts`)
- **UI Components**: Shadcn UI component library (`components/ui/`)
- **Database**: Supabase (PostgreSQL) (`lib/supabase/`)
- **AI Services**: 
  - Gemini for document extraction and verification (`lib/processing/`)
  - Perplexity Deep Research API for report generation (`api/perplexity/route.ts`)
- **Storage**: Supabase Storage for document files (`supabase/migrations/20250221104251_storage.sql`)
- **Vector Search**: PostgreSQL with pgvector for similarity search (`supabase/migrations/20250223235905_rag_storage.sql`, `lib/vectorstore/supabase-store.ts`)

### Codebase Structure

The project follows a modular structure organized by feature and functionality:

```
/app                      # Next.js app router pages and routes
  /dashboard              # Main application dashboard
    /chat                 # Chat interface
    /patients             # Patient management
    /reports              # Report management
/components               # Reusable UI components
  /chat                   # Chat-specific components
  /ui                     # Base UI components (Shadcn)
  /upload                 # Document upload components
/lib                      # Utility libraries and core logic
  /actions                # Server actions
  /chat                   # Chat functionality
  /hooks                  # Custom React hooks
  /processing             # Document processing logic
  /services               # Service integrations
  /workflow               # Workflow management
/stores                   # Zustand stores
/supabase                 # Supabase configuration and migrations
```

### Core Components

The system is organized into several key components:

1. **Document Processing Pipeline**
   - Document upload and storage (`components/upload/unified-document-uploader.tsx`)
   - Text extraction and chunking (`lib/services/document/document-service.ts`)
   - Metadata generation (`lib/processing/types/extraction.ts`)
   - Structured data extraction (`stores/chat-store.tsx` - `processDocument()` function)

2. **Verification System**
   - Summary presentation (`components/chat/workflow/verification-ui.tsx`)
   - Correction handling (`stores/chat-store.tsx` - `handleCorrectionMessage()` function)
   - Version tracking (`lib/workflow/types.ts` - `VerificationMetadata` interface)
   - Approval flow (`stores/chat-store.tsx` - `completeVerification()` function)

3. **Report Generation**
   - Clinical data formatting (`lib/services/report/report-service.ts`)
   - Comprehensive research integration (`lib/processing/types/report.ts`)
   - PDF/document generation (`components/chat/workflow/report-panel.tsx`)
   - Metadata inclusion (`stores/chat-store.tsx` - `generateReport()` function)

4. **Chat Interface**
   - Interactive messaging (`app/dashboard/chat/components/chat-interface/index.tsx`)
   - AI-powered responses (`components/chat/message/message.tsx`)
   - Workflow integration (`components/chat/templates/chat-interface.tsx`)
   - Follow-up questioning (`components/chat/input/ChatInput.tsx`)

5. **Workflow Management**
   - State machine for process tracking (`lib/workflow/types.ts` - `WorkflowStep` type)
   - Progress visualization (`components/chat/workflow/workflow-progress-tracker.tsx`)
   - Error handling and recovery (`stores/chat-store.tsx` - `useErrorHandler()` function)
   - Status reporting (`components/chat/workflow/workflow-status-display.tsx`)

## Workflow Process

The medical records analysis follows a defined workflow as implemented in `lib/workflow/types.ts` and `stores/chat-store.tsx`:

### 1. Patient Creation & Document Upload

- A patient record is created or selected in the system (`app/dashboard/patients/create/page.tsx`)
- Clinicians upload patient documents (PDF, images, etc.) via the upload interface (`components/upload/unified-document-uploader.tsx`)
- Documents are securely stored and queued for processing (`lib/services/upload-service.ts`)
- A workflow state is initiated in the database (`stores/chat-store.tsx` → `updateDatabaseWorkflowState()`)

**Code Reference:**
```typescript
// From stores/chat-store.tsx
processDocument: async (file, patientId, documentType, abortSignal) => {
  // Update workflow state to uploading
  get().updateWorkflowStep('uploading', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
  })
  
  // Call the API client to process the document
  const result = await apiClient.documents.processDocument({
    file,
    patientId,
    documentType: docTypeObj?.type || 'clinical',
    documentCategory: docTypeObj?.category || 'clinical',
    onStatusUpdate: onStatusUpdate as any,
  })
}
```

### 2. Document Extraction & Processing

- A loading screen appears showing processing progress (`components/chat/layout/chat-loading.tsx`)
- The Gemini AI service performs:
  - Text extraction from documents (`lib/services/document/document-service.ts`)
  - Document chunking and organization (`lib/processing/types/document.ts`)
  - Entity recognition for medical terms (`lib/processing/types/extraction.ts`)
  - Metadata extraction (dates, providers, etc.) (`api/document-verification/route.ts`)
- Extracted data is structured according to clinical standards (`lib/schemas/document-types.ts`)
- Progress is tracked and displayed to the user (`components/chat/workflow/workflow-progress-tracker.tsx`)

**Workflow Steps:**
- `idle` → `uploading` → `extracting` → `verification`
- Progress updates via `updateMessageProgress()` function

### 3. Verification Interface

- The system transitions to a chat interface when extraction is complete (`app/dashboard/chat/components/chat-interface/index.tsx`)
- A structured patient summary is presented for verification (`components/chat/workflow/verification-ui.tsx`)
- Key clinical data points are highlighted for attention (`components/chat/ui/summary-diff-viewer.tsx`)
- The clinician can:
  - Approve the summary as-is (via "confirm" message)
  - Provide corrections for specific information (`components/chat/input/ChatInput.tsx`)
  - Request complete regeneration if necessary
- Each correction triggers AI-powered reprocessing (`stores/chat-store.tsx` → `handleCorrectionMessage()`)
- Multiple correction rounds are supported until accuracy is achieved (`lib/workflow/types.ts` → `VerificationMetadata.correctionCount`)

**State Transitions:**
```typescript
// From stores/chat-store.tsx
completeVerification: async (isApproved) => {
  set((state) => {
    const verification = state.workflow.data.verification || {}
    const nextStep = isApproved
      ? 'report_generation'
      : state.workflow.currentStep
    
    return {
      verification: {
        ...state.verification,
        isInVerificationMode: false,
        verificationStatus: isApproved ? 'completed' : 'failed',
      },
      workflow: {
        ...state.workflow,
        currentStep: nextStep,
        // ...other state updates
      }
    }
  })
}
```

### 4. Report Generation

- After verification, the system prompts for report generation (`components/chat/workflow/report-panel.tsx`)
- Upon confirmation, the Perplexity Deep Research API processes the verified data (`api/perplexity/route.ts`)
- The system generates a comprehensive medical report including:
  - Patient demographics (`lib/processing/types/report.ts`)
  - Medical history (`lib/services/patient/patient-summary-service.ts`)
  - Current findings (`lib/services/report/report-service.ts`)
  - Recommendations
  - Reference documentation
- Progress is visualized during generation (`stores/chat-store.tsx` → `startReportGeneration()`)

**API Integration:**
```typescript
// From stores/chat-store.tsx
generateReport: async () => {
  // Start report generation in workflow
  get().startReportGeneration()
  
  try {
    // Call the reports API
    const report = await apiClient.reports.generateReport({
      workflowId,
      patientId,
      format: 'pdf',
      includeVerificationData: true,
      detailLevel: 'comprehensive'
    })
    
    // Update workflow state to completion
    get().completeReportGeneration({
      format: report.format || 'pdf',
      content: report.content || 'Generated report content',
      generatedAt: report.generatedAt || new Date().toISOString(),
      reportId: report.id
    })
  } catch (error) {
    // Error handling...
  }
}
```

### 5. Report Presentation & Follow-up

- The completed report is presented in the chat interface (`components/chat/message/message.tsx`)
- Users can request format changes (PDF, markdown, etc.) (`stores/chat-store.tsx` → `formatReport()`)
- Follow-up questions about the report or patient data can be asked (`app/dashboard/chat/components/chat-interface/index.tsx`)
- The complete report is archived in the patient's record (`lib/services/report/report-service.ts`)

## State Management

The application uses Zustand for centralized state management, recently migrated from Context API as seen in `stores/chat-store.tsx`:

```typescript
// Create the Zustand store
export const useChatStore = create<ChatStore>()(
  devtools(
    (set, get) => ({
      // Initial state from chatReducer's initialState
      ...extendedInitialState,
      
      // Actions and mutations
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set((state) => ({ error, isLoading: false })),
      // ... other actions
    }),
    { name: 'chat-store' }
  )
)
```

### Main State Stores

- **Chat Store** (`stores/chat-store.tsx`): Maintains chat history, messages, and interaction state
- **Workflow State** (`lib/workflow/types.ts` → `WorkflowState` interface): Tracks current workflow step, progress, and metadata
- **Document Processing State** (`lib/processing/types/base.ts` → `ProcessingStatus` interface): Manages document processing state and results
- **Verification State** (`lib/workflow/types.ts` → `VerificationMetadata` interface): Handles verification status, corrections, and approvals
- **Report State** (`lib/processing/types/report.ts` → `ReportOptions` interface): Controls report generation and formatting

### State Structure

The root state in the Zustand store includes:

```typescript
// From lib/chat/types.ts
export interface ChatState {
  messages: Message[]
  isLoading: boolean
  error: string | null
  mode: ChatMode
  chatId: string | null
  verification: {
    isInVerificationMode: boolean
    currentSummary: string | null
    summaryVersions: Array<{ id: string; content: string; timestamp: string }>
    verificationStatus: 'pending' | 'in_progress' | 'completed' | 'failed'
    verificationItems: VerificationItem[]
  }
  workflow: {
    currentStep: WorkflowStep
    processingStatus: {
      status: 'idle' | 'processing' | 'success' | 'error'
      progress: number
      phase: ProcessingPhase
    }
    workflowError: string | null
    data: Record<string, unknown>
  }
  reportGeneration?: {
    isComplete: boolean
    format: ReportFormat | null
  }
}
```

### Selector Pattern

Component access to state is optimized using selectors to prevent unnecessary re-renders:

```typescript
// Component example
const messages = useChatStore(state => state.messages)
const isLoading = useChatStore(state => state.isLoading)
const workflowStep = useChatStore(state => state.workflow.currentStep)
```

### Backward Compatibility

The system maintains backward compatibility with Context API through compatibility hooks:

```typescript
// From stores/chat-store.tsx
export function useChatContext(): ExtendedChatContextType {
  const store = useChatStore()
  // Return a compatibility object that matches the old context structure
  return {
    messages: store.messages,
    // ... other properties and methods
  }
}
```

This state management approach provides:
- Consistent application state across components
- Reactive updates to UI based on state changes
- Persistent workflow status during navigation
- Error boundary protection and recovery
- Enhanced DevTools integration for debugging

## Key Interfaces and Components

### Document Upload Interface

- `UnifiedDocumentUploader` (`components/upload/unified-document-uploader.tsx`): Main component for document upload
  ```typescript
  <UnifiedDocumentUploader
    patientId={patientId}
    documentType="clinical"
    documentCategory="patient_record"
    storageContext="chat"
    title=""
    description="Upload a document to begin processing"
    compact={true}
    showWorkflowStatus={true}
    autoVerify={true}
    onError={(error) => { /* error handling */ }}
    onProcessingComplete={(result) => { /* success handling */ }}
  />
  ```
- Progress visualization during upload and processing (`components/ui/progress.tsx`)
- Error handling and retry functionality (`stores/chat-store.tsx` → `useErrorHandler()`)
- Support for multiple document formats (`lib/services/upload-service.ts`)

### Chat Interface Components

- `ChatInterface` (`app/dashboard/chat/components/chat-interface/index.tsx`): Main interactive component
  ```typescript
  // Main container structure
  <div className="flex h-full flex-col">
    {/* Document uploader */}
    <div className="border-b p-4">
      <UnifiedDocumentUploader /* props */ />
    </div>
    
    {/* Workflow status indicator */}
    {workflowStep !== 'idle' && (
      <div className="bg-muted/50 flex items-center gap-2 border-b px-4 py-2">
        <WorkflowIndicator showProgress={true} />
      </div>
    )}
    
    {/* Chat message list */}
    <ChatMessageList
      isLoading={chatState.isLoading}
      messages={chatState.messages}
    />
    
    {/* Message input */}
    <MessageInput
      isDisabled={/* conditions */}
      onSendMessage={handleMessageSubmit}
      placeholder={getDynamicPlaceholder()}
    />
  </div>
  ```
- `ChatMessageList` (`components/chat/message/message-list.tsx`): Display of conversation history
- `ChatInput` (`components/chat/input/ChatInput.tsx`): User input for corrections and questions
- Integration with workflow status indicators (`components/chat/workflow/workflow-indicator.tsx`)

### Verification Components

- `WorkflowStatusDisplay` (`components/chat/workflow/workflow-status-display.tsx`): Context-aware workflow status
  ```typescript
  <WorkflowStatusDisplay
    activeDocument={activeDocument}
    onContinueAction={handleContinueAfterVerification}
    onGenerateReportAction={() => setShowReportPanel(true)}
    onSkipReportAction={handleSkipReport}
    hideWhenIdle={true}
  />
  ```
- `VerificationUI` (`components/chat/workflow/verification-ui.tsx`): Interface for reviewing and correcting data
- `SummaryDiffViewer` (`components/chat/ui/summary-diff-viewer.tsx`): Visual comparison of original and corrected data
- Correction handling through message detection (`stores/chat-store.tsx` → `handleCorrectionMessage()`)

### Report Generation Components

- `ReportGenerationPanel` (`components/chat/workflow/report-panel.tsx`): Options for report creation
  ```typescript
  <ReportGenerationPanel
    isGenerating={/* conditions */}
    onCancel={() => setShowReportPanel(false)}
    onGenerateReport={handleGenerateReport}
    visible={showReportPanel}
  />
  ```
- `ReportDisplay` (`components/document/medical-diagnosis.tsx`): Display of generated reports
- Format selection through API (`lib/services/report/report-service.ts`)
- Download and sharing capabilities (`stores/chat-store.tsx` → `formatReport()`)

### Workflow Visualization Components

- `WorkflowProgressTracker` (`components/chat/workflow/workflow-progress-tracker.tsx`): Visual indication of current workflow stage
  ```typescript
  <WorkflowProgressTracker
    currentStep={workflowStep}
    progress={docProgress}
    showPercentage={true}
    currentPhase={processingPhase}
  />
  ```
- `WorkflowIndicator` (`components/chat/workflow/workflow-indicator.tsx`): Compact progress indicator
- Status messages via system messages (`stores/chat-store.tsx` → `addSystemMessage()`)
- Error state visualization and recovery (`components/ui/alert-dialog.tsx`)

## Error Handling

The system implements robust error handling through the `useErrorHandler` hook in `stores/chat-store.tsx`:

```typescript
// From stores/chat-store.tsx
export function useErrorHandler() {
  const { toast } = useToast()
  const setError = useChatStore((state) => state.setError)
  const updateWorkflowStep = useChatStore((state) => state.updateWorkflowStep)
  const currentStep = useChatStore((state) => state.workflow.currentStep)

  return {
    // Enhanced error handler that preserves workflow transition context
    handleError: (
      error: unknown, 
      fallbackMessage = 'An error occurred',
      options?: {
        step?: string,
        details?: Record<string, any>,
        showToast?: boolean
      }
    ) => {
      // Determine error message from error or fallback
      const errorMsg = error instanceof Error ? error.message : String(error || fallbackMessage)
      
      // Detect if this is a network error for better user feedback
      const isNetworkError = ['network', 'fetch', 'connection', 'timeout', 'cors']
        .some(term => errorMsg.toLowerCase().includes(term))
      
      // Create a user-friendly message based on error type
      let userFriendlyMsg = errorMsg;
      
      // Map common error patterns to better messages
      if (isNetworkError) {
        userFriendlyMsg = 'Network connection issue - please check your internet connection.'
      } else if (errorMsg.includes('permission') || errorMsg.includes('denied')) {
        userFriendlyMsg = 'You don\'t have permission to perform this action.'
      }
      // ... other error mappings
      
      // Prepare detailed error metadata for workflow state
      const errorMetadata = {
        error: userFriendlyMsg,
        errorDetails: {
          originalError: error instanceof Error ? error.toString() : String(error),
          timestamp: new Date().toISOString(),
          isNetworkError,
          ...(options?.details || {})
        },
        previousStep: options?.step || currentStep,
        errorType: isNetworkError ? 'network' : 'application'
      }
      
      // Update workflow step to error with context
      updateWorkflowStep('error', errorMetadata)
      
      // Set error in state
      setError(userFriendlyMsg)
      
      // Show toast notification if not disabled
      if (options?.showToast !== false) {
        toast({
          title: isNetworkError ? 'Network Error' : 'Error',
          description: userFriendlyMsg,
          variant: 'destructive',
        })
      }
      
      // Update the database if needed
      updateDatabaseWorkflowState('error', errorMetadata)
    },
    
    // Clear any error state
    clearError: () => {
      setError(null)
    }
  }
}
```

Key error handling features:

- **Context-Aware Errors**: Errors include workflow context for better debugging (`previousStep` tracking)
- **User-Friendly Messages**: Technical errors are translated to understandable language (error type detection)
- **Recovery Options**: Retry mechanisms for failed operations (`retryProcessing()` in `ChatInterface`)
- **State Preservation**: Error states don't lose existing work (error metadata stored in workflow state)
- **Detailed Logging**: Error metadata is stored for troubleshooting (in both UI state and database)

### Error Presentation in UI

Error states are presented to users through:

- **Toast Notifications** (`components/ui/toast.tsx`): Brief error notifications
- **Alert Components** (`components/ui/alert.tsx`): More detailed error displays with recovery options
- **Workflow Status Indicators**: Visual indication of error states in workflow displays

### Error Recovery Patterns

The system uses consistent patterns for error recovery:

```typescript
// Example from ChatInterface component
const retryProcessing = useCallback(() => {
  if (currentUpload) {
    void handleProcessDocument(currentUpload)
  } else {
    toast({
      title: 'No document to retry',
      description: 'Please upload a document first.',
      variant: 'destructive',
    })
  }
}, [currentUpload, handleProcessDocument, toast])
```

### Error Database Tracking

Errors are also tracked in the database for debugging and analytics:

```typescript
// Update database workflow state to error
const workflowId = localStorage.getItem('current_workflow_id')
if (workflowId) {
  await supabase
    .from('workflow_states')
    .update({
      current_step: 'error',
      metadata: {
        errorMessage,
        errorAt: new Date().toISOString(),
        errorStage: 'verification'
      }
    })
    .eq('id', workflowId)
}
```

## User Experience

The Neuvia system is designed to provide a seamless user experience for medical professionals:

### For Clinicians

1. **Intuitive Upload**: Simple drag-and-drop or file selection
   - File selection with browser dialog (`components/upload/unified-document-uploader.tsx`)
   - Drag-and-drop functionality with visual feedback
   - Support for common medical document formats (PDF, DOCX, images)
   - Immediate status feedback during upload

2. **Transparent Processing**: Clear visibility into processing steps and progress
   - Detailed progress indicators (`components/chat/workflow/workflow-progress-tracker.tsx`)
   - Phase descriptions for each processing step
   - Real-time updates from Gemini extraction process
   - Clear completion indicators

3. **Efficient Verification**: Streamlined review and correction process
   - Structured summary presentation (`components/chat/workflow/verification-ui.tsx`)
   - In-line correction capability through natural language
   - Visual differentiation of original and corrected content (`components/chat/ui/summary-diff-viewer.tsx`)
   - Simple confirmation process with keyword detection ("confirm")

4. **Comprehensive Reports**: Professionally formatted medical reports
   - Standardized medical formatting (`lib/services/report/report-service.ts`)
   - Multiple format options (PDF, markdown, etc.)
   - Rich metadata inclusion from verification process
   - Downloadable and shareable outputs

5. **Continuous Interaction**: Ability to ask follow-up questions about patient data
   - Contextual AI responses to medical questions
   - Reference to extracted document content
   - Visual integration of responses with verified data
   - Persistent access to document history

### Workflow States Implementation

Users always know where they are in the process through several UI mechanisms defined in `lib/workflow/types.ts` and implemented across components:

```typescript
// From lib/workflow/types.ts
export type WorkflowStep =
  // All database-defined workflow steps
  | Database['public']['Enums']['workflow_step']
  // Application-specific extensions
  | 'research' // Research phase
  | 'report_presentation' // Report presentation
  // Verification substates
  | 'verification_pending' // Waiting for user to verify
  | 'verification_in_progress' // User is reviewing/correcting
  | 'verification_completed' // User has completed verification
  | 'verification_failed' // Verification failed
  | 'error' // General error state
```

Key workflow visualization elements:
- Progress indicators showing current step (`components/chat/workflow/workflow-indicator.tsx`)
- Percentage completion for active processes (`components/ui/progress.tsx`)
- Clear status messages explaining the current operation (`getDynamicPlaceholder()` in chat interface)
- Contextual action buttons relevant to the current state (`components/chat/workflow/workflow-status-display.tsx`)

### Error Recovery Implementation

When errors occur, users can leverage several recovery mechanisms implemented in `stores/chat-store.tsx` and `app/dashboard/chat/components/chat-interface/index.tsx`:

```typescript
// Example error recovery UI from chat interface
{error && (
  <div className="px-4 pt-4">
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="size-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        {error}
        <div className="mt-2 flex gap-2">
          <Button
            className="gap-1"
            onClick={retryProcessing}
            size="sm"
            variant="outline"
          >
            <RefreshCw className="size-3" /> Retry
          </Button>
          <Button
            onClick={() => {
              // Clear error state
              useChatStore.getState().setError(null);
              setCurrentUpload(null);
            }}
            size="sm"
            variant="outline"
          >
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  </div>
)}
```

Key error recovery features:
- View clear explanations of what went wrong (user-friendly error messages)
- Retry operations without losing context (stateful error recovery)
- Error reporting with detailed context (workflow state preservation)
- Continue from where they left off when issues are resolved (state restoration)

## Implementation Details

### Chat System Integration

The chat interface serves as the primary interaction point, implemented primarily in `app/dashboard/chat/components/chat-interface/index.tsx` and `components/chat/message/message.tsx`:

```typescript
// Message type definition from lib/chat/types.ts
export interface ChatMessage extends AIMessage {
  /**
   * Message metadata for advanced functionality
   */
  metadata?: MessageMetadata
}

// Message helper functions
export function isVerificationRequestMessage(message: ChatMessage): boolean {
  return message.metadata?.isVerificationRequest === true
}

export function isSummaryMessage(message: ChatMessage): boolean {
  return message.metadata?.isSummary === true
}

export function isCorrectionMessage(message: ChatMessage): boolean {
  return message.metadata?.isCorrection === true
}

export function isProgressMessage(message: ChatMessage): boolean {
  return message.metadata?.isProgress === true
}
```

The chat system features:
- Different message types for system updates, AI responses, and user input (`lib/chat/types.ts`)
- Special message handling for verification requests and corrections (`handleCorrectionMessage()`)
- Progress messages that update in real-time (`updateMessageProgress()`)
- Contextual input suggestions based on workflow state (`getDynamicPlaceholder()`)

### Workflow State Transitions

The system manages state transitions through a well-defined state machine implemented in `stores/chat-store.tsx` and `lib/workflow/types.ts`:

```typescript
// From stores/chat-store.tsx
updateWorkflowStep: (step, metadata) =>
  set((state) => {
    // Helper to map workflow steps to chat modes
    const mapStepToMode = (
      step: WorkflowStep,
      currentMode: ChatMode
    ): ChatMode => {
      switch (step) {
        case 'verification':
          return 'verification'
        case 'report_generation':
          return 'default' // Use default mode for reports
        case 'error':
          return currentMode // Preserve current mode on error
        default:
          // Only switch mode if it was tied to a workflow step
          if (currentMode === 'verification') {
            return 'default'
          }
          return currentMode
      }
    }

    const mode = mapStepToMode(step, state.mode)

    // For error steps, set the error state too
    if (step === 'error' && metadata?.error) {
      // Set the error in the workflow and main error state
      const errorMessage = metadata.error as string;
      state.error = errorMessage;
      state.workflow.workflowError = errorMessage;
    }

    // Update database workflow state if needed
    updateDatabaseWorkflowState(step, metadata)

    return {
      workflow: {
        ...state.workflow,
        currentStep: step,
        data: {
          ...state.workflow.data,
          ...(metadata || {}),
        },
      },
      mode,
      // If transitioning to error, also set the error state
      ...(step === 'error' && metadata?.error ? { error: metadata.error } : {}),
    }
  })
```

Key features:
- Clear step definitions in `WorkflowStep` type (`lib/workflow/types.ts`)
- Database-synchronized workflow states (`updateDatabaseWorkflowState()`)
- Event-driven progression through steps
- Proper error state handling and recovery paths

### Verification Process

Verification is handled through a structured process implemented in `stores/chat-store.tsx` and visualization components:

```typescript
// Handle verification completion
completeVerification: async (isApproved) => {
  const state = get()

  // Update state
  set((state) => {
    const verification = state.workflow.data.verification || {}
    const nextStep = isApproved
      ? 'report_generation'
      : state.workflow.currentStep

    return {
      verification: {
        ...state.verification,
        isInVerificationMode: false,
        verificationStatus: isApproved ? 'completed' : 'failed',
      },
      workflow: {
        ...state.workflow,
        currentStep: nextStep,
        processingStatus: isApproved
          ? {
              status: 'success',
              progress: 100,
              phase: 'verification' as ProcessingPhase,
            }
          : state.workflow.processingStatus,
        data: {
          ...state.workflow.data,
          verification: {
            ...verification,
            isInVerificationMode: false,
            isApproved,
            completedAt: new Date().toISOString(),
          },
        },
      },
      mode: isApproved ? 'default' : state.mode,
    }
  })

  // Build the verification result
  return {
    isCompleted: true,
    isApproved,
    items: state.verification.verificationItems,
    completedAt: new Date().toISOString(),
    verificationMetadata: {
      // ... metadata details
    }
  }
}
```

The verification implementation includes:
- Initial summary generation and presentation (`postSummaryMessage()`)
- Detection of correction messages and keywords (`handleMessageSubmit()` in chat interface)
- Version tracking for each summary iteration (`verification.summaryVersions` in state)
- Final confirmation through specific keywords or actions (`completeVerification()`)
- Visual diffs showing changes (`components/chat/ui/summary-diff-viewer.tsx`)

### Report Generation Integration

The report generation process uses the Perplexity Deep Research API and is implemented in `stores/chat-store.tsx` and `lib/services/report/report-service.ts`:

```typescript
// Generate a report
generateReport: async () => {
  // Start report generation in workflow
  get().startReportGeneration()

  try {
    // Get current workflow and patient data
    const state = get()
    const workflowId = localStorage.getItem('current_workflow_id') || ''
    const patientId = state.workflow.data.patientId as string || ''
    
    // Call the reports API
    const report = await apiClient.reports.generateReport({
      workflowId,
      patientId,
      format: 'pdf',
      includeVerificationData: true,
      detailLevel: 'comprehensive'
    })

    // Update workflow state to completion once report is done
    get().completeReportGeneration({
      format: report.format || 'pdf',
      content: report.content || 'Generated report content',
      generatedAt: report.generatedAt || new Date().toISOString(),
      reportId: report.id
    })
  } catch (error) {
    console.error('Error generating report:', error)
    get().setError(
      error instanceof Error ? error.message : 'Failed to generate report'
    )
  }
}
```

The report generation implementation uses:
- Verified patient data as the foundation (`workflow.data.verification`)
- Perplexity Deep Research API for in-depth analysis (`api/perplexity/route.ts`)
- Customizable formatting options (`formatReport()`)
- Progress tracking during generation (`startReportGeneration()` and progress updates)

## Future Enhancements

Planned improvements to the system include:

1. **Enhanced AI Models**: Integration with more specialized medical AI models
   - Integration with domain-specific medical AI models
   - Support for complex medical terminology and relationships
   - Enhanced entity recognition for medications, conditions, and procedures
   - Implementation path: `lib/processing/types/extraction.ts` extension

2. **Expanded Document Types**: Support for additional medical document formats
   - Lab result processing with structured data extraction
   - Medical imaging report analysis
   - Insurance documentation extraction
   - Implementation path: `lib/schemas/document-types.ts` extension

3. **Advanced Analytics**: Deeper insights from patient documents across time
   - Longitudinal patient data analysis
   - Trend identification across multiple documents
   - Visualization of patient health metrics over time
   - Implementation path: New analytics module in `lib/services/analytics/`

4. **Collaborative Verification**: Multi-user verification workflow
   - Real-time collaborative review of patient summaries
   - Role-based verification permissions
   - Audit trail of verification changes
   - Implementation path: Extension of `lib/workflow/types.ts` with collaboration fields

5. **Integration Capabilities**: Connections to Electronic Health Record (EHR) systems
   - FHIR-compliant data formats for EHR compatibility
   - HL7 integration for clinical systems
   - Secure API endpoints for third-party EHR systems
   - Implementation path: New connector module in `lib/services/integrations/`

## Technical Roadmap

To implement these enhancements, the following technical work is planned:

1. **Database Schema Updates**
   - Add collaboration tables (`supabase/migrations/`)
   - Extend workflow_states table with additional metadata fields
   - Add analytics-specific tables for trend tracking

2. **API Extensions**
   - New endpoints for analytics and integration (`app/api/analytics/`)
   - Enhanced verification endpoints with collaboration support
   - FHIR-compatible data export endpoints

3. **UI Component Development**
   - Collaborative verification interface
   - Advanced visualization components
   - Integration configuration panels

4. **State Management Improvements**
   - Real-time synchronization for collaborative features
   - Enhanced caching for performance optimization
   - Separation of concerns for better maintainability

## Conclusion

The Neuvia Medical Records Analysis System represents a sophisticated integration of AI and human expertise in the medical documentation field. By combining automated extraction with human verification, the system achieves both efficiency and accuracy in medical report generation, ultimately improving patient care through better information management.

Key technical achievements include:
- Robust workflow management with clear state transitions
- Seamless integration of AI services with human verification
- Comprehensive error handling with context-aware recovery
- Modular architecture supporting future extensions
- User-centric design focused on clinical efficiency

This documentation provides a comprehensive overview of the system's architecture, components, and implementation details, serving as a guide for developers working on the Neuvia platform.