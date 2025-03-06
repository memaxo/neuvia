import type { ResearchProvider } from '@/lib/config/research'
import type { ProcessingStatus } from '@/lib/types/base'
import type {
  ResearchDocument,
  ResearchOptions,
  ResearchResult,
} from '@/lib/types/research'
import type { VerifiedDocument } from '@/lib/types/verification'
import { perplexityService } from '@/lib/services/perplexity/perplexity-service'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Status of a research operation
 */
export type ResearchStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * History entry for research operations
 */
interface HistoryEntry {
  timestamp: Date
  query: string
  options?: ResearchOptions
  result: ResearchResult
}

/**
 * Options for the useResearch hook
 */
export interface UseResearchOptions {
  /**
   * Default provider to use
   */
  defaultProvider?: ResearchProvider

  /**
   * Whether to automatically store results in history
   */
  storeHistory?: boolean

  /**
   * Maximum number of history entries to keep
   */
  maxHistoryEntries?: number

  /**
   * Whether to persist history in local storage
   */
  persistHistory?: boolean

  /**
   * Document ID for contextual research
   */
  documentId?: string

  /**
   * Patient ID for contextual research
   */
  patientId?: string
  
  /**
   * Verified document to use as context
   */
  verifiedDocument?: VerifiedDocument | null
}

/**
 * Unified hook for performing research operations
 *
 * @param options Configuration options for the research hook
 * @returns Research hook interface
 */
