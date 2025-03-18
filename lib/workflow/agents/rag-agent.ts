/**
 * RAG Agent for Patient Document Interaction
 * 
 * This agent specializes in retrieving and interacting with patient documents
 * that have already been uploaded and processed by the system. It provides
 * retrieval-augmented generation capabilities by integrating with the existing
 * RAG systems, vector stores, and document services.
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Import services and types
import { ragRetrievalService, RAGRetrievalService } from "@/lib/services/rag";
import { uploadService, UploadService } from "@/lib/services/upload/upload-service";
import { supabaseVectorStore } from "@/lib/vectorstore/supabase-store";
import type { DocumentChunk, DocumentSource, RetrievalOptions } from "@/lib/types/rag";
import type { DocumentType } from "@/lib/types/document";
import logger from "@/lib/logger";

// Create logger
const moduleLogger = logger.withMetadata({ module: 'RAGAgent' });

/**
 * Create the RAG agent for patient document chat
 */
export const ragAgent = createReactAgent({
  llm: new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 }),
  tools: [
    // Tool for retrieving document context
    tool(
      async (args) => {
        try {
          moduleLogger.info('Document retrieval tool called', { 
            query: args.query,
            patientId: args.patientId 
          });
          
          // Retrieve relevant documents using the RAG retrieval service
          const retrievalOptions: RetrievalOptions = {
            limit: args.limit || 5,
            minRelevance: args.minRelevance || 0.7,
            includeMetadata: true,
            rerank: true
          };
          
          // Add filters if provided
          if (args.documentType) {
            retrievalOptions.documentType = args.documentType;
          }
          
          if (args.dateRange) {
            retrievalOptions.dateRange = args.dateRange as any; // Type assertion to bypass strict typing for now
          }
          
          // Use the patient-specific retrieval method if patientId is provided
          let result;
          if (args.patientId) {
            result = await ragRetrievalService.retrieveForPatient(
              args.patientId,
              args.query,
              retrievalOptions
            );
          } else {
            result = await ragRetrievalService.retrieveContext(
              args.query,
              retrievalOptions
            );
          }
          
          moduleLogger.info('Document retrieval completed', { 
            chunkCount: result.chunks.length,
            sourceCount: result.sources.length 
          });
          
          // Format the response for the agent
          return {
            chunks: result.chunks.map(formatChunkForAgent),
            sources: result.sources.map(formatSourceForAgent),
            totalChunks: result.chunks.length,
            averageRelevance: result.averageRelevance || 0
          };
        } catch (error) {
          moduleLogger.error('Document retrieval failed', { query: args.query }, error);
          return {
            chunks: [],
            sources: [],
            error: error instanceof Error ? error.message : 'Unknown retrieval error'
          };
        }
      },
      {
        name: "retrieve_patient_documents",
        description: "Retrieve relevant patient documents for a query",
        schema: z.object({
          query: z.string().describe("The search query to find relevant documents"),
          patientId: z.string().optional().describe("The patient ID to search documents for"),
          limit: z.number().optional().describe("Maximum number of chunks to retrieve"),
          minRelevance: z.number().optional().describe("Minimum relevance score (0-1)"),
          documentType: z.string().optional().describe("Filter by document type"),
          dateRange: z.object({
            start: z.string().or(z.date()).optional(),
            end: z.string().or(z.date()).optional()
          }).optional().describe("Date range for documents")
        })
      }
    ),
    
    // Tool for listing available patient documents
    tool(
      async (args) => {
        try {
          moduleLogger.info('List patient documents tool called', { 
            patientId: args.patientId 
          });
          
          // This would connect to your database to list available documents
          // For now, we'll simulate this with a placeholder response
          // In a real implementation, you would query your document storage
          
          // Placeholder response
          return {
            documents: [
              {
                id: "doc-1",
                title: "Latest Lab Results",
                documentType: "lab_report",
                date: new Date().toISOString(),
                metadata: {
                  pageCount: 2,
                  department: "Pathology"
                }
              },
              {
                id: "doc-2",
                title: "Clinical Notes",
                documentType: "clinical_note",
                date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                metadata: {
                  pageCount: 3,
                  department: "General Medicine"
                }
              }
            ],
            totalCount: 2,
            patientId: args.patientId
          };
        } catch (error) {
          moduleLogger.error('List patient documents failed', { patientId: args.patientId }, error);
          return {
            documents: [],
            error: error instanceof Error ? error.message : 'Unknown error listing documents'
          };
        }
      },
      {
        name: "list_patient_documents",
        description: "List available documents for a patient",
        schema: z.object({
          patientId: z.string().describe("The patient ID"),
          limit: z.number().optional().describe("Maximum number of documents to list"),
          offset: z.number().optional().describe("Offset for pagination"),
          documentTypes: z.array(z.string()).optional().describe("Filter by document types")
        })
      }
    ),
    
    // Tool for getting document details
    tool(
      async (args) => {
        try {
          moduleLogger.info('Document details tool called', { 
            documentId: args.documentId 
          });
          
          // In a real implementation, you would fetch the document from your storage
          // This is a placeholder implementation
          
          return {
            document: {
              id: args.documentId,
              title: "Sample Document",
              documentType: "clinical_note",
              date: new Date().toISOString(),
              content: "Sample document content. This would be the full text of the document.",
              metadata: {
                pageCount: 3,
                department: "General Medicine",
                author: "Dr. John Doe"
              }
            }
          };
        } catch (error) {
          moduleLogger.error('Get document details failed', { documentId: args.documentId }, error);
          return {
            error: error instanceof Error ? error.message : 'Unknown error getting document details'
          };
        }
      },
      {
        name: "get_document_details",
        description: "Get details about a specific document",
        schema: z.object({
          documentId: z.string().describe("The document ID"),
          includeContent: z.boolean().optional().describe("Whether to include full document content")
        })
      }
    )
  ],
  name: "rag_agent",
  prompt: `You are a medical document assistant specializing in patient records.
  
  Your job is to answer questions about patient documents that have already been uploaded 
  and processed by the system. You have access to a retrieval system that can find 
  relevant information in patient documents.
  
  When a user asks about patient information:
  1. Use the retrieve_patient_documents tool to find relevant information
  2. Cite your sources clearly using the format [Document Title]
  3. If information isn't found in the documents, acknowledge this rather than making up answers
  4. Keep responses concise and focused on the medical information requested
  5. Maintain a professional, clinical tone throughout your responses
  
  You can also help users navigate the available documents by:
  - Using list_patient_documents to show what's available
  - Using get_document_details to get more information about a specific document
  
  Remember that you are handling sensitive medical information, so maintain appropriate
  clinical professionalism in your responses.`
});

/**
 * Utility function to format document chunks for agent consumption
 */
function formatChunkForAgent(chunk: DocumentChunk): any {
  return {
    id: chunk.id,
    documentId: chunk.documentId,
    content: chunk.content,
    metadata: {
      documentType: chunk.metadata.documentType,
      section: chunk.metadata.section,
      pageNumber: chunk.metadata.pageNumber,
      documentDate: chunk.metadata.documentDate
    }
  };
}

/**
 * Utility function to format document sources for agent consumption
 */
function formatSourceForAgent(source: DocumentSource): any {
  return {
    documentId: source.documentId,
    title: source.title,
    documentType: source.documentType,
    date: source.date,
    url: source.url
  };
}

export default ragAgent; 