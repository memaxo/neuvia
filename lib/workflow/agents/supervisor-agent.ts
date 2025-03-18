/**
 * LangGraph Supervisor Agent
 * 
 * This module implements a true supervisor agent that intelligently routes between specialized sub-agents
 * for medical document processing, patient data management, and report generation.
 * 
 * It integrates with the existing workflow architecture defined in supervisor-workflow.ts.
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ProcessingPhase, WorkflowSteps } from "@/lib/types/workflow";

// Import the RAG agent to avoid circular dependencies
import ragAgent from "./rag-agent";

// Import services
import { ExtractionService } from "@/lib/services/document/extraction/extraction-service";
import { DocumentTypeService } from "@/lib/services/document/analysis/document-type-service";
import { DocumentSectionService } from "@/lib/services/document/analysis/document-section-service";
import { KeyPointService } from "@/lib/services/document/analysis/key-point-service";
import { ReportGenerationService } from "@/lib/services/report/report-generation-service";
import { ReportFormattingService } from "@/lib/services/report/report-formatting-service";
import { SupabaseCheckpointer } from "@/lib/workflow/checkpointer/supabase-checkpointer";
import { createSupervisorWorkflow } from "@/lib/workflow/graphs/supervisor-workflow";
import logger from "@/lib/logger";

// Create logger
const moduleLogger = logger.withMetadata({ module: 'SupervisorAgent' });

// Initialize services
const extractionService = new ExtractionService();
const sectionService = new DocumentSectionService();
const typeService = new DocumentTypeService(sectionService);
const keyPointService = new KeyPointService(sectionService);
const reportGenerationService = new ReportGenerationService();
const reportFormattingService = new ReportFormattingService();

/**
 * Create general chat agent for conversation
 */
const chatAgent = createReactAgent({
  llm: new ChatOpenAI({ modelName: "gpt-4o", temperature: 0.3 }),
  tools: [],
  name: "chat_agent",
  prompt: `You are a medical assistant for general conversation.
  You handle basic user queries and provide accurate medical information.
  
  Respond to general medical questions with clear, accurate information.
  Be conversational but professional, maintaining a helpful tone.`
});

const perplexityAgent = createReactAgent({
  llm: new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 }),
  tools: [
    tool(
      async (args) => {
        try {
          moduleLogger.info('Perplexity search tool called', { 
            query: args.query
          });
          
          // This would integrate with the Perplexity API
          // Placeholder implementation
          return {
            results: [
              {
                title: "Search Result 1",
                snippet: `Information related to: ${  args.query}`,
                url: "https://example.com/result1"
              },
              {
                title: "Search Result 2",
                snippet: `More information about: ${  args.query}`,
                url: "https://example.com/result2"
              }
            ],
            searchedAt: new Date().toISOString()
          };
        } catch (error) {
          moduleLogger.error('Perplexity search failed', { query: args.query }, error);
          return {
            results: [],
            error: error instanceof Error ? error.message : 'Unknown search error'
          };
        }
      },
      {
        name: "perplexity_search",
        description: "Search the web using Perplexity API",
        schema: z.object({
          query: z.string().describe("The search query"),
          numResults: z.number().optional().describe("Number of results to return"),
          searchType: z.enum(['comprehensive', 'focused', 'academic']).optional().describe("Type of search to perform")
        })
      }
    )
  ],
  name: "perplexity_agent",
  prompt: `You are a research assistant with web search capabilities.
  Your job is to find accurate, up-to-date information from the web.
  
  When asked to research a topic:
  1. Use the perplexity_search tool to find relevant information
  2. Synthesize the results into a clear, comprehensive answer
  3. Cite your sources
  4. Prioritize medical sources like pubmed, mayo clinic, and other reputable medical sites`
});

/**
 * Create the supervisor agent that will make intelligent routing decisions
 */
