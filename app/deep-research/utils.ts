/**
 * Utility functions for web search, source formatting, and user interaction.
 */

import { SearchQuery } from "./state";

/**
 * Represents a single search result with metadata and content.
 */
interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  raw_content?: string | null;
}

/**
 * Represents a complete search response containing the query and its results.
 */
interface SearchResponse {
  query: string;
  results: SearchResult[];
}

/**
 * Formats and deduplicates search results from multiple sources.
 * @param searchResponses - Array of search responses to process
 * @param maxTokensPerSource - Maximum number of tokens to include per source
 * @param includeRawContent - Whether to include full source content
 * @returns Formatted string containing deduplicated sources
 */
export function deduplicateAndFormatSources(
  searchResponses: SearchResponse[],
  maxTokensPerSource: number,
  includeRawContent = true
): string {
  const sourcesMap: Record<string, SearchResult> = {};

  // Deduplicate by URL
  for (const resp of searchResponses) {
    for (const sr of resp.results) {
      sourcesMap[sr.url] = sr;
    }
  }

  // Format results
  let formatted = "Clinician-Friendly Sources:\n\n";
  let counter = 1;
  for (const source of Object.values(sourcesMap)) {
    formatted += `Source ${source.title}:\n===\n`;
    formatted += `URL: ${source.url}\n===\n`;
    formatted += `Most relevant content from source: ${source.content}\n===\n`;
    if (includeRawContent) {
      const charLimit = maxTokensPerSource * 4;
      const raw = source.raw_content ?? "";
      let truncated = raw;
      if (truncated.length > charLimit) {
        truncated = truncated.slice(0, charLimit) + "... [truncated]";
      }
      formatted += `Full source content limited to ${maxTokensPerSource} tokens: ${truncated}\n\n`;
    }
    counter++;
  }
  return formatted.trim();
}

/**
 * Formats an array of sections into a readable string format.
 */
import { Section } from "./state";

export function formatSections(sections: Section[]): string {
  let out = "";
  sections.forEach((s, index) => {
    const i = index + 1;
    out += `
============================================================
Section ${i}: ${s.name}
============================================================
Description:
${s.description}
Requires Research:
${s.research ? "Yes" : "No"}

Content:
${s.content ? s.content : "[Not yet written]"}

`;
  });
  return out;
}

/**
 * Performs a web search using the Tavily API.
 * Requires TAVILY_API_KEY environment variable.
 */
export async function tavilySearchAsync(
  searchQueries: SearchQuery[]
): Promise<SearchResponse[]> {
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  if (!TAVILY_API_KEY) {
    throw new Error("Missing TAVILY_API_KEY environment variable.");
  }

  const results: SearchResponse[] = [];

  for (const queryObj of searchQueries) {
    const query = queryObj.search_query;
    const response = await fetch("https://api.tavily.com/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        max_results: 5,
        include_raw_content: true,
        topic: "general",
      }),
    });
    if (!response.ok) {
      throw new Error(`Tavily search failed: ${response.statusText}`);
    }
    const data = await response.json();
    results.push({
      query,
      results: data.results ?? [],
    });
  }

  return results;
}

/**
 * Performs a web search using the Perplexity API.
 * Requires PERPLEXITY_API_KEY environment variable.
 */
export async function perplexitySearch(
  searchQueries: SearchQuery[]
): Promise<SearchResponse[]> {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  if (!PERPLEXITY_API_KEY) {
    throw new Error("Missing PERPLEXITY_API_KEY environment variable.");
  }

  const results: SearchResponse[] = [];

  for (const queryObj of searchQueries) {
    const query = queryObj.search_query;

    const payload = {
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content: "Search the web and provide factual information with sources.",
        },
        {
          role: "user",
          content: query,
        },
      ],
    };

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Perplexity search failed: ${res.statusText}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const citations = data?.citations ?? ["https://perplexity.ai"];

    const firstResult: SearchResult = {
      title: `Perplexity Search, Source 1`,
      url: citations[0],
      content,
      raw_content: content,
      score: 1.0,
    };
    const moreResults: SearchResult[] = citations.slice(1).map((citation: string, index: number) => ({
      title: `Perplexity Search, Source ${index + 2}`,
      url: citation,
      content: "See primary source for full content",
      raw_content: null,
      score: 0.5,
    }));

    results.push({
      query,
      results: [firstResult, ...moreResults],
    });
  }

  return results;
}

/**
 * Simulates user feedback for development purposes.
 * In production, this would be replaced with actual UI interaction.
 */
export async function getHumanFeedback(prompt: string): Promise<string | boolean> {
  console.log(`(Simulated human feedback prompt) ${prompt}`);
  return true;
}