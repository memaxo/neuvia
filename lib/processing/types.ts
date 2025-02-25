/**
 * Shared processing types for document extraction & chunking
 */

export interface ExtractedData {
  /**
   * Raw extracted text from the document
   */
  rawText: string;

  /**
   * Additional metadata about the document
   */
  metadata: {
    pageCount?: number;
    docType?: string;
    // Extend with other relevant fields as needed
    [key: string]: any;
  };

  /**
   * Optional chunked data
   */
  chunks?: Array<{
    content: string;
    pageNumber?: number;
    // Additional fields as necessary
  }>;
}