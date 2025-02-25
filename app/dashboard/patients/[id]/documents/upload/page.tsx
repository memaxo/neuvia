'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

import { FileUploader } from '@/components/file-uploader';
import { processDocument } from '../../../../../../lib/processing/document-extraction';
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
          <FileUploader
            multiple={false}
            maxFileCount={1}
            accept={{
              'application/pdf': [],
              'application/msword': [],
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [],
              'image/jpeg': [],
              'image/png': []
            }}
            disabled={isUploading}
            onValueChange={(newFiles) => {
              if (newFiles.length > 0) {
                setSelectedFile(newFiles[0]);
              } else {
                setSelectedFile(null);
              }
            }}
          />

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