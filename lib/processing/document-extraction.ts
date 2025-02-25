import { ExtractedData } from "./types";

/**
 * Example FireCrawl usage. Replace or enhance with your real FireCrawl calls if needed.
 * For now, we'll just read the file's text and place it into ExtractedData.
 */

interface DocumentType {
  category: string;
  type: string;
  subtype?: string;
  metadata?: Record<string, unknown>;
}

/**
 * processDocument:
 * 1. Reads File as text
 * 2. (Placeholder) uses FireCrawl or other logic as needed
 * 3. Returns ExtractedData with rawText and optional metadata
 */
export async function processDocument(
  file: File,
  patientId: string,
  documentType: DocumentType
): Promise<ExtractedData> {
  try {
    // 1. Read raw text from file
    const rawText = await file.text();

    // 2. Potential advanced extraction steps here.
    const extractedData: ExtractedData = {
      rawText,
      metadata: {
        docType: `${documentType.category}-${documentType.type}`,
      },
      chunks: [
        {
          content: rawText,
        },
      ],
    };

    return extractedData;
  } catch (error: any) {
    console.error("Error in processDocument:", error);
    // We can rethrow or define custom. Let's rethrow so the caller can handle a uniform shape.
    throw new Error(error.message || "Failed to process document");
  }
}