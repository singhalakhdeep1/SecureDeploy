/**
 * Cache Service for SecureDeploy
 * Distributed caching with Redis (get/set/delete, TTL, get-or-set, pattern invalidation).
 * Every call degrades to a cache miss when Redis is unavailable, so Redis is never a hard dependency.
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

export function createRedis(): Redis {
  const opts = { lazyConnect: false, maxRetriesPerRequest: 1, enableOfflineQueue: false, retryStrategy: (n: number) => Math.min(n * 500, 5000) };
  return process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, opts)
    : new Redis({ host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379', 10), ...opts });
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis;
  private defaultTTL = parseInt(process.env.CACHE_TTL_SECONDS || '60', 10);

  constructor() {
    this.redis = createRedis();
    this.redis.on('error', (err) => this.logger.warn(`Redis unavailable: ${err.message}`));
  }

  get ready(): boolean {
    return this.redis.status === 'ready';
  }

  async get(key: string): Promise<string | null> {
    if (!this.ready) return null;
    try {
      return await this.redis.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.ready) return;
    try {
      await this.redis.setex(key, ttl || this.defaultTTL, value);
    } catch {
      // ignore
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.ready) return;
    try {
      await this.redis.del(key);
    } catch {
      // ignore
    }
  }

  async getOrSet(key: string, factory: () => Promise<string>, ttl?: number): Promise<string> {
    const cachedValue = await this.get(key);
    if (cachedValue !== null) return cachedValue;
    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /** JSON convenience wrapper around getOrSet. */
  async getOrSetJson<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    return JSON.parse(await this.getOrSet(key, async () => JSON.stringify(await factory()), ttl)) as T;
  }

  /** Deletes keys matching a glob pattern (SCAN-based, safe on large keyspaces). */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.ready) return;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = next;
        if (keys.length > 0) await this.redis.del(...keys);
      } while (cursor !== '0');
    } catch {
      // ignore
    }
  }

  async ping(): Promise<string> {
    if (!this.ready) return 'disconnected';
    try {
      return (await this.redis.ping()) === 'PONG' ? 'connected' : 'disconnected';
    } catch {
      return 'disconnected';
    }
  }

  async onModuleDestroy() {
    this.redis.disconnect();
  }
}
