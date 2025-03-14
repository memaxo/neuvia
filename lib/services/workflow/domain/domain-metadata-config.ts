/**
 * @fileoverview Domain-Specific Metadata Configuration
 * 
 * This file provides centralized configuration for how metadata is structured
 * across different workflow domains. Having explicit namespaces for each domain
 * helps prevent collisions and makes debugging easier.
 */

import { logger } from '@/lib/logger';

/**
 * Common metadata fields that apply to all domains
 */
export interface CommonMetadata {
  /** Metadata schema version for backward compatibility */
  version: number;
  
  /** Last update timestamp */
  updatedAt?: string;
  
  /** Transaction ID for tracking operations */
  transactionId?: string;
}

/**
 * Verification domain metadata
 */
export interface VerificationMetadata extends CommonMetadata {
  /** Verification-specific data */
  data?: {
    /** Current verification status */
    status?: string;
    
    /** Original summary ID that was verified */
    originalSummaryId?: string;
    
    /** Current version ID after verification/corrections */
    currentVersionId?: string;
    
    /** Count of corrections made */
    correctionCount?: number;
    
    /** When verification was completed */
    verifiedAt?: string;
    
    /** Who verified the document */
    verifiedBy?: string;
    
    /** History of corrections */
    corrections?: unknown[];
  };
  
  /** References to separately stored large fields */
  extractionId?: string;
}

/**
 * Document domain metadata
 */
export interface DocumentMetadata extends CommonMetadata {
  /** Document-specific data */
  data?: {
    /** Original filename */
    fileName?: string;
    
    /** File size in bytes */
    fileSize?: number;
    
    /** MIME type */
    mimeType?: string;
    
    /** Upload information */
    uploadInfo?: {
      uploadedAt?: string;
      uploadedBy?: string;
      source?: string;
    };
    
    /** Processing details */
    processing?: {
      startedAt?: string;
      completedAt?: string;
      status?: string;
    };
  };
  
  /** References to separately stored large fields */
  extractedTextId?: string;
  analysisId?: string;
}

/**
 * Chat domain metadata
 */
export interface ChatMetadata extends CommonMetadata {
  /** Chat-specific data */
  data?: {
    /** Chat configuration */
    config?: {
      model?: string;
      temperature?: number;
      prompt?: string;
    };
    
    /** State management */
    state?: {
      isTyping?: boolean;
      lastActive?: string;
      currentFocus?: string;
    };
    
    /** Message identifiers (lighter than full messages) */
    messageIds?: string[];
  };
  
  /** References to separately stored large fields */
  messagesId?: string;
  extractedContentId?: string;
}

/**
 * Report domain metadata
 */
export interface ReportMetadata extends CommonMetadata {
  /** Report-specific data */
  data?: {
    /** Report configuration */
    config?: {
      templateId?: string;
      format?: string;
      includeImages?: boolean;
    };
    
    /** Generation details */
    generation?: {
      startedAt?: string;
      completedAt?: string;
      generatedBy?: string;
      model?: string;
    };
    
    /** Version tracking */
    version?: {
      number?: number;
      createdAt?: string;
      changelog?: string;
    };
  };
  
  /** References to separately stored large fields */
  contentId?: string;
  templatesId?: string;
}

/**
 * Research domain metadata
 */
export interface ResearchMetadata extends CommonMetadata {
  /** Research-specific data */
  data?: {
    /** Query information */
    query?: {
      text?: string;
      parameters?: unknown;
      timestamp?: string;
    };
    
    /** Research sources */
    sources?: {
      count?: number;
      types?: string[];
    };
    
    /** Citation information */
    citations?: unknown[];
  };
  
  /** References to separately stored large fields */
  resultsId?: string;
}

/**
 * Union type of all domain metadata
 */
export interface NamespacedMetadata {
  /** Common workflow fields */
  workflow?: {
    progress?: number;
    phase?: string;
    error?: string | null;
    errorDetails?: Record<string, unknown>;
  };
  
  /** Domain-specific namespaces */
  verification?: VerificationMetadata;
  document?: DocumentMetadata;
  chat?: ChatMetadata;
  report?: ReportMetadata;
  research?: ResearchMetadata;
  
