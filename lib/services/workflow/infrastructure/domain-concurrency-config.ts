/**
 * @fileoverview Domain-specific Concurrency Configuration
 * 
 * PHASE 4 IMPLEMENTATION:
 * Enhanced concurrency handling with field-specific storage strategies
 * and standardized conflict resolution for both metadata and storage.
 */

import logger from '@/lib/logger';

/**
 * Interface defining domain concurrency configuration 
 */
export interface DomainConcurrencyConfig {
  /** Domain name */
  domain?: string;
  
  /** Default conflict resolution strategy */
  defaultStrategy: 'pessimistic' | 'optimistic' | 'force' | 'fail' | 'merge' | 'append' | 'field-specific';
  
  /** Domain-specific error handling */
  errorHandling?: {
    /** Default error step for this domain */
    defaultErrorStep: string;
    
    /** Custom error mapping by error type */
    errorMapping?: Record<string, string>;
  };
  
  /** Field-level conflict strategies for this domain */
  fields?: Record<string, FieldConcurrencyConfig>;
  
  /** Default table for storing large fields */
  defaultLargeFieldTable?: string;
}

/**
 * Field-specific concurrency configuration
 */
export interface FieldConcurrencyConfig {
  /** Strategy for handling field update conflicts */
  conflictStrategy: 'force' | 'fail' | 'ignore' | 'merge' | 'append' | 'replace';
  
  /** Strategy for merging arrays within this field */
  arrayMergeStrategy?: 'replace' | 'append' | 'merge-by-id';
  
  /** Whether to store field in a separate table */
  storeFieldSeparately?: boolean;
  
  /** Table name for separate storage */
  tableName?: string;
}

/**
 * Enhanced Chat domain concurrency configuration
 */
const chatConfig: DomainConcurrencyConfig = {
  domain: 'Chat',
  defaultStrategy: 'merge',
  defaultLargeFieldTable: 'chat_extractions',
  errorHandling: {
    defaultErrorStep: 'chat_error',
    errorMapping: {
      'CONCURRENT_MODIFICATION': 'chat_error',
      'MESSAGE_PROCESSING_FAILED': 'chat_error',
      'RESEARCH_FAILED': 'research_error',
      'REPORT_GENERATION_FAILED': 'report_generation_error'
    }
  },
  fields: {
    'messages': {
      conflictStrategy: 'append',
      arrayMergeStrategy: 'append'
    },
    'intentHistory': {
      conflictStrategy: 'append',
      arrayMergeStrategy: 'append'
    },
    'currentQuery': {
      conflictStrategy: 'replace'
    },
    'error': {
      conflictStrategy: 'replace'
    },
    'chatHistory': {
      conflictStrategy: 'force',
      storeFieldSeparately: true,
      tableName: 'chat_extractions'
    },
    'contextElements': {
      conflictStrategy: 'merge',
      arrayMergeStrategy: 'merge-by-id'
    }
  }
};

/**
 * Enhanced Document domain concurrency configuration
 */
const documentConfig: DomainConcurrencyConfig = {
  domain: 'Document',
  defaultStrategy: 'pessimistic',
  defaultLargeFieldTable: 'document_extractions',
  errorHandling: {
    defaultErrorStep: 'document_error',
    errorMapping: {
      'UPLOAD_FAILED': 'uploading_error',
      'EXTRACTION_FAILED': 'extraction_error',
      'PROCESSING_FAILED': 'document_error'
    }
  },
  fields: {
    'extractedText': {
      conflictStrategy: 'force',
      storeFieldSeparately: true,
      tableName: 'document_extractions'
    },
    'documentContent': {
      conflictStrategy: 'force',
      storeFieldSeparately: true,
      tableName: 'document_extractions'
    },
    'contentSummary': {
      conflictStrategy: 'force',
      storeFieldSeparately: false
    },
    'annotations': {
      conflictStrategy: 'merge',
      arrayMergeStrategy: 'merge-by-id'
    }
  }
};

/**
 * Enhanced Verification domain concurrency configuration
 */
