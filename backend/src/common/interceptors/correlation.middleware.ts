import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { StructuredLoggingService } from '../services/structured-logging/structured-logging.service';

/** Binds a correlation id to the request (incoming X-Correlation-Id or a new one) and logs the request. */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private readonly logging: StructuredLoggingService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = req.header('x-correlation-id') || StructuredLoggingService.createCorrelationId();
    res.setHeader('X-Correlation-Id', correlationId);
    const started = Date.now();
    this.logging.runWithContext({ correlationId, ipAddress: req.ip, userAgent: req.header('user-agent') }, () => {
      res.on('finish', () => {
        if (req.originalUrl.endsWith('/health')) return;
        this.logging.logInformation('request', { method: req.method, path: req.originalUrl, status: res.statusCode, durationMs: Date.now() - started });
      });
      next();
    });
  }
}
