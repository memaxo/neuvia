import { Redis } from "ioredis";
import { RedisCache } from "@langchain/community/caches/ioredis";

/**
 * Cache configuration options
 */
export interface CacheConfig {
  ttl?: number;
  keyPrefix?: string;
  redisClient?: Redis;
}

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: Required<CacheConfig> = {
  ttl: 3600, // 1 hour
  keyPrefix: "research:",
  redisClient: new Redis()
};

/**
 * Enhanced cache service for research operations
 */
export class ResearchCache {
  private cache: RedisCache;
  private config: Required<CacheConfig>;

  constructor(config: CacheConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new RedisCache(
      this.config.redisClient,
      { 
        ttl: this.config.ttl,
        prefix: this.config.keyPrefix
      }
    );
  }

  /**
   * Generate a cache key incorporating all relevant parameters
   */
  private generateKey(components: Record<string, unknown>): string {
    const normalized = Object.entries(components)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
      .join("|");
    
    return `${this.config.keyPrefix}${normalized}`;
  }

  /**
   * Store a value in cache
   */
  async set(key: Record<string, unknown>, value: unknown): Promise<void> {
    const cacheKey = this.generateKey(key);
    await this.cache.write(cacheKey, JSON.stringify(value));
  }

  /**
   * Retrieve a value from cache
   */
  async get<T>(key: Record<string, unknown>): Promise<T | null> {
    const cacheKey = this.generateKey(key);
    const value = await this.cache.read(cacheKey);
    return value ? JSON.parse(value) as T : null;
  }

  /**
   * Delete a value from cache
   */
  async delete(key: Record<string, unknown>): Promise<void> {
    const cacheKey = this.generateKey(key);
    await this.cache.delete(cacheKey);
  }

  /**
   * Clear all research-related cache entries
   */
  async clear(): Promise<void> {
    const keys = await this.config.redisClient.keys(`${this.config.keyPrefix}*`);
    if (keys.length > 0) {
      await this.config.redisClient.del(...keys);
    }
  }

  /**
   * Get the underlying Redis client
   */
  getClient(): Redis {
    return this.config.redisClient;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.config.redisClient.quit();
  }
} 