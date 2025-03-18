/**
 * Chunking Service
 * 
 * Dedicated service for document chunking operations.
 * Provides a centralized implementation for both extraction and RAG use cases.
 */

import { Document } from 'langchain/document'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import logger from '@/lib/logger'
import { ChunkingStrategyFactory } from './chunking-strategies'
import { SectionDetector } from '../utils/section-detection'
import type { OcrPage, OcrParagraph } from '../extraction/ocr-service'
import type { 
  ChunkingOptions, 
  ExtractionChunk, 
  RAGChunk 
} from '@/lib/types/chunk'

/**
 * Default chunking options for extraction
 */
export const DEFAULT_EXTRACTION_CHUNKING_OPTIONS: ChunkingOptions = {
  chunkSize: 5000,
  chunkOverlap: 200,
  preserveMetadata: true,
  strategy: 'semantic',
  domain: 'extraction'
}

/**
 * Default chunking options for RAG
 */
export const DEFAULT_RAG_CHUNKING_OPTIONS: ChunkingOptions = {
  chunkSize: 1000,
  chunkOverlap: 200,
  preserveMetadata: true,
  strategy: 'semantic',
  domain: 'rag'
}

/**
 * Service for document chunking operations
 */
export class ChunkingService {
  private readonly logger = logger.withMetadata({ module: 'ChunkingService' });
  
  /**
   * Create chunks from document text
   * 
   * @param text Document text to chunk
   * @param options Chunking options
   * @param structuredData Optional structured data (pages, sections, etc.)
   * @returns Array of chunks with content and metadata
   */
  async chunkText(
    text: string,
    options: ChunkingOptions = DEFAULT_EXTRACTION_CHUNKING_OPTIONS,
    structuredData?: Record<string, any>
  ): Promise<Array<{ content: string, metadata?: Record<string, any> }>> {
    this.logger.info('Chunking document text', {
      textLength: text.length,
      strategy: options.strategy,
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap,
      domain: options.domain
    });
    
    // Get appropriate chunking strategy
    const strategy = ChunkingStrategyFactory.getStrategy(text, options, structuredData);
    
    // Apply the strategy
    return strategy.createChunks(text, options, structuredData);
  }
  
  /**
   * Create extraction-specific chunks from a document
   * 
   * @param text Document text to chunk
   * @param options Chunking options
   * @param structuredData Optional structured data
   * @returns Array of extraction chunks
   */
  async createExtractionChunks(
    text: string,
    options: ChunkingOptions = DEFAULT_EXTRACTION_CHUNKING_OPTIONS,
    structuredData?: Record<string, any>
  ): Promise<ExtractionChunk[]> {
    const chunks = await this.chunkText(text, {
      ...options,
      domain: 'extraction'
    }, structuredData);
    
    // Convert to ExtractionChunk format
    return chunks.map((chunk, index) => ({
      content: chunk.content,
      chunkIndex: index,
      metadata: chunk.metadata,
      pageNumber: chunk.metadata?.pageNumber,
      section: chunk.metadata?.section,
      confidence: chunk.metadata?.confidence,
      isTable: chunk.metadata?.isTable
    }));
  }
  
  /**
   * Create RAG-specific chunks from a document
   * 
   * @param text Document text to chunk
   * @param documentId ID of the document
   * @param baseMetadata Base metadata to include with all chunks
   * @param options Chunking options
   * @param structuredData Optional structured data
   * @returns Array of RAG chunks
   */
  async createRAGChunks(
    text: string,
    documentId: string,
    baseMetadata: Record<string, any> = {},
    options: ChunkingOptions = DEFAULT_RAG_CHUNKING_OPTIONS,
    structuredData?: Record<string, any>
  ): Promise<RAGChunk[]> {
    // Use smaller chunks for RAG by default
    const ragOptions = {
      ...options,
      domain: 'rag'
    };
    
    const chunks = await this.chunkText(text, ragOptions, structuredData);
    
    // Convert to RAGChunk format
    return chunks.map((chunk, index) => {
      // Find position of chunk in original text for retrieval context
      const start = text.indexOf(chunk.content);
      const end = start + chunk.content.length;
      
      return {
        content: chunk.content,
        chunkIndex: index,
        documentId,
        metadata: {
          ...baseMetadata,
          ...(chunk.metadata || {}),
          position: {
            start: start >= 0 ? start : undefined,
            end: start >= 0 ? end : undefined
          }
        }
      };
    });
  }
  
