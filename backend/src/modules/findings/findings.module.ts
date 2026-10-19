import { Module } from '@nestjs/common';
import { FindingsService } from './findings.service';
import { FindingsController } from './findings.controller';
import { ComplianceModule } from '../compliance/compliance.module';

@Module({
  imports: [ComplianceModule],
  controllers: [FindingsController],
  providers: [FindingsService],
  exports: [FindingsService],
})
export class FindingsModule {}
