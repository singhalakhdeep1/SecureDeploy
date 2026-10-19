import { Module } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { ReportingController } from './reporting.controller';
import { ComplianceModule } from '../compliance/compliance.module';

@Module({
  imports: [ComplianceModule],
  controllers: [ReportingController],
  providers: [ReportingService],
})
export class ReportingModule {}
