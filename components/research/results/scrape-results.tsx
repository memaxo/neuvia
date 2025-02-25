'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, AlertCircle, Loader2, ExternalLink, FileText, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirecrawlScrape } from '@/lib/services/firecrawl/hooks';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ScrapeResultsProps {
  initialUrl?: string;
  onResultScraped?: (result: any) => void;
  className?: string;
}

/**
 * Component for displaying scraping results using the Firecrawl service
 */
export function ScrapeResults({ 
  initialUrl = '', 
  onResultScraped, 
  className = '' 
}: ScrapeResultsProps) {
  const [url, setUrl] = useState(initialUrl);
  const { 
    result, 
    isLoading, 
    isError, 
    error, 
    performScrape, 
    clearResult 
  } = useFirecrawlScrape();
  const { toast } = useToast();

  // Handle scrape form submission
  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast({
        title: "Empty URL",
        description: "Please enter a URL to scrape",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Basic URL validation
      new URL(url);
      
      // Perform the scrape
      const response = await performScrape(url, {
        includeMetadata: true
      });
      
      if (response.success && onResultScraped) {
        onResultScraped(response.data);
      }
    } catch (err) {
      // URL validation error
      if (err instanceof TypeError) {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid URL including http:// or https://",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Scrape failed",
          description: err instanceof Error ? err.message : "An unexpected error occurred",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className={`w-full space-y-4 ${className}`}>
      {/* Scrape Form */}
      <form className="flex w-full items-center space-x-2" onSubmit={handleScrape}>
        <div className="relative flex-1">
          <Globe className="text-muted-foreground absolute left-2.5 top-2.5 size-4" />
          <Input
            className="pl-9"
            disabled={isLoading}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            type="url"
            value={url}
          />
        </div>
        <Button disabled={isLoading} type="submit">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Scraping...
            </>
          ) : "Scrape"}
        </Button>
        {result && (
          <Button onClick={clearResult} type="button" variant="outline">
            Clear
          </Button>
        )}
      </form>

      {/* Error Display */}
      {isError && (
        <Alert variant="default">
          <AlertCircle className="size-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error || "An error occurred while scraping the URL."}
          </AlertDescription>
        </Alert>
      )}

      {/* Results Display */}
      <div className="space-y-4">
        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="mt-1 h-3 w-2/3" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-2 h-3 w-full" />
              <Skeleton className="mb-2 h-3 w-full" />
              <Skeleton className="mb-2 h-3 w-full" />
              <Skeleton className="mb-2 h-3 w-4/5" />
              <Skeleton className="h-3 w-3/4" />
            </CardContent>
          </Card>
        )}

        {/* Result Display */}
        <AnimatePresence>
          {!isLoading && result && (
            <motion.div
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center text-base">
                        <FileText className="mr-2 size-4" />
                        {result.title || new URL(result.url).hostname}
                      </CardTitle>
                      <CardDescription className="truncate text-xs">
                        <a 
                          className="flex max-w-fit items-center hover:underline" 
                          href={result.url} 
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {result.url}
                          <ExternalLink className="ml-1 size-3" />
                        </a>
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {result.metadata?.pageStatusCode || 200}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="content">
                    <TabsList className="mb-2">
                      <TabsTrigger value="content">Content</TabsTrigger>
                      <TabsTrigger value="metadata">Metadata</TabsTrigger>
                    </TabsList>
                    <TabsContent className="mt-0" value="content">
                      <ScrollArea className="h-64 rounded-md border">
                        <div className="prose prose-sm max-w-none p-3">
                          {result.data ? (
                            <div dangerouslySetInnerHTML={{ __html: formatMarkdown(result.data) }} />
                          ) : (
                            <p className="text-muted-foreground">No content was scraped from this URL.</p>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                    <TabsContent className="mt-0" value="metadata">
                      <ScrollArea className="h-64 rounded-md border">
                        <div className="space-y-4 p-3">
                          {result.metadata ? (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              {renderMetadataItem('Title', result.title)}
                              {renderMetadataItem('Description', result.metadata.description)}
                              {renderMetadataItem('Keywords', result.metadata.keywords)}
                              {renderMetadataItem('OG Title', result.metadata.ogTitle)}
                              {renderMetadataItem('OG Description', result.metadata.ogDescription)}
                              {renderMetadataItem('OG URL', result.metadata.ogUrl)}
                              {renderMetadataItem('OG Image', result.metadata.ogImage, true)}
                              {renderMetadataItem('OG Site Name', result.metadata.ogSiteName)}
                              {renderMetadataItem('Robots', result.metadata.robots)}
                            </div>
                          ) : (
                            <p className="text-muted-foreground">No metadata was scraped from this URL.</p>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </CardContent>
                <CardFooter>
                  <div className="text-muted-foreground flex items-center text-xs">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="mr-1 size-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Scraped at {new Date().toLocaleString()}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span>Scraped with Firecrawl</span>
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* No Results State */}
        {!isLoading && !isError && !result && url !== '' && (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              No content has been scraped yet. Click the "Scrape" button to start.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Helper function to render metadata items
 */
function renderMetadataItem(label: string, value: string | undefined, isImage: boolean = false) {
  if (!value) return null;
  
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium">{label}</h4>
      {isImage ? (
        <img 
          alt={label} 
          className="max-h-24 rounded border" 
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).insertAdjacentHTML('afterend', 
              '<p class="text-xs text-muted-foreground">Unable to load image</p>');
          }}
          src={value}
        />
      ) : (
        <p className="text-muted-foreground break-words text-xs">{value}</p>
      )}
    </div>
  );
}

/**
 * Helper function to convert markdown to HTML
 */
function formatMarkdown(text: string): string {
  // This is a simple formatter, in a real app you'd use a proper markdown library
  return text
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/# (.*?)(?:\n|$)/g, '<h1>$1</h1>')
    .replace(/## (.*?)(?:\n|$)/g, '<h2>$1</h2>')
    .replace(/### (.*?)(?:\n|$)/g, '<h3>$1</h3>')
    .replace(/- (.*?)(?:\n|$)/g, '<li>$1</li>');
} 