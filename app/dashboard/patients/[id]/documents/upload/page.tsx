'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { CalendarIcon, Info, Tag, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { FileUploader } from '@/components/file-uploader';
import { processDocument } from '../../../../../../lib/processing/document-extraction';

// Type definitions - since the imported types may not be available
type DocumentCategory = 'clinical' | 'lab' | 'imaging' | 'prescription' | 'administrative';
type ProcessingStatus = {
  status: string;
  progress: number;
  currentStep?: string;
};
type DocumentType = {
  category: DocumentCategory;
  type: string;
};

// Enhanced document categories with icons and descriptions
const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    value: 'clinical', 
    label: 'Clinical Records', 
    icon: <FileText className="mr-2 size-4 text-blue-500" />,
    description: 'Doctor notes, medical assessments, and treatment plans'
  },
  { 
    value: 'lab', 
    label: 'Laboratory Results', 
    icon: <FileText className="mr-2 size-4 text-green-500" />,
    description: 'Blood work, pathology, and other diagnostic test results'
  },
  { 
    value: 'imaging', 
    label: 'Imaging Reports', 
    icon: <FileText className="mr-2 size-4 text-purple-500" />,
    description: 'X-rays, MRIs, CT scans, and other imaging results'
  },
  { 
    value: 'prescription', 
    label: 'Prescriptions', 
    icon: <FileText className="mr-2 size-4 text-orange-500" />,
    description: 'Medication orders and treatment prescriptions'
  },
  { 
    value: 'administrative', 
    label: 'Administrative', 
    icon: <FileText className="mr-2 size-4 text-gray-500" />,
    description: 'Insurance, consent forms, and other administrative documents'
  },
];

// Expanded document types with more detailed categorization
const DOCUMENT_TYPES: Record<DocumentCategory, { value: string; label: string; description?: string }[]> = {
  clinical: [
    { value: 'progress_note', label: 'Progress Note', description: 'Notes from regular check-ups and treatments' },
    { value: 'consultation', label: 'Consultation', description: 'Specialist evaluations and recommendations' },
    { value: 'discharge_summary', label: 'Discharge Summary', description: 'Summary of hospital stay and aftercare instructions' },
    { value: 'medical_history', label: 'Medical History', description: 'Past medical events and conditions' },
    { value: 'physical_exam', label: 'Physical Examination', description: 'Results from physical check-ups' },
    { value: 'treatment_plan', label: 'Treatment Plan', description: 'Outlined course of medical treatment' },
  ],
  lab: [
    { value: 'blood_work', label: 'Blood Work', description: 'Complete blood count, metabolic panels, etc.' },
    { value: 'urinalysis', label: 'Urinalysis', description: 'Urine sample analysis results' },
    { value: 'pathology', label: 'Pathology Report', description: 'Tissue sample analysis results' },
    { value: 'microbiology', label: 'Microbiology', description: 'Bacteria, virus, or fungus test results' },
    { value: 'genetic_test', label: 'Genetic Test', description: 'DNA and genetic testing results' },
    { value: 'toxicology', label: 'Toxicology', description: 'Drug screening and poison testing' },
  ],
  imaging: [
    { value: 'xray', label: 'X-Ray Report', description: 'Bone and chest imaging' },
    { value: 'mri', label: 'MRI Report', description: 'Magnetic resonance imaging results' },
    { value: 'ct_scan', label: 'CT Scan Report', description: 'Computed tomography scan results' },
    { value: 'ultrasound', label: 'Ultrasound', description: 'Sonographic imaging results' },
    { value: 'mammogram', label: 'Mammogram', description: 'Breast imaging results' },
    { value: 'pet_scan', label: 'PET Scan', description: 'Positron emission tomography results' },
    { value: 'dexa_scan', label: 'DEXA Scan', description: 'Bone density testing results' },
  ],
  prescription: [
    { value: 'medication', label: 'Medication', description: 'Prescribed drug orders' },
    { value: 'treatment', label: 'Treatment Plan', description: 'Non-medication treatment instructions' },
    { value: 'vaccine', label: 'Vaccination', description: 'Immunization records' },
    { value: 'dme', label: 'DME Prescription', description: 'Durable Medical Equipment prescription' },
    { value: 'therapy', label: 'Therapy Prescription', description: 'Physical, occupational, or other therapy orders' },
  ],
  administrative: [
    { value: 'insurance', label: 'Insurance', description: 'Coverage information and claims' },
    { value: 'consent', label: 'Consent Forms', description: 'Signed treatment authorization forms' },
    { value: 'referral', label: 'Referral', description: 'Specialist referral documents' },
    { value: 'identification', label: 'Identification', description: 'ID documents and verifications' },
    { value: 'billing', label: 'Billing', description: 'Medical bills and payment records' },
    { value: 'release', label: 'Records Release', description: 'Authorization to share medical information' },
  ],
};

