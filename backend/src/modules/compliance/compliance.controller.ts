import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('compliance')
@Controller('compliance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get overall compliance status' })
  getStatus(@Query('framework') framework?: string) {
    return this.complianceService.getComplianceStatus(framework);
  }

  @Get('frameworks')
  @ApiOperation({ summary: 'Get all compliance frameworks' })
  getFrameworks() {
    return this.complianceService.getFrameworks();
  }

  @Get('controls')
  @ApiOperation({ summary: 'Get controls by framework' })
  getControls(@Query('framework') framework: string) {
    return this.complianceService.getControls(framework);
  }

  @Get('mapping')
  @ApiOperation({ summary: 'Get finding to compliance mapping' })
  getMapping(@Query('findingId') findingId: string) {
    return this.complianceService.getFindingMapping(findingId);
  }

  @Get('score')
  @ApiOperation({ summary: 'Calculate compliance score' })
  getScore(@Query('framework') framework: string, @Query('service') service?: string) {
    return this.complianceService.calculateScore(framework, service);
  }
}
