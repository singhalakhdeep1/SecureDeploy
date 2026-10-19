import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { FindingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/services/cache/cache.service';
import { StructuredLoggingService } from '../../common/services/structured-logging/structured-logging.service';
import { canSeeService, PRIVILEGED, type AuthUser } from '../../common/auth/decorators';
import { ComplianceService } from '../compliance/compliance.service';
import { fingerprint, normalize } from './normalizers';
import type { FindingsQueryDto, IngestFindingsDto } from './dto/ingest-findings.dto';

const OPEN: FindingStatus[] = ['OPEN', 'IN_PROGRESS'];
const CLOSED: FindingStatus[] = ['RESOLVED', 'IGNORED', 'FALSE_POSITIVE'];

@Injectable()
export class FindingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly compliance: ComplianceService,
    private readonly cache: CacheService,
    private readonly logging: StructuredLoggingService,
  ) {}

  /** Visibility filter: developers only see findings of services they own. */
  private scope(user?: AuthUser): Prisma.FindingWhereInput {
    return user && user.role === 'DEVELOPER' ? { service: { in: user.services } } : {};
  }

  private async invalidate() {
    await Promise.all([this.cache.invalidatePattern('findings:*'), this.compliance.invalidate()]);
  }

  /**
   * Ingests one scan: normalizes, dedupes by fingerprint (new -> created, known -> lastSeenAt
   * bumped, previously resolved -> reopened as a regression), maps new findings to compliance
   * controls and, for full scans, auto-resolves open findings the tool no longer reports.
   */
  async ingestFindings(dto: IngestFindingsDto, actor: string) {
    let normalized;
    try {
      normalized = normalize(dto.tool, { raw: dto.raw, findings: dto.findings });
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    const tool = dto.tool.toLowerCase();
    const byFp = new Map(normalized.map((f) => [fingerprint(tool, dto.service, dto.environment, f), f]));
    const fps = [...byFp.keys()];
    const now = new Date();

    const existing = await this.prisma.finding.findMany({ where: { fingerprint: { in: fps } }, select: { id: true, fingerprint: true, status: true } });
    const known = new Map(existing.map((e) => [e.fingerprint, e]));

    const toCreate = fps.filter((fp) => !known.has(fp)).map((fp) => {
      const f = byFp.get(fp)!;
      return { fingerprint: fp, tool, scanId: dto.scanId, service: dto.service, environment: dto.environment, ...f };
    });
    const reopenIds = existing.filter((e) => e.status === 'RESOLVED').map((e) => e.id);
    const seenIds = existing.map((e) => e.id);

    const result = await this.prisma.$transaction(async (tx) => {
      if (toCreate.length) await tx.finding.createMany({ data: toCreate, skipDuplicates: true });
      if (seenIds.length) await tx.finding.updateMany({ where: { id: { in: seenIds } }, data: { lastSeenAt: now, scanId: dto.scanId } });
      if (reopenIds.length) {
        await tx.finding.updateMany({ where: { id: { in: reopenIds } }, data: { status: 'OPEN', resolvedAt: null, resolvedBy: null, statusNote: `Reopened: reported again by scan ${dto.scanId}` } });
      }
      let autoResolved = 0;
      if (dto.fullScan) {
        const r = await tx.finding.updateMany({
          where: { tool, service: dto.service, environment: dto.environment, status: { in: OPEN }, fingerprint: { notIn: fps } },
          data: { status: 'RESOLVED', resolvedAt: now, resolvedBy: `scanner:${tool}`, statusNote: `No longer reported by full scan ${dto.scanId}` },
        });
        autoResolved = r.count;
      }
      return { autoResolved };
    });

    const created = toCreate.length
      ? await this.prisma.finding.findMany({
          where: { fingerprint: { in: toCreate.map((c) => c.fingerprint) } },
          select: { id: true, tool: true, category: true, severity: true, title: true, description: true },
        })
      : [];
    const mappings = await this.compliance.mapFindings(created);
    await this.invalidate();

    const summary = {
      success: true,
      scanId: dto.scanId,
      received: normalized.length,
      ingested: created.length,
      updated: seenIds.length - reopenIds.length,
      reopened: reopenIds.length,
      autoResolved: result.autoResolved,
      complianceMappings: mappings,
    };
    await this.logging.logAuditEvent('findings.ingested', `${tool} scan ${dto.scanId} for ${dto.service}/${dto.environment}`, {
      actor, entityType: 'scan', entityId: dto.scanId, ...summary,
    });
    return summary;
  }

  async findAll(q: FindingsQueryDto, user: AuthUser) {
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 50, 200);
    const where: Prisma.FindingWhereInput = {
      AND: [
        this.scope(user),
        q.service ? { service: q.service } : {},
        q.environment ? { environment: q.environment } : {},
        q.severity ? { severity: q.severity as Prisma.EnumFindingSeverityFilter['equals'] } : {},
        q.status ? { status: q.status } : {},
        q.tool ? { tool: q.tool.toLowerCase() } : {},
        q.category ? { category: q.category } : {},
        q.search ? { OR: [{ title: { contains: q.search, mode: 'insensitive' } }, { cveId: { contains: q.search, mode: 'insensitive' } }, { packageName: { contains: q.search, mode: 'insensitive' } }] } : {},
      ],
    };
    const [data, total] = await Promise.all([
      this.prisma.finding.findMany({ where, orderBy: [{ severity: 'asc' }, { lastSeenAt: 'desc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.finding.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, user: AuthUser) {
    const finding = await this.prisma.finding.findUnique({ where: { id }, include: { complianceMappings: { orderBy: { framework: 'asc' } } } });
    if (!finding || !canSeeService(user, finding.service)) throw new NotFoundException('Finding not found');
    return finding;
  }

  /**
   * Status workflow. Security leads/admins may set any status; developers may move findings of
   * their own services to IN_PROGRESS / RESOLVED (risk acceptance stays with security).
   */
  async updateStatus(id: string, status: FindingStatus, user: AuthUser, note?: string) {
    if (user.role === 'AUDITOR') throw new ForbiddenException('Auditors have read-only access');
    const finding = await this.findOne(id, user);
    if (user.role === 'DEVELOPER' && !['IN_PROGRESS', 'RESOLVED', 'OPEN'].includes(status)) {
      throw new ForbiddenException('Only security leads can ignore findings or mark them as false positives');
    }
    if ((status === 'IGNORED' || status === 'FALSE_POSITIVE') && !note) throw new BadRequestException('A justification note is required');
    const closing = CLOSED.includes(status);
    const updated = await this.prisma.finding.update({
      where: { id },
      data: { status, statusNote: note ?? null, resolvedAt: closing ? new Date() : null, resolvedBy: closing ? user.email : null },
    });
    await this.invalidate();
    await this.logging.logAuditEvent('finding.status_changed', `${finding.title}: ${finding.status} -> ${status}`, {
      entityType: 'finding', entityId: id, from: finding.status, to: status, note,
    });
    return updated;
  }

  resolveFinding(id: string, user: AuthUser, note?: string) {
    return this.updateStatus(id, 'RESOLVED', user, note);
  }

  async getStats(user: AuthUser) {
    const key = `findings:stats:${user.role === 'DEVELOPER' ? user.id : 'all'}`;
    return this.cache.getOrSetJson(key, async () => {
      const where = this.scope(user);
      const open = { AND: [where, { status: { in: OPEN } }] };
      const [total, openCount, bySeverity, byStatus, byService, byTool, openBySeverity] = await Promise.all([
        this.prisma.finding.count({ where }),
        this.prisma.finding.count({ where: open }),
        this.prisma.finding.groupBy({ by: ['severity'], where, _count: { _all: true } }),
        this.prisma.finding.groupBy({ by: ['status'], where, _count: { _all: true } }),
        this.prisma.finding.groupBy({ by: ['service'], where: open, _count: { _all: true }, orderBy: { _count: { service: 'desc' } }, take: 20 }),
        this.prisma.finding.groupBy({ by: ['tool'], where, _count: { _all: true } }),
        this.prisma.finding.groupBy({ by: ['severity'], where: open, _count: { _all: true } }),
      ]);
      const flat = <K extends string>(rows: ({ _count: { _all: number } } & Record<K, string>)[], k: K) => Object.fromEntries(rows.map((r) => [r[k], r._count._all]));
      return {
        total,
        open: openCount,
        resolved: total - openCount,
        bySeverity: flat(bySeverity, 'severity'),
        openBySeverity: flat(openBySeverity, 'severity'),
        byStatus: flat(byStatus, 'status'),
        openByService: flat(byService, 'service'),
        byTool: flat(byTool, 'tool'),
      };
    });
  }

  /** Mean time to remediate (hours), overall and per severity. */
  async calculateMTTR(user: AuthUser, days?: number) {
    const resolved = await this.prisma.finding.findMany({
      where: {
        AND: [
          this.scope(user),
          { status: 'RESOLVED', resolvedAt: { not: null } },
          days ? { resolvedAt: { gte: new Date(Date.now() - days * 86_400_000) } } : {},
        ],
      },
      select: { firstSeenAt: true, resolvedAt: true, severity: true },
    });
    const hours = (f: { firstSeenAt: Date; resolvedAt: Date | null }) => (f.resolvedAt!.getTime() - f.firstSeenAt.getTime()) / 3_600_000;
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : 0);
    const bySeverity: Record<string, { mttrHours: number; sampleSize: number }> = {};
    for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']) {
      const xs = resolved.filter((f) => f.severity === sev).map(hours);
      bySeverity[sev] = { mttrHours: avg(xs), sampleSize: xs.length };
    }
    return { mttrHours: avg(resolved.map(hours)), sampleSize: resolved.length, bySeverity };
  }

  /** New vs resolved findings per day for the last N days. */
  async getTrend(user: AuthUser, days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const where = this.scope(user);
    const [created, resolved] = await Promise.all([
      this.prisma.finding.findMany({ where: { AND: [where, { firstSeenAt: { gte: since } }] }, select: { firstSeenAt: true } }),
      this.prisma.finding.findMany({ where: { AND: [where, { resolvedAt: { gte: since } }] }, select: { resolvedAt: true } }),
    ]);
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const series = new Map<string, { date: string; new: number; resolved: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = day(new Date(Date.now() - i * 86_400_000));
      series.set(d, { date: d, new: 0, resolved: 0 });
    }
    created.forEach((f) => series.get(day(f.firstSeenAt)) && series.get(day(f.firstSeenAt))!.new++);
    resolved.forEach((f) => series.get(day(f.resolvedAt!)) && series.get(day(f.resolvedAt!))!.resolved++);
    return [...series.values()];
  }

  /** Open blocking counts for the deployment gate. */
  async openCounts(service: string, environment: string) {
    const rows = await this.prisma.finding.groupBy({ by: ['severity'], where: { service, environment, status: { in: OPEN } }, _count: { _all: true } });
    const get = (s: string) => rows.find((r) => r.severity === s)?._count._all ?? 0;
    return { critical: get('CRITICAL'), high: get('HIGH'), total: rows.reduce((n, r) => n + r._count._all, 0) };
  }

  canManage(user: AuthUser) {
    return PRIVILEGED.includes(user.role);
  }
}
