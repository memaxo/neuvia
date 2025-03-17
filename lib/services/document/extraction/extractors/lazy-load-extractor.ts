/**
 * Lazy Load Extractor
 * 
 * Utility module to lazily load document extractors.
 * This helps avoid circular dependencies and improves initialization performance.
 */

import type { DocumentExtractor } from './extractor-factory'
import type { OcrService } from '../ocr-service'
import type { ExtractionOptions } from '../extraction-service'
import type { ExtractedData } from '@/lib/types/document'

/**
 * Create a document extractor instance based on type without
 * requiring all extractors to be imported upfront
 * 
 * @param type Type of extractor to create
 * @param ocrService Optional OCR service instance for OCR-based extractors
 * @returns DocumentExtractor instance
 */
export function lazyLoadExtractor(
  type: 'ocr' | 'plain-text' | string,
  ocrService: OcrService
): DocumentExtractor {
  // Return a proxy object that will load the real extractor on demand
  return new Proxy({} as DocumentExtractor, {
    get(target, prop) {
      // On first method call, create the real extractor
      if (!target.extract) {
        if (type === 'ocr') {
          // Create minimal OCR extractor
          target.extract = async (file: File, options: ExtractionOptions): Promise<ExtractedData> => {
            // Convert file to blob for processing
            const blob = new Blob([await file.arrayBuffer()], { type: file.type });
            
            // Process with OCR service
            const result = await ocrService.processDocument(blob, file.type, {
              splitPages: options.splitPages,
              extractTables: options.extractTables,
              detectSections: options.detectSections,
              preserveLayout: options.preserveLayout
            });
            
            // Convert to ExtractedData format
            return {
              rawText: result.text,
              metadata: {
                filename: file.name,
                fileFormat: file.type,
                fileSize: file.size,
                extractedAt: new Date(),
                extractionMethod: 'gemini-ocr',
                documentStructure: result.metadata?.documentStructure || 'basic',
                hasStructuredData: true,
                detectedSections: result.detectedSections,
                ocrConfidence: result.confidence,
                pageCount: result.pages?.length || 1,
                hasTables: result.tables && result.tables.length > 0 || false,
                tableCount: result.tables?.length || 0,
                paragraphCount: result.metadata?.paragraphCount || 0,
                processingTime: result.processingTime
              },
              chunks: [] // No chunks, would be added by a chunking service
            };
          };
          
          target.getSupportedTypes = () => [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ];
        } 
        else if (type === 'plain-text') {
          // Create minimal PlainText extractor
          target.extract = async (file: File, options: ExtractionOptions): Promise<ExtractedData> => {
            // Read text directly from file
            const text = await file.text();
            
            // Simple extraction for plain text
            return {
              rawText: text,
              metadata: {
                filename: file.name,
                fileFormat: file.type,
                fileSize: file.size,
                extractedAt: new Date(),
                extractionMethod: 'direct-text',
                documentStructure: 'basic',
                hasStructuredData: false,
                lineCount: text.split('\n').length
              },
              chunks: [] // No chunks, would be added by a chunking service
            };
          };
          
          target.getSupportedTypes = () => ['text/plain'];
        }
        else {
          // Default to OCR for unknown types
          return lazyLoadExtractor('ocr', ocrService)[prop as keyof DocumentExtractor];
        }
      }
      
      // Return the method from the now-initialized target
      return target[prop as keyof DocumentExtractor];
    }
  });
}