/**
 * Helper functions for handling namespaced domain metadata
 */

// The set of valid domain names for typed access
export type DomainName = 'Document' | 'Chat' | 'Verification' | 'Report' | 'Research';

// Interface for namespaced metadata structure
export interface NamespacedMetadata {
  // Each domain has its own namespace
  document?: Record<string, unknown>;
  chat?: Record<string, unknown>;
  verification?: Record<string, unknown>;
  report?: Record<string, unknown>;
  research?: Record<string, unknown>;
  workflow?: Record<string, unknown>; // Common workflow fields
  
  // Legacy fields can still be at the root level during migration
  [key: string]: unknown;
}

// Interface for domain metadata update
export interface DomainMetadataUpdate {
  // Version for migration tracking
  version?: number;
  
  // Last update timestamp
  updatedAt?: string;
  
  // Transaction ID for tracking
  transactionId?: string;
  
  // Data payload
  data?: Record<string, unknown>;
  
  // Other fields
  [key: string]: unknown;
}

/**
 * Updates domain-specific metadata in a namespaced structure
 * @param metadata Current metadata object
 * @param domainName Domain to update
 * @param update The update to apply
 * @returns Updated metadata object
 */
export function updateDomainMetadata(
  metadata: Record<string, unknown>,
  domainName: DomainName,
  update: DomainMetadataUpdate
): NamespacedMetadata {
  // Create a copy of the metadata
  const result = { ...metadata } as NamespacedMetadata;
  
  // Get the lowercase domain name for consistent access
  const namespace = domainName.toLowerCase();
  
  // Ensure the namespace exists
  if (!result[namespace] || typeof result[namespace] !== 'object') {
    result[namespace] = { version: 1 };
  }
  
  // Get the current domain metadata
  const current = result[namespace] as Record<string, unknown>;
  
  // Update with new metadata
  result[namespace] = {
    ...current,
    ...update,
    version: update.version || (current.version ? Number(current.version) + 1 : 1),
    updatedAt: update.updatedAt || new Date().toISOString()
  };
  
  return result;
}

/**
 * Gets domain-specific metadata from a workflow state
 * @param metadata The full workflow metadata
 * @param domainName The domain to get metadata for
 * @returns Domain-specific metadata or undefined if not found
 */
export function getDomainMetadata(
  metadata: Record<string, unknown>,
  domainName: DomainName
): Record<string, unknown> | undefined {
  const namespace = domainName.toLowerCase();
  
  // Check if metadata is already namespaced
  if (metadata[namespace] && typeof metadata[namespace] === 'object') {
    // Return the domain namespace
    return metadata[namespace] as Record<string, unknown>;
  }
  
  // Not found in namespaced format
  return undefined;
}

/**
 * Migrates legacy flat metadata to a namespaced format
 * This helps with transition from old structure to new
 * @param metadata The flat metadata structure
 * @param domainName The domain to migrate for
 * @returns Metadata with the specified domain in namespaced format
 */
export function migrateToNamespacedMetadata(
  metadata: Record<string, unknown>,
  domainName: string
): NamespacedMetadata {
  // Create a shallow copy of the metadata
  const result = { ...metadata } as NamespacedMetadata;
  const namespace = domainName.toLowerCase();
  
  // Common workflow fields to keep at root level
  const commonFields = [
    'workflowId', 
    'userId', 
    'createdAt', 
    'updatedAt',
    'currentStep',
    'previousStep',
    'status'
  ];
  
  // Domain-specific fields to migrate to namespace
  const domainFields: Record<string, string[]> = {
    document: [
      'documentId', 'documentType', 'filename', 'extractedText', 
      'pageCount', 'documentContent', 'contentSummary'
    ],
    chat: [
      'chatId', 'messageId', 'threadId', 'promptTemplate', 
      'chatHistory', 'latestMessage', 'aiModel'
    ],
    verification: [
      'verificationId', 'documentId', 'verificationStatus', 
      'verificationResult', 'corrections', 'summaryId'
    ],
    report: [
      'reportId', 'documentId', 'reportTitle', 'reportType',
      'reportContent', 'generatedBy', 'reportFormat' 
    ],
    research: [
      'researchId', 'query', 'sources', 'results',
      'searchTerms', 'lastSearched', 'searchStrategy'
    ]
  };
  
  // Get the fields for this domain
  const fieldsToMove = domainFields[namespace] || [];
  
  // Create the namespace if it doesn't exist
  if (!result[namespace] || typeof result[namespace] !== 'object') {
    result[namespace] = {
      version: 1,
      migratedAt: new Date().toISOString(),
      data: {}
    };
  }
  
  // Get the current domain metadata
  const domainMetadata = result[namespace] as Record<string, unknown>;
  
  // Ensure data property exists
  if (!domainMetadata.data || typeof domainMetadata.data !== 'object') {
    domainMetadata.data = {};
  }
  
  const dataObj = domainMetadata.data as Record<string, unknown>;
  
  // Move domain-specific fields to their namespace
  for (const key of Object.keys(metadata)) {
    if (fieldsToMove.includes(key)) {
      // Move to domain namespace .data
      dataObj[key] = metadata[key];
      
      // Remove from root if not in common fields
      if (!commonFields.includes(key)) {
        delete result[key];
      }
    }
  }
  
  return result;
}