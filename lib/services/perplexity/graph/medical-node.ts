import { StateGraph, Step } from '@langchain/langgraph'
import { perplexityMedicalService } from '../medical/perplexity-medical-service'
import { PerplexityMedicalError } from '../error/perplexity-errors'
import { RunnableConfig } from '@langchain/core/runnables'
import logger from '@/lib/logger'
import type { ResearchOptions, ResearchResult } from '@/lib/types/research'

/**
 * LangGraph node for performing medical diagnosis operations
 * 
 * This node integrates with the PerplexityMedicalService to perform
 * medical diagnosis operations within a LangGraph workflow.
 */
export async function medicalDiagnosisNode(
  state: {
    query: string;
    patientData: string;
    options?: Omit<ResearchOptions, 'isMedicalDiagnosis' | 'patientData'>;
    config?: RunnableConfig;
    results?: ResearchResult[];
    errors?: string[];
  },
  config?: RunnableConfig
): Promise<Step> {
  const moduleLogger = logger.withMetadata({
    module: 'MedicalDiagnosisNode',
    query: state.query,
  })

  moduleLogger.debug('Starting medical diagnosis node', { 
    options: state.options 
  })

  try {
    // Perform the medical diagnosis
    const result = await perplexityMedicalService.performMedicalDiagnosis(
      state.query,
      state.patientData,
      state.options,
      config || state.config
    )

    // Return the updated state with the medical diagnosis result
    return {
      result: {
        ...state,
        results: [...(state.results || []), result],
      }
    }
  } catch (error) {
    moduleLogger.error('Medical diagnosis node failed', {}, error)
    
    // Add error to state
    return {
      result: {
        ...state,
        errors: [
          ...(state.errors || []),
          error instanceof Error ? error.message : String(error)
        ]
      },
      // If we want to trigger an error handler branch
      next: "error_handler" 
    }
  }
}

/**
 * LangGraph node for analyzing patient records
 */
export async function patientRecordsAnalysisNode(
  state: {
    patientData: string;
    analysisPrompt: string;
    options?: Omit<ResearchOptions, 'isMedicalDiagnosis' | 'patientData'>;
    config?: RunnableConfig;
    results?: ResearchResult[];
    errors?: string[];
  },
  config?: RunnableConfig
): Promise<Step> {
  const moduleLogger = logger.withMetadata({
    module: 'PatientRecordsAnalysisNode',
    analysisPrompt: state.analysisPrompt,
  })

  moduleLogger.debug('Starting patient records analysis node', { 
    options: state.options 
  })

  try {
    // Analyze patient records
    const result = await perplexityMedicalService.analyzePatientRecords(
      state.patientData,
      state.analysisPrompt,
      state.options,
      config || state.config
    )

    // Return the updated state with the analysis result
    return {
      result: {
        ...state,
        results: [...(state.results || []), result],
      }
    }
  } catch (error) {
    moduleLogger.error('Patient records analysis node failed', {}, error)
    
    // Add error to state
    return {
      result: {
        ...state,
        errors: [
          ...(state.errors || []),
          error instanceof Error ? error.message : String(error)
        ]
      },
      // If we want to trigger an error handler branch
      next: "error_handler" 
    }
  }
}