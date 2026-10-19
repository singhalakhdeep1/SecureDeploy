import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FindingsService } from './findings.service';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth/decorators';
import { FindingsQueryDto, IngestFindingsDto, ResolveFindingDto, UpdateFindingStatusDto } from './dto/ingest-findings.dto';

@ApiTags('findings')
@Controller('findings')
@ApiBearerAuth()
export class FindingsController {
  constructor(private readonly findingsService: FindingsService) {}

  @Post('ingest')
  @Roles('ADMIN', 'SECURITY_LEAD')
  @ApiOperation({ summary: 'Ingest security scan results (normalized findings or raw scanner JSON)' })
  ingestFindings(@Body() dto: IngestFindingsDto, @CurrentUser() user: AuthUser) {
    return this.findingsService.ingestFindings(dto, user.email);
  }

  @Get()
  @ApiOperation({ summary: 'List findings with filters and pagination' })
  findAll(@Query() query: FindingsQueryDto, @CurrentUser() user: AuthUser) {
    return this.findingsService.findAll(query, user);
  }

  @Get('stats/summary')
  @ApiOperation({ summary: 'Findings summary statistics' })
  getStats(@CurrentUser() user: AuthUser) {
    return this.findingsService.getStats(user);
  }

  @Get('stats/mttr')
  @ApiOperation({ summary: 'Mean Time To Remediate (overall and per severity)' })
  getMTTR(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.findingsService.calculateMTTR(user, days ? Number(days) : undefined);
  }

  @Get('stats/trend')
  @ApiOperation({ summary: 'New vs resolved findings per day' })
  getTrend(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.findingsService.getTrend(user, Math.min(Number(days) || 30, 365));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get finding by ID (with compliance mappings)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.findingsService.findOne(id, user);
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark finding as resolved' })
  resolve(@Param('id') id: string, @Body() dto: ResolveFindingDto, @CurrentUser() user: AuthUser) {
    return this.findingsService.resolveFinding(id, user, dto.note);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change finding status (IN_PROGRESS, RESOLVED, IGNORED, FALSE_POSITIVE, OPEN)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateFindingStatusDto, @CurrentUser() user: AuthUser) {
    return this.findingsService.updateStatus(id, dto.status, user, dto.note);
  }
}