const supervisorAgent = createReactAgent({
  llm: new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 }),
  tools: [
    tool(
      async (args) => {
        try {
          moduleLogger.info('Route selection tool called');
          
          // The supervisor agent determines the appropriate route based on the message
          const { message, context } = args;
          
          // Routing logic is determined by the LLM itself via its analysis
          // This route action will be used by the workflow to select the right agent/path
          
          return {
            selectedRoute: args.selectedRoute,
            phase: args.selectedRoute === 'document_extraction' 
              ? ProcessingPhase.EXTRACTION
              : args.selectedRoute === 'verification'
                ? ProcessingPhase.VERIFICATION
                : args.selectedRoute === 'report_generation'
                  ? ProcessingPhase.REPORT_GENERATION
                  : ProcessingPhase.CHAT_PROCESSING,
            confidence: args.confidence || 0.9,
            reason: args.reason,
            context: {
              ...(context || {}),
              lastIntent: args.selectedRoute
            }
          };
        } catch (error) {
          moduleLogger.error('Route selection failed', {}, error);
          return {
            selectedRoute: 'general_chat',
            phase: ProcessingPhase.CHAT_PROCESSING,
            confidence: 0.5,
            reason: 'Fallback due to error',
            error: error instanceof Error ? error.message : 'Unknown routing error'
          };
        }
      },
      {
        name: "select_route",
        description: "Select the appropriate processing route for a user message",
        schema: z.object({
          message: z.string().describe("The user message to analyze"),
          selectedRoute: z.enum([
            'general_chat',
            'document_extraction',
            'document_search',
            'verification',
            'correction',
            'report_generation',
            'web_search'
          ]).describe("The selected route for the message"),
          confidence: z.number().optional().describe("Confidence in the selected route (0-1)"),
          reason: z.string().describe("Reasoning for selecting this route"),
          context: z.record(z.any()).optional().describe("Additional context for processing")
        })
      }
    ),
    
    // Document processing tool that connects to services directly
    tool(
      async (args) => {
        try {
          moduleLogger.info('Document processing tool called', { 
            documentId: args.documentId,
            operation: args.operation 
          });
          
          // Default result structure
          const result: {
            success: boolean;
            operation?: string;
            message?: string;
            error?: string;
          } = { 
            success: false
          };
          
          // Connect to the appropriate service based on the operation
          switch (args.operation) {
            case 'extract':
              // Call extraction service
              // This would be implemented with your actual service call
              result.success = true;
              result.operation = 'extract';
              result.message = `Document ${args.documentId} extraction initiated`;
              break;
              
            case 'analyze':
              // Call analysis services
              result.success = true;
              result.operation = 'analyze';
              result.message = `Document ${args.documentId} analysis initiated`;
              break;
              
            case 'summarize':
              // Generate patient summary
              result.success = true;
              result.operation = 'summarize';
              result.message = `Patient summary for document ${args.documentId} initiated`;
              break;
              
            default:
              result.success = false;
              result.error = "Operation not implemented";
          }
          
          return result;
        } catch (error) {
          moduleLogger.error('Document processing failed', {
            documentId: args.documentId,
            operation: args.operation
          }, error);
          
          return {
            success: false,
            operation: args.operation,
            error: error instanceof Error ? error.message : 'Unknown processing error'
          };
        }
      },
      {
        name: "process_document",
        description: "Process a document through extraction, analysis, or summarization",
        schema: z.object({
          documentId: z.string().describe("The document ID to process"),
          operation: z.enum(['extract', 'analyze', 'summarize']).describe("The operation to perform"),
          options: z.record(z.any()).optional().describe("Operation-specific options")
        })
      }
    ),
    
    // Patient data verification tool
    tool(
      async (args) => {
        try {
          moduleLogger.info('Patient verification tool called', { 
            patientId: args.patientId,
            action: args.action 
          });
          
          // This would connect to your verification service
          return {
            success: true,
            action: args.action,
            message: `Patient ${args.patientId} verification ${args.action} initiated`,
            updatedAt: new Date().toISOString()
          };
        } catch (error) {
          moduleLogger.error('Patient verification failed', {
            patientId: args.patientId,
            action: args.action
          }, error);
          
          return {
            success: false,
            action: args.action,
            error: error instanceof Error ? error.message : 'Unknown verification error'
          };
        }
      },
      {
        name: "verify_patient",
        description: "Verify or update patient information",
        schema: z.object({
          patientId: z.string().describe("The patient ID"),
          action: z.enum(['initiate', 'update', 'confirm']).describe("The verification action"),
          corrections: z.record(z.string()).optional().describe("Data corrections to apply")
        })
      }
    ),
    
    // Report generation tool
    tool(
      async (args) => {
        try {
          moduleLogger.info('Report generation tool called', { 
            patientId: args.patientId,
            reportType: args.reportType 
          });
          
          // This would connect to your report generation service
          return {
            success: true,
            reportId: `report-${Date.now()}`,
            message: `${args.reportType} report for patient ${args.patientId} initiated`,
            generatedAt: new Date().toISOString()
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
          options: z.record(z.any()).optional().describe("Report generation options")
        })
      }
    ),
    
    // Agent delegation tool
    tool(
      async (args) => {
        try {
          moduleLogger.info('Agent delegation tool called', { 
            agent: args.agent,
            query: args.query 
          });
          
          // Add specific handling for RAG agent delegation
          if (args.agent === 'rag_agent' && args.context?.patientId) {
            moduleLogger.info('Delegating to RAG agent with patient context', {
              patientId: args.context.patientId
            });
            
            // In a full implementation, you would properly delegate to the RAG agent
            // and return its response, integrating patient context
            return {
              success: true,
              agent: 'rag_agent',
              response: `Retrieved and analyzed documents for patient ${args.context.patientId} 
               regarding query: "${args.query}"`,
              message: `Delegated to rag_agent: ${args.query}`,
              delegatedAt: new Date().toISOString(),
              usedPatientContext: true
            };
          }
          
          // Default delegation
          return {
            success: true,
            agent: args.agent,
            message: `Delegated to ${args.agent}: ${args.query}`,
            delegatedAt: new Date().toISOString()
          };
        } catch (error) {
          moduleLogger.error('Agent delegation failed', {
            agent: args.agent
          }, error);
          
          return {
            success: false,
            agent: args.agent,
            error: error instanceof Error ? error.message : 'Unknown delegation error'
          };
        }
      },
      {
        name: "delegate_to_agent",
        description: "Delegate processing to a specialized agent",
        schema: z.object({
          agent: z.enum(['chat_agent', 'rag_agent', 'perplexity_agent']).describe("The agent to delegate to"),
          query: z.string().describe("The query to send to the agent"),
          context: z.record(z.any()).optional().describe("Additional context for the agent")
        })
      }
    )
  ],
  name: "supervisor_agent",
  prompt: `You are an intelligent medical workflow supervisor.
  
  Your job is to coordinate a medical document processing system by:
  1. Determining the appropriate processing route for each user message
  2. Delegating to specialized agents when appropriate
  3. Calling document processing services directly when needed
  
  Available routes and when to use them:
  - general_chat: For general medical questions not specific to a patient
  - document_extraction: When a user uploads or wants to process a document
  - document_search: When a user wants to find information in their medical documents
  - verification: When verifying patient information for accuracy
  - correction: When correcting patient information
  - report_generation: When generating medical reports from processed data
  - web_search: When research from the web is needed for a diagnosis or treatment
  
  Available agents:
  - chat_agent: For general medical conversation
  - rag_agent: For searching/retrieving information from patient documents that have already been uploaded and processed
  - perplexity_agent: For web research on medical topics
  
  IMPORTANT RULES FOR AGENT DELEGATION:
  1. When a user asks about information in patient documents that are already in the system, ALWAYS delegate to the rag_agent
  2. When delegating to the rag_agent, ALWAYS include the patientId in the context
  3. For general medical questions not specific to a patient's documents, use the chat_agent
  4. For research on conditions, treatments, or medical topics, use the perplexity_agent
  
  For document processing:
  1. First call select_route to determine the processing path
  2. For document processing, use the process_document tool with the appropriate operation
  3. For verification, use the verify_patient tool
  4. For report generation, use the generate_report tool
  5. For delegating to agents, use the delegate_to_agent tool
  
  Always analyze the user's intent carefully before selecting a route.`
});

/**
 * Create a configured, compiled supervisor workflow with checkpointing
 */
export function createConfiguredSupervisor() {
  // Create agents object to pass to the workflow
  const agents = {
    supervisorAgent,
    chatAgent,
    // Use the imported RAG agent
    ragAgent,
    perplexityAgent
  };
  
  // Create checkpointer
  const checkpointer = new SupabaseCheckpointer();
  
  // Get the workflow and pass it through directly
  // This approach avoids the type issues with the workflow.compile method
  const workflow = createSupervisorWorkflow(checkpointer);
  
  // Here you would register the agents with the workflow
  // This would be implemented based on your specific workflow configuration needs
  
  return workflow;
} 