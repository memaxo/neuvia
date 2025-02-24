'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

import { processDocument } from '../../../../../../lib/processing/gemini';
import type { ProcessingStatus, DocumentCategory, DocumentType } from '../../../../../../lib/processing/types';

const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: 'clinical', label: 'Clinical Records' },
  { value: 'lab', label: 'Laboratory Results' },
  { value: 'imaging', label: 'Imaging Reports' },
  { value: 'prescription', label: 'Prescriptions' },
  { value: 'administrative', label: 'Administrative' },
];

const DOCUMENT_TYPES: Record<DocumentCategory, { value: string; label: string }[]> = {
  clinical: [
    { value: 'progress_note', label: 'Progress Note' },
    { value: 'consultation', label: 'Consultation' },
    { value: 'discharge_summary', label: 'Discharge Summary' },
  ],
  lab: [
    { value: 'blood_work', label: 'Blood Work' },
    { value: 'urinalysis', label: 'Urinalysis' },
    { value: 'pathology', label: 'Pathology Report' },
  ],
  imaging: [
    { value: 'xray', label: 'X-Ray Report' },
    { value: 'mri', label: 'MRI Report' },
    { value: 'ct_scan', label: 'CT Scan Report' },
  ],
  prescription: [
    { value: 'medication', label: 'Medication' },
    { value: 'treatment', label: 'Treatment Plan' },
  ],
  administrative: [
    { value: 'insurance', label: 'Insurance' },
    { value: 'consent', label: 'Consent Forms' },
    { value: 'referral', label: 'Referral' },
  ],
};

export default function DocumentUploadPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('clinical');
  const [selectedType, setSelectedType] = useState<string>('');
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    status: 'processing',
    progress: 0
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedCategory || !selectedType) {
      toast({
        title: 'Missing Information',
        description: 'Please select a file, category, and document type.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsUploading(true);

      const documentType: DocumentType = {
        category: selectedCategory,
        type: selectedType,
      };

      // Initiate extraction using the same shared ingestion logic
      toast({
        title: 'Extraction In Progress',
        description: 'Please wait while we process the file. This may take a few minutes.',
      });

      await processDocument(
        selectedFile,
        params.id as string,
        documentType,
        (status: ProcessingStatus) => {
          setProcessingStatus(status);
        }
      );

      // Once the extraction is triggered, navigate to an extraction loading screen
      router.push(`/dashboard/patients/${params.id}/documents/extraction-loading`);

    } catch (error) {
      console.error('Error processing document:', error);
      toast({
        title: 'Document Processing Error',
        description: 'Something went wrong during extraction. Please try again or contact support.',
        variant: 'destructive',
        action: {
          label: 'Try again',
          onClick: () => handleUpload(),
        },
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      {from === 'patientCreate' && (
        <div className="mb-4 rounded-lg bg-green-600 p-4 text-white">
          Patient record created successfully!
        </div>
      )}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Upload Patient Documents</h1>
        <p className="text-muted-foreground">
          Upload medical records, test results, or any other relevant documents. 
          The AI will analyze them and extract key information.
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          {/* Document Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category">Document Category</Label>
            <Select
              defaultValue={selectedCategory}
              onValueChange={(value: DocumentCategory) => {
                setSelectedCategory(value);
                setSelectedType('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Document Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="type">Document Type</Label>
            <Select
              defaultValue={selectedType}
              onValueChange={setSelectedType}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES[selectedCategory].map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Upload */}
          <div className="flex w-full items-center justify-center">
            <label 
              aria-label="Upload document"
              className="flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed hover:bg-[rgb(var(--primary))/0.05]"
              htmlFor="file-upload"
            >
              <div className="flex flex-col items-center justify-center pb-6 pt-5">
                <svg
                  aria-hidden="true"
                  className="mb-4 size-8 text-[rgb(var(--primary))]"
                  fill="none"
                  viewBox="0 0 20 16"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
                <p className="mb-2 text-sm">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-muted-foreground text-xs">
                  PDF, DOCX, or images (max 10MB)
                </p>
                {selectedFile && (
                  <p className="text-muted-foreground mt-2 text-sm">
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>
              <input
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="hidden"
                disabled={isUploading}
                id="file-upload"
                onChange={handleFileChange}
                type="file"
              />
            </label>
          </div>

          {isUploading && (
            <div className="space-y-2">
              <Progress value={processingStatus.progress} />
              <p className="text-muted-foreground text-center text-sm">
                {processingStatus.currentStep || 'Processing...'}
              </p>
            </div>
          )}

          <div className="flex justify-between">
            <Button
              onClick={() => router.push(`/dashboard/patients/${params.id}` as any)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isUploading || !selectedFile || !selectedCategory || !selectedType}
              onClick={handleUpload}
              variant="default"
            >
              Upload & Process
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
} 