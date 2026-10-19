import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { RateLimitingService } from '../services/rate-limiting/rate-limiting.service';

const safeEqual = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};

/**
 * Authenticates CI/CD and in-cluster scanners. Accepts either
 *   X-Webhook-Secret: <WEBHOOK_SECRET>
 * or an HMAC of the raw body:
 *   X-Webhook-Signature: sha256=<hex(hmac_sha256(WEBHOOK_SECRET, body))>
 * and applies the Redis token-bucket limiter per source IP.
 */
@Injectable()
export class WebhookGuard implements CanActivate {
  constructor(private readonly rateLimiter: RateLimitingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    const res = context.switchToHttp().getResponse<Response>();
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) throw new UnauthorizedException('Webhooks are disabled (WEBHOOK_SECRET not set)');

    const given = req.header('x-webhook-secret');
    const signature = req.header('x-webhook-signature');
    let ok = Boolean(given && safeEqual(given, secret));
    if (!ok && signature && req.rawBody) {
      const expected = `sha256=${createHmac('sha256', secret).update(req.rawBody).digest('hex')}`;
      ok = safeEqual(signature, expected);
    }
    if (!ok) throw new UnauthorizedException('Invalid webhook secret or signature');

    const { allowed, remaining } = await this.rateLimiter.consume(`webhook:${req.ip}`);
    res.setHeader('X-Webhook-RateLimit-Remaining', String(remaining));
    if (!allowed) throw new HttpException('Webhook rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    return true;
  }
}
