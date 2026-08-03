/**
 * Error Handling Service for SecureDeploy
 * Implements retry, circuit breaker, and timeout patterns
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class ErrorHandlingService {
  private retryCount: number = 3;
  private exceptionsAllowedBeforeBreaking: number = 5;
  private breakDuration: number = 60000; // 1 minute
  private timeoutDuration: number = 30000; // 30 seconds
  private circuitState: string = 'closed';
  private circuitOpenedAt: number | null = null;
  private failureCount: number = 0;

  async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any = null;

    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < this.retryCount) {
          const delay = 100 * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
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

  async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Operation timed out'));
      }, this.timeoutDuration);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  async executeWithResilience<T>(operation: () => Promise<T>): Promise<T> {
    const circuitBreakerOp = () => this.executeWithCircuitBreaker(operation);
    return await this.executeWithRetry(circuitBreakerOp);
  }

  getCircuitState(): string {
    return this.circuitState;
  }

  resetCircuitBreaker(): void {
    this.circuitState = 'closed';
    this.circuitOpenedAt = null;
  }

  isolateCircuitBreaker(): void {
    this.circuitState = 'open';
    this.circuitOpenedAt = Date.now();
  }

  private checkCircuitState(): void {
    if (this.circuitState === 'open' && this.circuitOpenedAt) {
      if (Date.now() - this.circuitOpenedAt > this.breakDuration) {
        this.circuitState = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
  }

  private onSuccess(): void {
    if (this.circuitState === 'half-open') {
      this.circuitState = 'closed';
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;

    if (this.failureCount >= this.exceptionsAllowedBeforeBreaking) {
      this.circuitState = 'open';
      this.circuitOpenedAt = Date.now();
    }
  }
}
