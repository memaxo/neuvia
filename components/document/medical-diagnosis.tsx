/**
 * Medical Diagnosis Component
 *
 * A component for generating medical diagnoses based on patient documents
 * using Perplexity AI's deep research capabilities.
 */
'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useMutation } from '@tanstack/react-query'
import {
  AlertTriangle,
  FileText,
  Loader2,
  Search,
  Stethoscope,
} from 'lucide-react'
import React, { useState, useCallback } from 'react'
import { toast } from 'sonner'

/**
 * Interface for a medical diagnosis condition
 */
interface DiagnosisCondition {
  name: string
  confidence: number
  rationale: string
  treatments?: string[]
}

/**
 * Interface for a medical diagnosis response
 */
interface DiagnosisResponse {
  summary: string
  conditions: DiagnosisCondition[]
  sources: Array<{
    title: string
    url: string
    description?: string
  }>
  timing?: {
    elapsedSeconds: number
    requestTime: string
  }
}

export interface MedicalDiagnosisProps {
  /**
   * Document ID to use for diagnosis
   */
  documentId: string

  /**
   * Optional initial query or context
   */
  initialQuery?: string

  /**
   * Callback when diagnosis is completed
   */
  onDiagnosisComplete?: (result: DiagnosisResponse) => void

  /**
   * Additional class name
   */
  className?: string
}

/**
 * Medical Diagnosis component for generating differential diagnoses
 */
