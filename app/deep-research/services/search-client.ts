import type { SearchResult } from "../state";

/**
 * Interface for search provider clients
 */
export interface SearchClient {
  search(query: string): Promise<SearchResult[]>;
}

/**
 * Tavily search client implementation
 */
export class TavilyClient implements SearchClient {
  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error("Tavily API key is required");
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    const response = await fetch("https://api.tavily.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        max_results: 5,
        include_raw_content: true
      })
    });

    if (!response.ok) {
      throw new Error(`Tavily search failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results?.map((result: any) => ({
      title: result.title,
      url: result.url,
      content: result.content,
      score: result.relevancy_score
    })) ?? [];
  }
}

/**
 * Perplexity search client implementation
 */
export class PerplexityClient implements SearchClient {
  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error("Perplexity API key is required");
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: "Search the web and provide factual information with sources."
          },
          {
            role: "user",
            content: query
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity search failed: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const citations = data?.citations ?? ["https://perplexity.ai"];

    return [
      {
        title: "Perplexity Search Result",
        url: citations[0],
        content: content ?? "",
        score: 1.0
      },
      ...citations.slice(1).map((citation: string, index: number) => ({
        title: `Additional Source ${index + 2}`,
        url: citation,
        content: "See primary source",
        score: 0.5
      }))
    ];
  }
} 