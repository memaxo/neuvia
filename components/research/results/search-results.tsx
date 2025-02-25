'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirecrawlSearch } from '@/lib/services/firecrawl/hooks';
import { useToast } from '@/components/ui/use-toast';

interface SearchResultsProps {
  initialQuery?: string;
  onResultsFound?: (results: any[]) => void;
  className?: string;
}

/**
 * Component for displaying search results using the Firecrawl service
 */
export function SearchResults({ initialQuery = '', onResultsFound, className = '' }: SearchResultsProps) {
  const [query, setQuery] = useState(initialQuery);
  const { 
    results, 
    isLoading, 
    isError, 
    error, 
    performSearch, 
    clearResults 
  } = useFirecrawlSearch();
  const { toast } = useToast();

  // Handle search form submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      toast({
        title: "Empty query",
        description: "Please enter a search term to continue",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const response = await performSearch(query);
      
      if (response.success && onResultsFound) {
        onResultsFound(response.data || []);
      }
    } catch (err) {
      toast({
        title: "Search failed",
        description: err instanceof Error ? err.message : "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  return (
    <div className={`w-full space-y-4 ${className}`}>
      {/* Search Form */}
      <form className="flex w-full items-center space-x-2" onSubmit={handleSearch}>
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-2.5 top-2.5 size-4" />
          <Input
            className="pl-9"
            disabled={isLoading}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for information..."
            type="text"
            value={query}
          />
        </div>
        <Button disabled={isLoading} type="submit">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Searching...
            </>
          ) : "Search"}
        </Button>
        {results.length > 0 && (
          <Button onClick={clearResults} type="button" variant="outline">
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
            {error || "An error occurred while performing your search."}
          </AlertDescription>
        </Alert>
      )}

      {/* Results Display */}
      <div className="space-y-4">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-4/5" />
                </CardHeader>
                <CardContent className="pb-2">
                  <Skeleton className="mb-2 h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-3 w-1/4" />
                </CardFooter>
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
                Found {results.length} result{results.length !== 1 ? 's' : ''}
              </h3>
              
              {results.map((result, index) => (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  initial={{ opacity: 0, y: 20 }}
                  key={`${result.url}-${index}`}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">
                            <a 
                              className="flex items-center hover:underline" 
                              href={result.url} 
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              {result.title}
                              <ExternalLink className="ml-1 size-3" />
                            </a>
                          </CardTitle>
                          <CardDescription className="truncate text-xs">
                            {result.url}
                          </CardDescription>
                        </div>
                        {result.relevance && (
                          <Badge variant="outline">
                            {Math.round(result.relevance * 100)}% relevant
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <p className="text-muted-foreground text-sm">
                        {result.description || "No description available"}
                      </p>
                    </CardContent>
                    <CardFooter className="pt-0">
                      <div className="text-muted-foreground flex items-center space-x-2 text-xs">
                        {result.favicon && (
                          <img 
                            alt="" 
                            className="size-4"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                            src={result.favicon}
                          />
                        )}
                        <span>
                          {result.source || new URL(result.url).hostname}
                        </span>
                      </div>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* No Results State */}
        {!isLoading && !isError && results.length === 0 && query !== '' && (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No results found for &quot;{query}&quot;</p>
          </div>
        )}
      </div>
    </div>
  );
} 