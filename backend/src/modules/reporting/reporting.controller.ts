import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportingService } from './reporting.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('reporting')
@Controller('reporting')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate compliance report' })
  generateReport(@Body() reportDto: any) {
    return this.reportingService.generateReport(reportDto);
  }

  @Get('download/:id')
  @ApiOperation({ summary: 'Download generated report' })
  downloadReport(@Param('id') id: string) {
    return this.reportingService.downloadReport(id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get report generation history' })
  getHistory(@Query('framework') framework?: string) {
    return this.reportingService.getHistory(framework);
  }
}
