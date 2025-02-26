'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { VerificationPanel } from '@/components/verification/VerificationPanel';
import { VerifiedDocument } from '@/lib/processing/types/verification';

/**
 * Document verification page
 */
export default function VerificationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Get parameters from route and search params
  const documentId = Array.isArray(params.documentId) ? params.documentId[0] : params.documentId;
  const workflowId = searchParams.get('workflowId') || documentId; // Fallback to documentId if no workflowId
  const patientId = searchParams.get('patientId');
  const departmentId = searchParams.get('departmentId');
  const returnUrl = searchParams.get('returnUrl') || `/patients/${patientId}/documents`;
  
  /**
   * Handle verification complete
   */
  const handleVerificationComplete = (verifiedDocument: VerifiedDocument) => {
    // Navigate back to documents page or provided return URL
    router.push(returnUrl);
  };
  
  /**
   * Handle cancel
   */
  const handleCancel = () => {
    router.push(returnUrl);
  };
  
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center">
        <Button
          onClick={() => router.back()}
          size="icon"
          variant="outline"
          className="mr-4"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Document Verification</h1>
          <p className="text-muted-foreground">
            Review and verify extracted information from the document
          </p>
        </div>
      </div>
      
      <Card className="p-6">
        <VerificationPanel
          documentId={documentId}
          workflowId={workflowId}
          patientId={patientId || undefined}
          departmentId={departmentId || undefined}
          onVerificationComplete={handleVerificationComplete}
          onCancel={handleCancel}
        />
      </Card>
    </div>
  );
} 