/**
 * Rate Limiting Service for SecureDeploy
 * Token bucket algorithm, per key, stored in Redis (atomic Lua script so concurrent requests
 * cannot overspend). Fails open when Redis is unavailable; the global throttler still applies.
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { createRedis } from '../cache/cache.service';

// KEYS[1]=bucket key, ARGV: capacity, refill/sec, now(ms), requested. Returns {allowed, tokens}.
const TOKEN_BUCKET_LUA = `
local b = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local cap = tonumber(ARGV[1]); local rate = tonumber(ARGV[2]); local now = tonumber(ARGV[3]); local req = tonumber(ARGV[4])
local tokens = tonumber(b[1]) or cap
local ts = tonumber(b[2]) or now
tokens = math.min(cap, tokens + ((now - ts) / 1000) * rate)
local allowed = 0
if tokens >= req then tokens = tokens - req; allowed = 1 end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', KEYS[1], math.ceil(cap / rate * 1000) + 1000)
return {allowed, math.floor(tokens)}
`;

@Injectable()
export class RateLimitingService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitingService.name);
  private redis: Redis;
  readonly bucketCapacity = parseInt(process.env.RATE_LIMIT_BUCKET_CAPACITY || '100', 10);
  readonly refillRate = parseFloat(process.env.RATE_LIMIT_REFILL_RATE || '1'); // tokens per second

  constructor() {
    this.redis = createRedis();
    this.redis.on('error', () => undefined);
  }

  async consume(key: string, tokensRequested = 1): Promise<{ allowed: boolean; remaining: number }> {
    if (this.redis.status !== 'ready') return { allowed: true, remaining: this.bucketCapacity };
    try {
      const [allowed, remaining] = (await this.redis.eval(
        TOKEN_BUCKET_LUA, 1, `rate_limit:${key}`, this.bucketCapacity, this.refillRate, Date.now(), tokensRequested,
      )) as [number, number];
      return { allowed: allowed === 1, remaining };
    } catch (err) {
      this.logger.warn(`rate limiter failing open: ${(err as Error).message}`);
      return { allowed: true, remaining: this.bucketCapacity };
    }
  }

  async isAllowed(key: string, tokensRequested = 1): Promise<boolean> {
    return (await this.consume(key, tokensRequested)).allowed;
  }

  async getRemainingTokens(key: string): Promise<number> {
    return (await this.consume(key, 0)).remaining;
  }

  async resetBucket(key: string): Promise<void> {
    if (this.redis.status === 'ready') await this.redis.del(`rate_limit:${key}`).catch(() => undefined);
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
