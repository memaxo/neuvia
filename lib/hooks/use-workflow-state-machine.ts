import type { ProcessingStatus } from '@/lib/processing/types/base'
import type { ProcessingPhase, WorkflowStep } from '@/lib/workflow/types'
import { useCallback, useRef, useState } from 'react'

// Define workflow transitions
type WorkflowTransition = {
  to: WorkflowStep
  condition?: (state: WorkflowMachineState) => boolean
}

// Define the state machine configuration
type WorkflowStateConfig = {
  [key in WorkflowStep]?: {
    transitions: Record<string, WorkflowTransition>
    onEnter?: (state: WorkflowMachineState) => void
    onExit?: (state: WorkflowMachineState) => void
  }
}

// State machine state
export interface WorkflowMachineState {
  currentStep: WorkflowStep
  previousStep?: WorkflowStep
  status: ProcessingStatus
  data: Record<string, any>
  error?: string
  history: WorkflowStep[]
}

/**
 * Configuration options for the workflow state machine
 */
export interface WorkflowStateMachineOptions {
  initialStep?: WorkflowStep
  maxHistoryEntries?: number
  onStateChange?: (state: WorkflowMachineState) => void
  stateConfig?: WorkflowStateConfig
}

/**
 * Default status updates for each workflow step
 * This ensures consistent status handling across the application
 */
const DEFINED_STATUS_DEFAULTS: Record<string, ProcessingStatus> = {
  idle: { status: 'idle', progress: 0, phase: 'initialization' },
  uploading: { status: 'processing', progress: 10, phase: 'uploading' },
  extracting: { status: 'processing', progress: 30, phase: 'extraction' },
  verification: { status: 'processing', progress: 70, phase: 'verification' },
  report_generation: {
    status: 'processing',
    progress: 85,
    phase: 'report_generation',
  },
  complete: { status: 'success', progress: 100, phase: 'completion' },
  error: { status: 'error', progress: 0, phase: 'error' },
}

/**
 * Get default status for any workflow step
 */
const getDefaultStatus = (step: WorkflowStep): ProcessingStatus => {
  // Return predefined status if available
  if (step in DEFINED_STATUS_DEFAULTS) {
    return DEFINED_STATUS_DEFAULTS[step]
  }

  // Generate sensible defaults for any other step
  if (step.includes('error')) {
    return { status: 'error', progress: 0, phase: 'error' }
  }

  if (step.includes('complete')) {
    return { status: 'success', progress: 100, phase: 'completion' }
  }

  // Default processing status
  return {
    status: 'processing',
    progress: 50,
    // Map step to a valid phase or default to initialization
    phase: getPhaseForStep(step),
  }
}

/**
 * Map workflow step to a valid processing phase
 */
const getPhaseForStep = (step: WorkflowStep): ProcessingPhase => {
  // Map common steps to valid phases
  if (step.includes('upload')) return 'uploading'
  if (step.includes('extract')) return 'extraction'
  if (step.includes('verif')) return 'verification'
  if (step.includes('research')) return 'research'
  if (step.includes('report')) return 'report_generation'

  // Default to initialization for unknown steps
  return 'initialization'
}

/**
 * Hook that implements a workflow state machine
 *
 * This provides a more structured approach to handling workflow state transitions,
 * ensuring valid state transitions, tracking history, and providing utility methods
 * to manage workflow processing.
 */
