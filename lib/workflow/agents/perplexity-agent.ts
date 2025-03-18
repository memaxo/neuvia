/**
 * Perplexity Agent for Medical and General Research
 * 
 * This agent specializes in performing various types of research using the Perplexity API.
 * It integrates with specialized LangGraph nodes to provide advanced research capabilities.
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Import perplexity graph nodes
import { 
  researchNode,
  comprehensiveResearchNode,
  literatureReviewNode,
  medicalDiagnosisNode,
  patientRecordsAnalysisNode,
  streamingResearchNode,
  processStreamingResultsNode
} from "@/lib/services/perplexity/graph";
import type { PerplexityWorkflowState } from "@/lib/services/perplexity/graph";

// Import types
import type { ResearchOptions, ResearchResult, ResearchType } from "@/lib/types/research";
import logger from "@/lib/logger";

// Create logger
const moduleLogger = logger.withMetadata({ module: 'PerplexityAgent' });

// Define research depth types to match expected values
type ResearchDepth = 'shallow' | 'medium' | 'deep';

/**
 * Create the Perplexity agent for research
 */
export const perplexityAgent = createReactAgent({
  llm: new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 }),
  tools: [
    // Tool for performing general research
    tool(
      async (args) => {
        try {
          moduleLogger.info('General research tool called', { 
            query: args.query,
            researchType: args.researchType
          });
          
          // Configure research options with proper type casting
          const options = {
            depth: (args.depth || 'medium'),
            temperature: args.temperature || 0,
            maxTokens: args.maxTokens,
            includeCitations: args.includeCitations !== false,
            includeSourceContent: args.includeSourceContent === true,
            sourcesLimit: args.sourcesLimit || 8,
            userId: args.userId,
            researchType: args.researchType
          };
          
          // Create node input with proper casting
          const nodeInput = {
            query: args.query,
            options: options as any, // Type assertion to overcome compatibility issues
            config: {}
          };
          
          // Get result based on research type
          let result;
          
          switch (args.researchType) {
            case 'comprehensive-research':
              result = await comprehensiveResearchNode(nodeInput as any);
              break;
              
            case 'literature-review':
              result = await literatureReviewNode(nodeInput as any);
              break;
              
            case 'streaming': {
              const streamingState = await streamingResearchNode(nodeInput as any);
              result = await processStreamingResultsNode(streamingState);
              break;
            }
              
            default:
              result = await researchNode(nodeInput as any);
              break;
          }
          
          if (!result.results || result.results.length === 0) {
            throw new Error('No research results returned');
          }
          
          // Get the research result
          const researchResult = result.results[0] as ResearchResult;
          
          moduleLogger.info('Research completed successfully', { 
            sourceCount: researchResult.sources.length,
            keyFindingsCount: researchResult.keyFindings.length
          });
          
          return {
            text: researchResult.text,
            summary: researchResult.summary,
            keyFindings: researchResult.keyFindings,
            sources: researchResult.sources,
            timestamp: researchResult.timestamp,
            confidence: researchResult.confidence,
            modelName: researchResult.modelName
          };
        } catch (error) {
          moduleLogger.error('Research failed', { query: args.query }, error);
          return {
            error: error instanceof Error ? error.message : 'Unknown research error',
            query: args.query,
            timestamp: new Date()
          };
        }
      },
      {
        name: "perform_research",
        description: "Perform general research on a topic using Perplexity API",
        schema: z.object({
          query: z.string().describe("The research query or question"),
          researchType: z.enum([
            'standard', 
            'comprehensive-research', 
            'literature-review',
            'citation-analysis',
            'streaming'
          ]).default('standard').describe("Type of research to perform"),
          depth: z.enum(['shallow', 'medium', 'deep']).optional().describe("Research depth level"),
          temperature: z.number().min(0).max(1).optional().describe("Temperature for generation (0-1)"),
          maxTokens: z.number().optional().describe("Maximum tokens to generate"),
          includeCitations: z.boolean().optional().describe("Whether to include citations in the results"),
          includeSourceContent: z.boolean().optional().describe("Include source content in results"),
          sourcesLimit: z.number().optional().describe("Maximum number of sources to return"),
          userId: z.string().optional().describe("User ID who initiated the research")
        })
      }
    ),
    
    // Tool for medical-specific research
    tool(
      async (args) => {
        try {
          moduleLogger.info('Medical research tool called', { 
            query: args.query,
            hasMedicalData: !!args.patientData
          });
          
          // Configure medical research options with proper type casting
          const options = {
            depth: (args.depth || 'deep'),
            temperature: args.temperature || 0,
            maxTokens: args.maxTokens,
            includeCitations: args.includeCitations !== false,
            includeSourceContent: true,
            sourcesLimit: args.sourcesLimit || 12,
            userId: args.userId,
            patientId: args.patientId,
            documentId: args.documentId
          };
          
          // Get result based on operation
          let result;
          
          if (args.patientData && args.operation === 'patient-records-analysis' && args.analysisPrompt) {
            result = await patientRecordsAnalysisNode({
              patientData: args.patientData,
              analysisPrompt: args.analysisPrompt,
              options: options as any,
              config: {}
            });
          } else if (args.patientData) {
            result = await medicalDiagnosisNode({
              query: args.query,
              patientData: args.patientData,
              options: options as any,
              config: {}
            });
          } else {
            // If no patient data, use medical diagnosis with just a query
            result = await medicalDiagnosisNode({
              query: args.query,
              patientData: "", // Empty string for the parameter
              options: options as any,
              config: {}
            });
          }
          
          if (!result.results || result.results.length === 0) {
            throw new Error('No medical research results returned');
          }
          
          // Get the research result
          const researchResult = result.results[0] as ResearchResult;
          
          moduleLogger.info('Medical research completed successfully', { 
            sourceCount: researchResult.sources.length,
            keyFindingsCount: researchResult.keyFindings.length
          });
          
          return {
            text: researchResult.text,
            summary: researchResult.summary,
            keyFindings: researchResult.keyFindings,
            sources: researchResult.sources,
            timestamp: researchResult.timestamp,
            confidence: researchResult.confidence,
            modelName: researchResult.modelName,
            hasMedicalContext: true
          };
        } catch (error) {
          moduleLogger.error('Medical research failed', { query: args.query }, error);
          return {
            error: error instanceof Error ? error.message : 'Unknown medical research error',
            query: args.query,
            timestamp: new Date()
          };
        }
      },
      {
        name: "perform_medical_research",
        description: "Perform medical research or diagnosis using Perplexity API",
        schema: z.object({
          query: z.string().describe("The medical research query or diagnostic question"),
          patientData: z.string().optional().describe("Patient data for medical diagnosis"),
          patientId: z.string().optional().describe("Patient ID for the research"),
          documentId: z.string().optional().describe("Document ID if research is related to a document"),
          operation: z.enum(['diagnosis', 'research', 'patient-records-analysis']).default('research').describe("Type of medical operation to perform"),
          analysisPrompt: z.string().optional().describe("Specific analysis prompt for patient records"),
          depth: z.enum(['shallow', 'medium', 'deep']).optional().describe("Research depth level"),
          temperature: z.number().min(0).max(1).optional().describe("Temperature for generation (0-1)"),
          maxTokens: z.number().optional().describe("Maximum tokens to generate"),
          includeCitations: z.boolean().optional().describe("Whether to include citations in the results"),
          sourcesLimit: z.number().optional().describe("Maximum number of sources to return"),
          userId: z.string().optional().describe("User ID who initiated the research")
        })
      }
    ),
    
    // Tool for streaming research
    tool(
      async (args) => {
        try {
          moduleLogger.info('Streaming research tool called', { 
            query: args.query
          });
          
          // Configure streaming research options with proper type casting
          const options = {
            depth: (args.depth || 'medium'),
            temperature: args.temperature || 0,
            maxTokens: args.maxTokens,
            includeCitations: args.includeCitations !== false,
            includeSourceContent: args.includeSourceContent === true,
            userId: args.userId
          };
          
          // Execute the streaming nodes
          const streamingState = await streamingResearchNode({
            query: args.query,
            options: options as any,
            config: {}
          });
          const result = await processStreamingResultsNode(streamingState);
          
          if (!result.results || result.results.length === 0) {
            throw new Error('No streaming research results returned');
          }
          
          // Get the processed streaming result
          const streamingResult = result.results[0] as ResearchResult;
          
          moduleLogger.info('Streaming research completed', { 
            sourceCount: streamingResult.sources.length,
            hasCompletedStream: true
          });
          
          return {
            text: streamingResult.text,
            summary: streamingResult.summary,
            keyFindings: streamingResult.keyFindings || [],
            sources: streamingResult.sources,
            timestamp: streamingResult.timestamp || new Date().toISOString(),
            modelName: streamingResult.modelName,
            isStreamingResult: true
          };
        } catch (error) {
          moduleLogger.error('Streaming research failed', { query: args.query }, error);
          return {
            error: error instanceof Error ? error.message : 'Unknown streaming research error',
            query: args.query,
            timestamp: new Date()
          };
        }
      },
      {
        name: "perform_streaming_research",
        description: "Perform streaming research that returns results incrementally",
        schema: z.object({
          query: z.string().describe("The research query or question"),
          depth: z.enum(['shallow', 'medium', 'deep']).optional().describe("Research depth level"),
          temperature: z.number().min(0).max(1).optional().describe("Temperature for generation (0-1)"),
          maxTokens: z.number().optional().describe("Maximum tokens to generate"),
          includeCitations: z.boolean().optional().describe("Whether to include citations in the results"),
          includeSourceContent: z.boolean().optional().describe("Include source content in results"),
          userId: z.string().optional().describe("User ID who initiated the research")
        })
      }
    ),
    
    // Tool for research status tracking
    tool(
      async (args) => {
        try {
          moduleLogger.info('Research status check tool called', { 
            researchId: args.researchId
          });
          
          // In a real implementation, you would check the status from your database
          // This is a placeholder response
          return {
            status: 'success',
            progress: 100,
            phase: 'completed',
            researchId: args.researchId,
            completedAt: new Date().toISOString()
          };
        } catch (error) {
          moduleLogger.error('Research status check failed', { researchId: args.researchId }, error);
          return {
            error: error instanceof Error ? error.message : 'Unknown status check error',
            status: 'error'
          };
        }
      },
      {
        name: "check_research_status",
        description: "Check the status of ongoing research",
        schema: z.object({
          researchId: z.string().describe("The research ID to check")
        })
      }
    )
  ],
  name: "perplexity_agent",
  prompt: `You are a medical and academic research assistant powered by Perplexity.
  
  Your job is to perform thorough research on topics when requested, using appropriate
  research methods based on the query type. You have access to different research tools
  for different types of queries.
  
  For general research queries:
  1. Use the perform_research tool with the appropriate research type:
     - 'standard' for basic research questions
     - 'comprehensive-research' for deep, thorough analysis
     - 'literature-review' for academic literature review
     - 'citation-analysis' for analyzing research citations
  
  For medical research queries:
  1. Use the perform_medical_research tool with appropriate options:
     - When diagnosing or analyzing patient symptoms, use operation 'diagnosis'
     - When analyzing patient records, use operation 'patient-records-analysis'
     - When researching medical conditions without patient data, use operation 'research'
  
  For real-time streaming research:
  1. Use the perform_streaming_research tool when the user wants to see incremental results
     - This is best for long-running, complex research queries
     - It provides faster initial responses with progressive updates
  
  When reporting research results:
  1. Present your findings in a clear, structured manner
  2. Always cite your sources
  3. Highlight key findings and takeaways
  4. For medical inquiries, maintain a professional clinical tone
  5. Acknowledge limitations or areas of uncertainty
  
  Remember that all medical research should be presented as informational only,
  and users should be encouraged to consult healthcare professionals for definitive
  medical advice.`
});

/**
 * Utility function to format research sources in a readable way
 */
export function formatSourcesForDisplay(sources: any[]): string {
  if (!sources || sources.length === 0) {
    return "No sources available.";
  }
  
  return sources.map((source, index) => {
    const sourceNum = index + 1;
    return `[${sourceNum}] ${source.title || 'Untitled Source'}\n${source.url}`;
  }).join('\n\n');
}

export default perplexityAgent; 