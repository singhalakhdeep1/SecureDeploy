import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class ScansService {
  async runGrypeScan(image: string) {
    try {
      const { stdout } = await execAsync(`grype ${image} -o json`);
      const results = JSON.parse(stdout);
      const critical = results.matches.filter(
        (m: any) => m.vulnerability.severity === 'Critical',
      );
      return {
        totalMatches: results.matches.length,
        criticalCount: critical.length,
        criticalVulnerabilities: critical,
        scannedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Grype scan failed: ${error.message}`);
    }
  }

  async generateSbom(image: string) {
    try {
      const { stdout } = await execAsync(`syft ${image} -o spdx-json`);
      return stdout;
    } catch (error) {
      throw new Error(`SBOM generation failed: ${error.message}`);
    }
  }

  async runTrivyScan(image: string) {
    try {
      const { stdout } = await execAsync(`trivy image ${image} -f json`);
      const results = JSON.parse(stdout);
      const critical = results.Results[0]?.Vulnerabilities?.filter(
        (v: any) => v.Severity === 'CRITICAL',
      ) || [];
      return {
        totalVulnerabilities: results.Results[0]?.Vulnerabilities?.length || 0,
        criticalCount: critical.length,
        criticalVulnerabilities: critical,
        scannedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Trivy scan failed: ${error.message}`);
    }
  }
}