export function useWorkflowStateMachine(options?: WorkflowStateMachineOptions) {
  const {
    initialStep = 'idle',
    maxHistoryEntries = 10,
    onStateChange,
    stateConfig = DEFAULT_STATE_CONFIG,
  } = options || {}

  // State reference to avoid stale closures in callbacks
  const stateRef = useRef<WorkflowMachineState>({
    currentStep: initialStep,
    status: getDefaultStatus(initialStep),
    data: {},
    history: [initialStep],
  })

  // State for React rendering
  const [state, setState] = useState<WorkflowMachineState>(stateRef.current)

  /**
   * Update the state and trigger callbacks
   */
  const updateState = useCallback(
    (newState: Partial<WorkflowMachineState>) => {
      const updatedState = {
        ...stateRef.current,
        ...newState,
      }

      stateRef.current = updatedState
      setState(updatedState)

      if (onStateChange) {
        onStateChange(updatedState)
      }
    },
    [onStateChange]
  )

  /**
   * Apply default status for a step with custom overrides
   */
  const applyDefaultStatus = useCallback(
    (step: WorkflowStep, customStatus?: Partial<ProcessingStatus>) => {
      const defaultStatus = getDefaultStatus(step)

      return {
        ...defaultStatus,
        ...(customStatus || {}),
      }
    },
    []
  )

  /**
   * Transition to a new step
   */
  const transition = useCallback(
    (action: string, data?: Record<string, any>) => {
      const currentConfig = stateConfig[stateRef.current.currentStep]

      if (!currentConfig) {
        updateState({
          error: `No configuration found for current step: ${stateRef.current.currentStep}`,
        })
        return false
      }

      const transition = currentConfig.transitions[action]

      if (!transition) {
        updateState({
          error: `Invalid transition action "${action}" for step ${stateRef.current.currentStep}`,
        })
        return false
      }

      // Check if transition condition is met
      if (transition.condition && !transition.condition(stateRef.current)) {
        updateState({
          error: `Transition condition not met for action "${action}"`,
        })
        return false
      }

      // Execute exit handler if defined
      if (currentConfig.onExit) {
        currentConfig.onExit(stateRef.current)
      }

      // Prepare the new state
      const previousStep = stateRef.current.currentStep
      const history = [
        transition.to,
        ...stateRef.current.history.slice(0, maxHistoryEntries - 1),
      ]

      // Get default status for the new step
      const newStatus = applyDefaultStatus(transition.to)

      // Update the state with new step and data
      updateState({
        currentStep: transition.to,
        previousStep,
        history,
        status: newStatus,
        data: data
          ? { ...stateRef.current.data, ...data }
          : stateRef.current.data,
        error: undefined, // Clear any previous error
      })

      // Execute enter handler if defined for the new state
      const newConfig = stateConfig[transition.to]
      if (newConfig?.onEnter) {
        newConfig.onEnter(stateRef.current)
      }

      return true
    },
    [stateConfig, maxHistoryEntries, updateState, applyDefaultStatus]
  )

  /**
   * Go back to the previous step if available
   */
  const goBack = useCallback(() => {
    if (stateRef.current.previousStep) {
      return transition('back', {
        wasGoingBack: true,
      })
    }
    return false
  }, [transition])

  /**
   * Set the current processing status
   */
  const setStatus = useCallback(
    (status: Partial<ProcessingStatus>) => {
      // Apply default values for the current step with custom overrides
      const updatedStatus = applyDefaultStatus(
        stateRef.current.currentStep,
        status
      )

      updateState({
        status: updatedStatus,
      })
    },
    [updateState, applyDefaultStatus]
  )

  /**
   * Set an error state
   */
  const setError = useCallback(
    (error: string) => {
      // Apply error status with the provided error message
      updateState({
        error,
        status: {
          status: 'error',
          progress: 0,
          phase: 'error',
          error,
        },
      })
    },
    [updateState]
  )

  /**
   * Reset the workflow to the initial state
   */
  const reset = useCallback(() => {
    // Get initial status for the initial step
    const initialStatus = getDefaultStatus(initialStep)

    updateState({
      currentStep: initialStep,
      previousStep: undefined,
      status: initialStatus,
      data: {},
      error: undefined,
      history: [initialStep],
    })
  }, [initialStep, updateState])

  /**
   * Store data in the state
   */
  const setData = useCallback(
    (key: string, value: any) => {
      updateState({
        data: {
          ...stateRef.current.data,
          [key]: value,
        },
      })
    },
    [updateState]
  )

  /**
   * Check if a transition is possible
   */
  const canTransition = useCallback(
    (action: string) => {
      const currentConfig = stateConfig[stateRef.current.currentStep]
      if (!currentConfig) return false

      const transition = currentConfig.transitions[action]
      if (!transition) return false

      return !transition.condition || transition.condition(stateRef.current)
    },
    [stateConfig]
  )

  /**
   * Get standardized phase name from a step
   */
  const getPhaseFromStep = useCallback((step: WorkflowStep): string => {
    const phaseMapping: Record<string, string> = {
      idle: 'initialization',
      uploading: 'uploading',
      extracting: 'extraction',
      verification: 'verification',
      report_generation: 'report_generation',
      complete: 'complete',
      error: 'error',
    }

    return phaseMapping[step] || step
  }, [])

  return {
    // Current state
    state,
    // State transition methods
    transition,
    goBack,
    reset,
    // Status management
    setStatus,
    setError,
    // Data management
    setData,
    // Utility methods
    canTransition,
    getPhaseFromStep,
  }
}

// Default workflow state configuration
const DEFAULT_STATE_CONFIG: WorkflowStateConfig = {
  idle: {
    transitions: {
      upload: { to: 'uploading' },
    },
    onEnter: (state) => {
      // Any initialization when entering idle state
    },
  },
  uploading: {
    transitions: {
      success: { to: 'extracting' },
      error: { to: 'error' },
      back: { to: 'idle' },
    },
  },
  extracting: {
    transitions: {
      success: { to: 'verification' },
      error: { to: 'error' },
      back: { to: 'uploading' },
    },
  },
  verification: {
    transitions: {
      success: { to: 'report_generation' },
      error: { to: 'error' },
      back: { to: 'extracting' },
    },
  },
  report_generation: {
    transitions: {
      success: { to: 'complete' },
      error: { to: 'error' },
      back: { to: 'verification' },
    },
  },
  complete: {
    transitions: {
      restart: { to: 'idle' },
      back: { to: 'report_generation' },
    },
  },
  error: {
    transitions: {
      retry: {
        to: 'idle',
        // Example condition: could check if certain data is available
        condition: (state) => true,
      },
    },
  },
}
