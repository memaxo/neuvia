# Document Analysis Services

This directory contains modular services for document analysis, designed to work with LangGraph.js. Each service is focused on a specific aspect of document analysis, ensuring clear separation of concerns and making them more composable and maintainable.

## Services Overview

### Document Type Service

`DocumentTypeService` is responsible for detecting and classifying document types based on content patterns. It analyzes document text to identify the most likely document type (progress note, discharge summary, etc.) and calculates a confidence score.

```typescript
import { DocumentTypeService } from '@/lib/services/document/analysis'

const typeService = new DocumentTypeService()
const result = await typeService.detectDocumentType(documentText)
// result contains: type, confidence, detectedSections, possibleTypes
```

### Document Section Service

`DocumentSectionService` focuses on detecting and extracting sections within medical documents (patient information, medications, assessment, etc.). It can identify section headers and split document text into structured sections.

```typescript
import { DocumentSectionService } from '@/lib/services/document/analysis'

const sectionService = new DocumentSectionService()
const sections = sectionService.splitTextBySections(documentText)
// sections contains: [{ section: 'medications', content: '...' }, ...]
```

### Key Point Service

`KeyPointService` extracts important points from document content. It scores sentences based on their relevance and importance, prioritizing clinically significant information.

```typescript
import { KeyPointService } from '@/lib/services/document/analysis'

const keyPointService = new KeyPointService()
const keyPoints = await keyPointService.extractKeyPoints(documentText, documentType)
// keyPoints contains: [{ text: 'Patient shows elevated blood pressure...', score: 0.9 }, ...]
```

## Utility Types and Constants

- `types.ts` - Contains type definitions specific to analysis services
- `errors.ts` - Custom error classes for better error handling
- `medical-document-patterns.ts` - Document patterns, section definitions, and classification rules

## Usage with LangGraph.js

These services are designed to be used with LangGraph.js nodes. They contain no workflow orchestration logic, progress tracking, or event emission, focusing solely on their core analysis responsibilities.

Example integration with a LangGraph.js node:

```typescript
import { DocumentTypeService } from '@/lib/services/document/analysis'
import type { WorkflowState } from '@/workflow/state/workflow-state'

const typeService = new DocumentTypeService()

export const documentTypeNode = async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
  try {
    const result = await typeService.detectDocumentType(state.extractedData.rawText)
    return {
      documentTypeInfo: result,
      documentType: result.type
    }
  } catch (error) {
    throw new Error(`Document type detection failed: ${error.message}`)
  }
}
```

## Legacy Compatibility

The old monolithic `DocumentAnalysisService` has been preserved as a compatibility layer that delegates to these new modular services. It's marked as deprecated and should be replaced with direct use of the modular services.