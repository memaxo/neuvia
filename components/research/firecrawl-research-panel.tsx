'use client';

import { useState } from 'react';
import { Search, FileText, Globe } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchResults } from './results/search-results';
import { ExtractResults } from './results/extract-results';
import { ScrapeResults } from './results/scrape-results';
import type { SearchResult } from '@/lib/services/firecrawl/types';

interface FirecrawlResearchPanelProps {
  initialTab?: 'search' | 'extract' | 'scrape';
  className?: string;
}

/**
 * A unified research panel that provides access to all Firecrawl research capabilities
 */
export function FirecrawlResearchPanel({ initialTab = 'search', className = '' }: FirecrawlResearchPanelProps) {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [extractedResults, setExtractedResults] = useState<any[]>([]);
  const [scrapedResult, setScrapedResult] = useState<any>(null);
  
  // Track active URLs from search results to use in extraction
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const handleSearchResultsFound = (results: SearchResult[]) => {
    setSearchResults(results);
    // Auto-select first 3 URLs for extraction for convenience
    if (results.length > 0) {
      setSelectedUrls(results.slice(0, 3).map(r => r.url));
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Firecrawl Research</CardTitle>
            <CardDescription>
              Search, extract, and scrape web content
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {searchResults.length > 0 && (
              <Badge variant="outline" className="gap-1">
                <Search className="size-3" />
                {searchResults.length}
              </Badge>
            )}
            {extractedResults.length > 0 && (
              <Badge variant="outline" className="gap-1">
                <FileText className="size-3" />
                {extractedResults.length}
              </Badge>
            )}
            {scrapedResult && (
              <Badge variant="outline" className="gap-1">
                <Globe className="size-3" />
                1
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search">
              <Search className="mr-2 size-4" />
              Search
            </TabsTrigger>
            <TabsTrigger value="extract">
              <FileText className="mr-2 size-4" />
              Extract
            </TabsTrigger>
            <TabsTrigger value="scrape">
              <Globe className="mr-2 size-4" />
              Scrape
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="search" className="mt-4">
            <SearchResults 
              onResultsFound={handleSearchResultsFound}
            />
          </TabsContent>
          
          <TabsContent value="extract" className="mt-4">
            <ExtractResults 
              urls={selectedUrls}
              initialPrompt="Extract key points and relevant information"
              onResultsExtracted={setExtractedResults}
            />
          </TabsContent>
          
          <TabsContent value="scrape" className="mt-4">
            <ScrapeResults 
              onResultScraped={setScrapedResult}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 