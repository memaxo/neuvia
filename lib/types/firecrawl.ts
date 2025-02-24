export type AllowedTools = 'deepResearch' | 'search' | 'extract' | 'scrape';

export interface SearchResult {
  title: string;
  url: string;
  description?: string;
  source?: string;
  favicon?: string;
}

export interface ExtractResult {
  url: string;
  data: any;
}

export interface ScrapeResult {
  url: string;
  data: string;
  title?: string;
}

export interface FirecrawlResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
}

export const firecrawlTools: AllowedTools[] = ['search', 'extract', 'scrape']; 