  /** Extension point for future domains */
  [key: string]: unknown;
}

/**
 * Maps domain names to their metadata types
 */
interface DomainMetadataTypeMap {
  'Verification': VerificationMetadata;
  'Document': DocumentMetadata;
  'Chat': ChatMetadata;
  'Report': ReportMetadata;
  'Research': ResearchMetadata;
}

/**
 * Get the appropriate domain namespace for a domain name
 */
export function getDomainNamespace(domain: string): string {
  const lowerDomain = domain.toLowerCase();
  
  if (lowerDomain.includes('verification')) return 'verification';
  if (lowerDomain.includes('document')) return 'document';
  if (lowerDomain.includes('chat')) return 'chat';
  if (lowerDomain.includes('report')) return 'report';
  if (lowerDomain.includes('research')) return 'research';
  
  logger.warn(`No namespace defined for domain: ${domain}. Using domain name directly.`);
  return lowerDomain;
}

/**
 * Initialize a new metadata object with namespaces
 */
export function initializeNamespacedMetadata(): NamespacedMetadata {
  return {
    workflow: {
      progress: 0,
      phase: 'initializing'
    }
  };
}

/**
 * Convert legacy flat metadata to namespaced format
 */
export function migrateToNamespacedMetadata(
  legacyMetadata: Record<string, unknown>,
  domain: string
): NamespacedMetadata {
  const namespace = getDomainNamespace(domain);
  const namespaced: NamespacedMetadata = initializeNamespacedMetadata();
  
  // Create domain namespace if it doesn't exist
  if (!namespaced[namespace]) {
    namespaced[namespace] = {
      version: 1,
      data: {}
    };
  }
  
  // Helper to detect domain-specific fields
  const belongsToDomain = (key: string, domainPrefix: string): boolean => {
    return key.toLowerCase().startsWith(domainPrefix) || 
           domainPrefix.includes(key.toLowerCase());
  };
  
  // Migrate legacy fields to appropriate namespaces
  for (const [key, value] of Object.entries(legacyMetadata)) {
    // Handle workflow standard fields
    if (['progress', 'phase', 'error', 'errorDetails'].includes(key)) {
      if (!namespaced.workflow) namespaced.workflow = {};
      namespaced.workflow[key as keyof typeof namespaced.workflow] = value as any;
    }
    // Handle verification fields
    else if (namespace === 'verification' || 
             belongsToDomain(key, 'verification') || 
             ['correctionData', 'verificationData', 'validate'].some(prefix => key.includes(prefix))) {
      if (!namespaced.verification) namespaced.verification = { version: 1 };
      if (!namespaced.verification.data) namespaced.verification.data = {};
      
      // Remove common prefixes for cleaner structure
      const cleanKey = key
        .replace(/^verification/i, '')
        .replace(/^Verification/i, '')
        .replace(/^verify/i, '')
        .replace(/^Verify/i, '');
      
      const finalKey = cleanKey.charAt(0).toLowerCase() + cleanKey.slice(1);
      
      // If it's already a structured object, keep it that way
      if (finalKey === 'data' && typeof value === 'object' && value !== null) {
        namespaced.verification.data = { ...namespaced.verification.data, ...value as object };
      } else {
        (namespaced.verification.data as any)[finalKey || key] = value;
      }
    }
    // Handle document fields
    else if (namespace === 'document' || 
             belongsToDomain(key, 'document') || 
             ['fileName', 'fileSize', 'extractedText', 'analysis'].some(docKey => key.includes(docKey))) {
      if (!namespaced.document) namespaced.document = { version: 1 };
      if (!namespaced.document.data) namespaced.document.data = {};
      
      const cleanKey = key
        .replace(/^document/i, '')
        .replace(/^Document/i, '')
        .replace(/^doc/i, '')
        .replace(/^Doc/i, '');
      
      const finalKey = cleanKey.charAt(0).toLowerCase() + cleanKey.slice(1);
      
      if (finalKey === 'data' && typeof value === 'object' && value !== null) {
        namespaced.document.data = { ...namespaced.document.data, ...value as object };
      } else {
        (namespaced.document.data as any)[finalKey || key] = value;
      }
    }
    // Handle large content references that should be separated
    else if (key.toLowerCase().includes('id') && typeof value === 'string' && 
            ['extractedTextId', 'analysisId', 'contentId', 'messagesId', 'resultsId'].includes(key)) {
      
      // Match the ID to its domain
      if (key.includes('extractedText') || key.includes('analysis')) {
        if (!namespaced.document) namespaced.document = { version: 1 };
        namespaced.document[key as keyof DocumentMetadata] = value as any;
      } else if (key.includes('messages') || key.includes('extracted')) {
        if (!namespaced.chat) namespaced.chat = { version: 1 };
        namespaced.chat[key as keyof ChatMetadata] = value as any;
      } else if (key.includes('content') || key.includes('templates')) {
        if (!namespaced.report) namespaced.report = { version: 1 };
        namespaced.report[key as keyof ReportMetadata] = value as any;
      } else if (key.includes('results')) {
        if (!namespaced.research) namespaced.research = { version: 1 };
        namespaced.research[key as keyof ResearchMetadata] = value as any;
      }
    }
    // For unknown fields, put them in the appropriate domain namespace if possible
    // or leave them at the root level
    else {
      if (namespaced[namespace]) {
        const domainMeta = namespaced[namespace] as Record<string, unknown>;
        if (!domainMeta.data) domainMeta.data = {};
        (domainMeta.data as Record<string, unknown>)[key] = value;
      } else {
        // Leave at root level as a fallback
        namespaced[key] = value;
      }
    }
  }
  
  return namespaced;
}

