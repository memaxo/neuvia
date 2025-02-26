'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Edit, Save, RotateCcw, Clipboard, ClipboardCheck, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';

// Import from verification directory
import { VerificationItemCard } from '@/components/verification/VerificationItemCard';

// Import the new unified hook
import { useVerification } from '@/lib/hooks/verification/useVerification';

// Import types
import type { ExtractedDocument } from '@/lib/processing/types/extraction';
import type { 
  VerificationItem, 
  VerificationStatus, 
  VerifiedDocument 
} from '@/lib/processing/types/verification/index';

/**
 * VerificationPanel Props
 */
export interface VerificationPanelProps {
  /**
   * Document ID to verify
   */
  documentId: string;
  
  /**
   * Workflow ID for the verification process
   */
  workflowId: string;
  
  /**
   * Patient ID (optional if included in document)
   */
  patientId?: string;
  
  /**
   * Department ID (optional)
   */
  departmentId?: string;
  
  /**
   * Is this an embedded component
   */
  isEmbedded?: boolean;
  
  /**
   * If the document data is already available
   */
  extractedDocument?: ExtractedDocument;
  
  /**
   * Callback when verification is complete
   */
  onVerificationComplete?: (verifiedDocument: VerifiedDocument) => void;
  
  /**
   * Callback for cancel action
   */
  onCancel?: () => void;
}

/**
 * Unified verification panel component
 */
