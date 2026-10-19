import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { DeploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StructuredLoggingService } from '../../common/services/structured-logging/structured-logging.service';
import { canSeeService, PRIVILEGED, type AuthUser } from '../../common/auth/decorators';
import { FindingsService } from '../findings/findings.service';
import type { DeploymentsQueryDto, RequestDeploymentDto } from './dto/approvals.dto';

/**
 * Deployment approval workflow:
 *   request -> gate: open CRITICAL findings for service/env => REJECTED (gateBlocked), else PENDING
 *   PENDING -> approve (ADMIN/SECURITY_LEAD, not the requester) => APPROVED | reject => REJECTED
 *   gate-REJECTED -> exception (security lead accepts the listed criticals with a justification) => PENDING
 *   APPROVED -> deployed => DEPLOYED -> rollback => ROLLED_BACK
 * Every decision is an Approval row plus an audit event.
 */
@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly findings: FindingsService,
    private readonly logging: StructuredLoggingService,
  ) {}

  private readonly maxHigh = parseInt(process.env.DEPLOY_MAX_HIGH_FINDINGS || '-1', 10); // -1 = highs never block

  async checkDeploymentEligibility(service: string, environment: string) {
    const counts = await this.findings.openCounts(service, environment);
    const highBlocks = this.maxHigh >= 0 && counts.high > this.maxHigh;
    const eligible = counts.critical === 0 && !highBlocks;
    return {
      eligible,
      criticalFindings: counts.critical,
      highFindings: counts.high,
      openFindings: counts.total,
      message: counts.critical > 0
        ? `${counts.critical} critical findings must be resolved before deployment`
        : highBlocks
          ? `${counts.high} open high findings exceed the limit of ${this.maxHigh}`
          : 'Deployment eligible for approval',
    };
  }

  async requestDeployment(dto: RequestDeploymentDto, requestedBy: string, user?: AuthUser) {
    if (user) {
      if (user.role === 'AUDITOR') throw new ForbiddenException('Auditors cannot request deployments');
      if (!canSeeService(user, dto.service)) throw new ForbiddenException(`You do not own service ${dto.service}`);
    }
    const gate = await this.checkDeploymentEligibility(dto.service, dto.environment);
    const deployment = await this.prisma.deployment.create({
      data: {
        ...dto,
        requestedBy,
        status: gate.eligible ? 'PENDING' : 'REJECTED',
        gateBlocked: !gate.eligible,
        rejectionReason: gate.eligible ? null : gate.message,
        findingsCount: gate.openFindings,
        criticalCount: gate.criticalFindings,
        highCount: gate.highFindings,
      },
    });
    await this.logging.logAuditEvent('deployment.requested', `${dto.service}@${dto.version} to ${dto.environment}: ${deployment.status}`, {
      actor: requestedBy, entityType: 'deployment', entityId: deployment.id, gate,
    });
    return { ...deployment, gate };
  }

  private async load(id: string) {
    const deployment = await this.prisma.deployment.findUnique({ where: { id } });
    if (!deployment) throw new NotFoundException('Deployment not found');
    return deployment;
  }

  private assertApprover(user: AuthUser, requestedBy: string) {
    if (!PRIVILEGED.includes(user.role)) throw new ForbiddenException('Only security leads and admins can decide on deployments');
    if (user.email === requestedBy) throw new ForbiddenException('Segregation of duties: you cannot decide on your own deployment request');
  }

  private async decide(id: string, user: AuthUser, from: DeploymentStatus[], decision: string, data: Prisma.DeploymentUpdateInput, comments?: string) {
    const deployment = await this.load(id);
    if (!from.includes(deployment.status)) throw new ConflictException(`Deployment is ${deployment.status}; expected ${from.join(' or ')}`);
    const [, updated] = await this.prisma.$transaction([
      this.prisma.approval.create({ data: { deploymentId: id, approverId: user.id, decision, comments } }),
      this.prisma.deployment.update({ where: { id, status: deployment.status }, data }),
    ]);
    await this.logging.logAuditEvent(`deployment.${decision}`, `${deployment.service}@${deployment.version} (${deployment.environment}) ${decision} by ${user.email}`, {
      entityType: 'deployment', entityId: id, comments,
    });
    return updated;
  }

  async approveDeployment(id: string, user: AuthUser, comments?: string) {
    const deployment = await this.load(id);
    this.assertApprover(user, deployment.requestedBy);
    // Re-run the gate: criticals may have appeared since the request (accepted exceptions excluded).
    const open = await this.prisma.finding.findMany({
      where: { service: deployment.service, environment: deployment.environment, severity: 'CRITICAL', status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { id: true },
    });
    const unaccepted = open.filter((f) => !deployment.exceptions.includes(f.id));
    if (unaccepted.length) throw new ConflictException(`${unaccepted.length} open critical findings without an exception block this deployment`);
    return this.decide(id, user, ['PENDING'], 'approved', { status: 'APPROVED', approvedBy: user.email, approvedAt: new Date() }, comments);
  }

  async rejectDeployment(id: string, user: AuthUser, reason: string) {
    const deployment = await this.load(id);
    this.assertApprover(user, deployment.requestedBy);
    return this.decide(id, user, ['PENDING'], 'rejected', { status: 'REJECTED', gateBlocked: false, approvedBy: user.email, approvedAt: new Date(), rejectionReason: reason }, reason);
  }

  /** Exception workflow: a security lead accepts specific open critical findings for this deployment. */
  async grantException(id: string, user: AuthUser, findingIds: string[], justification: string) {
    const deployment = await this.load(id);
    this.assertApprover(user, deployment.requestedBy);
    if (!deployment.gateBlocked) throw new ConflictException('Exceptions apply only to deployments blocked by the findings gate');
    const open = await this.prisma.finding.findMany({
      where: { service: deployment.service, environment: deployment.environment, severity: 'CRITICAL', status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { id: true },
    });
    const openIds = open.map((f) => f.id);
    const unknown = findingIds.filter((f) => !openIds.includes(f));
    if (unknown.length) throw new BadRequestException(`Not open critical findings of this service/environment: ${unknown.join(', ')}`);
    const missing = openIds.filter((f) => !findingIds.includes(f));
    if (missing.length) throw new BadRequestException(`Every open critical finding must be covered; missing: ${missing.join(', ')}`);
    return this.decide(id, user, ['REJECTED'], 'exception', {
      status: 'PENDING', gateBlocked: false, exceptions: findingIds, exceptionReason: justification, rejectionReason: null,
    }, justification);
  }

  async markDeployed(id: string, actor: string) {
    const d = await this.load(id);
    if (d.status !== 'APPROVED') throw new ConflictException(`Only APPROVED deployments can be marked deployed (is ${d.status})`);
    const updated = await this.prisma.deployment.update({ where: { id, status: 'APPROVED' }, data: { status: 'DEPLOYED', deployedAt: new Date() } });
    await this.logging.logAuditEvent('deployment.deployed', `${d.service}@${d.version} deployed to ${d.environment}`, { actor, entityType: 'deployment', entityId: id });
    return updated;
  }

  async rollback(id: string, actor: string, reason?: string) {
    const d = await this.load(id);
    if (d.status !== 'DEPLOYED') throw new ConflictException(`Only DEPLOYED deployments can be rolled back (is ${d.status})`);
    const updated = await this.prisma.deployment.update({ where: { id, status: 'DEPLOYED' }, data: { status: 'ROLLED_BACK', rolledBackAt: new Date() } });
    await this.logging.logAuditEvent('deployment.rolled_back', `${d.service}@${d.version} rolled back in ${d.environment}`, { actor, entityType: 'deployment', entityId: id, reason });
    return updated;
  }

  async getDeploymentStatus(id: string, user?: AuthUser) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
      include: { approvals: { include: { approver: { select: { id: true, email: true, name: true, role: true } } }, orderBy: { createdAt: 'asc' } } },
    });
    if (!deployment || (user && !canSeeService(user, deployment.service))) throw new NotFoundException('Deployment not found');
    return deployment;
  }

  async listDeployments(q: DeploymentsQueryDto, user: AuthUser) {
    const where: Prisma.DeploymentWhereInput = {
      ...(q.service ? { service: q.service } : {}),
      ...(q.environment ? { environment: q.environment } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(user.role === 'DEVELOPER' ? { service: q.service && user.services.includes(q.service) ? q.service : { in: user.services } } : {}),
    };
    return this.prisma.deployment.findMany({ where, include: { approvals: true }, orderBy: { requestedAt: 'desc' }, take: 200 });
  }

  getPendingDeployments(user: AuthUser, service?: string) {
    return this.listDeployments({ service, status: 'PENDING' }, user);
  }

  async getApprovalHistory(id: string, user: AuthUser) {
    await this.getDeploymentStatus(id, user);
    return this.prisma.approval.findMany({
      where: { deploymentId: id },
      include: { approver: { select: { id: true, email: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