export function MedicalDiagnosis({
  documentId,
  initialQuery = '',
  onDiagnosisComplete,
  className = '',
}: MedicalDiagnosisProps) {
  // State for query input and active tab
  const [query, setQuery] = useState(initialQuery)
  const [activeTab, setActiveTab] = useState('diagnosis')
  const [result, setResult] = useState<DiagnosisResponse | null>(null)

  // Mutation for performing the diagnosis
  const mutation = useMutation({
    mutationFn: async (diagnosisQuery: string) => {
      const response = await fetch('/api/medical-diagnosis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          query: diagnosisQuery || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate diagnosis')
      }

      const data = await response.json()
      return data.result
    },
    onSuccess: (data) => {
      setResult(data)
      setActiveTab('results')

      if (onDiagnosisComplete) {
        onDiagnosisComplete(data)
      }

      toast.success('Medical diagnosis generated successfully')
    },
    onError: (error) => {
      toast.error(`Error generating diagnosis: ${error.message}`)
    },
  })

  // Handle diagnosis submission
  const handleDiagnosis = useCallback(() => {
    if (!documentId) {
      toast.error('Document ID is required')
      return
    }

    if (mutation.isPending) return
    mutation.mutate(query)
  }, [documentId, query, mutation.isPending, mutation.mutate])

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Stethoscope className="mr-2 size-5" />
            Medical Diagnosis
          </span>
          <Badge variant="default">Perplexity AI</Badge>
        </CardTitle>
        <CardDescription>
          Generate differential diagnoses with confidence ratings based on
          patient data
        </CardDescription>
      </CardHeader>

      <Tabs onValueChange={setActiveTab} value={activeTab}>
        <TabsList className="mx-6">
          <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>
          <TabsTrigger disabled={!result} value="results">
            Results
          </TabsTrigger>
          <TabsTrigger disabled={!result} value="conditions">
            Conditions
          </TabsTrigger>
          <TabsTrigger disabled={!result} value="sources">
            Sources
          </TabsTrigger>
        </TabsList>

        <CardContent className="pt-6">
          <TabsContent value="diagnosis">
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="diagnosis-query"
                >
                  Additional Context (Optional)
                </label>
                <Textarea
                  className="min-h-[100px]"
                  disabled={mutation.isPending}
                  id="diagnosis-query"
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter any additional context or specific questions for the diagnosis..."
                  value={query}
                />
                <p className="text-muted-foreground text-xs">
                  Leave empty for a standard differential diagnosis based on the
                  patient data. Add specific symptoms, concerns, or questions to
                  focus the diagnosis.
                </p>
              </div>

              {documentId ? (
                <div className="flex items-center rounded-md bg-blue-50 p-3 text-sm text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <FileText className="mr-2 size-4" />
                  Using document ID: {documentId}
                </div>
              ) : (
                <div className="flex items-center rounded-md bg-amber-50 p-3 text-sm text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <AlertTriangle className="mr-2 size-4" />
                  No document selected. Please provide a document ID.
                </div>
              )}

              {mutation.error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                  Error: {mutation.error.message}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="results">
            {result && (
              <div className="space-y-4">
                <div className="bg-muted rounded-md p-4">
                  <h3 className="mb-2 font-medium">Diagnosis Summary</h3>
                  <div className="whitespace-pre-wrap text-sm">
                    {result.summary}
                  </div>
                </div>

                <div className="text-muted-foreground flex justify-between text-sm">
                  <span>
                    {result.conditions.length}{' '}
                    {result.conditions.length === 1
                      ? 'condition'
                      : 'conditions'}{' '}
                    identified
                  </span>
                  {result.timing && (
                    <span>
                      Generated in {result.timing.elapsedSeconds.toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="conditions">
            {result && (
              <div className="space-y-4">
                <h3 className="font-medium">
                  Differential Diagnosis ({result.conditions.length})
                </h3>

                <div className="space-y-4">
                  {result.conditions.map((condition, index) => (
                    <div
                      className={`rounded-md border p-4 ${
                        condition.confidence > 0.7
                          ? 'border-l-4 border-l-red-500'
                          : condition.confidence > 0.4
                            ? 'border-l-4 border-l-amber-500'
                            : 'border-l-4 border-l-blue-500'
                      }`}
                      key={index}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="font-medium">{condition.name}</h4>
                        <div
                          className={`rounded px-2 py-1 text-sm ${
                            condition.confidence > 0.7
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : condition.confidence > 0.4
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}
                        >
                          {Math.round(condition.confidence * 100)}% confidence
                        </div>
                      </div>

                      <div className="mb-3">
                        <h5 className="text-muted-foreground mb-1 text-xs uppercase">
                          Rationale
                        </h5>
                        <p className="text-sm">{condition.rationale}</p>
                      </div>

                      {condition.treatments &&
                        condition.treatments.length > 0 && (
                          <div>
                            <h5 className="text-muted-foreground mb-1 text-xs uppercase">
                              Possible Treatments
                            </h5>
                            <ul className="list-disc space-y-1 pl-5 text-sm">
                              {condition.treatments.map(
                                (treatment, treatmentIndex) => (
                                  <li key={treatmentIndex}>{treatment}</li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sources">
            {result && result.sources && result.sources.length > 0 ? (
              <div className="space-y-4">
                <h3 className="font-medium">
                  Sources ({result.sources.length})
                </h3>

                <div className="space-y-4">
                  {result.sources.map((source, index) => (
                    <div className="rounded-md border p-4" key={index}>
                      <h4 className="font-medium">
                        {source.title || `Source ${index + 1}`}
                      </h4>
                      <a
                        className="flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
                        href={source.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {source.url}
                      </a>
                      {source.description && (
                        <p className="mt-2 text-sm">{source.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-muted text-muted-foreground rounded-md p-4 text-center">
                No sources available for this diagnosis.
              </div>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>

      <CardFooter>
        <div className="flex w-full justify-between">
          {activeTab === 'diagnosis' ? (
            <Button
              className="ml-auto"
              disabled={!documentId || mutation.isPending}
              onClick={handleDiagnosis}
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Generate Diagnosis
            </Button>
          ) : (
            <Button
              className="ml-auto"
              onClick={() => setActiveTab('diagnosis')}
              variant="secondary"
            >
              New Diagnosis
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
