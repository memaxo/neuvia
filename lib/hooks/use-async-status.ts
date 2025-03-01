import type { ProcessingStatus } from '@/lib/processing/types/base'
import type { ProcessingPhase } from '@/lib/workflow/types'
import { useCallback, useState } from 'react'

// If ProcessingPhase is not defined properly in base, a minimal type definition could be used (adjust as needed):
// export type ProcessingPhase = 'initialization' | 'processing' | 'success' | 'error' | string;

export function useAsyncStatus(initialPhase?: ProcessingPhase) {
  const [status, setStatus] = useState<ProcessingStatus>({
    status: 'pending',
    progress: 0,
    phase: initialPhase ?? 'initialization',
  })

  const setProcessing = useCallback(
    (phase?: ProcessingPhase, currentStep?: string) => {
      setStatus({
        status: 'processing',
        progress: 0,
        phase: phase ?? 'extraction',
        ...(currentStep !== undefined && currentStep !== ''
          ? { currentStep }
          : {}),
      })
    },
    []
  )

  const updateProgress = useCallback(
    (progress: number, phase?: ProcessingPhase, currentStep?: string) => {
      setStatus((prev: ProcessingStatus) => ({
        ...prev,
        progress,
        phase: phase ?? prev.phase,
        ...(currentStep !== undefined && currentStep !== ''
          ? { currentStep }
          : {}),
      }))
    },
    []
  )

  const setSuccess = useCallback((currentStep?: string) => {
    setStatus((prev: ProcessingStatus) => ({
      ...prev,
      status: 'success',
      progress: 100,
      ...(currentStep !== undefined && currentStep !== ''
        ? { currentStep }
        : {}),
    }))
  }, [])

  const setError = useCallback((errorMessage: string, currentStep?: string) => {
    setStatus({
      status: 'error',
      progress: 0,
      phase: 'error',
      error: errorMessage,
      ...(currentStep !== undefined && currentStep !== ''
        ? { currentStep }
        : {}),
    })
  }, [])

  const resetStatus = useCallback(() => {
    setStatus({
      status: 'pending',
      progress: 0,
      phase: initialPhase ?? 'initialization',
    })
  }, [initialPhase])

  return {
    status,
    setProcessing,
    updateProgress,
    setSuccess,
    setError,
    resetStatus,
    setStatus,
  }
}
