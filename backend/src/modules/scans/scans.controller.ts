import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ScansService, assertImageRef } from './scans.service';
import { SbomService } from './sbom.service';
import { ScanRequest, SbomUploadDto } from './dto/scan-request.dto';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth/decorators';
import { ErrorHandlingService } from '../../common/services/error-handling/error-handling.service';
import { FindingsService } from '../findings/findings.service';

const SCAN_TIMEOUT = parseInt(process.env.SCAN_TIMEOUT_MS || '600000', 10);

@ApiTags('scans')
@Controller('scans')
@ApiBearerAuth()
export class ScansController {
  constructor(
    private readonly scansService: ScansService,
    private readonly sboms: SbomService,
    private readonly findings: FindingsService,
    private readonly resilience: ErrorHandlingService,
  ) {}

  private validate(image: string) {
    try {
      assertImageRef(image);
    } catch (err) {
      throw new HttpException({ error: (err as Error).message }, HttpStatus.BAD_REQUEST);
    }
  }

  private failure(error: Error): never {
    const missing = /not found|not recognized|ENOENT/i.test(error.message);
    throw new HttpException(
      { error: missing ? 'Scanner binary is not installed on the API host' : 'Scan failed', details: error.message },
      missing ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /** Runs grype; with `service`, the matches are ingested as findings (full scan for that tool). */
  @Post('grype')
  @Roles('ADMIN', 'SECURITY_LEAD')
  @ApiOperation({ summary: 'Scan an image with Grype (422 when critical vulnerabilities are found)' })
  async grypeScan(@Body() body: ScanRequest, @CurrentUser() user: AuthUser) {
    this.validate(body.image);
    let result;
    try {
      result = await this.resilience.executeWithTimeout(() => this.scansService.runGrypeScan(body.image), SCAN_TIMEOUT);
    } catch (error) {
      this.failure(error as Error);
    }
    const ingest = body.service
      ? await this.findings.ingestFindings(
          { tool: 'grype', scanId: `grype-${Date.now()}`, service: body.service, environment: body.environment ?? 'production', raw: result.raw, fullScan: true },
          user.email,
        )
      : null;
    if (result.criticalCount > 0) {
      throw new HttpException(
        { error: 'Critical vulnerabilities found', criticalCount: result.criticalCount, critical: result.criticalVulnerabilities.slice(0, 50), ingest },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return { status: 'clean', matches: result.totalMatches, ingest };
  }

  @Post('trivy')
  @Roles('ADMIN', 'SECURITY_LEAD')
  @ApiOperation({ summary: 'Scan an image with Trivy and ingest the result when service is set' })
  async trivyScan(@Body() body: ScanRequest, @CurrentUser() user: AuthUser) {
    this.validate(body.image);
    let result;
    try {
      result = await this.resilience.executeWithTimeout(() => this.scansService.runTrivyScan(body.image), SCAN_TIMEOUT);
    } catch (error) {
      this.failure(error as Error);
    }
    const ingest = body.service
      ? await this.findings.ingestFindings(
          { tool: 'trivy', scanId: `trivy-${Date.now()}`, service: body.service, environment: body.environment ?? 'production', raw: result.raw, fullScan: true },
          user.email,
        )
      : null;
    return { status: result.criticalCount > 0 ? 'critical' : 'clean', vulnerabilities: result.totalVulnerabilities, criticalCount: result.criticalCount, ingest };
  }

  @Post('sbom')
  @Roles('ADMIN', 'SECURITY_LEAD')
  @ApiOperation({ summary: 'Generate an SPDX SBOM with Syft and store it' })
  async generateSbom(@Body() body: ScanRequest, @CurrentUser() user: AuthUser) {
    this.validate(body.image);
    let doc: Record<string, unknown>;
    try {
      doc = JSON.parse(await this.resilience.executeWithTimeout(() => this.scansService.generateSbom(body.image), SCAN_TIMEOUT));
    } catch (error) {
      this.failure(error as Error);
    }
    return this.sboms.store(body.image, 'spdx-json', doc, user.email, body.service);
  }

  @Post('sbom/upload')
  @Roles('ADMIN', 'SECURITY_LEAD')
  @ApiOperation({ summary: 'Store an SBOM produced elsewhere (CI, Syft CronJob)' })
  uploadSbom(@Body() body: SbomUploadDto, @CurrentUser() user: AuthUser) {
    return this.sboms.store(body.image, body.format, body.document, user.email, body.service);
  }

  @Get('sboms')
  @ApiOperation({ summary: 'List stored SBOMs' })
  listSboms(@Query('image') image?: string) {
    return this.sboms.list(image || undefined);
  }

  @Get('sboms/:id')
  @ApiOperation({ summary: 'Get a stored SBOM document' })
  getSbom(@Param('id') id: string) {
    return this.sboms.get(id);
  }
}
