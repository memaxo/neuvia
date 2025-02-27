import { useState, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/clients';
import { verificationService } from '@/lib/services/verification/verification-service';
import type { ExtractedDocument } from '@/lib/processing/types/extraction';
import type {
  VerificationItem,
  VerificationStatus,
  VerifiedDocument
} from '@/lib/processing/types/verification';

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
   * Whether the hook is loading (document or saving results)
   */
  isLoading: boolean;

  /**
   * Current verification items
   */
  verificationItems: VerificationItem[];

  /**
   * The extracted document being verified
   */
  extractedDocument: ExtractedDocument | null;

  /**
   * Any error message
   */
  error: string | null;

  /**
   * Overall progress (0-100)
   */
  progress: number;

  /**
   * Current hook status
   */
  status: 'idle' | 'loading' | 'verifying' | 'complete' | 'error';

  /**
   * Verified data assembled from verification items
   */
  verifiedData: Record<string, any> | null;

  /**
   * Fully verified document, once complete
   */
  verifiedDocument?: VerifiedDocument | null;
}

/**
 * React hook for verification flow
 * 
 * @deprecated This hook is based on document verification which is being phased out.
 * Future implementations should use PatientSummaryService.verifySummary() for summary-based verification.
 */
export function useVerification(options?: UseVerificationOptions) {
  const supabase = createBrowserClient();

  const [state, setState] = useState<VerificationState>({
    isLoading: false,
    verificationItems: [],
    extractedDocument: null,
    error: null,
    progress: 0,
    status: 'idle',
    verifiedData: null,
    verifiedDocument: null
  });

  /**
   * Load a document and generate verification items
   * 
   * @deprecated This method relies on document verification which is being phased out.
   * Future implementations should use PatientSummaryService for summary-based verification.
   */
  const loadDocument = useCallback(
    async (documentId: string) => {
      try {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
          status: 'loading',
          progress: 0,
          verifiedDocument: null
        }));

        options?.onProgress?.(0);

        // Fetch from patient_documents
        const { data: doc, error } = await supabase
          .from('patient_documents')
          .select('*')
          .eq('id', documentId)
          .single();

        if (error || !doc) {
          throw new Error(`Document not found: ${error?.message}`);
        }

        // Build extracted document
        const extractedDocument: ExtractedDocument = {
          id: doc.id,
          patientId: doc.patient_id || options?.patientId,
          documentType: doc.document_type || { category: 'clinical', type: 'note' },
          extractedData: {
            rawText: doc.content_text || '',
            metadata: {
              extractedAt: new Date(),
              ...doc.metadata
            }
          },
          isSuccessful: doc.is_processed || false,
          createdAt: doc.created_at ? new Date(doc.created_at) : new Date(),
          errorMessage: doc.processing_error
        };

        setState((prev) => ({
          ...prev,
          progress: 25
        }));
        options?.onProgress?.(25);

        // Generate verification items
        const verificationItems = verificationService.generateVerificationItems(extractedDocument);

        setState((prev) => ({
          ...prev,
          isLoading: false,
          extractedDocument,
          verificationItems,
          progress: 100,
          status: 'verifying'
        }));
        options?.onProgress?.(100);

        return { extractedDocument, verificationItems };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
          status: 'error'
        }));
        options?.onError?.(message);
        return null;
      }
    },
    [supabase, options]
  );

  /**
   * Update a specific verification item
   */
  const updateItem = useCallback((itemId: string, updates: Partial<VerificationItem>) => {
    setState((prev) => ({
      ...prev,
      verificationItems: prev.verificationItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    }));
  }, []);

  /**
   * Mark an item as verified or unverified
   */
  const verifyItem = useCallback((itemId: string, isVerified: boolean) => {
    updateItem(itemId, { isVerified });
  }, [updateItem]);

  /**
   * Reset item to original value, marking it verified
   */
  const resetItem = useCallback((itemId: string) => {
    setState((prev) => {
      const item = prev.verificationItems.find((i) => i.id === itemId);
      if (item && 'originalValue' in item) {
        return {
          ...prev,
          verificationItems: prev.verificationItems.map((i) =>
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
   * Verify all items at once
   */
  const verifyAllItems = useCallback(() => {
    setState((prev) => ({
      ...prev,
      verificationItems: prev.verificationItems.map((item) => ({
        ...item,
        isVerified: true
      }))
    }));
  }, []);

  /**
   * Complete verification, save results to DB
   * @param workflowId The associated workflow ID, if any
   * 
   * @deprecated This method relies on document verification which is being phased out.
   * Future implementations should use PatientSummaryService.verifySummary() for summary-based verification.
   */
  const completeVerification = useCallback(
    async (workflowId?: string) => {
      if (!state.extractedDocument) {
        const message = 'No document loaded for verification';
        setState((prev) => ({ ...prev, error: message }));
        options?.onError?.(message);
        return null;
      }

      try {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          status: 'verifying',
          progress: 0
        }));
        options?.onProgress?.(0);

        // Check for required items
        const requiredItems = state.verificationItems.filter((item) => item.isRequired);
        const unverified = requiredItems.filter((item) => !item.isVerified);
        if (unverified.length > 0) {
          const labels = unverified.map((u) => u.label || u.key).join(', ');
          throw new Error(`Required fields not verified: ${labels}`);
        }

        options?.onProgress?.(25);

        // Build verification status
        const userResp = await supabase.auth.getUser();
        const verificationStatus: VerificationStatus = {
          isVerified: true,
          verifiedAt: new Date().toISOString(),
          verifiedBy: userResp.data.user?.id
        };

        // Save verification results
        const verifiedDocument = await verificationService.saveVerificationResults(
          workflowId || '',
          state.verificationItems,
          verificationStatus,
          state.extractedDocument,
          {
            onProgress: (progress) => {
              setState((prev) => ({ ...prev, progress }));
              options?.onProgress?.(progress);
            },
            onSuccess: options?.onSuccess,
            onError: options?.onError
          }
        );

        // Assemble verified data
        const verifiedData = verificationService.assembleVerifiedData(state.verificationItems);

        setState((prev) => ({
          ...prev,
          isLoading: false,
          status: 'complete',
          progress: 100,
          verifiedData,
          verifiedDocument
        }));
        options?.onProgress?.(100);

        return { verifiedDocument, verifiedData };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
          status: 'error'
        }));
        options?.onError?.(message);
        throw err;
      }
    },
    [state.extractedDocument, state.verificationItems, supabase, options]
  );

  /**
   * Reset the entire verification state
   */
  const reset = useCallback(() => {
    setState({
      isLoading: false,
      verificationItems: [],
      extractedDocument: null,
      error: null,
      progress: 0,
      status: 'idle',
      verifiedData: null,
      verifiedDocument: null
    });
  }, []);

  return {
    ...state,
    loadDocument,
    updateItem,
    verifyItem,
    verifyAllItems,
    resetItem,
    completeVerification,
    reset
  };
}