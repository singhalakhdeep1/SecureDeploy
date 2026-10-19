import { Global, Module } from '@nestjs/common';
import { CacheService } from './services/cache/cache.service';
import { RateLimitingService } from './services/rate-limiting/rate-limiting.service';
import { StructuredLoggingService } from './services/structured-logging/structured-logging.service';
import { ErrorHandlingService } from './services/error-handling/error-handling.service';

@Global()
@Module({
  providers: [CacheService, RateLimitingService, StructuredLoggingService, ErrorHandlingService],
  exports: [CacheService, RateLimitingService, StructuredLoggingService, ErrorHandlingService],
})
export class CommonModule {}