// Document confidentiality levels
const CONFIDENTIALITY_LEVELS = [
  { value: 'standard', label: 'Standard' },
  { value: 'sensitive', label: 'Sensitive' },
  { value: 'highly_restricted', label: 'Highly Restricted' },
];

export default function DocumentUploadPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const { toast } = useToast();
  
  // Basic upload state
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('clinical');
  const [selectedType, setSelectedType] = useState<string>('');
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    status: 'processing',
    progress: 0
  });

  // Additional metadata
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentDate, setDocumentDate] = useState<Date | undefined>(new Date());
  const [documentNotes, setDocumentNotes] = useState('');
  const [confidentialityLevel, setConfidentialityLevel] = useState('standard');
  const [isUrgent, setIsUrgent] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [uploadMode, setUploadMode] = useState<'basic' | 'advanced'>('basic');
  
  // Auto-detection state
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<{
    suggestedCategory?: DocumentCategory;
    suggestedType?: string;
    confidence: number;
  } | null>(null);

  // Set document title based on file name when a file is selected
  useEffect(() => {
    if (selectedFile) {
      // Remove file extension and replace underscores/hyphens with spaces
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      
      // Title case the name (capitalize first letter of each word)
      const titleCased = nameWithoutExt.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
      });
      
      setDocumentTitle(titleCased);
      
      // Simulate document type detection (would be replaced with actual AI detection)
      simulateDocumentTypeDetection(selectedFile);
    }
  }, [selectedFile]);

  // This would be replaced with actual AI-based detection
  const simulateDocumentTypeDetection = async (file: File) => {
    setIsDetecting(true);
    
    // In a real implementation, this would call an AI service to analyze the document
    // For simulation purposes, we'll just wait and return a random category/type
    setTimeout(() => {
      const categories = Object.keys(DOCUMENT_TYPES) as DocumentCategory[];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      const types = DOCUMENT_TYPES[randomCategory];
      const randomType = types[Math.floor(Math.random() * types.length)].value;
      
      setDetectionResult({
        suggestedCategory: randomCategory,
        suggestedType: randomType,
        confidence: Math.round(Math.random() * 35 + 65) // Random confidence between 65-100%
      });
      
      setIsDetecting(false);
    }, 2000);
  };

  const applySuggestion = () => {
    if (detectionResult) {
      if (detectionResult.suggestedCategory) {
        setSelectedCategory(detectionResult.suggestedCategory);
      }
      if (detectionResult.suggestedType) {
        setSelectedType(detectionResult.suggestedType);
      }
    }
  };

  const addTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
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

      // Additional metadata to add to the document
      const metadata = {
        title: documentTitle || selectedFile.name,
        document_date: documentDate ? format(documentDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        notes: documentNotes,
        confidentiality: confidentialityLevel,
        is_urgent: isUrgent,
        tags: tags.length > 0 ? JSON.stringify(tags) : null
      };

      // Initiate extraction using the same shared ingestion logic
      toast({
        title: 'Extraction In Progress',
        description: 'Please wait while we process the file. This may take a few minutes.',
      });

      // Call processDocument with the required parameters
      // Check if the function accepts metadata as a parameter
      try {
        await processDocument(
          selectedFile,
          params.id as string,
          documentType,
          (status: ProcessingStatus) => {
            setProcessingStatus(status);
          }
        );
      } catch (processingError) {
        console.error('Error in document processing:', processingError);
        throw processingError;
      }

      // Once the extraction is triggered, navigate to an extraction loading screen
      router.push(`/dashboard/patients/${params.id}/documents/extraction-loading`);

    } catch (error) {
      console.error('Error processing document:', error);
      toast({
        title: 'Document Processing Error',
        description: 'Something went wrong during extraction. Please try again or contact support.',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      {from === 'patientCreate' && (
        <Alert>
          <CheckCircle className="size-4" />
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>
            Patient record created successfully. Now you can add documents.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Upload Patient Documents</h1>
        <p className="text-muted-foreground">
          Upload medical records, test results, or any other relevant documents. 
          The AI will analyze them and extract key information.
        </p>
      </div>

      <Tabs defaultValue="basic" onValueChange={(value) => setUploadMode(value as 'basic' | 'advanced')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic">Basic Upload</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Options</TabsTrigger>
        </TabsList>
        
        <TabsContent className="mt-6" value="basic">
          <Card>
            <CardHeader>
              <CardTitle>Upload Document</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Upload */}
              <div className="space-y-4">
                <Label htmlFor="file">Select File</Label>
                <FileUploader
                  accept={{
                    'application/pdf': [],
                    'application/msword': [],
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [],
                    'image/jpeg': [],
                    'image/png': []
                  }}
                  disabled={isUploading}
                  maxFileCount={1}
                  multiple={false}
                  onValueChange={(newFiles) => {
                    if (newFiles.length > 0) {
                      setSelectedFile(newFiles[0]);
                    } else {
                      setSelectedFile(null);
                    }
                  }}
                />
              </div>
              
              {selectedFile && detectionResult && (
                <Alert>
                  <Info className="size-4" />
                  <AlertTitle>AI Suggestion</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>The AI suggests this might be: <span className="font-medium">{DOCUMENT_CATEGORIES.find(c => c.value === detectionResult.suggestedCategory)?.label} - {DOCUMENT_TYPES[detectionResult.suggestedCategory || 'clinical'].find(t => t.value === detectionResult.suggestedType)?.label}</span></p>
                    <p className="text-muted-foreground text-sm">Confidence: {detectionResult.confidence}%</p>
                    <Button onClick={applySuggestion} size="sm" variant="outline">
                      Apply Suggestion
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Document Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Document Title</Label>
                  <Input 
                    id="title" 
                    onChange={(e) => setDocumentTitle(e.target.value)} 
                    placeholder="Enter document title" 
                    value={documentTitle}
                  />
                </div>
                
                {/* Document Date */}
                <div className="space-y-2">
                  <Label>Document Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !documentDate && "text-muted-foreground"
                        )}
                        variant="outline"
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {documentDate ? format(documentDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        initialFocus
                        mode="single"
                        onSelect={setDocumentDate}
                        selected={documentDate}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Document Category Selection */}
                <div className="space-y-2">
                  <Label htmlFor="category">Document Category</Label>
                  <Select
                    onValueChange={(value: DocumentCategory) => {
                      setSelectedCategory(value);
                      setSelectedType('');
                    }}
                    value={selectedCategory}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          <div className="flex items-center">
                            {category.icon}
                            {category.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    {DOCUMENT_CATEGORIES.find(c => c.value === selectedCategory)?.description}
                  </p>
                </div>

                {/* Document Type Selection */}
                <div className="space-y-2">
                  <Label htmlFor="type">Document Type</Label>
                  <Select
                    onValueChange={setSelectedType}
                    value={selectedType}
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
                  <p className="text-muted-foreground text-xs">
                    {DOCUMENT_TYPES[selectedCategory].find(t => t.value === selectedType)?.description}
                  </p>
                </div>
              </div>
              
              {isUploading && (
                <div className="space-y-2">
                  <Progress value={processingStatus.progress} />
                  <p className="text-muted-foreground text-center text-sm">
                    {processingStatus.currentStep || 'Processing...'}
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
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
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent className="mt-6" value="advanced">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Document Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Notes section */}
              <div className="space-y-2">
                <Label htmlFor="notes">Document Notes</Label>
                <Textarea
                  className="min-h-[100px]"
                  id="notes"
                  onChange={(e) => setDocumentNotes(e.target.value)}
                  placeholder="Add any additional notes about this document"
                  value={documentNotes}
                />
              </div>
              
              <Separator />
              
              {/* Tags */}
              <div className="space-y-3">
                <Label>Document Tags</Label>
                <div className="flex space-x-2">
                  <Input
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Add a tag"
                    value={currentTag}
                  />
                  <Button 
                    disabled={!currentTag.trim()} 
                    onClick={addTag}
                    type="button"
                    variant="outline"
                  >
                    <Tag className="mr-2 size-4" />
                    Add
                  </Button>
                </div>
                
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {tags.map((tag, index) => (
                      <div className="bg-secondary flex items-center rounded-full px-3 py-1 text-sm" key={index}>
                        {tag}
                        <button
                          className="hover:bg-muted ml-2 rounded-full"
                          onClick={() => removeTag(tag)}
                          type="button"
                        >
                          <span className="sr-only">Remove tag</span>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Confidentiality Level */}
                <div className="space-y-3">
                  <Label>Confidentiality Level</Label>
                  <RadioGroup 
                    className="flex flex-col space-y-1" 
                    onValueChange={setConfidentialityLevel}
                    value={confidentialityLevel}
                  >
                    {CONFIDENTIALITY_LEVELS.map((level) => (
                      <div className="flex items-center space-x-2" key={level.value}>
                        <RadioGroupItem id={`level-${level.value}`} value={level.value} />
                        <Label className="cursor-pointer" htmlFor={`level-${level.value}`}>
                          {level.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                
                {/* Urgent flag */}
                <div className="space-y-3">
                  <Label>Priority</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={isUrgent}
                      id="urgent"
                      onCheckedChange={(checked) => {
                        setIsUrgent(checked === true);
                      }}
                    />
                    <Label
                      className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      htmlFor="urgent"
                    >
                      Mark as urgent document
                    </Label>
                  </div>
                  
                  {isUrgent && (
                    <Alert>
                      <AlertCircle className="size-4" />
                      <AlertTitle>Urgent Document</AlertTitle>
                      <AlertDescription>
                        This document will be marked as urgent for immediate attention.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 