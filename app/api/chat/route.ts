import {
  type Message,
  convertToCoreMessages,
  createDataStreamResponse,
  streamText,
} from 'ai';
import { z } from 'zod';

import { getUser } from '@/app/auth/actions';
import { customModel } from '@/lib/ai';
import { models } from '@/lib/ai/models';
import { systemPrompt } from '@/lib/ai/prompts';
import { rateLimiter } from '@/lib/rate-limit';
import { search, extract, scrape } from '@/lib/services/firecrawl/actions';
import type { ScrapeResult as FirecrawlScrapeResult } from '@/lib/services/firecrawl/types';

const activeTools = ['firecrawlSearch', 'firecrawlExtract', 'firecrawlScrape'] as ['firecrawlSearch', 'firecrawlExtract', 'firecrawlScrape'];

interface ScrapeResult {
  content: string;
  metadata: {
    title?: string;
    description?: string;
    keywords?: string;
    robots?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogUrl?: string;
    ogImage?: string;
    ogLocaleAlternate?: string[];
    ogSiteName?: string;
    sourceURL: string;
    pageStatusCode: number;
  };
}

export async function POST(request: Request) {
  const {
    messages,
    modelId,
  }: {
    messages: Array<Message>;
    modelId: string;
  } = await request.json();

  const session = await getUser();

  if (!session?.data?.user) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await (rateLimiter as any).check(request, 10, '1 m'); // 10 requests per minute
  } catch (_error) {
    return new Response(JSON.stringify({ success: false, error: 'Too Many Requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const model = models.find((m) => m.id === modelId) ?? models[0];

  const userMessageId = crypto.randomUUID();
  const coreMessages = convertToCoreMessages(messages);

  return createDataStreamResponse({
    execute: async (dataStream) => {
      dataStream.writeData({
        type: 'user-message-id',
        content: userMessageId,
      });

      await streamText({
        model: customModel(model.apiIdentifier, false),
        system: systemPrompt,
        messages: coreMessages,
        maxSteps: 10,
        experimental_activeTools: activeTools,
        tools: {
          firecrawlSearch: {
            description: "Search for web pages using FireCrawl. Normally you should call the firecrawlExtract tool next.",
            parameters: z.object({
              query: z.string().describe('Search query to find relevant web pages'),
              maxResults: z.number().optional().describe('Maximum number of results to return (default 10)'),
            }),
            execute: async ({ query, maxResults }) => {
              const searchResponse = await search(query, { 
                maxResults,
                includeFavicons: true 
              });
              
              return {
                data: searchResponse.data,
                success: searchResponse.success,
                error: searchResponse.error
              };
            },
          },
          firecrawlExtract: {
            description: 'Extract structured data from web pages using FireCrawl. Provide URLs and a prompt describing what data you want.',
            parameters: z.object({
              urls: z.array(z.string()).describe('Array of URLs to extract data from'),
              prompt: z.string().describe('Description of what data to extract'),
            }),
            execute: async ({ urls, prompt }) => {
              const extractResponse = await extract(urls, prompt);
              
              return {
                data: extractResponse.data,
                success: extractResponse.success,
                error: extractResponse.error
              };
            },
          },
          firecrawlScrape: {
            description: 'Scrape and convert a webpage into clean markdown content with metadata using FireCrawl.',
            parameters: z.object({
              url: z.string().describe('URL to scrape'),
            }),
            execute: async ({ url }) => {
              const scrapeResponse = await scrape(url, { 
                includeMetadata: true,
                format: 'markdown'
              });
              
              if (!scrapeResponse.success) {
                return {
                  success: false,
                  error: scrapeResponse.error
                };
              }
              
              const firecrawlResult = scrapeResponse.data as FirecrawlScrapeResult;
              const result: ScrapeResult = {
                content: firecrawlResult.data,
                metadata: {
                  title: firecrawlResult.title,
                  description: firecrawlResult.metadata?.description,
                  keywords: firecrawlResult.metadata?.keywords,
                  robots: firecrawlResult.metadata?.robots,
                  ogTitle: firecrawlResult.metadata?.ogTitle,
                  ogDescription: firecrawlResult.metadata?.ogDescription,
                  ogUrl: firecrawlResult.metadata?.ogUrl,
                  ogImage: firecrawlResult.metadata?.ogImage,
                  ogLocaleAlternate: Array.isArray(firecrawlResult.metadata?.ogLocaleAlternate) 
                    ? firecrawlResult.metadata?.ogLocaleAlternate 
                    : firecrawlResult.metadata?.ogLocaleAlternate ? [firecrawlResult.metadata?.ogLocaleAlternate] : undefined,
                  ogSiteName: firecrawlResult.metadata?.ogSiteName,
                  sourceURL: firecrawlResult.metadata?.sourceURL || url,
                  pageStatusCode: firecrawlResult.metadata?.pageStatusCode || 200,
                }
              };
              
              return {
                data: result,
                success: true
              };
            },
          },
        },
      });
    },
  });
}