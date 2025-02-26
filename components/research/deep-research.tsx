/**
 * Deep Research Component
 * 
 * A component that provides an interface for performing deep research
 * using the Perplexity API or legacy Firecrawl system.
 */
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, FileText, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import type { ResearchProvider } from '@/lib/config/research';
import type { ResearchResult, ResearchSource } from '@/lib/processing/types/research';
import { usePerplexityResearch } from '@/lib/hooks/use-perplexity-research';

export interface DeepResearchProps {
  /**
   * Optional initial query
   */
  initialQuery?: string;
  
  /**
   * Default research provider
   */
  defaultProvider?: ResearchProvider;
  
  /**
   * Callback when research is completed
   */
  onResearchComplete?: (result: ResearchResult) => void;
  
  /**
   * Document ID to associate with research
   */
  documentId?: string;
  
  /**
   * Patient ID for contextual research
   */
  patientId?: string;
  
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * Deep Research component for performing advanced research
 */
export function DeepResearch({
  initialQuery = '',
  defaultProvider = 'perplexity',
  onResearchComplete,
  documentId,
  patientId,
  className = '',
}: DeepResearchProps) {
  // State for query input and active tab
  const [query, setQuery] = useState(initialQuery);
  const [depth, setDepth] = useState<'basic' | 'standard' | 'comprehensive'>('standard');
  const [activeTab, setActiveTab] = useState('research');
  
  // Use our research hook
  const {
    result,
    status,
    isLoading,
    error,
    progress,
    provider,
    performResearch: executeResearch,
    changeProvider
  } = usePerplexityResearch({
    defaultProvider,
    documentId,
    patientId,
    storeHistory: true,
    persistHistory: true
  });
  
  // Update active tab when result becomes available
  useEffect(() => {
    if (result && activeTab === 'research') {
      setActiveTab('results');
    }
  }, [result, activeTab]);
  
  // Handle research submission
  const handleResearch = async () => {
    if (!query.trim() || isLoading) return;
    
    const researchResult = await executeResearch(query, {
      depth,
      sourcesLimit: 10,
      includeSourceContent: true
    });
    
    // Call the completion callback if provided
    if (researchResult && onResearchComplete) {
      onResearchComplete(researchResult);
    }
  };
  
  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Deep Research</span>
          <Badge variant={provider === 'perplexity' ? 'default' : 'secondary'}>
            {provider === 'perplexity' ? 'Perplexity AI' : 'Firecrawl (Legacy)'}
          </Badge>
        </CardTitle>
        <CardDescription>
          Use AI to research topics with reliable sources
        </CardDescription>
      </CardHeader>
      
      <Tabs onValueChange={setActiveTab} value={activeTab}>
        <TabsList className="mx-6">
          <TabsTrigger value="research">Research</TabsTrigger>
          <TabsTrigger disabled={!result} value="results">Results</TabsTrigger>
          <TabsTrigger disabled={!result} value="sources">Sources</TabsTrigger>
          <TabsTrigger disabled={!result} value="findings">Key Findings</TabsTrigger>
        </TabsList>
        
        <CardContent className="pt-6">
          <TabsContent value="research">
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium" htmlFor="research-query">
                  Research Query
                </label>
                <Input
                  disabled={isLoading}
                  id="research-query"
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your research question..."
                  value={query}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium" htmlFor="provider-select">
                    Research Provider
                  </label>
                  <Select
                    disabled={isLoading}
                    onValueChange={(value) => changeProvider(value as ResearchProvider)}
                    value={provider}
                  >
                    <SelectTrigger id="provider-select">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="perplexity">Perplexity AI</SelectItem>
                        <SelectItem value="firecrawl">Firecrawl (Legacy)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium" htmlFor="depth-select">
                    Research Depth
                  </label>
                  <Select
                    disabled={isLoading}
                    onValueChange={(value) => setDepth(value as 'basic' | 'standard' | 'comprehensive')}
                    value={depth}
                  >
                    <SelectTrigger id="depth-select">
                      <SelectValue placeholder="Select depth" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="comprehensive">Comprehensive</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                  Error: {error}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="results">
            {result && (
              <div className="space-y-4">
                <div className="bg-muted rounded-md p-4">
                  <h3 className="mb-2 font-medium">Research Summary</h3>
                  <div className="whitespace-pre-wrap text-sm">{result.summary}</div>
                </div>
                
                <div className="text-muted-foreground flex justify-between text-sm">
                  <span>
                    {result.sources.length} {result.sources.length === 1 ? 'source' : 'sources'}
                  </span>
                  {result.confidence !== undefined && (
                    <span>
                      Confidence: {Math.round(result.confidence * 100)}%
                    </span>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="sources">
            {result && (
              <div className="space-y-4">
                <h3 className="font-medium">Sources ({result.sources.length})</h3>
                
                <div className="space-y-4">
                  {result.sources.map((source: ResearchSource, index) => (
                    <div className="rounded-md border p-4" key={index}>
                      <h4 className="font-medium">{source.title || `Source ${index + 1}`}</h4>
                      <a 
                        className="flex items-center gap-1 text-sm text-blue-600 hover:underline" 
                        href={source.url} 
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <LinkIcon size={12} /> {source.url}
                      </a>
                      {source.description && (
                        <p className="mt-2 text-sm">{source.description}</p>
                      )}
                      {source.content && (
                        <div className="bg-muted mt-2 rounded-md p-2 text-sm">
                          {source.content}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="findings">
            {result && (
              <div className="space-y-4">
                <h3 className="font-medium">Key Findings</h3>
                
                {result.keyFindings && result.keyFindings.length > 0 ? (
                  <ul className="space-y-2">
                    {result.keyFindings.map((finding, index) => (
                      <li className="flex items-start gap-2" key={index}>
                        <CheckCircle2 className="mt-1 text-green-600" size={16} />
                        <span className="text-sm">{finding}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">No key findings available.</p>
                )}
              </div>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
      
      <CardFooter className="flex justify-between">
        {isLoading ? (
          <div className="w-full">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm">{progress < 100 ? 'Researching...' : 'Complete'}</span>
              <span className="text-sm">{progress}%</span>
            </div>
            <div className="bg-secondary h-2 w-full rounded-full">
              <div 
                className="bg-primary h-2 rounded-full transition-all" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <Button 
              disabled={!query || isLoading} 
              onClick={() => setQuery('')}
              variant="ghost"
            >
              Clear
            </Button>
            <Button 
              disabled={!query.trim() || isLoading}
              onClick={handleResearch}
            >
              <Search className="mr-2 size-4" /> Research
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
} 