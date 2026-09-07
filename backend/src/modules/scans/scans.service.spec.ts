jest.mock('child_process', () => ({ exec: jest.fn() }));

import { exec } from 'child_process';
import { ScansService } from './scans.service';

const mockExec = exec as unknown as jest.Mock;

describe('ScansService', () => {
    let service: ScansService;

    beforeEach(() => {
        service = new ScansService();
        mockExec.mockReset();
    });

    describe('runGrypeScan', () => {
        it('parses grype JSON output and separates critical vulnerabilities', async () => {
            const grypeOutput = JSON.stringify({
                matches: [
                    { vulnerability: { severity: 'Critical', id: 'CVE-1' } },
                    { vulnerability: { severity: 'Low', id: 'CVE-2' } },
                ],
            });
            mockExec.mockImplementation((_cmd, cb) => cb(null, grypeOutput, ''));

            const result = await service.runGrypeScan('my-image:latest');

            expect(result.totalMatches).toBe(2);
            expect(result.criticalCount).toBe(1);
            expect(result.criticalVulnerabilities[0].vulnerability.id).toBe('CVE-1');
            expect(result.scannedAt).toBeInstanceOf(Date);
        });

        it('throws a descriptive error when the grype binary fails', async () => {
            mockExec.mockImplementation((_cmd, cb) => cb(new Error('grype: command not found'), '', ''));

            await expect(service.runGrypeScan('my-image:latest')).rejects.toThrow('Grype scan failed');
        });
    });

    describe('generateSbom', () => {
        it('returns the raw SBOM output from syft', async () => {
            mockExec.mockImplementation((_cmd, cb) => cb(null, '{"spdxVersion":"SPDX-2.3"}', ''));

            const sbom = await service.generateSbom('my-image:latest');

            expect(sbom).toBe('{"spdxVersion":"SPDX-2.3"}');
        });

        it('throws a descriptive error when syft fails', async () => {
            mockExec.mockImplementation((_cmd, cb) => cb(new Error('syft: command not found'), '', ''));

            await expect(service.generateSbom('my-image:latest')).rejects.toThrow('SBOM generation failed');
        });
    });

    describe('runTrivyScan', () => {
        it('parses trivy JSON output and separates critical vulnerabilities', async () => {
            const trivyOutput = JSON.stringify({
                Results: [
                    {
                        Vulnerabilities: [
                            { Severity: 'CRITICAL', VulnerabilityID: 'CVE-3' },
                            { Severity: 'MEDIUM', VulnerabilityID: 'CVE-4' },
                        ],
                    },
                ],
            });
            mockExec.mockImplementation((_cmd, cb) => cb(null, trivyOutput, ''));

            const result = await service.runTrivyScan('my-image:latest');

            expect(result.totalVulnerabilities).toBe(2);
            expect(result.criticalCount).toBe(1);
        });
    });
});
