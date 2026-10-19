import { Module } from '@nestjs/common';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';
import { SbomService } from './sbom.service';
import { FindingsModule } from '../findings/findings.module';

@Module({
  imports: [FindingsModule],
  controllers: [ScansController],
  providers: [ScansService, SbomService],
  exports: [ScansService, SbomService],
})
export class ScansModule {}
