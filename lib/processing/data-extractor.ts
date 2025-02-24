import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { createStreamableValue } from "ai/rsc";
import { MultiFileLoader } from "langchain/document_loaders/fs/multi_file";
import { TextLoader } from "langchain/document_loaders/fs/text";

import type { ProcessingStatus } from './types';

export class DataExtractor {
  private readonly supportedTypes = [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  async extractText(file: File, onStatusUpdate?: (status: ProcessingStatus) => void): Promise<string> {
    try {
      const fileType = file.type;
      let text = '';

      onStatusUpdate?.({
        status: 'processing',
        progress: 10,
        currentStep: 'Starting document extraction'
      });

      // Validate file
      if (!this.supportedTypes.includes(fileType)) {
        throw new Error(`Unsupported file type: ${fileType}`);
      }

      if (file.size > this.maxFileSize) {
        throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`);
      }

      // Create a blob from the file for PDF processing
      const blob = new Blob([await file.arrayBuffer()], { type: fileType });

      switch (fileType) {
        case 'application/pdf': {
          onStatusUpdate?.({
            status: 'processing',
            progress: 30,
            currentStep: 'Processing PDF document'
          });
          const loader = new WebPDFLoader(blob, {
            splitPages: false,
            parsedItemSeparator: " "
          });
          const docs = await loader.load();
          text = docs.map(doc => doc.pageContent).join('\n');
          break;
        }
        case 'text/plain': {
          onStatusUpdate?.({
            status: 'processing',
            progress: 30,
            currentStep: 'Processing text document'
          });
          const textContent = await file.text();
          const loader = new TextLoader(new Blob([textContent], { type: 'text/plain' }));
          const docs = await loader.load();
          text = docs[0].pageContent;
          break;
        }
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
          onStatusUpdate?.({
            status: 'processing',
            progress: 30,
            currentStep: 'Processing Word document'
          });
          const loader = new DocxLoader(blob, {
            type: fileType === 'application/msword' ? 'doc' : 'docx'
          });
          const docs = await loader.load();
          text = docs[0].pageContent;
          break;
        }
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      onStatusUpdate?.({
        status: 'completed',
        progress: 100,
        currentStep: 'Document extraction completed'
      });

      return text;
    } catch (error) {
      console.error('Error extracting text:', error);
      onStatusUpdate?.({
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Failed to extract text'
      });
      throw error;
    }
  }

  async streamExtraction(file: File): Promise<{ streamData: { text: Promise<string> } }> {
    // Validate file
    if (!this.supportedTypes.includes(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    if (file.size > this.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`);
    }

    return {
      streamData: {
        text: this.extractText(file)
      }
    };
  }

  async validateFileType(file: File): Promise<boolean> {
    return this.supportedTypes.includes(file.type);
  }

  async validateFileSize(file: File, maxSizeMB: number = 10): Promise<boolean> {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
  }
} 