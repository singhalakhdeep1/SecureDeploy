import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ScansService } from './scans.service';
import { ScanRequest } from './dto/scan-request.dto';

@Controller('api/scans')
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post('grype')
  async grypeScan(@Body() body: ScanRequest) {
    try {
      const result = await this.scansService.runGrypeScan(body.image);
      if (result.criticalCount > 0) {
        throw new HttpException(
          { error: 'Critical vulnerabilities found', critical: result.criticalVulnerabilities },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      return { status: 'clean', matches: result.totalMatches };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        { error: 'Scan failed', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sbom')
  async generateSbom(@Body() body: ScanRequest) {
    try {
      const sbom = await this.scansService.generateSbom(body.image);
      return JSON.parse(sbom);
    } catch (error) {
      throw new HttpException(
        { error: 'SBOM generation failed', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
