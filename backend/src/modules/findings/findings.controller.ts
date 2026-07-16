import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FindingsService } from './findings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('findings')
@Controller('findings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FindingsController {
  constructor(private readonly findingsService: FindingsService) {}

  @Post('ingest')
  @ApiOperation({ summary: 'Ingest security scan results from CI/CD pipeline' })
  ingestFindings(@Body() ingestDto: any) {
    return this.findingsService.ingestFindings(ingestDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all findings with filters' })
  findAll(
    @Query('service') service?: string,
    @Query('environment') environment?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
  ) {
    return this.findingsService.findAll({ service, environment, severity, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get finding by ID' })
  findOne(@Param('id') id: string) {
    return this.findingsService.findOne(id);
  }

  @Post(':id/resolve')
  @ApiOperation({ summary: 'Mark finding as resolved' })
  resolve(@Param('id') id: string, @Body('resolvedBy') resolvedBy: string) {
    return this.findingsService.resolveFinding(id, resolvedBy);
  }

  @Get('stats/summary')
  @ApiOperation({ summary: 'Get findings summary statistics' })
  getStats() {
    return this.findingsService.getStats();
  }

  @Get('stats/mttr')
  @ApiOperation({ summary: 'Calculate Mean Time To Remediate' })
  getMTTR() {
    return this.findingsService.calculateMTTR();
  }
}
