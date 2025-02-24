'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';

import { FileUploader } from '@/components/file-uploader/file-uploader';
import { processDocument } from '@/lib/processing/gemini';
import type { ProcessingStatus } from '@/lib/processing/types';

export default function DocumentUpload() {
  const [progresses, setProgresses] = useState<Record<string, number>>({});
import { processDocument } from "@/lib/processing/document-extraction";

// ...

// Instead of fetch to gemini-flash, call the new processDocument method directly:
// (Example usage, may need adjustments depending on local code)

const fileObj = formData.get("file") as File;
const patientId = "somePatientId"; // or read from context/props
const documentType = {
  category: "clinical",
  type: "progressNote"
};

try {
  const result = await processDocument(fileObj, patientId, documentType);
  // Handle result, e.g. show success or data
} catch (error) {
  console.error("Error processing document:", error);
  // Handle error state
}
    if (!files.length) return;

    try {
      toast('Processing file. Please wait...');
      // Use default category "clinical" and type "chat-upload" or similar
      await processDocument(files[0], 'chat-patient', { category: 'clinical', type: 'chat-upload' } );
      toast.success('File processed successfully');
    } catch (err) {
      console.error(err);
      toast.error('Error occurred during file processing');
    }
  };

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-medium">Upload Patient Document for Processing</h2>
      <FileUploader
        accept={{
          'application/pdf': [],
          'text/plain': [],
          'application/msword': []
        }}
        maxFileCount={1}
        multiple={false}
        onUpload={handleUpload}
        onValueChange={(files) => console.log('Files changed', files)}
        progresses={progresses}
      />
    </div>
  );
} 