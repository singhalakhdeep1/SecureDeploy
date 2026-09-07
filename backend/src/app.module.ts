import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { FindingsModule } from './modules/findings/findings.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { UsersModule } from './modules/users/users.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { ScansModule } from './modules/scans/scans.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    FindingsModule,
    ComplianceModule,
    ApprovalsModule,
    UsersModule,
    ReportingModule,
    ScansModule,
  ],
})
export class AppModule { }
