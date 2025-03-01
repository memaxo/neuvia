import type { ProcessingStatus } from '@/lib/processing/types/base'
import type {
  ResearchDocument,
  ResearchOptions,
  ResearchResult,
} from '@/lib/processing/types/research'
import type { VerifiedDocument } from '@/lib/processing/types/verification'
import { perplexityService } from '@/lib/services/perplexity/perplexity-service'
import { useCallback, useMemo, useState } from 'react'

/**
 * Hook for deep research operations
 */
export function useResearch(verifiedDocument: VerifiedDocument | null) {
  // State for research results
  const [researchResults, setResearchResults] = useState<ResearchResult[]>([])

  // State for research status
  const [status, setStatus] = useState<ProcessingStatus>({
    status: 'pending',
    progress: 0,
    phase: 'analysis',
  })

  // State for research document
  const [researchDocument, setResearchDocument] =
    useState<ResearchDocument | null>(null)

  /**
   * Perform deep research
   */
  const performResearch = useCallback(
    async (query: string, options?: Omit<ResearchOptions, 'onProgress'>) => {
      if (!verifiedDocument) {
        setStatus({
          status: 'error',
          progress: 0,
          phase: 'analysis',
          error: 'No verified document available',
        })
        return null
      }

      try {
        // Update status
        setStatus({
          status: 'processing',
          progress: 0,
          phase: 'analysis',
          currentStep: 'Starting research',
        })

        // Perform the research
        const result = await perplexityService.performDeepResearch(query, {
          ...options,
          contextData: {
            verifiedDocument,
            patientId: verifiedDocument.patientId,
          },
          onProgress: (progress: number) => {
            setStatus({
              status: 'processing',
              progress,
              phase: 'analysis',
              currentStep: `Researching (${progress}%)`,
            })
          },
        })

        // Update state with results
        setResearchResults((prevResults) => [...prevResults, result])

        // Create research document
        const newResearchDocument: ResearchDocument = {
          id: crypto.randomUUID(),
          createdAt: new Date(),
          documentType: verifiedDocument.documentType,
          patientId: verifiedDocument.patientId,
          verifiedDocument,
          researchResults: [...researchResults, result],
          queries: [
            ...researchResults.map(
              (r) => r.text?.substring(0, 100) || 'Research'
            ),
            query,
          ],
        }

        setResearchDocument(newResearchDocument)

        // Update status
        setStatus({
          status: 'success',
          progress: 100,
          phase: 'analysis',
          currentStep: 'Research completed',
        })

        return result
      } catch (error) {
        // Handle errors
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        setStatus({
          status: 'error',
          progress: 0,
          phase: 'analysis',
          error: errorMessage,
          currentStep: 'Research failed',
        })

        console.error('Error in useResearch:', error)
        return null
      }
    },
    [verifiedDocument, researchResults]
  )

  /**
   * Clear research results
   */
  const clearResults = useCallback(() => {
    setResearchResults([])
    setStatus({
      status: 'pending',
      progress: 0,
      phase: 'analysis',
    })
    setResearchDocument(null)
  }, [])

  return {
    researchResults,
    status,
    researchDocument,
    performResearch,
    clearResults,
  }
}
