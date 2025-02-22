import type { SearchProviders } from "../configuration";
import type { SearchResult } from "../state";

import type { SearchClient} from "./search-client";
import { TavilyClient, PerplexityClient } from "./search-client";

/**
 * Simple rate limiter implementation
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor({ maxRequests, perSeconds }: { maxRequests: number; perSeconds: number }) {
    this.maxTokens = maxRequests;
    this.tokens = maxRequests;
    this.lastRefill = Date.now();
    this.refillRate = perSeconds * 1000; // Convert to milliseconds
  }

  async waitForToken(): Promise<void> {
    this.refillTokens();
    if (this.tokens <= 0) {
      const waitTime = this.refillRate / this.maxTokens;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.refillTokens();
    }
    this.tokens--;
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const newTokens = Math.floor(timePassed / this.refillRate) * this.maxTokens;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }
}

/**
 * Search service errors
 */
export class SearchError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "SearchError";
  }
}

/**
 * Search repository implementation
 */
export class SearchRepository {
  private readonly client: SearchClient;
  private readonly rateLimiter: RateLimiter;

  constructor(
    provider: keyof typeof SearchProviders,
    rateLimits: { maxRequests: number; perSeconds: number }
  ) {
    const envKey = `${provider.toUpperCase()}_API_KEY`;
    const apiKey = process.env[envKey] ?? "";
    
    if (!apiKey) {
      throw new SearchError(
        `Missing ${envKey} environment variable`,
        provider
      );
    }

    this.client = this.createClient(provider, apiKey);
    this.rateLimiter = new RateLimiter(rateLimits);
  }

  private createClient(provider: keyof typeof SearchProviders, apiKey: string): SearchClient {
    switch (provider) {
      case "TAVILY":
        return new TavilyClient(apiKey);
      case "PERPLEXITY":
        return new PerplexityClient(apiKey);
      default:
        throw new SearchError(
          `Unsupported search provider: ${provider}`,
          provider
        );
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    await this.rateLimiter.waitForToken();
    
    try {
      return await this.client.search(query);
    } catch (error) {
      throw new SearchError(
        "Search operation failed",
        this.client.constructor.name,
        error
      );
    }
  }
} 