'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, AlertCircle, Loader2, Link as LinkIcon, Code } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirecrawlExtract } from '@/lib/services/firecrawl/hooks';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

interface ExtractResultsProps {
  urls?: string[];
  initialPrompt?: string;
  onResultsExtracted?: (results: any[]) => void;
  className?: string;
}

/**
 * Component for displaying extraction results using the Firecrawl service
 */
export function ExtractResults({ 
  urls: initialUrls = [], 
  initialPrompt = '',
  onResultsExtracted,
  className = '' 
}: ExtractResultsProps) {
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [urlInput, setUrlInput] = useState('');
  const { 
    results, 
    isLoading, 
    isError, 
    error, 
    performExtraction, 
    clearResults 
  } = useFirecrawlExtract();
  const { toast } = useToast();

  // Handle adding a URL
  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    
    try {
      // Basic URL validation
      new URL(urlInput);
      
      // Add URL if it's not already in the list
      if (!urls.includes(urlInput)) {
        setUrls([...urls, urlInput]);
      }
      
      // Clear input
      setUrlInput('');
    } catch (err) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL including http:// or https://",
        variant: "destructive"
      });
    }
  };
  
  // Handle removing a URL
  const handleRemoveUrl = (urlToRemove: string) => {
    setUrls(urls.filter(url => url !== urlToRemove));
  };

  // Handle extraction
  const handleExtract = async () => {
    if (urls.length === 0) {
      toast({
        title: "No URLs",
        description: "Please add at least one URL to extract from",
        variant: "destructive"
      });
      return;
    }
    
    if (!prompt.trim()) {
      toast({
        title: "Empty prompt",
        description: "Please enter an extraction prompt to continue",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const response = await performExtraction(urls, prompt);
      
      if (response.success && onResultsExtracted) {
        onResultsExtracted(response.data || []);
      }
    } catch (err) {
      toast({
        title: "Extraction failed",
        description: err instanceof Error ? err.message : "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  return (
    <div className={`w-full space-y-4 ${className}`}>
      {/* URL Input */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">URLs to extract from ({urls.length})</h3>
        <div className="flex items-center space-x-2">
          <Input
            className="flex-1"
            disabled={isLoading}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com"
            type="url"
            value={urlInput}
          />
          <Button 
            disabled={isLoading || !urlInput.trim()} 
            onClick={handleAddUrl}
            size="sm"
          >
            Add URL
          </Button>
        </div>
        
        {/* URL List */}
        {urls.length > 0 && (
          <ScrollArea className="h-24 rounded-md border">
            <div className="space-y-1 p-2">
              {urls.map((url, index) => (
                <div 
                  className="bg-muted/50 flex items-center justify-between rounded px-2 py-1 text-xs" 
                  key={`${url}-${index}`}
                >
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <LinkIcon className="size-3 shrink-0" />
                    <span className="truncate">{url}</span>
                  </div>
                  <Button 
                    className="size-5 p-0" 
                    disabled={isLoading} 
                    onClick={() => handleRemoveUrl(url)}
                    size="sm"
                    variant="ghost"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Prompt Input */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Extraction prompt</h3>
        <Textarea
          disabled={isLoading}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what information to extract: e.g., 'Extract key points about climate change including dates and statistics'"
          rows={3}
          value={prompt}
        />
        
        <div className="flex justify-between">
          <Button 
            disabled={isLoading || urls.length === 0 || !prompt.trim()} 
            onClick={handleExtract}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Extracting...
              </>
            ) : "Extract Information"}
          </Button>
          {results.length > 0 && (
            <Button onClick={clearResults} variant="outline">
              Clear Results
            </Button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {isError && (
        <Alert variant="default">
          <AlertCircle className="size-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error || "An error occurred while extracting information."}
          </AlertDescription>
        </Alert>
      )}

      {/* Results Display */}
      <div className="space-y-4">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-4/5" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="mb-2 h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Results List */}
        <AnimatePresence>
          {!isLoading && results.length > 0 && (
            <motion.div
              animate={{ opacity: 1 }}
              className="space-y-4"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
            >
              <h3 className="text-lg font-medium">
                Extracted from {results.length} source{results.length !== 1 ? 's' : ''}
              </h3>
              
              {results.map((result, index) => (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  initial={{ opacity: 0, y: 20 }}
                  key={`extract-${index}`}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center text-base">
                        <FileText className="mr-2 size-4" />
                        <a 
                          className="hover:underline" 
                          href={result.url} 
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {new URL(result.url).hostname}
                        </a>
                      </CardTitle>
                      <CardDescription className="truncate text-xs">
                        {result.url}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <Tabs defaultValue="formatted">
                        <TabsList className="mb-2">
                          <TabsTrigger value="formatted">Formatted</TabsTrigger>
                          <TabsTrigger value="raw">Raw Data</TabsTrigger>
                        </TabsList>
                        <TabsContent className="mt-0" value="formatted">
                          <ScrollArea className="h-64 rounded-md border p-3">
                            <div className="space-y-2">
                              {renderExtractedData(result.data)}
                            </div>
                          </ScrollArea>
                        </TabsContent>
                        <TabsContent className="mt-0" value="raw">
                          <ScrollArea className="h-64 rounded-md border">
                            <pre className="p-3 text-xs">
                              {JSON.stringify(result.data, null, 2)}
                            </pre>
                          </ScrollArea>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* No Results State */}
        {!isLoading && !isError && results.length === 0 && urls.length > 0 && prompt !== '' && (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              No extractions have been performed yet. Click the "Extract Information" button to start.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Helper function to render extracted data in a user-friendly format
 */
function renderExtractedData(data: any) {
  if (!data) {
    return <p className="text-muted-foreground">No data extracted</p>;
  }

  // If data is a string
  if (typeof data === 'string') {
    return <p>{data}</p>;
  }

  // If data is an array
  if (Array.isArray(data)) {
    return (
      <ul className="list-inside list-disc space-y-2">
        {data.map((item, i) => (
          <li className="text-sm" key={i}>
            {typeof item === 'string' ? item : renderExtractedData(item)}
          </li>
        ))}
      </ul>
    );
  }

  // If data is an object
  if (typeof data === 'object') {
    return (
      <div className="space-y-3">
        {Object.entries(data).map(([key, value], i) => (
          <div className="space-y-1" key={i}>
            <h4 className="text-sm font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}</h4>
            <div className="pl-2">{renderExtractedData(value)}</div>
          </div>
        ))}
      </div>
    );
  }

  // Fallback for other types
  return <p>{String(data)}</p>;
} 