/**
 * Thread Management Example for LangGraph
 * 
 * This example demonstrates how to use the enhanced thread management capabilities.
 * It shows common patterns like forking a thread for exploring alternative hypotheses,
 * managing thread lifecycle, and implementing conversation history.
 */

import { createSupabaseCheckpointer, ThreadStatus, type ThreadMetadata } from '../checkpointer/supabase-checkpointer';
import { createInitialWorkflowState, type WorkflowState } from '../state/workflow-state';
import { createSupervisorWorkflow } from '../graphs/supervisor-workflow';

/**
 * Example: Creating multiple alternative diagnoses from a single patient case
 * This shows how to fork a thread to explore different diagnostic hypotheses
 */
export async function forkThreadForAlternativeDiagnoses(
  patientId: string, 
  userId: string
): Promise<{ mainThreadId: string; alternativeThreadIds: string[] }> {
  // 1. Create the checkpointer
  const checkpointer = createSupabaseCheckpointer();
  
  // 2. Initialize the main thread
  const mainThreadId = crypto.randomUUID();
  const initialState = createInitialWorkflowState(patientId, userId, mainThreadId);
  initialState.currentMessage = {
    content: "Analyze this patient's symptoms and provide a diagnosis.",
    role: 'user',
    createdAt: new Date().toISOString()
  };
  
  // 3. Save the initial state
  await checkpointer.save(initialState, mainThreadId);
  
  // 4. Run the workflow to generate the main diagnosis
  const workflow = createSupervisorWorkflow(checkpointer);
  const mainDiagnosisState = await workflow.invoke(initialState);
  
  // 5. Create alternative diagnosis threads by forking
  const alternativeThreadIds: string[] = [];
  
  // Fork for a second opinion (alternative diagnosis)
  const alternativeDiagnosisId = await checkpointer.fork({
    parentThreadId: mainThreadId,
    name: "Alternative Diagnosis",
    metadata: {
      purpose: "alternative_diagnosis",
      modelApproach: "conservative",
      diagnosisType: "differential",
      createdAt: new Date().toISOString()
    }
  });
  alternativeThreadIds.push(alternativeDiagnosisId);
  
  // Fork for rare disease consideration
  const rareDiseaseId = await checkpointer.fork({
    parentThreadId: mainThreadId,
    name: "Rare Disease Analysis",
    metadata: {
      purpose: "rare_disease_analysis",
      modelApproach: "exploratory",
      diagnosisType: "edge_case",
      createdAt: new Date().toISOString()
    }
  });
  alternativeThreadIds.push(rareDiseaseId);
  
  // 6. Continue each alternative thread with a specific prompt
  const alternativeContinuation = await workflow.continue(alternativeDiagnosisId);
  const rareContinuation = await workflow.continue(rareDiseaseId);
  
  return {
    mainThreadId,
    alternativeThreadIds
  };
}

/**
 * Example: Managing thread lifecycle
 * Shows how to handle thread archiving, pausing, and restoration
 */
export async function manageThreadLifecycle(threadId: string): Promise<void> {
  const checkpointer = createSupabaseCheckpointer();
  
  // 1. Pause a thread (e.g., when waiting for lab results)
  await checkpointer.pause(threadId);
  console.log(`Thread ${threadId} paused`);
  
  // 2. Archive threads that are no longer needed
  // This doesn't delete them, just marks them as archived
  await checkpointer.archive(threadId);
  console.log(`Thread ${threadId} archived`);
  
  // 3. Restore an archived thread when needed again
  await checkpointer.restore(threadId);
  console.log(`Thread ${threadId} restored`);
  
  // 4. List active threads for a user
  const activeThreads = await checkpointer.list({
    status: ThreadStatus.ACTIVE,
    userId: 'user-123'
  });
  console.log(`Found ${activeThreads.length} active threads`);
  
  // 5. Permanently delete a thread (use sparingly)
  await checkpointer.archive(threadId, true);
  console.log(`Thread ${threadId} permanently deleted`);
}

/**
 * Example: Thread metadata for search and discovery
 * Shows how to use thread metadata for better organization
 */
export async function addThreadMetadata(
  threadId: string,
  metadata: ThreadMetadata
): Promise<void> {
  const checkpointer = createSupabaseCheckpointer();
  
  // Load the current state
  const state = await checkpointer.load(threadId);
  
  if (!state || !state.threadId) {
    throw new Error(`Thread ${threadId} not found`);
  }
  
  // Update the state with new metadata
  const updatedState: WorkflowState = {
    ...state,
    metadata: {
      ...state.metadata,
      threadInfo: {
        ...(state.metadata?.threadInfo || {}),
        ...metadata
      }
    }
  };
  
  // Save the updated state
  await checkpointer.save(updatedState, threadId);
  
  console.log(`Updated thread ${threadId} with metadata`);
}

/**
 * Example: Finding threads by query using thread metadata
 */
export async function findThreadsByTopicOrIntent(
  searchTerm: string,
  userId: string
): Promise<WorkflowState[]> {
  const checkpointer = createSupabaseCheckpointer();
  
  // Get all user threads (filtering happens client-side for this example)
  const allThreads = await checkpointer.list({ 
    userId,
    includeArchived: true // Include archived threads in search
  });
  
  // Filter threads based on metadata
  const matchingThreads = allThreads.filter(thread => {
    const threadInfo = thread.metadata?.threadInfo;
    if (!threadInfo) return false;
    
    // Check various metadata fields for matches
    return (
      (threadInfo.topic && threadInfo.topic.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (threadInfo.tags && threadInfo.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))) ||
      (threadInfo.intent && threadInfo.intent.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (threadInfo.description && threadInfo.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });
  
  return matchingThreads;
}