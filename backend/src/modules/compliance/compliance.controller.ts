import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { ComplianceService } from './compliance.service';
import { Roles } from '../../common/auth/decorators';

class MapControlDto {
  @IsString() controlId: string;
}

@ApiTags('compliance')
@Controller('compliance')
@ApiBearerAuth()
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('status')
  @ApiOperation({ summary: 'Overall and per-framework compliance status' })
  getStatus(@Query('framework') framework?: string, @Query('service') service?: string) {
    return this.complianceService.getComplianceStatus(framework || undefined, service || undefined);
  }

  @Get('frameworks')
  @ApiOperation({ summary: 'Supported compliance frameworks' })
  getFrameworks() {
    return this.complianceService.getFrameworks();
  }

  @Get('controls')
  @ApiOperation({ summary: 'Controls of a framework with open finding counts' })
  getControls(@Query('framework') framework: string, @Query('service') service?: string) {
    return this.complianceService.getControls(framework, service || undefined);
  }

  @Get('mapping')
  @ApiOperation({ summary: 'Control mappings of a finding' })
  getMapping(@Query('findingId') findingId: string) {
    return this.complianceService.getFindingMapping(findingId);
  }

  @Post('mapping/:findingId')
  @Roles('ADMIN', 'SECURITY_LEAD')
  @ApiOperation({ summary: 'Manually map a finding to a control' })
  mapControl(@Param('findingId') findingId: string, @Body() dto: MapControlDto) {
    return this.complianceService.mapFindingToControl(findingId, dto.controlId);
  }

  @Get('score')
  @ApiOperation({ summary: 'Compliance score for a framework (optionally per service)' })
  getScore(@Query('framework') framework: string, @Query('service') service?: string) {
    return this.complianceService.calculateScore(framework, service || undefined);
  }
}
