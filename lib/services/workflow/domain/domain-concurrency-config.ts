/**
 * @fileoverview Domain-Specific Concurrency Configuration
 * 
 * This file provides centralized configuration for how different workflow
 * domains handle concurrency conflicts. Having explicit strategies per domain
 * helps prevent data corruption and makes conflict resolution more predictable.
 */

import { logger } from '@/lib/logger';

/**
 * Supported conflict resolution strategies
 */
export type ConflictResolutionStrategy = 
  | 'fail'             // Reject update if conflict detected (safest)
  | 'force'            // Override existing data regardless of conflicts (risky)
  | 'merge'            // Attempt to merge changes from both versions
  | 'field-specific'   // Use custom field-specific merge rules
  | 'append'           // Append to arrays without overwriting (chat messages)
  | 'pessimistic'      // Use pessimistic locking to prevent conflicts
  | 'optimistic'       // Use optimistic concurrency control with version checks
;

/**
 * Supported field storage strategies to reduce conflict likelihood
 */
export type FieldStorageStrategy =
  | 'inline'           // Store in the workflow metadata (default)
  | 'separate-row'     // Store in a separate table with the same primary key
  | 'reference'        // Store a reference (ID) to data in another table
  | 'event-sourced'    // Store changes as events, reconstruct when needed
;

/**
 * Field-specific metadata configuration
 */
export interface FieldConfig {
  /** Strategy for handling conflicts in this field */
  conflictStrategy: ConflictResolutionStrategy;
  
  /** How this field should be stored */
  storageStrategy: FieldStorageStrategy;
  
  /** For arrays, how to merge/handle conflicts */
  arrayMergeStrategy?: 'append' | 'replace' | 'merge-by-id';
  
  /** Whether this field is sensitive (affects logging) */
  sensitive?: boolean;
  
  /** Maximum size in characters for this field (for inline storage) */
  maxSize?: number;
  
  /** Table to use for separate storage (if storageStrategy = 'separate-row') */
  tableName?: string;
}

/**
 * Domain concurrency configuration
 */
export interface DomainConcurrencyConfig {
  /** Default conflict resolution strategy for this domain */
  defaultStrategy: ConflictResolutionStrategy;
  
  /** Field-specific configurations */
  fields: Record<string, FieldConfig>;
  
  /** 
   * Custom deep merge function for this domain 
   * If not provided, a generic deep merge is used
   */
  customMergeFunction?: (
    current: Record<string, unknown>,
    incoming: Record<string, unknown>
  ) => Record<string, unknown>;
}

/**
 * All domain concurrency configurations
 */
