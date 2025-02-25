# Firecrawl Research & Chat Integration

This document provides an overview of the Firecrawl service integration, deep research capabilities, and chat system in the Neuvia application.

## Table of Contents

1. [Firecrawl Service Architecture](#firecrawl-service-architecture)
2. [Research Implementation](#research-implementation)
3. [Chat Integration](#chat-integration)
4. [UI Components](#ui-components)
5. [Usage Examples](#usage-examples)

## Firecrawl Service Architecture

The Firecrawl service is implemented as a layered architecture with clear separation of concerns:

```
lib/services/firecrawl/
├── actions.ts      # Core API functions (search, extract, scrape, deepResearch)
├── client.ts       # Firecrawl client implementation and utilities
├── hooks.ts        # React hooks for components
├── types.ts        # TypeScript definitions
├── index.ts        # Public exports
└── __tests__/      # Test files
```

### Core Services

Firecrawl provides four primary services:

1. **Search**: Find relevant web pages based on a query
2. **Extract**: Extract structured data from web pages using prompts
3. **Scrape**: Retrieve and clean content from a specific URL
4. **Deep Research**: Combine search and extraction to perform comprehensive research

Each service follows a consistent pattern with error handling, retries, and standardized response formats.

### API Layer

The Firecrawl services are exposed through RESTful API endpoints:

```
app/api/firecrawl/
├── route.ts         # Main info endpoint
├── search/route.ts  # Search endpoint
├── extract/route.ts # Extract endpoint
├── scrape/route.ts  # Scrape endpoint
└── __tests__/       # API tests
```

Additionally, there's a dedicated deep research endpoint:

```
app/api/deep-research/route.ts
```

All API endpoints include:
- Authentication checks
- Rate limiting
- Request validation using Zod
- Standardized error handling and response formats

## Research Implementation

Research functionality is built on top of Firecrawl through a layered design:

### Processing Layer

```
lib/processing/
├── document-processing-service.ts   # Main orchestration service
├── research/
│   └── firecrawl-provider.ts        # Research provider using Firecrawl
└── types/
    ├── index.ts                     # Type exports
    └── research.ts                  # Research type definitions
```

The `DocumentProcessingService` serves as the main orchestration point for document processing workflows, including extraction, verification, research, and report generation.

### Research Provider

The `FirecrawlResearchProvider` is responsible for:
1. Mapping application research requests to Firecrawl calls
2. Converting Firecrawl responses to application data structures
3. Progress tracking and error handling
4. Extracting key findings from research results

### Workflow Hooks

Research functionality is available through specialized hooks:

```
lib/hooks/
├── use-document-processing.ts      # Document processing hook
├── use-verification.ts             # Verification hook
├── use-research.ts                 # Research hook
├── use-report.ts                   # Report generation hook
└── use-processing-workflow.ts      # Integrated workflow hook
```

The `useProcessingWorkflow` hook provides a unified interface for the entire document processing workflow.

## Chat Integration

The chat system integrates Firecrawl capabilities through several mechanisms:

### Chat API

The chat API endpoint (`app/api/chat/route.ts`) exposes Firecrawl tools for LLM use:
- `firecrawlSearch`: Search for information
- `firecrawlExtract`: Extract structured data
- `firecrawlScrape`: Scrape and clean content

### Chat Context

The chat context (`contexts/chat-context.tsx`) provides deep research functionality through:
1. Integration with the processing workflow
2. Methods for initiating research from chat
3. Methods for presenting research results in chat
4. State management for research and chat

## UI Components

The research UI components are organized into a cohesive system:

```
components/research/
├── firecrawl-research-panel.tsx    # Main panel component
├── results/
│   ├── search-results.tsx          # Search results component
│   ├── extract-results.tsx         # Extract results component
│   ├── scrape-results.tsx          # Scrape results component
│   └── __tests__/                  # Component tests
└── __tests__/                      # Panel tests
```

### Component Design

The UI components follow these design principles:
1. Use React hooks from the Firecrawl service layer
2. Implement proper loading states
3. Handle errors gracefully with user feedback
4. Provide clear visual feedback for state changes
5. Use animations for a polished user experience

### Demo Page

A dedicated demo page (`app/research-demo/page.tsx`) showcases the research UI components and provides usage instructions.

## Usage Examples

### Using the Firecrawl Hooks

```typescript
// Example: Search component using the Firecrawl hook
function SearchComponent() {
  const { 
    performSearch, 
    results, 
    isLoading 
  } = useFirecrawlSearch();

  const handleSearch = async (query: string) => {
    const response = await performSearch(query);
    if (response.success) {
      console.log(`Found ${response.data.length} results`);
    }
  };

  return (
    <div>
      {/* Component UI */}
    </div>
  );
}
```

### Using the DocumentProcessingService

```typescript
// Example: Performing research with the service
async function performResearch(query: string, document: VerifiedDocument) {
  const service = new DocumentProcessingService();
  
  const result = await service.performResearch(query, document, {
    onProgress: (progress) => {
      console.log(`Research progress: ${progress}%`);
    }
  });
  
  console.log(`Research completed with ${result.sources.length} sources`);
  return result;
}
```

### Adding to Chat

```typescript
// Example: Using deep research in chat
function ChatWithResearch() {
  const { performDeepResearch } = useChatContext();
  
  const handleResearchRequest = async (query: string) => {
    const result = await performDeepResearch(query, {
      depth: 'comprehensive',
      sourcesLimit: 10
    });
    
    if (result) {
      console.log(`Research found ${result.sources.length} sources`);
    }
  };
  
  return (
    <div>
      {/* Chat UI with research capability */}
    </div>
  );
}
```

## Best Practices

1. **Error Handling**: Always handle errors gracefully in UI components
2. **Progress Tracking**: Provide visual feedback for long-running operations
3. **Rate Limiting**: Be mindful of rate limits when making API calls
4. **Validation**: Validate user inputs before making service calls
5. **Testing**: Write tests for new components and service functions

## Extending the System

### Adding a New Research Provider

1. Create a new provider in `lib/processing/research/`
2. Implement the same interface as `FirecrawlResearchProvider`
3. Update the `DocumentProcessingService` to use the new provider

### Adding a New UI Component

1. Create a new component in `components/research/`
2. Use the appropriate Firecrawl hook from `lib/services/firecrawl/hooks.ts`
3. Follow the existing design patterns for loading states and error handling
4. Add tests in a `__tests__` directory 