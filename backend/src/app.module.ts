import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { CorrelationMiddleware } from './common/interceptors/correlation.middleware';
import { FindingsModule } from './modules/findings/findings.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { UsersModule } from './modules/users/users.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { ScansModule } from './modules/scans/scans.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AuditController } from './modules/audit/audit.controller';

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) throw new Error('JWT_SECRET must be set (at least 16 characters)');
  return secret;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '100', 10) }]),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({ secret: jwtSecret(), signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as JwtSignOptions['expiresIn'], issuer: 'securedeploy' }, verifyOptions: { issuer: 'securedeploy' } }),
    }),
    PrismaModule,
    CommonModule,
    FindingsModule,
    ComplianceModule,
    ApprovalsModule,
    UsersModule,
    ReportingModule,
    ScansModule,
    WebhooksModule,
  ],
  controllers: [AuditController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationMiddleware).forRoutes('{*splat}');
  }
}
