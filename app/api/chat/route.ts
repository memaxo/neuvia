import { FireCrawlLoader } from '@langchain/community/document_loaders/web/firecrawl';
import FirecrawlApp from '@mendable/firecrawl-js';
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

const app = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY ?? '',
});

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
            execute: async ({ query }) => {
              try {
                const searchResult = await app.search(query);
                if (!searchResult.success) {
                  return {
                    error: `Search failed: ${searchResult.error}`,
                    success: false,
                  };
                }
                const resultsWithFavicons = searchResult.data.map((result) => {
                  const url = new URL(result.url ?? '');
                  const favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
                  return {
                    favicon,
                    title: result.title ?? '',
                    url: result.url ?? '',
                    description: result.description,
                  };
                });
                return {
                  data: resultsWithFavicons,
                  success: true,
                };
              } catch (error) {
                return {
                  error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  success: false,
                };
              }
            },
          },
          firecrawlExtract: {
            description: 'Extract structured data from web pages using FireCrawl. Provide URLs and a prompt describing what data you want.',
            parameters: z.object({
              urls: z.array(z.string()).describe('Array of URLs to extract data from'),
              prompt: z.string().describe('Description of what data to extract'),
            }),
            execute: async ({ urls, prompt }) => {
              try {
                const extractResult = await app.extract(urls, { prompt });
                if (!extractResult.success) {
                  return {
                    error: `Failed to extract data: ${extractResult.error}`,
                    success: false,
                  };
                }
                return {
                  data: extractResult.data,
                  success: true,
                };
              } catch (error) {
                return {
                  error: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  success: false,
                };
              }
            },
          },
          firecrawlScrape: {
            description: 'Scrape and convert a webpage into clean markdown content with metadata using FireCrawl.',
            parameters: z.object({
              url: z.string().describe('URL to scrape'),
            }),
            execute: async ({ url }) => {
              try {
                const loader = new FireCrawlLoader({
                  url,
                  apiKey: process.env.FIRECRAWL_API_KEY,
                  mode: 'scrape',
                });

                const docs = await loader.load();
                if (!docs.length) {
                  return {
                    error: 'No content found on the page',
                    success: false,
                  };
                }

                const doc = docs[0];
                const result: ScrapeResult = {
                  content: doc.pageContent,
                  metadata: {
                    title: doc.metadata.title,
                    description: doc.metadata.description,
                    keywords: doc.metadata.keywords,
                    robots: doc.metadata.robots,
                    ogTitle: doc.metadata.ogTitle,
                    ogDescription: doc.metadata.ogDescription,
                    ogUrl: doc.metadata.ogUrl,
                    ogImage: doc.metadata.ogImage,
                    ogLocaleAlternate: doc.metadata.ogLocaleAlternate,
                    ogSiteName: doc.metadata.ogSiteName,
                    sourceURL: doc.metadata.sourceURL,
                    pageStatusCode: doc.metadata.pageStatusCode ?? 200,
                  },
                };

                return {
                  data: result,
                  success: true,
                };
              } catch (error) {
                return {
                  error: `Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  success: false,
                };
              }
            },
          },
        },
      });
    },
  });
}