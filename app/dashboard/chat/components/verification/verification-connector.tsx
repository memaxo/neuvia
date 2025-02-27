'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { Loader } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/clients';
import { VerificationAdapter } from './verification-adapter';
import { verificationService } from '@/lib/services/verification/verification-service';
import { useChatContext } from '@/contexts/chat-context';

// Import the types from the standardized path
import type { 
  ExtractedDocument,
  VerifiedDocument,
  VerificationItem,
  VerificationStatus,
  WorkflowStep
} from '@/lib/processing/types/verification';

interface VerificationConnectorProps {
  workflowId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

/**
 * VerificationConnector Component
 * 
 * Connects a workflow to the verification UI system
 * 
 * @deprecated This component uses document verification which is being phased out.
 * Future implementations should use PatientSummaryService.verifySummary() for summary-based verification.
 */
export function VerificationConnector({ 
  workflowId, 
  onComplete,
  onError
}: VerificationConnectorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get access to the workflow from chat context
  const { workflow } = useChatContext();
  
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createBrowserClient();
  
  // Load the workflow state and extracted document
  useEffect(() => {
    async function loadWorkflowData() {
      try {
        setIsLoading(true);
        
        // Check if we have the extracted document in the workflow state
        if (!workflow.extractedDocument) {
          throw new Error('No extracted document found in workflow');
        }
        
        // If everything is loaded, we're good to go
        setIsLoading(false);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setError(errorMessage);
        onError?.(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    loadWorkflowData();
  }, [workflow, toast, onError]);
  
  /**
   * Handle verification complete
   */
  const handleVerificationComplete = async (verifiedDoc: VerifiedDocument) => {
    try {
      // In the updated approach, we would call a method like:
      // workflow.saveVerificationResults(verifiedDoc.verificationItems, verifiedDoc.verificationStatus);
      
      // Move to the next workflow step
      if (workflow.generateReport) {
        await workflow.generateReport(verifiedDoc);
      }
      
      // Notify parent component
      onComplete?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      onError?.(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="text-muted-foreground size-8 animate-spin" />
        <span className="text-muted-foreground ml-2">Loading verification...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-destructive p-4 text-center">
        <p className="font-medium">Error</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }
  
  if (!workflow.extractedDocument) {
    return (
      <div className="text-destructive p-4 text-center">
        <p className="font-medium">No Document Found</p>
        <p className="text-sm">The document extraction failed or was not found.</p>
      </div>
    );
  }
  
  return (
    <VerificationAdapter
      departmentId="1"
      documentId={workflowId}
      extractedDocument={workflow.extractedDocument as unknown as ExtractedDocument}
      onCancel={() => {
        // Use workflow.resetWorkflow method
        workflow.resetWorkflow();
        onComplete?.();
      }}
      onComplete={handleVerificationComplete}
      patientId="patient-id" // Hardcoded for now - the actual ID would come from workflow in a complete implementation
      workflowId={workflowId}
    />
  );
} 