  /**
   * Convert extraction chunks to RAG chunks
   * 
   * @param extractionChunks Chunks from extraction process
   * @param documentId Document ID
   * @param baseMetadata Additional metadata to include
   * @returns RAG compatible chunks
   */
  convertExtractionChunksToRAG(
    extractionChunks: ExtractionChunk[],
    documentId: string,
    baseMetadata: Record<string, any> = {}
  ): RAGChunk[] {
    return extractionChunks.map((chunk, index) => ({
      content: chunk.content,
      chunkIndex: chunk.chunkIndex || index,
      documentId,
      metadata: {
        ...baseMetadata,
        ...(chunk.metadata || {}),
        pageNumber: chunk.pageNumber,
        section: chunk.section,
        confidence: chunk.confidence,
        isTable: chunk.isTable
      }
    }));
  }
  
  /**
   * Create semantic chunks from text using LangChain
   * 
   * This method implements a smart chunking strategy that:
   * 1. First respects OCR's structure if available
   * 2. Uses section-based chunking if sections are detected
   * 3. Falls back to standard RecursiveCharacterTextSplitter
   * 
   * @param text Raw text to chunk
   * @param options Chunking options
   * @param structuredData Optional structured data (pages, paragraphs)
   * @returns Array of LangChain Document objects
   */
  async createSemanticChunks(
    text: string,
    options: ChunkingOptions = DEFAULT_EXTRACTION_CHUNKING_OPTIONS,
    structuredData?: {
      pages?: OcrPage[],
      paragraphs?: OcrParagraph[],
      sections?: string[]
    }
  ): Promise<Document[]> {
    const documents: Document[] = [];
    
    // STRATEGY 1: Use OCR's page and paragraph structure if available
    if (structuredData?.pages && structuredData.pages.length > 0) {
      // For each page in the structured data
      structuredData.pages.forEach((page, pageIndex) => {
        const pageNumber = pageIndex + 1;
        
        // If page has paragraphs, create chunk per paragraph
        if (page.paragraphs && page.paragraphs.length > 0) {
          page.paragraphs.forEach((paragraph, paragraphIndex) => {
            if (paragraph.content && typeof paragraph.content === 'string') {
              documents.push(new Document({
                pageContent: paragraph.content,
                metadata: {
                  pageNumber,
                  paragraphIndex,
                  source: 'ocr',
                  confidence: paragraph.confidence || page.confidence || 0.9,
                  isTable: paragraph.isTable || false,
                  sectionType: paragraph.sectionType || SectionDetector.detectSectionType(paragraph.content),
                  bounds: paragraph.bounds || null,
                  chunkType: 'paragraph'
                }
              }));
            }
          });
        } 
        // If no paragraphs but page has content, create chunk for the page
        else if (page.content && typeof page.content === 'string') {
          documents.push(new Document({
            pageContent: page.content,
            metadata: {
              pageNumber,
              source: 'ocr',
              confidence: page.confidence || 0.9,
              bounds: page.bounds || null,
              chunkType: 'page'
            }
          }));
        }
      });
      
      // If we found chunks using page structure, return them
      if (documents.length > 0) {
        return documents;
      }
    }
    
    // STRATEGY 2: Use section-based chunking if sections are detected
    if (structuredData?.sections && structuredData.sections.length > 0) {
      const sectionChunks = SectionDetector.splitTextBySections(text);
      
      sectionChunks.forEach(section => {
        documents.push(new Document({
          pageContent: section.content,
          metadata: {
            section: section.section,
            chunkType: 'section'
          }
        }));
      });
      
      // If we found section chunks, return them
      if (documents.length > 0) {
        return documents;
      }
    }
    
    // STRATEGY 3: Fall back to standard RecursiveCharacterTextSplitter
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap,
      // Use medical-specific separators
      separators: [
        '\n\n', // Double line breaks (strong separator)
        '\n', // Single line breaks
        '. ', // End of sentences
        ': ', // Colons often introduce new content
        ', ', // Commas may separate list items
        ' ', // Last resort - split on spaces
      ],
    });

    // Create a document with the text
    const doc = new Document({
      pageContent: text,
      metadata: {
        chunkType: 'auto-split',
        domain: options.domain
      },
    });

    // Split the document
    return await splitter.splitDocuments([doc]);
  }
  
  /**
   * Get sections from text
   * 
   * @param text Document text
   * @returns Array of section names detected in the text
   */
  detectSections(text: string): string[] {
    return SectionDetector.detectSections(text);
  }
  
  /**
   * Split text by sections
   * 
   * @param text Document text
   * @returns Array of sections with content
   */
  splitTextBySections(text: string): Array<{ section: string, content: string }> {
    return SectionDetector.splitTextBySections(text);
  }
}