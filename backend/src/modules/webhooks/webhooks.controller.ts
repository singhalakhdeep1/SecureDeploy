import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/auth/decorators';
import { WebhookGuard } from '../../common/guards/webhook.guard';
import { FindingsService } from '../findings/findings.service';
import { IngestFindingsDto } from '../findings/dto/ingest-findings.dto';
import { ApprovalsService } from '../approvals/approvals.service';
import { WebhookDeploymentDto } from '../approvals/dto/approvals.dto';
import { SbomService } from '../scans/sbom.service';
import { SbomUploadDto } from '../scans/dto/scan-request.dto';

/**
 * Machine-to-machine endpoints for CI/CD pipelines and the in-cluster scanner CronJobs.
 * Authenticated with X-Webhook-Secret or X-Webhook-Signature (HMAC-SHA256 of the body).
 */
@ApiTags('webhooks')
@Controller('webhooks')
@Public()
@SkipThrottle()
@UseGuards(WebhookGuard)
@ApiHeader({ name: 'X-Webhook-Secret', required: false })
@ApiHeader({ name: 'X-Webhook-Signature', required: false, description: 'sha256=<hex hmac of raw body>' })
export class WebhooksController {
  constructor(
    private readonly findings: FindingsService,
    private readonly approvals: ApprovalsService,
    private readonly sboms: SbomService,
  ) {}

  @Post('findings')
  @ApiOperation({ summary: 'Ingest scan results from CI/CD or scanner jobs' })
  ingest(@Body() dto: IngestFindingsDto) {
    return this.findings.ingestFindings(dto, `webhook:${dto.tool}`);
  }

  @Post('deployments')
  @ApiOperation({ summary: 'Request a deployment approval from a pipeline (gate result included)' })
  requestDeployment(@Body() dto: WebhookDeploymentDto) {
    const { requestedBy, ...rest } = dto;
    return this.approvals.requestDeployment(rest, `pipeline:${requestedBy}`);
  }

  @Get('deployments/:id')
  @ApiOperation({ summary: 'Poll a deployment decision from a pipeline' })
  async deploymentStatus(@Param('id') id: string) {
    const d = await this.approvals.getDeploymentStatus(id);
    return { id: d.id, status: d.status, approvedBy: d.approvedBy, rejectionReason: d.rejectionReason, gateBlocked: d.gateBlocked };
  }

  @Post('deployments/:id/deployed')
  @ApiOperation({ summary: 'Pipeline reports that an approved deployment went out' })
  deployed(@Param('id') id: string) {
    return this.approvals.markDeployed(id, 'pipeline');
  }

  @Post('sbom')
  @ApiOperation({ summary: 'Store an SBOM from CI or the Syft CronJob' })
  sbom(@Body() dto: SbomUploadDto) {
    return this.sboms.store(dto.image, dto.format, dto.document, 'webhook:syft', dto.service);
  }
}
