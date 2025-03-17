/**
 * Document Chunking
 * 
 * This module provides services for document chunking operations.
 */

export * from './chunking-service'
export * from './chunking-strategies'

// Singleton instance for use throughout the application
import { ChunkingService } from './chunking-service'

export const chunkingService = new ChunkingService()