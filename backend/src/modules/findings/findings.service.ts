import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class FindingsService {
  constructor(private prisma: PrismaService) {}

  async ingestFindings(ingestDto: any) {
    const { tool, scanId, service, environment, findings } = ingestDto;

    // Normalize findings from different tools
    const normalizedFindings = findings.map((finding: any) => ({
      tool,
      scanId,
      service,
      environment,
      severity: this.normalizeSeverity(finding.severity),
      title: finding.title || finding.description?.substring(0, 100),
      description: finding.description || finding.message,
      filePath: finding.filePath || finding.path,
      lineNumber: finding.lineNumber || finding.line,
      cveId: finding.cveId || finding.id,
      cvssScore: finding.cvssScore || finding.score,
      remediation: finding.remediation || finding.fix,
    }));

    // Bulk insert findings
    const created = await this.prisma.finding.createMany({
      data: normalizedFindings,
      skipDuplicates: true,
    });

    // Trigger compliance mapping
    await this.mapToCompliance(normalizedFindings);

    return {
      success: true,
      ingested: created.count,
      scanId,
    };
  }

  private normalizeSeverity(severity: string): string {
    const severityMap: Record<string, string> = {
      critical: 'CRITICAL',
      high: 'HIGH',
      medium: 'MEDIUM',
      low: 'LOW',
      info: 'INFO',
      error: 'CRITICAL',
      warning: 'HIGH',
    };
    return severityMap[severity?.toLowerCase()] || 'MEDIUM';
  }

  private async mapToCompliance(findings: any[]) {
    // Map findings to compliance frameworks
    const mappings = findings.flatMap((finding) => {
      if (finding.severity === 'CRITICAL' || finding.severity === 'HIGH') {
        return [
          {
            findingId: finding.id,
            framework: 'RBI_CYBERSECURITY',
            controlId: 'VULN_MGMT',
            controlTitle: 'Vulnerability Management',
            clause: 'Identify and remediate security vulnerabilities',
            riskScore: finding.severity === 'CRITICAL' ? 90 : 70,
          },
        ];
      }
      return [];
    });

    // This would be implemented with actual finding IDs after insertion
    // For now, this is a placeholder for the compliance mapping logic
  }

  async findAll(filters: any) {
    const where: any = {};
    if (filters.service) where.service = filters.service;
    if (filters.environment) where.environment = filters.environment;
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;

    return this.prisma.finding.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string) {
    return this.prisma.finding.findUnique({
      where: { id },
      include: {
        complianceMappings: true,
      },
    });
  }

  async resolveFinding(id: string, resolvedBy: string) {
    return this.prisma.finding.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy,
      },
    });
  }

  async getStats() {
    const [total, bySeverity, byStatus, byService] = await Promise.all([
      this.prisma.finding.count(),
      this.prisma.finding.groupBy({
        by: ['severity'],
        _count: true,
      }),
      this.prisma.finding.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.finding.groupBy({
        by: ['service'],
        _count: true,
      }),
    ]);

    return {
      total,
      bySeverity,
      byStatus,
      byService,
    };
  }

  async calculateMTTR() {
    const resolvedFindings = await this.prisma.finding.findMany({
      where: { status: 'RESOLVED', resolvedAt: { not: null } },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    if (resolvedFindings.length === 0) {
      return { mttrHours: 0, sampleSize: 0 };
    }

    const totalHours = resolvedFindings.reduce((sum, finding) => {
      const hours = (finding.resolvedAt!.getTime() - finding.createdAt.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);

    return {
      mttrHours: totalHours / resolvedFindings.length,
      sampleSize: resolvedFindings.length,
    };
  }
}
