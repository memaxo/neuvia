/**
 * Chunking Strategies
 *
 * Provides different strategies for chunking document text into smaller segments
 */

import { Document } from 'langchain/document'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { SectionDetector } from '../utils/section-detection'

/**
 * Options for chunking
 */
export interface ChunkingOptions {
  chunkSize: number
  chunkOverlap: number
  preserveMetadata: boolean
  strategy: 'size' | 'semantic' | 'section'
}

/**
 * Interface for chunking strategies
 */
export interface ChunkingStrategy {
  /**
   * Create chunks from text
   *
   * @param text Text to chunk
   * @param options Chunking options
   * @param structuredData Optional structured data for intelligent chunking
   * @returns Array of chunks with content and metadata
   */
  createChunks(
    text: string,
    options: ChunkingOptions,
    structuredData?: Record<string, any>
  ): Promise<Array<{ content: string, metadata?: Record<string, any> }>>;
}

/**
 * Semantic chunking strategy
 * Uses LangChain's RecursiveCharacterTextSplitter for intelligent chunking
 */
export class SemanticChunkingStrategy implements ChunkingStrategy {
  /**
   * Create chunks using semantic understanding of text
   */
  async createChunks(
    text: string,
    options: ChunkingOptions,
    structuredData?: Record<string, any>
  ): Promise<Array<{ content: string, metadata?: Record<string, any> }>> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap,
      // Use medical-specific separators
      separators: [
        '\n\n', // Double line breaks (strong separator)
        '\n',   // Single line breaks
        '. ',   // End of sentences
        ': ',   // Colons often introduce new content
        ', ',   // Commas may separate list items
        ' ',    // Last resort - split on spaces
      ],
    });

    // Create a document with the text
    const doc = new Document({
      pageContent: text,
      metadata: {
        chunkType: 'semantic',
        ...(structuredData || {})
      },
    });

    // Split the document
    const documents = await splitter.splitDocuments([doc]);

    // Convert LangChain documents to our format
    return documents.map(doc => ({
      content: doc.pageContent,
      metadata: {
        ...doc.metadata,
        chunkType: 'semantic'
      }
    }));
  }
}

/**
 * Page-based chunking strategy
 * Uses page structure from OCR/PDF extraction
 */
export class PageBasedChunkingStrategy implements ChunkingStrategy {
  /**
   * Create chunks based on page structure
   */
  async createChunks(
    text: string,
    options: ChunkingOptions,
    structuredData?: Record<string, any>
  ): Promise<Array<{ content: string, metadata?: Record<string, any> }>> {
    const chunks: Array<{ content: string, metadata?: Record<string, any> }> = [];

    if (!structuredData?.pages || !structuredData.pages.length) {
      // Fallback to semantic chunking if no pages
      const semanticStrategy = new SemanticChunkingStrategy();
      return semanticStrategy.createChunks(text, options, structuredData);
    }

    // Process each page in structured data
    structuredData.pages.forEach((page: any, pageIndex: number) => {
      const pageNumber = pageIndex + 1;
      
      // If page has paragraphs, create chunk per paragraph
      if (page.paragraphs && page.paragraphs.length > 0) {
        page.paragraphs.forEach((paragraph: any, paragraphIndex: number) => {
          if (paragraph.content && typeof paragraph.content === 'string') {
            chunks.push({
              content: paragraph.content,
              metadata: {
                pageNumber,
                paragraphIndex,
                source: structuredData.source || 'page-based',
                confidence: paragraph.confidence || page.confidence || 0.9,
                isTable: paragraph.isTable || false,
                sectionType: paragraph.sectionType ||
                  SectionDetector.detectSectionType(paragraph.content),
                bounds: paragraph.bounds || null,
                chunkType: 'paragraph'
              }
            });
          }
        });
      }
      // If no paragraphs but tables, create chunk per table
      else if (page.tables && page.tables.length > 0) {
        page.tables.forEach((table: any, tableIndex: number) => {
          chunks.push({
            content: table.content || table.text || JSON.stringify(table.cells || {}),
            metadata: {
              pageNumber,
              tableIndex,
              source: structuredData.source || 'page-based',
              bounds: table.bounds || null,
              isTable: true,
              tableData: table.cells || null,
              tableRows: table.rows || null,
              tableCols: table.columns || null,
              chunkType: 'table'
            }
          });
        });
      }
      // If no paragraphs or tables but page has content, create chunk for the page
      else if (page.content && typeof page.content === 'string') {
        chunks.push({
          content: page.content,
          metadata: {
            pageNumber,
            source: structuredData.source || 'page-based',
            confidence: page.confidence || structuredData.confidence || 0.9,
            bounds: page.bounds || null,
            chunkType: 'page'
          }
        });
      }
    });
    
    return chunks;
  }
}

/**
 * Section-based chunking strategy
 * Splits text into logical sections based on headers
 */
export class SectionBasedChunkingStrategy implements ChunkingStrategy {
  /**
   * Create chunks based on document sections
   */
  async createChunks(
    text: string,
    options: ChunkingOptions,
    structuredData?: Record<string, any>
  ): Promise<Array<{ content: string, metadata?: Record<string, any> }>> {
    const chunks: Array<{ content: string, metadata?: Record<string, any> }> = [];
    
    // Use SectionDetector to split text into sections
    const sections = SectionDetector.splitTextBySections(text);
    
    sections.forEach((section, index) => {
      // For large sections, we might further chunk them
      if (section.content.length > options.chunkSize * 1.5) {
        // Create a subsplitter for large sections
        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: options.chunkSize,
          chunkOverlap: options.chunkOverlap,
        });
        
        // Create chunks (returns a Promise, but we'll handle it later)
        splitter.createDocuments([section.content]).then(subDocs => {
          subDocs.forEach((subDoc, subIndex) => {
            chunks.push({
              content: subDoc.pageContent,
              metadata: {
                section: section.section,
                sectionIndex: index,
                subSectionIndex: subIndex,
                source: structuredData?.source || 'section-based',
                chunkType: 'section-chunk'
              }
            });
          });
        });
      } else {
        // Section is small enough to use as-is
        chunks.push({
          content: section.content,
          metadata: {
            section: section.section,
            sectionIndex: index,
            source: structuredData?.source || 'section-based',
            chunkType: 'section'
          }
        });
      }
    });
    
    return chunks;
  }
}

/**
 * Factory for creating appropriate chunking strategies
 */
export class ChunkingStrategyFactory {
  /**
   * Get appropriate chunking strategy based on data characteristics
   *
   * @param text Document text
   * @param options Chunking options
   * @param structuredData Optional structured data
   * @returns The most appropriate chunking strategy
   */
  static getStrategy(
    text: string,
    options: ChunkingOptions,
    structuredData?: Record<string, any>
  ): ChunkingStrategy {
    // If strategy is explicitly specified, use that
    if (options.strategy === 'section') {
      return new SectionBasedChunkingStrategy();
    } else if (options.strategy === 'size') {
      return new SemanticChunkingStrategy();
    }

    // Otherwise, determine based on data characteristics
    if (structuredData?.pages && structuredData.pages.length > 0) {
      return new PageBasedChunkingStrategy();
    } else if (SectionDetector.detectSections(text).length > 2) {
      return new SectionBasedChunkingStrategy();
    } else {
      return new SemanticChunkingStrategy();
    }
  }
}