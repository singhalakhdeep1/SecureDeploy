import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportingService } from './reporting.service';
import { CurrentUser, type AuthUser } from '../../common/auth/decorators';
import { GenerateReportDto } from './dto/report.dto';

@ApiTags('reporting')
@Controller('reporting')
@ApiBearerAuth()
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a PDF compliance report for a framework and period' })
  generateReport(@Body() dto: GenerateReportDto, @CurrentUser() user: AuthUser) {
    return this.reportingService.generateReport(dto, user);
  }

  @Get('download/:id')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Download a generated report (PDF)' })
  async downloadReport(@Param('id') id: string, @Res() res: Response) {
    const report = await this.reportingService.downloadReport(id);
    const name = `${report.title.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}-${report.generatedAt.toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(Buffer.from(report.pdf!));
  }

  @Get('history')
  @ApiOperation({ summary: 'Report generation history' })
  getHistory(@Query('framework') framework?: string) {
    return this.reportingService.getHistory(framework || undefined);
  }
}
