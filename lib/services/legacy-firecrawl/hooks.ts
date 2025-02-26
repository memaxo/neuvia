/**
 * @deprecated DEPRECATED: This Firecrawl implementation has been replaced with the Perplexity
 * Deep Research API integration. Please use the new implementation in lib/services/research/perplexity-client.ts.
 * 
 * This file is maintained for backward compatibility but will be removed in a future version.
 */

/**
 * Firecrawl Hooks
 * 
 * React hooks for using Firecrawl functionality in components.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import type { 
  SearchResult, 
  ExtractResult, 
  ScrapeResult,
  SearchOptions,
  ExtractOptions,
  ScrapeOptions,
  FirecrawlResponse
} from './types';
import { search, extract, scrape, deepResearch } from './actions';

/**
 * Status of a Firecrawl operation
 */
export type FirecrawlStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * History entry for Firecrawl operations
 */
interface HistoryEntry<T, P> {
  timestamp: Date;
  params: P;
  result: FirecrawlResponse<T>;
}

/**
 * Hook for searching with Firecrawl
 */
export function useFirecrawlSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<FirecrawlStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [queryText, setQueryText] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry<SearchResult[], { query: string, options?: SearchOptions }>[]>([]);
  
  // Track if the component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  const performSearch = useCallback(async (
    query: string, 
    options?: SearchOptions
  ) => {
    if (!query.trim()) {
      setError('Search query cannot be empty');
      return { success: false, error: 'Search query cannot be empty' };
    }
    
    setStatus('loading');
    setError(null);
    setQueryText(query);
    
    try {
      const response = await search(query, options);
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        if (!response.success) {
          setError(response.error || 'Search failed');
          setResults([]);
          setStatus('error');
        } else {
          setResults(response.data || []);
          setStatus('success');
        }
        
        // Add to history
        setHistory(prev => [
          {
            timestamp: new Date(),
            params: { query, options },
            result: response
          },
          ...prev.slice(0, 9) // Keep last 10 entries
        ]);
      }
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during search';
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        setError(errorMessage);
        setResults([]);
        setStatus('error');
      }
      
      return { success: false, error: errorMessage };
    }
  }, []);
  
  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
    setStatus('idle');
    setQueryText('');
  }, []);
  
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);
  
  return {
    results,
    status,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    error,
    query: queryText,
    history,
    performSearch,
    clearResults,
    clearHistory
  };
}

/**
 * Hook for extracting data with Firecrawl
 */
export function useFirecrawlExtract() {
  const [results, setResults] = useState<ExtractResult[]>([]);
  const [status, setStatus] = useState<FirecrawlStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry<ExtractResult[], { urls: string[], prompt: string, options?: Omit<ExtractOptions, 'prompt'> }>[]>([]);
  
  // Track if the component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  const performExtraction = useCallback(async (
    urlsToExtract: string[], 
    promptText: string,
    options?: Omit<ExtractOptions, 'prompt'>
  ) => {
    if (!urlsToExtract.length) {
      setError('No URLs provided for extraction');
      return { success: false, error: 'No URLs provided for extraction' };
    }
    
    if (!promptText.trim()) {
      setError('Extraction prompt cannot be empty');
      return { success: false, error: 'Extraction prompt cannot be empty' };
    }
    
    setStatus('loading');
    setError(null);
    setUrls(urlsToExtract);
    setPrompt(promptText);
    
    try {
      const response = await extract(urlsToExtract, promptText, options);
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        if (!response.success) {
          setError(response.error || 'Extraction failed');
          setResults([]);
          setStatus('error');
        } else {
          setResults(response.data || []);
          setStatus('success');
        }
        
        // Add to history
        setHistory(prev => [
          {
            timestamp: new Date(),
            params: { urls: urlsToExtract, prompt: promptText, options },
            result: response
          },
          ...prev.slice(0, 9) // Keep last 10 entries
        ]);
      }
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during extraction';
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        setError(errorMessage);
        setResults([]);
        setStatus('error');
      }
      
      return { success: false, error: errorMessage };
    }
  }, []);
  
  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
    setStatus('idle');
    setUrls([]);
    setPrompt('');
  }, []);
  
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);
  
  return {
    results,
    status,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    error,
    urls,
    prompt,
    history,
    performExtraction,
    clearResults,
    clearHistory
  };
}

/**
 * Hook for scraping content with Firecrawl
 */
export function useFirecrawlScrape() {
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [status, setStatus] = useState<FirecrawlStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry<ScrapeResult, { url: string, options?: ScrapeOptions }>[]>([]);
  
  // Track if the component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  const performScrape = useCallback(async (
    urlToScrape: string, 
    options?: ScrapeOptions
  ) => {
    if (!urlToScrape.trim()) {
      setError('URL cannot be empty');
      return { success: false, error: 'URL cannot be empty' };
    }
    
    try {
      // Basic URL validation
      new URL(urlToScrape);
    } catch (e) {
      setError('Invalid URL format');
      return { success: false, error: 'Invalid URL format' };
    }
    
    setStatus('loading');
    setError(null);
    setUrl(urlToScrape);
    
    try {
      const response = await scrape(urlToScrape, options);
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        if (!response.success) {
          setError(response.error || 'Scraping failed');
          setResult(null);
          setStatus('error');
        } else {
          setResult(response.data || null);
          setStatus('success');
        }
        
        // Add to history
        setHistory(prev => [
          {
            timestamp: new Date(),
            params: { url: urlToScrape, options },
            result: response
          },
          ...prev.slice(0, 9) // Keep last 10 entries
        ]);
      }
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during scraping';
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        setError(errorMessage);
        setResult(null);
        setStatus('error');
      }
      
      return { success: false, error: errorMessage };
    }
  }, []);
  
  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
    setStatus('idle');
    setUrl('');
  }, []);
  
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);
  
  return {
    result,
    status,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    error,
    url,
    history,
    performScrape,
    clearResult,
    clearHistory
  };
}

/**
 * Hook for performing deep research with Firecrawl
 */
export function useFirecrawlResearch() {
  const [results, setResults] = useState<{
    query: string;
    results: SearchResult[];
    extractions: ExtractResult[];
    summary?: string;
  } | null>(null);
  const [status, setStatus] = useState<FirecrawlStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry<{
    query: string;
    results: SearchResult[];
    extractions: ExtractResult[];
    summary?: string;
  }, { query: string, options?: any }>[]>([]);
  
  // Track if the component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  const performResearch = useCallback(async (
    queryText: string,
    options?: {
      maxResults?: number;
      includeContent?: boolean;
      synthesize?: boolean;
    }
  ) => {
    if (!queryText.trim()) {
      setError('Research query cannot be empty');
      return { success: false, error: 'Research query cannot be empty' };
    }
    
    setStatus('loading');
    setError(null);
    setQuery(queryText);
    
    try {
      const response = await deepResearch(queryText, options);
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        if (!response.success) {
          setError(response.error || 'Research failed');
          setResults(null);
          setStatus('error');
        } else {
          setResults(response.data || null);
          setStatus('success');
        }
        
        // Add to history
        setHistory(prev => [
          {
            timestamp: new Date(),
            params: { query: queryText, options },
            result: response
          },
          ...prev.slice(0, 9) // Keep last 10 entries
        ]);
      }
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during research';
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        setError(errorMessage);
        setResults(null);
        setStatus('error');
      }
      
      return { success: false, error: errorMessage };
    }
  }, []);
  
  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
    setStatus('idle');
    setQuery('');
  }, []);
  
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);
  
  return {
    results,
    status,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    error,
    query,
    history,
    performResearch,
    clearResults,
    clearHistory
  };
} 