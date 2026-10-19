/**
 * Error Handling Service for SecureDeploy
 * Retry with exponential backoff, circuit breaker and timeout, composable into one policy.
 * Settings come from ERROR_HANDLING_* environment variables.
 */
import { Injectable } from '@nestjs/common';

export class CircuitOpenError extends Error {
  constructor() {
    super('Circuit breaker is open');
  }
}

@Injectable()
export class ErrorHandlingService {
  private retryCount = parseInt(process.env.ERROR_HANDLING_RETRY_COUNT || '3', 10);
  private exceptionsAllowedBeforeBreaking = parseInt(process.env.ERROR_HANDLING_EXCEPTIONS_BEFORE_BREAKING || '5', 10);
  private breakDuration = parseInt(process.env.ERROR_HANDLING_BREAK_DURATION || '60000', 10);
  private timeoutDuration = parseInt(process.env.ERROR_HANDLING_TIMEOUT || '30000', 10);
  private circuitState: 'closed' | 'open' | 'half-open' = 'closed';
  private circuitOpenedAt: number | null = null;
  private failureCount = 0;

  async executeWithRetry<T>(operation: () => Promise<T>, retries = this.retryCount): Promise<T> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (error instanceof CircuitOpenError) break; // retrying an open circuit is pointless
        if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt)));
      }
    }
    throw lastError;
  }

  async executeWithCircuitBreaker<T>(operation: () => Promise<T>): Promise<T> {
    this.checkCircuitState();
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  async executeWithTimeout<T>(operation: () => Promise<T>, timeoutMs = this.timeoutDuration): Promise<T> {
    let timer: NodeJS.Timeout;
    return Promise.race([
      operation().finally(() => clearTimeout(timer)),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
  }

  /** Timeout inside circuit breaker inside retry. */
  async executeWithResilience<T>(operation: () => Promise<T>, opts: { retries?: number; timeoutMs?: number } = {}): Promise<T> {
    return this.executeWithRetry(() => this.executeWithCircuitBreaker(() => this.executeWithTimeout(operation, opts.timeoutMs)), opts.retries);
  }

  getCircuitState(): string {
    return this.circuitState;
  }

  resetCircuitBreaker(): void {
    this.circuitState = 'closed';
    this.circuitOpenedAt = null;
    this.failureCount = 0;
  }

  isolateCircuitBreaker(): void {
    this.circuitState = 'open';
    this.circuitOpenedAt = Date.now();
  }

  private checkCircuitState(): void {
    if (this.circuitState === 'open' && this.circuitOpenedAt) {
      if (Date.now() - this.circuitOpenedAt > this.breakDuration) this.circuitState = 'half-open';
      else throw new CircuitOpenError();
    }
  }

  private onSuccess(): void {
    this.circuitState = 'closed';
    this.failureCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    if (this.circuitState === 'half-open' || this.failureCount >= this.exceptionsAllowedBeforeBreaking) {
      this.circuitState = 'open';
      this.circuitOpenedAt = Date.now();
    }
  }
}
