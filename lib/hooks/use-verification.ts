import { useState, useEffect, useCallback, useMemo } from 'react';
import { DocumentProcessingService } from '@/lib/processing/document-processing-service';
import type { 
  ExtractedDocument, 
  VerificationItem, 
  VerificationStatus,
  VerifiedDocument
} from '@/lib/processing/types';

/**
 * Hook for document verification operations
 */
export function useVerification(extractedDocument: ExtractedDocument | null) {
  // State for verification items
  const [verificationItems, setVerificationItems] = useState<VerificationItem[]>([]);
  
  // State for verified data
  const [verifiedData, setVerifiedData] = useState<Record<string, any> | null>(null);
  
  // State for overall verification status
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>({
    isVerified: false,
    verifiedAt: new Date()
  });
  
  // State for the verified document
  const [verifiedDocument, setVerifiedDocument] = useState<VerifiedDocument | null>(null);
  
  // Create the processing service
  const processingService = useMemo(() => new DocumentProcessingService(), []);
  
  // Generate verification items when extractedDocument changes
  useEffect(() => {
    if (extractedDocument) {
      const items = processingService.generateVerificationItems(extractedDocument);
      setVerificationItems(items);
      // Reset verification status and data
      setVerifiedData(null);
      setVerificationStatus({
        isVerified: false,
        verifiedAt: new Date()
      });
      setVerifiedDocument(null);
    } else {
      // Reset state if there's no document
      setVerificationItems([]);
      setVerifiedData(null);
      setVerificationStatus({
        isVerified: false,
        verifiedAt: new Date()
      });
      setVerifiedDocument(null);
    }
  }, [extractedDocument, processingService]);
  
  /**
   * Update a verification item's state
   */
  const updateVerificationItem = useCallback((
    itemId: string, 
    updates: Partial<VerificationItem>
  ) => {
    setVerificationItems(currentItems => 
      currentItems.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      )
    );
  }, []);
  
  /**
   * Mark an item as verified
   */
  const verifyItem = useCallback((
    itemId: string, 
    isVerified: boolean = true,
    corrections?: Record<string, any>
  ) => {
    updateVerificationItem(itemId, { 
      isVerified,
      corrections: corrections || undefined
    });
  }, [updateVerificationItem]);
  
  /**
   * Verify all items at once
   */
  const verifyAllItems = useCallback((isVerified: boolean = true) => {
    setVerificationItems(currentItems =>
      currentItems.map(item => ({ ...item, isVerified }))
    );
  }, []);
  
  /**
   * Complete the verification process
   */
  const completeVerification = useCallback(() => {
    if (!extractedDocument) return null;
    
    // Check if all items are verified
    const allVerified = verificationItems.every(item => item.isVerified);
    
    // Update verification status
    const newStatus: VerificationStatus = {
      isVerified: allVerified,
      verifiedAt: new Date(),
      corrections: {}
    };
    
    setVerificationStatus(newStatus);
    
    // Assemble verified data
    const newVerifiedData = processingService.assembleVerifiedData(verificationItems);
    setVerifiedData(newVerifiedData);
    
    // Create verified document
    const newVerifiedDocument = processingService.createVerifiedDocument(
      extractedDocument,
      verificationItems,
      newStatus
    );
    
    setVerifiedDocument(newVerifiedDocument);
    
    return newVerifiedDocument;
  }, [extractedDocument, verificationItems, processingService]);
  
  /**
   * Reset the verification state
   */
  const reset = useCallback(() => {
    setVerificationItems([]);
    setVerifiedData(null);
    setVerificationStatus({
      isVerified: false,
      verifiedAt: new Date()
    });
    setVerifiedDocument(null);
  }, []);
  
  return {
    verificationItems,
    verifiedData,
    verificationStatus,
    verifiedDocument,
    updateVerificationItem,
    verifyItem,
    verifyAllItems,
    completeVerification,
    reset,
    // Expose the service for direct access
    processingService
  };
} 