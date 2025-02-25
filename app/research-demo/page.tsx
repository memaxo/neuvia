'use client';

import { FirecrawlResearchPanel } from '@/components/research/firecrawl-research-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ResearchDemo() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center space-x-4">
        <Button asChild size="sm" variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 size-4" />
            Back to Home
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Firecrawl Research Demo</h1>
          <p className="text-muted-foreground">
            Explore the web with search, extract, and scrape capabilities
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-2xl font-semibold">Research Tools</h2>
          <p className="text-muted-foreground mb-6">
            This demo showcases the Firecrawl integration with three main capabilities:
          </p>

          <Tabs className="mb-6" defaultValue="search">
            <TabsList>
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="extract">Extract</TabsTrigger>
              <TabsTrigger value="scrape">Scrape</TabsTrigger>
            </TabsList>
            <TabsContent className="mt-2 rounded-md border p-4" value="search">
              <h3 className="mb-2 font-medium">Web Search</h3>
              <p className="text-muted-foreground text-sm">
                Find relevant information across the web with powerful search capabilities.
                Results include titles, descriptions, and source information.
              </p>
            </TabsContent>
            <TabsContent className="mt-2 rounded-md border p-4" value="extract">
              <h3 className="mb-2 font-medium">Data Extraction</h3>
              <p className="text-muted-foreground text-sm">
                Extract structured data from multiple web pages simultaneously.
                Specify what information you want using natural language prompts.
              </p>
            </TabsContent>
            <TabsContent className="mt-2 rounded-md border p-4" value="scrape">
              <h3 className="mb-2 font-medium">Web Scraping</h3>
              <p className="text-muted-foreground text-sm">
                Scrape and clean the content from any webpage. View the content in a 
                readable format and access all the metadata.
              </p>
            </TabsContent>
          </Tabs>

          <div className="bg-muted/50 rounded-md p-4">
            <h3 className="mb-2 font-medium">Implementation Details</h3>
            <p className="text-muted-foreground mb-2 text-sm">
              These components are implemented using:
            </p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              <li>React hooks for state management</li>
              <li>Firecrawl service layer for API operations</li>
              <li>Shadcn UI components for consistent styling</li>
              <li>Framer Motion for smooth animations</li>
              <li>TypeScript for type safety</li>
            </ul>
          </div>
        </div>

        <div className="lg:row-span-2">
          <FirecrawlResearchPanel className="min-h-[800px]" />
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-semibold">How to Use</h2>
          <div className="space-y-4">
            <div className="rounded-md border p-4">
              <h3 className="mb-2 font-medium">Search</h3>
              <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-sm">
                <li>Enter a search query in the input field</li>
                <li>Click the &quot;Search&quot; button to find results</li>
                <li>Review the list of relevant web pages</li>
                <li>Click on any result title to visit the source</li>
              </ol>
            </div>
            
            <div className="rounded-md border p-4">
              <h3 className="mb-2 font-medium">Extract</h3>
              <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-sm">
                <li>Add URLs to extract from (manually or from search results)</li>
                <li>Enter a prompt describing what information to extract</li>
                <li>Click &quot;Extract Information&quot; to process the URLs</li>
                <li>View the extracted data in formatted or raw JSON format</li>
              </ol>
            </div>
            
            <div className="rounded-md border p-4">
              <h3 className="mb-2 font-medium">Scrape</h3>
              <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-sm">
                <li>Enter a URL to scrape</li>
                <li>Click the &quot;Scrape&quot; button to process the page</li>
                <li>View the cleaned content in the &quot;Content&quot; tab</li>
                <li>Explore the page metadata in the &quot;Metadata&quot; tab</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 