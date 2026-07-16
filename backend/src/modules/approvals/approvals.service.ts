import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  async requestDeployment(requestDto: any) {
    const { service, environment, version, commitSha, requestedBy } = requestDto;

    // Check for critical findings that would block deployment
    const criticalFindings = await this.prisma.finding.count({
      where: {
        service,
        environment,
        severity: 'CRITICAL',
        status: 'OPEN',
      },
    });

    const highFindings = await this.prisma.finding.count({
      where: {
        service,
        environment,
        severity: 'HIGH',
        status: 'OPEN',
      },
    });

    const deployment = await this.prisma.deployment.create({
      data: {
        service,
        environment,
        version,
        commitSha,
        requestedBy,
        status: criticalFindings > 0 ? 'REJECTED' : 'PENDING',
        findingsCount: criticalFindings + highFindings,
        criticalCount: criticalFindings,
        highCount: highFindings,
        rejectionReason: criticalFindings > 0 
          ? `${criticalFindings} critical findings must be resolved before deployment`
          : null,
      },
    });

    return deployment;
  }

  async approveDeployment(id: string, approvalDto: any) {
    const { approver, comments, exceptions } = approvalDto;

    // Check if user has permission to approve
    const user =	await this.prisma.user.findUnique({
      where: { email: approver },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SECURITY_LEAD')) {
      throw new ForbiddenException('Only security leads and admins can approve deployments');
    }

    // Check deployment status
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
      include: { approvals: true },
    });

    if (!deployment || deployment.status !== 'PENDING') {
      throw new ForbiddenException('Deployment is not pending approval');
    }

    // Create approval record
    await this.prisma.approval.create({
      data: {
        deploymentId: id,
        approverId: user.id,
        decision: 'approved',
        comments,
      },
    });

    // Update deployment status
    const updated = await this.prisma.deployment.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: approver,
        approvedAt: new Date(),
        exceptions: exceptions || [],
      },
    });

    return updated;
  }

  async rejectDeployment(id: string, rejectionDto: any) {
    const { approver, reason } = rejectionDto;

    // Check if user has permission to reject
    const user = await this.prisma.user.findUnique({
      where: { email: approver },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SECURITY_LEAD')) {
      throw new ForbiddenException('Only security leads and admins can reject deployments');
    }

    // Create approval record
    await this.prisma.approval.create({
      data: {
        deploymentId: id,
        approverId: user.id,
        decision: 'rejected',
        comments: reason,
      },
    });

    // Update deployment status
    const updated = await this.prisma.deployment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: approver,
        approvedAt: new Date(),
        rejectionReason: reason,
      },
    });

    return updated;
  }

  async getDeploymentStatus(id: string) {
    return this.prisma.deployment.findUnique({
      where: { id },
      include: {
        approvals: {
          include: {
            approver: true,
          },
        },
      },
    });
  }

  async getPendingDeployments(service?: string) {
    const where: any = { status: 'PENDING' };
    if (service) where.service = service;

    return this.prisma.deployment.findMany({
      where,
      include: {
        approvals: true,
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async getApprovalHistory(id: string) {
    return this.prisma.approval.findMany({
      where: { deploymentId: id },
      include: {
        approver: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async checkDeploymentEligibility(service: string, environment: string) {
    const criticalFindings = await this.prisma.finding.count({
      where: {
        service,
        environment,
        severity: 'CRITICAL',
        status: 'OPEN',
      },
    });

    const highFindings = await this.prisma.finding.count({
      where: {
        service,
        environment,
        severity: 'HIGH',
        status: 'OPEN',
      },
    });

    return {
      eligible: criticalFindings === 0,
      criticalFindings,
      highFindings,
      message: criticalFindings > 0
        ? `${criticalFindings} critical findings must be resolved`
        : 'Deployment eligible for approval',
    };
  }
}