export function useResearch(options?: UseResearchOptions) {
  // Get options with defaults
  const {
    defaultProvider = 'perplexity',
    storeHistory = true,
    maxHistoryEntries = 10,
    persistHistory = false,
    documentId,
    patientId,
    verifiedDocument = null,
  } = options || {}

  // State for research process
  const [result, setResult] = useState<ResearchResult | null>(null)
  const [researchResults, setResearchResults] = useState<ResearchResult[]>([])
  const [researchDocument, setResearchDocument] = useState<ResearchDocument | null>(null)
  const [status, setStatus] = useState<ResearchStatus>('idle')
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    status: 'pending',
    progress: 0,
    phase: 'analysis',
  })
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState<string>('')
  const [progress, setProgress] = useState<number>(0)
  const [provider, setProvider] = useState<ResearchProvider>(defaultProvider)

  // History of research
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    // Load history from local storage if enabled
    if (persistHistory) {
      try {
        const storedHistory = localStorage.getItem(
          'research-history'
        )
        if (storedHistory) {
          // Parse dates from JSON
          const parsedHistory = JSON.parse(storedHistory)
          return parsedHistory.map((entry: any) => ({
            ...entry,
            timestamp: new Date(entry.timestamp),
          }))
        }
      } catch (e) {
        console.warn('Failed to load research history from local storage:', e)
      }
    }
    return []
  })

  // Track if component is mounted
  const isMounted = useRef(true)
  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  // Perform research
  const performResearch = useCallback(
    async (
      queryText: string,
      researchOptions?: ResearchOptions & { provider?: ResearchProvider }
    ) => {
      if (!queryText.trim()) {
        const errorMsg = 'Research query cannot be empty';
        setError(errorMsg)
        setProcessingStatus({
          status: 'error',
          progress: 0,
          phase: 'analysis',
          error: errorMsg
        })
        return null
      }

      try {
        // Update state
        setStatus('loading')
        setProgress(0)
        setError(null)
        setQuery(queryText)
        setProcessingStatus({
          status: 'processing',
          progress: 0,
          phase: 'analysis',
          currentStep: 'Starting research',
        })

        // Use specified provider or current state
        const selectedProvider = researchOptions?.provider || provider

        // Create progress tracking callback
        const progressCallback = (value: number) => {
          if (isMounted.current) {
            setProgress(value)
            setProcessingStatus({
              status: 'processing',
              progress: value,
              phase: 'analysis',
              currentStep: `Researching (${value}%)`,
            })
          }
        }

        // Create options for research
        const options: ResearchOptions = {
          ...researchOptions,
          onProgress: progressCallback,
        }

        // Add context data if provided
        if (patientId || documentId || verifiedDocument) {
          options.contextData = {
            ...(options.contextData || {}),
            patientId,
            documentId,
            verifiedDocument,
          }
        }

        // Use the consolidated perplexityService
        const researchResult = await perplexityService.performDeepResearch(
          queryText,
          options
        )

        // Only update state if still mounted
        if (isMounted.current) {
          setResult(researchResult)
          setStatus('success')
          setProgress(100)
          setProcessingStatus({
            status: 'success',
            progress: 100,
            phase: 'analysis',
            currentStep: 'Research completed',
          })

          // Update research results list
          setResearchResults((prevResults) => [...prevResults, researchResult])

          // Create research document if we have a verified document
          if (verifiedDocument) {
            const newResearchDocument: ResearchDocument = {
              id: crypto.randomUUID(),
              createdAt: new Date(),
              documentType: verifiedDocument.documentType,
              patientId: verifiedDocument.patientId,
              verifiedDocument,
              researchResults: [...researchResults, researchResult],
              queries: [
                ...researchResults.map(
                  (r) => r.text?.substring(0, 100) || 'Research'
                ),
                queryText,
              ],
            }
            setResearchDocument(newResearchDocument)
          }

          // Add to history if enabled
          if (storeHistory) {
            const newEntry: HistoryEntry = {
              timestamp: new Date(),
              query: queryText,
              options: researchOptions,
              result: researchResult,
            }

            setHistory((prev) => {
              const updated = [
                newEntry,
                ...prev.slice(0, maxHistoryEntries - 1),
              ]

              // Persist to local storage if enabled
              if (persistHistory) {
                try {
                  localStorage.setItem(
                    'research-history',
                    JSON.stringify(updated)
                  )
                } catch (e) {
                  console.warn(
                    'Failed to save research history to local storage:',
                    e
                  )
                }
              }

              return updated
            })
          }
        }

        return researchResult
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error during research'

        // Only update state if still mounted
        if (isMounted.current) {
          setError(errorMessage)
          setStatus('error')
          setProgress(0)
          setProcessingStatus({
            status: 'error',
            progress: 0,
            phase: 'analysis',
            error: errorMessage,
            currentStep: 'Research failed',
          })
        }

        console.error('Error in useResearch:', err)
        return null
      }
    },
    [
      provider,
      storeHistory,
      maxHistoryEntries,
      persistHistory,
      documentId,
      patientId,
      verifiedDocument,
      researchResults
    ]
  )

  // Clear current result
  const clearResult = useCallback(() => {
    setResult(null)
    setStatus('idle')
    setError(null)
    setQuery('')
    setProgress(0)
  }, [])

  // Clear all research results
  const clearResults = useCallback(() => {
    clearResult()
    setResearchResults([])
    setProcessingStatus({
      status: 'pending',
      progress: 0,
      phase: 'analysis',
    })
    setResearchDocument(null)
  }, [clearResult])

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([])

    // Clear from local storage if enabled
    if (persistHistory) {
      try {
        localStorage.removeItem('research-history')
      } catch (e) {
        console.warn('Failed to clear research history from local storage:', e)
      }
    }
  }, [persistHistory])

  // Change provider
  const changeProvider = useCallback((newProvider: ResearchProvider) => {
    setProvider(newProvider)
  }, [])

  // Return hook value with all capabilities
  return {
    // Current result state
    result,
    status,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    error,
    query,
    progress,
    
    // Processing status (compatible with workflow status)
    processingStatus,
    
    // Document-based research state
    researchResults,
    researchDocument,
    
    // Provider control
    provider,
    
    // History
    history,
    
    // Actions
    performResearch,
    clearResult,
    clearResults,
    clearHistory,
    changeProvider,
  }
}

// Export for backward compatibility
export { useResearch as usePerplexityResearch }