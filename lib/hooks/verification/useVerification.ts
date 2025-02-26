import { useState, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/clients';
import { documentService } from '@/lib/services/document/document-service';
import { verificationService } from '@/lib/services/verification/verification-service';

// Import types from proper locations
import type { ExtractedDocument } from '@/lib/processing/types/extraction';
import type { 
  VerificationItem, 
  VerificationStatus, 
  VerifiedDocument 
} from '@/lib/processing/types/verification/index';

/**
 * Options for the verification hook
 */
export interface UseVerificationOptions {
  /**
   * Patient ID (optional)
   */
  patientId?: string;

  /**
   * Progress callback
   */
  onProgress?: (progress: number) => void;
  
  /**
   * Success callback
   */
  onSuccess?: (verifiedDocument: VerifiedDocument) => void;
  
  /**
   * Error callback
   */
  onError?: (error: string) => void;
}

/**
 * Verification state
 */
export interface VerificationState {
  /**
   * Loading state
   */
  isLoading: boolean;
  
  /**
   * Verification items
   */
  verificationItems: VerificationItem[];
  
  /**
   * Document being verified
   */
  extractedDocument: ExtractedDocument | null;
  
  /**
   * Error message
   */
  error: string | null;
  
  /**
   * Progress percentage
   */
  progress: number;
  
  /**
   * Verification status
   */
  status: 'idle' | 'loading' | 'verifying' | 'complete' | 'error';

  /**
   * Verified data assembled from verification items
   */
  verifiedData: Record<string, any> | null;
}

/**
 * Unified hook for document verification
 * 
 * @param options Verification options
 * @returns Verification state and actions
 */
export function useVerification(options?: UseVerificationOptions) {
  const supabase = createBrowserClient();
  
  // Main verification state
  const [state, setState] = useState<VerificationState>({
    isLoading: false,
    verificationItems: [],
    extractedDocument: null,
    error: null,
    progress: 0,
    status: 'idle',
    verifiedData: null
  });
  
  /**
   * Load document and generate verification items
   * 
   * @param documentId Document ID to load
   * @param patientId Patient ID (optional)
   */
  const loadDocument = useCallback(async (documentId: string, patientId?: string) => {
    try {
      setState(prev => ({ 
        ...prev, 
        isLoading: true, 
        error: null, 
        status: 'loading',
        progress: 0
      }));
      
      options?.onProgress?.(0);
      
      // Get the patient document
      const { data: document, error } = await supabase
        .from('patient_documents')
        .select('*')
        .eq('id', documentId)
        .single();
      
      if (error || !document) {
        throw new Error(`Document not found: ${error?.message}`);
      }
      
      options?.onProgress?.(25);
      
      // Create extracted document structure
      const extractedDocument: ExtractedDocument = {
        id: document.id,
        patientId: document.patient_id || patientId || options?.patientId,
        documentType: document.document_type || { 
          category: 'clinical', 
          type: 'note' 
        },
        extractedData: {
          rawText: document.content_text || '',
          metadata: {
            extractedAt: new Date(),
            ...document.metadata
          }
        },
        isSuccessful: document.is_processed || true,
        createdAt: new Date(document.created_at)
      };
      
      options?.onProgress?.(50);
      
      // Generate verification items
      const verificationItems = verificationService.generateVerificationItems(extractedDocument);
      
      options?.onProgress?.(100);
      
      // Update state
      setState(prev => ({
        ...prev,
        isLoading: false,
        extractedDocument,
        verificationItems,
        progress: 100,
        status: 'verifying'
      }));
      
      return { extractedDocument, verificationItems };
    } catch (error) {
      console.error('[useVerification] Error loading document:', error);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : String(error),
        status: 'error'
      }));
      
      options?.onError?.(error instanceof Error ? error.message : String(error));
      return null;
    }
  }, [supabase, options]);
  
  /**
   * Update a verification item
   * 
   * @param itemId Item ID to update
   * @param updates Updates to apply
   */
  const updateItem = useCallback((itemId: string, updates: Partial<VerificationItem>) => {
    setState(prev => ({
      ...prev,
      verificationItems: prev.verificationItems.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      )
    }));
  }, []);
  
  /**
   * Mark an item as verified
   * 
   * @param itemId Item ID
   * @param isVerified Verification status
   */
  const verifyItem = useCallback((itemId: string, isVerified: boolean) => {
    updateItem(itemId, { isVerified });
  }, [updateItem]);
  
  /**
   * Reset item to original value
   * 
   * @param itemId Item ID
   */
  const resetItem = useCallback((itemId: string) => {
    setState(prev => {
      const item = prev.verificationItems.find(item => item.id === itemId);
      if (item && 'originalValue' in item) {
        return {
          ...prev,
          verificationItems: prev.verificationItems.map(i => 
            i.id === itemId 
              ? { ...i, value: (i as any).originalValue, isVerified: true } 
              : i
          )
        };
      }
      return prev;
    });
  }, []);
  
  /**
   * Complete verification and save results
   * 
   * @param workflowId Workflow ID
   */
  const completeVerification = useCallback(async (workflowId: string) => {
    try {
      if (!state.extractedDocument) {
        throw new Error('No document loaded for verification');
      }
      
      setState(prev => ({ 
        ...prev, 
        isLoading: true, 
        status: 'verifying',
        progress: 0
      }));
      
      options?.onProgress?.(0);
      
      // Check required fields
      const requiredItems = state.verificationItems.filter(item => 
        'isRequired' in item && (item as any).isRequired
      );
      
      const unverifiedRequiredItems = requiredItems.filter(item => !item.isVerified);
      
      if (unverifiedRequiredItems.length > 0) {
        const itemLabels = unverifiedRequiredItems
          .map(item => ('label' in item ? (item as any).label : item.key))
          .join(', ');
          
        throw new Error(`Required fields not verified: ${itemLabels}`);
      }
      
      options?.onProgress?.(25);
      
      // Create verification status
      const verificationStatus: VerificationStatus = {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: (await supabase.auth.getUser()).data.user?.id
      };
      
      options?.onProgress?.(50);
      
      // Save verification results
      const verifiedDocument = await verificationService.saveVerificationResults(
        workflowId,
        state.verificationItems,
        verificationStatus,
        state.extractedDocument,
        {
          onProgress: progress => {
            setState(prev => ({ ...prev, progress }));
            options?.onProgress?.(progress);
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError
        }
      );
      
      // Assemble verified data
      const verifiedData = verificationService.assembleVerifiedData(state.verificationItems);
      
      // Update state
      setState(prev => ({
        ...prev,
        isLoading: false,
        status: 'complete',
        progress: 100,
        verifiedData
      }));
      
      return { verifiedDocument, verifiedData };
    } catch (error) {
      console.error('[useVerification] Error completing verification:', error);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : String(error),
        status: 'error'
      }));
      
      options?.onError?.(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }, [state.extractedDocument, state.verificationItems, supabase, options]);
  
  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState({
      isLoading: false,
      verificationItems: [],
      extractedDocument: null,
      error: null,
      progress: 0,
      status: 'idle',
      verifiedData: null
    });
  }, []);
  
  return {
    ...state,
    loadDocument,
    updateItem,
    verifyItem,
    resetItem,
    completeVerification,
    reset
  };
} 