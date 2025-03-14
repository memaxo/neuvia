/**
 * @jest-environment node
 */

import {
  getDomainConcurrencyConfig,
  getFieldConcurrencyConfig,
  shouldStoreFieldSeparately,
  getFieldStorageTable
} from '@/lib/services/workflow/domain/domain-concurrency-config';

describe('Domain Concurrency Configuration', () => {
  describe('getDomainConcurrencyConfig', () => {
    it('returns default configuration for unknown domains', () => {
      const config = getDomainConcurrencyConfig('UnknownDomain');
      expect(config).toBeDefined();
      expect(config.defaultStrategy).toBe('fail');
      expect(config.fields).toEqual({});
    });

    it('returns specific configuration for known domains', () => {
      const chatConfig = getDomainConcurrencyConfig('Chat');
      expect(chatConfig.defaultStrategy).toBe('merge');
      expect(chatConfig.fields.messages).toBeDefined();
      expect(chatConfig.fields.messages.conflictStrategy).toBe('append');
      
      const verificationConfig = getDomainConcurrencyConfig('Verification');
      expect(verificationConfig.defaultStrategy).toBe('fail');
      expect(verificationConfig.fields.verificationData).toBeDefined();
      expect(verificationConfig.fields.verificationData.sensitive).toBe(true);
    });
  });

  describe('getFieldConcurrencyConfig', () => {
    it('returns undefined for unknown fields', () => {
      const config = getFieldConcurrencyConfig('Chat', 'nonExistentField');
      expect(config).toBeUndefined();
    });

    it('returns configuration for known fields', () => {
      const messagesConfig = getFieldConcurrencyConfig('Chat', 'messages');
      expect(messagesConfig).toBeDefined();
      expect(messagesConfig!.conflictStrategy).toBe('append');
      expect(messagesConfig!.storageStrategy).toBe('inline');
      expect(messagesConfig!.arrayMergeStrategy).toBe('append');
    });
  });

  describe('shouldStoreFieldSeparately', () => {
    it('returns true for fields with separate-row strategy', () => {
      expect(shouldStoreFieldSeparately('Document', 'extractedText')).toBe(true);
      expect(shouldStoreFieldSeparately('Chat', 'extractedContent')).toBe(true);
      expect(shouldStoreFieldSeparately('Report', 'reportContent')).toBe(true);
    });

    it('returns false for fields with inline strategy', () => {
      expect(shouldStoreFieldSeparately('Chat', 'messages')).toBe(false);
      expect(shouldStoreFieldSeparately('Verification', 'verificationData')).toBe(false);
      expect(shouldStoreFieldSeparately('Document', 'progress')).toBe(false);
    });

    it('returns false for unknown fields (defaults to inline)', () => {
      expect(shouldStoreFieldSeparately('Chat', 'nonExistentField')).toBe(false);
    });
  });

  describe('getFieldStorageTable', () => {
    it('returns table name for separately stored fields', () => {
      expect(getFieldStorageTable('Document', 'extractedText')).toBe('document_extractions');
      expect(getFieldStorageTable('Chat', 'extractedContent')).toBe('chat_extractions');
      expect(getFieldStorageTable('Report', 'reportContent')).toBe('report_contents');
    });

    it('returns null for inline fields', () => {
      expect(getFieldStorageTable('Chat', 'messages')).toBeNull();
      expect(getFieldStorageTable('Document', 'fileSize')).toBeNull();
    });

    it('returns null for unknown fields', () => {
      expect(getFieldStorageTable('Chat', 'nonExistentField')).toBeNull();
    });
  });

  describe('Complex domain-specific behavior', () => {
    it('verifies Chat domain uses merge for messages and typingStatus', () => {
      const chatConfig = getDomainConcurrencyConfig('Chat');
      
      expect(chatConfig.defaultStrategy).toBe('merge');
      expect(chatConfig.fields.messages.conflictStrategy).toBe('append');
      expect(chatConfig.fields.typingStatus.conflictStrategy).toBe('force');
    });
    
    it('verifies Verification domain strictly uses fail for most fields', () => {
      const verificationConfig = getDomainConcurrencyConfig('Verification');
      
      expect(verificationConfig.defaultStrategy).toBe('fail');
      expect(verificationConfig.fields.verificationData.conflictStrategy).toBe('fail');
      expect(verificationConfig.fields.validationResults.conflictStrategy).toBe('fail');
      
      // But has special handling for corrections
      expect(verificationConfig.fields.corrections.conflictStrategy).toBe('field-specific');
      expect(verificationConfig.fields.correctionHistory.conflictStrategy).toBe('append');
    });
    
    it('verifies Document domain uses separate storage for large text data', () => {
      const extractedTextConfig = getFieldConcurrencyConfig('Document', 'extractedText');
      
      expect(extractedTextConfig?.storageStrategy).toBe('separate-row');
      expect(extractedTextConfig?.tableName).toBe('document_extractions');
      expect(extractedTextConfig?.conflictStrategy).toBe('fail');
    });
  });
});