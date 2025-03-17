/**
 * LangGraph Supervisor Agent
 * 
 * This module implements a supervisor agent that coordinates specialized sub-agents
 * for medical document processing, patient data management, and report generation.
 * 
 * It utilizes the @langchain/langgraph-supervisor package to create a hierarchical
 * multi-agent system where a supervisor orchestrates multiple specialized agents.
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Import services
import { extractionService } from "@/lib/services/document/extraction/extraction-service";
import { DocumentTypeService } from "@/lib/services/document/analysis/document-type-service";
import { DocumentSectionService } from "@/lib/services/document/analysis/document-section-service";
import { KeyPointService } from "@/lib/services/document/analysis/key-point-service";
import { SupabaseCheckpointer } from "@/lib/workflow/checkpointer/supabase-checkpointer";
import logger from "@/lib/logger";

// Create logger
const moduleLogger = logger.withMetadata({ module: 'SupervisorAgent' });

// Initialize services
const sectionService = new DocumentSectionService();
const typeService = new DocumentTypeService(sectionService);
const keyPointService = new KeyPointService(sectionService);

/**
 * Create document extraction agent
 */
const extractionAgent = createReactAgent({
  llm: new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 }),
  tools: [
    tool(
      async (args) => {
        try {
          moduleLogger.info('Extraction tool called', { documentId: args.documentId });
          
          // Call extraction service
          const result = await extractionService.extract(args.documentId, args.options);
          
          return {
            success: true,
            text: result.text?.substring(0, 1000) + "...", // Truncate for tool response
            confidence: result.confidence,
            extractedAt: new Date().toISOString()
          };
        } catch (error) {
          moduleLogger.error('Extraction failed', { documentId: args.documentId }, error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown extraction error'
          };
        }
      },
      {
        name: "extract_document",
        description: "Extract text and data from a medical document",
        schema: z.object({
          documentId: z.string().describe("The ID of the document to extract"),
          options: z.object({
            splitPages: z.boolean().optional().describe("Whether to split the document by pages"),
            extractTables: z.boolean().optional().describe("Whether to extract tables from the document"),
            detectSections: z.boolean().optional().describe("Whether to detect document sections"),
            ocrImages: z.boolean().optional().describe("Whether to OCR images in the document"),
            preserveLayout: z.boolean().optional().describe("Whether to preserve document layout")
          }).optional().describe("Extraction options")
        })
      }
    )
  ],
  name: "extraction_agent",
  prompt: `You are a medical document extraction specialist. 
  Your job is to extract text content from medical documents accurately.
  
  When asked to process a document:
  1. Always call the extract_document tool with the document ID
  2. Report the extraction confidence
  3. Keep your responses focused on the extraction task`
});

/**
 * Create document analysis agent
 */
const analysisAgent = createReactAgent({
  llm: new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 }),
  tools: [
    tool(
      async (args) => {
        try {
          moduleLogger.info('Analysis tool called', { textLength: args.text?.length });
          
          // Detect document type
          const typeResult = await typeService.detectDocumentType(args.text);
          
          // Extract key points if we have a document type
          const keyPoints = await keyPointService.extractKeyPoints(args.text, typeResult.type);
          
          // Create a basic summary from top key points
          let summary = '';
          if (keyPoints.length > 0) {
            // Use the highest-scoring key points to build a summary
            const topPoints = keyPoints
              .sort((a, b) => b.score - a.score)
              .slice(0, 3)
              .map(kp => kp.text);
            
            summary = `This appears to be a ${typeResult.type.type} document`;
            
            if (typeResult.detectedSections && typeResult.detectedSections.length > 0) {
              summary += ` with sections including ${typeResult.detectedSections.slice(0, 3).join(', ')}`;
            }
            
            summary += `. Key information: ${topPoints.join(' ')}`;
          }
          
          return {
            success: true,
            summary,
            documentType: typeResult.type,
            confidence: typeResult.confidence,
            keyPoints: keyPoints.slice(0, 5).map(kp => kp.text), // Top 5 key points
            analyzedAt: new Date().toISOString()
          };
        } catch (error) {
          moduleLogger.error('Analysis failed', {}, error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown analysis error'
          };
        }
      },
      {
        name: "analyze_document",
        description: "Analyze document content to detect type, sections, and key points",
        schema: z.object({
          text: z.string().describe("The document text to analyze"),
          options: z.object({
            detectSections: z.boolean().optional().describe("Whether to detect document sections"),
            extractKeyPoints: z.boolean().optional().describe("Whether to extract key points"),
            maxKeyPoints: z.number().optional().describe("Maximum number of key points to extract")
          }).optional().describe("Analysis options")
        })
      }
    )
  ],
  name: "analysis_agent",
  prompt: `You are a medical document analysis specialist.
  Your job is to analyze medical document content to identify the document type, important sections, and key information.
  
  When asked to analyze a document:
  1. Call the analyze_document tool with the document text
  2. Explain what type of medical document it is
  3. Highlight the most important information found`
});