const verificationConfig: DomainConcurrencyConfig = {
  domain: 'Verification',
  defaultStrategy: 'field-specific',
  errorHandling: {
    defaultErrorStep: 'verification_failed',
    errorMapping: {
      'CORRECTION_FAILED': 'verification_in_progress',
      'VERIFICATION_FAILED': 'verification_failed'
    }
  },
  fields: {
    'corrections': {
      conflictStrategy: 'append',
      arrayMergeStrategy: 'append'
    },
    'currentSummary': {
      conflictStrategy: 'replace'
    },
    'summaryId': {
      conflictStrategy: 'replace'
    },
    'correctionCount': {
      conflictStrategy: 'replace'
    },
    'error': {
      conflictStrategy: 'replace'
    },
    'verificationResult': {
      conflictStrategy: 'fail'
    }
  }
};

/**
 * Enhanced Report domain concurrency configuration
 */
const reportConfig: DomainConcurrencyConfig = {
  domain: 'Report',
  defaultStrategy: 'optimistic',
  defaultLargeFieldTable: 'report_contents',
  errorHandling: {
    defaultErrorStep: 'report_generation_error'
  },
  fields: {
    'reportContent': {
      conflictStrategy: 'force',
      storeFieldSeparately: true,
      tableName: 'report_contents'
    },
    'sections': {
      conflictStrategy: 'merge',
      arrayMergeStrategy: 'merge-by-id'
    }
  }
};

/**
 * Enhanced Research domain concurrency configuration
 */
const researchConfig: DomainConcurrencyConfig = {
  domain: 'Research',
  defaultStrategy: 'merge',
  defaultLargeFieldTable: 'research_results',
  errorHandling: {
    defaultErrorStep: 'research_error'
  },
  fields: {
    'searchResults': {
      conflictStrategy: 'append',
      arrayMergeStrategy: 'append'
    },
    'query': {
      conflictStrategy: 'replace'
    },
    'error': {
      conflictStrategy: 'replace'
    },
    'results': {
      conflictStrategy: 'force',
      storeFieldSeparately: true,
      tableName: 'research_results'
    },
    'sources': {
      conflictStrategy: 'merge',
      arrayMergeStrategy: 'append'
    }
  }
};

// Map of domain names to their concurrency configurations
const domainConfigs: Record<string, DomainConcurrencyConfig> = {
  'Chat': chatConfig,
  'Document': documentConfig,
  'Verification': verificationConfig,
  'Report': reportConfig,
  'Research': researchConfig
};

// Default configuration for unknown domains
const DEFAULT_CONFIG: DomainConcurrencyConfig = {
  domain: 'Default',
  defaultStrategy: 'pessimistic',
  errorHandling: {
    defaultErrorStep: 'error'
  },
  fields: {}
};

/**
 * Get concurrency configuration for a specific domain
 */
export function getDomainConcurrencyConfig(domain: string): DomainConcurrencyConfig {
  const normalizedDomain = domain.charAt(0).toUpperCase() + domain.slice(1).toLowerCase();
  
  if (domainConfigs[normalizedDomain]) {
    return domainConfigs[normalizedDomain];
  }
  
  if (domainConfigs[domain]) {
    return domainConfigs[domain];
  }
  
  // Log warning and return default configuration
  logger.warn(`No concurrency configuration found for domain: ${domain}. Using default.`, {
    domain,
    availableDomains: Object.keys(domainConfigs)
  });
  
  return DEFAULT_CONFIG;
}

/**
 * Get the concurrency configuration for a specific field within a domain
 */
export function getFieldConcurrencyConfig(
  domainName: string, 
  fieldName: string
): FieldConcurrencyConfig | undefined {
  const domainConfig = getDomainConcurrencyConfig(domainName);
  return domainConfig.fields?.[fieldName];
}

/**
 * Determine if a field should be stored separately based on domain config
 */
export function shouldStoreFieldSeparately(domainName: string, fieldName: string): boolean {
  const fieldConfig = getFieldConcurrencyConfig(domainName, fieldName);
  return fieldConfig?.storeFieldSeparately === true;
}

/**
 * Get the table name for storing a field separately
 */
export function getFieldStorageTable(domainName: string, fieldName: string): string | undefined {
  const fieldConfig = getFieldConcurrencyConfig(domainName, fieldName);
  
  // First check field-specific configuration
  if (fieldConfig?.tableName) {
    return fieldConfig.tableName;
  }
  
  // Fall back to domain default
  const domainConfig = getDomainConcurrencyConfig(domainName);
  return domainConfig.defaultLargeFieldTable;
}

export default getDomainConcurrencyConfig;