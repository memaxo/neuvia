import type { ExtractedData } from "./types";
import { createBrowserClient } from "@/lib/supabase/clients";

/**
 * Example FireCrawl usage. Replace or enhance with your real FireCrawl calls if needed.
 * For now, we'll just read the file's text and place it into ExtractedData.
 */

/**
 * Interface for document type metadata
 */
interface DocumentType {
  category: string;
  type: string;
  subtype?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Processing status updates for tracking extraction progress
 */
export interface ProcessingStatus {
  status: 'pending' | 'processing' | 'complete' | 'error';
  progress: number;
  currentStep?: string;
  message?: string;
}

/**
 * Helper function to safely parse JSON
 */
function safeJsonParse(json: unknown): Record<string, unknown> {
  if (!json) return {};
  
  if (typeof json === 'object') return json as Record<string, unknown>;
  
  try {
    if (typeof json === 'string') {
      return JSON.parse(json);
    }
    return {};
  } catch (e) {
    console.error('Error parsing JSON:', e);
    return {};
  }
}

/**
 * processDocument:
 * 1. Creates a workflow state entry to track the extraction
 * 2. Reads File as text
 * 3. Updates workflow state with progress
 * 4. Returns ExtractedData with rawText and optional metadata along with workflowId
 */
export async function processDocument(
  file: File,
  patientId: string,
  documentType: DocumentType,
  statusCallback?: (status: ProcessingStatus) => void
): Promise<ExtractedData & { workflowId: string }> {
  const supabase = createBrowserClient();
  let workflowId = '';

  try {
    // Initial status update
    const initialStatus: ProcessingStatus = {
      status: 'pending',
      progress: 0,
      currentStep: 'Initializing document extraction',
    };
    
    if (statusCallback) {
      statusCallback(initialStatus);
    }

    // 1. Create workflow state entry
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      throw new Error("User not authenticated");
    }

    const { data: workflow, error: workflowError } = await supabase
      .from('workflow_states')
      .insert({
        user_id: userId,
        current_step: 'extracting',
        metadata: {
          documentType: { 
            category: documentType.category,
            type: documentType.type,
            subtype: documentType.subtype || null
          }, 
          patientId,
          filename: file.name,
          fileSize: file.size,
          fileType: file.type
        }
      })
      .select()
      .single();

    if (workflowError || !workflow) {
      throw new Error(`Failed to create workflow state: ${workflowError?.message}`);
    }

    workflowId = workflow.id;

    // 2. Start reading the file
    if (statusCallback) {
      statusCallback({
        status: 'processing',
        progress: 10,
        currentStep: 'Reading file content',
      });
    }

    // Update workflow state with progress
    const existingMetadata = safeJsonParse(workflow.metadata);
    
    await supabase
      .from('workflow_states')
      .update({
        metadata: {
          ...existingMetadata,
          progress: 10, 
          currentStep: 'Reading file content'
        }
      })
      .eq('id', workflowId);

    // Read raw text from file
    const rawText = await file.text();

    // Update progress after file read
    if (statusCallback) {
      statusCallback({
        status: 'processing',
        progress: 30,
        currentStep: 'Analyzing document structure',
      });
    }

    // Update workflow state
    await supabase
      .from('workflow_states')
      .update({
        metadata: {
          ...existingMetadata,
          progress: 30, 
          currentStep: 'Analyzing document structure'
        }
      })
      .eq('id', workflowId);

    // 3. Perform content extraction (simulated steps)
    if (statusCallback) {
      statusCallback({
        status: 'processing',
        progress: 50,
        currentStep: 'Extracting meaningful content',
      });
    }

    // Update workflow state
    await supabase
      .from('workflow_states')
      .update({
        metadata: {
          ...existingMetadata,
          progress: 50, 
          currentStep: 'Extracting meaningful content'
        }
      })
      .eq('id', workflowId);

    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (statusCallback) {
      statusCallback({
        status: 'processing',
        progress: 70,
        currentStep: 'Categorizing document content',
      });
    }

    // Update workflow state
    await supabase
      .from('workflow_states')
      .update({
        metadata: {
          ...existingMetadata,
          progress: 70, 
          currentStep: 'Categorizing document content'
        }
      })
      .eq('id', workflowId);

    // Simulate more processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Create the extracted data result
    const extractedData: ExtractedData = {
      rawText,
      metadata: {
        docType: `${documentType.category}-${documentType.type}`,
        patientId,
        extractionTimestamp: new Date().toISOString(),
        confidence: 0.85, // Example confidence score
      },
      chunks: [
        {
          content: rawText,
          pageNumber: 1
        },
      ],
    };

    // 5. Mark workflow as complete
    if (statusCallback) {
      statusCallback({
        status: 'complete',
        progress: 100,
        currentStep: 'Extraction complete',
      });
    }

    // Serialize extractedData to make it compatible with jsonb
    const serializedExtractedData = {
      rawText: extractedData.rawText,
      metadata: extractedData.metadata,
      chunks: extractedData.chunks?.map(chunk => ({
        content: chunk.content,
        pageNumber: chunk.pageNumber
      })) || []
    };

    // Update workflow state to completed
    await supabase
      .from('workflow_states')
      .update({
        current_step: 'complete',
        metadata: {
          ...existingMetadata,
          progress: 100, 
          currentStep: 'Extraction complete',
          extractedData: serializedExtractedData
        }
      })
      .eq('id', workflowId);

    return { ...extractedData, workflowId };
  } catch (error: any) {
    console.error("Error in processDocument:", error);
    
    // Update callback with error status
    if (statusCallback) {
      statusCallback({
        status: 'error',
        progress: 0,
        currentStep: 'Extraction failed',
        message: error.message || "Failed to process document"
      });
    }

    // Update workflow state if we have an ID
    if (workflowId) {
      await supabase
        .from('workflow_states')
        .update({
          current_step: 'idle',
          metadata: {
            error: error.message || "Failed to process document"
          }
        })
        .eq('id', workflowId);
    }

    // Rethrow with added context
    throw new Error(`Document extraction failed: ${error.message || "Unknown error"}`);
  }
}