/**
 * Get metadata for a specific domain from a namespaced metadata object
 */
export function getDomainMetadata<T extends keyof DomainMetadataTypeMap>(
  metadata: NamespacedMetadata | Record<string, unknown>,
  domain: T
): DomainMetadataTypeMap[T] | undefined {
  const namespace = getDomainNamespace(domain as string);
  
  // Handle both legacy and namespaced metadata
  if (metadata && typeof metadata === 'object') {
    // Check if it's already namespaced
    if (
      namespace in metadata && 
      metadata[namespace] && 
      typeof metadata[namespace] === 'object'
    ) {
      return metadata[namespace] as DomainMetadataTypeMap[T];
    }
    
    // For legacy metadata, try to migrate it first
    const namespaced = migrateToNamespacedMetadata(metadata as Record<string, unknown>, domain as string);
    return namespaced[namespace] as DomainMetadataTypeMap[T];
  }
  
  return undefined;
}

/**
 * Update domain metadata in a namespaced metadata object
 */
export function updateDomainMetadata<T extends keyof DomainMetadataTypeMap>(
  metadata: NamespacedMetadata | Record<string, unknown>,
  domain: T,
  domainMetadata: Partial<DomainMetadataTypeMap[T]>
): NamespacedMetadata {
  const namespace = getDomainNamespace(domain as string);
  
  // Ensure we're working with namespaced metadata
  let namespaced: NamespacedMetadata;
  
  if (!metadata || typeof metadata !== 'object') {
    // Start fresh if no metadata
    namespaced = initializeNamespacedMetadata();
  } else if (
    namespace in metadata && 
    metadata[namespace] && 
    typeof metadata[namespace] === 'object'
  ) {
    // Already namespaced
    namespaced = { ...metadata } as NamespacedMetadata;
  } else {
    // Legacy metadata needs migration
    namespaced = migrateToNamespacedMetadata(metadata as Record<string, unknown>, domain as string);
  }
  
  // Create domain namespace if it doesn't exist
  if (!namespaced[namespace]) {
    namespaced[namespace] = {
      version: 1
    } as any;
  }
  
  // Update the domain metadata
  namespaced[namespace] = {
    ...namespaced[namespace] as Record<string, unknown>,
    ...domainMetadata,
    // Always increment version when updating
    version: (((namespaced[namespace] as any)?.version || 0) + 1)
  } as any;
  
  // Add timestamp if not provided
  if (!(namespaced[namespace] as any).updatedAt) {
    (namespaced[namespace] as any).updatedAt = new Date().toISOString();
  }
  
  return namespaced;
}