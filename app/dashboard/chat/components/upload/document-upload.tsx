'use client';

import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { FileUploader } from '@/components/file-uploader';
import { processDocument } from '@/lib/processing/document-extraction';

export default function DocumentUpload() {
  const [progresses, setProgresses] = useState<Record<string, number>>({});
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);

  const handleUpload = useCallback(async (files: File[], progressCallback: (progress: number, file: File) => void) => {
    if (!files.length) return;

    const file = files[0]; // We only handle one file at a time

    try {
      toast('Processing file. Please wait...');
      
      // Track progress for this specific file
      progressCallback(0, file);
      setProgresses((prev) => ({ ...prev, [file.name]: 0 }));
      
      await processDocument(
        file, 
        'chat-patient', 
        { 
          category: 'clinical', 
          type: 'chat-upload' 
        }
      );

      progressCallback(100, file);
      setProgresses((prev) => ({ ...prev, [file.name]: 100 }));
      toast.success('File processed successfully');

      // Clear the current files after successful upload
      setCurrentFiles([]);
    } catch (err) {
      toast.error('Error occurred during file processing');
      throw err; // Let the FileUploader component handle the error state
    }
  }, []);

  const handleValueChange = useCallback((files: File[]) => {
    // Update current files
    setCurrentFiles(files);
    
    // Reset progress for new files
    const newProgresses: Record<string, number> = {};
    files.forEach(file => {
      newProgresses[file.name] = 0;
    });
    setProgresses(newProgresses);
  }, []);

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-medium">Upload Patient Document for Processing</h2>
      <FileUploader
        accept={{
          'application/pdf': [],
          'text/plain': [],
          'application/msword': [],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': []
        }}
        maxFileCount={1}
        multiple={false}
        onUpload={handleUpload}
        onValueChange={handleValueChange}
        progresses={progresses}
        value={currentFiles}
      />
    </div>
  );
} 