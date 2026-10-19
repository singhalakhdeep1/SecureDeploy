import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

/**
 * Container image reference: [registry[:port]/]repo[/repo...][:tag][@sha256:digest].
 * Only these characters reach the shell, so the command line cannot be injected into.
 */
const IMAGE_REF = /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[0-9]{1,5})?(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[A-Za-z0-9_][A-Za-z0-9._-]{0,127})?(?:@sha256:[a-f0-9]{64})?$/;

export function assertImageRef(image: string): void {
  if (typeof image !== 'string' || image.length > 255 || !IMAGE_REF.test(image)) {
    throw new Error(`Invalid image reference "${String(image).slice(0, 80)}"`);
  }
}

/**
 * Runs a scanner CLI. Scanners write their JSON to a temp file (avoids exec's stdout buffer limit
 * for large reports); if the file is not there, stdout is used.
 */
async function runScanner(command: string, outFile?: string): Promise<string> {
  try {
    const out: unknown = await execAsync(command);
    const stdout = typeof out === 'string' ? out : (out as { stdout: string }).stdout;
    if (outFile && existsSync(outFile)) return readFileSync(outFile, 'utf8');
    return stdout;
  } finally {
    if (outFile && existsSync(outFile)) unlinkSync(outFile);
  }
}

const tmpFile = (tool: string) => join(tmpdir(), `securedeploy-${tool}-${randomUUID()}.json`);

@Injectable()
export class ScansService {
  async runGrypeScan(image: string) {
    try {
      assertImageRef(image);
      const file = tmpFile('grype');
      const results = JSON.parse(await runScanner(`grype ${image} -o json --file ${file}`, file));
      const matches = results.matches ?? [];
      const critical = matches.filter((m: { vulnerability: { severity: string } }) => m.vulnerability.severity === 'Critical');
      return {
        totalMatches: matches.length,
        criticalCount: critical.length,
        criticalVulnerabilities: critical,
        raw: results,
        scannedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Grype scan failed: ${(error as Error).message}`);
    }
  }

  async generateSbom(image: string) {
    try {
      assertImageRef(image);
      const file = tmpFile('syft');
      return await runScanner(`syft ${image} -o spdx-json=${file}`, file);
    } catch (error) {
      throw new Error(`SBOM generation failed: ${(error as Error).message}`);
    }
  }

  async runTrivyScan(image: string) {
    try {
      assertImageRef(image);
      const file = tmpFile('trivy');
      const results = JSON.parse(await runScanner(`trivy image ${image} -f json -o ${file}`, file));
      const vulns = (results.Results ?? []).flatMap((r: { Vulnerabilities?: { Severity: string }[] }) => r.Vulnerabilities ?? []);
      const critical = vulns.filter((v: { Severity: string }) => v.Severity === 'CRITICAL');
      return {
        totalVulnerabilities: vulns.length,
        criticalCount: critical.length,
        criticalVulnerabilities: critical,
        raw: results,
        scannedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Trivy scan failed: ${(error as Error).message}`);
    }
  }
}
