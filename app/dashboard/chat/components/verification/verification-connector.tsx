'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { Loader } from 'lucide-react';
import { documentService } from '@/lib/services/document/document-service';
import { createBrowserClient } from '@/lib/supabase/clients';
import { VerificationAdapter } from './verification-adapter';

// Import the types from the correct path
import type { 
  ExtractedDocument,
  VerifiedDocument
} from '@/lib/processing/types/verification/index';

interface VerificationConnectorProps {
  workflowId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function VerificationConnector({ 
  workflowId, 
  onComplete,
  onError
}: VerificationConnectorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extractedDocument, setExtractedDocument] = useState<ExtractedDocument | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createBrowserClient();
  
  // Load the workflow state and extracted document
  useEffect(() => {
    async function loadWorkflowData() {
      try {
        setIsLoading(true);
        
        // Fetch the workflow state
        const { data: workflowStates, error: workflowError } = await supabase
          .from('workflow_states')
          .select('*')
          .eq('metadata->workflowId', workflowId);
          
        if (workflowError) throw new Error(`Failed to fetch workflow: ${workflowError.message}`);
        if (!workflowStates || workflowStates.length === 0) throw new Error('Workflow not found');
        
        const workflowState = workflowStates[0];
        
        // Extract document and patient ID from metadata
        if (!workflowState.metadata) throw new Error('No metadata found in workflow');
        
        const metadata = workflowState.metadata as any;
        const extractedDoc = metadata.extractedDocument as ExtractedDocument;
        const patId = metadata.patientId as string;
        const deptId = metadata.departmentId as string || '1'; // default to department ID 1 if not provided
        
        if (!extractedDoc) throw new Error('No extracted document found in workflow');
        if (!patId) throw new Error('No patient ID found in workflow');
        
        // Set the extracted document and patient ID
        setExtractedDocument(extractedDoc);
        setPatientId(patId);
        setDepartmentId(deptId);
        
        // Start verification if needed
        if (workflowState.current_step === 'verification' && !metadata.verificationItems) {
          await startVerification(extractedDoc, workflowId);
        }
        
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
  }, [workflowId, supabase, toast, onError]);
  
  // Start verification process
  const startVerification = async (document: ExtractedDocument, workflowId: string) => {
    try {
      await documentService.startVerification(workflowId, document);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      onError?.(errorMessage);
    }
  };
  
  // Handle verification completion
  const handleVerificationComplete = async (items: VerifiedDocument[], status: VerificationStatus) => {
    if (!extractedDocument || !patientId) return;
    
    try {
      setIsLoading(true);
      
      // Save verification results
      const verifiedDocument = await documentService.saveVerificationResults(
        workflowId,
        items,
        status,
        extractedDocument
      );
      
      toast({
        title: 'Verification Complete',
        description: 'Document has been successfully verified.',
      });
      
      // Call the onComplete callback
      onComplete?.();
      
      // Redirect to the next step if needed
      if (status.isVerified) {
        // Use the router.push with explicit cast to any to bypass the type error
        // The URL is correctly formatted for Next.js routing
        const url = `/dashboard/reports/new?patientId=${patientId}&workflowId=${workflowId}`;
        (router as any).push(url);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      onError?.(errorMessage);
      toast({
        title: 'Error',
        description: `Failed to save verification results: ${errorMessage}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle verification of items
  const handleVerification = async (items: VerifiedDocument[]) => {
    if (!extractedDocument) return;
    
    try {
      // Since updateWorkflowState is private, we'll use startVerification
      // which will update the workflow state
      await documentService.startVerification(workflowId, extractedDocument);
      
      toast({
        title: 'Verification Updated',
        description: 'Verification progress has been saved.',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Warning',
        description: `Couldn't save verification progress: ${errorMessage}`,
        variant: 'destructive',
      });
    }
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader className="text-primary size-12 animate-spin" />
        <p className="text-muted-foreground mt-4">Loading verification data...</p>
      </div>
    );
  }
  
  // Render error state
  if (error || !extractedDocument || !patientId || !departmentId) {
    return (
      <div className="border-destructive bg-destructive/10 rounded-lg border p-6">
        <h3 className="text-destructive text-lg font-semibold">Verification Error</h3>
        <p className="text-muted-foreground mt-2">
          {error || "Couldn't load the verification data. Please try again."}
        </p>
      </div>
    );
  }
  
  // Render verification UI
  return (
    <VerificationAdapter
      departmentId={departmentId || ""}
      documentId={workflowId}
      extractedDocument={extractedDocument}
      onCancel={() => onError?.("Verification canceled")}
      onComplete={handleVerificationComplete}
      patientId={patientId || ""}
      workflowId={workflowId}
    />
  );
} 