import { useState, useEffect } from 'react';
import { useDocumentWorkflow } from '@/lib/hooks/useDocumentWorkflow';
import { DocumentCategory } from '@/lib/services/workflow/definitions/document-workflow-definition';

interface DocumentProcessorProps {
  userId: string;
  workflowId: string;
  patientId?: string;
}

export function DocumentProcessor({ userId, workflowId, patientId }: DocumentProcessorProps) {
  const {
    status,
    context,
    uploadDocument,
    extractContent,
    startVerification,
    completeVerification,
    retryWorkflow
  } = useDocumentWorkflow({ workflowId, userId });
  
  const [file, setFile] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  
  // When file changes, upload it
  useEffect(() => {
    if (file && status.isIdle) {
      handleUpload();
    }
  }, [file, status.isIdle]);
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile({
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type
      });
      setError(null);
    }
  };
  
  // Handle document upload
  const handleUpload = async () => {
    if (!file) return;
    
    const result = await uploadDocument(file, {
      patientId,
      documentType: {
        category: DocumentCategory.MEDICAL,
        type: 'report'
      }
    });
    
    if (result.isFailure()) {
      setError(result.error.message);
    }
  };
  
  // Handle content extraction
  const handleExtract = async () => {
    const result = await extractContent();
    
    if (result.isFailure()) {
      setError(result.error.message);
    }
  };
  
  // Handle verification
  const handleStartVerification = async () => {
    const result = await startVerification();
    
    if (result.isFailure()) {
      setError(result.error.message);
    }
  };
  
  // Handle verification approval/rejection
  const handleVerification = async (approved: boolean) => {
    const result = await completeVerification(approved, {
      notes: approved ? 'Document approved' : 'Document rejected',
      reason: approved ? undefined : 'Document content is insufficient'
    });
    
    if (result.isFailure()) {
      setError(result.error.message);
    }
  };
  
  // Handle retry from error
  const handleRetry = async () => {
    const result = await retryWorkflow();
    
    if (result.isFailure()) {
      setError(result.error.message);
    } else {
      setError(null);
    }
  };
  
  return (
    <div className="p-4 border rounded-md shadow-sm">
      <h2 className="text-lg font-medium mb-4">Document Processing</h2>
      
      {/* Status display */}
      <div className="mb-4">
        <div className="flex justify-between">
          <span>Status:</span>
          <span className="font-medium">{status.currentStep}</span>
        </div>
        
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${context.progress}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-sm text-gray-500 mt-1">
          <span>Phase: {context.phase}</span>
          <span>{context.progress}%</span>
        </div>
      </div>
      
      {/* File upload section */}
      {status.isIdle && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Select document
          </label>
          
          <input
            type="file"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-medium
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
          />
        </div>
      )}
      
      {/* Action buttons based on state */}
      <div className="space-y-2">
        {status.isUploading && (
          <div className="text-sm text-gray-500">
            Uploading document: {context.fileName}...
          </div>
        )}
        
        {status.isExtracting && (
          <div className="text-sm text-gray-500">
            Extracting content...
          </div>
        )}
        
        {status.isVerificationPending && (
          <button
            onClick={handleStartVerification}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium"
          >
            Start Verification
          </button>
        )}
        
        {status.isVerificationInProgress && (
          <div className="flex space-x-2">
            <button
              onClick={() => handleVerification(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium"
            >
              Approve
            </button>
            
            <button
              onClick={() => handleVerification(false)}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium"
            >
              Reject
            </button>
          </div>
        )}
        
        {status.isVerificationCompleted && (
          <div className="text-sm text-green-600 font-medium">
            Document verified successfully!
          </div>
        )}
        
        {status.isVerificationFailed && (
          <div className="text-sm text-red-600 font-medium">
            Document verification failed: {context.error}
          </div>
        )}
        
        {status.isComplete && (
          <div className="text-sm text-green-600 font-medium">
            Document processing complete!
          </div>
        )}
        
        {status.isError && (
          <div>
            <div className="text-sm text-red-600 font-medium mb-2">
              Error: {context.error}
            </div>
            
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium"
            >
              Retry
            </button>
          </div>
        )}
      </div>
      
      {/* Error message display */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}
      
      {/* Document metadata */}
      {context.documentId && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm">
          <h3 className="font-medium mb-2">Document Information</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <dt className="text-gray-500">Document ID:</dt>
            <dd>{context.documentId}</dd>
            
            <dt className="text-gray-500">File Name:</dt>
            <dd>{context.fileName}</dd>
            
            <dt className="text-gray-500">Size:</dt>
            <dd>{context.fileSize} bytes</dd>
            
            <dt className="text-gray-500">Type:</dt>
            <dd>{context.fileType}</dd>
            
            {context.documentType && (
              <>
                <dt className="text-gray-500">Category:</dt>
                <dd>{context.documentType.category}</dd>
                
                <dt className="text-gray-500">Document Type:</dt>
                <dd>{context.documentType.type}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}