/**
 * Create patient summary agent
 */
const summaryAgent = createReactAgent({
  llm: new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 }),
  tools: [
    tool(
      async (args) => {
        try {
          moduleLogger.info('Summary generation tool called', { patientId: args.patientId });
          
          // This would connect to your patient summary service
          // Using a placeholder response for now
          return {
            success: true,
            summary: `Patient summary generated from ${args.documentText?.substring(0, 100)}...`,
            sections: {
              patientInfo: "...",
              medicalHistory: "...",
              currentConditions: "...",
              medications: "..."
            },
            generatedAt: new Date().toISOString()
          };
        } catch (error) {
          moduleLogger.error('Summary generation failed', { patientId: args.patientId }, error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown summary generation error'
          };
        }
      },
      {
        name: "generate_patient_summary",
        description: "Generate a patient summary from document content",
        schema: z.object({
          patientId: z.string().describe("The patient ID"),
          documentText: z.string().describe("The document text to summarize"),
          documentType: z.object({
            category: z.string(),
            type: z.string()
          }).describe("The detected document type")
        })
      }
    )
  ],
  name: "summary_agent",
  prompt: `You are a medical summary specialist.
  Your job is to create concise, accurate summaries of patient information from medical documents.
  
  When asked to summarize patient information:
  1. Call the generate_patient_summary tool with the patient ID and document text
  2. Structure the information in a clear, organized way
  3. Focus on the most relevant medical details for the patient`
});

/**
 * Create verification agent
 */
const verificationAgent = createReactAgent({
  llm: new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 }),
  tools: [
    tool(
      async (args) => {
        try {
          moduleLogger.info('Verification tool called', { 
            patientId: args.patientId,
            verificationId: args.verificationId 
          });
          
          // This would connect to your verification service
          // Using a placeholder response for now
          return {
            success: true,
            status: args.action === 'initiate' ? 'pending' : 
                   args.action === 'confirm' ? 'completed' : 'in_progress',
            items: [
              { field: 'name', value: 'John Doe', verified: true },
              { field: 'dob', value: '1980-01-01', verified: true }
            ],
            verifiedAt: args.action === 'confirm' ? new Date().toISOString() : null
          };
        } catch (error) {
          moduleLogger.error('Verification failed', { patientId: args.patientId }, error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown verification error'
          };
        }
      },
      {
        name: "verify_patient_data",
        description: "Verify patient information",
        schema: z.object({
          patientId: z.string().describe("The patient ID"),
          verificationId: z.string().optional().describe("The verification ID if already initiated"),
          action: z.enum(['initiate', 'check', 'confirm', 'correct']).describe("The verification action to perform"),
          corrections: z.record(z.string()).optional().describe("Corrections to apply")
        })
      }
    )
  ],
  name: "verification_agent",
  prompt: `You are a medical verification specialist.
  Your job is to verify patient information for accuracy and completeness.
  
  When asked to verify patient information:
  1. Call the verify_patient_data tool with the appropriate action
  2. If initiating verification, explain what needs to be verified
  3. If confirming or correcting, report the outcome of the verification`
});

/**
 * Create report generation agent
 */
