/**
 * Perplexity Research Hook
 * 
 * React hook for using Perplexity Deep Research in components.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import type { ResearchResult, ResearchOptions } from '@/lib/processing/types/research';
import type { ResearchProvider } from '@/lib/config/research';
import { perplexityService } from '@/lib/services/perplexity/perplexity-service';

/**
 * Status of a research operation
 */
export type ResearchStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * History entry for research operations
 */
interface HistoryEntry {
  timestamp: Date;
  query: string;
  options?: ResearchOptions;
  result: ResearchResult;
}

/**
 * Options for the usePerplexityResearch hook
 */
export interface UsePerplexityResearchOptions {
  /**
   * Default provider to use
   */
  defaultProvider?: ResearchProvider;
  
  /**
   * Whether to automatically store results in history
   */
  storeHistory?: boolean;
  
  /**
   * Maximum number of history entries to keep
   */
  maxHistoryEntries?: number;
  
  /**
   * Whether to persist history in local storage
   */
  persistHistory?: boolean;
  
  /**
   * Document ID for contextual research
   */
  documentId?: string;
  
  /**
   * Patient ID for contextual research
   */
  patientId?: string;
}

/**
 * Hook for performing research with Perplexity
 */
export function usePerplexityResearch(options?: UsePerplexityResearchOptions) {
  // Get options with defaults
  const {
    defaultProvider = 'perplexity',
    storeHistory = true,
    maxHistoryEntries = 10,
    persistHistory = false,
    documentId,
    patientId
  } = options || {};
  
  // State for research process
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [status, setStatus] = useState<ResearchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [provider, setProvider] = useState<ResearchProvider>(defaultProvider);
  
  // History of research
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    // Load history from local storage if enabled
    if (persistHistory) {
      try {
        const storedHistory = localStorage.getItem('perplexity-research-history');
        if (storedHistory) {
          // Parse dates from JSON
          const parsedHistory = JSON.parse(storedHistory);
          return parsedHistory.map((entry: any) => ({
            ...entry,
            timestamp: new Date(entry.timestamp)
          }));
        }
      } catch (e) {
        console.warn('Failed to load research history from local storage:', e);
      }
    }
    return [];
  });
  
  // Track if component is mounted
  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Perform research
  const performResearch = useCallback(async (
    queryText: string,
    researchOptions?: ResearchOptions & { provider?: ResearchProvider }
  ) => {
    if (!queryText.trim()) {
      setError('Research query cannot be empty');
      return null;
    }
    
    try {
      // Update state
      setStatus('loading');
      setProgress(0);
      setError(null);
      setQuery(queryText);
      
      // Use specified provider or current state
      const selectedProvider = researchOptions?.provider || provider;
      
      // Create progress tracking callback
      const progressCallback = (value: number) => {
        if (isMounted.current) {
          setProgress(value);
        }
      };
      
      // Create options for research
      const options: ResearchOptions = {
        ...researchOptions,
        onProgress: progressCallback
      };
      
      // Add context data if provided
      if (patientId || documentId) {
        options.contextData = {
          ...(options.contextData || {}),
          patientId,
          documentId
        };
      }
      
      // Use the consolidated perplexityService
      const researchResult = await perplexityService.performDeepResearch(
        queryText,
        options
      );
      
      // Only update state if still mounted
      if (isMounted.current) {
        setResult(researchResult);
        setStatus('success');
        setProgress(100);
        
        // Add to history if enabled
        if (storeHistory) {
          const newEntry: HistoryEntry = {
            timestamp: new Date(),
            query: queryText,
            options: researchOptions,
            result: researchResult
          };
          
          setHistory(prev => {
            const updated = [newEntry, ...prev.slice(0, maxHistoryEntries - 1)];
            
            // Persist to local storage if enabled
            if (persistHistory) {
              try {
                localStorage.setItem('perplexity-research-history', JSON.stringify(updated));
              } catch (e) {
                console.warn('Failed to save research history to local storage:', e);
              }
            }
            
            return updated;
          });
        }
      }
      
      return researchResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during research';
      
      // Only update state if still mounted
      if (isMounted.current) {
        setError(errorMessage);
        setStatus('error');
        setProgress(0);
      }
      
      return null;
    }
  }, [provider, storeHistory, maxHistoryEntries, persistHistory, documentId, patientId]);
  
  // Clear current result
  const clearResult = useCallback(() => {
    setResult(null);
    setStatus('idle');
    setError(null);
    setQuery('');
    setProgress(0);
  }, []);
  
  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([]);
    
    // Clear from local storage if enabled
    if (persistHistory) {
      try {
        localStorage.removeItem('perplexity-research-history');
      } catch (e) {
        console.warn('Failed to clear research history from local storage:', e);
      }
    }
  }, [persistHistory]);
  
  // Change provider
  const changeProvider = useCallback((newProvider: ResearchProvider) => {
    setProvider(newProvider);
  }, []);
  
  // Return hook value
  return {
    result,
    status,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    error,
    query,
    progress,
    provider,
    history,
    performResearch,
    clearResult,
    clearHistory,
    changeProvider
  };
} 