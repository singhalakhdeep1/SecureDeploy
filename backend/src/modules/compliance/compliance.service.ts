import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ComplianceFramework, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/services/cache/cache.service';
import { CONTROLS, FRAMEWORKS, RISK_BY_SEVERITY, controlById, controlsFor, mapFinding } from './catalog';

const OPEN_STATUSES = ['OPEN', 'IN_PROGRESS'] as const;

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService, private readonly cache: CacheService) {}

  private framework(framework: string): ComplianceFramework {
    const f = framework?.toUpperCase();
    if (!FRAMEWORKS.some((x) => x.id === f)) throw new BadRequestException(`Unknown framework ${framework}. Use one of ${FRAMEWORKS.map((x) => x.id).join(', ')}`);
    return f as ComplianceFramework;
  }

  getFrameworks() {
    return FRAMEWORKS.map((f) => ({ ...f, controls: controlsFor(f.id).map((c) => c.id) }));
  }

  /** Controls of a framework with their mapped finding counts. */
  async getControls(framework: string, service?: string) {
    const fw = this.framework(framework);
    const rows = await this.prisma.complianceMapping.groupBy({
      by: ['controlId'],
      where: { framework: fw, finding: { status: { in: [...OPEN_STATUSES] }, ...(service ? { service } : {}) } },
      _count: { _all: true },
      _max: { riskScore: true },
    });
    const open = new Map(rows.map((r) => [r.controlId, { count: r._count._all, maxRisk: r._max.riskScore ?? 0 }]));
    return controlsFor(fw).map((c) => ({
      ...c,
      openFindings: open.get(c.id)?.count ?? 0,
      maxRiskScore: open.get(c.id)?.maxRisk ?? 0,
      compliant: !open.has(c.id),
    }));
  }

  /** Persists control mappings for findings (idempotent thanks to the unique index). */
  async mapFindings(findings: { id: string; tool: string; category: string; severity: Prisma.FindingCreateInput['severity']; title: string; description: string }[]) {
    const data = findings.flatMap((f) =>
      mapFinding(f).map((controlId) => {
        const c = controlById.get(controlId)!;
        return { findingId: f.id, framework: c.framework, controlId, controlTitle: c.title, clause: c.clause, riskScore: RISK_BY_SEVERITY[f.severity] };
      }),
    );
    if (data.length) await this.prisma.complianceMapping.createMany({ data, skipDuplicates: true });
    return data.length;
  }

  /** Control-based score: share of a framework's controls with no open mapped finding. */
  async calculateScore(framework: string, service?: string) {
    const fw = this.framework(framework);
    return this.cache.getOrSetJson(`compliance:score:${fw}:${service ?? '*'}`, async () => {
      const controls = await this.getControls(fw, service);
      const mappings = await this.prisma.complianceMapping.findMany({
        where: { framework: fw, ...(service ? { finding: { service } } : {}) },
        select: { findingId: true, finding: { select: { status: true } } },
        distinct: ['findingId'],
      });
      const resolved = mappings.filter((m) => !(OPEN_STATUSES as readonly string[]).includes(m.finding.status)).length;
      const compliant = controls.filter((c) => c.compliant).length;
      return {
        framework: fw,
        service: service ?? null,
        score: Math.round((compliant / controls.length) * 100),
        totalControls: controls.length,
        compliantControls: compliant,
        totalFindings: mappings.length,
        resolvedFindings: resolved,
        openFindings: mappings.length - resolved,
      };
    });
  }

  async getComplianceStatus(framework?: string, service?: string) {
    const frameworks = framework ? [this.framework(framework)] : FRAMEWORKS.map((f) => f.id);
    const byFramework = Object.fromEntries(await Promise.all(frameworks.map(async (fw) => [fw, await this.calculateScore(fw, service)] as const)));
    const all = Object.values(byFramework);
    const totalControls = all.reduce((s, f) => s + f.totalControls, 0);
    const compliantControls = all.reduce((s, f) => s + f.compliantControls, 0);
    const risk = await this.prisma.complianceMapping.aggregate({
      where: { finding: { status: { in: [...OPEN_STATUSES] }, ...(service ? { service } : {}) }, ...(framework ? { framework: frameworks[0] } : {}) },
      _avg: { riskScore: true },
    });
    return {
      totalControls,
      compliantControls,
      nonCompliantControls: totalControls - compliantControls,
      overallScore: totalControls ? Math.round((compliantControls / totalControls) * 100) : 100,
      averageOpenRiskScore: Math.round(risk._avg.riskScore ?? 0),
      byFramework,
    };
  }

  async getFindingMapping(findingId: string) {
    const finding = await this.prisma.finding.findUnique({ where: { id: findingId }, select: { id: true } });
    if (!finding) throw new NotFoundException('Finding not found');
    return this.prisma.complianceMapping.findMany({ where: { findingId }, orderBy: [{ framework: 'asc' }, { controlId: 'asc' }] });
  }

  /** Manual mapping of a finding to a control (e.g. CUSTOM controls by a security lead). */
  async mapFindingToControl(findingId: string, controlId: string) {
    const finding = await this.prisma.finding.findUnique({ where: { id: findingId } });
    if (!finding) throw new NotFoundException('Finding not found');
    const control = controlById.get(controlId);
    if (!control) throw new BadRequestException(`Unknown control ${controlId}`);
    await this.invalidate();
    return this.prisma.complianceMapping.upsert({
      where: { findingId_framework_controlId: { findingId, framework: control.framework, controlId } },
      create: { findingId, framework: control.framework, controlId, controlTitle: control.title, clause: control.clause, riskScore: RISK_BY_SEVERITY[finding.severity] },
      update: {},
    });
  }

  invalidate() {
    return this.cache.invalidatePattern('compliance:*');
  }

  allControls() {
    return CONTROLS;
  }
}
