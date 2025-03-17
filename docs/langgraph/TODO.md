# TODO.md for Neuvia System Rearchitecture with LangGraph.js

Welcome to the Neuvia system rearchitecture project! This detailed guide provides a comprehensive step-by-step action plan to integrate LangGraph.js into the Neuvia medical records system. Each task includes in-depth examples, edge case considerations, and implementation guidance to ensure a successful transition to a modular, workflow-driven architecture.

## Table of Contents
1. [Define the Workflow State Schema](#1-define-the-workflow-state-schema)
2. [Implement Supabase Checkpointer](#2-implement-supabase-checkpointer)
3. [Refactor Existing Services](#3-refactor-existing-services)
4. [Create Node Implementations](#4-create-node-implementations)
5. [Define Workflow Graphs](#5-define-workflow-graphs)
6. [Implement Error Handling](#6-implement-error-handling)
7. [Update API Endpoints](#7-update-api-endpoints)
8. [Integrate RAG and Perplexity Services](#8-integrate-rag-and-perplexity-services)
9. [Testing and Validation](#9-testing-and-validation)
10. [Monitoring and Observability](#10-monitoring-and-observability)
11. [Security Considerations](#11-security-considerations)
12. [Performance Optimization](#12-performance-optimization)
13. [Documentation and Onboarding](#13-documentation-and-onboarding)
14. [Deployment Strategy](#14-deployment-strategy)

---

## 1. Define the Workflow State Schema

- **File**: `workflow/state/workflow-state.ts`
- **Action**: Create
- **Description**:
  - This file defines the structure of the data (state) that will be used and updated throughout the workflow. Think of it as a shared "snapshot" of everything happening in the process, like patient details or document status, which gets passed between different steps.
  - Create a new file at `workflow/state/workflow-state.ts`.

### Detailed Implementation

```typescript
// workflow/state/workflow-state.ts

import { DocumentCategory } from '@/lib/types/document';

/**
 * Core state interface for LangGraph.js workflow
 * 
 * This represents the complete state of a workflow instance at any point in time.
 * All nodes in the workflow will receive and potentially update this state.
 */
export interface WorkflowState {
  // Core identifiers
  threadId: string;              // Unique identifier for this workflow instance
  patientId: string;             // ID of the patient this workflow is associated with
  workflowStartedAt: string;     // ISO timestamp of when the workflow started
  workflowUpdatedAt: string;     // ISO timestamp of when the workflow was last updated
  userId: string;                // ID of the user who initiated the workflow
  
  // Document processing state
  documentId?: string;           // ID of the document being processed, if available
  documentMetadata?: {
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    uploadedAt?: string;
    hash?: string;
    pageCount?: number;
  };
  file?: File;                   // JavaScript File object (client-side only)
  
  // Extraction and analysis state
  extractedData?: {
    text: string;                // Full extracted text content
    metadata: Record<string, any>; // Additional metadata from extraction
    structuredData?: Record<string, any>; // Any structured data extracted
    confidence: number;          // Confidence score of extraction (0-1)
    extractedAt: string;         // When extraction was performed
  };
  analysisResult?: {
    summary: string;             // Concise summary of document
    keyFindings: string[];       // List of key findings
    documentType?: {             // Detected document type
      category: DocumentCategory;
      type: string;
    };
    confidence: number;          // Confidence score of analysis (0-1)
    analyzedAt: string;          // When analysis was performed
  };
  
  // Verification state
  verification: {
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    corrections: {
      id: string;
      field: string;
      originalValue: string;
      correctedValue: string;
      timestamp: string;
      userId: string;
    }[];
    verifiedBy?: string;        // User ID of verifier
    verifiedAt?: string;        // When verification completed
    userInput?: Record<string, any>; // Additional user input
    verificationStartedAt?: string;  // When verification started
  };
  
  // Report generation state
  reportId?: string;            // ID of generated report
  reportMetadata?: {
    title?: string;
    generatedAt?: string;
    format?: string;
    sections?: string[];
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
  };
  
  // User interaction history
  interactionHistory?: {
    timestamp: string;
    message: string;
    userId: string;
    role: 'user' | 'system' | 'assistant';
    contextual?: {
      step: string;
      intent?: string;
      entities?: Record<string, any>;
    };
  }[];
  
  // Error tracking
  error?: {
    message: string;
    code?: string;
    step?: string;
    timestamp: string;
    recoverable: boolean;
    details?: Record<string, any>;
  };
  
  // Progress tracking
  progress: {
    currentStep: string;
    percentage: number;
    phase: string;
    isCompleted: boolean;
  };
  
  // Session context
  context?: Record<string, any>; // Additional context that might be needed
}

/**
 * Type for partial state updates
 * Used when nodes return only the portion of state they're updating
 */
export type PartialWorkflowState = Partial<WorkflowState>;

/**
 * Function to create an initial workflow state
 */
export function createInitialWorkflowState(
  patientId: string,
  userId: string,
  threadId?: string
): WorkflowState {
  const now = new Date().toISOString();
  return {
    threadId: threadId || crypto.randomUUID(),
    patientId,
    workflowStartedAt: now,
    workflowUpdatedAt: now,
    userId,
    verification: {
      status: 'pending',
      corrections: [],
    },
    progress: {
      currentStep: 'initialization',
      percentage: 0,
      phase: 'INITIALIZATION',
      isCompleted: false,
    },
  };
}
```

### Edge Cases and Considerations

- **Type Safety**: Ensure robust type safety throughout the system by using TypeScript's discriminated unions and strict null checking.
- **State Evolution**: Plan for state schema evolution as requirements change. Consider versioning your state schema.
- **State Size**: Be mindful of the size of your state, especially when storing binary data. Consider storing larger objects in Supabase storage and keeping only references in the state.
- **Circular References**: Avoid circular references in your state which can cause serialization issues.
- **Default Values**: Provide sensible defaults for all fields to avoid "undefined is not an object" errors.

### Integration Points

- The state schema will be directly used by all workflow nodes and the Supabase checkpointer.
- Services should accept and return data structures compatible with this schema.
- API endpoints will need to transform between this schema and client-friendly DTOs.

---

## 2. Implement Supabase Checkpointer

- **File**: `workflow/checkpointer/supabase-checkpointer.ts`
- **Action**: Create
- **Description**:
  - LangGraph.js uses "checkpointers" to save and load the workflow state between steps, ensuring we don't lose progress. This file creates a custom checkpointer that stores the state in Supabase, a cloud database service.

### Detailed Implementation

```typescript
// workflow/checkpointer/supabase-checkpointer.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/clients';
import { WorkflowState } from '../state/workflow-state';
import type { LangGraphCheckpointer } from '@/types/langgraph';
import logger from '@/lib/logger';

/**
 * Checkpointer implementation for LangGraph.js that uses Supabase for persistence
 * This allows workflows to be paused and resumed, and enables recovery from failures
 */
export class SupabaseCheckpointer implements LangGraphCheckpointer {
  private supabase: SupabaseClient;
  private tableName: string;
  private logger = logger.withMetadata({
    module: 'SupabaseCheckpointer',
  });

  /**
   * Create a new SupabaseCheckpointer instance
   * 
   * @param supabaseClient Optional Supabase client (will create one if not provided)
   * @param tableName The name of the table to use for storage (defaults to 'workflow_states')
   */
  constructor(
    supabaseClient?: SupabaseClient,
    tableName: string = 'workflow_states'
  ) {
    this.supabase = supabaseClient || createClient();
    this.tableName = tableName;
  }

  /**
   * Save workflow state to Supabase
   * 
   * @param state The workflow state to save
   * @param threadId Unique identifier for the workflow thread
   * @returns Promise that resolves when the state is saved
   */
  async save(state: WorkflowState, threadId: string): Promise<void> {
    try {
      // Update timestamp before saving
      const stateWithUpdatedTimestamp = {
        ...state,
        workflowUpdatedAt: new Date().toISOString(),
      };
      
      // Sanitize the state to ensure it's JSON serializable
      const sanitizedState = this.sanitizeState(stateWithUpdatedTimestamp);
      
      // Upsert the state into Supabase
      const { error } = await this.supabase
        .from(this.tableName)
        .upsert({
          thread_id: threadId,
          state: sanitizedState,
          updated_at: new Date().toISOString(),
          patient_id: state.patientId,
          user_id: state.userId,
          current_step: state.progress.currentStep,
          is_completed: state.progress.isCompleted,
        }, {
          onConflict: 'thread_id',
          ignoreDuplicates: false
        });

      if (error) {
        throw new Error(`Failed to save workflow state: ${error.message}`);
      }
      
      this.logger.debug('Workflow state saved successfully', {
        threadId,
        currentStep: state.progress.currentStep,
        isCompleted: state.progress.isCompleted
      });
    } catch (error) {
      this.logger.error('Error saving workflow state', {
        threadId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Load workflow state from Supabase
   * 
   * @param threadId Unique identifier for the workflow thread
   * @returns Promise that resolves to the workflow state, or an empty object if not found
   */
  async load(threadId: string): Promise<WorkflowState | Record<string, never>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('state')
        .eq('thread_id', threadId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          this.logger.info('No existing workflow state found', { threadId });
          return {};
        }
        throw new Error(`Failed to load workflow state: ${error.message}`);
      }

      if (!data || !data.state) {
        this.logger.warn('Empty workflow state loaded', { threadId });
        return {};
      }

      // Ensure the state has all required fields
      const loadedState = data.state as WorkflowState;
      
      this.logger.debug('Workflow state loaded successfully', {
        threadId,
        currentStep: loadedState.progress?.currentStep,
        isCompleted: loadedState.progress?.isCompleted
      });
      
      return loadedState;
    } catch (error) {
      this.logger.error('Error loading workflow state', {
        threadId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * List all workflow thread IDs for a specific patient
   * 
   * @param patientId The patient ID to filter by
   * @param limit Maximum number of thread IDs to return
   * @returns Promise that resolves to an array of thread IDs
   */
  async listThreads(patientId: string, limit: number = 100): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('thread_id')
        .eq('patient_id', patientId)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to list workflow threads: ${error.message}`);
      }

      return data.map(row => row.thread_id);
    } catch (error) {
      this.logger.error('Error listing workflow threads', {
        patientId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete a workflow state from Supabase
   * 
   * @param threadId Unique identifier for the workflow thread
   * @returns Promise that resolves when the state is deleted
   */
  async delete(threadId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('thread_id', threadId);

      if (error) {
        throw new Error(`Failed to delete workflow state: ${error.message}`);
      }
      
      this.logger.info('Workflow state deleted successfully', { threadId });
    } catch (error) {
      this.logger.error('Error deleting workflow state', {
        threadId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Sanitize workflow state to ensure it's JSON serializable
   * Removes circular references and non-serializable objects like File
   * 
   * @param state The workflow state to sanitize
   * @returns JSON-serializable version of the state
   */
  private sanitizeState(state: WorkflowState): Record<string, any> {
    try {
      // Create a deep copy without File objects and other non-serializable types
      const sanitized = JSON.parse(JSON.stringify(state, (key, value) => {
        // Skip File objects (they're not serializable)
        if (value instanceof File) {
          return {
            _type: 'File',
            name: value.name,
            size: value.size,
            type: value.type,
            lastModified: value.lastModified,
          };
        }
        
        // Handle other non-serializable types here if needed
        
        return value;
      }));
      
      return sanitized;
    } catch (error) {
      this.logger.error('Error sanitizing workflow state', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Fall back to a simplified version
      const { file, ...rest } = state;
      return rest;
    }
  }
}

/**
 * Create a singleton instance of the SupabaseCheckpointer
 */
export const supabaseCheckpointer = new SupabaseCheckpointer();
```

### Database Schema

Create the necessary Supabase table:

```sql
-- Table for storing workflow states
CREATE TABLE public.workflow_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id TEXT UNIQUE NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  patient_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  current_step TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes for efficient querying
CREATE INDEX idx_workflow_states_thread_id ON public.workflow_states(thread_id);
CREATE INDEX idx_workflow_states_patient_id ON public.workflow_states(patient_id);
CREATE INDEX idx_workflow_states_user_id ON public.workflow_states(user_id);
CREATE INDEX idx_workflow_states_current_step ON public.workflow_states(current_step);
CREATE INDEX idx_workflow_states_is_completed ON public.workflow_states(is_completed);

-- RLS policies for security
ALTER TABLE public.workflow_states ENABLE ROW LEVEL SECURITY;

-- Policy for selecting workflow states
CREATE POLICY "Users can view their own workflow states" 
ON public.workflow_states FOR SELECT 
USING (auth.uid() = user_id);

-- Policy for inserting workflow states
CREATE POLICY "Users can insert their own workflow states" 
ON public.workflow_states FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy for updating workflow states
CREATE POLICY "Users can update their own workflow states" 
ON public.workflow_states FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy for deleting workflow states
CREATE POLICY "Users can delete their own workflow states" 
ON public.workflow_states FOR DELETE 
USING (auth.uid() = user_id);
```

### Edge Cases and Considerations

- **Concurrency**: Handle race conditions when multiple instances try to update the same state concurrently. Supabase's RLS policies help, but add application-level checks.
- **State Size Limits**: Be aware of Supabase's 1MB limit for JSON columns. If your state exceeds this, consider breaking it into smaller chunks or storing large data elsewhere.
- **Error Resilience**: Implement robust error handling and retry logic for database operations.
- **Performance**: For large workflows, consider indexing on frequently queried fields or implementing a caching layer.
- **Versioning**: Add a version field to handle state schema changes over time.

### Testing

Add unit tests to verify the checkpointer's functionality:

```typescript
// __tests__/workflow/checkpointer/supabase-checkpointer.test.ts

import { SupabaseCheckpointer } from '@/workflow/checkpointer/supabase-checkpointer';
import { WorkflowState, createInitialWorkflowState } from '@/workflow/state/workflow-state';
import { createClient } from '@/lib/supabase/clients';

// Mock Supabase client
jest.mock('@/lib/supabase/clients');

describe('SupabaseCheckpointer', () => {
  let checkpointer: SupabaseCheckpointer;
  let mockSupabase: any;
  
  beforeEach(() => {
    // Setup mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation(callback => {
        return callback({ data: null, error: null });
      }),
    };
    
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    
    checkpointer = new SupabaseCheckpointer();
  });
  
  test('save should upsert state to Supabase', async () => {
    // Setup
    const state = createInitialWorkflowState('patient123', 'user123');
    const threadId = 'thread123';
    
    mockSupabase.upsert.mockReturnValue({
      error: null
    });
    
    // Execute
    await checkpointer.save(state, threadId);
    
    // Verify
    expect(mockSupabase.from).toHaveBeenCalledWith('workflow_states');
    expect(mockSupabase.upsert).toHaveBeenCalled();
  });
  
  // Add more tests for load, listThreads, delete, etc.
});
```

---

## 3. Refactor Existing Services

- **Files**:
  - `services/document/extraction-service.ts`
  - `services/document/analysis-service.ts`
  - `services/document/storage-service.ts`
  - `services/verification/verification-service.ts`
  - `services/report/report-service.ts`
  - `services/perplexity/perplexity-service.ts`
  - `services/rag/rag-service.ts`
- **Action**: Edit
- **Description**:
  - Refactor existing services to focus solely on their core functionality, removing workflow orchestration logic.
  - Make services more modular, testable, and reusable by workflow nodes.

### Example Refactoring for ExtractionService

**Before (current implementation):**
```typescript
// services/document/extraction-service.ts (before refactoring)

import { ProcessingPhase } from '@/lib/types/workflow';
// Other imports...

export class DocumentExtractionService {
  async extractText(
    file: File,
    options: EnhancedExtractionOptions = {},
    workflowId?: string,
    onProgress?: (progress: number, phase: ProcessingPhase) => void
  ): Promise<ExtractedData> {
    const moduleLogger = this.logger.withMetadata({
      module: 'DocumentExtractionService',
      method: 'extractText',
      fileType: file.type,
      fileName: file.name,
      workflowId
    });

    try {
      moduleLogger.info('Starting document extraction', {
        fileType: file.type,
        fileSize: file.size
      });
      
      // Report initial progress
      if (onProgress) {
        onProgress(5, ProcessingPhase.EXTRACTION);
      }

      // Import extractors dynamically to avoid circular dependencies
      const { ExtractorFactory } = await import('./extractors/extractor-factory');
      
      // Create extractor factory
      const extractorFactory = new ExtractorFactory(this);
      
      // Get appropriate extractor for the file type
      const extractor = extractorFactory.getExtractorForFileType(file.type);
      
      // Report progress before extraction
      if (onProgress) {
        onProgress(20, ProcessingPhase.EXTRACTION);
      }
      
      // Emit extraction start event if workflow ID is provided
      if (workflowId) {
        await this.emitExtractionEvent(workflowId, 'extraction_started', {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          extractionOptions: {
            splitPages: options.splitPages,
            extractTables: options.extractTables,
            detectSections: options.detectSections
          }
        });
      }
      
      // Progress monitoring and workflow logic...
      
      return extractedData;
    } catch (error) {
      // Error handling with workflow updates...
    }
  }
  
  // Other methods with workflow logic...
}
```

**After (refactored implementation):**
```typescript
// services/document/extraction-service.ts (after refactoring)

import { ExtractionResult, ExtractionOptions } from '@/types/extraction';
import { DocumentType } from '@/lib/types/document';
import logger from '@/lib/logger';
import { ExternalServiceError, ValidationError } from '@/lib/errors';
import { ExtractorFactory } from './extractors/extractor-factory';

/**
 * Service responsible for extracting text and data from documents
 * Focuses only on extraction functionality without workflow orchestration
 */
export class ExtractionService {
  private readonly logger = logger.withMetadata({
    module: 'ExtractionService',
  });
  
  private readonly extractorFactory: ExtractorFactory;
  
  constructor() {
    this.extractorFactory = new ExtractorFactory();
  }
  
  /**
   * Extract text and structured data from a document
   * 
   * @param file The file to extract from
   * @param options Extraction options to customize behavior
   * @returns Promise resolving to extraction result
   * @throws ValidationError if file is invalid
   * @throws ExternalServiceError if extraction fails
   */
  async extract(
    file: File,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    if (!file) {
      throw new ValidationError({
        message: 'File is required for extraction',
        code: 'EXTRACTION_MISSING_FILE'
      });
    }
    
    const moduleLogger = this.logger.withMetadata({
      method: 'extract',
      fileType: file.type,
      fileName: file.name,
      fileSize: file.size
    });
    
    try {
      moduleLogger.info('Starting document extraction');
      
      // Get appropriate extractor for the file type
      const extractor = this.extractorFactory.getExtractorForFileType(file.type);
      
      // Perform extraction
      const result = await extractor.extract(file, options);
      
      moduleLogger.info('Document extraction completed', {
        textLength: result.text.length,
        structuredFields: Object.keys(result.structuredData || {}).length
      });
      
      return {
        text: result.text,
        structuredData: result.structuredData || {},
        metadata: {
          ...result.metadata,
          extractedAt: new Date().toISOString(),
          extractionMethod: 'standard',
          documentType: result.documentType || { 
            category: 'unknown', 
            type: 'document' 
          },
        },
        confidence: result.confidence || 0.8
      };
    } catch (error) {
      moduleLogger.error('Document extraction failed', {}, error);
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new ExternalServiceError({
        message: `Document extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        code: 'EXTRACTION_FAILED',
        service: 'DocumentExtraction',
        data: {
          fileType: file.type,
          fileName: file.name,
          fileSize: file.size
        },
        cause: error
      });
    }
  }
  
  /**
   * Detect document type based on content
   * 
   * @param text Document text content
   * @returns Promise resolving to document type
   */
  async detectDocumentType(text: string): Promise<DocumentType> {
    // Implementation focusing only on document type detection
    // No workflow orchestration code
    try {
      // Document type detection logic...
      return {
        category: 'clinical',
        type: 'note'
      };
    } catch (error) {
      this.logger.error('Document type detection failed', {}, error);
      throw new ExternalServiceError({
        message: 'Failed to detect document type',
        code: 'DOCUMENT_TYPE_DETECTION_FAILED',
        service: 'DocumentExtraction',
        cause: error
      });
    }
  }
  
  // Other extraction-focused methods without workflow logic
}

// Export singleton instance
export const extractionService = new ExtractionService();
```

### Guidelines for Service Refactoring

For each service, follow these steps:

1. **Remove Workflow Logic**: Remove all code related to workflow management, state transitions, and progress reporting.
2. **Focus on Core Functionality**: Keep only methods that directly relate to the service's primary responsibility.
3. **Standardize Error Handling**: Implement consistent error handling with meaningful error types.
4. **Reduce Dependencies**: Minimize dependencies on other services to avoid circular dependencies.
5. **Improve Type Safety**: Add comprehensive types and interfaces for inputs and outputs.
6. **Add Documentation**: Include detailed JSDoc comments for all public methods.
7. **Create Unit Tests**: Add unit tests for each method to ensure proper functionality in isolation.

### Refactoring Checklist for Each Service

- [ ] Remove workflow-specific imports
- [ ] Remove progress reporting code
- [ ] Remove workflow state management code
- [ ] Remove service orchestration code
- [ ] Remove direct dependencies on other services where possible
- [ ] Add comprehensive error handling
- [ ] Update method signatures to accept/return simpler data structures
- [ ] Add detailed JSDoc comments
- [ ] Create unit tests

### Handling Circular Dependencies

To avoid circular dependencies, consider these strategies:

1. **Dynamic Imports**: Use dynamic imports for services that would create circular dependencies.
2. **Interface Segregation**: Define clear interfaces between services.
3. **Dependency Injection**: Pass dependencies as parameters rather than importing them directly.

Example of dynamic import:
```typescript
async function processDocument(documentId: string): Promise<void> {
  // Dynamic import to avoid circular dependency
  const { analysisService } = await import('../analysis/analysis-service');
  const result = await analysisService.analyze(documentId);
  // Process result...
}
```

---

## 4. Create Node Implementations

- **Files**:
  - `workflow/nodes/upload-node.ts`
  - `workflow/nodes/extraction-node.ts`
  - `workflow/nodes/analysis-node.ts`
  - `workflow/nodes/storage-node.ts`
  - `workflow/nodes/verification/initiate-verification-node.ts`
  - `workflow/nodes/verification/process-correction-node.ts`
  - `workflow/nodes/verification/complete-verification-node.ts`
  - `workflow/nodes/report-generation-node.ts`
  - `workflow/nodes/interaction-node.ts`
- **Action**: Create
- **Description**:
  - Nodes are the building blocks of the workflow in LangGraph.js. Each node handles one specific task and updates part of the `WorkflowState`.

### Detailed Node Implementation Example

```typescript
// workflow/nodes/extraction-node.ts

import { WorkflowState, PartialWorkflowState } from '../state/workflow-state';
import { extractionService } from '../../services/document/extraction-service';
import { handleNodeError } from '../utils/error-handler';
import logger from '@/lib/logger';

/**
 * Node for extracting text and data from a document
 * 
 * This node:
 * 1. Takes a document ID or file from the workflow state
 * 2. Extracts text and structured data using the extraction service
 * 3. Updates the workflow state with the extracted data
 * 
 * @param state Current workflow state
 * @returns Promise resolving to partial workflow state update
 * @throws Error if extraction fails
 */
export async function extractionNode(
  state: WorkflowState
): Promise<PartialWorkflowState> {
  const nodeLogger = logger.withMetadata({
    module: 'ExtractionNode',
    threadId: state.threadId,
    documentId: state.documentId,
  });
  
  try {
    nodeLogger.info('Starting document extraction');
    
    // Validate required state
    if (!state.file && !state.documentId) {
      throw new Error('Either file or documentId is required for extraction');
    }
    
    let extractionResult;
    
    // If we have a file object, use it directly
    if (state.file) {
      nodeLogger.info('Extracting from file object', {
        fileName: state.file.name,
        fileSize: state.file.size,
        fileType: state.file.type
      });
      
      extractionResult = await extractionService.extract(state.file, {
        extractTables: true,
        detectSections: true
      });
    } 
    // Otherwise, get the document by ID and extract from it
    else if (state.documentId) {
      nodeLogger.info('Extracting from document ID', {
        documentId: state.documentId
      });
      
      // Get document content by ID
      const document = await documentStorageService.getDocumentById(state.documentId);
      
      if (!document || !document.content) {
        throw new Error(`Document not found or empty: ${state.documentId}`);
      }
      
      extractionResult = {
        text: document.content,
        structuredData: document.structuredData || {},
        metadata: document.metadata || {},
        confidence: 1.0 // Document already processed
      };
    }
    
    const now = new Date().toISOString();
    
    // Update workflow state
    const stateUpdate: PartialWorkflowState = {
      extractedData: {
        text: extractionResult.text,
        metadata: {
          ...extractionResult.metadata,
          extractedAt: now
        },
        structuredData: extractionResult.structuredData,
        confidence: extractionResult.confidence,
        extractedAt: now
      },
      // Update progress
      progress: {
        ...state.progress,
        currentStep: 'extraction_completed',
        percentage: 30,
        phase: 'EXTRACTION_COMPLETED'
      },
      workflowUpdatedAt: now
    };
    
    nodeLogger.info('Document extraction completed', {
      textLength: extractionResult.text.length,
      confidence: extractionResult.confidence
    });
    
    return stateUpdate;
  } catch (error) {
    // Use centralized error handling utility
    return handleNodeError(error, 'extraction', state, nodeLogger);
  }
}
```

### Node Implementation Guidelines

For each node, follow these guidelines:

1. **Single Responsibility**: Each node should do exactly one thing.
2. **State Updates**: Return only the part of the state that changes.
3. **Error Handling**: Use centralized error handling utility.
4. **Logging**: Include detailed logging for debugging.
5. **Progress Tracking**: Update progress in the state.
6. **Validation**: Validate input state before processing.
7. **Service Calls**: Delegate core logic to services.

### Example Implementation for Other Nodes

**Upload Node**:
```typescript
// workflow/nodes/upload-node.ts

import { WorkflowState, PartialWorkflowState } from '../state/workflow-state';
import { storageService } from '../../services/document/storage-service';
import { handleNodeError } from '../utils/error-handler';
import logger from '@/lib/logger';

export async function uploadNode(
  state: WorkflowState
): Promise<PartialWorkflowState> {
  const nodeLogger = logger.withMetadata({
    module: 'UploadNode',
    threadId: state.threadId
  });
  
  try {
    nodeLogger.info('Starting document upload');
    
    if (!state.file) {
      throw new Error('File is required for upload');
    }
    
    // Upload the file
    const uploadResult = await storageService.uploadDocument(
      state.patientId,
      state.file,
      {
        tags: ['uploaded_via_workflow']
      }
    );
    
    const now = new Date().toISOString();
    
    // Update workflow state
    return {
      documentId: uploadResult.documentId,
      documentMetadata: {
        fileName: state.file.name,
        fileSize: state.file.size,
        fileType: state.file.type,
        uploadedAt: now,
        hash: uploadResult.hash
      },
      progress: {
        ...state.progress,
        currentStep: 'upload_completed',
        percentage: 20,
        phase: 'UPLOAD_COMPLETED'
      },
      workflowUpdatedAt: now
    };
  } catch (error) {
    return handleNodeError(error, 'upload', state, nodeLogger);
  }
}
```

**Verification Initiation Node**:
```typescript
// workflow/nodes/verification/initiate-verification-node.ts

import { WorkflowState, PartialWorkflowState } from '../../state/workflow-state';
import { verificationService } from '../../../services/verification/verification-service';
import { handleNodeError } from '../../utils/error-handler';
import logger from '@/lib/logger';

export async function initiateVerificationNode(
  state: WorkflowState
): Promise<PartialWorkflowState> {
  const nodeLogger = logger.withMetadata({
    module: 'InitiateVerificationNode',
    threadId: state.threadId,
    documentId: state.documentId
  });
  
  try {
    nodeLogger.info('Initiating verification process');
    
    if (!state.extractedData?.text) {
      throw new Error('Extracted data is required for verification');
    }
    
    // Call verification service to start verification
    const verificationResult = await verificationService.generateVerification({
      document: state.extractedData.text,
      documentId: state.documentId,
      patientId: state.patientId
    });
    
    if (!verificationResult.success) {
      throw new Error(`Verification initialization failed: ${verificationResult.error?.message}`);
    }
    
    const now = new Date().toISOString();
    
    // Update workflow state
    return {
      verification: {
        ...state.verification,
        status: 'in_progress',
        verificationStartedAt: now
      },
      progress: {
        ...state.progress,
        currentStep: 'verification_initiated',
        percentage: 50,
        phase: 'VERIFICATION_INITIATED'
      },
      interactionHistory: [
        ...(state.interactionHistory || []),
        {
          timestamp: now,
          message: 'Verification process initiated',
          userId: state.userId,
          role: 'system',
          contextual: {
            step: 'verification_initiated'
          }
        }
      ],
      workflowUpdatedAt: now
    };
  } catch (error) {
    return handleNodeError(error, 'verification_initiation', state, nodeLogger);
  }
}
```

### Edge Cases and Considerations

- **Input Validation**: Ensure each node validates its inputs to avoid runtime errors.
- **Stateless Design**: Nodes should be stateless and rely only on the input state.
- **Error Recovery**: Consider how to recover from errors in long-running workflows.
- **Large Data Handling**: Be careful with large data in the state (e.g., extracted text).
- **Idempotency**: Ensure nodes can be safely retried if they fail.
- **Timeout Handling**: Consider adding timeout logic for long-running operations.

---

## 5. Define Workflow Graphs

- **Files**:
  - `workflow/graphs/main-workflow.ts`
  - `workflow/graphs/verification-graph.ts`
- **Action**: Create
- **Description**:
  - Workflow graphs in LangGraph.js define how nodes connect and execute. They orchestrate the flow of data between nodes and manage state transitions.

### Main Workflow Graph Implementation

```typescript
// workflow/graphs/main-workflow.ts

import { StateGraph } from '@langchain/langgraph';
import { WorkflowState, createInitialWorkflowState } from '../state/workflow-state';
import { SupabaseCheckpointer, supabaseCheckpointer } from '../checkpointer/supabase-checkpointer';
import logger from '@/lib/logger';

// Import workflow nodes
import { uploadNode } from '../nodes/upload-node';
import { extractionNode } from '../nodes/extraction-node';
import { analysisNode } from '../nodes/analysis-node';
import { storageNode } from '../nodes/storage-node';
import { verificationGraph } from './verification-graph';
import { reportGenerationNode } from '../nodes/report-generation-node';
import { interactionNode } from '../nodes/interaction-node';
import { errorNode } from '../nodes/error-node';

/**
 * Creates and configures the main workflow graph for document processing
 * 
 * The workflow follows this sequence:
 * 1. Upload document
 * 2. Extract text and data
 * 3. Analyze content
 * 4. Store processed document
 * 5. Verify content (subgraph)
 * 6. Generate report
 * 7. Handle user interactions
 * 
 * Error paths are also defined to handle failures at each step.
 * 
 * @param checkpointer Optional custom checkpointer (defaults to Supabase)
 * @returns Compiled workflow graph ready for execution
 */
export function createMainWorkflowGraph(
  checkpointer: SupabaseCheckpointer = supabaseCheckpointer
): StateGraph<WorkflowState> {
  const workflowLogger = logger.withMetadata({
    module: 'MainWorkflowGraph',
  });
  
  workflowLogger.info('Creating main workflow graph');
  
  // Create state graph with channels
  const graph = new StateGraph<WorkflowState>({
    channels: {
      // Define any additional channels here
      interrupt: {},
    }
  });
  
  // Add nodes to the graph
  graph.addNode('upload', uploadNode);
  graph.addNode('extraction', extractionNode);
  graph.addNode('analysis', analysisNode);
  graph.addNode('storage', storageNode);
  graph.addNode('verification', verificationGraph); // Using verification subgraph
  graph.addNode('report_generation', reportGenerationNode);
  graph.addNode('interaction', interactionNode);
  graph.addNode('error', errorNode);

  // Define edges between nodes (normal flow)
  graph.addEdge('upload', 'extraction');
  graph.addEdge('extraction', 'analysis');
  graph.addEdge('analysis', 'storage');
  graph.addEdge('storage', 'verification');
  
  // Conditional edges based on verification status
  graph.addConditionalEdges(
    'verification',
    (state) => {
      if (state.verification.status === 'completed') {
        return 'report_generation';
      }
      return 'interaction';
    }
  );
  
  graph.addEdge('report_generation', 'interaction');
  
  // Define error edges
  graph.addEdge('upload', 'error', { channel: 'interrupt' });
  graph.addEdge('extraction', 'error', { channel: 'interrupt' });
  graph.addEdge('analysis', 'error', { channel: 'interrupt' });
  graph.addEdge('storage', 'error', { channel: 'interrupt' });
  graph.addEdge('verification', 'error', { channel: 'interrupt' });
  graph.addEdge('report_generation', 'error', { channel: 'interrupt' });
  
  // Define recovery paths
  graph.addEdge('error', 'upload', { 
    condition: (state) => state.error?.step === 'upload' && state.error?.recoverable 
  });
  graph.addEdge('error', 'extraction', {
    condition: (state) => state.error?.step === 'extraction' && state.error?.recoverable
  });
  // Add similar recovery paths for other steps

  // Set the entry point
  graph.setEntryPoint('upload');
  
  // Compile the graph
  const compiledGraph = graph.compile({ checkpointer });
  
  workflowLogger.info('Main workflow graph created successfully');
  
  return compiledGraph;
}

/**
 * Singleton instance of the main workflow graph
 */
export const mainWorkflowGraph = createMainWorkflowGraph();

/**
 * Creates initial state and invokes the workflow
 * 
 * @param patientId Patient ID
 * @param userId User ID
 * @param file Optional file to process
 * @param metadata Optional additional metadata
 * @returns Promise resolving to the thread ID
 */
export async function startMainWorkflow(
  patientId: string,
  userId: string,
  file?: File,
  metadata: Record<string, any> = {}
): Promise<string> {
  const threadId = crypto.randomUUID();
  
  // Create initial state
  const initialState = createInitialWorkflowState(patientId, userId, threadId);
  
  // Add file if provided
  if (file) {
    initialState.file = file;
    initialState.documentMetadata = {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    };
  }
  
  // Add additional metadata
  initialState.context = metadata;
  
  // Start the workflow
  await mainWorkflowGraph.invoke(initialState, {
    configurable: { thread_id: threadId }
  });
  
  return threadId;
}
```

### Verification Subgraph Implementation

```typescript
// workflow/graphs/verification-graph.ts

import { StateGraph } from '@langchain/langgraph';
import { WorkflowState } from '../state/workflow-state';
import logger from '@/lib/logger';

// Import verification-specific nodes
import { initiateVerificationNode } from '../nodes/verification/initiate-verification-node';
import { processCorrectionNode } from '../nodes/verification/process-correction-node';
import { completeVerificationNode } from '../nodes/verification/complete-verification-node';

/**
 * Creates and configures the verification subgraph
 * 
 * The verification process follows this sequence:
 * 1. Initiate verification
 * 2. Process corrections (potentially multiple times)
 * 3. Complete verification
 * 
 * @returns Verification subgraph for inclusion in the main workflow
 */
export const verificationGraph = (): StateGraph<WorkflowState> => {
  const verificationLogger = logger.withMetadata({
    module: 'VerificationGraph',
  });
  
  verificationLogger.info('Creating verification subgraph');
  
  // Create state graph for verification
  const graph = new StateGraph<WorkflowState>({
    channels: {
      // Define any additional channels
      interrupt: {},
    }
  });
  
  // Add verification nodes
  graph.addNode('initiate', initiateVerificationNode);
  graph.addNode('process_correction', processCorrectionNode);
  graph.addNode('complete', completeVerificationNode);
  
  // Define edges
  graph.addEdge('initiate', 'process_correction');
  
  // Conditional edge based on verification status
  graph.addConditionalEdges(
    'process_correction',
    (state) => {
      // Check if corrections are complete
      if (state.verification.status === 'completed') {
        return 'complete';
      }
      // Otherwise, continue processing corrections
      return 'process_correction';
    }
  );
  
  // Set entry point
  graph.setEntryPoint('initiate');
  
  verificationLogger.info('Verification subgraph created successfully');
  
  return graph;
}
```

### Handling User Interactions

For workflows that require user input (like verification corrections), implement a mechanism to pause the workflow and resume it when input is received:

```typescript
// workflow/nodes/verification/process-correction-node.ts

import { WorkflowState, PartialWorkflowState } from '../../state/workflow-state';
import { verificationService } from '../../../services/verification/verification-service';
import { handleNodeError } from '../../utils/error-handler';
import logger from '@/lib/logger';

export async function processCorrectionNode(
  state: WorkflowState
): Promise<PartialWorkflowState> {
  const nodeLogger = logger.withMetadata({
    module: 'ProcessCorrectionNode',
    threadId: state.threadId,
    documentId: state.documentId
  });
  
  try {
    nodeLogger.info('Processing verification correction');
    
    // Check if we have user input to process
    if (state.verification.userInput) {
      // Process the user's correction
      nodeLogger.info('Processing user correction input');
      
      const correctionResult = await verificationService.processCorrection({
        corrections: state.verification.userInput,
        documentId: state.documentId,
        userId: state.userId
      });
      
      if (!correctionResult.success) {
        throw new Error(`Correction processing failed: ${correctionResult.error?.message}`);
      }
      
      const now = new Date().toISOString();
      
      // Add the correction to the history
      const newCorrection = {
        id: crypto.randomUUID(),
        field: state.verification.userInput.field || 'unknown',
        originalValue: state.verification.userInput.originalValue || '',
        correctedValue: state.verification.userInput.correctedValue || '',
        timestamp: now,
        userId: state.userId
      };
      
      // Check if all corrections are complete
      const isComplete = state.verification.userInput.isLastCorrection === true;
      
      // Update workflow state
      return {
        verification: {
          ...state.verification,
          corrections: [...state.verification.corrections, newCorrection],
          status: isComplete ? 'completed' : 'in_progress',
          userInput: undefined // Clear the input now that we've processed it
        },
        progress: {
          ...state.progress,
          currentStep: isComplete ? 'verification_completed' : 'verification_in_progress',
          percentage: isComplete ? 70 : 60,
          phase: isComplete ? 'VERIFICATION_COMPLETED' : 'VERIFICATION_IN_PROGRESS'
        },
        workflowUpdatedAt: now
      };
    }
    
    // If no user input, we need to pause and wait for input
    nodeLogger.info('No user input available, pausing workflow');
    
    // In LangGraph.js, returning undefined will pause the workflow
    return undefined;
  } catch (error) {
    return handleNodeError(error, 'process_correction', state, nodeLogger);
  }
}
```

### Edge Cases and Considerations

- **Workflow Pausing**: Use `undefined` returns or dedicated APIs to pause workflows awaiting user input.
- **Recovery from Failures**: Implement recovery paths for each node.
- **Conditional Logic**: Use conditional edges to create branching workflows.
- **Subgraphs**: Create subgraphs for complex steps like verification.
- **State Management**: Ensure the state is always consistent, even after errors.
- **Performance**: Consider the performance impact of large workflows.
- **Monitoring**: Implement logging and monitoring at the graph level.

---

## 6. Implement Error Handling

- **File**: `workflow/utils/error-handler.ts`
- **Action**: Create
- **Description**:
  - Implement a centralized error handling utility for consistent error management across workflow nodes.

### Implementation

```typescript
// workflow/utils/error-handler.ts

import { WorkflowState, PartialWorkflowState } from '../state/workflow-state';
import { ApplicationError, ExternalServiceError, ValidationError, normalizeError } from '@/lib/errors';
import logger from '@/lib/logger';

/**
 * Centralized error handling for workflow nodes
 * 
 * @param error Error that occurred
 * @param step Current workflow step where the error occurred
 * @param state Current workflow state
 * @param nodeLogger Logger instance from the node
 * @returns Partial workflow state update with error information
 */
export function handleNodeError(
  error: unknown,
  step: string,
  state: WorkflowState,
  nodeLogger?: any
): PartialWorkflowState {
  // Use provided logger or create a new one
  const errorLogger = nodeLogger || logger.withMetadata({
    module: 'ErrorHandler',
    step,
    threadId: state.threadId
  });
  
  // Normalize error to ensure consistent structure
  const normalizedError = normalizeError(error);
  
  // Log the error
  errorLogger.error(`Error in workflow step '${step}'`, {
    errorCode: normalizedError.code,
    errorMessage: normalizedError.message,
    errorDetails: normalizedError.data
  }, normalizedError);
  
  // Determine if error is recoverable
  const isRecoverable = determineRecoverability(normalizedError, step);
  
  const now = new Date().toISOString();
  
  // Return state update with error information
  return {
    error: {
      message: normalizedError.message,
      code: normalizedError.code,
      step,
      timestamp: now,
      recoverable: isRecoverable,
      details: {
        ...normalizedError.data,
        stack: normalizedError.stack
      }
    },
    progress: {
      ...state.progress,
      currentStep: 'error',
      phase: 'ERROR'
    },
    interactionHistory: [
      ...(state.interactionHistory || []),
      {
        timestamp: now,
        message: `Error in ${step}: ${normalizedError.message}`,
        userId: 'system',
        role: 'system',
        contextual: {
          step: 'error',
          intent: 'error_notification'
        }
      }
    ],
    workflowUpdatedAt: now
  };
}

/**
 * Determine if an error is recoverable based on error type and context
 * 
 * @param error Normalized error
 * @param step Current workflow step
 * @returns Boolean indicating if the error is recoverable
 */
function determineRecoverability(
  error: ApplicationError,
  step: string
): boolean {
  // Validation errors are generally recoverable
  if (error instanceof ValidationError) {
    return true;
  }
  
  // External service errors may be recoverable (e.g., transient network issues)
  if (error instanceof ExternalServiceError) {
    // Check error codes that indicate transient issues
    const transientErrorCodes = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'RATE_LIMITED',
      'SERVICE_UNAVAILABLE'
    ];
    
    return transientErrorCodes.includes(error.code || '');
  }
  
  // Step-specific recovery rules
  switch (step) {
    case 'upload':
      // Most upload errors are recoverable
      return true;
    
    case 'extraction':
      // Some extraction errors might be recoverable
      return error.code !== 'EXTRACTION_INVALID_FORMAT';
    
    case 'verification':
      // Most verification errors are recoverable
      return true;
    
    default:
      // Default to non-recoverable for safety
      return false;
  }
}

/**
 * Get recommended recovery actions based on error and step
 * 
 * @param error Normalized error
 * @param step Current workflow step
 * @returns Array of recommended recovery actions
 */
export function getRecoveryActions(
  error: ApplicationError,
  step: string
): string[] {
  const actions: string[] = [];
  
  // Basic recovery actions
  if (error instanceof ValidationError) {
    actions.push('fix_input_data');
  }
  
  if (error instanceof ExternalServiceError) {
    actions.push('retry');
    actions.push('check_service_status');
  }
  
  // Step-specific recovery actions
  switch (step) {
    case 'upload':
      actions.push('try_different_file');
      actions.push('verify_file_format');
      break;
    
    case 'extraction':
      actions.push('try_different_extractor');
      actions.push('manual_extraction');
      break;
    
    case 'verification':
      actions.push('manual_verification');
      break;
    
    default:
      actions.push('contact_support');
  }
  
  return actions;
}

/**
 * Create a user-friendly error message
 * 
 * @param error Normalized error
 * @param step Current workflow step
 * @returns User-friendly error message
 */
export function createUserErrorMessage(
  error: ApplicationError,
  step: string
): string {
  // Basic error mapping
  if (error instanceof ValidationError) {
    return `The information provided appears to be invalid: ${error.message}`;
  }
  
  if (error instanceof ExternalServiceError) {
    return `We're having trouble connecting to our services. Please try again in a moment.`;
  }
  
  // Step-specific error messages
  switch (step) {
    case 'upload':
      return `There was a problem uploading your document. Please check the file and try again.`;
    
    case 'extraction':
      return `We couldn't process the text in your document. It may be in an unsupported format or have unclear content.`;
    
    case 'verification':
      return `There was an issue during verification. Your changes may not have been saved properly.`;
    
    default:
      return `An unexpected error occurred. Our team has been notified and we're working to fix it.`;
  }
}
```

### Error Notification Utility

Consider adding a utility to notify users of errors:

```typescript
// workflow/utils/error-notifier.ts

import { ApplicationError } from '@/lib/errors';
import { createUserErrorMessage, getRecoveryActions } from './error-handler';
import logger from '@/lib/logger';

interface NotificationOptions {
  userId: string;
  channel?: 'email' | 'in-app' | 'both';
  priority?: 'low' | 'medium' | 'high';
}

/**
 * Notify a user about a workflow error
 * 
 * @param error Error to notify about
 * @param step Workflow step where the error occurred
 * @param options Notification options
 * @returns Promise resolving to boolean indicating success
 */
export async function notifyUserOfError(
  error: ApplicationError,
  step: string,
  options: NotificationOptions
): Promise<boolean> {
  const notificationLogger = logger.withMetadata({
    module: 'ErrorNotifier',
    step,
    userId: options.userId
  });
  
  try {
    const userMessage = createUserErrorMessage(error, step);
    const recoveryActions = getRecoveryActions(error, step);
    
    notificationLogger.info('Sending error notification to user', {
      channel: options.channel || 'in-app',
      priority: options.priority || 'medium'
    });
    
    // Implementation would depend on your notification system
    // For example, sending to a notification service
    
    return true;
  } catch (notifyError) {
    notificationLogger.error('Failed to send error notification', {}, notifyError);
    return false;
  }
}
```

### Edge Cases and Considerations

- **Error Classification**: Categorize errors by severity, source, and recoverability.
- **Graceful Degradation**: Implement fallback mechanisms for critical steps.
- **Rate Limiting**: Prevent flooding users with duplicate error notifications.
- **Error Aggregation**: Group similar errors to avoid overwhelming logs.
- **Actionable Errors**: Ensure error messages suggest next steps where possible.
- **Context Preservation**: Maintain enough context in errors to diagnose issues.
- **Security**: Be careful not to expose sensitive information in error messages.

---

## 7. Update API Endpoints

- **Files**:
  - `app/api/workflow/start/route.ts`
  - `app/api/workflow/[workflowId]/status/route.ts`
  - `app/api/workflow/[workflowId]/input/route.ts`
  - `app/api/workflow/[workflowId]/abort/route.ts`
- **Action**: Create
- **Description**:
  - Create REST API endpoints to interact with workflows, allowing clients to start, monitor, provide input to, and abort workflows.

### Start Workflow Endpoint

```typescript
// app/api/workflow/start/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { mainWorkflowGraph, startMainWorkflow } from '@/workflow/graphs/main-workflow';
import { createInitialWorkflowState } from '@/workflow/state/workflow-state';
import { getCurrentUser } from '@/lib/auth/session';
import logger from '@/lib/logger';

/**
 * API endpoint for starting a new workflow
 * 
 * @param req NextRequest object
 * @returns NextResponse with workflow thread ID
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const apiLogger = logger.withMetadata({
    module: 'API',
    endpoint: '/api/workflow/start'
  });
  
  try {
    // Get current user from session
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse request JSON
    const body = await req.json();
    
    // Validate required fields
    if (!body.patientId) {
      return NextResponse.json(
        { error: 'Patient ID is required' },
        { status: 400 }
      );
    }
    
    apiLogger.info('Starting workflow', {
      userId: user.id,
      patientId: body.patientId
    });
    
    // Start the workflow
    const threadId = await startMainWorkflow(
      body.patientId,
      user.id,
      body.file,
      body.metadata
    );
    
    apiLogger.info('Workflow started successfully', {
      threadId,
      userId: user.id,
      patientId: body.patientId
    });
    
    // Return the thread ID
    return NextResponse.json({
      success: true,
      threadId,
      message: 'Workflow started successfully'
    });
  } catch (error) {
    apiLogger.error('Error starting workflow', {}, error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof Error && 'code' in error ? (error as any).code : 'UNKNOWN_ERROR'
      },
      { status: 500 }
    );
  }
}
```

### Get Workflow Status Endpoint

```typescript
// app/api/workflow/[workflowId]/status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseCheckpointer } from '@/workflow/checkpointer/supabase-checkpointer';
import { getCurrentUser } from '@/lib/auth/session';
import logger from '@/lib/logger';

/**
 * API endpoint for checking workflow status
 * 
 * @param req NextRequest object
 * @param params Route parameters containing workflowId
 * @returns NextResponse with workflow status
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { workflowId: string } }
): Promise<NextResponse> {
  const apiLogger = logger.withMetadata({
    module: 'API',
    endpoint: '/api/workflow/[workflowId]/status',
    workflowId: params.workflowId
  });
  
  try {
    // Get current user from session
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { workflowId } = params;
    
    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }
    
    apiLogger.info('Checking workflow status', {
      userId: user.id,
      workflowId
    });
    
    // Load the workflow state
    const state = await supabaseCheckpointer.load(workflowId);
    
    if (!state || Object.keys(state).length === 0) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }
    
    // Check if user has access to this workflow
    if (state.userId !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Return workflow status information
    return NextResponse.json({
      success: true,
      workflowId,
      status: {
        step: state.progress.currentStep,
        percentage: state.progress.percentage,
        phase: state.progress.phase,
        isCompleted: state.progress.isCompleted,
        error: state.error
      },
      documentId: state.documentId,
      lastUpdated: state.workflowUpdatedAt
    });
  } catch (error) {
    apiLogger.error('Error checking workflow status', {}, error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

### Provide Input to Workflow Endpoint

```typescript
// app/api/workflow/[workflowId]/input/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { mainWorkflowGraph } from '@/workflow/graphs/main-workflow';
import { supabaseCheckpointer } from '@/workflow/checkpointer/supabase-checkpointer';
import { getCurrentUser } from '@/lib/auth/session';
import logger from '@/lib/logger';

/**
 * API endpoint for providing input to a paused workflow
 * 
 * @param req NextRequest object
 * @param params Route parameters containing workflowId
 * @returns NextResponse with workflow status
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { workflowId: string } }
): Promise<NextResponse> {
  const apiLogger = logger.withMetadata({
    module: 'API',
    endpoint: '/api/workflow/[workflowId]/input',
    workflowId: params.workflowId
  });
  
  try {
    // Get current user from session
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { workflowId } = params;
    
    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }
    
    // Parse request JSON
    const body = await req.json();
    
    apiLogger.info('Providing input to workflow', {
      userId: user.id,
      workflowId,
      inputType: body.type
    });
    
    // Load the workflow state
    const state = await supabaseCheckpointer.load(workflowId);
    
    if (!state || Object.keys(state).length === 0) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }
    
    // Check if user has access to this workflow
    if (state.userId !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Check if the workflow is waiting for input
    if (!state.progress || state.progress.isCompleted) {
      return NextResponse.json(
        { error: 'Workflow is not waiting for input or is already completed' },
        { status: 400 }
      );
    }
    
    // Update state with user input based on input type
    if (body.type === 'verification_correction') {
      // Update verification section with user correction
      state.verification.userInput = {
        field: body.field,
        originalValue: body.originalValue,
        correctedValue: body.correctedValue,
        isLastCorrection: body.isLastCorrection
      };
    } else if (body.type === 'user_message') {
      // Add to interaction history
      state.interactionHistory = [
        ...(state.interactionHistory || []),
        {
          timestamp: new Date().toISOString(),
          message: body.message,
          userId: user.id,
          role: 'user',
          contextual: {
            step: state.progress.currentStep,
            intent: body.intent
          }
        }
      ];
    } else {
      return NextResponse.json(
        { error: 'Invalid input type' },
        { status: 400 }
      );
    }
    
    // Update workflow with new user input
    state.workflowUpdatedAt = new Date().toISOString();
    
    // Resume the workflow
    const result = await mainWorkflowGraph.invoke(state, {
      configurable: { thread_id: workflowId }
    });
    
    apiLogger.info('Workflow resumed with user input', {
      workflowId,
      isCompleted: result.state.progress.isCompleted,
      currentStep: result.state.progress.currentStep
    });
    
    // Return updated status
    return NextResponse.json({
      success: true,
      workflowId,
      status: {
        step: result.state.progress.currentStep,
        percentage: result.state.progress.percentage,
        phase: result.state.progress.phase,
        isCompleted: result.state.progress.isCompleted
      },
      message: 'Workflow updated with user input'
    });
  } catch (error) {
    apiLogger.error('Error providing input to workflow', {}, error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

### Abort Workflow Endpoint

```typescript
// app/api/workflow/[workflowId]/abort/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { mainWorkflowGraph } from '@/workflow/graphs/main-workflow';
import { supabaseCheckpointer } from '@/workflow/checkpointer/supabase-checkpointer';
import { getCurrentUser } from '@/lib/auth/session';
import logger from '@/lib/logger';

/**
 * API endpoint for aborting a workflow
 * 
 * @param req NextRequest object
 * @param params Route parameters containing workflowId
 * @returns NextResponse with abort status
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { workflowId: string } }
): Promise<NextResponse> {
  const apiLogger = logger.withMetadata({
    module: 'API',
    endpoint: '/api/workflow/[workflowId]/abort',
    workflowId: params.workflowId
  });
  
  try {
    // Get current user from session
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { workflowId } = params;
    
    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }
    
    apiLogger.info('Aborting workflow', {
      userId: user.id,
      workflowId
    });
    
    // Load the workflow state
    const state = await supabaseCheckpointer.load(workflowId);
    
    if (!state || Object.keys(state).length === 0) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }
    
    // Check if user has access to this workflow
    if (state.userId !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Check if the workflow is already completed
    if (state.progress && state.progress.isCompleted) {
      return NextResponse.json(
        { error: 'Workflow is already completed' },
        { status: 400 }
      );
    }
    
    // Mark the workflow as aborted
    state.progress = {
      ...state.progress,
      currentStep: 'aborted',
      percentage: 100,
      phase: 'ABORTED',
      isCompleted: true
    };
    
    state.error = {
      message: 'Workflow aborted by user',
      step: state.progress.currentStep,
      timestamp: new Date().toISOString(),
      recoverable: false,
      details: {
        abortedBy: user.id,
        reason: req.body ? await req.json().then(body => body.reason) : 'User requested'
      }
    };
    
    state.workflowUpdatedAt = new Date().toISOString();
    
    // Save the aborted state
    await supabaseCheckpointer.save(state, workflowId);
    
    apiLogger.info('Workflow aborted successfully', {
      workflowId,
      userId: user.id
    });
    
    // Return success response
    return NextResponse.json({
      success: true,
      workflowId,
      message: 'Workflow aborted successfully'
    });
  } catch (error) {
    apiLogger.error('Error aborting workflow', {}, error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

### API Authentication and Security

Implement middleware to handle authentication and authorization:

```typescript
// middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';

export const config = {
  matcher: ['/api/workflow/:path*']
};

export async function middleware(req: NextRequest) {
  // Verify authentication
  const authResult = await verifyAuth(req);
  
  if (!authResult.isAuthenticated) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  
  // Continue to the endpoint
  return NextResponse.next();
}
```

### Edge Cases and Considerations

- **Rate Limiting**: Implement rate limiting to prevent API abuse.
- **Input Validation**: Thoroughly validate all API inputs.
- **Authentication**: Ensure robust authentication for all endpoints.
- **Authorization**: Verify users can only access their own workflows.
- **Timeout Handling**: Handle timeouts for long-running workflows.
- **Concurrency**: Account for concurrent requests to the same workflow.
- **Idempotency**: Ensure API endpoints are idempotent where appropriate.
- **Large Payloads**: Handle uploading and processing of large payloads efficiently.

---

## 8. Integrate RAG and Perplexity Services

- **Files**:
  - `services/rag/rag-service.ts`
  - `services/perplexity/perplexity-service.ts`
- **Action**: Edit or Create
- **Description**:
  - Integrate Retrieval-Augmented Generation (RAG) and Perplexity AI capabilities into the workflow for enhanced document understanding and user interactions.

### RAG Service Implementation

```typescript
// services/rag/rag-service.ts

import { supabaseVectorStore } from '@/lib/vectorstore/supabase-store';
import { Document } from 'langchain/document';
import { VectorStoreRetriever } from 'langchain/vectorstores/base';
import logger from '@/lib/logger';

/**
 * Service for Retrieval-Augmented Generation (RAG)
 * This service enables contextual document retrieval to enhance LLM outputs
 */
export class RagService {
  private readonly logger = logger.withMetadata({
    module: 'RagService',
  });
  
  /**
   * Create a retriever for patient-specific documents
   * 
   * @param patientId Patient ID to retrieve documents for
   * @param options Retrieval options
   * @returns Retriever configured for the patient
   */
  async createPatientRetriever(
    patientId: string,
    options: {
      k?: number;
      filter?: Record<string, any>;
      scoreThreshold?: number;
    } = {}
  ): Promise<VectorStoreRetriever> {
    try {
      this.logger.info('Creating patient retriever', {
        patientId,
        k: options.k
      });
      
      // Create the retriever with patient filter
      const retriever = supabaseVectorStore.asRetriever({
        k: options.k || 5,
        filter: {
          ...options.filter,
          patientId: patientId
        },
        searchType: 'similarity',
        scoreThreshold: options.scoreThreshold || 0.7
      });
      
      return retriever;
    } catch (error) {
      this.logger.error('Failed to create patient retriever', {
        patientId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Retrieve relevant documents for a medical question
   * 
   * @param query The medical question or topic
   * @param patientId Optional patient ID to filter documents
   * @param options Additional retrieval options
   * @returns Retrieved documents with relevance scores
   */
  async retrieveForMedicalQuestion(
    query: string,
    patientId?: string,
    options: {
      k?: number;
      filter?: Record<string, any>;
      includeContent?: boolean;
    } = {}
  ): Promise<{
    documents: Document[];
    sources: { title: string; snippet: string; relevance: number }[];
  }> {
    try {
      this.logger.info('Retrieving documents for medical question', {
        queryLength: query.length,
        patientId
      });
      
      // Set up retriever
      const filter = {
        ...options.filter
      };
      
      if (patientId) {
        filter.patientId = patientId;
      }
      
      // Create the retriever
      const retriever = supabaseVectorStore.asRetriever({
        k: options.k || 5,
        filter,
        searchType: 'similarity_with_threshold'
      });
      
      // Retrieve documents
      const documents = await retriever.getRelevantDocuments(query);
      
      this.logger.info('Retrieved documents', {
        count: documents.length
      });
      
      // Format sources
      const sources = documents.map((doc, index) => ({
        title: doc.metadata.title || `Document ${index + 1}`,
        snippet: options.includeContent 
          ? doc.pageContent.substring(0, 200) + '...'
          : doc.metadata.snippet || 'No snippet available',
        relevance: doc.metadata.score || 1 - (index * 0.1)
      }));
      
      return { documents, sources };
    } catch (error) {
      this.logger.error('Failed to retrieve documents for medical question', {
        queryLength: query.length,
        patientId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Retrieve patient context for medical report generation
   * 
   * @param patientId Patient ID
   * @param options Additional retrieval options
   * @returns Comprehensive patient context
   */
  async retrievePatientContext(
    patientId: string,
    options: {
      includeHistory?: boolean;
      includeDemographics?: boolean;
      includeRecentDocuments?: boolean;
      maxDocuments?: number;
    } = {}
  ): Promise<{
    patientInfo: Record<string, any>;
    relevantDocuments: Document[];
    medicalHistory: string[];
  }> {
    try {
      this.logger.info('Retrieving patient context', {
        patientId,
        options
      });
      
      // Retrieve patient demographics
      let patientInfo = {};
      if (options.includeDemographics !== false) {
        patientInfo = await this.getPatientDemographics(patientId);
      }
      
      // Retrieve medical history
      let medicalHistory: string[] = [];
      if (options.includeHistory !== false) {
        medicalHistory = await this.getPatientMedicalHistory(patientId);
      }
      
      // Retrieve recent documents
      let relevantDocuments: Document[] = [];
      if (options.includeRecentDocuments !== false) {
        const retriever = await this.createPatientRetriever(patientId, {
          k: options.maxDocuments || 10
        });
        
        relevantDocuments = await retriever.getRelevantDocuments(
          "Patient's recent medical documents and test results"
        );
      }
      
      return {
        patientInfo,
        relevantDocuments,
        medicalHistory
      };
    } catch (error) {
      this.logger.error('Failed to retrieve patient context', {
        patientId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Get patient demographics
   * 
   * @param patientId Patient ID
   * @returns Patient demographic information
   */
  private async getPatientDemographics(
    patientId: string
  ): Promise<Record<string, any>> {
    // Implementation would depend on your patient data storage
    // This is a placeholder
    return {
      id: patientId,
      demographics: {
        age: 45,
        gender: 'female',
        bloodType: 'A+',
      }
    };
  }
  
  /**
   * Get patient medical history
   * 
   * @param patientId Patient ID
   * @returns Array of medical history items
   */
  private async getPatientMedicalHistory(
    patientId: string
  ): Promise<string[]> {
    // Implementation would depend on your patient data storage
    // This is a placeholder
    return [
      'Hypertension diagnosed in 2018',
      'Appendectomy in 2010',
      'Seasonal allergies'
    ];
  }
}

// Export singleton instance
export const ragService = new RagService();
```

### Perplexity Service Implementation

```typescript
// services/perplexity/perplexity-service.ts

import { PerplexityChat } from '@/lib/langchain/perplexity-chat-model';
import { RunnableSequence } from 'langchain/runnables';
import { PromptTemplate } from 'langchain/prompts';
import { StringOutputParser } from 'langchain/output_parsers';
import logger from '@/lib/logger';

/**
 * Service for interacting with the Perplexity API
 * Provides advanced question-answering and research capabilities
 */
export class PerplexityService {
  private readonly logger = logger.withMetadata({
    module: 'PerplexityService',
  });
  
  private readonly apiKey: string;
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PERPLEXITY_API_KEY || '';
    
    if (!this.apiKey) {
      this.logger.warn('No Perplexity API key provided');
    }
  }
  
  /**
   * Perform deep research on a medical topic
   * 
   * @param query Medical query to research
   * @param options Research options
   * @returns Research results
   */
  async performMedicalResearch(
    query: string,
    options: {
      patientContext?: string;
      temperature?: number;
      maxTokens?: number;
      includeSources?: boolean;
    } = {}
  ): Promise<{
    text: string;
    summary: string;
    keyFindings: string[];
    sources: { title: string; url: string; snippet?: string }[];
  }> {
    try {
      this.logger.info('Performing medical research', {
        queryLength: query.length,
        hasPatientContext: !!options.patientContext
      });
      
      // Create Perplexity model
      const model = new PerplexityChat({
        apiKey: this.apiKey,
        model: 'sonar-deep-research',
        temperature: options.temperature || 0.3,
        maxTokens: options.maxTokens || 4000,
        includeSources: options.includeSources !== false
      });
      
      // Create research prompt
      const promptTemplate = new PromptTemplate({
        template: `You are a medical research assistant providing evidence-based information. 
Thoroughly research the following medical question and provide a comprehensive answer with citations.

${options.patientContext ? 'PATIENT CONTEXT:\n{{patientContext}}\n\n' : ''}MEDICAL QUESTION: {{query}}

Provide a detailed, evidence-based answer that:
1. Directly addresses the question with current medical knowledge
2. Cites reputable medical sources and research
3. Presents balanced information on controversies or evolving areas
4. Highlights key findings and clinical implications
5. Avoids speculation and clearly distinguishes between established facts and emerging research

Your answer should be structured, thorough, and reflect the medical consensus where it exists.`,
        inputVariables: options.patientContext ? ['query', 'patientContext'] : ['query']
      });
      
      // Create research chain
      const chain = RunnableSequence.from([
        promptTemplate,
        model,
        new StringOutputParser()
      ]);
      
      // Run the chain
      const input = options.patientContext
        ? { query, patientContext: options.patientContext }
        : { query };
      
      const result = await chain.invoke(input);
      
      // Extract key findings and summary
      const keyFindings = this.extractKeyFindings(result);
      const summary = this.extractSummary(result);
      
      // Get sources from model metadata
      const sources = model.lastSources?.map(source => ({
        title: source.title || 'Unknown Source',
        url: source.url,
        snippet: source.snippet
      })) || [];
      
      this.logger.info('Medical research completed', {
        resultLength: result.length,
        keyFindingsCount: keyFindings.length,
        sourcesCount: sources.length
      });
      
      return {
        text: result,
        summary,
        keyFindings,
        sources
      };
    } catch (error) {
      this.logger.error('Medical research failed', {
        queryLength: query.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Perform medical diagnosis based on patient data
   * 
   * @param medicalQuery Diagnostic query
   * @param patientData Patient data and symptoms
   * @param options Diagnosis options
   * @returns Diagnostic assessment
   */
  async performMedicalDiagnosis(
    medicalQuery: string,
    patientData: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      includeSources?: boolean;
    } = {}
  ): Promise<{
    text: string;
    differentialDiagnosis: { condition: string; confidence: number; evidence: string }[];
    recommendedTests: string[];
    sources: { title: string; url: string; snippet?: string }[];
  }> {
    try {
      this.logger.info('Performing medical diagnosis', {
        queryLength: medicalQuery.length,
        patientDataLength: patientData.length
      });
      
      // Create Perplexity model
      const model = new PerplexityChat({
        apiKey: this.apiKey,
        model: 'sonar-deep-research',
        temperature: options.temperature || 0.2,
        maxTokens: options.maxTokens || 4000,
        includeSources: options.includeSources !== false
      });
      
      // Create diagnosis prompt
      const promptTemplate = new PromptTemplate({
        template: `You are a medical diagnostic assistant helping analyze patient data.
Carefully analyze the following patient information and diagnostic question.

PATIENT DATA:
{{patientData}}

DIAGNOSTIC QUESTION: {{query}}

Provide a detailed diagnostic assessment that:
1. Presents a ranked differential diagnosis with confidence levels and supporting evidence
2. Explains the clinical reasoning behind each potential diagnosis
3. Recommends appropriate follow-up tests or evaluations
4. Cites relevant medical literature to support your analysis
5. Notes any critical findings that require urgent attention
6. Acknowledges limitations of the available information

Structure your response with clear sections for Differential Diagnosis, Clinical Reasoning, Recommended Tests, and References.`,
        inputVariables: ['query', 'patientData']
      });
      
      // Create diagnosis chain
      const chain = RunnableSequence.from([
        promptTemplate,
        model,
        new StringOutputParser()
      ]);
      
      // Run the chain
      const result = await chain.invoke({
        query: medicalQuery,
        patientData
      });
      
      // Extract differential diagnosis and recommended tests
      const differentialDiagnosis = this.extractDifferentialDiagnosis(result);
      const recommendedTests = this.extractRecommendedTests(result);
      
      // Get sources from model metadata
      const sources = model.lastSources?.map(source => ({
        title: source.title || 'Unknown Source',
        url: source.url,
        snippet: source.snippet
      })) || [];
      
      this.logger.info('Medical diagnosis completed', {
        resultLength: result.length,
        diagnosisCount: differentialDiagnosis.length,
        testsCount: recommendedTests.length,
        sourcesCount: sources.length
      });
      
      return {
        text: result,
        differentialDiagnosis,
        recommendedTests,
        sources
      };
    } catch (error) {
      this.logger.error('Medical diagnosis failed', {
        queryLength: medicalQuery.length,
        patientDataLength: patientData.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Extract key findings from research text
   * 
   * @param text Research text
   * @returns Array of key findings
   */
  private extractKeyFindings(text: string): string[] {
    // Implementation would extract key findings from the text
    // This is a placeholder using regex
    const keyFindingsRegex = /(?:key findings|main findings|key points|findings):\s*\n((?:\s*[-•*]\s*[^\n]+\n)+)/i;
    const match = text.match(keyFindingsRegex);
    
    if (match && match[1]) {
      return match[1]
        .split('\n')
        .map(line => line.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean);
    }
    
    // Fallback: try to find bullet points
    const bulletPoints = text.match(/\n\s*[-•*]\s*([^\n]+)/g);
    if (bulletPoints) {
      return bulletPoints
        .map(line => line.replace(/^\s*[-•*]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 5);
    }
    
    return [];
  }
  
  /**
   * Extract summary from research text
   * 
   * @param text Research text
   * @returns Summary text
   */
  private extractSummary(text: string): string {
    // Implementation would extract a summary from the text
    // This is a placeholder using regex
    const summaryRegex = /(?:summary|conclusion|in summary|to summarize):\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/i;
    const match = text.match(summaryRegex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // Fallback: use first paragraph
    const firstParagraph = text.split('\n\n')[0];
    if (firstParagraph && firstParagraph.length > 100) {
      return firstParagraph.trim();
    }
    
    // Last resort: truncate text
    return text.substring(0, 200) + '...';
  }
  
  /**
   * Extract differential diagnosis from medical text
   * 
   * @param text Diagnostic text
   * @returns Array of potential diagnoses with confidence and evidence
   */
  private extractDifferentialDiagnosis(text: string): { condition: string; confidence: number; evidence: string }[] {
    // Implementation would extract differential diagnosis from the text
    // This is a placeholder
    const diagnosisSection = this.extractSection(text, 'differential diagnosis');
    
    if (!diagnosisSection) {
      return [];
    }
    
    // Try to find structured diagnoses
    const diagnoses: { condition: string; confidence: number; evidence: string }[] = [];
    
    // Pattern 1: Bullet points with condition and confidence
    const bulletPattern = /[-•*]\s*([^:]+):\s*(?:(\d+)%|confidence:?\s*(\d+)%|high|medium|low)\s*(?:evidence:?\s*([^\n]+))?/gi;
    let match;
    
    while ((match = bulletPattern.exec(diagnosisSection)) !== null) {
      const condition = match[1].trim();
      const confidencePercent = match[2] || match[3] || 0;
      const evidence = match[4]?.trim() || '';
      
      let confidence = parseInt(confidencePercent, 10) / 100;
      
      // Handle text confidence levels
      if (isNaN(confidence)) {
        if (diagnosisSection.toLowerCase().includes('high')) {
          confidence = 0.8;
        } else if (diagnosisSection.toLowerCase().includes('medium')) {
          confidence = 0.5;
        } else if (diagnosisSection.toLowerCase().includes('low')) {
          confidence = 0.2;
        } else {
          confidence = 0.5; // Default
        }
      }
      
      diagnoses.push({
        condition,
        confidence,
        evidence
      });
    }
    
    // Fallback: split by newlines
    if (diagnoses.length === 0) {
      const lines = diagnosisSection.split('\n').filter