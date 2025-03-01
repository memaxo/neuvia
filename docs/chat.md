# Neuvia Chat System Architecture Overview

The Neuvia app features a sophisticated chat system that extends beyond basic messaging to support complex document processing, verification workflows, and report generation. Let's break down the entire architecture:

## 1. Core Architecture

### 1.1 State Management
- **Context-Reducer Pattern**: The system uses React's Context API with a reducer pattern for state management.
- **ChatProvider**: A global provider that manages chat state and exposes methods to components through the `useChatContext` hook.
- **ChatState Interface**: Defines the structure of chat state including messages, mode, loading status, and verification state.
- **ChatAction Types**: Type-safe action creators for various chat operations like adding messages, setting modes, and managing workflows.

### 1.2 Database Integration
- **Supabase Tables**: The system stores chat data in Supabase tables:
  - `chats`: Stores chat conversations and their metadata
  - `messages`: Stores individual messages within chats
  - `votes`: Stores user votes on messages
- **Row Level Security (RLS)**: All tables have RLS policies to control access based on user roles.

### 1.3 Message Types and Metadata
- **Enhanced AI Messages**: The system extends the base AI SDK message type with custom metadata.
- **Message Roles**: Supports various roles including 'user', 'system', and 'assistant'.
- **Metadata System**: Rich metadata for messages that enables special features like progress tracking, verification status, and report formatting.

## 2. Specialized Workflow Integration

### 2.1 Processing Workflow
- **Unified Workflow Hook**: The `useChatProcessingWorkflow` specializes a base `useProcessingWorkflow` hook for chat-specific functionality.
- **Workflow States**: The workflow progresses through multiple states:
  - `idle`: Initial state
  - `extraction`: Document content is being extracted
  - `verification`: Extracted content needs verification
  - `report_generation`: Generating reports from verified content
  - `complete`: Workflow completed

### 2.2 Document Processing
- **Document Upload**: Users can upload documents (PDF, DOCX, TXT, etc.) for processing.
- **Content Extraction**: The system extracts structured data from documents.
- **Progress Tracking**: Visual feedback on processing stages with progress indicators.
- **Error Handling**: Robust error recovery for network or processing failures.

### 2.3 Verification Flow
- **Extracted Information Verification**: After extraction, content is presented for user verification.
- **Correction Capabilities**: Users can submit corrections to extracted content.
- **Version Tracking**: The system keeps track of all versions of summaries after corrections.
- **Approval Process**: Users can explicitly approve verified content to proceed.

### 2.4 Report Generation
- **Format Options**: Support for multiple output formats (PDF, markdown, HTML, etc.).
- **Customization**: Options for report style and detail level.
- **Interactive Generation**: Users can provide additional notes and customize reports.

## 3. User Interface Components

### 3.1 Chat Interface
- **ChatInterface Component**: Main component that orchestrates the entire chat experience.
- **Message Display**: `ChatMessageList` renders all messages with appropriate styling based on role and type.
- **Input Handling**: `MessageInput` component for message submission with dynamic placeholders based on context.
- **DocumentUploader**: Component for handling file uploads with progress tracking.

### 3.2 Workflow UI
- **WorkflowStatusDisplay**: Shows current workflow state with phase indicators.
- **ProgressIndicator**: Visual feedback on document processing and report generation.
- **ReportGenerationPanel**: Interface for customizing report generation.

### 3.3 Message Components
- **MessageUI**: Renders individual messages with appropriate styling.
- **VerificationUI**: Special UI for verification-related messages.
- **SummaryDiffViewer**: Visualizes differences between summary versions.

## 4. Message Processing Logic

### 4.1 Mode-Based Processing
- **processMessage Function**: Processes messages differently based on current chat mode.
- **Mode Handlers**:
  - `handleVerificationMessage`: Special handling for messages during verification.
  - `handleReportGenerationMessage`: Processing for report generation requests.
  - `handleDefaultChatMessage`: Standard message processing.

### 4.2 Command Recognition
- **Natural Language Commands**: The system recognizes commands like "confirm", "approve", or "generate report".
- **Intent Detection**: Analyzes message content to determine user intent for corrections or approvals.

### 4.3 Response Generation
- **System Messages**: Generated responses keep users informed about current state and options.
- **AI Integration**: Integration points for AI-powered responses (though the specific AI model integration isn't fully visible in the code snippets).

## 5. Technical Implementation Details

### 5.1 Cancellation Support
- **AbortController Integration**: Document processing supports cancellation via AbortSignal.
- **Cleanup Mechanisms**: Proper resource cleanup when operations are cancelled.

### 5.2 Optimizations
- **Memoization**: Heavy use of React's `useCallback` and `useMemo` for performance.
- **State Synchronization**: Careful synchronization between context state and component state.

### 5.3 Type Safety
- **TypeScript Throughout**: Comprehensive type definitions ensure type safety across the system.
- **Interface Segregation**: Well-defined interfaces with specific responsibilities.

## 6. Key Workflows

### 6.1 Document Processing Workflow
1. User uploads a document via DocumentUploader
2. System processes document with progress updates
3. Extracted content is presented for verification
4. User verifies or corrects information
5. User confirms verification to proceed
6. System offers report generation options
7. User customizes and generates report or skips
8. Workflow completes, returning to normal chat mode

### 6.2 Verification Workflow
1. System enters verification mode with extracted content
2. User reviews summary content
3. User submits corrections if needed
4. System processes corrections and updates summary
5. User approves final summary
6. System transitions to report generation

### 6.3 Report Generation Workflow
1. System offers report generation options
2. User chooses to generate report or skip
3. If generating, user provides additional notes
4. System generates report with progress tracking
5. Final report is displayed in chat
6. System returns to normal chat mode

## 7. Integration Points

### 7.1 File Uploads
- **UploadService**: Handles file uploads with progress tracking
- **Integration with Supabase Storage**: Files are stored in Supabase

### 7.2 AI Integration
- **LangChainCore**: Provides message creation and potentially AI model integration
- **Message Templates**: System has predefined templates for various scenarios

### 7.3 Database Operations
- **Supabase Client**: Used for database operations and user authentication
- **Real-time Updates**: Potential for real-time chat updates via Supabase subscriptions

## 8. Future Extensibility

The architecture is designed for extensibility in several ways:
- **Mode System**: New chat modes can be added with specific handlers
- **Workflow Steps**: Additional workflow steps can be integrated
- **Message Types**: The metadata system allows for new message types
- **UI Components**: Modular UI components can be extended or replaced

This chat system represents a sophisticated integration of messaging, document processing, and workflow management capabilities, providing a powerful tool for document analysis and verification tasks.