const DOMAIN_CONCURRENCY_CONFIGS: Record<string, DomainConcurrencyConfig> = {
  /**
   * Chat domain configurations
   * 
   * The chat domain deals with conversations, messages, and interactive
   * UI states. Conflicts are common due to real-time nature.
   */
  'Chat': {
    defaultStrategy: 'merge',
    fields: {
      'messages': {
        conflictStrategy: 'append',
        storageStrategy: 'inline',
        arrayMergeStrategy: 'append',
        maxSize: 100000
      },
      'messageIds': {
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
  },
  
  /**
   * Document domain configurations
   * 
   * The document domain handles file uploads, content extraction,
   * and document analysis.
   */
  'Document': {
    defaultStrategy: 'fail', // Be cautious with document data
    fields: {
      'fileName': {
        conflictStrategy: 'fail',
        storageStrategy: 'inline'
      },
      'fileSize': {
        conflictStrategy: 'fail',
        storageStrategy: 'inline'
      },
      'extractedText': {
        conflictStrategy: 'fail',
        storageStrategy: 'separate-row',
        tableName: 'document_extractions'
      },
      'analysis': {
        conflictStrategy: 'fail',
        storageStrategy: 'separate-row',
        tableName: 'document_analyses'
      },
      'progress': {
        conflictStrategy: 'force', // Progress updates can be forced
        storageStrategy: 'inline'
      },
      'uploadMetadata': {
        conflictStrategy: 'fail',
        storageStrategy: 'inline'
      }
    }
  },
  
  /**
   * Verification domain configurations
   * 
   * The verification domain is highly sensitive to data integrity
   * and requires strict conflict management.
   */
  'Verification': {
    defaultStrategy: 'fail', // Verification data should never be lost
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
      },
      'correctionHistory': {
        conflictStrategy: 'append',
        storageStrategy: 'event-sourced',
        arrayMergeStrategy: 'append'
      },
      'validationResults': {
        conflictStrategy: 'fail',
        storageStrategy: 'inline'
      }
    },
    // Custom merge function for verification data that's field-sensitive
    customMergeFunction: (current, incoming) => {
      // Start with current data
      const result = { ...current };
      
      // Only merge specific fields from incoming data
      for (const key of Object.keys(incoming)) {
        // Special handling for correction fields
        if (key === 'corrections' && Array.isArray(result.corrections) && Array.isArray(incoming.corrections)) {
          // Merge corrections by field ID to avoid duplicates
          const existingIds = new Set((result.corrections as any[]).map(c => c.fieldId));
          const newCorrections = (incoming.corrections as any[]).filter(c => !existingIds.has(c.fieldId));
          result.corrections = [...(result.corrections as any[]), ...newCorrections];
        } 
        // For history, always append
        else if (key === 'correctionHistory' && Array.isArray(result.correctionHistory) && Array.isArray(incoming.correctionHistory)) {
          result.correctionHistory = [...(result.correctionHistory as any[]), ...(incoming.correctionHistory as any[])];
        }
        // For other fields, use incoming data only if it's newer
        else if (incoming.timestamp && current.timestamp) {
          if (new Date(incoming.timestamp as string) > new Date(current.timestamp as string)) {
            result[key] = incoming[key];
          }
        }
        // Default to incoming data for new fields
        else if (result[key] === undefined) {
          result[key] = incoming[key];
        }
      }
      
      return result;
    }
  },
  
  /**
   * Report domain configurations
   * 
   * The report domain handles generating, formatting, and
   * tracking medical reports.
   */
  'Report': {
    defaultStrategy: 'fail',
    fields: {
      'reportContent': {
        conflictStrategy: 'fail',
        storageStrategy: 'separate-row',
        tableName: 'report_contents',
        maxSize: 500000
      },
      'reportMetadata': {
        conflictStrategy: 'merge',
        storageStrategy: 'inline'
      },
      'reportVersion': {
        conflictStrategy: 'fail',
        storageStrategy: 'inline'
      },
      'generationParameters': {
        conflictStrategy: 'fail',
        storageStrategy: 'inline'
      }
    }
  },
  
  /**
   * Research domain configurations
   * 
   * The research domain manages research queries, results,
   * and citations.
   */
  'Research': {
    defaultStrategy: 'merge',
    fields: {
      'query': {
        conflictStrategy: 'fail',
        storageStrategy: 'inline'
      },
      'results': {
        conflictStrategy: 'fail',
        storageStrategy: 'separate-row',
        tableName: 'research_results',
        maxSize: 200000
      },
      'citations': {
        conflictStrategy: 'merge',
        storageStrategy: 'inline',
        arrayMergeStrategy: 'merge-by-id'
      }
    }
  }
};

/**
 * Get concurrency configuration for a specific domain
 */
export function getDomainConcurrencyConfig(domain: string): DomainConcurrencyConfig {
  const config = DOMAIN_CONCURRENCY_CONFIGS[domain];
  
  if (!config) {
    logger.warn(`No concurrency configuration found for domain: ${domain}. Using fail-safe defaults.`);
    
    // Return a fail-safe default configuration
    return {
      defaultStrategy: 'fail',
      fields: {}
    };
  }
  
  return config;
}

/**
 * Get field-specific concurrency configuration
 */
export function getFieldConcurrencyConfig(
  domain: string,
  field: string
): FieldConfig | undefined {
  const domainConfig = getDomainConcurrencyConfig(domain);
  return domainConfig.fields[field];
}

/**
 * Get storage strategy for a specific field
 */
export function getFieldStorageStrategy(
  domain: string,
  field: string
): FieldStorageStrategy {
  const fieldConfig = getFieldConcurrencyConfig(domain, field);
  return fieldConfig?.storageStrategy || 'inline';
}

/**
 * Check if a field should be stored separately
 */
export function shouldStoreFieldSeparately(domain: string, field: string): boolean {
  const strategy = getFieldStorageStrategy(domain, field);
  return strategy === 'separate-row' || strategy === 'reference';
}

/**
 * Get the appropriate table name for separate storage
 */
export function getFieldStorageTable(domain: string, field: string): string | null {
  const fieldConfig = getFieldConcurrencyConfig(domain, field);
  if (fieldConfig?.storageStrategy === 'separate-row' && fieldConfig.tableName) {
    return fieldConfig.tableName;
  }
  return null;
}