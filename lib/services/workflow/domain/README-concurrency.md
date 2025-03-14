# Domain-Specific Concurrency Management

## Overview

This document describes the enhanced concurrency control system implemented in the workflow engine. The system provides domain-specific conflict resolution strategies that are explicitly defined and enforced consistently across the application.

## Key Improvements

1. **Domain-Specific Default Strategies**:
   - Each domain now has an explicit default concurrency strategy
   - Chat domain uses 'merge' by default (tolerant of concurrent updates)
   - Verification domain uses 'fail' by default (strict data integrity)
   - Document and Report domains use carefully selected strategies based on data sensitivity

2. **Field-Level Granularity**:
   - Individual fields can override the domain default strategy
   - Configuration specifies how arrays and nested objects should be merged
   - Special handling for sensitive data and large content

3. **Storage Strategies**:
   - Explicit storage strategies for large fields
   - Options: 'inline', 'separate-row', 'reference', 'event-sourced'
   - Large text content stored separately from metadata
   - References used to maintain relationships

4. **Configuration-Driven Approach**:
   - Centralized configuration in `domain-concurrency-config.ts`
   - No scattered, ad-hoc strategy selection throughout the codebase
   - Consistent error handling and conflict resolution

## Domain Configurations

### Chat Domain

```typescript
{
  defaultStrategy: 'merge',
  fields: {
    'messages': {
      conflictStrategy: 'append',
      storageStrategy: 'inline',
      arrayMergeStrategy: 'append'
    },
    'typingStatus': {
      conflictStrategy: 'force',
      storageStrategy: 'inline'
    },
    'extractedContent': {
      conflictStrategy: 'merge',
      storageStrategy: 'separate-row',
      tableName: 'chat_extractions'
    }
  }
}
```

### Verification Domain

```typescript
{
  defaultStrategy: 'fail',
  fields: {
    'verificationData': {
      conflictStrategy: 'fail',
      storageStrategy: 'inline',
      sensitive: true
    },
    'corrections': {
      conflictStrategy: 'field-specific',
      storageStrategy: 'event-sourced',
      arrayMergeStrategy: 'merge-by-id'
    }
  },
  // Custom merge function for verification data
  customMergeFunction: (current, incoming) => { ... }
}
```

## Usage

### In Base Workflow Processor

The `BaseWorkflowProcessor` class automatically uses domain-specific strategies:

```typescript
// Domain-aware metadata update
protected async updateMetadataSafely(
  workflowId: string,
  newMetadata: Record<string, unknown>,
  options: MetadataUpdateOptions = {}
): Promise<boolean> {
  // Get domain-specific configuration
  const domainConfig = getDomainConcurrencyConfig(this.domainName);
  
  // Use domain default strategy if not explicitly specified
  const conflictStrategy = options.conflictStrategy || domainConfig.defaultStrategy;
  
  // Handle large fields separately based on domain config
  const separatedFields = {};
  const inlineMetadata = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    if (shouldStoreFieldSeparately(this.domainName, key)) {
      // Store separately and keep reference
      separatedFields[key] = value;
      // ...
    }
  }
  
  // Apply domain-specific merge strategies
  // ...
}
```

### In Workflow State Manager

The state manager now respects domain information:

```typescript
// Get domain-specific configuration for proper error handling
const domainConfig = getDomainConcurrencyConfig(domainName);

// Map from domain step to appropriate error step
if (domainName === 'Chat') {
  targetErrorStep = 'chat_error';
} else if (domainName === 'Verification') {
  targetErrorStep = 'verification_failed';
}
```

## Benefits

1. **Reduced Data Loss**: By making conflict handling explicit and domain-aware, we minimize the risk of lost updates or data corruption.

2. **Improved Performance**: Large fields stored separately reduce the size of workflow state records and minimize conflict potential.

3. **Better Error Handling**: Domain-specific error states provide clearer context about failures and aid in recovery.

4. **Centralized Configuration**: All concurrency strategies are defined in one place, making them easier to review, update, and test.

5. **Consistent Implementation**: Domain processors automatically inherit appropriate strategies without having to reimplement conflict handling logic.

## Implementation Notes

- The system is backward compatible with existing code that doesn't specify domain information
- All strategies gracefully degrade to safe defaults if configuration is missing
- Extensive logging helps trace concurrency issues during development and production
- Field-level control allows fine-tuning without excessive complexity

## Testing

The concurrency system includes comprehensive tests:

```typescript
it('verifies Chat domain uses merge for messages and typingStatus', () => {
  const chatConfig = getDomainConcurrencyConfig('Chat');
  
  expect(chatConfig.defaultStrategy).toBe('merge');
  expect(chatConfig.fields.messages.conflictStrategy).toBe('append');
  expect(chatConfig.fields.typingStatus.conflictStrategy).toBe('force');
});
```