const reportAgent = createReactAgent({
  llm: new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 }),
  tools: [
    tool(
      async (args) => {
        try {
          moduleLogger.info('Report generation tool called', { 
            patientId: args.patientId,
            reportType: args.reportType 
          });
          
          // This would connect to your report service
          // Using a placeholder response for now
          return {
            success: true,
            reportId: `report-${Date.now()}`,
            reportType: args.reportType,
            summary: `Medical report generated for patient ${args.patientId}`,
            generatedAt: new Date().toISOString(),
            url: `https://example.com/reports/report-${Date.now()}`
          };
        } catch (error) {
          moduleLogger.error('Report generation failed', { 
            patientId: args.patientId,
            reportType: args.reportType 
          }, error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown report generation error'
          };
        }
      },
      {
        name: "generate_report",
        description: "Generate a medical report",
        schema: z.object({
          patientId: z.string().describe("The patient ID"),
          reportType: z.string().describe("The type of report to generate"),
          summary: z.string().optional().describe("Summary to include in the report"),
          includeVerification: z.boolean().optional().describe("Whether to include verification data")
        })
      }
    )
  ],
  name: "report_agent",
  prompt: `You are a medical report generation specialist.
  Your job is to create comprehensive, accurate medical reports based on verified patient information.
  
  When asked to generate a report:
  1. Call the generate_report tool with the patient ID and report type
  2. Explain what type of report was generated
  3. Provide a summary of the report contents`
});

/**
 * Create chat response agent
 */
const responseAgent = createReactAgent({
  llm: new ChatOpenAI({ modelName: "gpt-4o", temperature: 0.3 }),
  tools: [
    tool(
      async (args) => {
        try {
          moduleLogger.info('Intent detection tool called', { 
            messageLength: args.message?.length
          });
          
          // Simple regex-based intent detection
          // In a real implementation, this would use a more sophisticated approach
          const message = args.message.toLowerCase();
          let intent = 'general_chat';
          
          if (message.includes('extract') || message.includes('process document')) {
            intent = 'document_extraction';
          } else if (message.includes('verify') || message.includes('confirm')) {
            intent = 'verification';
          } else if (message.includes('correct') || message.includes('change')) {
            intent = 'correction';
          } else if (message.includes('report') || message.includes('generate report')) {
            intent = 'report_generation';
          } else if (message.includes('summarize') || message.includes('summary')) {
            intent = 'summarization';
          }
          
          return {
            intent,
            confidence: 0.9,
            detectedAt: new Date().toISOString()
          };
        } catch (error) {
          moduleLogger.error('Intent detection failed', {}, error);
          return {
            intent: 'general_chat',
            confidence: 0.5,
            error: error instanceof Error ? error.message : 'Unknown intent detection error'
          };
        }
      },
      {
        name: "detect_intent",
        description: "Detect the intent of a user message",
        schema: z.object({
          message: z.string().describe("The user message to analyze")
        })
      }
    )
  ],
  name: "response_agent",
  prompt: `You are a medical assistant responsible for user interaction.
  Your job is to understand user messages, detect their intent, and provide helpful responses.
  
  When a user sends a message:
  1. Call the detect_intent tool to understand what they want
  2. Respond appropriately based on the detected intent
  3. If they're asking about documents, verification, or reports, mention what you can help them with`
});

/**
 * Create the supervisor multi-agent system
 */
export function createMedicalSupervisor() {
  // Create supervisor
  const workflow = createSupervisor({
    agents: [
      extractionAgent,
      analysisAgent,
      summaryAgent,
      verificationAgent,
      reportAgent,
      responseAgent
    ],
    llm: new ChatOpenAI({ 
      modelName: "gpt-4o", 
      temperature: 0
    }),
    outputMode: "last_message",
    prompt: `You are a medical workflow supervisor managing a team of specialized agents.
    
    Your job is to determine which agent should handle each task:
    
    - For document upload and extraction, use extraction_agent
    - For document analysis, use analysis_agent
    - For patient data summarization, use summary_agent
    - For verifying information, use verification_agent
    - For generating reports, use report_agent
    - For responding to general queries, use response_agent
    
    IMPORTANT: Follow this workflow sequence:
    1. First, understand user intent using response_agent
    2. For document processing:
       a. First extraction_agent
       b. Then analysis_agent
       c. Then summary_agent
    3. For verification steps:
       a. First verification_agent
       b. Then possibly send to summary_agent for updates
    4. For report generation:
       a. Ensure verification is complete
       b. Then use report_agent
    
    Manage the workflow carefully, making sure each step is completed before proceeding 
    to the next dependent step.`
  });
  
  return workflow;
}

/**
 * Create a configured, compiled supervisor workflow with checkpointing
 */
export function createConfiguredSupervisor() {
  // Get workflow
  const workflow = createMedicalSupervisor();
  
  // Create checkpointer
  const checkpointer = new SupabaseCheckpointer();
  
  // Compile with checkpointer
  const app = workflow.compile({
    checkpointer
  });
  
  return app;
} 