export function VerificationPanel({
  documentId,
  workflowId,
  patientId,
  departmentId,
  isEmbedded = false,
  extractedDocument: initialDocument,
  onVerificationComplete,
  onCancel
}: VerificationPanelProps) {
  // Use the verification hook
  const {
    isLoading,
    extractedDocument,
    verificationItems,
    error,
    progress,
    status,
    loadDocument,
    updateItem,
    verifyItem,
    resetItem,
    completeVerification,
    reset
  } = useVerification({
    patientId,
    onProgress: (progress) => {
      console.log('Verification progress:', progress);
    },
    onSuccess: (verifiedDocument) => {
      // Call callback if provided
      onVerificationComplete?.(verifiedDocument);
    },
    onError: (error) => {
      // Show error toast
      toast({
        title: 'Verification Error',
        description: error,
        variant: 'destructive'
      });
    }
  });
  
  // UI state
  const [activeTab, setActiveTab] = useState('all');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  // Load document on mount
  useEffect(() => {
    if (documentId && !initialDocument) {
      loadDocument(documentId, patientId);
    } else if (initialDocument) {
      // If document is provided as prop, generate verification items
      // This would require additional hook logic not shown here
    }
    
    return () => {
      reset();
    };
  }, [documentId, patientId, initialDocument, loadDocument, reset]);
  
  // Filter verification items based on active tab
  const getFilteredItems = () => {
    switch (activeTab) {
      case 'unverified':
        return verificationItems.filter(item => !item.isVerified);
      case 'verified':
        return verificationItems.filter(item => item.isVerified);
      case 'required':
        // Handle 'isRequired' field potentially missing
        return verificationItems.filter(item => 
          'isRequired' in item && (item as VerificationItem).isRequired
        );
      default:
        // Check if we're filtering by category
        if (getCategoryNames().includes(activeTab)) {
          return verificationItems.filter(item => 
            'category' in item && (item as VerificationItem).category === activeTab
          );
        }
        // Default to all items
        return verificationItems;
    }
  };
  
  // Get unique category names
  const getCategoryNames = () => {
    const categories = new Set<string>();
    
    verificationItems.forEach(item => {
      if ('category' in item) {
        categories.add((item as VerificationItem).category);
      }
    });
    
    return Array.from(categories);
  };
  
  // Handle item edit
  const handleItemEdit = (itemId: string, value: string) => {
    updateItem(itemId, { value });
  };
  
  // Handle mark as verified
  const handleVerifyItem = (itemId: string, isVerified: boolean) => {
    verifyItem(itemId, isVerified);
  };
  
  // Handle reset to original value
  const handleItemReset = (itemId: string) => {
    resetItem(itemId);
  };
  
  // Handle copy to clipboard
  const handleCopyVerified = () => {
    const verifiedText = verificationItems
      .filter(item => item.isVerified)
      .map(item => {
        const label = 'label' in item ? (item as VerificationItem).label : item.key;
        return `${label}: ${item.value}`;
      })
      .join('\n');
      
    if (verifiedText) {
      navigator.clipboard.writeText(verifiedText)
        .then(() => {
          toast({
            title: 'Copied to Clipboard',
            description: 'Verified items have been copied to clipboard',
          });
          return true;
        })
        .catch(err => {
          console.error('Failed to copy:', err);
          return false;
        });
    }
  };
  
  // Handle complete verification
  const handleCompleteVerification = async () => {
    try {
      setIsSaving(true);
      
      // Check if all required items are verified
      const requiredItems = verificationItems.filter(item => 
        'isRequired' in item && (item as VerificationItem).isRequired
      );
      
      const unverifiedRequiredItems = requiredItems.filter(item => !item.isVerified);
      
      if (unverifiedRequiredItems.length > 0) {
        const itemLabels = unverifiedRequiredItems
          .map(item => 'label' in item ? (item as VerificationItem).label : item.key)
          .join(', ');
          
        toast({
          title: 'Required Items Not Verified',
          description: `Please verify all required items: ${itemLabels}`,
          variant: 'destructive'
        });
        
        return;
      }
      
      // Complete verification
      await completeVerification(workflowId);
      
      toast({
        title: 'Verification Complete',
        description: 'Document has been successfully verified',
      });
    } catch (error) {
      console.error('Error completing verification:', error);
      
      toast({
        title: 'Verification Failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Calculate verification progress
  const verificationProgress = verificationItems.length > 0
    ? (verificationItems.filter(item => item.isVerified).length / verificationItems.length) * 100
    : 0;
  
  // Calculate required items progress
  const requiredItems = verificationItems.filter(item => 
    'isRequired' in item && (item as VerificationItem).isRequired
  );
  
  const requiredItemsProgress = requiredItems.length > 0
    ? (requiredItems.filter(item => item.isVerified).length / requiredItems.length) * 100
    : 0;
  
  // Loading state
  if (isLoading && status === 'loading') {
    return (
      <Card className="mb-6">
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="text-primary mb-4 size-8 animate-spin" />
            <h3 className="text-lg font-medium">Loading document...</h3>
            <p className="text-muted-foreground">Please wait while we prepare the document for verification</p>
            <Progress className="mt-4 w-1/2" value={progress} />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Error state
  if (error) {
    return (
      <Alert className="mb-6" variant="error">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  
  // Main component
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Document Verification</h2>
          <p className="text-muted-foreground text-sm">
            Verify extracted information before proceeding
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            disabled={verificationItems.filter(item => item.isVerified).length === 0}
            onClick={handleCopyVerified}
            size="sm"
            variant="outline"
          >
            <Clipboard className="mr-2 size-4" />
            Copy Verified
          </Button>
          
          {onCancel && (
            <Button 
              onClick={onCancel}
              variant="outline"
            >
              Cancel
            </Button>
          )}
          
          <Button 
            disabled={isSaving || verificationItems.length === 0}
            onClick={handleCompleteVerification}
            variant="default"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ClipboardCheck className="mr-2 size-4" />
                Complete Verification
              </>
            )}
          </Button>
        </div>
      </div>
      
      {isSaving && (
        <Progress className="mb-4" value={progress} />
      )}
      
      <div className="mb-4 flex items-center gap-4">
        <div className="flex-1">
          <Progress className="h-2" value={verificationProgress} />
        </div>
        <div className="text-sm font-medium">
          {verificationItems.filter(item => item.isVerified).length} of {verificationItems.length} verified ({Math.round(verificationProgress)}%)
        </div>
      </div>
      
      <Tabs className="flex flex-1 flex-col" onValueChange={setActiveTab} value={activeTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Items</TabsTrigger>
          <TabsTrigger value="required">Required</TabsTrigger>
          <TabsTrigger value="verified">Verified</TabsTrigger>
          <TabsTrigger value="unverified">Unverified</TabsTrigger>
          
          {/* Category tabs */}
          {getCategoryNames().map(category => (
            <TabsTrigger key={category} value={category}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <TabsContent className="mt-0 flex flex-1 flex-col" value={activeTab}>
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-1">
              {getFilteredItems().length === 0 ? (
                <div className="text-muted-foreground p-8 text-center">
                  No verification items found
                </div>
              ) : (
                getFilteredItems().map(item => (
                  <VerificationItemCard
                    item={item as VerificationItem}
                    key={item.id}
                    onEdit={handleItemEdit}
                    onReset={handleItemReset}
                    onVerify={handleVerifyItem}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
} 