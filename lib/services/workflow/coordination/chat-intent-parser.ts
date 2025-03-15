/**
 * @fileoverview Chat Intent Parser - COMPATIBILITY IMPORT
 * 
 * PHASE 2 IMPLEMENTATION:
 * This file is a compatibility layer that re-exports the ChatIntentParser
 * from its new location in the chat service directory. This allows existing code
 * to continue functioning while imports are updated to use the new location.
 */

export * from '@/lib/services/chat/chat-intent-parser';