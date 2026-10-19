/**
 * Structured Logging Service for SecureDeploy
 * JSON log lines carrying a per-request correlation id and user context (AsyncLocalStorage),
 * plus audit events that are also persisted to the audit_events table.
 */
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface LogContext {
  correlationId: string;
  userId?: string;
  userEmail?: string;
  deploymentId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context: LogContext;
  additionalContext?: Record<string, unknown>;
  error?: string;
}

const storage = new AsyncLocalStorage<LogContext>();

@Injectable()
export class StructuredLoggingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Runs fn with the given context bound to everything it awaits. */
  runWithContext<T>(context: LogContext, fn: () => T): T {
    return storage.run(context, fn);
  }

  setContext(context: Partial<LogContext>): void {
    const current = storage.getStore();
    if (current) Object.assign(current, context);
  }

  getContext(): LogContext | null {
    return storage.getStore() ?? null;
  }

  logInformation(message: string, additionalContext?: Record<string, unknown>): void {
    process.stdout.write(JSON.stringify(this.createLogEntry('Information', message, additionalContext)) + '\n');
  }

  logWarning(message: string, additionalContext?: Record<string, unknown>): void {
    process.stdout.write(JSON.stringify(this.createLogEntry('Warning', message, additionalContext)) + '\n');
  }

  logError(message: string, error: string, additionalContext?: Record<string, unknown>): void {
    process.stderr.write(JSON.stringify(this.createLogEntry('Error', message, additionalContext, error)) + '\n');
  }

  /** Logs and persists an audit event (who did what to which entity). */
  async logAuditEvent(
    eventType: string,
    description: string,
    additionalContext: { actor?: string; entityType?: string; entityId?: string; [k: string]: unknown } = {},
  ): Promise<void> {
    const ctx = this.getContext();
    const { actor, entityType, entityId, ...details } = additionalContext;
    process.stdout.write(
      JSON.stringify(this.createLogEntry('Audit', `AUDIT: ${description}`, { auditEventType: eventType, ...additionalContext })) + '\n',
    );
    await this.prisma.auditEvent
      .create({
        data: {
          actor: actor ?? ctx?.userEmail ?? 'system',
          action: eventType,
          entityType: entityType ?? eventType.split('.')[0],
          entityId: entityId ?? null,
          correlationId: ctx?.correlationId,
          details: { description, ...details } as object,
        },
      })
      .catch((err) => this.logError('audit persist failed', (err as Error).message));
  }

  static createCorrelationId(): string {
    return randomUUID();
  }

  private createLogEntry(level: string, message: string, additionalContext?: Record<string, unknown>, error?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.getContext() ?? { correlationId: StructuredLoggingService.createCorrelationId() },
      additionalContext,
      error,
    };
  }
}
